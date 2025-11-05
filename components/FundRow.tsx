import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Fund, FundDataPoint } from '../types';

interface FundRowProps {
  fund: Fund;
  dateHeaders: string[];
}

const FundRow: React.FC<FundRowProps> = ({ fund, dateHeaders }) => {
  const dataMap = useMemo(() => {
    return new Map<string, FundDataPoint>(fund.data.map(p => [p.date, p]));
  }, [fund.data]);

  const chartData = useMemo(() => {
    const combinedData = [...fund.data];
    if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV)) {
      combinedData.push({
        date: fund.realTimeData.estimationTime,
        unitNAV: fund.realTimeData.estimatedNAV,
        cumulativeNAV: fund.realTimeData.estimatedNAV,
        dailyGrowthRate: fund.realTimeData.estimatedChange,
        subscriptionStatus: 'N/A',
        redemptionStatus: 'N/A',
        dividendDistribution: 'N/A',
      });
    }
    return combinedData;
  }, [fund.data, fund.realTimeData]);
  
  // Calculate a tight Y-axis domain to make fluctuations more visible
  const yAxisDomain = useMemo(() => {
    if (!chartData || chartData.length < 2) {
      return ['dataMin', 'dataMax']; // Fallback to default
    }
    const navValues = chartData.map(p => p.unitNAV);
    const min = Math.min(...navValues);
    const max = Math.max(...navValues);

    if (min === max) {
      // If all values are the same, add a small buffer to show a flat line
      return [min * 0.995, max * 1.005];
    }
    
    // Add a very small padding (e.g., 1% of the range) to the top and bottom
    const range = max - min;
    const padding = range * 0.01;
    
    return [min - padding, max + padding];
  }, [chartData]);


  const isPositive = useMemo(() => {
    if (fund.realTimeData?.estimatedChange) {
      return !fund.realTimeData.estimatedChange.startsWith('-');
    }
    if (fund.latestChange) {
      return !fund.latestChange.startsWith('-');
    }
    return true;
  }, [fund.realTimeData, fund.latestChange]);
  
  const latestNAVForComparison = useMemo(() => {
    if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) {
      return fund.realTimeData.estimatedNAV;
    }
    return fund.latestNAV;
  }, [fund.realTimeData, fund.latestNAV]);

  return (
    <tr className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="p-2 border-r dark:border-gray-700 text-left sticky left-0 bg-white dark:bg-gray-900 z-[5] w-[200px] min-w-[200px]">
        <div className="flex flex-col h-full justify-center">
          <span className="font-bold text-gray-800 dark:text-gray-100">{fund.name}</span>
          <div className="flex items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400">{fund.code}</span>
          </div>
        </div>
      </td>
      <td className="p-0 border-r dark:border-gray-700 w-[300px] min-w-[300px] sticky left-[200px] bg-white dark:bg-gray-900 z-[5] relative">
        <div className="absolute inset-0">
            <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <YAxis hide domain={yAxisDomain} />
                <Line
                    type="linear"
                    dataKey="unitNAV"
                    stroke={isPositive ? '#ef4444' : '#16a34a'}
                    strokeWidth={2}
                    dot={false}
                />
                </LineChart>
            </ResponsiveContainer>
        </div>
      </td>
      <td className="p-2 border-r dark:border-gray-700 w-[100px] min-w-[100px] sticky left-[500px] bg-white dark:bg-gray-900 z-[5]">
        {fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) ? (
            <div>
              <div className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                {fund.realTimeData.estimatedNAV.toFixed(4)}
              </div>
              <div className={`text-xs font-semibold ${
                fund.realTimeData.estimatedChange.startsWith('-') ? 'text-green-600' : 'text-red-500'
              }`}>
                {fund.realTimeData.estimatedChange}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {fund.realTimeData.estimationTime.substring(5)}
              </div>
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
      </td>
      {dateHeaders.map(date => {
        const point = dataMap.get(date);
        const pointIsPositive = point ? !point.dailyGrowthRate.startsWith('-') : true;

        let changeFromLatest: string | null = null;
        let changeIsPositive = true;

        if (point && latestNAVForComparison) {
          const diff = ((latestNAVForComparison - point.unitNAV) / point.unitNAV) * 100;
          if (!isNaN(diff)) {
              changeIsPositive = diff >= 0;
              changeFromLatest = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`;
          }
        }

        return (
          <td key={date} className="p-2 border-r dark:border-gray-700">
            {point ? (
              <div>
                <div className="font-mono font-semibold text-gray-800 dark:text-gray-200">{point.unitNAV.toFixed(4)}</div>
                <div className={`text-xs font-semibold ${pointIsPositive ? 'text-red-500' : 'text-green-600'}`}>
                  {point.dailyGrowthRate}
                </div>
                 {changeFromLatest !== null && (
                  <div className={`text-xs font-mono mt-1 ${changeIsPositive ? 'text-red-500' : 'text-green-600'}`}>
                    {changeFromLatest}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
        );
      })}
    </tr>
  );
};

export default FundRow;