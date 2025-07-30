import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, TrendingUp, TrendingDown, HelpCircle, AlertCircle, RefreshCw, Target } from "lucide-react";
import WeightConfigManager from '../utils/weightConfig';
import { TechnicalAnalysis, IndicatorSettings } from './HistoricalBacktester';
import CryptoApiService, { HistoricalPriceData } from '@/services/cryptoApi';
import { useRealTimePrice } from '@/hooks/useRealTimePrice';

const ALL_INDICATORS: IndicatorSettings = {
  rsi: true, macd: true, bollingerBands: true, movingAverages: true,
  stochasticRsi: true, williamsR: true, cci: true, adx: true, obv: true,
  volumeAnalysis: true, equilibriumAnalysis: true,
};

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];

interface Signal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string[];
  optimalBuyPrice: number | null;
  optimalSellPrice: number | null;
}

const SignalCard: React.FC<{ symbol: string }> = ({ symbol }) => {
  const { price: livePrice, isLoading: priceLoading } = useRealTimePrice(symbol);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateSignal = async () => {
      if (!livePrice) return;
      setIsLoading(true);
      try {
        const data = await CryptoApiService.getHistoricalData(symbol, 90);

        if (data.length > 0) {
          const weights = WeightConfigManager.getCurrentWeights(symbol);
          
          const latestDataPoint = { ...data[data.length - 1], close: livePrice };
          const dataWithLivePrice = [...data.slice(0, -1), latestDataPoint];

          const signalResult = TechnicalAnalysis.generateSignal(
            dataWithLivePrice,
            dataWithLivePrice.length - 1,
            ALL_INDICATORS,
            weights
          );

          const { optimalBuyPrice, optimalSellPrice } = TechnicalAnalysis.findOptimalSignalPrices(
            data,
            livePrice,
            ALL_INDICATORS,
            weights
          );
          
          setSignal({
            symbol,
            action: signalResult.action,
            confidence: signalResult.confidence,
            reasoning: signalResult.reasoning,
            optimalBuyPrice,
            optimalSellPrice,
          });
        }
      } catch (e) {
        console.error(`Failed to generate signal for ${symbol}`, e);
      } finally {
        setIsLoading(false);
      }
    };

    generateSignal();
  }, [symbol, livePrice]);

  const getSignalBadge = (action: 'BUY' | 'SELL' | 'HOLD') => {
    switch (action) {
      case 'BUY':
        return <Badge className="bg-green-600 hover:bg-green-700"><TrendingUp className="w-4 h-4 mr-1" />BUY</Badge>;
      case 'SELL':
        return <Badge variant="destructive"><TrendingDown className="w-4 h-4 mr-1" />SELL</Badge>;
      default:
        return <Badge variant="secondary"><HelpCircle className="w-4 h-4 mr-1" />HOLD</Badge>;
    }
  };

  if (isLoading || priceLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-1/2 mb-4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{symbol}</span>
          {signal && getSignalBadge(signal.action)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Live Price</p>
          <p className="text-2xl font-bold flex items-center">
            ${livePrice.toFixed(2)}
            <RefreshCw className="w-4 h-4 ml-2 text-gray-400 animate-spin" style={{ animationDuration: '10s' }}/>
          </p>
        </div>
        {signal && (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Target className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Optimal Entry</p>
                  <p className="font-bold">{signal.optimalBuyPrice ? `$${signal.optimalBuyPrice.toFixed(2)}` : 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Target className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Optimal Exit</p>
                  <p className="font-bold">{signal.optimalSellPrice ? `$${signal.optimalSellPrice.toFixed(2)}` : 'N/A'}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confidence</p>
              <div className="flex items-center gap-2">
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full ${signal.action === 'BUY' ? 'bg-green-600' : signal.action === 'SELL' ? 'bg-red-600' : 'bg-gray-400'}`} 
                    style={{ width: `${signal.confidence}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold">{signal.confidence.toFixed(1)}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Key Drivers</p>
              <div className="space-y-1 text-xs">
                {signal.reasoning.slice(-3).map((reason, i) => (
                  <Badge key={i} variant="outline" className="mr-1 mb-1">{reason}</Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};


export const SignalRecommendation: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Lightbulb className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Real-Time Signal Recommendations</h1>
          <p className="text-muted-foreground">
            Live trading signals and optimal price targets. Data refreshes every 10 minutes.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SYMBOLS.map(symbol => (
          <SignalCard key={symbol} symbol={symbol} />
        ))}
      </div>

      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertTitle>How It Works</AlertTitle>
        <AlertDescription>
          Optimal prices are the calculated points where a strong buy or sell signal would trigger based on your current weight configurations. 
          'N/A' means no strong signal opportunity was found within a 20% price range.
        </AlertDescription>
      </Alert>
    </div>
  );
};
