import { useEffect, useState } from 'react';
import { TechnicalAnalysis } from './HistoricalBacktester';
import WeightConfigManager from '../utils/weightConfig';

// --- Data Types ---

export interface LiveSignal {
  symbol: string;
  timestamp: number;
  price: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string[];
  indicatorValues: Record<string, unknown>;
}

export interface MoneyFlow {
  symbol: string;
  inflow: number;
  outflow: number;
  netFlow: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

// --- Service Logic ---

const TradingSignalService = {
  async getLiveSignal(symbol: string): Promise<LiveSignal> {
    // Fetch real-time data (mocked for now)
    const price = await this.fetchRealTimePrice(symbol);
    const data = this.getRecentData(symbol, price);

    // Get learned weights
    const weights = WeightConfigManager.getCurrentWeights(symbol);

    // Generate signal
    const signal = TechnicalAnalysis.generateSignal(data, data.length - 1, this.getEnabledIndicators(weights));

    return {
      symbol,
      timestamp: Date.now(),
      price,
      ...signal
    };
  },

  async getMoneyFlow(symbol: string): Promise<MoneyFlow> {
    // Fetch order book data (mocked for now)
    const orderBook = await this.fetchOrderBook(symbol);

    const inflow = orderBook.bids.reduce((acc, [price, size]) => acc + (price * size), 0);
    const outflow = orderBook.asks.reduce((acc, [price, size]) => acc + (price * size), 0);
    const netFlow = inflow - outflow;

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (netFlow > 0) sentiment = 'BULLISH';
    if (netFlow < 0) sentiment = 'BEARISH';

    return { symbol, inflow, outflow, netFlow, sentiment };
  },

  // --- Mock Data Fetchers ---

  async fetchRealTimePrice(symbol: string): Promise<number> {
    // In a real app, you'd use a WebSocket or API for this
    return Math.random() * 10000; // Mock price
  },

  async fetchOrderBook(symbol: string): Promise<{ bids: [number, number][], asks: [number, number][] }> {
    // Mock order book data
    return {
      bids: [[Math.random() * 100, Math.random() * 10]],
      asks: [[Math.random() * 100, Math.random() * 10]]
    };
  },

  // --- Helper Functions ---

  getRecentData(symbol: string, currentPrice: number): { close: number; volume: number }[] {
    // Create a mock history for signal generation
    const data = [];
    for (let i = 0; i < 100; i++) {
      data.push({ 
        close: currentPrice * (1 + (Math.random() - 0.5) * 0.1),
        volume: Math.random() * 1000
      });
    }
    return data;
  },

  getEnabledIndicators(weights: { [key: string]: number }): Record<string, boolean> {
    const indicators: { [key: string]: boolean } = {};
    for (const key in weights) {
      indicators[key] = true;
    }
    return indicators;
  }
};

// --- React Hook ---

export const useTradingSignals = (symbol: string) => {
  const [signal, setSignal] = useState<LiveSignal | null>(null);
  const [moneyFlow, setMoneyFlow] = useState<MoneyFlow | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const newSignal = await TradingSignalService.getLiveSignal(symbol);
      const newMoneyFlow = await TradingSignalService.getMoneyFlow(symbol);
      setSignal(newSignal);
      setMoneyFlow(newMoneyFlow);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [symbol]);

  return { signal, moneyFlow };
};

export default TradingSignalService;
