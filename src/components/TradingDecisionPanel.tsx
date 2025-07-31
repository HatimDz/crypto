import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Target, BarChart3, Minus as TrendingFlat, Info } from "lucide-react";
import { TechnicalAnalysis, IndicatorSettings, HistoricalPriceData } from '@/lib/TechnicalAnalysis';
import WeightConfigManager from '@/utils/weightConfig';
import { Skeleton } from "@/components/ui/skeleton";

interface TradingDecisionPanelProps {
  data: HistoricalPriceData[];
  currentPrice: number;
  cryptoSymbol: string;
}

const ALL_INDICATORS: IndicatorSettings = {
    rsi: true, macd: true, bollingerBands: true, movingAverages: true,
    stochasticRsi: true, williamsR: true, cci: true, adx: true, obv: true,
    volumeAnalysis: true, equilibriumAnalysis: true,
};

interface SignalResult {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reasoning: string[];
    indicatorValues: any;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    potentialReturn?: number;
    stopLoss?: number;
}

export const TradingDecisionPanel: React.FC<TradingDecisionPanelProps> = ({ data, currentPrice, cryptoSymbol }) => {
    // Debug props at component level
    console.log(`🔍 TradingDecisionPanel Props - Symbol: ${cryptoSymbol}, Price: ${currentPrice}, Data Length: ${data?.length || 0}`);
    
    const [signal, setSignal] = useState<SignalResult | null>(null);
    const [optimalPrices, setOptimalPrices] = useState<{ optimalBuyPrice: number | null; optimalSellPrice: number | null; recommendedAction: 'BUY' | 'SELL' | 'HOLD' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
    const [lastCrypto, setLastCrypto] = useState<string>("");

    useEffect(() => {
        // Detect crypto symbol change and reset state
        if (lastCrypto !== cryptoSymbol) {
            console.log(`Crypto changed from ${lastCrypto} to ${cryptoSymbol} - resetting state`);
            setSignal(null);
            setOptimalPrices(null);
            setLastCrypto(cryptoSymbol);
        }
        
        const generateSignal = () => {
            if (!data || data.length < 30 || !currentPrice) { // Require some data
                setLoading(false);
                return;
            }
            
            setLoading(true);
            console.log(`\n=== GENERATING SIGNAL FOR ${cryptoSymbol} ===`);
            console.log(`[${cryptoSymbol}] Data points:`, data.length);
            console.log(`[${cryptoSymbol}] Current price:`, currentPrice);
            
            try {
                const weights = WeightConfigManager.getCurrentWeights(cryptoSymbol);
                console.log(`[${cryptoSymbol}] Using saved weights:`, weights);
                
                // Get active configuration to check if it's from backtest
                const activeConfig = WeightConfigManager.getActiveConfiguration(cryptoSymbol);
                console.log(`[${cryptoSymbol}] Active config:`, activeConfig);
                
                if (activeConfig) {
                    console.log(`[${cryptoSymbol}] ✅ Using OPTIMIZED weights from backtest:`);
                    console.log(`[${cryptoSymbol}] Config name: ${activeConfig.name}`);
                    console.log(`[${cryptoSymbol}] Created: ${activeConfig.createdAt}`);
                    console.log(`[${cryptoSymbol}] Performance: ${activeConfig.performance?.expectedProfit || 'N/A'}% return, Win Rate: ${activeConfig.performance?.winRate || 'N/A'}%`);
                } else {
                    console.log(`[${cryptoSymbol}] ⚠️ Using DEFAULT weights - no backtest optimization found`);
                }
                
                // Verify weights are properly loaded
                if (!weights || Object.keys(weights).length === 0) {
                    console.warn(`[${cryptoSymbol}] No weights found! Using default weights.`);
                }
                
                const latestDataPoint = { ...data[data.length - 1], close: currentPrice, price: currentPrice };
                const dataWithLivePrice = [...data.slice(0, -1), latestDataPoint];

                const signalResult = TechnicalAnalysis.generateSignal(
                    dataWithLivePrice,
                    dataWithLivePrice.length - 1,
                    ALL_INDICATORS,
                    weights
                );
                
                // Get optimal prices with enhanced logic
                const { optimalBuyPrice, optimalSellPrice } = TechnicalAnalysis.findOptimalSignalPrices(
                    data,
                    currentPrice,
                    ALL_INDICATORS,
                    weights
                );
                
                // Enhanced optimal price calculation with better logic
                let enhancedOptimalBuyPrice = optimalBuyPrice;
                let enhancedOptimalSellPrice = optimalSellPrice;
                
                // Debug logging
                console.log(`[${cryptoSymbol}] Original optimal buy price:`, optimalBuyPrice);
                console.log(`[${cryptoSymbol}] Current price:`, currentPrice);
                console.log(`[${cryptoSymbol}] Price difference:`, optimalBuyPrice ? Math.abs(optimalBuyPrice - currentPrice) / currentPrice : 0);
                console.log(`[${cryptoSymbol}] Data length:`, data?.length || 0);
                
                // Always recalculate for better prices - force enhanced calculation for ALL cryptocurrencies
                const shouldRecalculate = !enhancedOptimalBuyPrice || 
                                         Math.abs(enhancedOptimalBuyPrice - currentPrice) / currentPrice < 0.04 ||
                                         enhancedOptimalBuyPrice === currentPrice;
                
                console.log(`[${cryptoSymbol}] Should recalculate:`, shouldRecalculate);
                
                if (shouldRecalculate || true) { // Force recalculation for now
                    const recentLows = data.slice(-20).map(d => d.low).sort((a, b) => a - b);
                    const recentHighs = data.slice(-20).map(d => d.high).sort((a, b) => b - a);
                    const supportLevel = recentLows[Math.floor(recentLows.length * 0.3)]; // 30th percentile for stronger support
                    const resistanceLevel = recentHighs[Math.floor(recentHighs.length * 0.3)];
                    
                    // Multiple price targets based on different strategies (more aggressive)
                    const supportBasedPrice = supportLevel * 1.005; // 0.5% above support
                    const percentageBasedPrice = currentPrice * 0.92; // 8% below current
                    const fibonacciBasedPrice = currentPrice * 0.955; // 4.5% below (fibonacci retracement)
                    const volatilityBasedPrice = currentPrice - (recentHighs[0] - recentLows[0]) * 0.2; // Based on recent volatility
                    const aggressivePrice = currentPrice * 0.90; // 10% below current
                    
                    console.log(`[${cryptoSymbol}] Support level:`, supportLevel);
                    console.log(`[${cryptoSymbol}] Resistance level:`, resistanceLevel);
                    console.log(`[${cryptoSymbol}] Support-based price:`, supportBasedPrice);
                    console.log(`[${cryptoSymbol}] Percentage-based price:`, percentageBasedPrice);
                    console.log(`[${cryptoSymbol}] Fibonacci-based price:`, fibonacciBasedPrice);
                    console.log(`[${cryptoSymbol}] Aggressive price:`, aggressivePrice);
                    
                    // Choose the best price that's at least 4% below current
                    const allCandidates = [
                        supportBasedPrice,
                        percentageBasedPrice, 
                        fibonacciBasedPrice,
                        aggressivePrice,
                        Math.max(volatilityBasedPrice, currentPrice * 0.92) // Ensure it's not too extreme
                    ];
                    
                    console.log(`[${cryptoSymbol}] All candidate prices:`, allCandidates);
                    
                    const candidatePrices = allCandidates.filter(price => {
                        const difference = (currentPrice - price) / currentPrice;
                        const isValid = difference >= 0.045 && difference <= 0.15; // Between 4.5% and 15% below current
                        console.log(`[${cryptoSymbol}] Price ${price.toFixed(2)}: ${(difference * 100).toFixed(2)}% diff, valid: ${isValid}`);
                        return isValid;
                    });
                    
                    if (candidatePrices.length > 0) {
                        // Choose the price closest to support level for better technical significance
                        enhancedOptimalBuyPrice = candidatePrices.reduce((best, current) => {
                            const bestDistance = Math.abs(best - supportLevel);
                            const currentDistance = Math.abs(current - supportLevel);
                            return currentDistance < bestDistance ? current : best;
                        });
                    } else {
                        // Fallback: ensure at least 5% below current price
                        enhancedOptimalBuyPrice = currentPrice * 0.95;
                        console.log('Using fallback price:', enhancedOptimalBuyPrice);
                    }
                    
                    console.log('Enhanced optimal buy price:', enhancedOptimalBuyPrice);
                    console.log('Difference from current:', ((currentPrice - enhancedOptimalBuyPrice) / currentPrice * 100).toFixed(2) + '%');
                }
                
                // Enhanced sell price calculation
                if (!enhancedOptimalSellPrice || Math.abs(enhancedOptimalSellPrice - currentPrice) / currentPrice < 0.025) {
                    const recentHighs = data.slice(-20).map(d => d.high).sort((a, b) => b - a);
                    const recentLows = data.slice(-20).map(d => d.low).sort((a, b) => a - b);
                    const resistanceLevel = recentHighs[Math.floor(recentHighs.length * 0.3)];
                    
                    // Multiple sell targets
                    const resistanceBasedPrice = resistanceLevel * 0.99; // 1% below resistance
                    const percentageBasedPrice = currentPrice * 1.05; // 5% above current
                    const fibonacciBasedPrice = currentPrice * 1.062; // 6.2% above (fibonacci extension)
                    const riskRewardPrice = enhancedOptimalBuyPrice ? enhancedOptimalBuyPrice * 1.08 : currentPrice * 1.06; // 2:1 risk/reward
                    
                    const candidateSellPrices = [
                        resistanceBasedPrice,
                        percentageBasedPrice,
                        fibonacciBasedPrice,
                        riskRewardPrice
                    ].filter(price => {
                        const difference = (price - currentPrice) / currentPrice;
                        return difference >= 0.03 && difference <= 0.20; // Between 3% and 20% above current
                    });
                    
                    if (candidateSellPrices.length > 0) {
                        // Choose the highest reasonable price for better profit potential
                        enhancedOptimalSellPrice = Math.max(...candidateSellPrices);
                    } else {
                        // Fallback: ensure at least 5% above current price
                        enhancedOptimalSellPrice = currentPrice * 1.05;
                    }
                }
                
                // Calculate risk level and potential return
                const riskLevel = signalResult.confidence > 70 ? 'LOW' : signalResult.confidence > 40 ? 'MEDIUM' : 'HIGH';
                const potentialReturn = optimalSellPrice ? ((optimalSellPrice - currentPrice) / currentPrice) * 100 : 0;
                const stopLoss = signalResult.action === 'BUY' ? currentPrice * 0.95 : currentPrice * 1.05;
                
                // Check if optimal prices meet our minimum criteria
                const isBuyRealistic = optimalBuyPrice && ((currentPrice - optimalBuyPrice) / currentPrice) >= 0.02;
                const isSellRealistic = optimalSellPrice && ((optimalSellPrice - currentPrice) / currentPrice) >= 0.02;
                
                // Determine recommended action based on multiple factors
                // Only recommend BUY if optimal price is at least 2% below current price
                const localIsBuyRealistic = enhancedOptimalBuyPrice && ((currentPrice - enhancedOptimalBuyPrice) / currentPrice) >= 0.025;
                const localIsSellRealistic = enhancedOptimalSellPrice && ((enhancedOptimalSellPrice - currentPrice) / currentPrice) >= 0.025;
                
                const recommendedAction = signalResult.action === 'BUY' && localIsBuyRealistic 
                    ? 'BUY' 
                    : signalResult.action === 'SELL' && localIsSellRealistic 
                        ? 'SELL' 
                        : 'HOLD';
                
                const enhancedSignal: SignalResult = {
                    ...signalResult,
                    riskLevel,
                    potentialReturn,
                    stopLoss
                };

                setSignal(enhancedSignal);
                setOptimalPrices({ 
                    optimalBuyPrice: enhancedOptimalBuyPrice, 
                    optimalSellPrice: enhancedOptimalSellPrice, 
                    recommendedAction 
                });
            } catch (e) {
                console.error(`Failed to generate signal for ${cryptoSymbol}`, e);
                setSignal(null);
                setOptimalPrices(null);
            } finally {
                setLoading(false);
            }
        };

        generateSignal();
    }, [data, currentPrice, cryptoSymbol]);

    // Force recalculation trigger
    const enhancedPricesKey = `${currentPrice}-${data?.length || 0}-${Date.now()}`;

    if (loading) {
        return (
            <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <Skeleton className="h-20 w-full mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
            </Card>
        );
    }

    if (!signal || !optimalPrices) {
        return (
            <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
                <div className="flex items-center gap-3 mb-6">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Trading Decision Analysis</h2>
                        <p className="text-muted-foreground text-sm">For {cryptoSymbol}</p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Not enough data to generate a trading signal.</p>
                </div>
            </Card>
        );
    }

    const action = signal?.action;
    const confidence = signal?.confidence;
    const reasoning = signal?.reasoning || [];
    const indicatorValues = signal?.indicatorValues || {};
    const riskLevel = signal?.riskLevel;
    const potentialReturn = signal?.potentialReturn;
    const stopLoss = signal?.stopLoss;
    
    // Calculate realistic signal indicators
    const isBuyRealistic = optimalPrices?.optimalBuyPrice && ((currentPrice - optimalPrices.optimalBuyPrice) / currentPrice) >= 0.02;
    const isSellRealistic = optimalPrices?.optimalSellPrice && ((optimalPrices.optimalSellPrice - currentPrice) / currentPrice) >= 0.02;
    
    let overallDecision: { actionStr: string; color: string; icon: React.ElementType; description: string } = {
        actionStr: 'HOLD',
        color: 'text-yellow-500',
        icon: Minus,
        description: 'Market indecision - wait for clearer signals'
    } as { actionStr: string; color: string; icon: React.ElementType; description: string };
    
    // Only proceed with signal evaluation if we have valid data
    if (!action || !confidence) {
        return (
            <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Not enough data to generate a trading signal.</p>
                </div>
            </Card>
        );
    }

    if (action === 'BUY') {
        const priceDiff = optimalPrices?.optimalBuyPrice 
            ? ((currentPrice - optimalPrices.optimalBuyPrice) / currentPrice * 100).toFixed(2) 
            : '0.00';
            
        overallDecision = {
            actionStr: confidence > 70 ? 'STRONG BUY' : 'BUY',
            color: 'text-green-500',
            icon: TrendingUp,
            description: isBuyRealistic && optimalPrices?.optimalBuyPrice
                ? `Potential entry ${((currentPrice - optimalPrices.optimalBuyPrice) / currentPrice * 100).toFixed(2)}% below current price` 
                : 'No significant buying opportunity at current price'
        };
    } else if (action === 'SELL') {
        const priceDiff = optimalPrices?.optimalSellPrice 
            ? ((optimalPrices.optimalSellPrice - currentPrice) / currentPrice * 100).toFixed(2) 
            : '0.00';
            
        overallDecision = {
            actionStr: confidence > 70 ? 'STRONG SELL' : 'SELL',
            color: 'text-red-500',
            icon: TrendingDown,
            description: isSellRealistic && optimalPrices?.optimalSellPrice
                ? `Potential exit ${((optimalPrices.optimalSellPrice - currentPrice) / currentPrice * 100).toFixed(2)}% above current price` 
                : 'No significant selling opportunity at current price'
        };
    } else {
        // Fallback for any other action type
        overallDecision = {
            actionStr: 'HOLD',
            color: 'text-yellow-500',
            icon: Minus,
            description: 'Market indecision - wait for clearer signals'
        };
    }

    const IconComponent = overallDecision.icon || Minus;

    return (
        <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                    <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Trading Decision Analysis</h2>
                    <p className="text-muted-foreground text-sm">Weighted technical analysis for {cryptoSymbol}</p>
                </div>
            </div>

            {/* Overall Decision & Optimal Prices */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="p-5 rounded-xl bg-gradient-to-br from-card via-card/90 to-muted/20 border-2 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${
                                overallDecision.color === 'text-green-500' ? 'bg-green-500/10 border border-green-500/20' : 
                                overallDecision.color === 'text-red-500' ? 'bg-red-500/10 border border-red-500/20' : 
                                'bg-yellow-500/10 border border-yellow-500/20'
                            }`}>
                                <IconComponent className={`w-8 h-8 ${overallDecision.color}`} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className={`text-2xl font-bold ${overallDecision.color}`}>
                                        {overallDecision.actionStr}
                                    </h3>
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        confidence >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                        confidence >= 60 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                        confidence >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    }`}>
                                        {confidence >= 80 ? '🔥 Very High' : confidence >= 60 ? '✅ High' : confidence >= 40 ? '⚠️ Medium' : '❌ Low'} Confidence
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                        <span className="text-sm font-medium text-primary">LIVE</span>
                                    </div>
                                    <span className="text-lg font-bold text-foreground">{confidence.toFixed(1)}%</span>
                                    <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${
                                                confidence >= 70 ? 'bg-green-500' : 
                                                confidence >= 50 ? 'bg-blue-500' : 
                                                confidence >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${Math.min(confidence, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {overallDecision.description}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge 
                                variant={action === 'BUY' ? 'default' : action === 'SELL' ? 'destructive' : 'secondary'}
                                className="text-sm px-3 py-1 font-semibold"
                            >
                                {action}
                            </Badge>
                            <div className="text-xs text-muted-foreground text-right">
                                Risk: <span className={`font-medium ${
                                    riskLevel === 'LOW' ? 'text-green-600' :
                                    riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'
                                }`}>{riskLevel}</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                            <p className="font-semibold text-sm flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Key Technical Drivers
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {reasoning.slice(0, 6).map((r, i) => (
                                    <Badge 
                                        key={i} 
                                        variant="outline" 
                                        className="text-xs py-1 px-2 bg-background/50 hover:bg-background transition-colors"
                                    >
                                        {r}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <p className="font-semibold text-sm flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Market Context
                            </p>
                            <div className="text-xs space-y-1 text-muted-foreground">
                                <div className="flex justify-between">
                                    <span>Current Price:</span>
                                    <span className="font-medium text-foreground">${currentPrice.toFixed(2)}</span>
                                </div>
                                {potentialReturn && (
                                    <div className="flex justify-between">
                                        <span>Potential Return:</span>
                                        <span className={`font-medium ${potentialReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {potentialReturn > 0 ? '+' : ''}{potentialReturn.toFixed(2)}%
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span>Signal Strength:</span>
                                    <span className="font-medium text-foreground">
                                        {confidence >= 80 ? 'Excellent' : 
                                         confidence >= 60 ? 'Good' : 
                                         confidence >= 40 ? 'Fair' : 'Weak'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-2">
                        <Target className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                            <p className="text-muted-foreground">Optimal Entry</p>
                            <p className="font-bold text-lg">{optimalPrices?.optimalBuyPrice?.toFixed(2) || '-'}</p>
                            {optimalPrices?.optimalBuyPrice ? (
                                <>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {isBuyRealistic 
                                            ? `${((currentPrice - optimalPrices.optimalBuyPrice) / currentPrice * 100).toFixed(2)}% below current` 
                                            : 'Less than 2% difference - not ideal entry'}
                                    </p>
                                    {!isBuyRealistic && (
                                        <>
                                            <p className="text-xs text-yellow-600 mt-1">Wait for better entry point</p>
                                            <p className="text-xs text-yellow-600 mt-1">Current price: ${currentPrice.toFixed(2)}</p>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground mt-1">No optimal entry identified</p>
                                    <p className="text-xs text-yellow-600 mt-1">Current price: ${currentPrice.toFixed(2)}</p>
                                    <p className="text-xs text-blue-600 mt-1">💡 Tip: Optimal entries are at least 2.5% below current price</p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <Target className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                            <p className="text-muted-foreground">Optimal Exit</p>
                            <p className="font-bold text-lg">{optimalPrices?.optimalSellPrice?.toFixed(2) || '-'}</p>
                            {optimalPrices?.optimalSellPrice ? (
                                <>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {isSellRealistic 
                                            ? `${((optimalPrices.optimalSellPrice - currentPrice) / currentPrice * 100).toFixed(2)}% above current` 
                                            : 'Less than 2% difference - not ideal exit'}
                                    </p>
                                    {!isSellRealistic && (
                                        <>
                                            <p className="text-xs text-yellow-600 mt-1">Wait for better exit point</p>
                                            <p className="text-xs text-yellow-600 mt-1">Current price: ${currentPrice.toFixed(2)}</p>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground mt-1">No optimal exit identified</p>
                                    <p className="text-xs text-yellow-600 mt-1">Current price: ${currentPrice.toFixed(2)}</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Technical Indicators Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {indicatorValues.rsi !== undefined && (
                    <IndicatorCard title="RSI (14)" value={indicatorValues.rsi?.toFixed(1) || 'N/A'} interpretation={indicatorValues.rsi < 30 ? 'Oversold' : indicatorValues.rsi > 70 ? 'Overbought' : 'Neutral'} />
                )}
                {indicatorValues.macd !== undefined && indicatorValues.macd && (
                    <IndicatorCard title="MACD Hist." value={indicatorValues.macd.histogram?.toFixed(2) || 'N/A'} interpretation={indicatorValues.macd.histogram > 0 ? 'Bullish' : 'Bearish'} />
                )}
                {indicatorValues.williamsR !== undefined && (
                    <IndicatorCard title="Williams %R" value={indicatorValues.williamsR?.toFixed(1) || 'N/A'} interpretation={indicatorValues.williamsR < -80 ? 'Oversold' : indicatorValues.williamsR > -20 ? 'Overbought' : 'Neutral'} />
                )}
                {indicatorValues.cci !== undefined && (
                    <IndicatorCard title="CCI (20)" value={indicatorValues.cci?.toFixed(0) || 'N/A'} interpretation={indicatorValues.cci < -100 ? 'Oversold' : indicatorValues.cci > 100 ? 'Overbought' : 'Neutral'} />
                )}
                {indicatorValues.stochasticRsi !== undefined && indicatorValues.stochasticRsi && (
                    <IndicatorCard title="Stoch RSI" value={indicatorValues.stochasticRsi.k?.toFixed(1) || 'N/A'} interpretation={indicatorValues.stochasticRsi.k < 20 ? 'Oversold' : indicatorValues.stochasticRsi.k > 80 ? 'Overbought' : 'Neutral'} />
                )}
                {indicatorValues.adx !== undefined && indicatorValues.adx && (
                    <IndicatorCard title="ADX (14)" value={indicatorValues.adx.adx?.toFixed(1) || 'N/A'} interpretation={indicatorValues.adx.adx > 25 ? 'Strong Trend' : 'Weak Trend'} />
                )}
            </div>
            
            {/* Advanced Details Section */}
            <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Advanced Signal Analysis
                    </h3>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                        className="text-xs"
                    >
                        {showAdvancedDetails ? 'Hide Details' : 'Show Details'}
                    </Button>
                </div>
                
                {showAdvancedDetails && (
                    <div className="space-y-4">
                        {/* Dynamic Trade Setup based on Signal */}
                        <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800">
                            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Dynamic Trade Setup for {action} Signal
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Entry Price */}
                                <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 border">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-3 h-3 rounded-full ${
                                            action === 'BUY' ? 'bg-green-500' : 
                                            action === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}></div>
                                        <span className="font-medium text-sm">
                                            {action === 'BUY' ? 'Entry Price' : action === 'SELL' ? 'Exit Price' : 'Watch Price'}
                                        </span>
                                    </div>
                                    <p className="text-lg font-bold text-foreground">
                                        {action === 'BUY' && optimalPrices?.optimalBuyPrice 
                                            ? `$${optimalPrices.optimalBuyPrice.toFixed(2)}`
                                            : action === 'SELL' && optimalPrices?.optimalSellPrice 
                                            ? `$${optimalPrices.optimalSellPrice.toFixed(2)}`
                                            : `$${currentPrice.toFixed(2)}`
                                        }
                                        {action === 'BUY' && optimalPrices?.optimalBuyPrice && 
                                         optimalPrices.optimalBuyPrice !== currentPrice ? (
                                            <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
                                                OPTIMAL
                                            </span>
                                        ) : action === 'SELL' && optimalPrices?.optimalSellPrice && 
                                           optimalPrices.optimalSellPrice !== currentPrice ? (
                                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full">
                                                OPTIMAL
                                            </span>
                                        ) : (
                                            <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 rounded-full">
                                                CURRENT
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {action === 'BUY' && optimalPrices?.optimalBuyPrice 
                                            ? `${((currentPrice - optimalPrices.optimalBuyPrice) / currentPrice * 100).toFixed(1)}% below current ($${currentPrice.toFixed(2)})`
                                            : action === 'SELL' && optimalPrices?.optimalSellPrice 
                                            ? `${((optimalPrices.optimalSellPrice - currentPrice) / currentPrice * 100).toFixed(1)}% above current ($${currentPrice.toFixed(2)})`
                                            : `Current market price - no optimal price calculated`
                                        }
                                    </p>
                                </div>
                        
                                {/* Target/Stop Loss */}
                                <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 border">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Target className="w-3 h-3 text-green-500" />
                                        <span className="font-medium text-sm">
                                            {action === 'BUY' ? 'Target Price' : action === 'SELL' ? 'Stop Loss' : 'Target'}
                                        </span>
                                    </div>
                                    <p className="text-lg font-bold text-foreground">
                                        {action === 'BUY' && optimalPrices?.optimalSellPrice 
                                            ? `$${optimalPrices.optimalSellPrice.toFixed(2)}`
                                            : stopLoss 
                                            ? `$${stopLoss.toFixed(2)}`
                                            : 'N/A'
                                        }
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {action === 'BUY' && optimalPrices?.optimalSellPrice 
                                            ? `+${((optimalPrices.optimalSellPrice - currentPrice) / currentPrice * 100).toFixed(1)}% upside`
                                            : stopLoss 
                                            ? `${action === 'BUY' ? '-' : '+'}${Math.abs(((stopLoss - currentPrice) / currentPrice) * 100).toFixed(1)}%`
                                            : 'Not available'
                                        }
                                    </p>
                                </div>
                        
                                {/* Risk Level */}
                                <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 border">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className={`w-3 h-3 ${
                                            riskLevel === 'LOW' ? 'text-green-500' : 
                                            riskLevel === 'MEDIUM' ? 'text-yellow-500' : 'text-red-500'
                                        }`} />
                                        <span className="font-medium text-sm">Risk Level</span>
                                    </div>
                                    <p className={`text-lg font-bold ${
                                        riskLevel === 'LOW' ? 'text-green-600' : 
                                        riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                        {riskLevel}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {potentialReturn ? `${potentialReturn.toFixed(1)}% potential` : 'Based on confidence'}
                                    </p>
                                </div>

                                {/* Position Size */}
                                <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 border">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart3 className="w-3 h-3 text-blue-500" />
                                        <span className="font-medium text-sm">Position Size</span>
                                    </div>
                                    <p className="text-lg font-bold text-foreground">
                                        {riskLevel === 'LOW' ? '5-10%' : 
                                         riskLevel === 'MEDIUM' ? '2-5%' : '1-2%'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {riskLevel === 'LOW' ? 'Higher allocation' : 
                                         riskLevel === 'MEDIUM' ? 'Moderate allocation' : 'Conservative allocation'}
                                    </p>
                                </div>
                            </div>

                            {/* Action-specific advice */}
                            <div className="mt-4 p-3 rounded-lg bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                                    📋 {action} Strategy Recommendation:
                                </p>
                                <p className="text-xs text-blue-800 dark:text-blue-200">
                                    {action === 'BUY' 
                                        ? `Wait for price to drop to ${optimalPrices?.optimalBuyPrice?.toFixed(2) || 'optimal entry'} before entering. Set stop-loss at ${stopLoss?.toFixed(2) || 'calculated level'} and target ${optimalPrices?.optimalSellPrice?.toFixed(2) || 'resistance levels'}.`
                                        : action === 'SELL'
                                        ? `Consider selling at current levels or wait for ${optimalPrices?.optimalSellPrice?.toFixed(2) || 'optimal exit'}. Risk management suggests ${stopLoss?.toFixed(2) || 'stop-loss level'}.`
                                        : 'Current market conditions suggest holding position. Wait for clearer signals before taking action.'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Risk Warning */}
            <div className="mt-6 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                    <strong className="text-yellow-600">Risk Warning:</strong> This analysis is based on weighted technical indicators and historical data. Optimal prices are calculated targets, not guarantees. Cryptocurrency trading involves substantial risk.
                    <br/><br/>
                    <span className="font-medium">Important:</span> Buy signals are only triggered when optimal entry prices are at least 2% below current price. This ensures realistic entry points with better risk-reward ratios.
                </div>
            </div>
        </Card>
    );
};

interface IndicatorCardProps {
    title: string;
    value: string;
    interpretation: string;
    trend?: 'up' | 'down' | 'flat';
}

const IndicatorCard: React.FC<IndicatorCardProps> = ({ title, value, interpretation, trend }) => {
    let trendIcon = null;
    if (trend === 'up') trendIcon = <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend === 'down') trendIcon = <TrendingDown className="h-3 w-3 text-red-500" />;
    if (trend === 'flat') trendIcon = <TrendingFlat className="h-3 w-3 text-gray-500" />;
    
    return (
        <div className="p-3 rounded-lg bg-background border hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-start">
                <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
                {trendIcon}
            </div>
            <p className="text-xl font-bold text-foreground my-1">{value}</p>
            <p className="text-xs text-muted-foreground">{interpretation}</p>
        </div>
    );
};
