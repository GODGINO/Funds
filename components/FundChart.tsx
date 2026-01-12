import React, { useMemo, useState, useCallback, useRef } from 'react';
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
  forceActualCostPosition?: boolean;
  onSnapshotFilter?: (date: string) => void;
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
        const dataDate = new Date(displayDate); dataDate.setHours(0,0,0,0);
        const diffDays = Math.round((new Date().setHours(0,0,0,0) - dataDate.getTime()) / (1000 * 60 * 60 * 24));
        const relChangeValue = localBaselineDate ? changeFromBaseline : changeSinceDate;
        let diffBetween = 0;
        if (localBaselineDate) {
            const bDate = new Date(displayBaselineDate); bDate.setHours(0,0,0,0);
            diffBetween = Math.round((dataDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        return (
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-1.5 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 text-[10px] leading-tight min-w-[150px] pointer-events-none">
                <div className="flex flex-col space-y-0.5">
                    {localBaselineDate && date !== localBaselineDate ? (
                         <div className="flex justify-between items-center gap-1 mb-0.5">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">{displayBaselineDate}</span>
                            <span className="text-gray-400 dark:text-gray-500 scale-90 whitespace-nowrap">{Math.abs(diffBetween)}天</span>
                            <span className="text-gray-800 dark:text-gray-100 font-semibold">{displayDate}</span>
                        </div>
                    ) : (
                        <div className="flex justify-between items-baseline gap-2 mb-0.5">
                            <span className={`font-semibold whitespace-nowrap ${date === localBaselineDate ? 'text-blue-600 dark:text-blue-400 underline' : 'text-gray-800 dark:text-gray-100'}`}>{displayDate}</span>
                            <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap scale-90 origin-right">{diffDays === 0 ? '今天' : `${diffDays}天前`}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-baseline gap-4">
                        <span className="text-gray-500 dark:text-gray-400">当日涨跌:</span>
                        <span className={`font-mono font-bold ${(dailyGrowthRate && !dailyGrowthRate.startsWith('-')) ? 'text-red-500' : 'text-green-600'}`}>{dailyGrowthRate || '0.00%'}</span>
                    </div>
                    {dailyProfit !== undefined && <div className="flex justify-between items-baseline gap-4"><span className="text-gray-500 dark:text-gray-400">当日收益:</span><span className={`font-mono font-bold ${getProfitColor(dailyProfit)}`}>{dailyProfit.toFixed(2)}</span></div>}
                    {relChangeValue !== undefined && <div className="flex justify-between items-baseline gap-4"><span className={localBaselineDate ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'}>{localBaselineDate ? "较基准涨跌:" : "距今涨跌:"}</span><span className={`font-mono font-bold ${getProfitColor(relChangeValue)}`}>{relChangeValue > 0 ? '+' : ''}{relChangeValue.toFixed(2)}%</span></div>}
                    {tradeRecord && <div className="flex justify-between items-baseline gap-4 pt-0.5"><span className={`font-semibold ${getTransactionLabelColorClass(tradeRecord.type)}`}>{getTransactionLabel(tradeRecord.type)}:</span><span className="font-mono font-bold text-gray-800 dark:text-gray-100">{tradeRecord.type === 'buy' ? `${tradeRecord.amount!.toFixed(2)} 元` : tradeRecord.type === 'sell' ? `${Math.abs(tradeRecord.sharesChange!).toFixed(2)} 份` : tradeRecord.type === 'dividend-cash' ? `${tradeRecord.realizedProfitChange!.toFixed(2)} 元` : `${tradeRecord.sharesChange!.toFixed(2)} 份`}</span></div>}
                </div>
            </div>
        );
    }
    return null;
};

const FundChart: React.FC<FundChartProps> = ({ baseChartData, zigzagPoints, shares, lastPivotDate, costPrice, actualCostPrice, showLabels = true, navPercentile, tradingRecords, forceActualCostPosition = false, onSnapshotFilter }) => {
  const [localBaselineDate, setLocalBaselineDate] = useState<string | null>(null);
  const [hoveredNAV, setHoveredNAV] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggered = useRef<boolean>(false);

  const confirmedTradingRecords = useMemo(() => tradingRecords?.filter(r => r.nav !== undefined), [tradingRecords]);
  const localBaselineNAV = useMemo(() => { if (!localBaselineDate) return null; return baseChartData.find(p => p.date === localBaselineDate)?.unitNAV ?? null; }, [localBaselineDate, baseChartData]);
  const lastPivotNAV = useMemo(() => { if (!lastPivotDate) return null; return zigzagPoints.find(p => p.date === lastPivotDate)?.unitNAV ?? null; }, [lastPivotDate, zigzagPoints]);

  const chartDataForRender = useMemo(() => {
    const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));
    const tradeMap = new Map(confirmedTradingRecords?.map(r => [r.date, r]));
    const latestNAV = baseChartData.length > 0 ? (baseChartData[baseChartData.length - 1].unitNAV ?? 0) : 0;
    return baseChartData.map((p, index, arr) => {
        const tradeRecord = p.date ? tradeMap.get(p.date.split(' ')[0]) : undefined;
        let dailyProfit = (index > 0 && shares > 0) ? (p.unitNAV! - arr[index - 1].unitNAV!) * shares : 0;
        let changeSinceDate = (p.unitNAV && p.unitNAV > 0 && latestNAV > 0) ? ((latestNAV - p.unitNAV) / p.unitNAV) * 100 : 0;
        let changeFromBaseline = (localBaselineNAV && localBaselineNAV > 0 && p.unitNAV !== undefined) ? ((p.unitNAV - localBaselineNAV) / localBaselineNAV) * 100 : 0;
        return { ...p, zigzagNAV: zigzagMap.get(p.date), dailyProfit, changeSinceDate, changeFromBaseline, tradeRecord };
    });
  }, [baseChartData, zigzagPoints, shares, confirmedTradingRecords, localBaselineNAV]);

  const { domain, minVal, maxVal } = useMemo(() => {
    const navValues = baseChartData.map(p => p.unitNAV).filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (navValues.length < 1) return { domain: ['auto', 'auto'], minVal: 0, maxVal: 0 };
    let min = Math.min(...navValues), max = Math.max(...navValues);
    if (forceActualCostPosition) {
        if (costPrice && costPrice > 0) { min = Math.min(min, costPrice); max = Math.max(max, costPrice); }
        if (actualCostPrice && actualCostPrice > 0) { min = Math.min(min, actualCostPrice); max = Math.max(max, actualCostPrice); }
    }
    if (min === max) return { domain: [min * 0.995, max * 1.005], minVal: min, maxVal: max };
    const range = max - min; const padding = range * 0.05; return { domain: [min - padding, max + padding], minVal: min - padding, maxVal: max + padding };
  }, [baseChartData, costPrice, actualCostPrice, forceActualCostPosition]);

  const clampedCostPrice = useMemo(() => (costPrice && forceActualCostPosition) ? costPrice : (costPrice ? Math.max(minVal, Math.min(maxVal, costPrice)) : null), [costPrice, minVal, maxVal, forceActualCostPosition]);
  const clampedActualCostPrice = useMemo(() => (actualCostPrice && forceActualCostPosition) ? actualCostPrice : (actualCostPrice ? Math.max(minVal, Math.min(maxVal, actualCostPrice)) : null), [actualCostPrice, minVal, maxVal, forceActualCostPosition]);

  const handleChartClick = useCallback((state: any) => {
    if (isLongPressTriggered.current) { isLongPressTriggered.current = false; return; }
    if (state && state.activeLabel) setLocalBaselineDate(prev => prev === state.activeLabel ? null : state.activeLabel);
  }, []);

  const handleMouseMove = useCallback((state: any) => {
    if (state && state.activeTooltipIndex !== undefined) {
      setHoveredIndex(state.activeTooltipIndex);
      const point = chartDataForRender[state.activeTooltipIndex];
      if (point && typeof point.unitNAV === 'number') { setHoveredNAV(point.unitNAV); return; }
    }
    setHoveredNAV(null); setHoveredIndex(null);
  }, [chartDataForRender]);

  const startLongPress = useCallback((date: string) => {
      if (!onSnapshotFilter) return;
      isLongPressTriggered.current = false;
      longPressTimerRef.current = setTimeout(() => { isLongPressTriggered.current = true; onSnapshotFilter(date); }, 800);
  }, [onSnapshotFilter]);

  const cancelLongPress = useCallback(() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }, []);

  const handleContainerMouseDown = useCallback(() => {
    if (hoveredIndex !== null) {
        const point = chartDataForRender[hoveredIndex];
        if (point?.tradeRecord && point.date) startLongPress(point.date.split(' ')[0]);
    }
  }, [hoveredIndex, chartDataForRender, startLongPress]);

  return (
    <div className="relative w-full h-full" onMouseDown={handleContainerMouseDown} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress} onTouchStart={handleContainerMouseDown} onTouchEnd={cancelLongPress}>
      <ResponsiveContainer minWidth={0}>
        <LineChart data={chartDataForRender} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} onClick={handleChartClick} onMouseMove={handleMouseMove} onMouseLeave={() => { setHoveredNAV(null); setHoveredIndex(null); cancelLongPress(); }} style={{ cursor: 'pointer' }}>
          <defs><linearGradient id="costAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="100%" stopColor="#ef4444" stopOpacity={0.05}/></linearGradient></defs>
          <XAxis dataKey="date" type="category" hide /><YAxis hide domain={domain} yAxisId="main" />
          <Tooltip content={<CustomTooltip localBaselineDate={localBaselineDate} />} cursor={{ stroke: '#a0a0a0', strokeWidth: 1.33, strokeDasharray: '3 3' }} wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }} />
          {clampedCostPrice && clampedCostPrice > minVal && <ReferenceArea yAxisId="main" y1={minVal} y2={clampedCostPrice} fill="url(#costAreaGradient)" strokeOpacity={0} ifOverflow="hidden" />}
          {lastPivotDate && <ReferenceLine yAxisId="main" x={lastPivotDate} stroke="#a0a0a0" strokeDasharray="3 3" strokeWidth={1.33} />}
          {lastPivotNAV !== null && <ReferenceLine yAxisId="main" y={lastPivotNAV} stroke="#a0a0a0" strokeDasharray="3 3" strokeWidth={1.33} />}
          {localBaselineDate && <ReferenceLine yAxisId="main" x={localBaselineDate} stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={2}/>}
          {costPrice && clampedCostPrice !== null && <ReferenceLine yAxisId="main" y={clampedCostPrice} stroke="#ef4444" strokeWidth={1.33} label={showLabels ? { value: `成本: ${costPrice.toFixed(4)}`, position: clampedCostPrice <= minVal + (maxVal - minVal) * 0.1 ? 'insideBottomLeft' : 'insideTopLeft', fill: '#ef4444', fontSize: 10, dy: -2 } : undefined} />}
          {actualCostPrice && clampedActualCostPrice !== null && actualCostPrice.toFixed(4) !== costPrice?.toFixed(4) && <ReferenceLine yAxisId="main" y={clampedActualCostPrice} stroke="#6b7280" strokeDasharray="3 3" strokeWidth={1.33} label={showLabels ? { value: `实际: ${actualCostPrice.toFixed(4)}`, position: clampedActualCostPrice <= minVal + (maxVal - minVal) * 0.1 ? 'insideBottomLeft' : 'insideTopLeft', fill: '#374151', fontSize: 10, dy: -2 } : undefined} />}
          <Line yAxisId="main" type="linear" dataKey="unitNAV" stroke="#3b82f6" strokeWidth={1.33} dot={false} isAnimationActive={false} />
          <Line yAxisId="main" type="linear" dataKey="zigzagNAV" connectNulls stroke="#a0a0a0" strokeWidth={1.33} dot={false} isAnimationActive={false} />
          {confirmedTradingRecords?.map(record => (
            <ReferenceDot yAxisId="main" key={record.date} x={record.date} y={record.nav!} r={4} fill={getTransactionColor(record.type)} stroke="#ffffff" strokeWidth={1.33} className="cursor-pointer transition-transform hover:scale-125" onMouseDown={(e: any) => { e.stopPropagation(); startLongPress(record.date); }} onMouseUp={(e: any) => { e.stopPropagation(); cancelLongPress(); }} onTouchStart={(e: any) => { e.stopPropagation(); startLongPress(record.date); }} onTouchEnd={(e: any) => { e.stopPropagation(); cancelLongPress(); }} />
          ))}
          {hoveredNAV !== null && <ReferenceLine yAxisId="main" y={hoveredNAV} stroke="#a0a0a0" strokeDasharray="3 3" strokeWidth={1.33} ifOverflow="visible" />}
          {localBaselineNAV !== null && <ReferenceLine yAxisId="main" y={localBaselineNAV} stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={2} ifOverflow="visible" />}
        </LineChart>
      </ResponsiveContainer>
      {navPercentile !== null && <div className={`absolute right-2 text-xs font-bold ${navPercentile <= 20 ? 'text-green-600' : navPercentile >= 80 ? 'text-red-500' : 'text-yellow-600'} ${navPercentile > 50 ? 'bottom-2' : 'top-2'}`}>{`${navPercentile.toFixed(0)}%`}</div>}
    </div>
  );
};

export default FundChart;