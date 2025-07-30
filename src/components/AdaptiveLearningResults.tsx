import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Save, 
  RotateCcw, 
  Download,
  Target,
  Activity,
  BarChart3,
  Play
} from "lucide-react";
import WeightConfigManager from '../utils/weightConfig';
import AdaptiveWeightLearner from '../utils/adaptiveWeights';

interface AdaptiveLearningResultsProps {
  symbol: string;
  finalWeights?: { [indicator: string]: number };
  learningStats?: {
    totalTrades: number;
    topPerformers: Array<{ indicator: string; reliability: number; winRate: number; avgProfit: number }>;
    worstPerformers: Array<{ indicator: string; reliability: number; winRate: number; avgProfit: number }>;
    learningProgress: number;
  };
  backtestResult?: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    totalTrades: number;
    timeframe: string;
    days?: number;
  };
  enabledIndicators: string[];
  onWeightsSaved?: () => void;
  onReset?: () => void;
}

const INDICATOR_DISPLAY_NAMES: { [key: string]: string } = {
  rsi: 'RSI',
  macd: 'MACD',
  bollingerBands: 'Bollinger Bands',
  stochasticRsi: 'Stochastic RSI',
  adx: 'ADX',
  volumeAnalysis: 'Volume Analysis',
  equilibrium30: 'Equilibrium 30d',
  equilibrium60: 'Equilibrium 60d',
  equilibrium90: 'Equilibrium 90d',
  movingAverages: 'Moving Averages',
  cci: 'CCI',
  williamsR: 'Williams %R',
  obv: 'OBV'
};

const INDICATOR_ICONS: { [key: string]: React.ReactNode } = {
  rsi: <Activity className="w-4 h-4" />,
  macd: <TrendingUp className="w-4 h-4" />,
  bollingerBands: <BarChart3 className="w-4 h-4" />,
  stochasticRsi: <Target className="w-4 h-4" />,
  adx: <TrendingDown className="w-4 h-4" />,
  volumeAnalysis: <BarChart3 className="w-4 h-4" />,
  equilibrium30: <Activity className="w-4 h-4" />,
  equilibrium60: <Activity className="w-4 h-4" />,
  equilibrium90: <Activity className="w-4 h-4" />,
  movingAverages: <TrendingUp className="w-4 h-4" />,
  cci: <Target className="w-4 h-4" />,
  williamsR: <TrendingDown className="w-4 h-4" />,
  obv: <BarChart3 className="w-4 h-4" />
};

