import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Settings,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import WeightConfigManager, { WeightConfiguration, DEFAULT_WEIGHTS } from '@/utils/weightConfig';
import CryptoApiService, { CurrentPriceData } from '@/services/cryptoApi';

// Import the TechnicalAnalysis class from HistoricalBacktester
import { TechnicalAnalysis, HistoricalPriceData, IndicatorSettings } from './HistoricalBacktester';

interface TradingSignalMetadata {
  atr: number;
  volatility?: number;
  riskRewardRatio: number;
  accountRiskPercent: number;
  timestamp?: string;
  [key: string]: unknown;
}

// Import IndicatorSnapshot type from TechnicalAnalysis
import { IndicatorSnapshot } from './HistoricalBacktester';

// Extend the IndicatorSnapshot interface to include trend
interface ExtendedIndicatorSnapshot extends Omit<IndicatorSnapshot, 'volume'> {
  // Add any additional indicator properties here
  volume: { current: number; average: number; ratio: number };
  adx?: number;
  stochasticRsi?: number;
  williamsR?: number;
  cci?: number;
  obv?: number;
  atr?: number; // Average True Range
  movingAverages?: {
    ma20?: number;
    ma50?: number;
    ma200?: number;
  };
  equilibriumLevels?: {
    support: number;
    resistance: number;
    equilibrium: number;
  };
  volatility?: number;
  trend?: {
    direction: 'up' | 'down' | 'sideways';
    strength: number;
  };
}

interface TradingSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  positionSize: number;
  reasoning: string[];
  indicatorValues: ExtendedIndicatorSnapshot;
  timestamp: string;
  metadata: TradingSignalMetadata;
}

interface RecommendationSetup {
  symbol: string;
  buySetup: {
    signal: TradingSignal | null;
    conditions: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  sellSetup: {
    signal: TradingSignal | null;
    conditions: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  lastUpdated: string;
}

const TradingRecommendations: React.FC = () => {
  const [recommendations, setRecommendations] = useState<RecommendationSetup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTCUSDT', 'ETHUSDT', 'BNBUSDT']);
  const [refreshInterval, setRefreshInterval] = useState<number>(300); // 5 minutes
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [weightConfig, setWeightConfig] = useState<WeightConfiguration | null>(null);
  const [apiStatus, setApiStatus] = useState<{ coinGecko: boolean; binance: boolean } | null>(null);
  const [currentPrices, setCurrentPrices] = useState<CurrentPriceData[]>([]);

  // Available symbols (expanded with ID and RAD for more insights)
  const availableSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT', 'DOTUSDT', 'LINKUSDT', 'IDUSDT', 'RADUSDT'];

  // Enhanced indicator settings (all enabled for comprehensive analysis)
  const defaultIndicators: IndicatorSettings = {
    rsi: true,
    macd: true,
    bollingerBands: true,
    movingAverages: true,
    stochasticRsi: true,
    williamsR: true,
    cci: true,
    adx: true,
    obv: true,
    volumeAnalysis: true,
    btcDominance: true,
    equilibriumAnalysis: true,
    equilibrium30: true,
    equilibrium60: true,
    equilibrium90: true
  };

  // Get real historical data from API
  const getHistoricalData = async (symbol: string, days: number = 90): Promise<HistoricalPriceData[]> => {
    try {
      const apiService = CryptoApiService.getInstance();
      const data = await apiService.getHistoricalData(symbol, days);
      return data;
    } catch (error) {
      console.error(`Failed to fetch historical data for ${symbol}:`, error);
      throw new Error(`Unable to fetch real market data for ${symbol}. Please check your internet connection.`);
    }
  };

  // Calculate Average True Range (ATR) for dynamic stop loss and take profit
  const calculateATR = (data: HistoricalPriceData[], period: number = 14): number => {
    if (data.length < period + 1) return 0;
    
    let trSum = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1] || current;
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      trSum += Math.max(tr1, tr2, tr3);
    }
    
    return trSum / period;
  };

  // Calculate volatility-adjusted position size
  const calculatePositionSize = (
    accountSize: number, 
    riskPerTrade: number, 
    entryPrice: number, 
    stopLoss: number
  ): number => {
    const riskAmount = accountSize * (riskPerTrade / 100);
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    return riskPerUnit > 0 ? Math.floor(riskAmount / riskPerUnit) : 0;
  };

