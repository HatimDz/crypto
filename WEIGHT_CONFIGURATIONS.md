# Weight Configuration Management System

## Overview
The Weight Configuration Management System allows you to save, track, and manage optimized indicator weights based on your backtesting results. This ensures that profitable weight combinations are preserved and can be reused for future trading strategies.

## How It Works

### 1. Automatic Optimization
- After running a backtest with 5+ trades, the system automatically optimizes indicator weights
- Optimization considers only the indicators you have selected (checkboxes)
- Weights are adjusted based on the timeframe of your backtest

### 2. Confirm or Reset Options
After optimization, you'll see two options:

#### **Confirm & Save Weights**
- Saves the optimized weights with a custom name
- Marks the configuration as "Active"
- Future backtests will use these confirmed weights
- Configuration is stored in browser localStorage and available for export

#### **Reset to Default**
- Discards the optimization
- Returns to the default weight distribution
- Clears any active custom configuration

### 3. Configuration Management
- **View Saved Configurations**: See all your saved weight configurations
- **Export**: Download configurations as JSON files for backup
- **Delete**: Remove configurations you no longer need
- **Active Status**: See which configuration is currently active

## File Storage

### Browser Storage
- Configurations are stored in browser localStorage
- Automatically backed up to `window.cryptoWeightConfigs` for manual export
- Survives browser restarts

### Export Files
- Configurations can be exported as JSON files
- File naming: `weight_config_[name]_[date].json`
- Contains complete configuration including performance metrics

## Configuration Structure

Each saved configuration includes:
- **Name**: Your custom identifier
- **Strategy**: Optimization strategy used (e.g., "profit-weighted")
- **Weights**: Exact weight values for each indicator
- **Performance**: Expected profit, win rate, Sharpe ratio, trade count
- **Timeframe**: Backtest period and date range
- **Enabled Indicators**: List of indicators that were active
- **Symbol**: Cryptocurrency pair tested
- **Timestamps**: Creation and confirmation dates

## Best Practices

### Naming Conventions
Use descriptive names that include:
- Symbol: `BTC`, `ETH`, etc.
- Timeframe: `30d`, `90d`, etc.
- Strategy type: `momentum`, `trend`, `balanced`
- Date: `2025-01-22`

Example: `BTC_30d_momentum_2025-01-22`

### Configuration Management
1. **Test Before Confirming**: Run multiple backtests to validate performance
2. **Export Regularly**: Backup your best configurations
3. **Clean Up**: Delete underperforming configurations
4. **Document Results**: Note why certain configurations work well

### Timeframe Considerations
- **Short-term (< 30 days)**: Momentum indicators get higher weights
- **Medium-term (30-90 days)**: Balanced approach
- **Long-term (> 90 days)**: Trend and fundamental indicators emphasized

## Default Weights
If no custom configuration is active, the system uses these profit-optimized defaults:

```
Equilibrium Analysis: 28%
Volume Analysis: 22%
ADX: 18%
MACD: 14%
Bollinger Bands: 8%
Stochastic RSI: 6%
RSI: 4%
CCI: 3%
Moving Averages: 2%
OBV: 2%
Williams %R: 1%
```

## Troubleshooting

### Configuration Not Loading
- Check browser localStorage isn't cleared
- Ensure configuration was properly confirmed
- Try refreshing the page

### Export Issues
- Modern browsers may block automatic downloads
- Check download folder for exported files
- Manually copy from `window.cryptoWeightConfigs` if needed

### Performance Degradation
- Review and clean up old configurations
- Export important configurations before deleting
- Reset to defaults if experiencing issues

## Technical Details

### Storage Location
- **Browser**: `localStorage['crypto_weight_configurations']`
- **Backup**: `window.cryptoWeightConfigs`
- **Export**: Downloaded JSON files

### File Format
Exported configurations use standard JSON format with full metadata for easy import/export between systems.

---

*This system ensures your profitable trading strategies are preserved and can be consistently applied across different market conditions.*
