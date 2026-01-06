
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine, ReferenceDot } from 'recharts';
import { PortfolioSnapshot, ProcessedFund } from '../types';
import SnapshotDetailModal from './SnapshotDetailModal';

interface PortfolioSnapshotTableProps {
  snapshots: PortfolioSnapshot[];
  funds: ProcessedFund[];
  onTagDoubleClick: (tag: string) => void;
  onSnapshotFilter: (date: string) => void;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';
const formatInteger = (value: number) => Math.round(value).toLocaleString('en-US');
const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const getDaysAgo = (dateString: string): number | null => {
    if (dateString === '待成交') return 0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    if (isNaN(targetDate.getTime())) return null;
    return Math.round((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
};

const getBar_style = (value: number | undefined | null, maxAbsValue: number, minAbsValue: number) => {
    if (value == null || maxAbsValue === minAbsValue) return {};
    const absVal = Math.abs(value);
    let widthPercent = ((absVal - minAbsValue) / (maxAbsValue - minAbsValue)) * 100;
    widthPercent = Math.max(0, Math.min(100, widthPercent));
    const color = value >= 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
    return { background: `linear-gradient(to left, ${color} ${widthPercent}%, transparent ${widthPercent}%)` };
};

// --- 子组件: 头部迷你图 (优化性能) ---
interface HeaderSparklineProps {
    data: any[];
    dataKey: string;
    stroke: string;
    hoveredChartIndex: number | null;
    onHoverChange: (index: number | null) => void;
}

const HeaderSparkline = React.memo<HeaderSparklineProps>(({ data, dataKey, stroke, hoveredChartIndex, onHoverChange }) => {
    const yDomain = useMemo(() => {
        if (!data || data.length === 0) return ['auto', 'auto'];
        const values = data.map(p => p[dataKey]).filter((v): v is number => typeof v === 'number' && isFinite(v));
        if (values.length < 1) return ['auto', 'auto'];
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) return [min * 0.99, max * 1.01];
        return [min, max];
    }, [data, dataKey]);

    const maxIndex = useMemo(() => {
        if (!data || data.length === 0) return -1;
        let maxVal = -Infinity;
        let maxIdx = -1;
        data.forEach((p, i) => {
            const v = p[dataKey];
            if (typeof v === 'number' && isFinite(v) && v > maxVal) {
                maxVal = v;
                maxIdx = i;
            }
        });
        return maxIdx;
    }, [data, dataKey]);

    // 恢复为鼠标移动触发
    const handleMouseMove = useCallback((e: any) => {
        if (e && e.activeTooltipIndex !== undefined) {
            onHoverChange(e.activeTooltipIndex);
        }
    }, [onHoverChange]);

    const handleMouseLeave = useCallback(() => {
        onHoverChange(null);
    }, [onHoverChange]);

    return (
        <div className="h-6 w-full">
            <ResponsiveContainer minWidth={0}>
                <LineChart 
                    data={data} 
                    margin={{ top: 2, right: 0, left: 0, bottom: 2 }} 
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    <YAxis hide domain={yDomain} />
                    <Line type="linear" dataKey={dataKey} stroke={stroke} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    {maxIndex !== -1 && <ReferenceLine x={maxIndex} stroke="#ef4444" strokeWidth={1} />}
                    {hoveredChartIndex !== null && data[hoveredChartIndex] && (
                        <ReferenceDot x={hoveredChartIndex} y={data[hoveredChartIndex][dataKey]} r={3} fill={stroke} stroke="#fff" strokeWidth={1} />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
});

// --- 子组件: 表格行 (优化性能) ---
interface SnapshotRowProps {
    snapshot: PortfolioSnapshot;
    index: number;
    isHovered: boolean;
    onMouseEnter: (index: number) => void;
    onRowClick: (e: React.MouseEvent, s: PortfolioSnapshot) => void;
    onLongPressStart: (date: string) => void;
    onLongPressEnd: () => void;
    maxAbsValues: any;
    minAbsValues: any;
    maxes: any;
}

const SnapshotRow = React.memo<SnapshotRowProps>(({ snapshot, index, isHovered, onMouseEnter, onRowClick, onLongPressStart, onLongPressEnd, maxAbsValues, minAbsValues, maxes }) => {
    const isBaselineRow = snapshot.snapshotDate === '基准持仓';
    const isPendingRow = snapshot.snapshotDate === '待成交';
    const daysAgo = (isBaselineRow || isPendingRow) ? null : getDaysAgo(snapshot.snapshotDate);

    const getCellHighlightClass = (key: keyof PortfolioSnapshot, value: number | undefined | null) => {
        if (isBaselineRow) return '';
        if (value != null && maxes[key] != null && value === maxes[key]) {
            return 'bg-gray-200 dark:bg-gray-700/60 group-hover:bg-gray-300 dark:group-hover:bg-gray-600';
        }
        return '';
    };

    let rowClasses = `transition-colors duration-75 group border-b dark:border-gray-800 ${isHovered ? 'bg-blue-100 dark:bg-gray-800/80' : 'hover:bg-blue-50/50 dark:hover:bg-gray-800/20'}`;
    if (isBaselineRow) rowClasses += ' font-semibold';
    if (isPendingRow) rowClasses += ' bg-yellow-50/50 dark:bg-yellow-900/10 border-dashed border-b-2 border-b-yellow-300 dark:border-b-yellow-700/50';

    const renderCell = (key: keyof PortfolioSnapshot, value: number | undefined | null, formatter: (v: number) => string, colorFn?: (v: number) => string, borderClass: string = '') => (
        <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${borderClass} ${colorFn ? colorFn(value || 0) : ''} ${getCellHighlightClass(key, value)}`} style={getBar_style(value, maxAbsValues[key] ?? 0, minAbsValues[key] ?? 0)}>
            <div className="relative">{value != null ? (value >= 0 && colorFn ? '+' : '') + formatter(value) : '-'}</div>
        </td>
    );

    return (
        <tr 
            onClick={(e) => onRowClick(e, snapshot)}
            onMouseEnter={() => onMouseEnter(index)}
            onMouseDown={() => onLongPressStart(snapshot.snapshotDate)}
            onMouseUp={onLongPressEnd}
            onMouseLeave={onLongPressEnd}
            onTouchStart={() => onLongPressStart(snapshot.snapshotDate)}
            onTouchEnd={onLongPressEnd}
            className={rowClasses}
        >
            <td className="w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-left">
                {isPendingRow ? <span className="font-semibold text-yellow-700 dark:text-yellow-500">待成交</span> : (
                    <>
                        <span>{isBaselineRow ? snapshot.snapshotDate : snapshot.snapshotDate.substring(2).replace(/-/g, '/')}</span>
                        {daysAgo !== null && <span className="text-gray-500 dark:text-gray-400 ml-2 text-[10px]">{daysAgo}</span>}
                    </>
                )}
            </td>
            {renderCell('totalCostBasis', snapshot.totalCostBasis, formatInteger)}
            {renderCell('currentMarketValue', snapshot.currentMarketValue, formatInteger)}
            {renderCell('holdingProfit', snapshot.holdingProfit, formatInteger, getProfitColor)}
            {renderCell('totalProfit', snapshot.totalProfit, formatInteger, getProfitColor)}
            {renderCell('profitRate', snapshot.profitRate, (v) => v.toFixed(4) + '%', getProfitColor)}
            {renderCell('dailyProfit', snapshot.dailyProfit, formatInteger, getProfitColor)}
            {renderCell('dailyProfitRate', snapshot.dailyProfitRate, (v) => v.toFixed(4) + '%', getProfitColor, 'border-r-2 border-r-gray-400 dark:border-r-gray-500')}
            {renderCell('totalBuyAmount', snapshot.totalBuyAmount, formatInteger)}
            <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right border-r-2 border-r-gray-400 dark:border-r-gray-500 ${getProfitColor(snapshot.totalBuyFloatingProfit ?? 0)} ${getCellHighlightClass('totalBuyFloatingProfit', snapshot.totalBuyFloatingProfit)}`} style={getBar_style(snapshot.totalBuyFloatingProfit, maxAbsValues.totalBuyFloatingProfit ?? 0, minAbsValues.totalBuyFloatingProfit ?? 0)}>
                <div className="relative">{(snapshot.totalBuyAmount ?? 0) > 0 && snapshot.totalBuyFloatingProfit != null ? `${snapshot.totalBuyFloatingProfit >= 0 ? '+' : ''}${formatInteger(snapshot.totalBuyFloatingProfit)}|${((snapshot.totalBuyFloatingProfit / snapshot.totalBuyAmount!) * 100).toFixed(1)}%` : '-'}</div>
            </td>
            {renderCell('totalSellAmount', snapshot.totalSellAmount, formatInteger)}
            <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.totalSellOpportunityProfit ?? 0)} ${getCellHighlightClass('totalSellOpportunityProfit', snapshot.totalSellOpportunityProfit)}`} style={getBar_style(snapshot.totalSellOpportunityProfit, maxAbsValues.totalSellOpportunityProfit ?? 0, minAbsValues.totalSellOpportunityProfit ?? 0)}>
                <div className="relative">{(snapshot.totalSellAmount ?? 0) > 0 && snapshot.totalSellOpportunityProfit != null ? `${snapshot.totalSellOpportunityProfit >= 0 ? '+' : ''}${formatInteger(snapshot.totalSellOpportunityProfit)}|${((snapshot.totalSellOpportunityProfit / snapshot.totalSellAmount!) * 100).toFixed(1)}%` : '-'}</div>
            </td>
            <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right border-r-2 border-r-gray-400 dark:border-r-gray-500 ${getProfitColor(snapshot.totalSellRealizedProfit ?? 0)} ${getCellHighlightClass('totalSellRealizedProfit', snapshot.totalSellRealizedProfit)}`} style={getBar_style(snapshot.totalSellRealizedProfit, maxAbsValues.totalSellRealizedProfit ?? 0, minAbsValues.totalSellRealizedProfit ?? 0)}>
                <div className="relative">{(snapshot.totalSellAmount ?? 0) > 0 ? `${(snapshot.totalSellRealizedProfit ?? 0) >= 0 ? '+' : ''}${formatInteger(snapshot.totalSellRealizedProfit ?? 0)}|${((snapshot.totalSellRealizedProfit! / snapshot.totalSellAmount!) * 100).toFixed(1)}%` : '-'}</div>
            </td>
            {renderCell('netAmountChange', isBaselineRow ? null : snapshot.netAmountChange, formatInteger, isBaselineRow ? undefined : getProfitColor)}
            {renderCell('marketValueChange', snapshot.marketValueChange, formatInteger, (v) => getProfitColor(v))}
            <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right border-r-2 border-r-gray-400 dark:border-r-gray-500 ${snapshot.operationProfit ? getProfitColor(snapshot.operationProfit) : ''} ${getCellHighlightClass('operationProfit', snapshot.operationProfit)}`} style={getBar_style(snapshot.operationProfit, maxAbsValues.operationProfit ?? 0, minAbsValues.operationProfit ?? 0)}>
                <div className="relative">{snapshot.operationProfit != null ? `${snapshot.operationProfit >= 0 ? '+' : ''}${formatInteger(snapshot.operationProfit)}|${(snapshot.profitPerHundred ?? 0).toFixed(1)}%` : '-'}</div>
            </td>
            <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${snapshot.profitCaused ? getProfitColor(snapshot.profitCaused) : ''} ${getCellHighlightClass('profitCaused', snapshot.profitCaused)}`} style={getBar_style(snapshot.profitCaused, maxAbsValues.profitCaused ?? 0, minAbsValues.profitCaused ?? 0)}>
                <div className="relative">{snapshot.profitCaused != null ? `${snapshot.profitCaused >= 0 ? '+' : ''}${formatInteger(snapshot.profitCaused)}|${(snapshot.profitCausedPerHundred ?? 0).toFixed(1)}%` : '-'}</div>
            </td>
            {renderCell('operationEffect', snapshot.operationEffect, (v) => v.toFixed(2) + '%', (v) => getProfitColor(v))}
        </tr>
    );
});

