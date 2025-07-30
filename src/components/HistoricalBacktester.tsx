import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, AlertTriangle, Check, X, Download, Upload, History, BrainCircuit } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import WeightConfigManager, { WeightConfiguration } from '../utils/weightConfig';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { fetchHistoricalData, TechnicalAnalysis, HistoricalPriceData, IndicatorSettings, BacktestResult, BacktestTrade, IndicatorSnapshot, WeightOptimizationResult } from '@/lib/TechnicalAnalysis';

const runAdaptiveLearningBacktest = async (
  data: HistoricalPriceData[],
  symbol: string,
  initialCapital: number = 10000,
  minConfidence: number = 55,
  enabledIndicators: IndicatorSettings,
  learningRate: number = 0.01
): Promise<{ weights: { [key: string]: number }, report: BacktestResult }> => {
  
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
  let position: 'LONG' | 'NONE' = 'NONE';
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
    const signal = TechnicalAnalysis.generateSignal(data.slice(0, i + 1), i, enabledIndicators, weights);

    let portfolioValue = capital;
    if (position === 'LONG') {
      portfolioValue = quantity * currentData.close;
    }
    const dailyReturn = i > warmUpPeriod ? (portfolioValue - (dailyReturns[dailyReturns.length - 1]?.portfolioValue || initialCapital)) / (dailyReturns[dailyReturns.length - 1]?.portfolioValue || initialCapital) * 100 : 0;
    dailyReturns.push({ date: currentData.date, portfolioValue, return: dailyReturn });

    if (portfolioValue > maxCapital) maxCapital = portfolioValue;
    const drawdown = maxCapital - portfolioValue;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    // Defines clear buy and sell prices based on features, as requested.
    const { optimalBuyPrice, optimalSellPrice } = TechnicalAnalysis.findOptimalSignalPrices(
      data.slice(0, i + 1),
      currentData.close,
      enabledIndicators,
      weights
    );

    if (position === 'NONE') {
      if (signal.action === 'BUY' && signal.confidence >= minConfidence) {
        const buyPrice = optimalBuyPrice !== null && currentData.close <= optimalBuyPrice * 1.005 ? optimalBuyPrice : currentData.close;
        position = 'LONG';
            entryPrice = buyPrice;
            entryDate = currentData.date;
            entryConfidence = signal.confidence;
            quantity = capital / entryPrice;
            capital = 0;
            entryReasoning = signal.reasoning;
      }
    }
    else if (position === 'LONG' && signal.action === 'SELL') {
      const sellPrice = optimalSellPrice !== null && currentData.close >= optimalSellPrice * 0.995 ? optimalSellPrice : currentData.close;
      const exitPrice = sellPrice;
        const profit = quantity * (exitPrice - entryPrice);
        const profitPercent = (profit / (quantity * entryPrice)) * 100;
        
        const contributingIndicators = [
          ...new Set(
            TechnicalAnalysis.parseSignalSources(entryReasoning)
              .filter(s => s.type === 'BUY')
              .map(s => s.indicator)
          ),
        ];

        const adjustment = learningRate * (profitPercent / 100);

        if (contributingIndicators.length > 0) {
          contributingIndicators.forEach(indicator => {
            if (weights[indicator]) {
              weights[indicator] += adjustment;
            }
          });
        }
        
        Object.keys(weights).forEach(key => {
          weights[key] = Math.max(0.01, weights[key]);
        });

        // The total probability of the weights is normalized to 1.
        TechnicalAnalysis.normalizeWeights(weights);

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

export const HistoricalBacktester: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2024-01-01');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [minConfidence, setMinConfidence] = useState(55);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [adaptiveLearningResult, setAdaptiveLearningResult] = useState<{ weights: { [key: string]: number }, report: BacktestResult } | null>(null);
  const [indicators, setIndicators] = useState<IndicatorSettings>({
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
    eq30: true,
    eq60: true,
    eq90: true,
  });
  const [showWeightActions, setShowWeightActions] = useState(false);
  const [configName, setConfigName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState<WeightConfiguration[]>([]);

  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];

  useEffect(() => {
    setSavedConfigs(WeightConfigManager.getAllConfigurations(selectedSymbol));
    (window as Window & typeof globalThis & { WeightConfigManager: typeof WeightConfigManager }).WeightConfigManager = WeightConfigManager;
    (window as Window & typeof globalThis & { currentSymbol: string }).currentSymbol = selectedSymbol;
    const activeConfig = WeightConfigManager.getActiveConfiguration(selectedSymbol);
    if (activeConfig) {
      console.log(`Active configuration for ${selectedSymbol}:`, activeConfig.name);
    } else {
      console.log(`Using default weights for ${selectedSymbol}`);
    }
  }, [selectedSymbol]);

  const handleRunAdaptiveBacktest = async () => {
    setLoading(true);
    setIsLearning(true);
    setError(null);
    setResult(null);
    setAdaptiveLearningResult(null);

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 31) {
        throw new Error('Please select a date range of at least 31 days for a meaningful backtest.');
      }

      const data = await fetchHistoricalData(selectedSymbol, start, end);
      if (data.length === 0) {
        throw new Error('No historical data fetched for the selected period.');
      }
      
      const { weights, report } = await runAdaptiveLearningBacktest(data, selectedSymbol, initialCapital, 50, indicators, 0.05);
      setAdaptiveLearningResult({ weights, report });
      setResult(report);

      const timeframeDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      const defaultName = `${selectedSymbol}_${timeframeDays}d_adaptive_${new Date().toISOString().split('T')[0]}`;
      setConfigName(defaultName);
      setShowWeightActions(true);

    } catch (err) {
      console.error('Adaptive backtest failed:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during the adaptive backtest.');
      }
    } finally {
      setLoading(false);
      setIsLearning(false);
    }
  };

  const handleConfirmWeights = () => {
    if (adaptiveLearningResult) {
      const { weights, report } = adaptiveLearningResult;
      const enabledIndicatorsList = Object.entries(indicators)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
      
      const config = WeightConfigManager.createConfiguration(
        configName || `Config_${Date.now()}`,
        'adaptive',
        weights,
        {
          expectedProfit: report.totalReturn,
          winRate: report.winRate,
          sharpeRatio: report.sharpeRatio,
          totalTrades: report.trades.length
        },
        {
          days: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)),
          startDate,
          endDate
        },
        enabledIndicatorsList,
        selectedSymbol
      );
      
      WeightConfigManager.saveConfiguration(config);
      WeightConfigManager.confirmConfiguration(config.id);
      setSavedConfigs(WeightConfigManager.getAllConfigurations(selectedSymbol));
      setShowWeightActions(false);
      
      alert(`Adaptive weight configuration "${configName}" has been confirmed and is now active!`);
    }
  };
  
  const handleResetWeights = () => {
    WeightConfigManager.resetToDefault(selectedSymbol);
    setAdaptiveLearningResult(null);
    setShowWeightActions(false);
    setConfigName('');
    setSavedConfigs(WeightConfigManager.getAllConfigurations(selectedSymbol));
    
    alert(`Weights for ${selectedSymbol} have been reset to default values!`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Historical Backtesting</h1>
        <Badge variant="outline" className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Profit Analysis
        </Badge>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Backtest Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Symbol</label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {symbols.map(symbol => (
                  <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Initial Capital ($)</label>
            <Input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Min Confidence (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
            />
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-3 block">Technical Indicators</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.keys(indicators).map((key) => {
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  return (
                    <div className="flex items-center space-x-2" key={key}>
                        <Checkbox 
                            id={key}
                            checked={indicators[key as keyof IndicatorSettings]}
                            onCheckedChange={(checked) => setIndicators(prev => ({ ...prev, [key]: !!checked }))}
                        />
                        <Label htmlFor={key} className="text-xs">{label}</Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-4">
          <Button 
            onClick={handleRunAdaptiveBacktest}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading && isLearning ? (
              <>
                <BrainCircuit className="w-4 h-4 mr-2 animate-spin" />
                Learning...
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4 mr-2" />
                Run Adaptive Backtest
              </>
            )}
          </Button>
        </div>
      </Card>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {adaptiveLearningResult && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Adaptive Learning Result</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Learned Weights</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicator</TableHead>
                    <TableHead>Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(adaptiveLearningResult.weights)
                    .sort(([, a], [, b]) => b - a)
                    .map(([indicator, weight]) => (
                    <TableRow key={indicator}>
                      <TableCell>{indicator.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</TableCell>
                      <TableCell>{weight.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Performance</h3>
              <div className="space-y-2">
                <div className="flex justify-between"><span>Total Return:</span> <span className={adaptiveLearningResult.report.totalReturn > 0 ? 'text-green-500' : 'text-red-500'}>{adaptiveLearningResult.report.totalReturn.toFixed(2)} ({adaptiveLearningResult.report.totalReturnPercent.toFixed(2)}%)</span></div>
                <div className="flex justify-between"><span>Win Rate:</span> <span>{adaptiveLearningResult.report.winRate.toFixed(2)}%</span></div>
                <div className="flex justify-between"><span>Sharpe Ratio:</span> <span>{adaptiveLearningResult.report.sharpeRatio.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Total Trades:</span> <span>{adaptiveLearningResult.report.totalTrades}</span></div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Backtest Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Return</p>
              <p className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {result.totalReturn.toFixed(2)} ({result.totalReturnPercent.toFixed(2)}%)
              </p>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold">{result.winRate.toFixed(2)}%</p>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
              <p className="text-2xl font-bold">{result.sharpeRatio.toFixed(2)}</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry Date</TableHead>
                <TableHead>Exit Date</TableHead>
                <TableHead>Entry Price</TableHead>
                <TableHead>Exit Price</TableHead>
                <TableHead>Profit (%)</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.trades.map((trade, index) => (
                <TableRow key={index}>
                  <TableCell>{trade.entryDate}</TableCell>
                  <TableCell>{trade.exitDate}</TableCell>
                  <TableCell>{trade.entryPrice.toFixed(2)}</TableCell>
                  <TableCell>{trade.exitPrice.toFixed(2)}</TableCell>
                  <TableCell className={trade.profit >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {trade.profit.toFixed(2)} ({trade.profitPercent.toFixed(2)}%)
                  </TableCell>
                  <TableCell>{trade.confidence.toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {showWeightActions && (
        <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Confirm Weights</h2>
            <div className="flex gap-4">
                <Input 
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    placeholder="Enter configuration name"
                />
                <Button onClick={handleConfirmWeights}>Confirm and Save Weights</Button>
                <Button onClick={handleResetWeights} variant="destructive">Reset to Default</Button>
            </div>
        </Card>
      )}
    </div>
  );
};