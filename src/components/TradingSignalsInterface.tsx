import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Clock, DollarSign, Activity, AlertCircle } from "lucide-react";

interface PriceData {
  date: string;
  price: number;
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
}

interface TradingSignal {
  timestamp: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  confidence: number;
  indicators: {
    rsi: number;
    macd: number;
    bb_position: number;
    stoch_rsi: number;
    adx: number;
    obv_trend: 'UP' | 'DOWN' | 'NEUTRAL';
    aroon_up: number;
    aroon_down: number;
  };
  reasoning: string[];
}

// Persistent price data storage
let priceDataCache: { [key: string]: PriceData[] } = {};

// Realistic market data generator with continuity
const generateTimeframeData = (symbol: string, timeframe: string, periods: number): PriceData[] => {
  const cacheKey = `${symbol}_${timeframe}`;
  
  // Base prices for different symbols
  const basePrices = {
    'BTCUSDT': 43000,
    'ETHUSDT': 2600,
    'BNBUSDT': 310,
    'ADAUSDT': 0.45,
    'SOLUSDT': 95
  };
  
  const basePrice = basePrices[symbol as keyof typeof basePrices] || 50000;
  
  // If we have existing data, extend it
  if (priceDataCache[cacheKey] && priceDataCache[cacheKey].length > 0) {
    const existingData = priceDataCache[cacheKey];
    const lastPrice = existingData[existingData.length - 1].close;
    const lastTimestamp = new Date(existingData[existingData.length - 1].date);
    
    const timeframeMinutes = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60
    };
    
    const intervalMs = (timeframeMinutes[timeframe as keyof typeof timeframeMinutes] || 1) * 60 * 1000;
    const newTimestamp = new Date(lastTimestamp.getTime() + intervalMs);
    
    // Generate next candle with realistic price movement
    const volatility = getVolatilityForSymbol(symbol);
    const trendFactor = getTrendFactor(existingData);
    const randomChange = (Math.random() - 0.5) * volatility + trendFactor;
    
    const newPrice = lastPrice * (1 + randomChange);
    const spread = newPrice * 0.002; // 0.2% spread for high/low
    const high = newPrice + (Math.random() * spread);
    const low = newPrice - (Math.random() * spread);
    const volume = generateRealisticVolume(symbol, existingData);
    
    const newCandle: PriceData = {
      date: newTimestamp.toISOString(),
      price: newPrice,
      open: lastPrice,
      close: newPrice,
      high: Math.max(high, newPrice, lastPrice),
      low: Math.min(low, newPrice, lastPrice),
      volume
    };
    
    // Add new candle and maintain window size
    const updatedData = [...existingData, newCandle].slice(-periods);
    priceDataCache[cacheKey] = updatedData;
    return updatedData;
  }
  
  // Generate initial dataset
  const data: PriceData[] = [];
  let currentPrice = basePrice;
  const now = new Date();
  
  const timeframeMinutes = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60
  };
  
  const intervalMs = (timeframeMinutes[timeframe as keyof typeof timeframeMinutes] || 1) * 60 * 1000;
  const volatility = getVolatilityForSymbol(symbol);
  
  for (let i = periods; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * intervalMs));
    
    // More realistic price movement with trend and mean reversion
    const trendComponent = Math.sin((periods - i) / 30) * 0.0005;
    const meanReversionComponent = (basePrice - currentPrice) / basePrice * 0.001;
    const randomComponent = (Math.random() - 0.5) * volatility;
    
    const priceChange = trendComponent + meanReversionComponent + randomComponent;
    const newPrice = currentPrice * (1 + priceChange);
    
    const spread = newPrice * 0.002;
    const high = newPrice + (Math.random() * spread);
    const low = newPrice - (Math.random() * spread);
    const volume = generateRealisticVolume(symbol, data);
    
    data.push({
      date: timestamp.toISOString(),
      price: newPrice,
      open: currentPrice,
      close: newPrice,
      high: Math.max(high, newPrice, currentPrice),
      low: Math.min(low, newPrice, currentPrice),
      volume
    });
    
    currentPrice = newPrice;
  }
  
  priceDataCache[cacheKey] = data;
  return data;
};

// Helper functions for realistic market simulation
const getVolatilityForSymbol = (symbol: string): number => {
  const volatilities = {
    'BTCUSDT': 0.015,  // 1.5% volatility
    'ETHUSDT': 0.018,  // 1.8% volatility
    'BNBUSDT': 0.022,  // 2.2% volatility
    'ADAUSDT': 0.025,  // 2.5% volatility
    'SOLUSDT': 0.028   // 2.8% volatility
  };
  return volatilities[symbol as keyof typeof volatilities] || 0.02;
};

