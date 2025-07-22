interface BacktestResult {
  symbol: string;
  timeframe: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  signals: Array<{
    date: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    confidence: number;
    profit?: number;
  }>;
}

interface PriceData {
  date: string;
  price: number;
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
}

// Import indicator calculations from TradingDecisionPanel
class TechnicalIndicators {
  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  static calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  static calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    const signal = macd * 0.2;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  static calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number } {
    if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
    
    const recentPrices = prices.slice(-period);
    const middle = recentPrices.reduce((a, b) => a + b, 0) / period;
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: middle + (2 * stdDev),
      middle,
      lower: middle - (2 * stdDev)
    };
  }

  static calculateStochasticRSI(prices: number[], rsiPeriod: number = 14, stochPeriod: number = 14): number {
    if (prices.length < rsiPeriod + stochPeriod) return 50;
    const rsiSeries: number[] = [];
    for (let i = rsiPeriod; i <= prices.length; i++) {
      const slice = prices.slice(i - rsiPeriod, i);
      rsiSeries.push(this.calculateRSI(slice, rsiPeriod));
    }
    const recent = rsiSeries.slice(-stochPeriod);
    const minRsi = Math.min(...recent);
    const maxRsi = Math.max(...recent);
    if (maxRsi === minRsi) return 50;
    const currentRsi = recent[recent.length - 1];
    return ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
  }

  static calculateATR(data: PriceData[], period: number = 14): number {
    if (data.length < period + 1) return 0;
    const trueRanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const curr = data[i];
      const prev = data[i - 1];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      trueRanges.push(tr);
    }

    if (trueRanges.length === 0) return 0;

    // Simple Moving Average for the first ATR value
    let atr = trueRanges.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    // Smoothed ATR for subsequent values
    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
    }

    return atr;
  }

  static calculateADX(data: PriceData[], period: number = 14): { adx: number; plusDI: number; minusDI: number } {
    if (data.length < period + 1) return { adx: 0, plusDI: 0, minusDI: 0 };
    let trSum = 0, plusDmSum = 0, minusDmSum = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const curr = data[i];
      const prev = data[i - 1];
      const currHigh = curr.high ?? curr.price ?? 0;
      const currLow = curr.low ?? curr.price ?? 0;
      const prevClose = prev.close ?? prev.price ?? 0;

      const tr = Math.max(
        currHigh - currLow,
        Math.abs(currHigh - prevClose),
        Math.abs(currLow - prevClose)
      );

      const upMove = currHigh - (prev.high ?? prev.price ?? 0);
      const downMove = (prev.low ?? prev.price ?? 0) - currLow;

      const plusDM = (upMove > downMove && upMove > 0) ? upMove : 0;
      const minusDM = (downMove > upMove && downMove > 0) ? downMove : 0;

      trSum += tr;
      plusDmSum += plusDM;
      minusDmSum += minusDM;
    }

    if (trSum === 0) return { adx: 0, plusDI: 0, minusDI: 0 };
    const plusDI = (plusDmSum / trSum) * 100;
    const minusDI = (minusDmSum / trSum) * 100;
    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 || 0;
    return { adx: dx, plusDI, minusDI };
  }
}

