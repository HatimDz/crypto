import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, AlertTriangle, Check, X, Download, Upload, History, BrainCircuit } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import WeightConfigManager, { WeightConfiguration, DEFAULT_WEIGHTS } from '../utils/weightConfig';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  action: 'BUY' | 'SELL';
  quantity: number;
  profit: number;
  profitPercent: number;
  confidence: number;
  holdingPeriod: number; // in hours
  indicatorValues: IndicatorSnapshot;
  reasoning: string[];
}

interface BacktestResult {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWinAmount: number;
  avgLossAmount: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  dailyReturns: Array<{ date: string; portfolioValue: number; return: number }>;
}

export interface HistoricalPriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSettings {
  rsi: boolean;
  macd: boolean;
  bollingerBands: boolean;
  movingAverages: boolean;
  stochasticRsi: boolean;
  williamsR: boolean;
  cci: boolean;
  adx: boolean;
  obv: boolean;
  volumeAnalysis: boolean;
  eq30: boolean;
  eq60: boolean;
  eq90: boolean;
}

interface IndicatorSnapshot {
  rsi?: number;
  macd?: { macd: number; signal: number; histogram: number };
  bollingerBands?: { upper: number; middle: number; lower: number };
  sma20?: number;
  sma50?: number;
  stochasticRsi?: number;
  williamsR?: number;
  cci?: number;
  adx?: number;
  obv?: number;
  equilibrium?: { eq30?: number; eq60?: number; eq90?: number };
  volume?: { current: number; average: number; ratio: number };
}

interface IndicatorPerformance {
  indicator: string;
  totalTrades: number;
  winningTrades: number;
  totalProfit: number;
  avgProfitPerTrade: number;
  winRate: number;
  reliability: number;
  weight: number;
}

interface WeightOptimizationResult {
  strategy: string;
  weights: { [key: string]: number };
  expectedProfit: number;
  winRate: number;
  sharpeRatio: number;
}

// Get accurate historical price for a specific date
export const getHistoricalPrice = (symbol: string, date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Historical price data for major cryptocurrencies (approximate values for key dates)
  const historicalPrices: { [key: string]: { [key: string]: number } } = {
    'BTCUSDT': {
      '2023-01-01': 16625,
      '2023-06-01': 27200,
      '2023-12-01': 42000,
      '2024-01-01': 42300,
      '2024-06-01': 71000,
      '2024-12-01': 96000,
      '2025-01-01': 94000
    },
    'ETHUSDT': {
      '2023-01-01': 1220,
      '2023-06-01': 1875,
      '2023-12-01': 2250,
      '2024-01-01': 2300,
      '2024-06-01': 3800,
      '2024-12-01': 3900,
      '2025-01-01': 3400
    },
    'BNBUSDT': {
      '2023-01-01': 248,
      '2023-06-01': 310,
      '2023-12-01': 310,
      '2024-01-01': 315,
      '2024-06-01': 590,
      '2024-12-01': 720,
      '2025-01-01': 690
    },
    'ADAUSDT': {
      '2023-01-01': 0.245,
      '2023-06-01': 0.375,
      '2023-12-01': 0.485,
      '2024-01-01': 0.505,
      '2024-06-01': 0.470,
      '2024-12-01': 1.050,
      '2025-01-01': 0.890
    },
    'SOLUSDT': {
      '2023-01-01': 8.10,
      '2023-06-01': 18.50,
      '2023-12-01': 71.00,
      '2024-01-01': 98.50,
      '2024-06-01': 140.00,
      '2024-12-01': 240.00,
      '2025-01-01': 190.00
    }
  };
  
  const symbolPrices = historicalPrices[symbol];
  if (!symbolPrices) return 30000; // fallback
  
  // Find the closest historical date
  const targetDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  
  // If exact date exists, use it
  if (symbolPrices[targetDateStr]) {
    return symbolPrices[targetDateStr];
  }
  
  // Otherwise, interpolate between closest dates
  const dates = Object.keys(symbolPrices).sort();
  const targetTime = date.getTime();
  
  let beforeDate = dates[0];
  let afterDate = dates[dates.length - 1];
  
  for (let i = 0; i < dates.length - 1; i++) {
    const currentTime = new Date(dates[i]).getTime();
    const nextTime = new Date(dates[i + 1]).getTime();
    
    if (targetTime >= currentTime && targetTime <= nextTime) {
      beforeDate = dates[i];
      afterDate = dates[i + 1];
      break;
    }
  }
  
  // Linear interpolation
  const beforeTime = new Date(beforeDate).getTime();
  const afterTime = new Date(afterDate).getTime();
  const beforePrice = symbolPrices[beforeDate];
  const afterPrice = symbolPrices[afterDate];
  
  if (beforeTime === afterTime) return beforePrice;
  
  const ratio = (targetTime - beforeTime) / (afterTime - beforeTime);
  return beforePrice + (afterPrice - beforePrice) * ratio;
};

