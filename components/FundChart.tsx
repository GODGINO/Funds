import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { FundDataPoint } from '../types';

interface FundChartProps {
  chartData: (Partial<FundDataPoint> & { zigzagNAV?: number })[];
}

const FundChart: React.FC<FundChartProps> = ({ chartData }) => {
  const yAxisDomain = useMemo(() => {
    if (!chartData || chartData.length < 2) {
      return ['dataMin', 'dataMax'];
    }
    const navValues = chartData.map(p => p.unitNAV).filter(v => v !== undefined) as number[];
    if (navValues.length < 2) {
      return ['dataMin', 'dataMax'];
    }
    const min = Math.min(...navValues);
    const max = Math.max(...navValues);

    if (min === max) {
      return [min * 0.995, max * 1.005];
    }
    
    const range = max - min;
    const padding = range * 0.01;
    
    return [min - padding, max + padding];
  }, [chartData]);

  return (
    <ResponsiveContainer>
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <YAxis hide domain={yAxisDomain} />
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