// --- 主组件 ---
const PortfolioSnapshotTable: React.FC<PortfolioSnapshotTableProps> = ({ snapshots, funds, onTagDoubleClick, onSnapshotFilter }) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const chartData = useMemo(() => [...snapshots].reverse(), [snapshots]);
  const hoveredChartIndex = useMemo(() => hoveredIndex === null ? null : snapshots.length - 1 - hoveredIndex, [hoveredIndex, snapshots.length]);

  const handleHoverChange = useCallback((chartIdx: number | null) => {
      setHoveredIndex(chartIdx === null ? null : snapshots.length - 1 - chartIdx);
  }, [snapshots.length]);

  const handleMouseEnter = useCallback((idx: number) => {
      setHoveredIndex(idx);
  }, []);

  const thickBorderRightKeys = useMemo(() => new Set(['dailyProfitRate', 'totalBuyFloatingProfit', 'totalSellRealizedProfit', 'operationProfit']), []);
  const wideColumnKeys = useMemo(() => new Set(['totalBuyFloatingProfit', 'totalSellOpportunityProfit', 'totalSellRealizedProfit', 'operationProfit', 'profitCaused']), []);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { maxes, maxAbsValues, minAbsValues } = useMemo(() => {
    if (!snapshots?.length) return { maxes: {}, maxAbsValues: {}, minAbsValues: {} };
    const operationalSnapshots = snapshots.filter(s => s.snapshotDate !== '基准持仓');
    const numericKeys: (keyof PortfolioSnapshot)[] = ['totalCostBasis', 'currentMarketValue', 'cumulativeValue', 'holdingProfit', 'totalProfit', 'profitRate', 'dailyProfit', 'dailyProfitRate', 'netAmountChange', 'marketValueChange', 'operationProfit', 'profitPerHundred', 'totalBuyAmount', 'totalBuyFloatingProfit', 'totalSellAmount', 'totalSellOpportunityProfit', 'totalSellRealizedProfit', 'profitCaused', 'profitCausedPerHundred', 'operationEffect'];
    const maxes: any = {}, maxAbs: any = {}, minAbs: any = {};
    numericKeys.forEach(k => {
        const vals = operationalSnapshots.map(s => s[k] as number).filter(v => typeof v === 'number' && isFinite(v));
        if (vals.length) {
            maxes[k] = Math.max(...vals);
            const abs = vals.map(v => Math.abs(v));
            maxAbs[k] = Math.max(...abs);
            minAbs[k] = Math.min(...abs);
        }
    });
    return { maxes, maxAbsValues: maxAbs, minAbsValues: minAbs };
  }, [snapshots]);

  const summaryData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;
    const operationalSnapshots = snapshots.filter(s => s.snapshotDate !== '基准持仓');
    if (!operationalSnapshots.length) return null;
    
    const sums = { netAmountChange: 0, marketValueChange: 0, operationProfit: 0, totalBuyAmount: 0, totalBuyFloatingProfit: 0, totalSellAmount: 0, totalSellOpportunityProfit: 0, totalSellRealizedProfit: 0, profitCaused: 0, totalDailyActionValue: 0 };
    operationalSnapshots.forEach(s => Object.keys(sums).forEach(k => (sums as any)[k] += (s as any)[k] || 0));
    
    const latest = snapshots.find(s => s.snapshotDate !== '待成交') || snapshots[0];
    const baseline = snapshots[snapshots.length - 1];
    const effect = Math.abs(baseline.dailyProfit) > 1e-6 ? ((latest.dailyProfit - baseline.dailyProfit) / Math.abs(baseline.dailyProfit)) * 100 : 100;
    
    const actionBase = sums.totalDailyActionValue || Math.abs(sums.netAmountChange);

    return { 
        ...sums, 
        profitPerHundred: actionBase > 1e-6 ? (sums.operationProfit / actionBase) * 100 : 0, 
        profitCausedPerHundred: actionBase > 1e-6 ? (sums.profitCaused / actionBase) * 100 : 0, 
        operationEffect: effect, 
        floatingProfitPercent: sums.totalBuyAmount > 1e-6 ? (sums.totalBuyFloatingProfit / sums.totalBuyAmount) * 100 : 0, 
        opportunityProfitPercent: sums.totalSellAmount > 1e-6 ? (sums.totalSellOpportunityProfit / sums.totalSellAmount) * 100 : 0, 
        realizedProfitPercent: sums.totalSellAmount > 1e-6 ? (sums.totalSellRealizedProfit / sums.totalSellAmount) * 100 : 0 
    };
  }, [snapshots]);

  const sparklineColumns: { key: keyof PortfolioSnapshot; title: string; }[] = [{ key: 'totalCostBasis', title: '总成本' }, { key: 'currentMarketValue', title: '持有总值' }, { key: 'holdingProfit', title: '持有收益' }, { key: 'totalProfit', title: '累计收益' }, { key: 'profitRate', title: '累计收益率' }, { key: 'dailyProfit', title: '日收益' }, { key: 'dailyProfitRate', title: '日收益率' }];
  const summaryColumns: { key: string, title: string, render: (data: any) => React.ReactNode }[] = [
    { key: 'totalBuyAmount', title: '⬆︎买入', render: d => <div>{formatInteger(d.totalBuyAmount)}</div> },
    { key: 'totalBuyFloatingProfit', title: '浮盈', render: d => <div className={getProfitColor(d.totalBuyFloatingProfit)}>{formatInteger(d.totalBuyFloatingProfit)}<span className="text-gray-500 text-[10px]">|{d.floatingProfitPercent.toFixed(1)}%</span></div> },
    { key: 'totalSellAmount', title: '⬇︎卖出', render: d => <div>{formatInteger(d.totalSellAmount)}</div> },
    { key: 'totalSellOpportunityProfit', title: '机会收益', render: d => <div className={getProfitColor(d.totalSellOpportunityProfit)}>{formatInteger(d.totalSellOpportunityProfit)}<span className="text-gray-500 text-[10px]">|{d.opportunityProfitPercent.toFixed(1)}%</span></div> },
    { key: 'totalSellRealizedProfit', title: '落袋', render: d => <div className={getProfitColor(d.totalSellRealizedProfit)}>{formatInteger(d.totalSellRealizedProfit)}<span className="text-gray-500 text-[10px]">|{d.realizedProfitPercent.toFixed(1)}%</span></div> },
    { key: 'netAmountChange', title: '操作金额', render: d => <div className={getProfitColor(d.netAmountChange)}>{formatInteger(d.netAmountChange)}</div> },
    { key: 'marketValueChange', title: '总值变动', render: d => <div className={getProfitColor(d.marketValueChange)}>{formatInteger(d.marketValueChange)}</div> },
    { key: 'operationProfit', title: '操作收益', render: d => <div className={getProfitColor(d.operationProfit)}>{formatInteger(d.operationProfit)}<span className="text-gray-500 text-[10px]">|{d.profitPerHundred.toFixed(1)}%</span></div> },
    { key: 'profitCaused', title: '造成盈亏', render: d => <div className={getProfitColor(d.profitCaused)}>{formatInteger(d.profitCaused)}<span className="text-gray-500 text-[10px]">|{d.profitCausedPerHundred.toFixed(1)}%</span></div> },
    { key: 'operationEffect', title: '操作效果', render: d => <div className={getProfitColor(d.operationEffect)}>{formatPercentage(d.operationEffect)}</div> },
  ];

  const handleLongPressStart = useCallback((date: string) => {
      if (date === '基准持仓') return;
      longPressTimerRef.current = setTimeout(() => onSnapshotFilter(date), 1000);
  }, [onSnapshotFilter]);

  const handleLongPressEnd = useCallback(() => {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const handleRowClick = useCallback((e: React.MouseEvent, s: PortfolioSnapshot) => {
      if (s.snapshotDate !== '基准持仓' && e.detail === 2) {
          setSelectedSnapshot(s);
      }
  }, []);

  return (
    <>
      <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 select-none">
        <div className="w-full">
          <table className="w-full text-[11px] text-center border-collapse table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-800 align-bottom sticky top-0 z-20">
               <tr>
                <th rowSpan={2} className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 text-left align-middle w-20">切片日期</th>
                {sparklineColumns.map(col => (
                   <th key={String(col.key)} className={`px-1 py-0.5 text-right border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 ${thickBorderRightKeys.has(col.key as string) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>{col.title}</th>
                ))}
                {summaryColumns.map(col => (
                  <th key={col.key} className={`px-1 py-0.5 text-right border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 ${wideColumnKeys.has(col.key) ? 'w-20' : ''} ${thickBorderRightKeys.has(col.key) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>{col.title}</th>
                ))}
              </tr>
              <tr>
                {sparklineColumns.map(col => (
                  <th key={`${String(col.key)}-sparkline`} className={`p-0 border dark:border-gray-700 font-normal ${thickBorderRightKeys.has(col.key as string) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>
                      <HeaderSparkline 
                        data={chartData} 
                        dataKey={col.key as string} 
                        stroke="#3b82f6" 
                        hoveredChartIndex={hoveredChartIndex} 
                        onHoverChange={handleHoverChange} 
                      />
                  </th>
                ))}
                {summaryColumns.map(col => (
                    <th key={`${col.key}-summary`} className={`px-1 py-0.5 text-right border dark:border-gray-700 font-mono font-bold ${wideColumnKeys.has(col.key) ? 'w-20' : ''} ${thickBorderRightKeys.has(col.key) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>
                        {summaryData ? col.render(summaryData) : '-'}
                    </th>
                ))}
              </tr>
            </thead>
            <tbody onMouseLeave={() => setHoveredIndex(null)}>
              {snapshots.map((s, i) => (
                <SnapshotRow 
                    key={s.snapshotDate} 
                    snapshot={s} 
                    index={i} 
                    isHovered={hoveredIndex === i} 
                    onMouseEnter={handleMouseEnter}
                    onRowClick={handleRowClick} 
                    onLongPressStart={handleLongPressStart} 
                    onLongPressEnd={handleLongPressEnd} 
                    maxAbsValues={maxAbsValues} 
                    minAbsValues={minAbsValues} 
                    maxes={maxes} 
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedSnapshot && <SnapshotDetailModal isOpen={!!selectedSnapshot} onClose={() => setSelectedSnapshot(null)} snapshot={selectedSnapshot} funds={funds} onTagDoubleClick={onTagDoubleClick} />}
    </>
  );
};

export default PortfolioSnapshotTable;
