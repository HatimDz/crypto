import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Target, BarChart3 } from "lucide-react";

interface PriceData {
  date: string;
  price: number;
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
}

interface TradingDecisionPanelProps {
  data: PriceData[];
  currentPrice: number;
  cryptoSymbol: string;
}

// Technical Indicator Calculations
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

const calculateMACD = (prices: number[]): { macd: number; signal: number; histogram: number } => {
  if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  // Simplified signal line (9-period EMA of MACD)
  const signal = macd * 0.2; // Simplified calculation
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
};

const calculateEMA = (prices: number[], period: number): number => {
  if (prices.length === 0) return 0;
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
};

const calculateBollingerBands = (prices: number[], period: number = 20): { upper: number; middle: number; lower: number } => {
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
};

const calculateWilliamsR = (data: PriceData[], period: number = 14): number => {
  if (data.length < period) return -50;
  
  const recentData = data.slice(-period);
  const highs = recentData.map(d => d.high || d.price || 0).filter(h => h > 0);
  const lows = recentData.map(d => d.low || d.price || 0).filter(l => l > 0);
  
  if (highs.length === 0 || lows.length === 0) return -50;
  
  const highestHigh = Math.max(...highs);
  const lowestLow = Math.min(...lows);
  const currentClose = data[data.length - 1].close || data[data.length - 1].price || 0;
  
  if (highestHigh === lowestLow) return -50;
  
  return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
};

const calculateCCI = (data: PriceData[], period: number = 20): number => {
  if (data.length < period) return 0;
  
  const recentData = data.slice(-period);
  const typicalPrices = recentData.map(d => {
    const high = d.high || d.price || 0;
    const low = d.low || d.price || 0;
    const close = d.close || d.price || 0;
    return (high + low + close) / 3;
  }).filter(tp => tp > 0);
  
  if (typicalPrices.length === 0) return 0;
  
  const sma = typicalPrices.reduce((a, b) => a + b, 0) / typicalPrices.length;
  const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / typicalPrices.length;
  
  if (meanDeviation === 0) return 0;
  
  const currentTP = typicalPrices[typicalPrices.length - 1];
  return (currentTP - sma) / (0.015 * meanDeviation);
};

