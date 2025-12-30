import React, { useMemo, useState, useCallback } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine, XAxis, ReferenceArea, Tooltip, ReferenceDot } from 'recharts';
import { FundDataPoint, TradingRecord, TransactionType } from '../types';

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
  changeSinceDate?: number; 
  changeFromBaseline?: number; 
  tradeRecord?: TradingRecord; 
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

const getTransactionLabel = (type: TransactionType) => {
    switch (type) {
        case 'buy': return '买入';
        case 'sell': return '卖出';
        case 'dividend-cash': return '现金分红';
        case 'dividend-reinvest': return '红利再投';
        default: return '交易';
    }
}

const getTransactionColor = (type: TransactionType) => {
    switch (type) {
        case 'buy': return '#ef4444'; 
        case 'sell': return '#3b82f6'; 
        case 'dividend-cash': return '#d97706'; 
        case 'dividend-reinvest': return '#8b5cf6'; 
        default: return '#9ca3af';
    }
}

const getTransactionLabelColorClass = (type: TransactionType) => {
    switch (type) {
        case 'buy': return 'text-red-500';
        case 'sell': return 'text-blue-500';
        case 'dividend-cash': return 'text-yellow-600';
        case 'dividend-reinvest': return 'text-purple-500';
        default: return 'text-gray-500';
    }
}