class TradingSignalGenerator {
  static generateSignal(data: PriceData[], currentPrice: number): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number } {
    if (data.length < 30) return { action: 'HOLD', confidence: 0 };

    const prices = data.map(d => d.close || d.price || 0).filter(p => p > 0);
    
    // Trend filter: 200-period EMA
    const ema200 = TechnicalIndicators.calculateEMA(prices, 200);
    const trend = currentPrice > ema200 ? 'UP' : 'DOWN';

    const rsi = TechnicalIndicators.calculateRSI(prices);
    const macd = TechnicalIndicators.calculateMACD(prices);
    const bb = TechnicalIndicators.calculateBollingerBands(prices);
    const stochRsi = TechnicalIndicators.calculateStochasticRSI(prices);
    const { adx, plusDI, minusDI } = TechnicalIndicators.calculateADX(data);

    // Signal strength calculation
    const getSignalStrength = (indicator: string, value: number): { signal: 'BUY' | 'SELL' | 'NEUTRAL'; strength: number } => {
      switch (indicator) {
        case 'RSI':
          if (value < 30) return { signal: 'BUY', strength: Math.min(90, (30 - value) * 3) };
          if (value > 70) return { signal: 'SELL', strength: Math.min(90, (value - 70) * 3) };
          return { signal: 'NEUTRAL', strength: 0 };
        
        case 'MACD':
          if (macd.histogram > 0) return { signal: 'BUY', strength: Math.min(80, Math.abs(macd.histogram) * 100) };
          if (macd.histogram < 0) return { signal: 'SELL', strength: Math.min(80, Math.abs(macd.histogram) * 100) };
          return { signal: 'NEUTRAL', strength: 0 };
        
        case 'BB':
          if (currentPrice < bb.lower) return { signal: 'BUY', strength: 75 };
          if (currentPrice > bb.upper) return { signal: 'SELL', strength: 75 };
          return { signal: 'NEUTRAL', strength: 0 };
        
        case 'StochRSI':
          if (value < 20) return { signal: 'BUY', strength: Math.min(80, (20 - value) * 2) };
          if (value > 80) return { signal: 'SELL', strength: Math.min(80, (value - 80) * 2) };
          return { signal: 'NEUTRAL', strength: 0 };
        
        default:
          return { signal: 'NEUTRAL', strength: 0 };
      }
    };

    const rsiSignal = getSignalStrength('RSI', rsi);
    const macdSignal = getSignalStrength('MACD', macd.histogram);
    const bbSignal = getSignalStrength('BB', currentPrice);
    const stochSignal = getSignalStrength('StochRSI', stochRsi);

    // ADX signal
    let adxSignal: { signal: 'BUY' | 'SELL' | 'NEUTRAL'; strength: number } = { signal: 'NEUTRAL', strength: 0 };
    if (adx > 25) {
      if (plusDI > minusDI) adxSignal = { signal: 'BUY', strength: Math.min(100, adx) };
      else if (minusDI > plusDI) adxSignal = { signal: 'SELL', strength: Math.min(100, adx) };
    }

    const signals = [rsiSignal, macdSignal, bbSignal, stochSignal, adxSignal];
    const buySignals = signals.filter(s => s.signal === 'BUY');
    const sellSignals = signals.filter(s => s.signal === 'SELL');
    
    const avgBuyStrength = buySignals.length > 0 ? buySignals.reduce((sum, s) => sum + s.strength, 0) / buySignals.length : 0;
    const avgSellStrength = sellSignals.length > 0 ? sellSignals.reduce((sum, s) => sum + s.strength, 0) / sellSignals.length : 0;
    
    // Determine final action based on trend and signal strength
    if (trend === 'UP' && buySignals.length >= 3 && avgBuyStrength > 60) {
      return { action: 'BUY', confidence: avgBuyStrength };
    } else if (trend === 'DOWN' && sellSignals.length >= 3 && avgSellStrength > 60) {
      // This is now a signal to enter a SHORT position
      return { action: 'SELL', confidence: avgSellStrength }; 
    }
    
    return { action: 'HOLD', confidence: 0 };
  }
}

export class Backtester {
  private static generateMockData(symbol: string, timeframe: string, days: number): PriceData[] {
    const data: PriceData[] = [];
    let basePrice = 50000; // Starting price for BTC-like
    
    if (symbol.includes('ETH')) basePrice = 3000;
    else if (symbol.includes('BNB')) basePrice = 300;
    else if (symbol.includes('ADA')) basePrice = 0.5;
    else if (symbol.includes('SOL')) basePrice = 100;
    
    const intervals = {
      '1m': days * 24 * 60,
      '5m': days * 24 * 12,
      '15m': days * 24 * 4,
      '30m': days * 24 * 2,
      '1h': days * 24
    };
    
    const totalPoints = intervals[timeframe as keyof typeof intervals] || days * 24;
    
    for (let i = 0; i < totalPoints; i++) {
      const volatility = 0.02; // 2% volatility
      const trend = Math.sin(i / 100) * 0.001; // Slight trend
      const randomChange = (Math.random() - 0.5) * volatility + trend;
      
      const newPrice = basePrice * (1 + randomChange);
      const high = newPrice * (1 + Math.random() * 0.01);
      const low = newPrice * (1 - Math.random() * 0.01);
      const volume = Math.random() * 1000000;
      
      data.push({
        date: new Date(Date.now() - (totalPoints - i) * 60000).toISOString(),
        price: newPrice,
        open: basePrice,
        close: newPrice,
        high,
        low,
        volume
      });
      
      basePrice = newPrice;
    }
    
    return data;
  }

