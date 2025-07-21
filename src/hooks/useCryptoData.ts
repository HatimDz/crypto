import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface PriceData {
  date: string;
  price: number;
  timestamp: number;
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
}

type BinanceKlineResponse = [
  number, // Open time
  string, // Open price
  string, // High price
  string, // Low price
  string, // Close price
  string, // Volume
  number, // Close time
  string, // Quote asset volume
  number, // Number of trades
  string, // Taker buy base asset volume
  string, // Taker buy quote asset volume
  string  // Ignore
][];

interface UseCryptoDataReturn {
  data: PriceData[];
  currentPrice: number;
  isLoading: boolean;
  error: string | null;
}

// Cache management
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const getCacheKey = (cryptoId: string) => `crypto_data_${cryptoId}`;

interface CacheData {
  data: PriceData[];
  currentPrice: number;
  timestamp: number;
}

const isCacheValid = (cacheData: CacheData): boolean => {
  return Date.now() - cacheData.timestamp < CACHE_DURATION;
};

export const useCryptoData = (cryptoId: string): UseCryptoDataReturn => {
  const [data, setData] = useState<PriceData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cryptoId) return;

    const fetchCryptoData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check cache first
        const cacheKey = getCacheKey(cryptoId);
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
          const parsed: CacheData = JSON.parse(cachedData);
          if (isCacheValid(parsed)) {
            setData(parsed.data);
            setCurrentPrice(parsed.currentPrice);
            setIsLoading(false);
            toast({
              title: "Data loaded from cache",
              description: "Using cached data to reduce API calls",
            });
            return;
          }
        }

        // Fetch fresh data from Binance API
        const binanceSymbol = `${cryptoId.toUpperCase()}USDT`;
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=90`
        );

        if (!response.ok) {
          throw new Error(`Binance API request failed: ${response.status}`);
        }

        const apiData: BinanceKlineResponse = await response.json();
        
        // Transform Binance data to our format
        const transformedData: PriceData[] = apiData.map(([
          openTime, open, high, low, close, volume
        ]) => ({
          date: new Date(openTime).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }),
          price: parseFloat(close),
          timestamp: openTime,
          high: parseFloat(high),
          low: parseFloat(low),
          open: parseFloat(open),
          close: parseFloat(close),
          volume: parseFloat(volume),
        }));

        const latestPrice = transformedData[transformedData.length - 1]?.price || 0;

        // Cache the data
        const cacheData: CacheData = {
          data: transformedData,
          currentPrice: latestPrice,
          timestamp: Date.now(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));

        setData(transformedData);
        setCurrentPrice(latestPrice);
        
        toast({
          title: "Data updated successfully",
          description: `Loaded 90-day price data for ${cryptoId}`,
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch crypto data';
        setError(errorMessage);
        toast({
          title: "Error loading data",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCryptoData();
  }, [cryptoId]);

  return { data, currentPrice, isLoading, error };
};