const getTrendFactor = (data: PriceData[]): number => {
  if (data.length < 10) return 0;
  
  const recent = data.slice(-10);
  const firstPrice = recent[0].close;
  const lastPrice = recent[recent.length - 1].close;
  const trend = (lastPrice - firstPrice) / firstPrice;
  
  // Trend continuation with some mean reversion
  return trend * 0.1; // 10% of recent trend continues
};

const generateRealisticVolume = (symbol: string, existingData: PriceData[]): number => {
  const baseVolumes = {
    'BTCUSDT': 25000000,
    'ETHUSDT': 15000000,
    'BNBUSDT': 8000000,
    'ADAUSDT': 500000000,
    'SOLUSDT': 50000000
  };
  
  const baseVolume = baseVolumes[symbol as keyof typeof baseVolumes] || 10000000;
  
  // Volume varies with price volatility
  const volatilityMultiplier = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
  
  // Higher volume during price movements
  if (existingData.length > 0) {
    const lastCandle = existingData[existingData.length - 1];
    const priceChangePercent = Math.abs((lastCandle.close - lastCandle.open) / lastCandle.open);
    const volumeBoost = 1 + (priceChangePercent * 5); // More volume with bigger moves
    return baseVolume * volatilityMultiplier * volumeBoost;
  }
  
  return baseVolume * volatilityMultiplier;
};