export const AdaptiveLearningResults: React.FC<AdaptiveLearningResultsProps> = ({
  symbol,
  finalWeights,
  learningStats,
  backtestResult,
  enabledIndicators,
  onWeightsSaved,
  onReset
}) => {
  const [configName, setConfigName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!finalWeights || !learningStats) {
    return null;
  }

  const handleSaveWeights = async () => {
    if (!configName.trim()) {
      alert('Please enter a configuration name');
      return;
    }

    setIsSaving(true);
    try {
      const config = WeightConfigManager.createConfiguration(
        configName,
        'adaptive-learning',
        finalWeights,
        {
          expectedProfit: backtestResult?.totalReturn || 0,
          winRate: backtestResult?.winRate || 0,
          sharpeRatio: backtestResult?.sharpeRatio || 0,
          totalTrades: backtestResult?.totalTrades || 0
        },
        {
          days: backtestResult?.days || 30,
          startDate: new Date(Date.now() - (backtestResult?.days || 30) * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        enabledIndicators,
        symbol
      );

      WeightConfigManager.saveConfiguration(config);
      WeightConfigManager.confirmConfiguration(config.id);
      
      if (onWeightsSaved) {
        onWeightsSaved();
      }
      
      setConfigName('');
      alert('Adaptive weights saved successfully!');
    } catch (error) {
      console.error('Failed to save weights:', error);
      alert('Failed to save weights. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the adaptive learning? This will clear all learned weights.')) {
      AdaptiveWeightLearner.resetLearning(symbol);
      if (onReset) {
        onReset();
      }
    }
  };

  const handleApplyWeights = () => {
    if (!finalWeights) {
      alert('No learned weights available to apply.');
      return;
    }

    try {
      // Create a temporary configuration with current learned weights
      const tempConfig = WeightConfigManager.createConfiguration(
        `Adaptive_${symbol}_${new Date().toISOString().split('T')[0]}`,
        'adaptive-learning-applied',
        finalWeights,
        {
          expectedProfit: backtestResult?.totalReturn || 0,
          winRate: backtestResult?.winRate || 0,
          sharpeRatio: backtestResult?.sharpeRatio || 0,
          totalTrades: backtestResult?.totalTrades || 0
        },
        {
          days: backtestResult?.days || 30,
          startDate: new Date(Date.now() - (backtestResult?.days || 30) * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        enabledIndicators,
        symbol
      );

      // Save and immediately confirm the configuration
      WeightConfigManager.saveConfiguration(tempConfig);
      WeightConfigManager.confirmConfiguration(tempConfig.id);
      
      // Make weights available globally for immediate use
      (window as Window & typeof globalThis & { currentSymbol: string }).currentSymbol = symbol;
      (window as Window & typeof globalThis & { WeightConfigManager: typeof WeightConfigManager }).WeightConfigManager = WeightConfigManager;
      
      alert(`✅ Learned weights applied successfully for ${symbol}!\n\nThese weights will now be used for all future trading decisions until you change them.`);
      
      if (onWeightsSaved) {
        onWeightsSaved();
      }
    } catch (error) {
      console.error('Failed to apply weights:', error);
      alert('Failed to apply weights. Please try again.');
    }
  };

  const handleExportLearningData = () => {
    const learningData = AdaptiveWeightLearner.exportLearningData(symbol, enabledIndicators);
    const blob = new Blob([learningData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `adaptive_learning_${symbol}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const generateDefaultName = () => {
    const date = new Date().toISOString().split('T')[0];
    const performance = backtestResult?.totalReturn ? 
      (backtestResult.totalReturn > 0 ? 'profitable' : 'loss') : 'test';
    return `${symbol}_adaptive_${performance}_${date}`;
  };

  const sortedWeights = Object.entries(finalWeights)
    .sort(([,a], [,b]) => b - a);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-foreground">Adaptive Learning Results</h3>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            {learningStats.totalTrades} Trades Learned
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              ${backtestResult?.totalReturn?.toFixed(2) || 0}
            </div>
            <div className="text-sm text-muted-foreground">Total Return</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {backtestResult?.winRate?.toFixed(1) || 0}%
            </div>
            <div className="text-sm text-muted-foreground">Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {(learningStats.learningProgress || 0).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Learning Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              {backtestResult?.sharpeRatio?.toFixed(2) || 0}
            </div>
            <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
          </div>
        </div>
      </Card>

      {/* Final Weights Distribution */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Final Learned Weights
        </h4>
        
        <div className="space-y-3">
          {sortedWeights.map(([indicator, weight]) => (
            <div key={indicator} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {INDICATOR_ICONS[indicator]}
                  <span className="font-medium">
                    {INDICATOR_DISPLAY_NAMES[indicator] || indicator}
                  </span>
                </div>
                <span className="text-sm font-mono">
                  {(weight * 100).toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={weight * 100} 
                className="h-2"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Top and Worst Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card className="p-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-green-400">
            <TrendingUp className="w-5 h-5" />
            Top Performers
          </h4>
          
          <div className="space-y-3">
            {learningStats.topPerformers && learningStats.topPerformers.length > 0 ? (
              learningStats.topPerformers.map((performer, index) => (
                <div key={performer.indicator} className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      #{index + 1}
                    </Badge>
                    <span className="font-medium">
                      {INDICATOR_DISPLAY_NAMES[performer.indicator] || performer.indicator}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-green-400 font-medium">
                      {(performer.reliability * 100).toFixed(1)}% reliability
                    </div>
                    <div className="text-muted-foreground">
                      {performer.winRate.toFixed(1)}% win rate
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No performance data available yet. More trades needed for analysis.
              </div>
            )}
          </div>
        </Card>

        {/* Worst Performers */}
        <Card className="p-6">
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-400">
            <TrendingDown className="w-5 h-5" />
            Needs Improvement
          </h4>
          
          <div className="space-y-3">
            {learningStats.worstPerformers && learningStats.worstPerformers.length > 0 ? (
              learningStats.worstPerformers.map((performer, index) => (
                <div key={performer.indicator} className="flex justify-between items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      #{learningStats.worstPerformers.length - index}
                    </Badge>
                    <span className="font-medium">
                      {INDICATOR_DISPLAY_NAMES[performer.indicator] || performer.indicator}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-red-400 font-medium">
                      {(performer.reliability * 100).toFixed(1)}% reliability
                    </div>
                    <div className="text-muted-foreground">
                      {performer.winRate.toFixed(1)}% win rate
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No performance data available yet. More trades needed for analysis.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Actions */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold mb-4">Save Learned Weights</h4>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Configuration name (e.g., BTC_adaptive_profitable_2025-01-22)"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => setConfigName(generateDefaultName())}
            >
              Auto-Generate
            </Button>
          </div>
          
          <div className="flex gap-2 mb-3">
            <Button
              onClick={handleApplyWeights}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Apply Learned Weights Now
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleSaveWeights}
              disabled={isSaving || !configName.trim()}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save & Use These Weights'}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleExportLearningData}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            
            <Button
              variant="outline"
              onClick={handleReset}
              className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Learning
            </Button>
          </div>
        </div>
        
        <div className="mt-4 space-y-3">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-400">
              <strong>🚀 Quick Apply:</strong> Click "Apply Learned Weights Now" to immediately use these optimized weights 
              for all future trading decisions with {symbol}. This is the fastest way to put your learned insights into action!
            </p>
          </div>
          
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>💾 Save for Later:</strong> Use "Save & Use These Weights" to create a named configuration that you can 
              reference, export, or reuse later. The system learned from {learningStats?.totalTrades || 0} trades to optimize these weights.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdaptiveLearningResults;