  static async runBacktest(symbol: string, timeframe: string, days: number = 30): Promise<BacktestResult> {
    const data = this.generateMockData(symbol, timeframe, days);
    const signals: BacktestResult['signals'] = [];
    
    let position: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
    let entryPrice = 0;
    let stopLossPrice = 0;
    const atrMultiplier = 2; // ATR multiplier for stop-loss
    let totalReturn = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let maxDrawdown = 0;
    let peak = 0;
    let returns: number[] = [];
    
    for (let i = 50; i < data.length; i++) { // Start after enough data for indicators
      const historicalData = data.slice(0, i + 1);
      const currentPrice = data[i].close;
      const signal = TradingSignalGenerator.generateSignal(historicalData, currentPrice);
      
      signals.push({
        date: data[i].date,
        action: signal.action,
        price: currentPrice,
        confidence: signal.confidence
      });
      
      // Trading logic
      const atr = TechnicalIndicators.calculateATR(historicalData, 14);

      if (position === 'NONE') {
        // Entry logic for LONG positions
        if (signal.action === 'BUY' && signal.confidence > 50) {
          position = 'LONG';
          entryPrice = currentPrice;
          stopLossPrice = entryPrice - (atr * atrMultiplier);
        }
        // Entry logic for SHORT positions
        else if (signal.action === 'SELL' && signal.confidence > 50) {
          position = 'SHORT';
          entryPrice = currentPrice;
          stopLossPrice = entryPrice + (atr * atrMultiplier);
        }
      } else if (position === 'LONG') {
        // Exit logic for LONG positions
        const isStopLossHit = currentPrice <= stopLossPrice;
        const isSellSignal = signal.action === 'SELL';

        if (isStopLossHit || isSellSignal) {
          const profit = ((currentPrice - entryPrice) / entryPrice) * 100;
          totalReturn += profit;
          returns.push(profit);
          if (profit > 0) winningTrades++; else losingTrades++;
          signals[signals.length - 1].profit = profit;
          position = 'NONE';
          stopLossPrice = 0;
        }
      } else if (position === 'SHORT') {
        // Exit logic for SHORT positions
        const isStopLossHit = currentPrice >= stopLossPrice;
        const isBuySignal = signal.action === 'BUY';

        if (isStopLossHit || isBuySignal) {
          const profit = ((entryPrice - currentPrice) / entryPrice) * 100;
          totalReturn += profit;
          returns.push(profit);
          if (profit > 0) winningTrades++; else losingTrades++;
          signals[signals.length - 1].profit = profit;
          position = 'NONE';
          stopLossPrice = 0;
        }
      }
      
      // Track drawdown
      if (totalReturn > peak) peak = totalReturn;
      const drawdown = peak - totalReturn;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // Calculate Sharpe ratio
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    return {
      symbol,
      timeframe,
      totalTrades: winningTrades + losingTrades,
      winningTrades,
      losingTrades,
      winRate: (winningTrades + losingTrades) > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0,
      totalReturn,
      maxDrawdown,
      sharpeRatio,
      signals
    };
  }

  static async runComprehensiveBacktest(): Promise<BacktestResult[]> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
    const timeframes = ['1m', '5m', '15m', '30m', '1h'];
    const results: BacktestResult[] = [];
    
    console.log('Starting comprehensive backtesting...');
    
    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        console.log(`Testing ${symbol} on ${timeframe} timeframe...`);
        const result = await this.runBacktest(symbol, timeframe, 30);
        results.push(result);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  static generateReport(results: BacktestResult[]): string {
    let report = '# Trading Strategy Backtest Report\n\n';
    report += `Generated on: ${new Date().toISOString()}\n\n`;
    
    // Summary table
    report += '## Summary by Symbol and Timeframe\n\n';
    report += '| Symbol | Timeframe | Total Trades | Win Rate | Total Return | Max Drawdown | Sharpe Ratio |\n';
    report += '|--------|-----------|--------------|----------|--------------|--------------|-------------|\n';
    
    results.forEach(result => {
      report += `| ${result.symbol} | ${result.timeframe} | ${result.totalTrades} | ${result.winRate.toFixed(1)}% | ${result.totalReturn.toFixed(2)}% | ${result.maxDrawdown.toFixed(2)}% | ${result.sharpeRatio.toFixed(2)} |\n`;
    });
    
    // Best performing combinations
    report += '\n## Best Performing Combinations\n\n';
    const sortedByReturn = [...results].sort((a, b) => b.totalReturn - a.totalReturn).slice(0, 5);
    
    sortedByReturn.forEach((result, index) => {
      report += `${index + 1}. **${result.symbol} (${result.timeframe})**: ${result.totalReturn.toFixed(2)}% return, ${result.winRate.toFixed(1)}% win rate\n`;
    });
    
    // Performance by timeframe
    report += '\n## Performance by Timeframe\n\n';
    const timeframes = ['1m', '5m', '15m', '30m', '1h'];
    
    timeframes.forEach(tf => {
      const tfResults = results.filter(r => r.timeframe === tf);
      const avgReturn = tfResults.reduce((sum, r) => sum + r.totalReturn, 0) / tfResults.length;
      const avgWinRate = tfResults.reduce((sum, r) => sum + r.winRate, 0) / tfResults.length;
      
      report += `- **${tf}**: Average return ${avgReturn.toFixed(2)}%, Average win rate ${avgWinRate.toFixed(1)}%\n`;
    });
    
    // Risk analysis
    report += '\n## Risk Analysis\n\n';
    const totalReturn = results.reduce((sum, r) => sum + r.totalReturn, 0);
    const avgDrawdown = results.reduce((sum, r) => sum + r.maxDrawdown, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
    
    report += `- **Total Portfolio Return**: ${totalReturn.toFixed(2)}%\n`;
    report += `- **Average Maximum Drawdown**: ${avgDrawdown.toFixed(2)}%\n`;
    report += `- **Average Sharpe Ratio**: ${avgSharpe.toFixed(2)}\n`;
    
    // Recommendations
    report += '\n## Recommendations\n\n';
    if (avgSharpe > 1) {
      report += '✅ **Strategy shows strong risk-adjusted returns**\n';
    } else if (avgSharpe > 0.5) {
      report += '⚠️ **Strategy shows moderate performance - consider refinements**\n';
    } else {
      report += '❌ **Strategy needs significant improvement**\n';
    }
    
    if (avgDrawdown < 10) {
      report += '✅ **Low drawdown indicates good risk management**\n';
    } else {
      report += '⚠️ **High drawdown - consider tighter stop losses**\n';
    }
    
    return report;
  }
}