export const TradingDecisionPanel: React.FC<TradingDecisionPanelProps> = ({ data, currentPrice, cryptoSymbol }) => {
  if (!data || data.length === 0) return null;

  // Debug: Log data structure
  console.log('TradingDecisionPanel - Data sample:', data.slice(0, 2));
  console.log('TradingDecisionPanel - Current price:', currentPrice);
  
  // Use fallback to 'price' if 'close' doesn't exist
  const prices = data.map(d => d.close || d.price || 0).filter(p => p > 0);
  
  if (prices.length === 0) {
    console.warn('No valid price data found');
    return null;
  }

  const rsi = calculateRSI(prices);
  const macd = calculateMACD(prices);
  const bb = calculateBollingerBands(prices);
  const williamsR = calculateWilliamsR(data);
  const cci = calculateCCI(data);
  
  // Debug: Log calculated values
  console.log('Indicators:', { rsi, macd, bb, williamsR, cci });

  // Decision Logic Based on Scientific Research
  const getSignalStrength = (indicator: string, value: number): { signal: 'BUY' | 'SELL' | 'NEUTRAL'; strength: number; color: string } => {
    switch (indicator) {
      case 'RSI':
        if (value < 30) return { signal: 'BUY', strength: Math.min(90, (30 - value) * 3), color: 'text-green-500' };
        if (value > 70) return { signal: 'SELL', strength: Math.min(90, (value - 70) * 3), color: 'text-red-500' };
        return { signal: 'NEUTRAL', strength: 0, color: 'text-yellow-500' };
      
      case 'MACD':
        if (macd.histogram > 0) return { signal: 'BUY', strength: Math.min(80, Math.abs(macd.histogram) * 100), color: 'text-green-500' };
        if (macd.histogram < 0) return { signal: 'SELL', strength: Math.min(80, Math.abs(macd.histogram) * 100), color: 'text-red-500' };
        return { signal: 'NEUTRAL', strength: 0, color: 'text-yellow-500' };
      
      case 'BB':
        if (currentPrice < bb.lower) return { signal: 'BUY', strength: 75, color: 'text-green-500' };
        if (currentPrice > bb.upper) return { signal: 'SELL', strength: 75, color: 'text-red-500' };
        return { signal: 'NEUTRAL', strength: 0, color: 'text-yellow-500' };
      
      case 'Williams%R':
        if (value < -80) return { signal: 'BUY', strength: Math.min(85, Math.abs(value + 80) * 2), color: 'text-green-500' };
        if (value > -20) return { signal: 'SELL', strength: Math.min(85, (value + 20) * 2), color: 'text-red-500' };
        return { signal: 'NEUTRAL', strength: 0, color: 'text-yellow-500' };
      
      case 'CCI':
        if (value < -100) return { signal: 'BUY', strength: Math.min(80, Math.abs(value + 100) / 2), color: 'text-green-500' };
        if (value > 100) return { signal: 'SELL', strength: Math.min(80, (value - 100) / 2), color: 'text-red-500' };
        return { signal: 'NEUTRAL', strength: 0, color: 'text-yellow-500' };
      
      default:
        return { signal: 'NEUTRAL', strength: 0, color: 'text-gray-500' };
    }
  };

  const rsiSignal = getSignalStrength('RSI', rsi);
  const macdSignal = getSignalStrength('MACD', macd.histogram);
  const bbSignal = getSignalStrength('BB', currentPrice);
  const williamsSignal = getSignalStrength('Williams%R', williamsR);
  const cciSignal = getSignalStrength('CCI', cci);

  // Overall Decision (Weighted Average)
  const signals = [rsiSignal, macdSignal, bbSignal, williamsSignal, cciSignal];
  const buySignals = signals.filter(s => s.signal === 'BUY');
  const sellSignals = signals.filter(s => s.signal === 'SELL');
  
  const avgBuyStrength = buySignals.length > 0 ? buySignals.reduce((sum, s) => sum + s.strength, 0) / buySignals.length : 0;
  const avgSellStrength = sellSignals.length > 0 ? sellSignals.reduce((sum, s) => sum + s.strength, 0) / sellSignals.length : 0;
  
  // Debug signals
  console.log('Signals:', { buySignals: buySignals.length, sellSignals: sellSignals.length, avgBuyStrength, avgSellStrength });
  
  let overallDecision: { action: string; confidence: number; color: string; icon: any } = {
    action: 'HOLD',
    confidence: 0,
    color: 'text-yellow-500',
    icon: Minus
  };

  if (buySignals.length >= 3 && avgBuyStrength > 60) {
    overallDecision = {
      action: 'STRONG BUY',
      confidence: avgBuyStrength,
      color: 'text-green-600',
      icon: TrendingUp
    };
  } else if (buySignals.length >= 2 && avgBuyStrength > 40) {
    overallDecision = {
      action: 'BUY',
      confidence: avgBuyStrength,
      color: 'text-green-500',
      icon: TrendingUp
    };
  } else if (sellSignals.length >= 3 && avgSellStrength > 60) {
    overallDecision = {
      action: 'STRONG SELL',
      confidence: avgSellStrength,
      color: 'text-red-600',
      icon: TrendingDown
    };
  } else if (sellSignals.length >= 2 && avgSellStrength > 40) {
    overallDecision = {
      action: 'SELL',
      confidence: avgSellStrength,
      color: 'text-red-500',
      icon: TrendingDown
    };
  }

  const IconComponent = overallDecision.icon;

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Trading Decision Analysis</h2>
          <p className="text-muted-foreground text-sm">Scientific-based technical indicators for {cryptoSymbol}</p>
        </div>
      </div>

      {/* Overall Decision */}
      <div className="mb-6 p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconComponent className={`w-6 h-6 ${overallDecision.color}`} />
            <div>
              <h3 className={`text-lg font-bold ${overallDecision.color}`}>
                {overallDecision.action}
              </h3>
              <p className="text-sm text-muted-foreground">
                Confidence: {overallDecision.confidence.toFixed(0)}%
              </p>
            </div>
          </div>
          <Badge variant={overallDecision.action.includes('BUY') ? 'default' : overallDecision.action.includes('SELL') ? 'destructive' : 'secondary'}>
            {buySignals.length} Buy / {sellSignals.length} Sell / {signals.length - buySignals.length - sellSignals.length} Neutral
          </Badge>
        </div>
      </div>

      {/* Technical Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* RSI */}
        <div className="p-4 rounded-lg bg-background border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">RSI (14)</h4>
            <Badge variant={rsiSignal.signal === 'BUY' ? 'default' : rsiSignal.signal === 'SELL' ? 'destructive' : 'secondary'}>
              {rsiSignal.signal}
            </Badge>
          </div>
          <p className={`text-2xl font-bold ${rsiSignal.color}`}>{rsi.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {rsi < 30 ? 'Oversold - Consider buying' : rsi > 70 ? 'Overbought - Consider selling' : 'Neutral zone'}
          </p>
        </div>

        {/* MACD */}
        <div className="p-4 rounded-lg bg-background border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">MACD</h4>
            <Badge variant={macdSignal.signal === 'BUY' ? 'default' : macdSignal.signal === 'SELL' ? 'destructive' : 'secondary'}>
              {macdSignal.signal}
            </Badge>
          </div>
          <p className={`text-2xl font-bold ${macdSignal.color}`}>{macd.histogram.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {macd.histogram > 0 ? 'Bullish momentum' : macd.histogram < 0 ? 'Bearish momentum' : 'No clear trend'}
          </p>
        </div>

        {/* Bollinger Bands */}
        <div className="p-4 rounded-lg bg-background border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Bollinger Bands</h4>
            <Badge variant={bbSignal.signal === 'BUY' ? 'default' : bbSignal.signal === 'SELL' ? 'destructive' : 'secondary'}>
              {bbSignal.signal}
            </Badge>
          </div>
          <p className={`text-2xl font-bold ${bbSignal.color}`}>
            {(() => {
              if (bb.upper === bb.lower || bb.upper === 0 || bb.lower === 0) return 'N/A';
              const position = ((currentPrice - bb.lower) / (bb.upper - bb.lower) * 100);
              return Math.max(0, Math.min(100, position)).toFixed(0) + '%';
            })()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Position within bands (0% = lower, 100% = upper)
          </p>
        </div>

        {/* Williams %R */}
        <div className="p-4 rounded-lg bg-background border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Williams %R</h4>
            <Badge variant={williamsSignal.signal === 'BUY' ? 'default' : williamsSignal.signal === 'SELL' ? 'destructive' : 'secondary'}>
              {williamsSignal.signal}
            </Badge>
          </div>
          <p className={`text-2xl font-bold ${williamsSignal.color}`}>{williamsR.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {williamsR < -80 ? 'Oversold territory' : williamsR > -20 ? 'Overbought territory' : 'Normal range'}
          </p>
        </div>

        {/* CCI */}
        <div className="p-4 rounded-lg bg-background border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">CCI (20)</h4>
            <Badge variant={cciSignal.signal === 'BUY' ? 'default' : cciSignal.signal === 'SELL' ? 'destructive' : 'secondary'}>
              {cciSignal.signal}
            </Badge>
          </div>
          <p className={`text-2xl font-bold ${cciSignal.color}`}>{cci.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {cci < -100 ? 'Oversold condition' : cci > 100 ? 'Overbought condition' : 'Normal range'}
          </p>
        </div>

        {/* Volume Analysis */}
        <div className="p-4 rounded-lg bg-background border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Volume Trend</h4>
            <Badge variant="outline">
              {(() => {
                const currentVol = data[data.length - 1]?.volume || 0;
                const prevVol = data[data.length - 2]?.volume || 0;
                if (currentVol === 0 && prevVol === 0) return 'NO DATA';
                return currentVol > prevVol ? 'INCREASING' : 'DECREASING';
              })()}
            </Badge>
          </div>
          <p className="text-2xl font-bold text-blue-500">
            {(() => {
              const vol = data[data.length - 1]?.volume || 0;
              if (vol === 0) return 'N/A';
              if (vol >= 1000000) return (vol / 1000000).toFixed(1) + 'M';
              if (vol >= 1000) return (vol / 1000).toFixed(1) + 'K';
              return vol.toFixed(0);
            })()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Current volume vs previous period
          </p>
        </div>
      </div>

      {/* Risk Warning */}
      <div className="mt-6 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          <strong className="text-yellow-600">Risk Warning:</strong> This analysis is based on technical indicators and historical data. 
          Cryptocurrency trading involves substantial risk. Always conduct your own research and consider your risk tolerance before making trading decisions.
        </div>
      </div>
    </Card>
  );
};