// Import indicator calculations from TradingDecisionPanel
const calculateIndicators = (data: PriceData[], currentPrice: number) => {
  const prices = data.map(d => d.close || d.price || 0).filter(p => p > 0);
  
  // RSI calculation
  const calculateRSI = (prices: number[], period: number = 14): number => {
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
  };

  // MACD calculation
  const calculateEMA = (prices: number[], period: number): number => {
    if (prices.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  };

  const calculateMACD = (prices: number[]): number => {
    if (prices.length < 26) return 0;
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    return ema12 - ema26;
  };

  // Bollinger Bands
  const calculateBollingerPosition = (prices: number[], currentPrice: number): number => {
    if (prices.length < 20) return 50;
    const recentPrices = prices.slice(-20);
    const middle = recentPrices.reduce((a, b) => a + b, 0) / 20;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    const upper = middle + (2 * stdDev);
    const lower = middle - (2 * stdDev);
    
    if (upper === lower) return 50;
    return Math.max(0, Math.min(100, ((currentPrice - lower) / (upper - lower)) * 100));
  };

  // Stochastic RSI
  const calculateStochasticRSI = (prices: number[]): number => {
    if (prices.length < 28) return 50;
    const rsiSeries: number[] = [];
    for (let i = 14; i <= prices.length; i++) {
      const slice = prices.slice(i - 14, i);
      rsiSeries.push(calculateRSI(slice, 14));
    }
    const recent = rsiSeries.slice(-14);
    const minRsi = Math.min(...recent);
    const maxRsi = Math.max(...recent);
    if (maxRsi === minRsi) return 50;
    const currentRsi = recent[recent.length - 1];
    return ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
  };

  // ADX
  const calculateADX = (data: PriceData[]): number => {
    if (data.length < 15) return 0;
    let trSum = 0, plusDmSum = 0, minusDmSum = 0;
    for (let i = data.length - 14; i < data.length; i++) {
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

    if (trSum === 0) return 0;
    const plusDI = (plusDmSum / trSum) * 100;
    const minusDI = (minusDmSum / trSum) * 100;
    return (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 || 0;
  };

  // OBV trend
  const calculateOBVTrend = (data: PriceData[]): 'UP' | 'DOWN' | 'NEUTRAL' => {
    if (data.length < 2) return 'NEUTRAL';
    let obv = 0;
    const obvSeries: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const currentClose = data[i].close ?? data[i].price ?? 0;
      const prevClose = data[i-1].close ?? data[i-1].price ?? 0;
      const volume = data[i].volume ?? 0;
      if (currentClose > prevClose) {
        obv += volume;
      } else if (currentClose < prevClose) {
        obv -= volume;
      }
      obvSeries.push(obv);
    }
    const recentObv = obvSeries.slice(-20);
    const obvSma = recentObv.reduce((a, b) => a + b, 0) / recentObv.length;
    return obv > obvSma ? 'UP' : obv < obvSma ? 'DOWN' : 'NEUTRAL';
  };

  // Aroon
  const calculateAroon = (data: PriceData[]): { up: number; down: number } => {
    if (data.length < 25) return { up: 0, down: 0 };
    const slice = data.slice(-25);
    const highPrices = slice.map(d => d.high ?? d.price ?? 0);
    const lowPrices = slice.map(d => d.low ?? d.price ?? 0);
    
    const highestHigh = Math.max(...highPrices);
    const lowestLow = Math.min(...lowPrices);

    const daysSinceHigh = highPrices.slice().reverse().indexOf(highestHigh);
    const daysSinceLow = lowPrices.slice().reverse().indexOf(lowestLow);

    const up = ((25 - daysSinceHigh) / 25) * 100;
    const down = ((25 - daysSinceLow) / 25) * 100;

    return { up, down };
  };

  const rsi = calculateRSI(prices);
  const macd = calculateMACD(prices);
  const bb_position = calculateBollingerPosition(prices, currentPrice);
  const stoch_rsi = calculateStochasticRSI(prices);
  const adx = calculateADX(data);
  const obv_trend = calculateOBVTrend(data);
  const aroon = calculateAroon(data);

  return {
    rsi,
    macd,
    bb_position,
    stoch_rsi,
    adx,
    obv_trend,
    aroon_up: aroon.up,
    aroon_down: aroon.down
  };
};

const generateTradingSignal = (data: PriceData[], symbol: string, timeframe: string): TradingSignal => {
  const currentPrice = data[data.length - 1].close;
  const indicators = calculateIndicators(data, currentPrice);
  
  const reasoning: string[] = [];
  let buySignals = 0;
  let sellSignals = 0;
  let totalStrength = 0;

  // RSI analysis
  if (indicators.rsi < 30) {
    buySignals++;
    totalStrength += (30 - indicators.rsi) * 2;
    reasoning.push(`RSI oversold (${indicators.rsi.toFixed(1)}) - BUY signal`);
  } else if (indicators.rsi > 70) {
    sellSignals++;
    totalStrength += (indicators.rsi - 70) * 2;
    reasoning.push(`RSI overbought (${indicators.rsi.toFixed(1)}) - SELL signal`);
  }

  // MACD analysis
  if (indicators.macd > 0) {
    buySignals++;
    totalStrength += Math.abs(indicators.macd) * 50;
    reasoning.push(`MACD bullish (${indicators.macd.toFixed(2)}) - BUY signal`);
  } else if (indicators.macd < 0) {
    sellSignals++;
    totalStrength += Math.abs(indicators.macd) * 50;
    reasoning.push(`MACD bearish (${indicators.macd.toFixed(2)}) - SELL signal`);
  }

  // Bollinger Bands analysis
  if (indicators.bb_position < 20) {
    buySignals++;
    totalStrength += 60;
    reasoning.push(`Price near lower Bollinger Band (${indicators.bb_position.toFixed(0)}%) - BUY signal`);
  } else if (indicators.bb_position > 80) {
    sellSignals++;
    totalStrength += 60;
    reasoning.push(`Price near upper Bollinger Band (${indicators.bb_position.toFixed(0)}%) - SELL signal`);
  }

  // Stochastic RSI analysis
  if (indicators.stoch_rsi < 20) {
    buySignals++;
    totalStrength += (20 - indicators.stoch_rsi) * 2;
    reasoning.push(`Stochastic RSI oversold (${indicators.stoch_rsi.toFixed(1)}) - BUY signal`);
  } else if (indicators.stoch_rsi > 80) {
    sellSignals++;
    totalStrength += (indicators.stoch_rsi - 80) * 2;
    reasoning.push(`Stochastic RSI overbought (${indicators.stoch_rsi.toFixed(1)}) - SELL signal`);
  }

  // ADX analysis
  if (indicators.adx > 25) {
    reasoning.push(`Strong trend detected (ADX: ${indicators.adx.toFixed(1)})`);
  }

  // OBV analysis
  if (indicators.obv_trend === 'UP') {
    buySignals++;
    totalStrength += 40;
    reasoning.push(`Volume trend supporting upward movement - BUY signal`);
  } else if (indicators.obv_trend === 'DOWN') {
    sellSignals++;
    totalStrength += 40;
    reasoning.push(`Volume trend supporting downward movement - SELL signal`);
  }

  // Aroon analysis
  if (indicators.aroon_up > indicators.aroon_down && indicators.aroon_up > 70) {
    buySignals++;
    totalStrength += indicators.aroon_up;
    reasoning.push(`Strong uptrend emerging (Aroon Up: ${indicators.aroon_up.toFixed(0)}%) - BUY signal`);
  } else if (indicators.aroon_down > indicators.aroon_up && indicators.aroon_down > 70) {
    sellSignals++;
    totalStrength += indicators.aroon_down;
    reasoning.push(`Strong downtrend emerging (Aroon Down: ${indicators.aroon_down.toFixed(0)}%) - SELL signal`);
  }

  // Determine final action
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 0;

  if (buySignals >= 3 && buySignals > sellSignals) {
    action = 'BUY';
    confidence = Math.min(95, totalStrength / buySignals);
  } else if (sellSignals >= 3 && sellSignals > buySignals) {
    action = 'SELL';
    confidence = Math.min(95, totalStrength / sellSignals);
  } else if (buySignals >= 2 && buySignals > sellSignals) {
    action = 'BUY';
    confidence = Math.min(75, totalStrength / buySignals);
  } else if (sellSignals >= 2 && sellSignals > buySignals) {
    action = 'SELL';
    confidence = Math.min(75, totalStrength / sellSignals);
  }

  if (reasoning.length === 0) {
    reasoning.push('Mixed signals - no clear direction');
  }

  return {
    timestamp: new Date().toISOString(),
    action,
    price: currentPrice,
    confidence,
    indicators,
    reasoning
  };
};

export const TradingSignalsInterface: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [currentSignal, setCurrentSignal] = useState<TradingSignal | null>(null);
  const [signalHistory, setSignalHistory] = useState<TradingSignal[]>([]);
  const [isLive, setIsLive] = useState(false);

  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
  const timeframes = ['1m', '5m', '15m', '30m', '1h'];

  const generateNewSignal = () => {
    const data = generateTimeframeData(selectedSymbol, selectedTimeframe, 100);
    const signal = generateTradingSignal(data, selectedSymbol, selectedTimeframe);
    setCurrentSignal(signal);
    setSignalHistory(prev => [signal, ...prev.slice(0, 9)]); // Keep last 10 signals
  };
  
  const resetPriceData = () => {
    // Clear cache to start fresh
    priceDataCache = {};
    generateNewSignal();
  };

  useEffect(() => {
    // Reset price data when changing symbol/timeframe to avoid cross-contamination
    resetPriceData();
  }, [selectedSymbol, selectedTimeframe]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(() => {
        generateNewSignal();
      }, 5000); // Update every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, selectedSymbol, selectedTimeframe]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-green-600 bg-green-50 border-green-200';
      case 'SELL': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'BUY': return TrendingUp;
      case 'SELL': return TrendingDown;
      default: return Activity;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Live Trading Signals</h1>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setIsLive(!isLive)}
            variant={isLive ? "destructive" : "default"}
          >
            {isLive ? 'Stop Live' : 'Start Live'}
          </Button>
          <Button onClick={generateNewSignal} variant="outline">
            Next Candle
          </Button>
          <Button onClick={resetPriceData} variant="secondary">
            Reset Market
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Symbol</label>
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {symbols.map(symbol => (
                <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Timeframe</label>
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeframes.map(tf => (
                <SelectItem key={tf} value={tf}>{tf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Current Signal */}
      {currentSignal && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Current Signal</h2>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {new Date(currentSignal.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Signal Action */}
            <div className={`p-4 rounded-lg border-2 ${getActionColor(currentSignal.action)}`}>
              <div className="flex items-center gap-3 mb-2">
                {React.createElement(getActionIcon(currentSignal.action), { className: "w-6 h-6" })}
                <h3 className="text-lg font-bold">{currentSignal.action}</h3>
              </div>
              <p className="text-sm opacity-80">
                Confidence: {currentSignal.confidence.toFixed(1)}%
              </p>
              <div className="flex items-center gap-2 mt-2">
                <DollarSign className="w-4 h-4" />
                <span className="font-mono">${currentSignal.price.toFixed(2)}</span>
              </div>
            </div>

            {/* Indicators */}
            <div className="space-y-3">
              <h4 className="font-semibold">Technical Indicators</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>RSI: <span className="font-mono">{currentSignal.indicators.rsi.toFixed(1)}</span></div>
                <div>MACD: <span className="font-mono">{currentSignal.indicators.macd.toFixed(2)}</span></div>
                <div>BB Pos: <span className="font-mono">{currentSignal.indicators.bb_position.toFixed(0)}%</span></div>
                <div>Stoch RSI: <span className="font-mono">{currentSignal.indicators.stoch_rsi.toFixed(1)}</span></div>
                <div>ADX: <span className="font-mono">{currentSignal.indicators.adx.toFixed(1)}</span></div>
                <div>OBV: <span className="font-mono">{currentSignal.indicators.obv_trend}</span></div>
              </div>
            </div>

            {/* Reasoning */}
            <div className="space-y-3">
              <h4 className="font-semibold">Analysis</h4>
              <div className="space-y-1">
                {currentSignal.reasoning.map((reason, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <AlertCircle className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Signal History */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Signals</h2>
        <div className="space-y-3">
          {signalHistory.map((signal, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant={signal.action === 'BUY' ? 'default' : signal.action === 'SELL' ? 'destructive' : 'secondary'}>
                  {signal.action}
                </Badge>
                <span className="font-mono text-sm">${signal.price.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">
                  {signal.confidence.toFixed(1)}% confidence
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(signal.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
