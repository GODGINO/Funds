import React, { useMemo, useState, useCallback } from 'react';
import { Fund, FundDataPoint, UserPosition } from '../types';
import FundChart from './FundChart';

interface ProcessedFund extends Fund {
    trendInfo: {
        text: string;
        isPositive: boolean;
        change: number;
    } | null;
    baseChartData: Partial<FundDataPoint>[];
    zigzagPoints: Partial<FundDataPoint>[];
    lastPivotDate: string | null;
    navPercentile: number | null;
    marketValue?: number;
    costBasis?: number;
    holdingProfit?: number;
    totalProfit?: number;
    actualCost?: number;
}


interface FundRowProps {
  fund: ProcessedFund;
  dateHeaders: string[];
  onShowDetails: (fund: Fund) => void;
  onTagDoubleClick: (tag: string) => void;
}

const SYSTEM_TAG_COLORS: { [key: string]: { bg: string; text: string; } } = {
  '持有': { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300' },
  '自选': { bg: 'bg-gray-200 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300' },
  '盈利': { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
  '亏损': { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
};

const COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300' },
  { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
  { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
  { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-800 dark:text-purple-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/50', text: 'text-pink-800 dark:text-pink-300' },
  { bg: 'bg-gray-200 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300' },
];

const getTagColor = (tag: string) => {
  // A simple hashing function to get a deterministic color for each tag
  let hash = 0;
  if (tag.length === 0) return COLORS[6];
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; 
  }
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
};


const FundRow: React.FC<FundRowProps> = ({ fund, dateHeaders, onShowDetails, onTagDoubleClick }) => {
  const [isCopied, setIsCopied] = useState(false);
  const { trendInfo, baseChartData, zigzagPoints, lastPivotDate, navPercentile } = fund;

  const dataMap = useMemo(() => {
    return new Map<string, FundDataPoint>(fund.data.map(p => [p.date, p]));
  }, [fund.data]);

  const pivotDateSet = useMemo(() => {
    return new Set(zigzagPoints.map(p => p.date));
  }, [zigzagPoints]);

  const chartData = useMemo(() => {
    const shares = fund.userPosition?.shares ?? 0;
    const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));

    return baseChartData.map((p, index, arr) => {
        const zigzagNAV = zigzagMap.get(p.date);
        let dailyProfit = 0;

        if (index > 0 && shares > 0) {
            const prevPoint = arr[index - 1];
            const currentNav = p.unitNAV ?? 0;
            const prevNav = prevPoint.unitNAV ?? 0;
            if (currentNav > 0 && prevNav > 0) {
                 dailyProfit = (currentNav - prevNav) * shares;
            }
        }
        
        return { ...p, zigzagNAV, dailyProfit };
    });
  }, [baseChartData, zigzagPoints, fund.userPosition?.shares]);

  const latestNAVForComparison = useMemo(() => {
    if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) {
      return fund.realTimeData.estimatedNAV;
    }
    return fund.latestNAV;
  }, [fund.realTimeData, fund.latestNAV]);

  const percentileColor = useMemo(() => {
    if (navPercentile === null) return 'text-gray-500 dark:text-gray-400';
    if (navPercentile <= 20) return 'text-green-600 dark:text-green-500';
    if (navPercentile >= 80) return 'text-red-500 dark:text-red-500';
    return 'text-yellow-600 dark:text-yellow-400';
  }, [navPercentile]);
  
  const systemTags = useMemo(() => {
      const tags: string[] = [];
      const position = fund.userPosition;
      const holdingProfit = fund.holdingProfit ?? 0;

      if (position && position.shares > 0) {
          tags.push('持有');
          if (holdingProfit > 0) {
              tags.push('盈利');
          } else if (holdingProfit < 0) {
              tags.push('亏损');
          }
      } else {
          tags.push('自选');
      }
      return tags;
  }, [fund.userPosition, fund.holdingProfit]);

  const handleCopyCode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the row's onDoubleClick
    navigator.clipboard.writeText(fund.code).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1000);
    }).catch(err => {
        console.error('Failed to copy fund code: ', err);
    });
  }, [fund.code]);

  return (
    <tr className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td 
        className="p-0 border-r dark:border-gray-700 text-left md:sticky md:left-0 bg-white dark:bg-gray-900 md:z-[5] w-[250px] min-w-[250px] cursor-pointer"
        onDoubleClick={() => onShowDetails(fund)}
      >
        <div className="flex flex-col h-full justify-between p-2">
          <div>
            <div className="truncate">
              <span className="font-medium text-gray-800 dark:text-gray-100">{fund.name}</span>
              <span 
                className={`ml-2 text-xs transition-colors duration-200 ${isCopied ? 'text-green-500 font-semibold' : 'text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary-500'}`}
                onClick={handleCopyCode}
                title="点击复制基金代码"
              >
                {isCopied ? '复制成功' : fund.code}
              </span>
            </div>
            {trendInfo && (
              <div className={`text-xs mt-1 font-semibold ${trendInfo.isPositive ? 'text-red-500' : 'text-green-600'}`}>
                {trendInfo.text}
              </div>
            )}
            {navPercentile !== null && (
              <div className={`text-xs mt-1 font-semibold ${percentileColor}`}>
                  分位点: {navPercentile.toFixed(2)}%
              </div>
            )}
          </div>
          <div>
            {(systemTags.length > 0 || fund.userPosition?.tag) && (
              <div className="mt-1 flex flex-wrap gap-1 items-center">
                {systemTags.map(tag => {
                  const { bg, text } = SYSTEM_TAG_COLORS[tag];
                  return (
                    <span 
                      key={tag} 
                      className={`inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded ${bg} ${text} cursor-pointer`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onTagDoubleClick(tag);
                      }}
                    >
                      {tag}
                    </span>
                  );
                })}
                {fund.userPosition?.tag?.split(',').map(t => t.trim()).filter(Boolean).map(tag => {
                  const { bg, text } = getTagColor(tag);
                  return (
                    <span 
                      key={tag} 
                      className={`inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded ${bg} ${text} cursor-pointer`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onTagDoubleClick(tag);
                      }}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="p-0 border-r dark:border-gray-700 w-[300px] min-w-[300px] md:sticky md:left-[250px] bg-white dark:bg-gray-900 md:z-[5] relative">
        <div className="absolute inset-0">
          <FundChart 
            chartData={chartData}
            lastPivotDate={lastPivotDate} 
            costPrice={fund.userPosition?.cost && fund.userPosition.cost > 0 ? fund.userPosition.cost : null}
            actualCostPrice={fund.actualCost && fund.actualCost > 0 ? fund.actualCost : null}
            showLabels={false}
          />
        </div>
      </td>
      <td className="p-0 border-r dark:border-gray-700 w-[60px] min-w-[60px] md:sticky md:left-[550px] bg-white dark:bg-gray-900 md:z-[5]">
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
        
        const isPivotDate = pivotDateSet.has(date);

        return (
          <td key={date} className={`p-0 border-r dark:border-gray-700 ${isPivotDate ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
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
