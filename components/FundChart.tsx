import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine, XAxis, ReferenceArea, Tooltip, ReferenceDot } from 'recharts';
import { FundDataPoint, TradingRecord } from '../types';

// FIX: Redefined ChartDataPoint to explicitly list properties from FundDataPoint.
// This resolves an issue where properties from the extended Partial<FundDataPoint> type were not being recognized.
interface ChartDataPoint {
  date?: string;
  unitNAV?: number;
  cumulativeNAV?: number;
  dailyGrowthRate?: string;
  subscriptionStatus?: string;
  redemptionStatus?: string;
  dividendDistribution?: string;
  zigzagNAV?: number;
  dailyProfit?: number;
  tradeRecord?: TradingRecord; // Added for tooltip
}

interface FundChartProps {
  baseChartData: Partial<FundDataPoint>[];
  zigzagPoints: Partial<FundDataPoint>[];
  shares: number;
  lastPivotDate?: string | null;
  costPrice?: number | null;
  actualCostPrice?: number | null;
  showLabels?: boolean;
  navPercentile?: number | null;
  tradingRecords?: TradingRecord[];
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const CustomTooltip: React.FC<any> = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as ChartDataPoint;
        const { date, dailyGrowthRate, dailyProfit, tradeRecord } = data;

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
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-1.5 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 text-xs">
                <div className="flex flex-col space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                        <span className="font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{date}</span>
                        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{daysAgoText}</span>
                    </div>
                    {tradeRecord ? (
                        <>
                           <div className={`font-bold text-center py-1 ${tradeRecord.type === 'buy' ? 'text-red-500' : 'text-blue-500'}`}>
                                {tradeRecord.type === 'buy' ? '买入记录' : '卖出记录'}
                           </div>
                           <div className="flex justify-between items-baseline gap-4">
                               <span className="font-medium text-gray-700 dark:text-gray-300">成交净值:</span>
                               <span className="font-mono font-semibold">{tradeRecord.nav.toFixed(4)}</span>
                           </div>
                           <div className="flex justify-between items-baseline gap-4">
                               <span className="font-medium text-gray-700 dark:text-gray-300">{tradeRecord.type === 'buy' ? '金额:' : '份额:'}</span>
                               <span className="font-mono font-semibold">
                                   {tradeRecord.type === 'buy' ? `${tradeRecord.amount.toFixed(2)} 元` : `${Math.abs(tradeRecord.sharesChange).toFixed(2)} 份`}
                               </span>
                           </div>
                        </>
                    ) : (
                      <>
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
                      </>
                    )}
                </div>
            </div>
        );
    }
    return null;
};


const FundChart: React.FC<FundChartProps> = ({ 
  baseChartData, 
  zigzagPoints, 
  shares, 
  lastPivotDate, 
  costPrice, 
  actualCostPrice, 
  showLabels = true, 
  navPercentile,
  tradingRecords,
}) => {
    
  const chartDataForRender = useMemo(() => {
    const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));
    const tradeMap = new Map(tradingRecords?.map(r => [r.date, r]));

    return baseChartData.map((p, index, arr) => {
        const zigzagNAV = zigzagMap.get(p.date);
        const tradeRecord = p.date ? tradeMap.get(p.date.split(' ')[0]) : undefined;
        let dailyProfit = 0;

        if (index > 0 && shares > 0) {
            const prevPoint = arr[index - 1];
            const currentNav = p.unitNAV ?? 0;
            const prevNav = prevPoint.unitNAV ?? 0;
            if (currentNav > 0 && prevNav > 0) {
                 dailyProfit = (currentNav - prevNav) * shares;
            }
        }
        
        return { ...p, zigzagNAV, dailyProfit, tradeRecord };
    });
  }, [baseChartData, zigzagPoints, shares, tradingRecords]);

  const yAxisDomain = useMemo(() => {
    const navValues = baseChartData.map(p => p.unitNAV).filter((v): v is number => typeof v === 'number' && !isNaN(v));
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
  }, [baseChartData, costPrice, actualCostPrice]);

  const gradientId = "costAreaGradient";

  const percentileColor = useMemo(() => {
    if (navPercentile === null || navPercentile === undefined) return 'text-gray-500 dark:text-gray-400';
    if (navPercentile <= 20) return 'text-green-600 dark:text-green-500';
    if (navPercentile >= 80) return 'text-red-500 dark:text-red-500';
    return 'text-yellow-600 dark:text-yellow-400';
  }, [navPercentile]);


  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer>
        <LineChart data={chartDataForRender} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2}/>
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="date" type="category" hide />
          <YAxis hide domain={yAxisDomain} />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#a0a0a0', strokeWidth: 1, strokeDasharray: '3 3' }} wrapperStyle={{ zIndex: 100 }} />
          
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
          
          {actualCostPrice && actualCostPrice > 0 && actualCostPrice.toFixed(4) !== costPrice?.toFixed(4) && (
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
          {tradingRecords?.map(record => (
            <ReferenceDot 
              key={record.date} 
              x={record.date} 
              y={record.nav} 
              r={4}
              fill={record.type === 'buy' ? '#ef4444' : '#3b82f6'} // red-500 for buy, blue-500 for sell
              stroke="#ffffff"
              strokeWidth={1}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {navPercentile !== null && navPercentile !== undefined && (
        <div 
          className={`absolute right-2 text-xs font-bold ${percentileColor} ${navPercentile > 50 ? 'bottom-2' : 'top-2'}`}
        >
          {`${navPercentile.toFixed(0)}%`}
        </div>
      )}
    </div>
  );
};

export default FundChart;