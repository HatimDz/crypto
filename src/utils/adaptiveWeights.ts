// Adaptive Weight Learning System
// Dynamically adjusts indicator weights based on individual trade outcomes

export interface TradeOutcome {
  tradeId: string;
  date: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercentage: number;
  isWinning: boolean;
  indicatorSignals: { [indicator: string]: number }; // Signal strength that led to this trade
  indicatorContributions: { [indicator: string]: number }; // How much each indicator contributed to the decision
}

export interface AdaptiveWeights {
  [indicator: string]: number;
}

export interface IndicatorPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  averageProfit: number;
  winRate: number;
  reliability: number; // Weighted score based on performance
  recentPerformance: number[]; // Last 10 trade outcomes for this indicator
}

export interface AdaptiveLearningState {
  currentWeights: AdaptiveWeights;
  indicatorPerformance: { [indicator: string]: IndicatorPerformance };
  tradeHistory: TradeOutcome[];
  learningRate: number;
  totalTrades: number;
  startDate: string;
  lastUpdated: string;
}

export class AdaptiveWeightLearner {
  private static readonly STORAGE_KEY = 'adaptive_weight_learning';
  private static readonly DEFAULT_LEARNING_RATE = 0.05;
  private static readonly PERFORMANCE_WINDOW = 10; // Consider last 10 trades for recent performance
  
  // Default indicators with equal weights
  private static readonly DEFAULT_INDICATORS = [
    'rsi', 'macd', 'bollingerBands', 'stochasticRsi', 'adx', 
    'volumeAnalysis', 'equilibriumAnalysis', 'movingAverages', 
    'cci', 'williamsR', 'obv'
  ];

