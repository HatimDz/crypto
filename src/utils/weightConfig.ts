// Weight Configuration Management System
// Handles saving, loading, and managing optimized indicator weights

export interface WeightConfiguration {
  id: string;
  name: string;
  strategy: string;
  weights: { [key: string]: number };
  performance: {
    expectedProfit: number;
    winRate: number;
    sharpeRatio: number;
    totalTrades: number;
  };
  timeframe: {
    days: number;
    startDate: string;
    endDate: string;
  };
  enabledIndicators: string[];
  createdAt: string;
  confirmedAt?: string;
  symbol: string;
}

export interface WeightConfigHistory {
  configurations: WeightConfiguration[];
  currentConfig?: string; // ID of currently active configuration
  defaultWeights: { [key: string]: number };
}

// Default weight configuration
export const DEFAULT_WEIGHTS = {
  equilibriumAnalysis: 0.28,
  volumeAnalysis: 0.22,
  adx: 0.18,
  macd: 0.14,
  bollingerBands: 0.08,
  stochasticRsi: 0.06,
  rsi: 0.04,
  cci: 0.03,
  movingAverages: 0.02,
  obv: 0.02,
  williamsR: 0.01
};

class WeightConfigManager {
  private static readonly STORAGE_KEY = 'crypto_weight_configurations';
  private static readonly CONFIG_FILE = 'weight_configurations.json';

