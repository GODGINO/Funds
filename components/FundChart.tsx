import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine, XAxis, ReferenceArea, Tooltip } from 'recharts';
import { FundDataPoint } from '../types';

interface ChartDataPoint extends Partial<FundDataPoint> {
  zigzagNAV?: number;
  dailyProfit?: number;
}

interface FundChartProps {
  chartData: ChartDataPoint[];
  lastPivotDate?: string | null;
  costPrice?: number | null;
  actualCostPrice?: number | null;
  showLabels?: boolean;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const CustomTooltip: React.FC<any> = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as ChartDataPoint;
        const { date, dailyGrowthRate, dailyProfit } = data;

        if (!date) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dataDate = new Date(date.split(' ')[0]);
        dataDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - dataDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const daysAgoText = diffDays === 0 ? '今天' : `${diffDays}天前`;

        const isPositive = dailyGrowthRate ? !dailyGrowthRate.startsWith('-') : true;

        return (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-1 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 text-xs">
                <div className="flex flex-col space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                        <span className="font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{date}</span>
                        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{daysAgoText}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-4">
                        <span className="font-medium text-gray-700 dark:text-gray-300">涨幅:</span>
                        <span className={`font-bold ${isPositive ? 'text-red-500' : 'text-green-600'}`}>
                            {dailyGrowthRate}
                        </span>
                    </div>
                    {dailyProfit !== undefined && dailyProfit !== 0 && (
                         <div className="flex justify-between items-baseline gap-4">
                            <span className="font-medium text-gray-700 dark:text-gray-300">收益:</span>
                            <span className={`font-bold ${getProfitColor(dailyProfit)}`}>
                                {dailyProfit.toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};


const FundChart: React.FC<FundChartProps> = ({ chartData, lastPivotDate, costPrice, actualCostPrice, showLabels = true }) => {
  const yAxisDomain = useMemo(() => {
    const navValues = chartData.map(p => p.unitNAV).filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const allValues = [...navValues];
    if (costPrice && costPrice > 0) allValues.push(costPrice);
    if (actualCostPrice && actualCostPrice > 0) allValues.push(actualCostPrice);
    
    if (allValues.length < 1) {
        return ['auto', 'auto'];
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    if (min === max) {
      return [min * 0.995, max * 1.005];
    }
    
    const range = max - min;
    const padding = range * 0.05;
    
    return [min - padding, max + padding];
  }, [chartData, costPrice, actualCostPrice]);

  const gradientId = "costAreaGradient";

  return (
    <ResponsiveContainer>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2}/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="date" type="category" hide />
        <YAxis hide domain={yAxisDomain} />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#a0a0a0', strokeWidth: 1, strokeDasharray: '3 3' }} />
        
        {costPrice && costPrice > 0 && (
          <ReferenceArea 
            y1={0} // Assume NAV is always positive
            y2={costPrice} 
            fill={`url(#${gradientId})`} 
            strokeOpacity={0} 
            ifOverflow="hidden" 
          />
        )}
        
        {lastPivotDate && (
            <ReferenceLine 
                x={lastPivotDate} 
                stroke="#a0a0a0" 
                strokeDasharray="3 3" 
                strokeWidth={1} 
            />
        )}

        {costPrice && costPrice > 0 && (
          <ReferenceLine 
            y={costPrice} 
            stroke="#ef4444" // red-500
            strokeWidth={1} 
            label={showLabels ? { value: `成本: ${costPrice.toFixed(4)}`, position: 'insideTopLeft', fill: '#ef4444', fontSize: 10, dy: -2 } : undefined}
          />
        )}
        
        {actualCostPrice && actualCostPrice > 0 && (
          <ReferenceLine 
            y={actualCostPrice} 
            stroke="#6b7280" // gray-500
            strokeDasharray="3 3" 
            strokeWidth={1}
            label={showLabels ? { value: `实际: ${actualCostPrice.toFixed(4)}`, position: 'insideTopLeft', fill: '#374151', fontSize: 10, dy: -2 } : undefined}
          />
        )}
        
        <Line
          type="linear"
          dataKey="unitNAV"
          stroke="#3b82f6"
          strokeWidth={1}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="zigzagNAV"
          connectNulls
          stroke="#a0a0a0"
          strokeWidth={1}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default FundChart;