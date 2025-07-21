import { useState } from "react";
import { CryptoSelector } from "@/components/CryptoSelector";
import { PriceChart } from "@/components/PriceChart";
import { EquilibriumStats } from "@/components/EquilibriumStats";
import { TechnicalIndicators } from "@/components/TechnicalIndicators";
import { TradingDecisionPanel } from "@/components/TradingDecisionPanel";
import { useCryptoData } from "@/hooks/useCryptoData";
import { Toaster } from "@/components/ui/toaster";
import { TrendingUp, Database } from "lucide-react";

const Index = () => {
  const [selectedCrypto, setSelectedCrypto] = useState("BTC");
  const { data, currentPrice, isLoading, error } = useCryptoData(selectedCrypto);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-background via-background to-secondary">
        <div className="absolute inset-0 opacity-20"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Crypto Equilibrium
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Advanced cryptocurrency price analysis with 90-day historical data and equilibrium calculations
            </p>
          </div>

          {/* Main Dashboard */}
          <div className="space-y-8">
            {/* Crypto Selector */}
            <CryptoSelector 
              selectedCrypto={selectedCrypto} 
              onCryptoChange={setSelectedCrypto}
            />

            {/* Error State */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-destructive">
                  <Database className="w-5 h-5" />
                  <span className="font-medium">Data Error: {error}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PriceChart
                data={data}
                isLoading={isLoading}
                cryptoName={`${selectedCrypto} Price Chart`}
                equilibriumLevels={(() => {
                  if (!data || data.length === 0) return [];
                  const today = new Date(data[data.length - 1].date);
                  function getAvgSince(daysAgo: number, label: string, color: string) {
                    const sinceDate = new Date(today);
                    sinceDate.setDate(today.getDate() - daysAgo + 1);
                    const filtered = data.filter(d => new Date(d.date) >= sinceDate);
                    if (filtered.length === 0) return undefined;
                    return {
                      value: filtered.reduce((acc, d) => acc + d.price, 0) / filtered.length,
                      label,
                      color
                    };
                  }
                  return [
                    getAvgSince(30, '30d', '#FFA500'),
                    getAvgSince(60, '60d', '#FF69B4'),
                    getAvgSince(90, '90d', '#00CED1'),
                  ].filter(Boolean);
                })()}
                goldenRange={(() => {
                  if (!data || data.length === 0) return undefined;
                  const prices = data.map(d => d.price);
                  const min = Math.min(...prices);
                  const max = Math.max(...prices);
                  const range = max - min;
                  // Golden zone: 61.8% to 65% retracement from min to max
                  return [min + range * 0.618, min + range * 0.65];
                })()}
                premiumRange={(() => {
                  if (!data || data.length === 0) return undefined;
                  const prices = data.map(d => d.price);
                  const min = Math.min(...prices);
                  const max = Math.max(...prices);
                  const range = max - min;
                  // Premium range: 50% to 100% from min to max
                  return [min + range * 0.5, max];
                })()}
                currentPrice={currentPrice}
                highest={Math.max(...data.map(d => d.price))}
                lowest={Math.min(...data.map(d => d.price))}
              />
              <EquilibriumStats data={data} currentPrice={currentPrice} cryptoSymbol={selectedCrypto} />
            </div>
            
            {/* Trading Decision Analysis */}
            <div className="mt-8">
              <TradingDecisionPanel 
                data={data || []} 
                currentPrice={currentPrice || 0} 
                cryptoSymbol={selectedCrypto} 
              />
            </div>
            
            <TechnicalIndicators data={data} />
          </div>

          {/* Footer Info */}
          <div className="mt-12 pt-8 border-t border-border">
            <div className="text-center text-sm text-muted-foreground">
              <p>Data provided by Binance API • Cached for 10 minutes to reduce API calls</p>
              <p className="mt-1">
                Equilibrium price calculated as the average closing price over the specified period
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
};

export default Index;