  // Load weight configuration history
  static loadConfigHistory(): WeightConfigHistory {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          configurations: parsed.configurations || [],
          currentConfig: parsed.currentConfig,
          defaultWeights: parsed.defaultWeights || DEFAULT_WEIGHTS
        };
      }
    } catch (error) {
      console.warn('Failed to load weight configuration history:', error);
    }

    return {
      configurations: [],
      defaultWeights: DEFAULT_WEIGHTS
    };
  }

  // Save weight configuration history
  static saveConfigHistory(history: WeightConfigHistory): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
      
      // Also create a downloadable JSON file for backup
      this.createDownloadableConfig(history);
    } catch (error) {
      console.error('Failed to save weight configuration history:', error);
    }
  }

  // Create a new weight configuration
  static createConfiguration(
    name: string,
    strategy: string,
    weights: { [key: string]: number },
    performance: WeightConfiguration['performance'],
    timeframe: WeightConfiguration['timeframe'],
    enabledIndicators: string[],
    symbol: string
  ): WeightConfiguration {
    return {
      id: this.generateId(),
      name,
      strategy,
      weights: { ...weights },
      performance: { ...performance },
      timeframe: { ...timeframe },
      enabledIndicators: [...enabledIndicators],
      createdAt: new Date().toISOString(),
      symbol
    };
  }

  // Save a new weight configuration
  static saveConfiguration(config: WeightConfiguration): void {
    const history = this.loadConfigHistory();
    
    // Remove any existing config with the same name
    history.configurations = history.configurations.filter(c => c.name !== config.name);
    
    // Add the new configuration
    history.configurations.unshift(config); // Add to beginning
    
    // Keep only the last 20 configurations
    if (history.configurations.length > 20) {
      history.configurations = history.configurations.slice(0, 20);
    }
    
    this.saveConfigHistory(history);
  }

  // Confirm a weight configuration (mark it as active for the specific symbol)
  static confirmConfiguration(configId: string): void {
    const history = this.loadConfigHistory();
    const config = history.configurations.find(c => c.id === configId);
    
    if (config) {
      config.confirmedAt = new Date().toISOString();
      
      // Clear any existing active config for this symbol
      history.configurations.forEach(c => {
        if (c.symbol === config.symbol && c.id !== configId) {
          delete c.confirmedAt; // Remove confirmation from other configs for same symbol
        }
      });
      
      // Set this as the current config for this symbol
      history.currentConfig = configId;
      this.saveConfigHistory(history);
    }
  }

  // Reset to default weights for a specific symbol
  static resetToDefault(symbol?: string): void {
    const history = this.loadConfigHistory();
    
    if (symbol) {
      // Remove confirmation from all configs for this symbol
      history.configurations.forEach(c => {
        if (c.symbol === symbol) {
          delete c.confirmedAt;
        }
      });
      
      // If current config is for this symbol, clear it
      if (history.currentConfig) {
        const currentConfig = history.configurations.find(c => c.id === history.currentConfig);
        if (currentConfig && currentConfig.symbol === symbol) {
          history.currentConfig = undefined;
        }
      }
    } else {
      // Reset all
      history.currentConfig = undefined;
      history.configurations.forEach(c => delete c.confirmedAt);
    }
    
    this.saveConfigHistory(history);
  }

  // Get current active weights for a specific symbol
  static getCurrentWeights(symbol?: string): { [key: string]: number } {
    if (!symbol) {
      return DEFAULT_WEIGHTS; // Return default weights if no symbol specified
    }
    
    const history = this.loadConfigHistory();
    
    // Look for active configuration for this specific symbol
    if (history.currentConfig) {
      const activeConfig = history.configurations.find(c => 
        c.id === history.currentConfig && c.symbol === symbol
      );
      if (activeConfig) {
        return activeConfig.weights;
      }
    }
    
    // Look for the most recent confirmed configuration for this symbol
    const symbolConfigs = history.configurations
      .filter(c => c.symbol === symbol && c.confirmedAt)
      .sort((a, b) => new Date(b.confirmedAt!).getTime() - new Date(a.confirmedAt!).getTime());
    
    if (symbolConfigs.length > 0) {
      return symbolConfigs[0].weights;
    }
    
    // Return default weights if no symbol-specific configuration found
    return DEFAULT_WEIGHTS;
  }

  // Get all configurations, optionally filtered by symbol
  static getAllConfigurations(symbol?: string): WeightConfiguration[] {
    const history = this.loadConfigHistory();
    if (symbol) {
      return history.configurations.filter(c => c.symbol === symbol);
    }
    return history.configurations;
  }
  
  // Get active configuration for a specific symbol
  static getActiveConfiguration(symbol: string): WeightConfiguration | null {
    const history = this.loadConfigHistory();
    
    // First check if there's a current config for this symbol
    if (history.currentConfig) {
      const currentConfig = history.configurations.find(c => 
        c.id === history.currentConfig && c.symbol === symbol
      );
      if (currentConfig) {
        return currentConfig;
      }
    }
    
    // Then look for most recent confirmed config for this symbol
    const symbolConfigs = history.configurations
      .filter(c => c.symbol === symbol && c.confirmedAt)
      .sort((a, b) => new Date(b.confirmedAt!).getTime() - new Date(a.confirmedAt!).getTime());
    
    return symbolConfigs.length > 0 ? symbolConfigs[0] : null;
  }

  // Delete a configuration
  static deleteConfiguration(configId: string): void {
    const history = this.loadConfigHistory();
    history.configurations = history.configurations.filter(c => c.id !== configId);
    
    if (history.currentConfig === configId) {
      history.currentConfig = undefined;
    }
    
    this.saveConfigHistory(history);
  }

  // Export configuration to file
  static exportConfiguration(config: WeightConfiguration): void {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `weight_config_${config.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // Import configuration from file
  static importConfiguration(file: File): Promise<WeightConfiguration> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          // Validate the configuration structure
          if (this.validateConfiguration(config)) {
            resolve(config);
          } else {
            reject(new Error('Invalid configuration format'));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Create downloadable backup file
  private static createDownloadableConfig(history: WeightConfigHistory): void {
    const configData = {
      ...history,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    // Store in a way that can be manually downloaded if needed
    (window as any).cryptoWeightConfigs = configData;
  }

  // Generate unique ID
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // Validate configuration structure
  private static validateConfiguration(config: any): config is WeightConfiguration {
    return (
      config &&
      typeof config.id === 'string' &&
      typeof config.name === 'string' &&
      typeof config.strategy === 'string' &&
      typeof config.weights === 'object' &&
      typeof config.performance === 'object' &&
      typeof config.timeframe === 'object' &&
      Array.isArray(config.enabledIndicators) &&
      typeof config.createdAt === 'string' &&
      typeof config.symbol === 'string'
    );
  }

  // Get configuration summary for display
  static getConfigSummary(config: WeightConfiguration): string {
    const topIndicators = Object.entries(config.weights)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([indicator, weight]) => `${indicator}: ${(weight * 100).toFixed(1)}%`)
      .join(', ');
    
    return `${config.strategy} | ${config.performance.winRate.toFixed(1)}% WR | ${topIndicators}`;
  }
}

export default WeightConfigManager;
