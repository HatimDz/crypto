import { useState, useEffect } from 'react';
import { TechnicalAnalysis, fetchHistoricalData, IndicatorSettings } from '@/lib/TechnicalAnalysis';

export const useSignalData = (symbol: string, indicators: IndicatorSettings) => {
  const [signal, setSignal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getSignal = async () => {
      setLoading(true);
      setError(null);

      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 90); // Use 90 days of data for the signal

        const data = await fetchHistoricalData(symbol, startDate, endDate);
        if (data.length === 0) {
          throw new Error('No historical data available to generate a signal.');
        }

        const weights = TechnicalAnalysis.getOptimizedIndicatorWeights(indicators);
        const currentSignal = TechnicalAnalysis.generateSignal(data, data.length - 1, indicators, weights);
        
        const livePrice = data[data.length - 1].close;
        const { optimalBuyPrice, optimalSellPrice } = TechnicalAnalysis.findOptimalSignalPrices(data, livePrice, indicators, weights);

        const expectedProfit = optimalBuyPrice && optimalSellPrice ? ((optimalSellPrice - optimalBuyPrice) / optimalBuyPrice) * 100 : 0;

        setSignal({
          ...currentSignal,
          optimalBuyPrice,
          optimalSellPrice,
          expectedProfit,
        });
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred while generating the signal.');
      } finally {
        setLoading(false);
      }
    };

    getSignal();
  }, [symbol, indicators]);

  return { signal, loading, error };
};
