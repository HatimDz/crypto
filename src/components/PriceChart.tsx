import React, { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, ComposedChart, Bar } from 'recharts';
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

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

interface EquilibriumLevel {
  value: number;
  label: string;
  color: string;
}

interface PriceChartProps {
  data: PriceData[];
  isLoading: boolean;
  cryptoName: string;
  equilibriumLevels?: EquilibriumLevel[];
  goldenRange?: [number, number];
  premiumRange?: [number, number];
  currentPrice?: number;
  highest?: number;
  lowest?: number;
}

// Custom tooltip component for the chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-foreground font-medium">{label}</p>
        {data.open !== undefined ? (
          <div className="space-y-1">
            <p className="text-sm"><span className="text-muted-foreground">Open:</span> <span className="font-semibold">${data.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">High:</span> <span className="font-semibold text-green-500">${data.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Low:</span> <span className="font-semibold text-red-500">${data.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Close:</span> <span className="font-semibold">${data.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
          </div>
        ) : (
          <p className="text-primary font-semibold">
            ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Custom Candlestick Component
const CandlestickChart = ({ 
  data, 
  margin, 
  equilibriumLevels = [], 
  goldenRange, 
  premiumRange, 
  currentPrice, 
  highest, 
  lowest,
  showEquilibrium,
  showGolden,
  showPremium,
  showCurrent,
  showHigh,
  showLow
}: any) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: width || 800, height: height || 600 });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  if (!data || data.length === 0) return null;
  
  const prices = data.flatMap((d: any) => [d.high, d.low, d.open, d.close]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  
  const { width, height } = dimensions;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const candleWidth = Math.max(2, chartWidth / data.length * 0.6);
  
  // Helper function to convert price to Y coordinate
  const priceToY = (price: number) => ((maxPrice - price) / priceRange) * chartHeight;
  
  return (
    <div ref={containerRef} className="w-full h-full">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width={chartWidth} height={chartHeight} fill="url(#grid)" />
        
        {/* Golden Range */}
        {showGolden && goldenRange && (
          <g>
            <rect
              x={0}
              y={priceToY(goldenRange[1])}
              width={chartWidth}
              height={priceToY(goldenRange[0]) - priceToY(goldenRange[1])}
              fill="#FFD700"
              fillOpacity={0.2}
            />
            <text
              x={chartWidth + 5}
              y={priceToY(goldenRange[1]) + (priceToY(goldenRange[0]) - priceToY(goldenRange[1])) / 2 + 4}
              fill="#FFD700"
              fontSize="11"
              fontWeight="bold"
            >
              Golden: ${goldenRange[0].toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${goldenRange[1].toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        )}
        
        {/* Premium Range */}
        {showPremium && premiumRange && (
          <g>
            <rect
              x={0}
              y={priceToY(premiumRange[1])}
              width={chartWidth}
              height={priceToY(premiumRange[0]) - priceToY(premiumRange[1])}
              fill="#00BFFF"
              fillOpacity={0.15}
            />
            <text
              x={chartWidth + 5}
              y={priceToY(premiumRange[1]) + (priceToY(premiumRange[0]) - priceToY(premiumRange[1])) / 2 + 4}
              fill="#00BFFF"
              fontSize="11"
              fontWeight="bold"
            >
              Premium: ${premiumRange[0].toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${premiumRange[1].toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        )}
        
        {/* Equilibrium Lines */}
        {showEquilibrium && equilibriumLevels.map((eq: any, idx: number) => (
          <g key={idx}>
            <line
              x1={0}
              x2={chartWidth}
              y1={priceToY(eq.value)}
              y2={priceToY(eq.value)}
              stroke={eq.color}
              strokeWidth={2}
              strokeDasharray="6 2"
            />
            <text
              x={chartWidth + 5}
              y={priceToY(eq.value) + 4}
              fill={eq.color}
              fontSize="12"
              fontWeight="bold"
            >
              {eq.label}: ${eq.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}
        
        {/* Current Price Line */}
        {showCurrent && currentPrice && (
          <g>
            <line
              x1={0}
              x2={chartWidth}
              y1={priceToY(currentPrice)}
              y2={priceToY(currentPrice)}
              stroke="#00FF00"
              strokeWidth={2}
              strokeDasharray="3 3"
            />
            <text
              x={chartWidth + 5}
              y={priceToY(currentPrice) + 4}
              fill="#00FF00"
              fontSize="12"
              fontWeight="bold"
            >
              Current: ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        )}
        
        {/* High Price Line */}
        {showHigh && highest && (
          <g>
            <line
              x1={0}
              x2={chartWidth}
              y1={priceToY(highest)}
              y2={priceToY(highest)}
              stroke="#FF0000"
              strokeWidth={2}
              strokeDasharray="2 2"
            />
            <text
              x={chartWidth + 5}
              y={priceToY(highest) + 4}
              fill="#FF0000"
              fontSize="12"
              fontWeight="bold"
            >
              High: ${highest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        )}
        
        {/* Low Price Line */}
        {showLow && lowest && (
          <g>
            <line
              x1={0}
              x2={chartWidth}
              y1={priceToY(lowest)}
              y2={priceToY(lowest)}
              stroke="#0000FF"
              strokeWidth={2}
              strokeDasharray="2 2"
            />
            <text
              x={chartWidth + 5}
              y={priceToY(lowest) + 4}
              fill="#0000FF"
              fontSize="12"
              fontWeight="bold"
            >
              Low: ${lowest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        )}
        
        {/* Candlesticks */}
        {data.map((item: any, index: number) => {
          const x = (index * chartWidth) / data.length + chartWidth / data.length / 2;
          const isGreen = item.close >= item.open;
          
          // Calculate Y positions
          const highY = priceToY(item.high);
          const lowY = priceToY(item.low);
          const openY = priceToY(item.open);
          const closeY = priceToY(item.close);
          
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.abs(closeY - openY);
          
          return (
            <g key={index}>
              {/* Wick */}
              <line
                x1={x}
                x2={x}
                y1={highY}
                y2={lowY}
                stroke={isGreen ? '#22c55e' : '#ef4444'}
                strokeWidth={1}
              />
              {/* Body */}
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={Math.max(1, bodyHeight)}
                fill={isGreen ? '#22c55e' : '#ef4444'}
                stroke={isGreen ? '#22c55e' : '#ef4444'}
              />
            </g>
          );
        })}
        
        {/* Y-axis labels */}
        <g>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const price = maxPrice - (ratio * priceRange);
            const y = ratio * chartHeight;
            return (
              <g key={idx}>
                <text
                  x={-10}
                  y={y + 4}
                  fill="#9CA3AF"
                  fontSize="12"
                  textAnchor="end"
                >
                  ${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </text>
              </g>
            );
          })}
        </g>
      </g>
      </svg>
    </div>
  );
};

export const PriceChart = ({
  data,
  isLoading,
  cryptoName,
  equilibriumLevels = [],
  goldenRange,
  premiumRange,
  currentPrice,
  highest,
  lowest
}: PriceChartProps) => {
  // Toggle state for each visual element
  const [showEquilibrium, setShowEquilibrium] = useState(true);
  const [showGolden, setShowGolden] = useState(true);
  const [showPremium, setShowPremium] = useState(true);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showHigh, setShowHigh] = useState(true);
  const [showLow, setShowLow] = useState(true);
  const [chartMode, setChartMode] = useState<'line' | 'candle'>('line');
  if (isLoading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Price Chart</h2>
        </div>
        <Skeleton className="w-full h-80 bg-muted" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Price Chart</h2>
        </div>
        <div className="flex items-center justify-center h-80 text-muted-foreground">
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-secondary border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{cryptoName} Price Chart</h2>
          <p className="text-muted-foreground text-sm">90-day price history</p>
        </div>
      </div>

      {/* Chart Mode Toggle */}
      <div className="mb-4 flex justify-center gap-2">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chartMode === 'line'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          onClick={() => setChartMode('line')}
        >
          Line Chart
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chartMode === 'candle'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          onClick={() => setChartMode('candle')}
        >
          Candlestick
        </button>
      </div>

      <div className="h-[600px] w-full max-w-5xl mx-auto">
        {chartMode === 'candle' ? (
          <div className="relative w-full h-full overflow-hidden">
            <div className="w-full h-full">
              <CandlestickChart 
                data={data} 
                margin={{ top: 30, right: 60, left: 60, bottom: 30 }}
                equilibriumLevels={equilibriumLevels}
                goldenRange={goldenRange}
                premiumRange={premiumRange}
                currentPrice={currentPrice}
                highest={highest}
                lowest={lowest}
                showEquilibrium={showEquilibrium}
                showGolden={showGolden}
                showPremium={showPremium}
                showCurrent={showCurrent}
                showHigh={showHigh}
                showLow={showLow}
              />
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 30, right: 60, left: 40, bottom: 30 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--chart-grid))" 
              opacity={0.3}
            />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            {/* Golden Range Shading */}
            {showGolden && goldenRange && (
              <ReferenceArea 
                y1={goldenRange[0]} 
                y2={goldenRange[1]} 
                stroke="none" 
                fill="#FFD70033" 
                fillOpacity={0.2}
              />
            )}
            {/* Premium Range Shading */}
            {showPremium && premiumRange && (
              <ReferenceArea 
                y1={premiumRange[0]} 
                y2={premiumRange[1]} 
                stroke="none" 
                fill="#00BFFF33" 
                fillOpacity={0.15}
              />
            )}
            {/* Equilibrium Lines */}
            {showEquilibrium && equilibriumLevels.map((eq, idx) => (
              <ReferenceLine
                key={idx}
                y={eq.value}
                stroke={eq.color}
                strokeDasharray="6 2"
              />
            ))}
            {/* Current Price Line */}
            {showCurrent && currentPrice && (
              <ReferenceLine
                y={currentPrice}
                stroke="#00FF00"
                strokeDasharray="3 3"
              />
            )}
            {/* Highest/Lowest Price Lines */}
            {showHigh && highest && (
              <ReferenceLine
                y={highest}
                stroke="#FF0000"
                strokeDasharray="2 2"
              />
            )}
            {showLow && lowest && (
              <ReferenceLine
                y={lowest}
                stroke="#0000FF"
                strokeDasharray="2 2"
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            {chartMode === 'line' ? (
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                activeDot={{ 
                  r: 4, 
                  fill: 'hsl(var(--primary))',
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2
                }}
              />
            ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground items-center justify-center">
        <button
          className={`flex items-center gap-2 px-2 py-1 rounded ${showEquilibrium ? 'bg-orange-800/40' : 'bg-muted'} hover:bg-orange-900/60`}
          onClick={() => setShowEquilibrium(v => !v)}
        >
          {equilibriumLevels.map((eq, idx) => (
            <span key={eq.label} className="flex items-center gap-1">
              <span style={{color: eq.color}}>─ ─</span> {eq.label}
            </span>
          ))}
        </button>
        <button
          className={`flex items-center gap-2 px-2 py-1 rounded ${showGolden ? 'bg-yellow-800/40' : 'bg-muted'} hover:bg-yellow-900/60`}
          onClick={() => setShowGolden(v => !v)}
        >
          <span style={{color:'#FFD700'}}>■■</span> Golden Range
        </button>
        <button
          className={`flex items-center gap-2 px-2 py-1 rounded ${showPremium ? 'bg-blue-800/40' : 'bg-muted'} hover:bg-blue-900/60`}
          onClick={() => setShowPremium(v => !v)}
        >
          <span style={{color:'#00BFFF'}}>■■</span> Premium Range
        </button>
        <button
          className={`flex items-center gap-2 px-2 py-1 rounded ${showCurrent ? 'bg-green-800/40' : 'bg-muted'} hover:bg-green-900/60`}
          onClick={() => setShowCurrent(v => !v)}
        >
          <span style={{color:'#00FF00'}}>─ ─</span> Current Price
        </button>
        <button
          className={`flex items-center gap-2 px-2 py-1 rounded ${showHigh ? 'bg-red-800/40' : 'bg-muted'} hover:bg-red-900/60`}
          onClick={() => setShowHigh(v => !v)}
        >
          <span style={{color:'#FF0000'}}>─ ─</span> High
        </button>
        <button
          className={`flex items-center gap-2 px-2 py-1 rounded ${showLow ? 'bg-blue-800/40' : 'bg-muted'} hover:bg-blue-900/60`}
          onClick={() => setShowLow(v => !v)}
        >
          <span style={{color:'#0000FF'}}>─ ─</span> Low
        </button>
      </div>
    </Card>
  );
};