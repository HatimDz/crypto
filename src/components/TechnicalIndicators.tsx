import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";

interface PriceData {
  price: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TechnicalIndicatorsProps {
  data: PriceData[];
}

// Calculate Simple Moving Average
const calculateSMA = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
  return sum / period;
};

// Calculate RSI
const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

// Calculate MACD
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

// Calculate Exponential Moving Average
const calculateEMA = (prices: number[], period: number): number => {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
};

// Calculate Bollinger Bands
const calculateBollingerBands = (prices: number[], period: number = 20): { upper: number; middle: number; lower: number } => {
  if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
  
  const sma = calculateSMA(prices, period);
  const recentPrices = prices.slice(-period);
  
  const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: sma + (stdDev * 2),
    middle: sma,
    lower: sma - (stdDev * 2),
  };
};

export const TechnicalIndicators = ({ data }: TechnicalIndicatorsProps) => {
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Technical Indicators</h3>
        <p className="text-muted-foreground">Loading indicators...</p>
      </Card>
    );
  }

  const prices = data.map(d => d.close);
  const currentPrice = prices[prices.length - 1];
  
  // Calculate indicators
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const rsi = calculateRSI(prices, 14);
  const macd = calculateMACD(prices);
  const bb = calculateBollingerBands(prices, 20);
  
  // Determine signals
  const getSignal = (condition: boolean, neutralCondition?: boolean) => {
    if (neutralCondition) return "NEUTRAL";
    return condition ? "BUY" : "SELL";
  };
  
  const smaSignal = getSignal(currentPrice > sma20 && sma20 > sma50);
  const rsiSignal = getSignal(rsi < 30, rsi >= 30 && rsi <= 70);
  const macdSignal = getSignal(macd.macd > macd.signal);
  const bbSignal = getSignal(currentPrice < bb.lower, currentPrice >= bb.lower && currentPrice <= bb.upper);
  
  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "BUY": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "SELL": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Technical Indicators</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Moving Averages */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-foreground">Moving Averages</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">SMA 20:</span>
              <span className="text-foreground">${sma20.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SMA 50:</span>
              <span className="text-foreground">${sma50.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Signal:</span>
              <Badge className={getSignalColor(smaSignal)}>{smaSignal}</Badge>
            </div>
          </div>
        </div>

        {/* RSI */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-foreground">RSI (14)</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Value:</span>
              <span className="text-foreground">{rsi.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={`${rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-green-400' : 'text-yellow-400'}`}>
                {rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Signal:</span>
              <Badge className={getSignalColor(rsiSignal)}>{rsiSignal}</Badge>
            </div>
          </div>
        </div>

        {/* MACD */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-foreground">MACD</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">MACD:</span>
              <span className="text-foreground">{macd.macd.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Signal:</span>
              <span className="text-foreground">{macd.signal.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Trend:</span>
              <Badge className={getSignalColor(macdSignal)}>{macdSignal}</Badge>
            </div>
          </div>
        </div>

        {/* Bollinger Bands */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-foreground">Bollinger Bands</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Upper:</span>
              <span className="text-foreground">${bb.upper.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lower:</span>
              <span className="text-foreground">${bb.lower.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Signal:</span>
              <Badge className={getSignalColor(bbSignal)}>{bbSignal}</Badge>
            </div>
          </div>
        </div>
      </div>
      
      {/* Overall Signal */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="font-medium text-foreground">Overall Sentiment:</span>
          <Badge className={`text-lg px-4 py-2 ${
            [smaSignal, rsiSignal, macdSignal, bbSignal].filter(s => s === "BUY").length >= 2 
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : [smaSignal, rsiSignal, macdSignal, bbSignal].filter(s => s === "SELL").length >= 2
              ? "bg-red-500/20 text-red-400 border-red-500/30"
              : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
          }`}>
            {[smaSignal, rsiSignal, macdSignal, bbSignal].filter(s => s === "BUY").length >= 2 
              ? "BULLISH" 
              : [smaSignal, rsiSignal, macdSignal, bbSignal].filter(s => s === "SELL").length >= 2
              ? "BEARISH"
              : "NEUTRAL"}
          </Badge>
        </div>
      </div>
    </Card>
  );
};