  /**
   * Initialize adaptive learning with equal weights
   */
  static initializeLearning(enabledIndicators: string[], symbol: string): AdaptiveLearningState {
    const equalWeight = 1.0 / enabledIndicators.length;
    const currentWeights: AdaptiveWeights = {};
    const indicatorPerformance: { [indicator: string]: IndicatorPerformance } = {};

    // Set equal weights for enabled indicators
    enabledIndicators.forEach(indicator => {
      currentWeights[indicator] = equalWeight;
      indicatorPerformance[indicator] = {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalProfit: 0,
        averageProfit: 0,
        winRate: 0,
        reliability: 0.5, // Start with neutral reliability
        recentPerformance: []
      };
    });

    const state: AdaptiveLearningState = {
      currentWeights,
      indicatorPerformance,
      tradeHistory: [],
      learningRate: this.DEFAULT_LEARNING_RATE,
      totalTrades: 0,
      startDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    this.saveLearningState(state, symbol);
    return state;
  }

  /**
   * Load existing learning state or initialize new one
   */
  static loadLearningState(symbol: string, enabledIndicators: string[]): AdaptiveLearningState {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}_${symbol}`);
      if (stored) {
        const state: AdaptiveLearningState = JSON.parse(stored);
        
        // Ensure all enabled indicators are present
        const equalWeight = 1.0 / enabledIndicators.length;
        enabledIndicators.forEach(indicator => {
          if (!state.currentWeights[indicator]) {
            state.currentWeights[indicator] = equalWeight;
            state.indicatorPerformance[indicator] = {
              totalTrades: 0,
              winningTrades: 0,
              losingTrades: 0,
              totalProfit: 0,
              averageProfit: 0,
              winRate: 0,
              reliability: 0.5,
              recentPerformance: []
            };
          }
        });

        // Remove disabled indicators
        Object.keys(state.currentWeights).forEach(indicator => {
          if (!enabledIndicators.includes(indicator)) {
            delete state.currentWeights[indicator];
            delete state.indicatorPerformance[indicator];
          }
        });

        // Normalize weights
        state.currentWeights = this.normalizeWeights(state.currentWeights);
        return state;
      }
    } catch (error) {
      console.warn('Failed to load adaptive learning state:', error);
    }

    return this.initializeLearning(enabledIndicators, symbol);
  }

  /**
   * Process a trade outcome and update weights
   */
  static updateWeightsFromTrade(
    state: AdaptiveLearningState, 
    tradeOutcome: TradeOutcome,
    symbol: string
  ): AdaptiveLearningState {
    // Add trade to history
    state.tradeHistory.push(tradeOutcome);
    state.totalTrades++;

    // Update indicator performance
    Object.keys(tradeOutcome.indicatorContributions).forEach(indicator => {
      if (state.indicatorPerformance[indicator]) {
        const performance = state.indicatorPerformance[indicator];
        const contribution = tradeOutcome.indicatorContributions[indicator];
        
        // Update trade counts
        performance.totalTrades++;
        if (tradeOutcome.isWinning) {
          performance.winningTrades++;
        } else {
          performance.losingTrades++;
        }

        // Update profit tracking (weighted by contribution)
        const weightedProfit = tradeOutcome.profit * contribution;
        performance.totalProfit += weightedProfit;
        performance.averageProfit = performance.totalProfit / performance.totalTrades;
        performance.winRate = performance.winningTrades / performance.totalTrades; // Keep as decimal (0-1)

        // Update recent performance (1 for win, -1 for loss, weighted by contribution)
        const outcomeScore = tradeOutcome.isWinning ? contribution : -contribution;
        performance.recentPerformance.push(outcomeScore);
        if (performance.recentPerformance.length > this.PERFORMANCE_WINDOW) {
          performance.recentPerformance.shift();
        }

        // Calculate reliability based on recent performance and overall stats
        const recentScore = performance.recentPerformance.reduce((sum, score) => sum + score, 0) / 
                           Math.max(performance.recentPerformance.length, 1);
        const profitScore = Math.tanh(performance.averageProfit / 100); // Normalize profit impact
        const winRateScore = (performance.winRate - 0.5) * 2; // Convert 0-1 to -1 to 1 scale
        
        performance.reliability = Math.max(0.1, Math.min(0.9, 
          0.5 + (recentScore * 0.4) + (profitScore * 0.3) + (winRateScore * 0.3)
        ));
      }
    });

    // Update weights based on performance
    state.currentWeights = this.calculateNewWeights(state);
    state.lastUpdated = new Date().toISOString();

    // Save updated state
    this.saveLearningState(state, symbol);
    return state;
  }

  /**
   * Calculate new weights based on indicator performance
   */
  private static calculateNewWeights(state: AdaptiveLearningState): AdaptiveWeights {
    const newWeights: AdaptiveWeights = {};
    const indicators = Object.keys(state.currentWeights);
    
    // Calculate performance scores for each indicator
    const performanceScores: { [indicator: string]: number } = {};
    let totalScore = 0;

    indicators.forEach(indicator => {
      const performance = state.indicatorPerformance[indicator];
      const currentWeight = state.currentWeights[indicator];
      
      // Base score on reliability
      let score = performance.reliability;
      
      // Boost score for profitable indicators
      if (performance.averageProfit > 0) {
        score *= (1 + Math.min(performance.averageProfit / 100, 0.5)); // Max 50% boost
      }
      
      // Boost score for high win rate indicators
      if (performance.winRate > 60) {
        score *= (1 + (performance.winRate - 60) / 200); // Gradual boost above 60%
      }
      
      // Penalize consistently losing indicators
      if (performance.winRate < 40 && performance.totalTrades >= 5) {
        score *= 0.7; // 30% penalty
      }
      
      // Apply learning rate to smooth transitions
      const targetWeight = score;
      const adjustedWeight = currentWeight + (targetWeight - currentWeight) * state.learningRate;
      
      performanceScores[indicator] = Math.max(0.10, adjustedWeight); // Minimum 10% weight
      totalScore += performanceScores[indicator];
    });

    // Normalize weights to sum to 1
    indicators.forEach(indicator => {
      newWeights[indicator] = performanceScores[indicator] / totalScore;
    });

    return newWeights;
  }

  /**
   * Normalize weights to ensure they sum to 1
   */
  private static normalizeWeights(weights: AdaptiveWeights): AdaptiveWeights {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const normalized: AdaptiveWeights = {};
    
    if (total > 0) {
      Object.keys(weights).forEach(indicator => {
        normalized[indicator] = weights[indicator] / total;
      });
    } else {
      // If all weights are 0, distribute equally
      const equalWeight = 1.0 / Object.keys(weights).length;
      Object.keys(weights).forEach(indicator => {
        normalized[indicator] = equalWeight;
      });
    }
    
    return normalized;
  }

  /**
   * Save learning state to localStorage
   */
  static saveLearningState(state: AdaptiveLearningState, symbol: string): void {
    try {
      localStorage.setItem(`${this.STORAGE_KEY}_${symbol}`, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save adaptive learning state:', error);
    }
  }

  /**
   * Get current weights for decision making
   */
  static getCurrentWeights(symbol: string, enabledIndicators: string[]): AdaptiveWeights {
    const state = this.loadLearningState(symbol, enabledIndicators);
    return state.currentWeights;
  }

  /**
   * Get learning statistics for display
   */
  static getLearningStats(symbol: string, enabledIndicators: string[]): {
    totalTrades: number;
    topPerformers: Array<{ indicator: string; reliability: number; winRate: number; avgProfit: number }>;
    worstPerformers: Array<{ indicator: string; reliability: number; winRate: number; avgProfit: number }>;
    learningProgress: number; // 0-1 scale of how much learning has occurred
  } {
    const state = this.loadLearningState(symbol, enabledIndicators);
    
    const performers = Object.entries(state.indicatorPerformance)
      .map(([indicator, perf]) => ({
        indicator,
        reliability: perf.reliability,
        winRate: perf.winRate,
        avgProfit: perf.averageProfit
      }))
      .sort((a, b) => b.reliability - a.reliability);

    const topPerformers = performers.slice(0, 3);
    const worstPerformers = performers.slice(-3).reverse();
    
    // Learning progress based on trade count and weight distribution
    const minTrades = 10;
    const tradeProgress = Math.min(state.totalTrades / minTrades, 1);
    const weightVariance = this.calculateWeightVariance(state.currentWeights);
    
    // Calculate learning progress as a percentage (0-100)
    // Base progress on trade count (50%) and weight differentiation (50%)
    const baseProgress = tradeProgress * 50; // 0-50% based on trade count
    const varianceProgress = Math.min(weightVariance * 50, 50); // 0-50% based on weight learning
    const learningProgress = Math.min(baseProgress + varianceProgress, 100);

    return {
      totalTrades: state.totalTrades,
      topPerformers,
      worstPerformers,
      learningProgress
    };
  }

  /**
   * Calculate variance in weights (higher variance = more learning)
   */
  private static calculateWeightVariance(weights: AdaptiveWeights): number {
    const values = Object.values(weights);
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    // For equal weights, std dev would be 0. For maximum differentiation, it approaches 1/sqrt(n)
    // Normalize to 0-1 scale where 1 means maximum learning has occurred
    const maxPossibleStdDev = Math.sqrt((values.length - 1) / values.length) / Math.sqrt(values.length);
    return maxPossibleStdDev > 0 ? Math.min(standardDeviation / maxPossibleStdDev, 1) : 0;
  }

  /**
   * Export learning data for analysis
   */
  static exportLearningData(symbol: string, enabledIndicators: string[]): string {
    const state = this.loadLearningState(symbol, enabledIndicators);
    
    const exportData = {
      symbol,
      startDate: state.startDate,
      lastUpdated: state.lastUpdated,
      totalTrades: state.totalTrades,
      currentWeights: state.currentWeights,
      indicatorPerformance: state.indicatorPerformance,
      tradeHistory: state.tradeHistory.slice(-50), // Last 50 trades
      learningRate: state.learningRate
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Reset learning for a symbol
   */
  static resetLearning(symbol: string): void {
    try {
      localStorage.removeItem(`${this.STORAGE_KEY}_${symbol}`);
    } catch (error) {
      console.error('Failed to reset adaptive learning:', error);
    }
  }
}

export default AdaptiveWeightLearner;
