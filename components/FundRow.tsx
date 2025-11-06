import React, { useMemo } from 'react';
import { Fund, FundDataPoint } from '../types';
import FundChart from './FundChart';
import { calculateZigzag } from '../services/chartUtils';

interface FundRowProps {
  fund: Fund;
  dateHeaders: string[];
  onShowDetails: (fund: Fund) => void;
  zigzagThreshold: number;
}

const FundRow: React.FC<FundRowProps> = ({ fund, dateHeaders, onShowDetails, zigzagThreshold }) => {
  const dataMap = useMemo(() => {
    return new Map<string, FundDataPoint>(fund.data.map(p => [p.date, p]));
  }, [fund.data]);

  const chartData = useMemo(() => {
    const baseChartData = [...fund.data];
    if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV)) {
      baseChartData.push({
        date: fund.realTimeData.estimationTime,
        unitNAV: fund.realTimeData.estimatedNAV,
        cumulativeNAV: fund.realTimeData.estimatedNAV,
        dailyGrowthRate: fund.realTimeData.estimatedChange,
        subscriptionStatus: 'N/A',
        redemptionStatus: 'N/A',
        dividendDistribution: 'N/A',
      });
    }

    const zigzagPoints = calculateZigzag(baseChartData, zigzagThreshold);
    const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));

    return baseChartData.map(p => ({
      ...p,
      zigzagNAV: zigzagMap.get(p.date)
    }));
  }, [fund.data, fund.realTimeData, zigzagThreshold]);
  
  const latestNAVForComparison = useMemo(() => {
    if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) {
      return fund.realTimeData.estimatedNAV;
    }
    return fund.latestNAV;
  }, [fund.realTimeData, fund.latestNAV]);

  return (
    <tr className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td 
        className="p-0 border-r dark:border-gray-700 text-left sticky left-0 bg-white dark:bg-gray-900 z-[5] w-[200px] min-w-[200px] cursor-pointer"
        onDoubleClick={() => onShowDetails(fund)}
      >
        <div className="flex flex-col h-full justify-center p-2">
          <span className="font-bold text-gray-800 dark:text-gray-100">{fund.name}</span>
          <div className="flex items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400">{fund.code}</span>
          </div>
        </div>
      </td>
      <td className="p-0 border-r dark:border-gray-700 w-[300px] min-w-[300px] sticky left-[200px] bg-white dark:bg-gray-900 z-[5] relative">
        <div className="absolute inset-0">
          <FundChart 
            chartData={chartData} 
          />
        </div>
      </td>
      <td className="p-0 border-r dark:border-gray-700 w-[60px] min-w-[60px] sticky left-[500px] bg-white dark:bg-gray-900 z-[5]">
        {fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) ? (
            <div className="p-2">
              <div className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                {fund.realTimeData.estimatedNAV.toFixed(4)}
              </div>
              <div className={`text-xs font-semibold ${
                fund.realTimeData.estimatedChange.startsWith('-') ? 'text-green-600' : 'text-red-500'
              }`}>
                {fund.realTimeData.estimatedChange}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {fund.realTimeData.estimationTime.split(' ')[1] || fund.realTimeData.estimationTime}
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
          <td key={date} className="p-0 border-r dark:border-gray-700">
            {point ? (
              <div className="p-2">
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
