import React, { useMemo, useState } from 'react';
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
  changeFromBaseline?: number; // 新增：相对于局部基准点的变动
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dataDate = new Date(date.split(' ')[0]);
        dataDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - dataDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const daysAgoText = diffDays === 0 ? '今天' : `${diffDays}天前`;

        const isGrowthPositive = dailyGrowthRate ? !dailyGrowthRate.startsWith('-') : true;

        // 判断是否处于锚点模式
        const isBaselineActive = !!localBaselineDate;
        const relChangeValue = isBaselineActive ? changeFromBaseline : changeSinceDate;
        const relChangeLabel = isBaselineActive ? "较基准涨跌:" : "距今涨跌:";
        const isBaselinePoint = isBaselineActive && date === localBaselineDate;

        return (
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-2 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 text-xs min-w-[150px] pointer-events-none">
                <div className="flex flex-col space-y-1.5">
                    {/* Header */}
                    <div className="flex justify-between items-baseline gap-2 mb-0.5 border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className={`font-semibold whitespace-nowrap ${isBaselinePoint ? 'text-blue-600 dark:text-blue-400 underline' : 'text-gray-800 dark:text-gray-100'}`}>
                            {date}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{daysAgoText}</span>
                    </div>
                    
                    {/* Basic Market Info */}
                    <div className="flex justify-between items-baseline gap-4">
                        <span className="text-gray-600 dark:text-gray-400">当日涨跌:</span>
                        <span className={`font-mono font-bold ${isGrowthPositive ? 'text-red-500' : 'text-green-600'}`}>
                            {dailyGrowthRate || '0.00%'}
                        </span>
                    </div>

                    {dailyProfit !== undefined && (
                        <div className="flex justify-between items-baseline gap-4">
                            <span className="text-gray-600 dark:text-gray-400">当日收益:</span>
                            <span className={`font-mono font-bold ${getProfitColor(dailyProfit)}`}>
                                {dailyProfit.toFixed(2)}
                            </span>
                        </div>
                    )}

                    {relChangeValue !== undefined && (
                        <div className="flex justify-between items-baseline gap-4">
                            <span className={isBaselineActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-600 dark:text-gray-400'}>
                                {relChangeLabel}
                            </span>
                            <span className={`font-mono font-bold ${getProfitColor(relChangeValue)}`}>
                                {relChangeValue > 0 ? '+' : ''}{relChangeValue.toFixed(2)}%
                            </span>
                        </div>
                    )}

                    {/* Trade Info */}
                    {tradeRecord && (
                        <div className="flex justify-between items-baseline gap-4">
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
  // 定义局部基准点状态
  const [localBaselineDate, setLocalBaselineDate] = useState<string | null>(null);
    
  const confirmedTradingRecords = useMemo(() => {
    return tradingRecords?.filter(r => r.nav !== undefined);
  }, [tradingRecords]);

  const chartDataForRender = useMemo(() => {
    const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));
    const tradeMap = new Map(confirmedTradingRecords?.map(r => [r.date, r]));
    const latestNAV = baseChartData.length > 0 ? (baseChartData[baseChartData.length - 1].unitNAV ?? 0) : 0;
    
    // 找到当前选定基准日的净值
    const baselinePoint = localBaselineDate ? baseChartData.find(p => p.date === localBaselineDate) : null;
    const baselineNAV = baselinePoint?.unitNAV ?? null;

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

        // 计算相对于基准点的变动
        if (baselineNAV && baselineNAV > 0 && p.unitNAV !== undefined) {
            changeFromBaseline = ((p.unitNAV - baselineNAV) / baselineNAV) * 100;
        }
        
        return { ...p, zigzagNAV, dailyProfit, changeSinceDate, changeFromBaseline, tradeRecord };
    });
  }, [baseChartData, zigzagPoints, shares, confirmedTradingRecords, localBaselineDate]);

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

  // 处理图表点击设置/取消基准
  const handleChartClick = (state: any) => {
    if (state && state.activeLabel) {
      const clickedDate = state.activeLabel;
      setLocalBaselineDate(prev => prev === clickedDate ? null : clickedDate);
    }
  };


  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer minWidth={0}>
        <LineChart 
          data={chartDataForRender} 
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          onClick={handleChartClick}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2}/>
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="date" type="category" hide />
          <YAxis hide domain={yAxisDomain} />

          <Tooltip 
            content={<CustomTooltip localBaselineDate={localBaselineDate} />} 
            cursor={{ stroke: '#a0a0a0', strokeWidth: 1, strokeDasharray: '3 3' }} 
            wrapperStyle={{ zIndex: 100 }} 
          />
          
          {costPrice && costPrice > 0 && (
            <ReferenceArea 
              y1={0} 
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

          {/* 渲染局部基准日参考线 */}
          {localBaselineDate && (
              <ReferenceLine 
                  x={localBaselineDate} 
                  stroke="#3b82f6" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
              />
          )}

          {costPrice && costPrice > 0 && (
            <ReferenceLine 
              y={costPrice} 
              stroke="#ef4444" 
              strokeWidth={1} 
              label={showLabels ? { value: `成本: ${costPrice.toFixed(4)}`, position: 'insideTopLeft', fill: '#ef4444', fontSize: 10, dy: -2 } : undefined}
            />
          )}
          
          {actualCostPrice && actualCostPrice > 0 && actualCostPrice.toFixed(4) !== costPrice?.toFixed(4) && (
            <ReferenceLine 
              y={actualCostPrice} 
              stroke="#6b7280" 
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
          {confirmedTradingRecords?.map(record => (
            <ReferenceDot 
              key={record.date} 
              x={record.date} 
              y={record.nav!} 
              r={4}
              fill={getTransactionColor(record.type)}
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