  /**
   * Calculate optimal buy price based on technical levels with improved support detection
   * and minimum distance from current price
   */
  const calculateOptimalBuyPrice = (
    data: HistoricalPriceData[], 
    indicatorValues: ExtendedIndicatorSnapshot & {
      movingAverages?: {
        ma20?: number;
        ma50?: number;
        ma200?: number;
      };
    }
  ): number => {
    const currentPrice = data[data.length - 1].close;
    const prices = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    
    // 1. Find swing lows with improved detection
    const swingLows: {price: number, strength: number}[] = [];
    const lookback = Math.min(30, Math.floor(prices.length / 2));
    
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] < prices[i-1] && prices[i] < prices[i-2] && 
          prices[i] < prices[i+1] && prices[i] < prices[i+2]) {
        // Calculate strength based on how many candles the low held
        let strength = 1;
        for (let j = i + 1; j < Math.min(i + 10, prices.length); j++) {
          if (prices[j] > prices[i]) strength++;
          else break;
        }
        swingLows.push({price: prices[i], strength});
      }
    }
    
    // 2. Get moving averages with more weight to longer timeframes
    const ma20 = indicatorValues.movingAverages?.ma20 || 0;
    const ma50 = indicatorValues.movingAverages?.ma50 || 0;
    const ma200 = indicatorValues.movingAverages?.ma200 || 0;
    
    // 3. Calculate Fibonacci levels with more context
    let fibLevels: {price: number, level: string}[] = [];
    if (swingLows.length >= 2 && highs.length >= 20) {
      const recentLows = swingLows.slice(-3).map(s => s.price);
      const recentHighs = highs.slice(-20).sort((a, b) => b - a).slice(0, 3);
      
      const majorLow = Math.min(...recentLows);
      const majorHigh = Math.max(...recentHighs);
      const diff = majorHigh - majorLow;
      
      if (diff > 0) {  // Only if we have a valid range
        fibLevels = [
          {price: majorHigh - diff * 0.236, level: '23.6%'},
          {price: majorHigh - diff * 0.382, level: '38.2%'},
          {price: majorHigh - diff * 0.5, level: '50.0%'},
          {price: majorHigh - diff * 0.618, level: '61.8%'},
          {price: majorHigh - diff * 0.786, level: '78.6%'}
        ];
      }
    }
    
    // 4. Find support levels with weights
    const supportLevels: {price: number, weight: number, type: string}[] = [];
    
    // Add swing lows with weights based on strength
    swingLows
      .filter(sl => sl.price < currentPrice * 0.98)  // Only consider levels at least 2% below current
      .forEach(sl => {
        supportLevels.push({
          price: sl.price,
          weight: 2 + (sl.strength * 0.5),  // Stronger weight for more significant swing lows
          type: 'Swing Low'
        });
      });
    
    // Add moving averages with different weights
    if (ma20 > 0 && ma20 < currentPrice * 0.98) {
      supportLevels.push({price: ma20, weight: 1.5, type: 'MA20'});
    }
    if (ma50 > 0 && ma50 < currentPrice * 0.95) {
      supportLevels.push({price: ma50, weight: 2.0, type: 'MA50'});
    }
    if (ma200 > 0 && ma200 < currentPrice * 0.90) {
      supportLevels.push({price: ma200, weight: 2.5, type: 'MA200'});
    }
    
    // Add Fibonacci levels with weights
    fibLevels
      .filter(fib => fib.price < currentPrice * 0.98)
      .forEach(fib => {
        const weight = fib.level === '50.0%' || fib.level === '61.8%' ? 2.5 : 1.5;
        supportLevels.push({
          price: fib.price,
          weight,
          type: `Fib ${fib.level}`
        });
      });
    
    // 5. Calculate weighted support zones
    const supportZones: {[key: number]: {totalWeight: number, types: string[]}} = {};
    
    // Group nearby support levels (within 1% of each other)
    supportLevels.forEach(sl => {
      const roundedPrice = Math.round(sl.price * 100) / 100;  // Round to 2 decimal places
      const existingZone = Object.keys(supportZones).find(
        p => Math.abs(Number(p) - roundedPrice) <= roundedPrice * 0.01
      );
      
      if (existingZone) {
        // Add to existing zone
        supportZones[existingZone].totalWeight += sl.weight;
        supportZones[existingZone].types.push(sl.type);
      } else {
        // Create new zone
        supportZones[roundedPrice] = {
          totalWeight: sl.weight,
          types: [sl.type]
        };
      }
    });
    
    // 6. Find the strongest support zone
    let bestPrice = currentPrice * 0.93;  // Default to 7% below current
    let maxWeight = 0;
    
    Object.entries(supportZones).forEach(([priceStr, zone]) => {
      const price = Number(priceStr);
      // Prefer stronger zones or zones that are further from current price
      const distanceFactor = 1 + ((currentPrice - price) / currentPrice) * 5;
      const adjustedWeight = zone.totalWeight * distanceFactor;
      
      if (adjustedWeight > maxWeight) {
        maxWeight = adjustedWeight;
        bestPrice = price;
      }
    });
    
    // 7. Ensure minimum distance from current price
    const minDistancePercent = 0.05;  // At least 5% below current
    const minDistancePrice = currentPrice * (1 - minDistancePercent);
    
    // If best price is too close to current, use the minimum distance
    if (bestPrice > minDistancePrice) {
      // Find the next best support below minDistancePrice
      const nextBest = Object.keys(supportZones)
        .map(Number)
        .filter(p => p <= minDistancePrice)
        .sort((a, b) => b - a)[0];  // Get highest price below min distance
      
      bestPrice = nextBest || minDistancePrice;
    }
    
    // 8. Don't go too far below current price
    const maxDistancePercent = 0.15;  // At most 15% below current
    const maxDistancePrice = currentPrice * (1 - maxDistancePercent);
    bestPrice = Math.max(bestPrice, maxDistancePrice);
    
    // 9. Round to 2 decimal places
    return Math.round(bestPrice * 100) / 100;
  };

  // Count confirmations for the trading signal with weighted scoring
  const countConfirmations = (
    signal: TradingSignal, 
    indicatorValues: ExtendedIndicatorSnapshot,
    weights: WeightConfiguration['weights']
  ): [number, string[], number] => {
    let confirmations = 0;
    const confirmationReasons: string[] = [];
    const price = signal.currentPrice;
    const ma = indicatorValues.movingAverages || {};
    const volumeRatio = indicatorValues.volume?.ratio || 1;
    
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

    // 1. Trend Confirmation (highest weight)
    if (ma.ma20 && ma.ma50 && ma.ma200) {
      // Bullish alignment
      if (price > ma.ma20 && ma.ma20 > ma.ma50 && ma.ma50 > ma.ma200) {
        confirmations += weights.maAlignment;
        confirmationReasons.push(`Bullish MA alignment (P>20>50>200)`);
      }
      // Bearish alignment
      else if (price < ma.ma20 && ma.ma20 < ma.ma50 && ma.ma50 < ma.ma200) {
        confirmations -= weights.maAlignment;
        confirmationReasons.push(`Bearish MA alignment (P<20<50<200)`);
      }
    }
    
    // 2. ADX Trend Strength
    if (indicatorValues.adx) {
      if (indicatorValues.adx > 25) {
        confirmations += weights.adxStrength;
        confirmationReasons.push(`Strong trend (ADX ${indicatorValues.adx.toFixed(1)})`);
      } else if (indicatorValues.adx < 15) {
        confirmations -= weights.adxStrength * 0.5;
        confirmationReasons.push(`Weak trend (ADX ${indicatorValues.adx.toFixed(1)})`);
      }
    }
    
    // 3. RSI Confirmation
    if (indicatorValues.rsi) {
      if (indicatorValues.rsi < 30) {
        confirmations += weights.rsi;
        confirmationReasons.push(`RSI oversold (${indicatorValues.rsi.toFixed(1)})`);
      } else if (indicatorValues.rsi > 70) {
        confirmations -= weights.rsi;
        confirmationReasons.push(`RSI overbought (${indicatorValues.rsi.toFixed(1)})`);
      }
    }
    
    // 4. Stochastic RSI Confirmation
    if (indicatorValues.stochasticRsi) {
      if (indicatorValues.stochasticRsi < 20) {
        confirmations += weights.stochasticRsi;
        confirmationReasons.push(`Stoch RSI oversold (${indicatorValues.stochasticRsi.toFixed(1)})`);
      } else if (indicatorValues.stochasticRsi > 80) {
        confirmations -= weights.stochasticRsi;
        confirmationReasons.push(`Stoch RSI overbought (${indicatorValues.stochasticRsi.toFixed(1)})`);
      }
    }
    
    // 5. MACD Confirmation
    if (indicatorValues.macd) {
      const { histogram, macd, signal: macdSignal } = indicatorValues.macd;
      // Bullish: MACD above signal line and histogram increasing
      if (macd > macdSignal && histogram > 0) {
        confirmations += weights.macd;
        confirmationReasons.push(`MACD bullish (${histogram > 0 ? '+' : ''}${histogram.toFixed(4)})`);
      }
      // Bearish: MACD below signal line and histogram decreasing
      else if (macd < macdSignal && histogram < 0) {
        confirmations -= weights.macd;
        confirmationReasons.push(`MACD bearish (${histogram.toFixed(4)})`);
      }
    }
    
    // 6. Volume Confirmation
    if (volumeRatio > 1.5) {
      confirmations += weights.volume;
      confirmationReasons.push(`Volume ${(volumeRatio * 100).toFixed(0)}% of average`);
    } else if (volumeRatio < 0.7) {
      confirmations -= weights.volume * 0.5;
      confirmationReasons.push(`Low volume (${(volumeRatio * 100).toFixed(0)}% of average)`);
    }
    
    // 7. Support/Resistance Levels
    if (indicatorValues.equilibriumLevels) {
      const { support, resistance } = indicatorValues.equilibriumLevels;
      // Near support with bullish confirmation
      if (price < support * 1.02 && price > support * 0.98) {
        confirmations += weights.supportResistance;
        confirmationReasons.push(`Near support at ${support.toFixed(2)}`);
      }
      // Near resistance with bearish confirmation
      else if (price > resistance * 0.98 && price < resistance * 1.02) {
        confirmations -= weights.supportResistance;
        confirmationReasons.push(`Near resistance at ${resistance.toFixed(2)}`);
      }
    }
    
    // 8. Volatility Adjustment
    const atrVolatility = (indicatorValues.atr || 0) / price * 100;
    if (atrVolatility > 5) {
      confirmations += weights.volatility;
      confirmationReasons.push(`High volatility (${atrVolatility.toFixed(2)}% ATR)`);
    }
    
    // 9. Market Equilibrium
    if (indicatorValues.equilibriumLevels) {
      const { equilibrium } = indicatorValues.equilibriumLevels;
      const distanceToEq = Math.abs((price - equilibrium) / equilibrium * 100);
      if (distanceToEq < 1) {
        confirmations += weights.equilibrium;
        confirmationReasons.push(`Near equilibrium (${distanceToEq.toFixed(2)}% from ${equilibrium.toFixed(2)})`);
      }
    }
    
    return [Math.round(confirmations * 10) / 10, confirmationReasons, totalWeight];
  };

  // Generate trading signal for a symbol with enhanced risk management
  const generateTradingSignal = async (symbol: string, weights: WeightConfiguration['weights']): Promise<TradingSignal> => {
    const data = await getHistoricalData(symbol, 90);
    if (data.length < 30) {
      throw new Error(`Insufficient historical data for ${symbol}`);
    }
    const currentIndex = data.length - 1;
    const currentPrice = data[currentIndex].close;
    const signal = TechnicalAnalysis.generateSignal(data, currentIndex, defaultIndicators);
    
    // Ensure signal has required properties with proper typing
    const indicatorValues: ExtendedIndicatorSnapshot = {
      ...signal.indicatorValues,
      rsi: signal.indicatorValues?.rsi ?? 50,
      macd: signal.indicatorValues?.macd ?? { histogram: 0, signal: 0, macd: 0 },
      bollingerBands: signal.indicatorValues?.bollingerBands ?? { upper: 0, middle: 0, lower: 0 },
      volume: signal.indicatorValues?.volume && typeof signal.indicatorValues.volume === 'object' 
        ? signal.indicatorValues.volume 
        : { current: 0, average: 0, ratio: 1 },
      adx: signal.indicatorValues?.adx ?? 0,
      stochasticRsi: signal.indicatorValues?.stochasticRsi ?? 0,
      williamsR: signal.indicatorValues?.williamsR ?? 0,
      cci: signal.indicatorValues?.cci ?? 0,
      obv: signal.indicatorValues?.obv ?? 0,
      movingAverages: signal.indicatorValues?.movingAverages ?? { ma20: 0, ma50: 0, ma200: 0 },
      equilibriumLevels: signal.indicatorValues?.equilibriumLevels ?? { support: 0, resistance: 0, equilibrium: 0 },
      volatility: signal.indicatorValues?.volatility ?? 0,
      trend: signal.indicatorValues?.trend ?? { direction: 'sideways', strength: 0 }
    } as ExtendedIndicatorSnapshot;

    // Count confirmations for the signal
    const [confirmations, confirmationReasons, totalWeight] = countConfirmations(signal, indicatorValues, weights);
    signal.reasoning.push(`Signal confirmations (${confirmations.toFixed(1)}/${totalWeight.toFixed(1)}): ${confirmationReasons.join(', ')}`);

    // Calculate optimal buy price
    const optimalBuyPrice = calculateOptimalBuyPrice(data, indicatorValues);
    const useOptimalPrice = signal.action === 'BUY' && optimalBuyPrice < currentPrice;
    const entryPrice = useOptimalPrice ? optimalBuyPrice : currentPrice;

    // Calculate ATR for dynamic stop loss and take profit
    const atr = calculateATR(data);
    const volatility = (atr / currentPrice) * 100;
    
    // Determine signal strength based on confirmations
    let signalStrength: 'STRONG' | 'MODERATE' | 'WEAK';
    let riskPerTrade: number;
    let atrMultiplier: number;
    let targetMultiplier: number;
    
    const scoreRatio = totalWeight > 0 ? confirmations / totalWeight : 0;

    if (scoreRatio >= 0.4) { // e.g. 40% of max score
      signalStrength = 'STRONG';
      riskPerTrade = 1.5; // 1.5% risk per trade for strong signals
      atrMultiplier = 0.8; // Tighter stop loss
      targetMultiplier = 2.0; // Higher target (2x ATR)
    } else if (scoreRatio >= 0.2) { // e.g. 20% of max score
      signalStrength = 'MODERATE';
      riskPerTrade = 1.0; // 1% risk per trade for moderate signals
      atrMultiplier = 1.1; // Standard stop loss
      targetMultiplier = 1.5; // Standard target (1.5x ATR)
    } else {
      signalStrength = 'WEAK';
      riskPerTrade = 0.5; // 0.5% risk per trade for weak signals
      atrMultiplier = 1.3; // Wider stop loss
      targetMultiplier = 1.2; // Lower target (1.2x ATR)
    }
    
    // Calculate dynamic stop loss and take profit based on signal strength
    let targetPrice: number | undefined;
    let stopLoss: number | undefined;
    let positionSize: number | undefined;
    
    if (signal.action === 'BUY') {
      // For buy signals, stop loss is below entry price
      targetPrice = entryPrice + (atr * atrMultiplier * targetMultiplier);
      stopLoss = entryPrice - (atr * atrMultiplier);

      // Adjust stop loss to be below support levels, making it wider if necessary
      if (indicatorValues.bollingerBands) {
        const bbLower = indicatorValues.bollingerBands.lower;
        if (bbLower < entryPrice) {
          stopLoss = Math.min(stopLoss, bbLower * 0.995);
        }
      }
      
      const recentLows = data.slice(-20).map(d => d.low);
      const recentLow = Math.min(...recentLows);
      if (recentLow < entryPrice) {
        stopLoss = Math.min(stopLoss, recentLow * 0.99);
      }
      
      // Ensure stop loss is not positive or nonsensical
      if (stopLoss >= entryPrice) {
        stopLoss = entryPrice * (1 - 0.02); // Default to 2% stop loss if calculation is wrong
        signal.reasoning.push(`Warning: Invalid stop-loss calculated. Defaulting to 2% stop.`);
      }

      // Calculate position size based on risk parameters
      const accountSize = 10000; // Example account size
      positionSize = calculatePositionSize(accountSize, riskPerTrade, entryPrice, stopLoss);
      
      // Add signal strength info to reasoning
      signal.reasoning.push(`Signal Strength: ${signalStrength} (Score: ${confirmations.toFixed(1)}/${totalWeight.toFixed(1)})`);
      signal.reasoning.push(`Risk: ${riskPerTrade}% per trade, Stop: ${stopLoss.toFixed(2)} (${((entryPrice - stopLoss) / entryPrice * 100).toFixed(2)}% below)`);
      signal.reasoning.push(`Target: ${targetPrice.toFixed(2)} (${((targetPrice - entryPrice) / entryPrice * 100).toFixed(2)}% above)`);
      
    } else if (signal.action === 'SELL') {
      // For sell signals, stop loss is above entry price
      targetPrice = entryPrice - (atr * atrMultiplier * targetMultiplier);
      stopLoss = entryPrice + (atr * atrMultiplier);

      // Adjust stop loss to be above resistance levels, making it wider if necessary
      if (indicatorValues.bollingerBands) {
        const bbUpper = indicatorValues.bollingerBands.upper;
        if (bbUpper > entryPrice) {
          stopLoss = Math.max(stopLoss, bbUpper * 1.005);
        }
      }
      
      const recentHighs = data.slice(-20).map(d => d.high);
      const recentHigh = Math.max(...recentHighs);
      if (recentHigh > entryPrice) {
        stopLoss = Math.max(stopLoss, recentHigh * 1.01);
      }

      // Ensure stop loss is logical
      if (stopLoss <= entryPrice) {
        stopLoss = entryPrice * (1 + 0.02); // Default to 2% stop loss
        signal.reasoning.push(`Warning: Invalid stop-loss calculated. Defaulting to 2% stop.`);
      }
      
      // Calculate position size based on risk parameters
      const accountSize = 10000; // Example account size
      positionSize = calculatePositionSize(accountSize, riskPerTrade, entryPrice, stopLoss);
      
      // Add signal strength info to reasoning
      signal.reasoning.push(`Signal Strength: ${signalStrength} (Score: ${confirmations.toFixed(1)}/${totalWeight.toFixed(1)})`);
      signal.reasoning.push(`Risk: ${riskPerTrade}% per trade, Stop: ${stopLoss.toFixed(2)} (${((stopLoss - entryPrice) / entryPrice * 100).toFixed(2)}% above)`);
      signal.reasoning.push(`Target: ${targetPrice.toFixed(2)} (${((entryPrice - targetPrice) / entryPrice * 100).toFixed(2)}% below)`);
    }

    // Add volatility assessment to reasoning
    const atrVolatility = (atr / entryPrice) * 100;
    const volatilityAssessment = atrVolatility > 5 ? 'High' : atrVolatility > 2 ? 'Medium' : 'Low';
    
    signal.reasoning.push(`Volatility: ${volatilityAssessment} (${atrVolatility.toFixed(2)}% ATR)`);
    
    // Add entry price info
    if (useOptimalPrice) {
      const discount = ((currentPrice - optimalBuyPrice) / currentPrice * 100).toFixed(2);
      signal.reasoning.push(`🎯 Optimal buy price: ${optimalBuyPrice.toFixed(2)} (${discount}% below current)`);
    }
    
    // Add position sizing info to reasoning
    if (positionSize !== undefined) {
      signal.reasoning.push(`Position size: ${positionSize?.toFixed(8) || 'N/A'} units (${riskPerTrade}% risk)`);
    }

    // Calculate risk-reward ratio
    const riskRewardRatio = targetPrice && stopLoss 
      ? signal.action === 'BUY'
        ? (targetPrice - entryPrice) / (entryPrice - stopLoss)
        : (entryPrice - targetPrice) / (stopLoss - entryPrice)
      : 0;

    const metadata: TradingSignalMetadata = {
      atr,
      volatility: atrVolatility,
      riskRewardRatio,
      accountRiskPercent: riskPerTrade,
      signalStrength,
      confirmations,
      timestamp: new Date().toISOString()
    };
    
    // Add risk-reward info to reasoning
    signal.reasoning.push(`Risk-Reward Ratio: ${riskRewardRatio.toFixed(2)}:1`);
    
    return { 
      symbol, 
      action: signal.action, 
      confidence: signal.confidence, 
      currentPrice: entryPrice, // Use optimal price for entry when available
      targetPrice: targetPrice || 0, 
      stopLoss: stopLoss || 0, 
      positionSize: positionSize || 0, 
      reasoning: signal.reasoning, 
      indicatorValues,
      timestamp: new Date().toISOString(), 
      metadata
    };
  };

  // Generate buy and sell setups for a symbol with enhanced risk assessment
  const generateRecommendationSetup = async (symbol: string, weights: WeightConfiguration['weights']): Promise<RecommendationSetup> => {
    const signal = await generateTradingSignal(symbol, weights);
    
    // Enhanced risk level assessment considering multiple factors
    const getRiskLevel = (sig: TradingSignal): 'LOW' | 'MEDIUM' | 'HIGH' => {
    const { confidence, indicatorValues, metadata } = sig;
    let riskScore = 0;
    
    // Base risk on confidence (lower confidence = higher risk)
    if (confidence >= 80) riskScore += 20;
    else if (confidence >= 60) riskScore += 40;
    else riskScore += 70;
    
    // Adjust based on volatility
    if (metadata?.volatility) {
      if (metadata.volatility > 5) riskScore += 30; // Higher risk in high volatility
      else if (metadata.volatility < 1.5) riskScore += 10; // Lower risk in low volatility
    }
    
    // Adjust based on trend alignment
    if (indicatorValues?.trend) {
      const trendStrength = indicatorValues.trend.strength || 0;
      const isUptrend = indicatorValues.trend.direction === 'up';
      
      if ((signal.action === 'BUY' && isUptrend) || 
          (signal.action === 'SELL' && !isUptrend)) {
        riskScore -= 20 * (trendStrength / 100); // Reduce risk in trend-following trades
      } else {
        riskScore += 20 * (trendStrength / 100); // Increase risk in counter-trend trades
      }
    }
    
    // Adjust based on volume confirmation
    if (indicatorValues?.volume?.ratio) {
      if (indicatorValues.volume.ratio > 2) {
        riskScore -= 15; // Lower risk with strong volume confirmation
      } else if (indicatorValues.volume.ratio < 0.8) {
        riskScore += 15; // Higher risk with weak volume
      }
    }
    
    // Final risk classification
    if (riskScore < 35) return 'LOW';
    if (riskScore < 65) return 'MEDIUM';
    return 'HIGH';
  };
  
  const riskLevel = getRiskLevel(signal);

    // Generate comprehensive conditions with priority and strength indicators
    const generateConditions = (signal: TradingSignal, type: 'BUY' | 'SELL'): string[] => {
      const conditions: string[] = [];
      const indicators = signal.indicatorValues;
      const metadata = signal.metadata || {};
      
      // Add trade summary at the top
      if (type === signal.action) {
        conditions.push(`💡 ${type} Signal (${signal.confidence.toFixed(0)}% confidence)`);
        
        // Add key metrics if available
        if (signal.stopLoss && signal.targetPrice) {
          const stopDistance = Math.abs(signal.currentPrice - signal.stopLoss);
          const targetDistance = Math.abs(signal.targetPrice - signal.currentPrice);
          const rewardRiskRatio = (targetDistance / stopDistance).toFixed(2);
          const stopPct = ((stopDistance / signal.currentPrice) * 100).toFixed(2);
          const targetPct = ((targetDistance / signal.currentPrice) * 100).toFixed(2);
          
          conditions.push(`🎯 Target: ${signal.targetPrice.toFixed(2)} (+${targetPct}%)`);
          conditions.push(`⚠️ Stop Loss: ${signal.stopLoss.toFixed(2)} (-${stopPct}%)`);
          conditions.push(`📊 Reward/Risk: ${rewardRiskRatio}:1`);
        }
        
        if (signal.positionSize) {
          conditions.push(`📦 Position Size: ${signal.positionSize} units (1% account risk)`);
        }
        
        // Add volatility analysis to conditions if available
        const volatility = indicators.volatility as number | undefined;
        if (volatility !== undefined) {
          if (volatility > 10) {
            conditions.push(`High volatility: ${volatility.toFixed(2)}%`);
          } else if (volatility > 5) {
            conditions.push(`Moderate volatility: ${volatility.toFixed(2)}%`);
          } else {
            conditions.push(`Low volatility: ${volatility.toFixed(2)}%`);
          }
        }
        
        conditions.push('---');
      }

      if (type === 'BUY') {
        // RSI Analysis
        if (indicators.rsi) {
          if (indicators.rsi < 30) {
            conditions.push(`🔥 RSI extremely oversold (${indicators.rsi.toFixed(1)}) - Strong buy signal`);
          } else if (indicators.rsi < 40) {
            conditions.push(`📉 RSI oversold (${indicators.rsi.toFixed(1)}) - Buy opportunity`);
          }
        }

        // Equilibrium Analysis (Multiple Timeframes)
        if (indicators.equilibrium) {
          const eq30 = indicators.equilibrium.eq30;
          const eq60 = indicators.equilibrium.eq60;
          const eq90 = indicators.equilibrium.eq90;
          
          if (signal.currentPrice < eq30 && signal.currentPrice < eq60) {
            const discount = ((eq30 - signal.currentPrice) / eq30 * 100);
            conditions.push(`💰 Price ${discount.toFixed(1)}% below equilibrium levels - Value buy`);
          }
          
          if (signal.currentPrice < Math.min(eq30, eq60, eq90)) {
            conditions.push(`🎯 Price below all equilibrium timeframes - Maximum value`);
          }
        }

        // MACD Analysis
        if (indicators.macd) {
          if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
            conditions.push(`📈 MACD bullish crossover with positive momentum`);
          } else if (indicators.macd.histogram > 0) {
            conditions.push(`↗️ MACD showing bullish divergence`);
          }
        }

        // Volume Analysis
        if (indicators.volume) {
          const volume = indicators.volume;
          const volumeRatio = volume.ratio;
          
          if (volumeRatio > 1.5) {
            conditions.push(`High volume (${volumeRatio.toFixed(2)}x average)`);
            conditions.push(`Current volume: ${volume.current.toLocaleString()}`);
          }
        }

        // Trend Strength (ADX)
        if (indicators.adx) {
          if (indicators.adx > 40) {
            conditions.push(`💪 Very strong trend (ADX: ${indicators.adx.toFixed(1)}) - High probability`);
          } else if (indicators.adx > 25) {
            conditions.push(`📊 Strong trend confirmed (ADX: ${indicators.adx.toFixed(1)})`);
          }
        }

        // Stochastic RSI
        if (indicators.stochasticRsi && indicators.stochasticRsi < 20) {
          conditions.push(`⚡ Stochastic RSI oversold (${indicators.stochasticRsi.toFixed(1)}) - Reversal signal`);
        }

        // Williams %R
        if (indicators.williamsR && indicators.williamsR < -80) {
          conditions.push(`🎯 Williams %R extreme oversold - Bounce expected`);
        }

        // Bollinger Bands
        if (indicators.bollingerBands && signal.currentPrice < indicators.bollingerBands.lower) {
          conditions.push(`📉 Price below lower Bollinger Band - Oversold bounce setup`);
        }

        // CCI Analysis
        if (indicators.cci && indicators.cci < -100) {
          conditions.push(`🔄 CCI oversold (${indicators.cci.toFixed(0)}) - Mean reversion play`);
        }

      } else {
        // SELL CONDITIONS
        
        // RSI Analysis
        if (indicators.rsi) {
          if (indicators.rsi > 70) {
            conditions.push(`🔥 RSI extremely overbought (${indicators.rsi.toFixed(1)}) - Strong sell signal`);
          } else if (indicators.rsi > 60) {
            conditions.push(`📈 RSI overbought (${indicators.rsi.toFixed(1)}) - Take profit opportunity`);
          }
        }

        // Equilibrium Analysis
        if (indicators.equilibrium) {
          const eq30 = indicators.equilibrium.eq30;
          const eq60 = indicators.equilibrium.eq60;
          
          if (signal.currentPrice > eq30 && signal.currentPrice > eq60) {
            const premium = ((signal.currentPrice - eq30) / eq30 * 100);
            conditions.push(`💸 Price ${premium.toFixed(1)}% above equilibrium - Premium sell`);
          }
        }

        // MACD Analysis
        if (indicators.macd) {
          if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
            conditions.push(`📉 MACD bearish crossover with negative momentum`);
          }
        }

        // Volume Analysis
        if (indicators.volume && indicators.volume.ratio > 1.8) {
          conditions.push(`📊 High volume distribution (${indicators.volume.ratio.toFixed(1)}x) - Selling pressure`);
        }

        // Bollinger Bands
        if (indicators.bollingerBands && signal.currentPrice > indicators.bollingerBands.upper) {
          conditions.push(`📈 Price above upper Bollinger Band - Overbought extension`);
        }

        // Stochastic RSI
        if (indicators.stochasticRsi && indicators.stochasticRsi > 80) {
          conditions.push(`⚡ Stochastic RSI overbought (${indicators.stochasticRsi.toFixed(1)}) - Reversal risk`);
        }

        // Williams %R
        if (indicators.williamsR && indicators.williamsR > -20) {
          conditions.push(`🎯 Williams %R extreme overbought - Correction expected`);
        }

        // CCI Analysis
        if (indicators.cci && indicators.cci > 100) {
          conditions.push(`🔄 CCI overbought (${indicators.cci.toFixed(0)}) - Mean reversion risk`);
        }
      }

      // Market Structure Analysis
      if (indicators.sma20 && indicators.sma50) {
        if (type === 'BUY' && signal.currentPrice > indicators.sma20 && indicators.sma20 > indicators.sma50) {
          conditions.push(`📊 Price above moving averages - Uptrend intact`);
        } else if (type === 'SELL' && signal.currentPrice < indicators.sma20 && indicators.sma20 < indicators.sma50) {
          conditions.push(`📊 Price below moving averages - Downtrend confirmed`);
        }
      }

      // BTC Dominance Impact
      if (indicators.btcDominance && symbol !== 'BTCUSDT') {
        if (type === 'BUY' && indicators.btcDominance.trend === 'FALLING') {
          conditions.push(`🌟 BTC dominance falling - Altcoin season favorable`);
        } else if (type === 'SELL' && indicators.btcDominance.trend === 'RISING') {
          conditions.push(`⚠️ BTC dominance rising - Altcoin weakness expected`);
        }
      }

      return conditions.length > 0 ? conditions : ['📊 Market conditions analysis in progress...'];
    };

    // Create a minimal signal for getRiskLevel when action doesn't match
    const createMinimalSignal = (action: 'BUY' | 'SELL' | 'HOLD'): TradingSignal => ({
      symbol: signal.symbol,
      action,
      confidence: 30, // Default confidence for non-matching signals
      currentPrice: signal.currentPrice,
      targetPrice: 0,
      stopLoss: 0,
      positionSize: 0,
      reasoning: [],
      indicatorValues: signal.indicatorValues,
      timestamp: new Date().toISOString(),
      metadata: {
        atr: 0,
        riskRewardRatio: 1.5,
        accountRiskPercent: 1
      }
    });

    const buySetup = {
      signal: signal.action === 'BUY' ? signal : null,
      conditions: generateConditions(signal, 'BUY'),
      riskLevel: getRiskLevel(signal.action === 'BUY' ? signal : createMinimalSignal('BUY'))
    };

    const sellSetup = {
      signal: signal.action === 'SELL' ? signal : null,
      conditions: generateConditions(signal, 'SELL'),
      riskLevel: getRiskLevel(signal.action === 'SELL' ? signal : createMinimalSignal('SELL'))
    };

    return {
      symbol,
      buySetup,
      sellSetup,
      lastUpdated: new Date().toISOString()
    };
  };

  // Enhanced market insights for specific symbols
  const getSymbolInsights = (symbol: string): string[] => {
    const insights: string[] = [];
    
    switch (symbol) {
      case 'BTCUSDT':
        insights.push('🏆 Bitcoin: Digital gold and market leader');
        insights.push('📊 Institutional adoption driving long-term value');
        insights.push('⚡ Lightning Network improving transaction efficiency');
        break;
        
      case 'ETHUSDT':
        insights.push('🔗 Ethereum: Smart contract platform leader');
        insights.push('🔥 EIP-1559 burn mechanism reducing supply');
        insights.push('🚀 Layer 2 solutions scaling ecosystem');
        break;
        
      case 'BNBUSDT':
        insights.push('🏪 BNB: Binance ecosystem utility token');
        insights.push('💰 Quarterly burns reducing total supply');
        insights.push('🌐 BSC adoption for DeFi applications');
        break;
        
      case 'ADAUSDT':
        insights.push('🔬 Cardano: Research-driven blockchain');
        insights.push('🌱 Proof-of-stake energy efficiency');
        insights.push('📚 Academic approach to development');
        break;
        
      case 'SOLUSDT':
        insights.push('⚡ Solana: High-speed blockchain platform');
        insights.push('🎮 Strong NFT and gaming ecosystem');
        insights.push('🔧 Proof-of-history consensus innovation');
        break;
        
      case 'XRPUSDT':
        insights.push('🏦 XRP: Cross-border payment solution');
        insights.push('⚖️ Regulatory clarity improving adoption');
        insights.push('🌍 Banking partnerships expanding globally');
        break;
        
      case 'DOTUSDT':
        insights.push('🕸️ Polkadot: Multi-chain interoperability');
        insights.push('🔗 Parachain auctions driving ecosystem growth');
        insights.push('🛠️ Substrate framework enabling innovation');
        break;
        
      case 'LINKUSDT':
        insights.push('🔗 Chainlink: Decentralized oracle network');
        insights.push('📡 Real-world data integration for DeFi');
        insights.push('🤝 Partnerships with major enterprises');
        break;
        
      case 'IDUSDT':
        insights.push('🆔 SPACE ID: Web3 domain name service');
        insights.push('🌐 Multi-chain domain infrastructure');
        insights.push('🚀 Growing adoption in Web3 identity');
        insights.push('⚠️ Higher volatility due to smaller market cap');
        insights.push('📈 Emerging sector with growth potential');
        break;
        
      case 'RADUSDT':
        insights.push('🌐 Radicle: Decentralized code collaboration');
        insights.push('💻 Git-based peer-to-peer development');
        insights.push('🔓 Open-source software infrastructure');
        insights.push('⚠️ Micro-cap with extreme volatility');
        insights.push('🎯 Niche market with specialized use case');
        insights.push('📊 Lower liquidity requires careful position sizing');
        break;
        
      default:
        insights.push('📊 Market analysis in progress...');
    }
    
    return insights;
  };

  // Test API connectivity
  const testApiConnectivity = async () => {
    try {
      const apiService = CryptoApiService.getInstance();
      const status = await apiService.testConnectivity();
      setApiStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to test API connectivity:', error);
      setApiStatus({ coinGecko: false, binance: false });
      return { coinGecko: false, binance: false };
    }
  };

  // Fetch current prices for all selected symbols
  const fetchCurrentPrices = async () => {
    try {
      const apiService = CryptoApiService.getInstance();
      const prices = await apiService.getCurrentPrices(selectedSymbols);
      setCurrentPrices(prices);
      return prices;
    } catch (error) {
      console.error('Failed to fetch current prices:', error);
      setError('Failed to fetch real-time price data. Using cached data.');
      return [];
    }
  };

  // Update recommendations for all selected symbols
  const updateRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      // Test API connectivity first
      const connectivity = await testApiConnectivity();
      
      // Fetch current prices in parallel
      const pricesPromise = fetchCurrentPrices();
      
      // Load active weight configuration or use defaults
      const configs = WeightConfigManager.getAllConfigurations();
      const activeConfig = configs.find(c => c.confirmedAt);
      const weights = activeConfig ? activeConfig.weights : DEFAULT_WEIGHTS.weights;
      
      if (activeConfig) {
        console.log(`Using active weight configuration: "${activeConfig.name}"`);
      } else {
        console.log('No active weight configuration found. Using default weights.');
      }

      const newRecommendations: RecommendationSetup[] = [];
      
      for (const symbol of selectedSymbols) {
        const recommendation = await generateRecommendationSetup(symbol, weights);
        newRecommendations.push(recommendation);
      }

      // Wait for prices to be fetched
      await pricesPromise;
      
      setRecommendations(newRecommendations);
      
      // Log API status for transparency
      if (connectivity.coinGecko && connectivity.binance) {
        console.log('✅ Using real-time data from CoinGecko and Binance APIs');
      } else if (connectivity.coinGecko || connectivity.binance) {
        console.log('⚠️ Using partial real-time data - some APIs unavailable');
      } else {
        console.log('❌ APIs unavailable - using fallback data');
        setError('Real-time APIs unavailable. Using fallback data for analysis.');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to generate recommendations');
      } finally {
      setLoading(false);
    }
  };

  // Load active weight configuration
  const loadWeightConfig = () => {
    const configs = WeightConfigManager.getAllConfigurations();
    const activeConfig = configs.find(c => c.confirmedAt);
    setWeightConfig(activeConfig || null);
  };

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh && refreshInterval > 0) {
      interval = setInterval(updateRecommendations, refreshInterval * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, selectedSymbols]);

  // Load weight config on mount
  useEffect(() => {
    loadWeightConfig();
    updateRecommendations();
  }, []);

  // Render signal badge
  const renderSignalBadge = (signal: TradingSignal | null) => {
    if (!signal) {
      return <Badge variant="outline" className="text-muted-foreground">HOLD</Badge>;
    }

    const variant = signal.action === 'BUY' ? 'default' : signal.action === 'SELL' ? 'destructive' : 'outline';
    const icon = signal.action === 'BUY' ? <TrendingUp className="w-3 h-3" /> : 
                 signal.action === 'SELL' ? <TrendingDown className="w-3 h-3" /> : 
                 <Activity className="w-3 h-3" />;

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {icon}
        {signal.action} ({signal.confidence.toFixed(1)}%)
      </Badge>
    );
  };

  // Render risk level badge
  const renderRiskBadge = (riskLevel: 'LOW' | 'MEDIUM' | 'HIGH') => {
    const colors = {
      LOW: 'bg-green-100 text-green-800 border-green-300',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      HIGH: 'bg-red-100 text-red-800 border-red-300'
    };

    return (
      <Badge variant="outline" className={colors[riskLevel]}>
        {riskLevel} RISK
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trading Recommendations</h1>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Live Analysis
          </Badge>
          {apiStatus && (
            <Badge 
              variant={apiStatus.coinGecko && apiStatus.binance ? "default" : apiStatus.coinGecko || apiStatus.binance ? "secondary" : "destructive"}
              className="flex items-center gap-2"
            >
              {apiStatus.coinGecko && apiStatus.binance ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Real-time Data
                </>
              ) : apiStatus.coinGecko || apiStatus.binance ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  Partial Data
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3" />
                  Offline Mode
                </>
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Symbols to Analyze</Label>
            <Select 
              value={selectedSymbols.join(',')} 
              onValueChange={(value) => setSelectedSymbols(value.split(','))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select symbols" />
              </SelectTrigger>
              <SelectContent>
                {availableSymbols.map(symbol => (
                  <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Refresh Interval (seconds)</Label>
            <Input
              type="number"
              min="30"
              max="3600"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Auto Refresh</Label>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="w-full"
            >
              {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Actions</Label>
            <Button
              onClick={updateRecommendations}
              disabled={loading}
              className="w-full flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Now
            </Button>
          </div>
        </div>

        {/* Weight Configuration Status */}
        {weightConfig && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Active Weight Configuration:</span>
              <span>{weightConfig.name}</span>
              <Badge variant="outline" className="text-green-700 border-green-300">
                {weightConfig.performance.winRate.toFixed(1)}% Win Rate
              </Badge>
            </div>
          </div>
        )}
      </Card>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <h3 className="font-bold">Error</h3>
          </div>
          <p className="mt-2">{error}</p>
        </div>
      )}

      {/* Recommendations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {recommendations.map((rec) => (
          <Card key={rec.symbol} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{rec.symbol}</h3>
              <div className="text-right">
                {(() => {
                  const currentPrice = currentPrices.find(p => p.symbol === rec.symbol);
                  return currentPrice ? (
                    <div className="space-y-1">
                      <div className="text-lg font-bold">
                        ${currentPrice.price.toFixed(currentPrice.price < 1 ? 4 : 2)}
                      </div>
                      <div className={`text-xs flex items-center gap-1 ${
                        currentPrice.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {currentPrice.change24h >= 0 ? '▲' : '▼'}
                        {Math.abs(currentPrice.change24h).toFixed(2)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vol: ${(currentPrice.volume24h / 1000000).toFixed(1)}M
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Updated: {new Date(rec.lastUpdated).toLocaleTimeString()}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* Market Insights Section */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Market Insights
              </div>
              <div className="space-y-1">
                {getSymbolInsights(rec.symbol).slice(0, 3).map((insight, idx) => (
                  <div key={idx} className="text-xs text-blue-700">
                    {insight}
                  </div>
                ))}
              </div>
            </div>

            {/* Buy Setup */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-green-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Buy Setup
                </h4>
                <div className="flex gap-2">
                  {renderSignalBadge(rec.buySetup.signal)}
                  {renderRiskBadge(rec.buySetup.riskLevel)}
                </div>
              </div>

              {rec.buySetup.signal && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-medium ml-1">${rec.buySetup.signal.currentPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target:</span>
                      <span className="font-medium ml-1 text-green-600">
                        ${rec.buySetup.signal.targetPrice?.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stop Loss:</span>
                      <span className="font-medium ml-1 text-red-600">
                        ${rec.buySetup.signal.stopLoss?.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="font-medium ml-1">{rec.buySetup.signal.confidence.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Conditions:</div>
                {rec.buySetup.conditions.map((condition, idx) => (
                  <div key={idx} className="text-xs bg-background/50 p-2 rounded border">
                    {condition}
                  </div>
                ))}
              </div>
            </div>

            {/* Sell Setup */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-red-600 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Sell Setup
                </h4>
                <div className="flex gap-2">
                  {renderSignalBadge(rec.sellSetup.signal)}
                  {renderRiskBadge(rec.sellSetup.riskLevel)}
                </div>
              </div>

              {rec.sellSetup.signal && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-medium ml-1">${rec.sellSetup.signal.currentPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target:</span>
                      <span className="font-medium ml-1 text-red-600">
                        ${rec.sellSetup.signal.targetPrice?.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stop Loss:</span>
                      <span className="font-medium ml-1 text-green-600">
                        ${rec.sellSetup.signal.stopLoss?.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="font-medium ml-1">{rec.sellSetup.signal.confidence.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Conditions:</div>
                {rec.sellSetup.conditions.map((condition, idx) => (
                  <div key={idx} className="text-xs bg-background/50 p-2 rounded border">
                    {condition}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Generating recommendations...</p>
        </div>
      )}

      {recommendations.length === 0 && !loading && (
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No recommendations available. Click "Refresh Now" to generate analysis.</p>
        </div>
      )}
    </div>
  );
};

export default TradingRecommendations;