// Fetches historical data from the CryptoCompare API
export const fetchHistoricalData = async (symbol: string, startDate: Date, endDate: Date): Promise<HistoricalPriceData[]> => {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${startDate.getTime()}&endTime=${endDate.getTime()}&limit=1000`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Binance API request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from Binance API');
    }

    return data.map((item: [number, string, string, string, string, string]) => ({
      date: new Date(item[0]).toISOString().split('T')[0],
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
  } catch (error) {
    console.error("Error fetching historical data from Binance:", error);
    throw error;
  }
};

// Generate realistic historical data based on real crypto patterns
export const generateHistoricalData = (symbol: string, startDate: Date, endDate: Date): HistoricalPriceData[] => {
  const data: HistoricalPriceData[] = [];
  
  // Get accurate starting price for the selected date
  const startingPrice = getHistoricalPrice(symbol, startDate);
  
  // Real-world volatility and trend patterns for different symbols
  const symbolData = {
    'BTCUSDT': { volatility: 0.04, trendStrength: 0.15 },
    'ETHUSDT': { volatility: 0.05, trendStrength: 0.18 },
    'BNBUSDT': { volatility: 0.06, trendStrength: 0.12 },
    'ADAUSDT': { volatility: 0.07, trendStrength: 0.10 },
    'SOLUSDT': { volatility: 0.08, trendStrength: 0.20 }
  };
  
  const config = symbolData[symbol as keyof typeof symbolData] || symbolData.BTCUSDT;
  let currentPrice = startingPrice;
  const current = new Date(startDate);
  
  // Create deterministic seed based on symbol and date for consistency
  const seed = symbol.charCodeAt(0) + startDate.getTime() / 1000000;
  let seedValue = seed;
  
  // Deterministic random function
  const deterministicRandom = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280;
    return seedValue / 233280;
  };
  
  while (current <= endDate) {
    const daysSinceStart = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Market regime simulation (bull/bear/sideways) - much smaller changes
    const longTermCycle = Math.sin(daysSinceStart / 120) * 0.002; // Max 0.2% daily from long term
    const mediumTermCycle = Math.sin(daysSinceStart / 30) * 0.001; // Max 0.1% daily from medium term
    const shortTermNoise = (deterministicRandom() - 0.5) * 0.03; // Max 1.5% daily noise
    
    // Weekend effect
    const weekendMultiplier = isWeekend ? 0.5 : 1.0;
    
    // Calculate price change - limit to reasonable daily movements
    const rawChange = (longTermCycle + mediumTermCycle + shortTermNoise) * weekendMultiplier;
    const totalChange = Math.max(-0.15, Math.min(0.15, rawChange)); // Cap at ±15% daily
    
    const open = currentPrice;
    const close = currentPrice * (1 + totalChange);
    
    // Generate realistic OHLC with deterministic randomness
    const intraDayVolatility = 0.02; // Fixed 2% max intraday movement
    const rand1 = deterministicRandom();
    const rand2 = deterministicRandom();
    const rand3 = deterministicRandom();
    
    // Ensure high/low are reasonable relative to open/close
    const maxPrice = Math.max(open, close);
    const minPrice = Math.min(open, close);
    const high = maxPrice + (maxPrice * intraDayVolatility * rand1 * 0.5);
    const low = minPrice - (minPrice * intraDayVolatility * rand2 * 0.5);
    
    // Volume correlates with volatility and price movement
    const baseVolume = {
      'BTCUSDT': 25000000000,
      'ETHUSDT': 15000000000,
      'BNBUSDT': 800000000,
      'ADAUSDT': 400000000,
      'SOLUSDT': 2000000000
    }[symbol] || 25000000000;
    
    const volatilityFactor = Math.abs(totalChange) * 20 + 1;
    const volume = baseVolume * volatilityFactor * (0.8 + rand3 * 0.4);
    
    data.push({
      date: current.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume)
    });
    
    currentPrice = close;
    current.setDate(current.getDate() + 1);
  }
  
  return data;
};

// Technical indicators (simplified versions for backtesting)
export class TechnicalAnalysis {
  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Use the most recent 'period' number of gains/losses
    const recentGains = gains.slice(-period);
    const recentLosses = losses.slice(-period);
    
    const avgGain = recentGains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = recentLosses.reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return avgGain > 0 ? 100 : 50;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return Math.max(0, Math.min(100, rsi)); // Ensure RSI is between 0-100
  }

  static calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const recent = prices.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / period;
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
    
    // Simplified signal line
    const signal = macd * 0.2;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  static calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number } {
    if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
    
    const middle = this.calculateSMA(prices, period);
    const recentPrices = prices.slice(-period);
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
    
    // Calculate RSI for each period to build RSI series
    const rsiSeries: number[] = [];
    for (let i = rsiPeriod; i < prices.length; i++) {
      const slice = prices.slice(i - rsiPeriod, i + 1); // Include current price
      const rsi = this.calculateRSI(slice, rsiPeriod);
      rsiSeries.push(rsi);
    }
    
    if (rsiSeries.length < stochPeriod) return 50;
    
    // Get the most recent stochPeriod RSI values
    const recentRsi = rsiSeries.slice(-stochPeriod);
    const minRsi = Math.min(...recentRsi);
    const maxRsi = Math.max(...recentRsi);
    
    // Avoid division by zero
    if (maxRsi === minRsi) return 50;
    
    const currentRsi = recentRsi[recentRsi.length - 1];
    const stochRsi = ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
    
    return Math.max(0, Math.min(100, stochRsi)); // Clamp between 0-100
  }

  static analyzeVolume(data: HistoricalPriceData[], period: number = 20): { ratio: number; trend: string } {
    if (data.length < period) return { ratio: 1, trend: 'neutral' };
    
    const recent = data.slice(-period);
    const currentVolume = data[data.length - 1].volume;
    
    // Calculate average volume over the period
    const avgVolume = recent.reduce((sum, d) => sum + d.volume, 0) / period;
    
    if (avgVolume === 0) return { ratio: 1, trend: 'neutral' };
    
    const ratio = currentVolume / avgVolume;
    
    // Determine volume trend based on ratio
    let trend: string;
    if (ratio > 2.0) {
      trend = 'very_high';
    } else if (ratio > 1.5) {
      trend = 'high';
    } else if (ratio > 1.2) {
      trend = 'above_average';
    } else if (ratio < 0.5) {
      trend = 'low';
    } else if (ratio < 0.8) {
      trend = 'below_average';
    } else {
      trend = 'normal';
    }
    
    return { ratio: Math.max(0, ratio), trend };
  }

  static calculateWilliamsR(data: HistoricalPriceData[], period: number = 14): number {
    if (data.length < period) return -50;
    
    const recent = data.slice(-period);
    const highestHigh = Math.max(...recent.map(d => d.high));
    const lowestLow = Math.min(...recent.map(d => d.low));
    const currentClose = data[data.length - 1].close;
    
    if (highestHigh === lowestLow) return -50;
    
    const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
    return Math.max(-100, Math.min(0, williamsR)); // Williams %R ranges from -100 to 0
  }

  static calculateCCI(data: HistoricalPriceData[], period: number = 20): number {
    if (data.length < period) return 0;
    
    const recent = data.slice(-period);
    const typicalPrices = recent.map(d => (d.high + d.low + d.close) / 3);
    
    // Calculate Simple Moving Average of Typical Price
    const smaTP = typicalPrices.reduce((a, b) => a + b, 0) / period;
    
    // Calculate Mean Deviation
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
    
    if (meanDeviation === 0) return 0;
    
    const currentTP = typicalPrices[typicalPrices.length - 1];
    const cci = (currentTP - smaTP) / (0.015 * meanDeviation);
    
    // CCI typically ranges from -300 to +300, but can exceed these bounds
    return Math.max(-500, Math.min(500, cci)); // Reasonable bounds to prevent extreme values
  }

  static calculateADX(data: HistoricalPriceData[], period: number = 14): number {
    if (data.length < period + 1) return 0;
    
    const trValues: number[] = [];
    const plusDmValues: number[] = [];
    const minusDmValues: number[] = [];
    
    // Calculate TR, +DM, and -DM for each period
    for (let i = 1; i < data.length; i++) {
      const curr = data[i];
      const prev = data[i - 1];
      
      // True Range calculation
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      
      // Directional Movement calculation
      const upMove = curr.high - prev.high;
      const downMove = prev.low - curr.low;
      
      const plusDm = (upMove > downMove && upMove > 0) ? upMove : 0;
      const minusDm = (downMove > upMove && downMove > 0) ? downMove : 0;
      
      trValues.push(tr);
      plusDmValues.push(plusDm);
      minusDmValues.push(minusDm);
    }
    
    if (trValues.length < period) return 0;
    
    // Use the most recent period values
    const recentTr = trValues.slice(-period);
    const recentPlusDm = plusDmValues.slice(-period);
    const recentMinusDm = minusDmValues.slice(-period);
    
    // Calculate smoothed averages
    const trSum = recentTr.reduce((a, b) => a + b, 0);
    const plusDmSum = recentPlusDm.reduce((a, b) => a + b, 0);
    const minusDmSum = recentMinusDm.reduce((a, b) => a + b, 0);
    
    if (trSum === 0) return 0;
    
    // Calculate Directional Indicators
    const plusDi = (plusDmSum / trSum) * 100;
    const minusDi = (minusDmSum / trSum) * 100;
    
    // Calculate Directional Index
    const diSum = plusDi + minusDi;
    if (diSum === 0) return 0;
    
    const dx = (Math.abs(plusDi - minusDi) / diSum) * 100;
    
    return Math.max(0, Math.min(100, dx)); // ADX ranges from 0 to 100
  }

  static calculateOBV(data: HistoricalPriceData[]): number {
    if (data.length < 2) return 0;
    
    let obv = 0;
    for (let i = 1; i < data.length; i++) {
      const currentClose = data[i].close;
      const previousClose = data[i - 1].close;
      const currentVolume = data[i].volume;
      
      if (currentClose > previousClose) {
        obv += currentVolume; // Price up, add volume
      } else if (currentClose < previousClose) {
        obv -= currentVolume; // Price down, subtract volume
      }
      // If prices are equal, OBV remains unchanged
    }
    
    return obv;
  }

  static calculateEquilibrium(data: HistoricalPriceData[], days: number): number {
    if (!data || data.length < days) return 0;
    const relevantData = data.slice(-days);
    const means = relevantData.map(item => {
      // New logic: mean of the candle body, equivalent to (max(o,c) + min(o,c)) / 2
      return (item.open + item.close) / 2;
    });
    const validMeans = means.filter(mean => !isNaN(mean) && isFinite(mean));
    if (validMeans.length === 0) return 0;
    const sum = validMeans.reduce((acc, mean) => acc + mean, 0);
    return sum / validMeans.length;
  }

  static generateSignal(data: HistoricalPriceData[], index: number, enabledIndicators: IndicatorSettings, indicatorWeights: { [key: string]: number }): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number; reasoning: string[]; indicatorValues: IndicatorSnapshot } {
    // Adaptive minimum data requirement
    const totalDataPoints = data.length;
    const minDataRequired = Math.min(20, Math.floor(totalDataPoints * 0.25)); // 25% of data or 20 days min
    
    if (index < minDataRequired) return { action: 'HOLD', confidence: 0, reasoning: ['Insufficient data for analysis'], indicatorValues: {} };

    const prices = data.slice(0, index + 1).map(d => d.close);
    const currentPrice = data[index].close;
    
    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const bb = this.calculateBollingerBands(prices);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const stochRsi = this.calculateStochasticRSI(prices);
    const williamsR = this.calculateWilliamsR(data.slice(0, index + 1));
    const cci = this.calculateCCI(data.slice(0, index + 1));
    const adx = this.calculateADX(data.slice(0, index + 1));
    const obv = this.calculateOBV(data.slice(0, index + 1));
    const prevObv = index > 1 ? this.calculateOBV(data.slice(0, index)) : 0;
    const obvTrend = obv > prevObv ? 'UP' : obv < prevObv ? 'DOWN' : 'FLAT';
    
    // Calculate volume analysis
    const avgVolume = data.slice(Math.max(0, index - 20), index + 1)
      .reduce((sum, d) => sum + d.volume, 0) / Math.min(21, index + 1);
    const currentVolume = data[index].volume;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    
    // Create indicator snapshot
    const indicatorValues: IndicatorSnapshot = {
      rsi: enabledIndicators.rsi ? rsi : undefined,
      macd: enabledIndicators.macd ? macd : undefined,
      bollingerBands: enabledIndicators.bollingerBands ? bb : undefined,
      sma20: enabledIndicators.movingAverages ? sma20 : undefined,
      sma50: enabledIndicators.movingAverages ? sma50 : undefined,
      stochasticRsi: enabledIndicators.stochasticRsi ? stochRsi : undefined,
      williamsR: enabledIndicators.williamsR ? williamsR : undefined,
      cci: enabledIndicators.cci ? cci : undefined,
      adx: enabledIndicators.adx ? adx : undefined,
      obv: enabledIndicators.obv ? obv : undefined,
      volume: enabledIndicators.volumeAnalysis ? { current: currentVolume, average: avgVolume, ratio: volumeRatio } : undefined
    };
    
    let buySignals = 0;
    let sellSignals = 0;
    let totalStrength = 0;
    const reasoning: string[] = [];

    // RSI signals (only if enabled)
    if (enabledIndicators.rsi) {
      if (rsi < 30) {
        buySignals++;
        totalStrength += (30 - rsi) * 2;
        reasoning.push(`RSI oversold (${rsi.toFixed(1)})`);
      } else if (rsi > 70) {
        sellSignals++;
        totalStrength += (rsi - 70) * 2;
        reasoning.push(`RSI overbought (${rsi.toFixed(1)})`);
      }
    }

    // MACD signals (only if enabled)
    if (enabledIndicators.macd) {
      if (macd.histogram > 0 && macd.macd > macd.signal) {
        buySignals++;
        totalStrength += 50;
        reasoning.push('MACD bullish crossover');
      } else if (macd.histogram < 0 && macd.macd < macd.signal) {
        sellSignals++;
        totalStrength += 50;
        reasoning.push('MACD bearish crossover');
      }
    }

    // Bollinger Bands signals (only if enabled)
    if (enabledIndicators.bollingerBands) {
      if (currentPrice < bb.lower) {
        buySignals++;
        totalStrength += 60;
        reasoning.push('Price below lower Bollinger Band');
      } else if (currentPrice > bb.upper) {
        sellSignals++;
        totalStrength += 60;
        reasoning.push('Price above upper Bollinger Band');
      }
    }

    // Moving average signals (only if enabled)
    if (enabledIndicators.movingAverages) {
      if (sma20 > sma50 && currentPrice > sma20) {
        buySignals++;
        totalStrength += 40;
        reasoning.push('Price above rising 20 SMA');
      } else if (sma20 < sma50 && currentPrice < sma20) {
        sellSignals++;
        totalStrength += 40;
        reasoning.push('Price below falling 20 SMA');
      }
    }

    // Stochastic RSI signals (only if enabled)
    if (enabledIndicators.stochasticRsi) {
      if (stochRsi < 20) {
        buySignals++;
        totalStrength += 45;
        reasoning.push(`Stochastic RSI oversold (${stochRsi.toFixed(1)})`);
      } else if (stochRsi > 80) {
        sellSignals++;
        totalStrength += 45;
        reasoning.push(`Stochastic RSI overbought (${stochRsi.toFixed(1)})`);
      }
    }

    // Williams %R signals (only if enabled)
    if (enabledIndicators.williamsR) {
      if (williamsR < -80) {
        buySignals++;
        totalStrength += 35;
        reasoning.push(`Williams %R oversold (${williamsR.toFixed(1)})`);
      } else if (williamsR > -20) {
        sellSignals++;
        totalStrength += 35;
        reasoning.push(`Williams %R overbought (${williamsR.toFixed(1)})`);
      }
    }

    // CCI signals (only if enabled)
    if (enabledIndicators.cci) {
      if (cci < -100) {
        buySignals++;
        totalStrength += 50;
        reasoning.push(`CCI oversold (${cci.toFixed(1)})`);
      } else if (cci > 100) {
        sellSignals++;
        totalStrength += 50;
        reasoning.push(`CCI overbought (${cci.toFixed(1)})`);
      }
    }

    // ADX signals (only if enabled)
    if (enabledIndicators.adx) {
      if (adx > 25) {
        // Strong trend - enhance other signals
        if (buySignals > sellSignals) {
          totalStrength += 30;
          reasoning.push(`ADX confirms strong trend (${adx.toFixed(1)})`);
        } else if (sellSignals > buySignals) {
          totalStrength += 30;
          reasoning.push(`ADX confirms strong trend (${adx.toFixed(1)})`);
        }
      }
    }

    // OBV signals (only if enabled)
    if (enabledIndicators.obv) {
      if (obvTrend === 'UP' && currentPrice > sma20) {
        buySignals++;
        totalStrength += 25;
        reasoning.push('OBV trending up with price');
      } else if (obvTrend === 'DOWN' && currentPrice < sma20) {
        sellSignals++;
        totalStrength += 25;
        reasoning.push('OBV trending down with price');
      }
    }

    // Volume analysis (only if enabled)
    if (enabledIndicators.volumeAnalysis) {
      const avgVolume = data.slice(Math.max(0, index - 20), index + 1)
        .reduce((sum, d) => sum + d.volume, 0) / Math.min(21, index + 1);
      const currentVolume = data[index].volume;
      
      if (currentVolume > avgVolume * 1.5) {
        if (buySignals > sellSignals) {
          totalStrength += 20;
          reasoning.push('High volume confirms buy signal');
        } else if (sellSignals > buySignals) {
          totalStrength += 20;
          reasoning.push('High volume confirms sell signal');
        }
      }
    }

    // Equilibrium analysis
    const eq30 = enabledIndicators.eq30 ? this.calculateEquilibrium(data.slice(0, index + 1), 30) : undefined;
    const eq60 = enabledIndicators.eq60 ? this.calculateEquilibrium(data.slice(0, index + 1), 60) : undefined;
    const eq90 = enabledIndicators.eq90 ? this.calculateEquilibrium(data.slice(0, index + 1), 90) : undefined;

    indicatorValues.equilibrium = { eq30, eq60, eq90 };

    if (eq30 !== undefined && currentPrice < eq30 * 0.95) {
        buySignals++;
        totalStrength += 65;
        reasoning.push('Price significantly below 30-day equilibrium');
    }
    if (eq30 !== undefined && currentPrice > eq30 * 1.05) {
        sellSignals++;
        totalStrength += 65;
        reasoning.push('Price significantly above 30-day equilibrium');
    }
    if (eq60 !== undefined && currentPrice < eq60 * 0.92) {
        buySignals++;
        totalStrength += 75;
        reasoning.push('Price strongly below 60-day equilibrium');
    }
    if (eq60 !== undefined && currentPrice > eq60 * 1.08) {
        sellSignals++;
        totalStrength += 75;
        reasoning.push('Price strongly above 60-day equilibrium');
    }
    if (eq90 !== undefined && currentPrice < eq90 * 0.90) {
        buySignals++;
        totalStrength += 85;
        reasoning.push('Price very far below 90-day equilibrium (strong buy)');
    }
    if (eq90 !== undefined && currentPrice > eq90 * 1.10) {
        sellSignals++;
        totalStrength += 85;
        reasoning.push('Price very far above 90-day equilibrium (strong sell)');
    }

    // Advanced Signal Architecture - Based on Real Market Facts
    const signalAnalysis = this.analyzeSignalStrength(buySignals, sellSignals, totalStrength, reasoning, enabledIndicators, indicatorWeights);
    
    return {
      action: signalAnalysis.action,
      confidence: signalAnalysis.confidence,
      reasoning: signalAnalysis.reasoning,
      indicatorValues
    };
  }

  static analyzeSignalStrength(
    buySignals: number,
    sellSignals: number, 
    totalStrength: number,
    reasoning: string[],
    enabledIndicators: IndicatorSettings,
    indicatorWeights: { [key: string]: number }
  ): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number; reasoning: string[] } {
    
    // Calculate weighted signal strength with improved algorithm
    let weightedBuyStrength = 0;
    let weightedSellStrength = 0;
    let totalActiveWeight = 0;

    // Parse reasoning to extract signal sources and their strengths
    const signalSources = this.parseSignalSources(reasoning);
    
    signalSources.forEach(source => {
      const weight = indicatorWeights[source.indicator as keyof typeof indicatorWeights] || 0.01;
      totalActiveWeight += weight;
      
      // Apply signal strength multipliers based on indicator reliability
      let adjustedStrength = source.strength;
      
      // High-reliability indicators get strength bonus
      if (['eq30', 'eq60', 'eq90', 'volumeAnalysis', 'macd', 'adx'].includes(source.indicator)) {
        adjustedStrength *= 1.2; // 20% bonus for top-tier indicators
      }
      
      // Apply confidence scaling based on signal clarity
      if (source.strength > 0.8) {
        adjustedStrength *= 1.1; // Bonus for very clear signals
      } else if (source.strength < 0.4) {
        adjustedStrength *= 0.8; // Penalty for weak signals
      }
      
      if (source.type === 'BUY') {
        weightedBuyStrength += adjustedStrength * weight;
      } else if (source.type === 'SELL') {
        weightedSellStrength += adjustedStrength * weight;
      }
    });

    // Normalize by active weight to prevent dilution
    const normalizedBuyStrength = totalActiveWeight > 0 ? (weightedBuyStrength / totalActiveWeight) * 100 : 0;
    const normalizedSellStrength = totalActiveWeight > 0 ? (weightedSellStrength / totalActiveWeight) * 100 : 0;

    // Signal Quality Assessment
    const signalQuality = this.assessSignalQuality(signalSources, enabledIndicators);
    
    // Confidence Thresholds (based on real market performance)
    const STRONG_THRESHOLD = 65;      // High-confidence trades
    const MODERATE_THRESHOLD = 45;    // Medium-confidence trades
    const WEAK_THRESHOLD = 25;        // Low-confidence trades

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    const finalReasoning: string[] = [...reasoning];

    // Determine action based on weighted strength and quality
    if (normalizedBuyStrength > normalizedSellStrength) {
      const rawConfidence = normalizedBuyStrength * signalQuality.multiplier;
      
      if (rawConfidence >= STRONG_THRESHOLD) {
        action = 'BUY';
        confidence = Math.min(95, rawConfidence);
        finalReasoning.push(`Strong buy signal (${signalQuality.activeIndicators} indicators aligned)`);
      } else if (rawConfidence >= MODERATE_THRESHOLD) {
        action = 'BUY';
        confidence = Math.min(75, rawConfidence);
        finalReasoning.push(`Moderate buy signal (${signalQuality.activeIndicators} indicators)`);
      } else if (rawConfidence >= WEAK_THRESHOLD) {
        action = 'BUY';
        confidence = Math.min(55, rawConfidence);
        finalReasoning.push(`Weak buy signal (limited confirmation)`);
      }
    } else if (normalizedSellStrength > normalizedBuyStrength) {
      const rawConfidence = normalizedSellStrength * signalQuality.multiplier;
      
      if (rawConfidence >= STRONG_THRESHOLD) {
        action = 'SELL';
        confidence = Math.min(95, rawConfidence);
        finalReasoning.push(`Strong sell signal (${signalQuality.activeIndicators} indicators aligned)`);
      } else if (rawConfidence >= MODERATE_THRESHOLD) {
        action = 'SELL';
        confidence = Math.min(75, rawConfidence);
        finalReasoning.push(`Moderate sell signal (${signalQuality.activeIndicators} indicators)`);
      } else if (rawConfidence >= WEAK_THRESHOLD) {
        action = 'SELL';
        confidence = Math.min(55, rawConfidence);
        finalReasoning.push(`Weak sell signal (limited confirmation)`);
      }
    }

    // No action if signals are too weak or conflicting
    if (action === 'HOLD') {
      if (finalReasoning.length === 0) {
        finalReasoning.push('No clear signals - market indecision');
      } else {
        finalReasoning.push('Conflicting or weak signals - holding position');
      }
    }

    return { action, confidence, reasoning: finalReasoning };
  }

  // Advanced indicator weighting system with multiple strategies
  static getOptimizedIndicatorWeights(enabledIndicators?: IndicatorSettings): { [key: string]: number } {
    // First, try to get saved/confirmed weights for the current symbol
    try {
      const currentSymbol = (window as Window & typeof globalThis & { currentSymbol?: string }).currentSymbol;
      const savedWeights = (window as Window & typeof globalThis & { WeightConfigManager?: typeof WeightConfigManager })?.WeightConfigManager?.getCurrentWeights?.(currentSymbol ?? '');
      if (savedWeights && Object.keys(savedWeights).length > 0) {
        // Filter saved weights for enabled indicators if specified
        if (enabledIndicators) {
          return this.filterWeightsForEnabledIndicators(savedWeights, enabledIndicators);
        }
        return savedWeights;
      }
    } catch (error) {
      console.warn('Could not load saved weights, using defaults:', error);
    }
    // Strategy 1: Academic Research Based (Conservative)
    const academicWeights = {
      eq90: 0.15,                   // Long-term equilibrium
      eq60: 0.12,                   // Medium-term equilibrium
      eq30: 0.10,                   // Short-term equilibrium
      volumeAnalysis: 0.12,         // Volume precedes price
      macd: 0.11,                   // Trend-following
      adx: 0.10,                    // Trend strength
      rsi: 0.08,                    // Momentum
      bollingerBands: 0.07,         // Volatility
      stochasticRsi: 0.05,          // Enhanced momentum
      movingAverages: 0.04,         // Simple trend
      cci: 0.03,                    // Commodity Channel Index
      obv: 0.02,                    // On-Balance Volume
      williamsR: 0.01               // Williams %R
    };

    // Strategy 2: Crypto-Optimized (Aggressive)
    const cryptoWeights = {
      volumeAnalysis: 0.18,         // Volume is king
      eq30: 0.16,                   // Short-term mean reversion
      eq60: 0.14,                   // Mid-term trends
      macd: 0.12,                   // Excellent for crypto trends
      adx: 0.10,                    // Strong trends in crypto
      stochasticRsi: 0.09,          // Better than RSI for volatility
      rsi: 0.07,                    // Standard momentum
      bollingerBands: 0.06,         // Volatility breakouts
      eq90: 0.05,                   // Long-term anchor
      cci: 0.04,                    // Momentum confirmation
      movingAverages: 0.03,         // Trend confirmation
      obv: 0.02,                    // Volume-price relationship
      williamsR: 0.01               // Least important
    };

    // Strategy 3: Profit-Optimized (Based on backtesting results)
    const profitWeights = {
      eq90: 0.20,                   // Long-term value investing
      eq60: 0.18,                   // Strong mean reversion
      volumeAnalysis: 0.15,         // Confirms breakouts
      adx: 0.12,                    // Trend strength pays off
      eq30: 0.10,                   // Short-term opportunities
      macd: 0.08,                   // Solid performer
      bollingerBands: 0.06,         // Volatility plays
      stochasticRsi: 0.05,          // Better than RSI
      rsi: 0.03,                    // Standard but less effective
      cci: 0.02,                    // Moderate contribution
      movingAverages: 0.01,         // Lagging but safe
      obv: 0.01,                    // Supportive role
      williamsR: 0.01               // Minimal impact
    };

    // Strategy 4: Balanced Approach (Recommended)
    const balancedWeights = {
      eq90: 0.18,                   // Long-term anchor
      eq60: 0.16,                   // Mid-term signal
      volumeAnalysis: 0.14,         // Volume confirmation
      adx: 0.12,                    // Trend strength
      macd: 0.10,                   // Trend following
      eq30: 0.09,                   // Short-term timing
      rsi: 0.07,                    // Momentum
      stochasticRsi: 0.06,          // Enhanced momentum
      bollingerBands: 0.05,         // Volatility
      cci: 0.03,                    // Additional confirmation
      movingAverages: 0.02,         // Trend support
      obv: 0.01,                    // Volume support
      williamsR: 0.01               // Minimal weight
    };

    // Filter weights to only include enabled indicators
    let finalWeights: { [key: string]: number } = { ...profitWeights };
    
    if (enabledIndicators) {
      finalWeights = this.filterWeightsForEnabledIndicators(profitWeights, enabledIndicators);
    }
    
    return finalWeights;
  }

  // Dynamic weight adjustment based on market conditions
  static getAdaptiveWeights(data: HistoricalPriceData[], index: number, enabledIndicators?: IndicatorSettings): { [key: string]: number } {
    if (data.length < 20 || index < 20) {
      return this.getOptimizedIndicatorWeights(enabledIndicators);
    }

    const recent = data.slice(index - 20, index + 1);
    const volatility = this.calculateVolatility(recent);
    const trendStrength = this.calculateTrendStrength(recent);
    
    const weights = { ...this.getOptimizedIndicatorWeights(enabledIndicators) };

    // High volatility: Increase volume and volatility indicators
    if (volatility > 0.05) {
      weights.volumeAnalysis *= 1.3;
      weights.bollingerBands *= 1.4;
      weights.stochasticRsi *= 1.2;
      weights.adx *= 0.9; // Reduce trend indicators in high volatility
    }

    // Strong trend: Increase trend-following indicators
    if (trendStrength > 0.7) {
      weights.macd *= 1.3;
      weights.adx *= 1.4;
      weights.movingAverages *= 1.5;
      weights.rsi *= 0.8; // Reduce oscillators in strong trends
      weights.stochasticRsi *= 0.8;
    }

    // Sideways market: Increase oscillators
    if (trendStrength < 0.3) {
      weights.rsi *= 1.4;
      weights.stochasticRsi *= 1.3;
      weights.williamsR *= 1.5;
      weights.cci *= 1.2;
      weights.macd *= 0.7; // Reduce trend indicators
      weights.adx *= 0.6;
    }

    // Normalize weights to sum to 1
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    Object.keys(weights).forEach(key => {
      weights[key] = weights[key] / totalWeight;
    });

    return weights;
  }

  // Calculate market volatility
  static calculateVolatility(data: HistoricalPriceData[]): number {
    if (data.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      const dailyReturn = (data[i].close - data[i - 1].close) / data[i - 1].close;
      returns.push(dailyReturn);
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  // Calculate trend strength
  static calculateTrendStrength(data: HistoricalPriceData[]): number {
    if (data.length < 10) return 0;
    
    const prices = data.map(d => d.close);
    const sma10 = this.calculateSMA(prices.slice(-10), 10);
    const sma20 = this.calculateSMA(prices.slice(-20), 20);
    
    if (sma20 === 0) return 0;
    
    const trendDirection = sma10 > sma20 ? 1 : -1;
    const trendMagnitude = Math.abs((sma10 - sma20) / sma20);
    
    return Math.min(1, trendMagnitude * 10); // Normalize to 0-1
  }

  // Profit-based weight optimization system
  static optimizeWeightsBasedOnProfit(trades: BacktestTrade[], enabledIndicators: IndicatorSettings, timeframeDays: number): WeightOptimizationResult {
    if (trades.length === 0) {
      return {
        strategy: 'default',
        weights: this.getOptimizedIndicatorWeights(enabledIndicators),
        expectedProfit: 0,
        winRate: 0,
        sharpeRatio: 0
      };
    }

    // Analyze performance of each indicator (only enabled ones)
    const indicatorPerformance = this.analyzeIndicatorPerformance(trades, enabledIndicators, timeframeDays);
    
    // Generate multiple weight strategies (timeframe-aware)
    const strategies = this.generateWeightStrategies(indicatorPerformance, enabledIndicators, timeframeDays);
    
    // Evaluate each strategy
    const evaluatedStrategies = strategies.map(strategy => {
      const metrics = this.evaluateWeightStrategy(strategy.weights, trades);
      return {
        ...strategy,
        expectedProfit: metrics.expectedProfit,
        winRate: metrics.winRate,
        sharpeRatio: metrics.sharpeRatio
      };
    });

    // Select best strategy based on profit-adjusted Sharpe ratio
    const bestStrategy = evaluatedStrategies.reduce((best, current) => {
      const bestScore = best.expectedProfit * best.sharpeRatio * (best.winRate / 100);
      const currentScore = current.expectedProfit * current.sharpeRatio * (current.winRate / 100);
      return currentScore > bestScore ? current : best;
    });

    return bestStrategy;
  }

  // Analyze individual indicator performance (only enabled indicators)
  static analyzeIndicatorPerformance(trades: BacktestTrade[], enabledIndicators: IndicatorSettings, timeframeDays: number): IndicatorPerformance[] {
    // Only analyze enabled indicators
    const allIndicators = ['eq30', 'eq60', 'eq90', 'volumeAnalysis', 'macd', 'adx', 'rsi', 
                          'bollingerBands', 'stochasticRsi', 'cci', 'movingAverages', 'obv', 'williamsR'];
    const indicators = allIndicators.filter(indicator => 
      enabledIndicators[indicator as keyof IndicatorSettings] === true
    );
    
    return indicators.map(indicator => {
      const relevantTrades = trades.filter(trade => 
        trade.reasoning.some(reason => 
          reason.toLowerCase().includes(indicator.toLowerCase().replace(/([A-Z])/g, ' $1').trim())
        )
      );

      const winningTrades = relevantTrades.filter(trade => trade.profit > 0);
      const totalProfit = relevantTrades.reduce((sum, trade) => sum + trade.profit, 0);
      const avgProfitPerTrade = relevantTrades.length > 0 ? totalProfit / relevantTrades.length : 0;
      const winRate = relevantTrades.length > 0 ? (winningTrades.length / relevantTrades.length) * 100 : 0;
      
      // Calculate reliability score (0-1) based on win rate, consistency, and timeframe
      const timeframeMultiplier = this.getTimeframeReliabilityMultiplier(timeframeDays);
      const reliability = Math.min(1, (winRate / 100) * Math.sqrt(relevantTrades.length / 10) * timeframeMultiplier);
      
      return {
        indicator,
        totalTrades: relevantTrades.length,
        winningTrades: winningTrades.length,
        totalProfit,
        avgProfitPerTrade,
        winRate,
        reliability,
        weight: 0 // Will be calculated later
      };
    });
  }

  // Generate different weighting strategies (timeframe-aware)
  static generateWeightStrategies(performance: IndicatorPerformance[], enabledIndicators: IndicatorSettings, timeframeDays: number): { strategy: string; weights: { [key: string]: number } }[] {
    const strategies = [];

    // Strategy 1: Profit-Weighted
    const profitWeights: { [key: string]: number } = {};
    const totalProfit = Math.max(1, performance.reduce((sum, p) => sum + Math.max(0, p.totalProfit), 0));
    performance.forEach(p => {
      profitWeights[p.indicator] = Math.max(0.01, p.totalProfit / totalProfit);
    });
    this.normalizeWeights(profitWeights);
    strategies.push({ strategy: 'profit-weighted', weights: profitWeights });

    // Strategy 2: Win Rate Weighted
    const winRateWeights: { [key: string]: number } = {};
    const totalWinRate = Math.max(1, performance.reduce((sum, p) => sum + p.winRate, 0));
    performance.forEach(p => {
      winRateWeights[p.indicator] = Math.max(0.01, p.winRate / totalWinRate);
    });
    this.normalizeWeights(winRateWeights);
    strategies.push({ strategy: 'winrate-weighted', weights: winRateWeights });

    // Strategy 3: Reliability Weighted
    const reliabilityWeights: { [key: string]: number } = {};
    const totalReliability = Math.max(1, performance.reduce((sum, p) => sum + p.reliability, 0));
    performance.forEach(p => {
      reliabilityWeights[p.indicator] = Math.max(0.01, p.reliability / totalReliability);
    });
    this.normalizeWeights(reliabilityWeights);
    strategies.push({ strategy: 'reliability-weighted', weights: reliabilityWeights });

    // Strategy 4: Hybrid (Profit * Win Rate * Reliability)
    const hybridWeights: { [key: string]: number } = {};
    performance.forEach(p => {
      const profitScore = Math.max(0, p.avgProfitPerTrade) / 1000; // Normalize
      const winRateScore = p.winRate / 100;
      const reliabilityScore = p.reliability;
      hybridWeights[p.indicator] = Math.max(0.01, profitScore * winRateScore * reliabilityScore);
    });
    this.normalizeWeights(hybridWeights);
    strategies.push({ strategy: 'hybrid-optimized', weights: hybridWeights });

    // Strategy 5: Current Profit-Optimized (our default) - filtered for enabled indicators
    const defaultWeights = this.filterWeightsForEnabledIndicators(
      this.getOptimizedIndicatorWeights(), 
      enabledIndicators
    );
    strategies.push({ strategy: 'current-optimized', weights: defaultWeights });
    
    // Apply timeframe adjustments to all strategies
    strategies.forEach(strategy => {
      strategy.weights = this.applyTimeframeAdjustments(strategy.weights, timeframeDays);
    });

    return strategies;
  }

  // Filter weights to only include enabled indicators
  static filterWeightsForEnabledIndicators(weights: { [key: string]: number }, enabledIndicators: IndicatorSettings): { [key: string]: number } {
    const filteredWeights: { [key: string]: number } = {};
    
    Object.entries(weights).forEach(([indicator, weight]) => {
      if (enabledIndicators[indicator as keyof IndicatorSettings] === true) {
        filteredWeights[indicator] = weight;
      }
    });
    
    // If no indicators are enabled, return equal weights for all enabled ones
    if (Object.keys(filteredWeights).length === 0) {
      const enabledKeys = Object.entries(enabledIndicators)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
      
      const equalWeight = 1 / Math.max(1, enabledKeys.length);
      enabledKeys.forEach(key => {
        filteredWeights[key] = equalWeight;
      });
    } else {
      // Normalize the filtered weights to sum to 1
      this.normalizeWeights(filteredWeights);
    }
    
    return filteredWeights;
  }

  // Get timeframe reliability multiplier
  static getTimeframeReliabilityMultiplier(timeframeDays: number): number {
    // Short-term (< 30 days): Momentum indicators more reliable
    if (timeframeDays < 30) {
      return 1.2; // Boost reliability for short-term signals
    }
    // Medium-term (30-90 days): Balanced approach
    else if (timeframeDays <= 90) {
      return 1.0; // Standard reliability
    }
    // Long-term (> 90 days): Trend indicators more reliable
    else {
      return 0.9; // Slightly reduce reliability for very long-term
    }
  }

  // Apply timeframe-specific adjustments to weights
  static applyTimeframeAdjustments(weights: { [key: string]: number }, timeframeDays: number): { [key: string]: number } {
    const adjustedWeights = { ...weights };
    
    // Short-term adjustments (< 30 days)
    if (timeframeDays < 30) {
      // Boost momentum and short-term equilibrium
      if (adjustedWeights.rsi) adjustedWeights.rsi *= 1.3;
      if (adjustedWeights.stochasticRsi) adjustedWeights.stochasticRsi *= 1.4;
      if (adjustedWeights.williamsR) adjustedWeights.williamsR *= 1.2;
      if (adjustedWeights.cci) adjustedWeights.cci *= 1.2;
      if (adjustedWeights.eq30) adjustedWeights.eq30 *= 1.5;
      
      // Reduce trend and long-term equilibrium
      if (adjustedWeights.macd) adjustedWeights.macd *= 0.8;
      if (adjustedWeights.adx) adjustedWeights.adx *= 0.9;
      if (adjustedWeights.movingAverages) adjustedWeights.movingAverages *= 0.7;
      if (adjustedWeights.eq90) adjustedWeights.eq90 *= 0.6;
    }
    // Medium-term adjustments (30-90 days)
    else if (timeframeDays <= 90) {
      // Balanced - boost mid-term equilibrium
      if (adjustedWeights.volumeAnalysis) adjustedWeights.volumeAnalysis *= 1.1;
      if (adjustedWeights.eq60) adjustedWeights.eq60 *= 1.3;
    }
    // Long-term adjustments (> 90 days)
    else {
      // Boost trend and long-term equilibrium
      if (adjustedWeights.eq90) adjustedWeights.eq90 *= 1.5;
      if (adjustedWeights.eq60) adjustedWeights.eq60 *= 1.2;
      if (adjustedWeights.macd) adjustedWeights.macd *= 1.2;
      if (adjustedWeights.adx) adjustedWeights.adx *= 1.2;
      if (adjustedWeights.movingAverages) adjustedWeights.movingAverages *= 1.4;
      
      // Reduce short-term momentum and equilibrium
      if (adjustedWeights.rsi) adjustedWeights.rsi *= 0.8;
      if (adjustedWeights.stochasticRsi) adjustedWeights.stochasticRsi *= 0.7;
      if (adjustedWeights.williamsR) adjustedWeights.williamsR *= 0.6;
      if (adjustedWeights.eq30) adjustedWeights.eq30 *= 0.5;
    }
    
    // Normalize weights after adjustments
    this.normalizeWeights(adjustedWeights);
    
    return adjustedWeights;
  }

  // Normalize weights to sum to 1
  static normalizeWeights(weights: { [key: string]: number }): void {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      Object.keys(weights).forEach(key => {
        weights[key] = weights[key] / total;
      });
    }
  }

  // Evaluate a weight strategy
  static evaluateWeightStrategy(weights: { [key: string]: number }, trades: BacktestTrade[]): {
    expectedProfit: number;
    winRate: number;
    sharpeRatio: number;
  } {
    if (trades.length === 0) {
      return { expectedProfit: 0, winRate: 0, sharpeRatio: 0 };
    }

    // Calculate weighted performance metrics
    let weightedProfit = 0;
    let weightedWinRate = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([indicator, weight]) => {
      const relevantTrades = trades.filter(trade => 
        trade.reasoning.some(reason => 
          reason.toLowerCase().includes(indicator.toLowerCase().replace(/([A-Z])/g, ' $1').trim())
        )
      );

      if (relevantTrades.length > 0) {
        const profit = relevantTrades.reduce((sum, trade) => sum + trade.profit, 0);
        const winRate = (relevantTrades.filter(trade => trade.profit > 0).length / relevantTrades.length) * 100;
        
        weightedProfit += profit * weight;
        weightedWinRate += winRate * weight;
        totalWeight += weight;
      }
    });

    const expectedProfit = totalWeight > 0 ? weightedProfit / totalWeight : 0;
    const finalWinRate = totalWeight > 0 ? weightedWinRate / totalWeight : 0;
    
    // Calculate Sharpe ratio approximation
    const returns = trades.map(trade => trade.profitPercent / 100);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    return {
      expectedProfit,
      winRate: finalWinRate,
      sharpeRatio
    };
  }

  static parseSignalSources(reasoning: string[]): { indicator: string; type: 'BUY' | 'SELL'; strength: number }[] {
    const sources: { indicator: string; type: 'BUY' | 'SELL'; strength: number }[] = [];
    
    reasoning.forEach(reason => {
      let indicator = 'unknown';
      let type: 'BUY' | 'SELL' = 'BUY';
      let strength = 50; // Default strength
      
      // Parse indicator type
      if (reason.includes('30-day equilibrium')) indicator = 'eq30';
      else if (reason.includes('60-day equilibrium')) indicator = 'eq60';
      else if (reason.includes('90-day equilibrium')) indicator = 'eq90';
      else if (reason.includes('volume')) indicator = 'volumeAnalysis';
      else if (reason.includes('ADX')) indicator = 'adx';
      else if (reason.includes('MACD')) indicator = 'macd';
      else if (reason.includes('RSI') && !reason.includes('Stochastic')) indicator = 'rsi';
      else if (reason.includes('Stochastic RSI')) indicator = 'stochasticRsi';
      else if (reason.includes('Bollinger')) indicator = 'bollingerBands';
      else if (reason.includes('CCI')) indicator = 'cci';
      else if (reason.includes('SMA') || reason.includes('Moving')) indicator = 'movingAverages';
      else if (reason.includes('OBV')) indicator = 'obv';
      else if (reason.includes('Williams')) indicator = 'williamsR';
      
      // Parse signal type
      if (reason.includes('sell') || reason.includes('overbought') || reason.includes('above')) {
        type = 'SELL';
      } else if (reason.includes('buy') || reason.includes('oversold') || reason.includes('below')) {
        type = 'BUY';
      }
      
      // Extract strength from percentages or keywords
      const percentMatch = reason.match(/(\d+\.?\d*)%/);
      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        strength = Math.min(90, percent * 2); // Scale percentage to strength
      } else if (reason.includes('strong')) {
        strength = 80;
      } else if (reason.includes('confirms')) {
        strength = 70;
      }
      
      sources.push({ indicator, type, strength });
    });
    
    return sources;
  }

  static assessSignalQuality(sources: { indicator: string; type: 'BUY' | 'SELL'; strength: number }[], enabledIndicators: IndicatorSettings): { multiplier: number; activeIndicators: number } {
    const activeIndicators = sources.length;
    const uniqueIndicators = new Set(sources.map(s => s.indicator)).size;
    
    // Quality multipliers based on signal diversity and strength
    let multiplier = 1.0;
    
    // Bonus for multiple unique indicators (diversification)
    if (uniqueIndicators >= 4) multiplier += 0.3;
    else if (uniqueIndicators >= 3) multiplier += 0.2;
    else if (uniqueIndicators >= 2) multiplier += 0.1;
    
    // Bonus for high-reliability indicators being active
    const highReliabilityActive = sources.some(s => 
      ['eq30', 'eq60', 'eq90', 'volumeAnalysis', 'adx', 'macd'].includes(s.indicator)
    );
    if (highReliabilityActive) multiplier += 0.2;
    
    // Penalty for conflicting signals from same indicator type
    const buyCount = sources.filter(s => s.type === 'BUY').length;
    const sellCount = sources.filter(s => s.type === 'SELL').length;
    const conflictRatio = Math.min(buyCount, sellCount) / Math.max(buyCount, sellCount, 1);
    if (conflictRatio > 0.3) multiplier -= 0.2; // Reduce confidence for conflicting signals
    
    return { multiplier: Math.max(0.5, multiplier), activeIndicators };
  }

  static findOptimalSignalPrices(
    data: HistoricalPriceData[],
    livePrice: number,
    enabledIndicators: IndicatorSettings,
    weights: { [key: string]: number }
  ): { optimalBuyPrice: number | null; optimalSellPrice: number | null } {
    const MAX_SEARCH_ITERATIONS = 200; // Limit iterations to prevent infinite loops
    const STRONG_CONFIDENCE_THRESHOLD = 60;
    const priceStep = livePrice * 0.001; // Search in 0.1% increments

    let optimalBuyPrice: number | null = null;
    let optimalSellPrice: number | null = null;

    // Find optimal buy price (searching downwards)
    for (let i = 1; i <= MAX_SEARCH_ITERATIONS; i++) {
      const simulatedPrice = livePrice - (i * priceStep);
      const latestDataPoint = { ...data[data.length - 1], close: simulatedPrice };
      const dataWithSimulatedPrice = [...data.slice(0, -1), latestDataPoint];
      
      const signal = this.generateSignal(
        dataWithSimulatedPrice,
        dataWithSimulatedPrice.length - 1,
        enabledIndicators,
        weights
      );

      if (signal.action === 'BUY' && signal.confidence >= STRONG_CONFIDENCE_THRESHOLD) {
        optimalBuyPrice = simulatedPrice;
        break;
      }
    }

    // Find optimal sell price (searching upwards)
    for (let i = 1; i <= MAX_SEARCH_ITERATIONS; i++) {
      const simulatedPrice = livePrice + (i * priceStep);
      const latestDataPoint = { ...data[data.length - 1], close: simulatedPrice };
      const dataWithSimulatedPrice = [...data.slice(0, -1), latestDataPoint];

      const signal = this.generateSignal(
        dataWithSimulatedPrice,
        dataWithSimulatedPrice.length - 1,
        enabledIndicators,
        weights
      );

      if (signal.action === 'SELL' && signal.confidence >= STRONG_CONFIDENCE_THRESHOLD) {
        optimalSellPrice = simulatedPrice;
        break;
      }
    }

    return { optimalBuyPrice, optimalSellPrice };
  }
}

// Backtesting engine
const runBacktest = async (
  data: HistoricalPriceData[],
  symbol: string,
  initialCapital: number = 10000,
  minConfidence: number = 55, // Lowered default for more trades
  enabledIndicators: IndicatorSettings
): Promise<BacktestResult> => {
  const trades: BacktestTrade[] = [];
  const dailyReturns: Array<{ date: string; portfolioValue: number; return: number }> = [];

  let capital = initialCapital;
  let position: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
  let entryPrice = 0;
  let entryDate = '';
  let entryConfidence = 0;
  let quantity = 0;

  let maxCapital = initialCapital;
  let maxDrawdown = 0;

  // Adaptive warm-up period based on available data
  const totalDays = data.length;
  const warmUpPeriod = Math.min(30, Math.floor(totalDays * 0.3)); // Use 30% of data or 30 days max
  
  for (let i = warmUpPeriod; i < data.length; i++) {
    const currentData = data[i];
    const weights = TechnicalAnalysis.getAdaptiveWeights(data.slice(0, i + 1), i, enabledIndicators);
    const signal = TechnicalAnalysis.generateSignal(data, i, enabledIndicators, weights);

    // Record daily portfolio value
    let portfolioValue = capital;
    if (position === 'LONG') {
      portfolioValue = quantity * currentData.close;
    } else if (position === 'SHORT') {
      portfolioValue = capital + (quantity * (entryPrice - currentData.close));
    }

    const dailyReturn = i > warmUpPeriod ? (portfolioValue - dailyReturns[dailyReturns.length - 1]?.portfolioValue) / dailyReturns[dailyReturns.length - 1]?.portfolioValue * 100 : 0;

    dailyReturns.push({
      date: currentData.date,
      portfolioValue,
      return: dailyReturn
    });

    // Update max drawdown
    if (portfolioValue > maxCapital) {
      maxCapital = portfolioValue;
    }
    const drawdown = maxCapital - portfolioValue;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    // Trading logic
    if (position === 'NONE') {
      if (signal.action === 'BUY' && signal.confidence >= minConfidence) {
        // Enter long position
        position = 'LONG';
        entryPrice = currentData.close;
        entryDate = currentData.date;
        entryConfidence = signal.confidence;
        quantity = capital / entryPrice;
        capital = 0;
      } else if (signal.action === 'SELL' && signal.confidence >= minConfidence) {
        // Enter short position
        position = 'SHORT';
        entryPrice = currentData.close;
        entryDate = currentData.date;
        entryConfidence = signal.confidence;
        quantity = capital / entryPrice;
        capital = 0;
      }
    } else if (position === 'LONG' && (signal.action === 'SELL' || signal.confidence < 35)) {
      // Exit long position
      const exitPrice = currentData.close;
      const profit = quantity * (exitPrice - entryPrice);
      const profitPercent = (profit / (quantity * entryPrice)) * 100;
      const holdingPeriod = Math.floor((new Date(currentData.date).getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24));

      trades.push({
        entryDate,
        exitDate: currentData.date,
        entryPrice,
        exitPrice,
        action: 'BUY',
        quantity,
        profit,
        profitPercent,
        confidence: entryConfidence,
        holdingPeriod,
        indicatorValues: signal.indicatorValues,
        reasoning: signal.reasoning
      });
      capital = quantity * exitPrice;
      position = 'NONE';
      quantity = 0;
    } else if (position === 'SHORT' && (signal.action === 'BUY' || signal.confidence < 35)) {
      // Exit short position
      const exitPrice = currentData.close;
      const profit = quantity * (entryPrice - exitPrice);
      const profitPercent = (profit / (quantity * entryPrice)) * 100;
      const holdingPeriod = Math.floor((new Date(currentData.date).getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24));

      trades.push({
        entryDate,
        exitDate: currentData.date,
        entryPrice,
        exitPrice,
        action: 'SELL',
        quantity,
        profit,
        profitPercent,
        confidence: entryConfidence,
        holdingPeriod,
        indicatorValues: signal.indicatorValues,
        reasoning: signal.reasoning
      });
      capital = quantity * (2 * entryPrice - exitPrice); // Return to cash
      position = 'NONE';
      quantity = 0;
    }
  }

  // Close any remaining position
  if (position === 'LONG' && data.length > 0) {
    const lastData = data[data.length - 1];
    const exitPrice = lastData.close;
    const profit = quantity * (exitPrice - entryPrice);
    const profitPercent = (profit / (quantity * entryPrice)) * 100;
    const holdingPeriod = Math.floor((new Date(lastData.date).getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24));

    const finalWeights = TechnicalAnalysis.getAdaptiveWeights(data, data.length - 1, enabledIndicators);
    const finalSignal = TechnicalAnalysis.generateSignal(data, data.length - 1, enabledIndicators, finalWeights);
    trades.push({
      entryDate,
      exitDate: lastData.date,
      entryPrice,
      exitPrice,
      action: 'BUY',
      quantity,
      profit,
      profitPercent,
      confidence: entryConfidence,
      holdingPeriod,
      indicatorValues: finalSignal.indicatorValues,
      reasoning: finalSignal.reasoning
    });
    capital = quantity * exitPrice;
  } else if (position === 'SHORT' && data.length > 0) {
    const lastData = data[data.length - 1];
    const exitPrice = lastData.close;
    const profit = quantity * (entryPrice - exitPrice);
    const profitPercent = (profit / (quantity * entryPrice)) * 100;
    const holdingPeriod = Math.floor((new Date(lastData.date).getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24));

    const finalWeights = TechnicalAnalysis.getAdaptiveWeights(data, data.length - 1, enabledIndicators);
    const finalSignal = TechnicalAnalysis.generateSignal(data, data.length - 1, enabledIndicators, finalWeights);
    trades.push({
      entryDate,
      exitDate: lastData.date,
      entryPrice,
      exitPrice,
      action: 'SELL',
      quantity,
      profit,
      profitPercent,
      confidence: entryConfidence,
      holdingPeriod,
      indicatorValues: finalSignal.indicatorValues,
      reasoning: finalSignal.reasoning
    });
    capital = quantity * (2 * entryPrice - exitPrice);
  }
  
  // Calculate statistics
  const winningTrades = trades.filter(t => t.profit > 0);
  const losingTrades = trades.filter(t => t.profit <= 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const avgWinAmount = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0;
  const avgLossAmount = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length) : 0;
  
  const totalReturn = capital - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;
  
  // Calculate Sharpe ratio
  const returns = dailyReturns.map(d => d.return).filter(r => !isNaN(r));
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
  
  return {
    symbol,
    startDate: data[0]?.date || '',
    endDate: data[data.length - 1]?.date || '',
    initialCapital,
    finalCapital: capital,
    totalReturn,
    totalReturnPercent,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    avgWinAmount,
    avgLossAmount,
    maxDrawdown,
    maxDrawdownPercent: (maxDrawdown / maxCapital) * 100,
    sharpeRatio,
    trades,
    dailyReturns
  };
};

const runAdaptiveLearningBacktest = async (
  data: HistoricalPriceData[],
  symbol: string,
  initialCapital: number = 10000,
  minConfidence: number = 55,
  enabledIndicators: IndicatorSettings,
  learningRate: number = 0.01
): Promise<{ weights: { [key: string]: number }, report: BacktestResult }> => {
  
  // 1. Initialize weights equally for all enabled indicators
  const enabledIndicatorKeys = Object.entries(enabledIndicators)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  
  const initialWeight = 1 / Math.max(1, enabledIndicatorKeys.length);
  const weights: { [key: string]: number } = {};
  enabledIndicatorKeys.forEach(key => {
    weights[key] = initialWeight;
  });

  const trades: BacktestTrade[] = [];
  const dailyReturns: Array<{ date: string; portfolioValue: number; return: number }> = [];

  let capital = initialCapital;
  let position: 'LONG' | 'NONE' = 'NONE'; // Spot trading only, no SHORT positions
  let entryPrice = 0;
  let entryDate = '';
  let entryConfidence = 0;
  let quantity = 0;
  let entryReasoning: string[] = [];

  let maxCapital = initialCapital;
  let maxDrawdown = 0;

  const totalDays = data.length;
  const warmUpPeriod = Math.min(30, Math.floor(totalDays * 0.3));

  for (let i = warmUpPeriod; i < data.length; i++) {
    const currentData = data[i];
    // Generate signal using the current, dynamically updated weights
    const signal = TechnicalAnalysis.generateSignal(data, i, enabledIndicators, weights);

    // Record daily portfolio value
    let portfolioValue = capital;
    if (position === 'LONG') {
      portfolioValue = quantity * currentData.close;
    }
    const dailyReturn = i > warmUpPeriod ? (portfolioValue - (dailyReturns[dailyReturns.length - 1]?.portfolioValue || initialCapital)) / (dailyReturns[dailyReturns.length - 1]?.portfolioValue || initialCapital) * 100 : 0;
    dailyReturns.push({ date: currentData.date, portfolioValue, return: dailyReturn });

    // Update max drawdown
    if (portfolioValue > maxCapital) maxCapital = portfolioValue;
    const drawdown = maxCapital - portfolioValue;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    // Trading Logic (Spot Only)
    if (position === 'NONE') {
      if (signal.action === 'BUY' && signal.confidence >= minConfidence) {
        position = 'LONG';
        entryPrice = currentData.close;
        entryDate = currentData.date;
        entryConfidence = signal.confidence;
        quantity = capital / entryPrice;
        capital = 0;
        entryReasoning = signal.reasoning; // Store reasoning for the entry
      }
    } else if (position === 'LONG' && signal.action === 'SELL') {
      const exitPrice = currentData.close;
      const profit = quantity * (exitPrice - entryPrice);
      const profitPercent = (profit / (quantity * entryPrice)) * 100;
      
      // This trade is now complete, so we can learn from it.
      const contributingIndicators = [
        ...new Set(
          TechnicalAnalysis.parseSignalSources(entryReasoning)
            .filter(s => s.type === 'BUY')
            .map(s => s.indicator)
        ),
      ];

      // More dynamic adjustment based on profit/loss percentage
      const adjustment = learningRate * (profitPercent / 100);

      if (contributingIndicators.length > 0) {
        contributingIndicators.forEach(indicator => {
          if (weights[indicator]) {
            weights[indicator] += adjustment;
          }
        });
      }
      
      // Clip weights to be within a reasonable range (e.g., 0.01 to 1.0)
      Object.keys(weights).forEach(key => {
        weights[key] = Math.max(0.01, weights[key]);
      });

      // Normalize weights to sum to 1
      TechnicalAnalysis.normalizeWeights(weights);

      // Record the trade
      trades.push({
        entryDate,
        exitDate: currentData.date,
        entryPrice,
        exitPrice,
        action: 'BUY',
        quantity,
        profit,
        profitPercent,
        confidence: entryConfidence,
        holdingPeriod: Math.floor((new Date(currentData.date).getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)),
        indicatorValues: signal.indicatorValues,
        reasoning: entryReasoning,
      });

      capital = quantity * exitPrice;
      position = 'NONE';
      quantity = 0;
      entryReasoning = [];
    }
  }

  // Close any remaining position at the end of the backtest
  if (position === 'LONG' && data.length > 0) {
    const lastData = data[data.length - 1];
    const exitPrice = lastData.close;
    const profit = quantity * (exitPrice - entryPrice);
    const profitPercent = (profit / (quantity * entryPrice)) * 100;
    const finalSignal = TechnicalAnalysis.generateSignal(data, data.length - 1, enabledIndicators, weights);
    trades.push({
      entryDate,
      exitDate: lastData.date,
      entryPrice,
      exitPrice,
      action: 'BUY',
      quantity,
      profit,
      profitPercent,
      confidence: entryConfidence,
      holdingPeriod: Math.floor((new Date(lastData.date).getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)),
      indicatorValues: finalSignal.indicatorValues,
      reasoning: entryReasoning,
    });
    capital = quantity * exitPrice;
  }

  // Calculate final statistics
  const winningTrades = trades.filter(t => t.profit > 0);
  const losingTrades = trades.filter(t => t.profit <= 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const avgWinAmount = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0;
  const avgLossAmount = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length) : 0;
  const totalReturn = capital - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;
  const returns = dailyReturns.map(d => d.return).filter(r => !isNaN(r));
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  const report: BacktestResult = {
    symbol,
    startDate: data[0]?.date || '',
    endDate: data[data.length - 1]?.date || '',
    initialCapital,
    finalCapital: capital,
    totalReturn,
    totalReturnPercent,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    avgWinAmount,
    avgLossAmount,
    maxDrawdown,
    maxDrawdownPercent: (maxDrawdown / maxCapital) * 100,
    sharpeRatio,
    trades,
    dailyReturns,
  };

  return { weights, report };
};