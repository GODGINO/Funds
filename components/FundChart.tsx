import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine, XAxis, ReferenceArea } from 'recharts';
import { FundDataPoint } from '../types';

interface FundChartProps {
  chartData: (Partial<FundDataPoint> & { zigzagNAV?: number })[];
  lastPivotDate?: string | null;
  costPrice?: number | null;
  actualCostPrice?: number | null;
  showLabels?: boolean;
}

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