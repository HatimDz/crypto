import { Backtester } from '../lib/backtester';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Starting comprehensive backtesting of trading indicators...');
  console.log('Testing timeframes: 1m, 5m, 15m, 30m, 1h');
  console.log('Testing symbols: BTCUSDT, ETHUSDT, BNBUSDT, ADAUSDT, SOLUSDT');
  console.log('Testing period: 30 days\n');

  try {
    // Run comprehensive backtest
    const results = await Backtester.runComprehensiveBacktest();
    
    // Generate report
    const report = Backtester.generateReport(results);
    
    // Save results to files
    const resultsDir = path.join(process.cwd(), 'backtest-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Save detailed JSON results
    const jsonPath = path.join(resultsDir, `backtest-results-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    
    // Save markdown report
    const reportPath = path.join(resultsDir, `backtest-report-${Date.now()}.md`);
    fs.writeFileSync(reportPath, report);
    
    // Display summary in console
    console.log('\n📊 BACKTESTING COMPLETE!\n');
    console.log('='.repeat(60));
    
    // Quick summary
    const totalTrades = results.reduce((sum, r) => sum + r.totalTrades, 0);
    const totalReturn = results.reduce((sum, r) => sum + r.totalReturn, 0);
    const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
    
    console.log(`📈 Total Trades Executed: ${totalTrades}`);
    console.log(`💰 Total Portfolio Return: ${totalReturn.toFixed(2)}%`);
    console.log(`🎯 Average Win Rate: ${avgWinRate.toFixed(1)}%`);
    console.log(`📊 Average Sharpe Ratio: ${avgSharpe.toFixed(2)}`);
    
    // Best performers
    const bestPerformers = results
      .sort((a, b) => b.totalReturn - a.totalReturn)
      .slice(0, 3);
    
    console.log('\n🏆 TOP 3 PERFORMING COMBINATIONS:');
    bestPerformers.forEach((result, index) => {
      console.log(`${index + 1}. ${result.symbol} (${result.timeframe}): ${result.totalReturn.toFixed(2)}% return, ${result.winRate.toFixed(1)}% win rate`);
    });
    
    // Worst performers
    const worstPerformers = results
      .sort((a, b) => a.totalReturn - b.totalReturn)
      .slice(0, 3);
    
    console.log('\n⚠️  BOTTOM 3 PERFORMING COMBINATIONS:');
    worstPerformers.forEach((result, index) => {
      console.log(`${index + 1}. ${result.symbol} (${result.timeframe}): ${result.totalReturn.toFixed(2)}% return, ${result.winRate.toFixed(1)}% win rate`);
    });
    
    // Performance by timeframe analysis
    console.log('\n📅 PERFORMANCE BY TIMEFRAME:');
    const timeframes = ['1m', '5m', '15m', '30m', '1h'];
    
    timeframes.forEach(tf => {
      const tfResults = results.filter(r => r.timeframe === tf);
      const avgReturn = tfResults.reduce((sum, r) => sum + r.totalReturn, 0) / tfResults.length;
      const avgWinRate = tfResults.reduce((sum, r) => sum + r.winRate, 0) / tfResults.length;
      const totalTrades = tfResults.reduce((sum, r) => sum + r.totalTrades, 0);
      
      console.log(`${tf.padEnd(4)} | Avg Return: ${avgReturn.toFixed(2).padStart(7)}% | Avg Win Rate: ${avgWinRate.toFixed(1).padStart(5)}% | Total Trades: ${totalTrades.toString().padStart(3)}`);
    });
    
    // Risk assessment
    console.log('\n⚡ RISK ASSESSMENT:');
    const maxDrawdown = Math.max(...results.map(r => r.maxDrawdown));
    const avgDrawdown = results.reduce((sum, r) => sum + r.maxDrawdown, 0) / results.length;
    
    console.log(`Maximum Drawdown: ${maxDrawdown.toFixed(2)}%`);
    console.log(`Average Drawdown: ${avgDrawdown.toFixed(2)}%`);
    
    if (avgSharpe > 1) {
      console.log('✅ Strategy shows EXCELLENT risk-adjusted returns');
    } else if (avgSharpe > 0.5) {
      console.log('⚠️  Strategy shows MODERATE performance - consider refinements');
    } else {
      console.log('❌ Strategy needs SIGNIFICANT improvement');
    }
    
    console.log('\n📁 FILES SAVED:');
    console.log(`📄 Detailed Results: ${jsonPath}`);
    console.log(`📋 Report: ${reportPath}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Backtesting analysis complete!');
    
  } catch (error) {
    console.error('❌ Error during backtesting:', error);
    process.exit(1);
  }
}

// Run the backtest
main().catch(console.error);
