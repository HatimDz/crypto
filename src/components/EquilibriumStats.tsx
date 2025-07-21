import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

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

interface EquilibriumStatsProps {
  data: PriceData[];
  currentPrice: number;
  cryptoSymbol: string;
}

interface EquilibriumData {
  period: string;
  days: number;
  price: number;
  change: number;
  changePercent: number;
}

export const EquilibriumStats = ({ data, currentPrice, cryptoSymbol }: EquilibriumStatsProps) => {
  // Calculate equilibrium prices for different periods
  const calculateEquilibrium = (days: number): number => {
    if (!data || data.length === 0) return 0;
    const relevantData = data.slice(-days);
    const means = relevantData.map(item => {
      const open = item.open ?? item.price ?? 0;
      const close = item.close ?? item.price ?? 0;
      const high = Math.max(open, close);
      const low = Math.min(open, close);
      return (high + low) / 2;
    });
    const validMeans = means.filter(mean => !isNaN(mean));
    if (validMeans.length === 0) return 0;
    const sum = validMeans.reduce((acc, mean) => acc + mean, 0);
    return sum / validMeans.length;
  };

  const equilibriumData: EquilibriumData[] = [
    {
      period: "30 Days",
      days: 30,
      price: calculateEquilibrium(30),
      change: 0,
      changePercent: 0,
    },
    {
      period: "60 Days", 
      days: 60,
      price: calculateEquilibrium(60),
      change: 0,
      changePercent: 0,
    },
    {
      period: "90 Days",
      days: 90,
      price: calculateEquilibrium(90),
      change: 0,
      changePercent: 0,
    },
  ];

  // Calculate changes relative to current price
  equilibriumData.forEach(item => {
    item.change = currentPrice - item.price;
    item.changePercent = item.price > 0 ? ((currentPrice - item.price) / item.price) * 100 : 0;
  });

  const StatCard = ({ data }: { data: EquilibriumData }) => {
    const isPositive = data.change >= 0;
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
    const trendColor = isPositive ? "text-profit" : "text-loss";

    return (
      <Card className="p-4 bg-gradient-to-br from-card to-secondary border-border hover:border-primary/20 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">{data.period} Avg</h3>
          <TrendIcon className={`w-4 h-4 ${trendColor}`} />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-lg font-semibold text-foreground">
              {data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          
          <div className="flex flex-col text-xs">
            <span className={`font-medium ${trendColor}`}>
              {isPositive ? '+' : ''}{data.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`${trendColor}`}>
              ({isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </Card>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[30, 60, 90].map(days => (
          <Card key={days} className="p-4 bg-gradient-to-br from-card to-secondary border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">{days} Days Avg</h3>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-muted-foreground">No data available</div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent/10">
          <DollarSign className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Equilibrium Analysis</h2>
          <p className="text-muted-foreground text-sm">
            Average prices vs current {cryptoSymbol} price: ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {equilibriumData.map((data, index) => (
          <StatCard key={index} data={data} />
        ))}
      </div>
    </div>
  );
};