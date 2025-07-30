import { useState, useEffect, useCallback } from 'react';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export const useRealTimePrice = (symbol: string) => {
  const [price, setPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!symbol) return;
    setIsLoading(true);
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }
      const data = await response.json();
      setPrice(parseFloat(data.price));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch real-time price');
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchPrice(); // Fetch immediately on mount
    const intervalId = setInterval(fetchPrice, REFRESH_INTERVAL); // Refresh periodically

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [fetchPrice]);

  return { price, isLoading, error };
};