const CustomTooltip: React.FC<any> = ({ active, payload, localBaselineDate }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as ChartDataPoint;
        const { date, dailyGrowthRate, dailyProfit, changeSinceDate, changeFromBaseline, tradeRecord } = data;

        if (!date) return null;

        const displayDate = date.split(' ')[0];
        const displayBaselineDate = localBaselineDate ? localBaselineDate.split(' ')[0] : '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dataDate = new Date(displayDate);
        dataDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - dataDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const daysAgoText = diffDays === 0 ? '今天' : `${diffDays}天前`;

        const isGrowthPositive = dailyGrowthRate ? !dailyGrowthRate.startsWith('-') : true;
        const isBaselineActive = !!localBaselineDate;
        const relChangeValue = isBaselineActive ? changeFromBaseline : changeSinceDate;
        const relChangeLabel = isBaselineActive ? "较基准涨跌:" : "距今涨跌:";
        const isBaselinePoint = isBaselineActive && date === localBaselineDate;

        let diffDaysBetween = 0;
        if (isBaselineActive) {
            const bDate = new Date(displayBaselineDate);
            bDate.setHours(0, 0, 0, 0);
            diffDaysBetween = Math.round((dataDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        return (
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-1.5 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 text-[10px] leading-tight min-w-[150px] pointer-events-none">
                <div className="flex flex-col space-y-0.5">
                    {isBaselineActive && !isBaselinePoint ? (
                         <div className="flex justify-between items-center gap-1 mb-0.5">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">{displayBaselineDate}</span>
                            <span className="text-gray-400 dark:text-gray-500 scale-90 whitespace-nowrap">{Math.abs(diffDaysBetween)}天</span>
                            <span className="text-gray-800 dark:text-gray-100 font-semibold">{displayDate}</span>
                        </div>
                    ) : (
                        <div className="flex justify-between items-baseline gap-2 mb-0.5">
                            <span className={`font-semibold whitespace-nowrap ${isBaselinePoint ? 'text-blue-600 dark:text-blue-400 underline' : 'text-gray-800 dark:text-gray-100'}`}>
                                {displayDate}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap scale-90 origin-right">{daysAgoText}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-baseline gap-4">
                        <span className="text-gray-500 dark:text-gray-400">当日涨跌:</span>
                        <span className={`font-mono font-bold ${isGrowthPositive ? 'text-red-500' : 'text-green-600'}`}>
                            {dailyGrowthRate || '0.00%'}
                        </span>
                    </div>
                    {dailyProfit !== undefined && (
                        <div className="flex justify-between items-baseline gap-4">
                            <span className="text-gray-500 dark:text-gray-400">当日收益:</span>
                            <span className={`font-mono font-bold ${getProfitColor(dailyProfit)}`}>
                                {dailyProfit.toFixed(2)}
                            </span>
                        </div>
                    )}
                    {relChangeValue !== undefined && (
                        <div className="flex justify-between items-baseline gap-4">
                            <span className={isBaselineActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'}>
                                {relChangeLabel}
                            </span>
                            <span className={`font-mono font-bold ${getProfitColor(relChangeValue)}`}>
                                {relChangeValue > 0 ? '+' : ''}{relChangeValue.toFixed(2)}%
                            </span>
                        </div>
                    )}
                    {tradeRecord && (
                        <div className="flex justify-between items-baseline gap-4 pt-0.5">
                            <span className={`font-semibold ${getTransactionLabelColorClass(tradeRecord.type)}`}>
                                {getTransactionLabel(tradeRecord.type)}:
                            </span>
                            <span className="font-mono font-bold text-gray-800 dark:text-gray-100">
                                {tradeRecord.type === 'buy' ? `${tradeRecord.amount!.toFixed(2)} 元` : 
                                 tradeRecord.type === 'sell' ? `${Math.abs(tradeRecord.sharesChange!).toFixed(2)} 份` :
                                 tradeRecord.type === 'dividend-cash' ? `${tradeRecord.realizedProfitChange!.toFixed(2)} 元` :
                                 `${tradeRecord.sharesChange!.toFixed(2)} 份`}
                            </span>
                        </div>
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
  const [localBaselineDate, setLocalBaselineDate] = useState<string | null>(null);
  const [hoveredNAV, setHoveredNAV] = useState<number | null>(null);
    
  const confirmedTradingRecords = useMemo(() => {
    return tradingRecords?.filter(r => r.nav !== undefined);
  }, [tradingRecords]);

  const localBaselineNAV = useMemo(() => {
    if (!localBaselineDate) return null;
    return baseChartData.find(p => p.date === localBaselineDate)?.unitNAV ?? null;
  }, [localBaselineDate, baseChartData]);

  // 查找趋势起点的净值，用于绘制水平虚线
  const lastPivotNAV = useMemo(() => {
    if (!lastPivotDate) return null;
    return zigzagPoints.find(p => p.date === lastPivotDate)?.unitNAV ?? null;
  }, [lastPivotDate, zigzagPoints]);

  const chartDataForRender = useMemo(() => {
    const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));
    const tradeMap = new Map(confirmedTradingRecords?.map(r => [r.date, r]));
    const latestNAV = baseChartData.length > 0 ? (baseChartData[baseChartData.length - 1].unitNAV ?? 0) : 0;
    
    return baseChartData.map((p, index, arr) => {
        const zigzagNAV = zigzagMap.get(p.date);
        const tradeRecord = p.date ? tradeMap.get(p.date.split(' ')[0]) : undefined;
        let dailyProfit = 0;
        let changeSinceDate = 0;
        let changeFromBaseline = 0;

        if (index > 0 && shares > 0) {
            const prevPoint = arr[index - 1];
            const currentNav = p.unitNAV ?? 0;
            const prevNav = prevPoint.unitNAV ?? 0;
            if (currentNav > 0 && prevNav > 0) {
                 dailyProfit = (currentNav - prevNav) * shares;
            }
        }
        if (p.unitNAV && p.unitNAV > 0 && latestNAV > 0) {
            changeSinceDate = ((latestNAV - p.unitNAV) / p.unitNAV) * 100;
        }
        if (localBaselineNAV && localBaselineNAV > 0 && p.unitNAV !== undefined) {
            changeFromBaseline = ((p.unitNAV - localBaselineNAV) / localBaselineNAV) * 100;
        }
        return { ...p, zigzagNAV, dailyProfit, changeSinceDate, changeFromBaseline, tradeRecord };
    });
  }, [baseChartData, zigzagPoints, shares, confirmedTradingRecords, localBaselineNAV]);

  const yAxisDomain = useMemo(() => {
    const navValues = baseChartData.map(p => p.unitNAV).filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const allValues = [...navValues];
    if (costPrice && costPrice > 0) allValues.push(costPrice);
    if (actualCostPrice && actualCostPrice > 0) allValues.push(actualCostPrice);
    
    if (allValues.length < 1) return ['auto', 'auto'];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    if (min === max) return [min * 0.995, max * 1.005];
    
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

  const handleChartClick = useCallback((state: any) => {
    if (state && state.activeLabel) {
      const clickedDate = state.activeLabel;
      setLocalBaselineDate(prev => prev === clickedDate ? null : clickedDate);
    }
  }, []);

  const handleMouseMove = useCallback((state: any) => {
    if (state && state.activeTooltipIndex !== undefined) {
      const point = chartDataForRender[state.activeTooltipIndex];
      if (point && typeof point.unitNAV === 'number') {
        setHoveredNAV(point.unitNAV);
        return;
      }
    }
    setHoveredNAV(null);
  }, [chartDataForRender]);


  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer minWidth={0}>
        <LineChart 
          data={chartDataForRender} 
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          onClick={handleChartClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredNAV(null)}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2}/>
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="date" type="category" hide />
          <YAxis hide domain={yAxisDomain} yAxisId="main" />

          <Tooltip 
            content={<CustomTooltip localBaselineDate={localBaselineDate} />} 
            cursor={{ stroke: '#a0a0a0', strokeWidth: 1.33, strokeDasharray: '3 3' }} 
            wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} 
          />

          {costPrice && costPrice > 0 && (
            <ReferenceArea 
              yAxisId="main"
              y1={0} 
              y2={costPrice} 
              fill={`url(#${gradientId})`} 
              strokeOpacity={0} 
              ifOverflow="hidden" 
            />
          )}
          
          {/* 趋势起点十字准星 (静态灰色) */}
          {lastPivotDate && (
              <ReferenceLine 
                  yAxisId="main"
                  x={lastPivotDate} 
                  stroke="#a0a0a0" 
                  strokeDasharray="3 3" 
                  strokeWidth={1.33} 
              />
          )}
          {lastPivotNAV !== null && (
              <ReferenceLine 
                  yAxisId="main"
                  y={lastPivotNAV} 
                  stroke="#a0a0a0" 
                  strokeDasharray="3 3" 
                  strokeWidth={1.33} 
              />
          )}

          {localBaselineDate && (
              <ReferenceLine 
                  yAxisId="main"
                  x={localBaselineDate} 
                  stroke="#3b82f6" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
              />
          )}

          {costPrice && costPrice > 0 && (
            <ReferenceLine 
              yAxisId="main"
              y={costPrice} 
              stroke="#ef4444" 
              strokeWidth={1.33} 
              label={showLabels ? { value: `成本: ${costPrice.toFixed(4)}`, position: 'insideTopLeft', fill: '#ef4444', fontSize: 10, dy: -2 } : undefined}
            />
          )}
          
          {actualCostPrice && actualCostPrice > 0 && actualCostPrice.toFixed(4) !== costPrice?.toFixed(4) && (
            <ReferenceLine 
              yAxisId="main"
              y={actualCostPrice} 
              stroke="#6b7280" 
              strokeDasharray="3 3" 
              strokeWidth={1.33}
              label={showLabels ? { value: `实际: ${actualCostPrice.toFixed(4)}`, position: 'insideTopLeft', fill: '#374151', fontSize: 10, dy: -2 } : undefined}
            />
          )}
          
          <Line
            yAxisId="main"
            type="linear"
            dataKey="unitNAV"
            stroke="#3b82f6"
            strokeWidth={1.33}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="main"
            type="linear"
            dataKey="zigzagNAV"
            connectNulls
            stroke="#a0a0a0"
            strokeWidth={1.33}
            dot={false}
            isAnimationActive={false}
          />
          {confirmedTradingRecords?.map(record => (
            <ReferenceDot 
              yAxisId="main"
              key={record.date} 
              x={record.date} 
              y={record.nav!} 
              r={4}
              fill={getTransactionColor(record.type)}
              stroke="#ffffff"
              strokeWidth={1.33}
            />
          ))}

          {/* Hover Horizontal Line (Render last for top-most z-index) */}
          {hoveredNAV !== null && (
              <ReferenceLine 
                yAxisId="main"
                y={hoveredNAV} 
                stroke="#a0a0a0" 
                strokeDasharray="3 3" 
                strokeWidth={1.33}
                ifOverflow="visible"
              />
          )}

          {/* Clicked Horizontal Line (Render last for top-most z-index) */}
          {localBaselineNAV !== null && (
              <ReferenceLine 
                  yAxisId="main"
                  y={localBaselineNAV} 
                  stroke="#3b82f6" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  ifOverflow="visible"
              />
          )}
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
