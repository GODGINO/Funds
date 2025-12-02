
import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { PortfolioSnapshot, ProcessedFund } from '../types';
import SnapshotDetailModal from './SnapshotDetailModal';

interface PortfolioSnapshotTableProps {
  snapshots: PortfolioSnapshot[];
  funds: ProcessedFund[];
  onTagDoubleClick: (tag: string) => void;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const formatInteger = (value: number) => Math.round(value).toLocaleString('en-US');
const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const getDaysAgo = (dateString: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);

    if (isNaN(targetDate.getTime())) {
        return null;
    }

    const diffTime = today.getTime() - targetDate.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

const getBar_style = (value: number | undefined | null, maxAbsValue: number, minAbsValue: number) => {
    if (value == null) return {};
    
    // If range is 0 (all values equal), show no bar to avoid confusion or division by zero.
    if (maxAbsValue === minAbsValue) return {}; 

    const absVal = Math.abs(value);
    
    // Normalize width based on the [min, max] range of absolute values.
    // This "zooms in" on the differences.
    let widthPercent = ((absVal - minAbsValue) / (maxAbsValue - minAbsValue)) * 100;
    
    // Clamp to 0-100 to handle cases where a specific row (e.g. baseline) might be outside the operational range used for min/max.
    widthPercent = Math.max(0, Math.min(100, widthPercent));

    const color = value >= 0 
        ? 'rgba(239, 68, 68, 0.2)' // red
        : 'rgba(34, 197, 94, 0.2)'; // green
    
    // Use `to left` to make the gradient start from the right edge.
    const background = `linear-gradient(to left, ${color} ${widthPercent}%, transparent ${widthPercent}%)`;
    
    return { background };
};

const HeaderSparkline: React.FC<{ data: any[]; dataKey: string; stroke: string; }> = ({ data, dataKey, stroke }) => {
    const yDomain = useMemo(() => {
        if (!data || data.length === 0) return ['auto', 'auto'];
        const values = data.map(p => p[dataKey]).filter((v): v is number => typeof v === 'number' && isFinite(v));
        if (values.length < 1) return ['auto', 'auto'];

        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // If all values are the same, create a small artificial range for visibility.
        if (min === max) {
            const absValue = Math.abs(min);
            // For values close to zero (including zero), create a small absolute range.
            if (absValue < 1) return [min - 0.5, max + 0.5];
            // For larger numbers, create a small relative range.
            return [min * 0.99, max * 1.01];
        }

        // For fluctuating data, use the exact min/max to maximize the visual amplitude.
        return [min, max];
    }, [data, dataKey]);

    const { maxIndex } = useMemo(() => {
        if (!data || data.length === 0) {
            return { maxIndex: -1 };
        }
        let maxVal = -Infinity;
        let maxIdx = -1;
        data.forEach((point, index) => {
            const value = point[dataKey];
            if (typeof value === 'number' && isFinite(value) && value > maxVal) {
                maxVal = value;
                maxIdx = index;
            }
        });
        return { maxIndex: maxIdx };
    }, [data, dataKey]);

    return (
        <div className="h-6 w-full">
            <ResponsiveContainer minWidth={0}>
                <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                    <YAxis hide domain={yDomain} />
                    <Line
                        type="linear"
                        dataKey={dataKey}
                        stroke={stroke}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                    {maxIndex !== -1 && (
                        <ReferenceLine x={maxIndex} stroke="#ef4444" strokeWidth={1} />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};


const PortfolioSnapshotTable: React.FC<PortfolioSnapshotTableProps> = ({ snapshots, funds, onTagDoubleClick }) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<PortfolioSnapshot | null>(null);
  const chartData = useMemo(() => [...snapshots].reverse(), [snapshots]);
  
  const thickBorderRightKeys = useMemo(() => new Set(['dailyProfitRate', 'totalBuyFloatingProfit', 'totalSellRealizedProfit', 'operationProfit']), []);
  // Added operationProfit and profitCaused to wide columns
  const wideColumnKeys = useMemo(() => new Set(['totalBuyFloatingProfit', 'totalSellOpportunityProfit', 'totalSellRealizedProfit', 'operationProfit', 'profitCaused']), []);


  const { maxes, maxAbsValues, minAbsValues } = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
        return { maxes: {}, maxAbsValues: {}, minAbsValues: {} };
    }

    const operationalSnapshots = snapshots.filter(s => s.snapshotDate !== '基准持仓');
    if (operationalSnapshots.length === 0) {
        return { maxes: {}, maxAbsValues: {}, minAbsValues: {} };
    }

    const numericKeys: (keyof PortfolioSnapshot)[] = [
        'totalCostBasis', 'currentMarketValue', 'cumulativeValue', 'holdingProfit', 'totalProfit',
        'profitRate', 'dailyProfit', 'dailyProfitRate', 'netAmountChange',
        'marketValueChange', 'operationProfit', 'profitPerHundred', 'totalBuyAmount',
        'totalBuyFloatingProfit', 'totalSellAmount', 'totalSellOpportunityProfit',
        'totalSellRealizedProfit', 'profitCaused', 'profitCausedPerHundred', 'operationEffect'
    ];
    
    const maxes: Partial<Record<keyof PortfolioSnapshot, number>> = {};
    const maxAbsValues: Partial<Record<keyof PortfolioSnapshot, number>> = {};
    const minAbsValues: Partial<Record<keyof PortfolioSnapshot, number>> = {};

    numericKeys.forEach(key => {
        const values = operationalSnapshots
            .map(s => s[key] as number | undefined)
            .filter((v): v is number => typeof v === 'number' && isFinite(v));

        if (values.length > 0) {
            maxes[key] = Math.max(...values);
            const absValues = values.map(v => Math.abs(v));
            maxAbsValues[key] = Math.max(...absValues);
            minAbsValues[key] = Math.min(...absValues);
        } else {
            maxAbsValues[key] = 0;
            minAbsValues[key] = 0;
        }
    });

    return { maxes, maxAbsValues, minAbsValues };
  }, [snapshots]);

  // Effect to lock scroll when modal is open
  useEffect(() => {
    if (selectedSnapshot) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
    return () => {
        document.body.style.overflow = '';
    };
  }, [selectedSnapshot]);

  const getCellHighlightClass = (key: keyof PortfolioSnapshot, value: number | undefined | null, isBaselineRow: boolean) => {
    if (isBaselineRow || snapshots.length <= 1) return '';

    if (value != null && maxes[key] != null && value === maxes[key]) {
        return 'bg-gray-200 dark:bg-gray-700/60 group-hover:bg-gray-300 dark:group-hover:bg-gray-600';
    }
    return '';
  };


  const summaryData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;

    const operationalSnapshots = snapshots.filter(s => s.snapshotDate !== '基准持仓');
    if (operationalSnapshots.length === 0) return null;

    const sums = {
        netAmountChange: 0,
        marketValueChange: 0,
        operationProfit: 0,
        totalBuyAmount: 0,
        totalBuyFloatingProfit: 0,
        totalSellAmount: 0,
        totalSellOpportunityProfit: 0,
        totalSellRealizedProfit: 0,
        profitCaused: 0,
    };

    for (const snapshot of operationalSnapshots) {
        sums.netAmountChange += snapshot.netAmountChange || 0;
        sums.marketValueChange += snapshot.marketValueChange || 0;
        sums.operationProfit += snapshot.operationProfit || 0;
        sums.totalBuyAmount += snapshot.totalBuyAmount || 0;
        sums.totalBuyFloatingProfit += snapshot.totalBuyFloatingProfit || 0;
        sums.totalSellAmount += snapshot.totalSellAmount || 0;
        sums.totalSellOpportunityProfit += snapshot.totalSellOpportunityProfit || 0;
        sums.totalSellRealizedProfit += snapshot.totalSellRealizedProfit || 0;
        sums.profitCaused += snapshot.profitCaused || 0;
    }
    
    const profitPerHundred = Math.abs(sums.netAmountChange) > 1e-6 
        ? (sums.operationProfit / Math.abs(sums.netAmountChange)) * 100 
        : 0;

    const profitCausedPerHundred = Math.abs(sums.netAmountChange) > 1e-6
        ? (sums.profitCaused / Math.abs(sums.netAmountChange)) * 100 
        : 0;

    const latestSnapshot = snapshots[0];
    const baselineSnapshot = snapshots[snapshots.length - 1];

    const operationEffect = Math.abs(baselineSnapshot.dailyProfit) > 1e-6
        ? ((latestSnapshot.dailyProfit - baselineSnapshot.dailyProfit) / Math.abs(baselineSnapshot.dailyProfit)) * 100
        : 100;

    const floatingProfitPercent = sums.totalBuyAmount > 1e-6 
        ? (sums.totalBuyFloatingProfit / sums.totalBuyAmount) * 100 
        : 0;

    const opportunityProfitPercent = sums.totalSellAmount > 1e-6 
        ? (sums.totalSellOpportunityProfit / sums.totalSellAmount) * 100 
        : 0;

    const realizedProfitPercent = sums.totalSellAmount > 1e-6 
        ? (sums.totalSellRealizedProfit / sums.totalSellAmount) * 100 
        : 0;

    return {
        ...sums,
        profitPerHundred,
        profitCausedPerHundred,
        operationEffect,
        floatingProfitPercent,
        opportunityProfitPercent,
        realizedProfitPercent,
    };
}, [snapshots]);

  if (!snapshots || snapshots.length === 0) {
    return null;
  }
  
  const sparklineColumns: { key: keyof PortfolioSnapshot; title: string; }[] = [
      { key: 'totalCostBasis', title: '总成本' },
      { key: 'currentMarketValue', title: '持有总值' },
      { key: 'holdingProfit', title: '持有收益' },
      { key: 'totalProfit', title: '累计收益' },
      { key: 'profitRate', title: '累计收益率' },
      { key: 'dailyProfit', title: '日收益' },
      { key: 'dailyProfitRate', title: '日收益率' },
  ];

  const summaryColumns: { key: keyof NonNullable<typeof summaryData>, title: string, render: (data: NonNullable<typeof summaryData>) => React.ReactNode }[] = [
    { key: 'totalBuyAmount', title: '⬆︎买入', render: data => <div>{formatInteger(data.totalBuyAmount)}</div> },
    { key: 'totalBuyFloatingProfit', title: '浮盈', render: data => 
      <div className={getProfitColor(data.totalBuyFloatingProfit)}>
        {formatInteger(data.totalBuyFloatingProfit)}
        <span className="text-gray-500 dark:text-gray-400 text-[10px]">|{data.floatingProfitPercent.toFixed(1)}%</span>
      </div> 
    },
    { key: 'totalSellAmount', title: '⬇︎卖出', render: data => <div>{formatInteger(data.totalSellAmount)}</div> },
    { key: 'totalSellOpportunityProfit', title: '机会收益', render: data => 
      <div className={getProfitColor(data.totalSellOpportunityProfit)}>
        {formatInteger(data.totalSellOpportunityProfit)}
        <span className="text-gray-500 dark:text-gray-400 text-[10px]">|{data.opportunityProfitPercent.toFixed(1)}%</span>
      </div> 
    },
    { key: 'totalSellRealizedProfit', title: '落袋', render: data => 
      <div className={getProfitColor(data.totalSellRealizedProfit)}>
        {formatInteger(data.totalSellRealizedProfit)}
        <span className="text-gray-500 dark:text-gray-400 text-[10px]">|{data.realizedProfitPercent.toFixed(1)}%</span>
      </div>
    },
    { key: 'netAmountChange', title: '▲金额', render: data => <div className={getProfitColor(data.netAmountChange)}>{formatInteger(data.netAmountChange)}</div> },
    { key: 'marketValueChange', title: '总值变动', render: data => <div className={getProfitColor(data.marketValueChange)}>{formatInteger(data.marketValueChange)}</div> },
    { key: 'operationProfit', title: '操作收益', render: data => 
      <div className={getProfitColor(data.operationProfit)}>
        {formatInteger(data.operationProfit)}
        <span className="text-gray-500 dark:text-gray-400 text-[10px]">|{data.profitPerHundred.toFixed(1)}%</span>
      </div> 
    },
    { key: 'profitCaused', title: '造成盈亏', render: data => 
      <div className={getProfitColor(data.profitCaused)}>
        {formatInteger(data.profitCaused)}
        <span className="text-gray-500 dark:text-gray-400 text-[10px]">|{data.profitCausedPerHundred.toFixed(1)}%</span>
      </div> 
    },
    { key: 'operationEffect', title: '操作效果', render: data => <div className={getProfitColor(data.operationEffect)}>{formatPercentage(data.operationEffect)}</div> },
  ];

  return (
    <>
      <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 select-none">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-[11px] text-center border-collapse table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-800 align-bottom">
               <tr>
                <th rowSpan={2} className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 text-left align-middle w-20">
                  <div>切片日期</div>
                </th>
                {sparklineColumns.map(col => (
                   <th key={String(col.key)} className={`px-1 py-0.5 text-right border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 ${thickBorderRightKeys.has(col.key as string) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>{col.title}</th>
                ))}
                {summaryColumns.map(col => (
                  <th key={String(col.key)} className={`px-1 py-0.5 text-right border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 ${wideColumnKeys.has(col.key as string) ? 'w-20' : ''} ${thickBorderRightKeys.has(col.key as string) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>
                    <div>{col.title}</div>
                  </th>
                ))}
              </tr>
              <tr>
                {sparklineColumns.map(col => (
                  <th key={`${String(col.key)}-sparkline`} className={`p-0 border dark:border-gray-700 font-normal ${thickBorderRightKeys.has(col.key as string) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>
                      <HeaderSparkline data={chartData} dataKey={col.key as string} stroke="#3b82f6" />
                  </th>
                ))}
                {summaryData ? (
                    summaryColumns.map(col => (
                      <th key={`${String(col.key)}-summary`} className={`px-1 py-0.5 text-right border dark:border-gray-700 font-mono font-bold ${wideColumnKeys.has(col.key as string) ? 'w-20' : ''} ${thickBorderRightKeys.has(col.key as string) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>
                        {col.render(summaryData)}
                      </th>
                    ))
                ) : (
                    summaryColumns.map(col => (
                        <th key={`${String(col.key)}-empty`} className={`px-1 py-0.5 text-right border dark:border-gray-700 font-mono ${thickBorderRightKeys.has(col.key as string) ? 'border-r-2 border-r-gray-400 dark:border-r-gray-500' : ''}`}>
                            -
                        </th>
                    ))
                )}
              </tr>
            </thead>
            <tbody>
              {snapshots.map(snapshot => {
                const isBaselineRow = snapshot.snapshotDate === '基准持仓';
                const rowClasses = isBaselineRow
                  ? 'font-semibold'
                  : 'hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors duration-150 group';
                
                const daysAgo = isBaselineRow ? null : getDaysAgo(snapshot.snapshotDate);

                return (
                <tr key={snapshot.snapshotDate} onDoubleClick={() => setSelectedSnapshot(snapshot)} className={`border-b dark:border-gray-800 ${rowClasses}`}>
                  <td className="w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-left">
                    <span>{isBaselineRow ? snapshot.snapshotDate : snapshot.snapshotDate.substring(2).replace(/-/g, '/')}</span>
                    {daysAgo !== null && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2 text-[10px]">{daysAgo}</span>
                    )}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getCellHighlightClass('totalCostBasis', snapshot.totalCostBasis, isBaselineRow)}`} style={getBar_style(snapshot.totalCostBasis, maxAbsValues.totalCostBasis ?? 0, minAbsValues.totalCostBasis ?? 0)}><div className="relative">{formatInteger(snapshot.totalCostBasis)}</div></td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getCellHighlightClass('currentMarketValue', snapshot.currentMarketValue, isBaselineRow)}`} style={getBar_style(snapshot.currentMarketValue, maxAbsValues.currentMarketValue ?? 0, minAbsValues.currentMarketValue ?? 0)}><div className="relative">{formatInteger(snapshot.currentMarketValue)}</div></td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.holdingProfit)} ${getCellHighlightClass('holdingProfit', snapshot.holdingProfit, isBaselineRow)}`} style={getBar_style(snapshot.holdingProfit, maxAbsValues.holdingProfit ?? 0, minAbsValues.holdingProfit ?? 0)}><div className="relative">{snapshot.holdingProfit >= 0 ? '+' : ''}{formatInteger(snapshot.holdingProfit)}</div></td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.totalProfit)} ${getCellHighlightClass('totalProfit', snapshot.totalProfit, isBaselineRow)}`} style={getBar_style(snapshot.totalProfit, maxAbsValues.totalProfit ?? 0, minAbsValues.totalProfit ?? 0)}>
                    <div className="relative">{snapshot.totalProfit >= 0 ? '+' : ''}{formatInteger(snapshot.totalProfit)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.profitRate)} ${getCellHighlightClass('profitRate', snapshot.profitRate, isBaselineRow)}`} style={getBar_style(snapshot.profitRate, maxAbsValues.profitRate ?? 0, minAbsValues.profitRate ?? 0)}>
                    <div className="relative">{formatPercentage(snapshot.profitRate)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.dailyProfit)} ${getCellHighlightClass('dailyProfit', snapshot.dailyProfit, isBaselineRow)}`} style={getBar_style(snapshot.dailyProfit, maxAbsValues.dailyProfit ?? 0, minAbsValues.dailyProfit ?? 0)}>
                    <div className="relative">{snapshot.dailyProfit >= 0 ? '+' : ''}{formatInteger(snapshot.dailyProfit)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right border-r-2 border-r-gray-400 dark:border-r-gray-500 ${getProfitColor(snapshot.dailyProfitRate)} ${getCellHighlightClass('dailyProfitRate', snapshot.dailyProfitRate, isBaselineRow)}`} style={getBar_style(snapshot.dailyProfitRate, maxAbsValues.dailyProfitRate ?? 0, minAbsValues.dailyProfitRate ?? 0)}>
                    <div className="relative">{formatPercentage(snapshot.dailyProfitRate)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getCellHighlightClass('totalBuyAmount', snapshot.totalBuyAmount, isBaselineRow)}`} style={getBar_style(snapshot.totalBuyAmount, maxAbsValues.totalBuyAmount ?? 0, minAbsValues.totalBuyAmount ?? 0)}>
                      <div className="relative">{snapshot.totalBuyAmount ? formatInteger(snapshot.totalBuyAmount) : '-'}</div>
                  </td>
                  <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right border-r-2 border-r-gray-400 dark:border-r-gray-500 ${getProfitColor(snapshot.totalBuyFloatingProfit ?? 0)} ${getCellHighlightClass('totalBuyFloatingProfit', snapshot.totalBuyFloatingProfit, isBaselineRow)}`} style={getBar_style(snapshot.totalBuyFloatingProfit, maxAbsValues.totalBuyFloatingProfit ?? 0, minAbsValues.totalBuyFloatingProfit ?? 0)}>
                    <div className="relative">
                        {(snapshot.totalBuyAmount ?? 0) > 0 && snapshot.totalBuyFloatingProfit != null ? (
                        <span>
                            {`${snapshot.totalBuyFloatingProfit >= 0 ? '+' : ''}${formatInteger(snapshot.totalBuyFloatingProfit)}`}
                            <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                            |{((snapshot.totalBuyFloatingProfit / snapshot.totalBuyAmount) * 100).toFixed(1)}%
                            </span>
                        </span>
                        ) : (
                        '-'
                        )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getCellHighlightClass('totalSellAmount', snapshot.totalSellAmount, isBaselineRow)}`} style={getBar_style(snapshot.totalSellAmount, maxAbsValues.totalSellAmount ?? 0, minAbsValues.totalSellAmount ?? 0)}>
                      <div className="relative">{snapshot.totalSellAmount ? formatInteger(snapshot.totalSellAmount) : '-'}</div>
                  </td>
                  <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.totalSellOpportunityProfit ?? 0)} ${getCellHighlightClass('totalSellOpportunityProfit', snapshot.totalSellOpportunityProfit, isBaselineRow)}`} style={getBar_style(snapshot.totalSellOpportunityProfit, maxAbsValues.totalSellOpportunityProfit ?? 0, minAbsValues.totalSellOpportunityProfit ?? 0)}>
                    <div className="relative">
                        {(snapshot.totalSellAmount ?? 0) > 0 && snapshot.totalSellOpportunityProfit != null ? (
                            <span>
                                {`${snapshot.totalSellOpportunityProfit >= 0 ? '+' : ''}${formatInteger(snapshot.totalSellOpportunityProfit)}`}
                                <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                                    |{((snapshot.totalSellOpportunityProfit / snapshot.totalSellAmount) * 100).toFixed(1)}%
                                </span>
                            </span>
                        ) : (
                            '-'
                        )}
                    </div>
                  </td>
                  <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right border-r-2 border-r-gray-400 dark:border-r-gray-500 ${getProfitColor(snapshot.totalSellRealizedProfit ?? 0)} ${getCellHighlightClass('totalSellRealizedProfit', snapshot.totalSellRealizedProfit, isBaselineRow)}`} style={getBar_style(snapshot.totalSellRealizedProfit, maxAbsValues.totalSellRealizedProfit ?? 0, minAbsValues.totalSellRealizedProfit ?? 0)}>
                    <div className="relative">
                        {(snapshot.totalSellAmount ?? 0) > 0 ? (
                            <span>
                                {`${(snapshot.totalSellRealizedProfit ?? 0) >= 0 ? '+' : ''}${formatInteger(snapshot.totalSellRealizedProfit ?? 0)}`}
                                <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                                    |{((snapshot.totalSellRealizedProfit! / snapshot.totalSellAmount!) * 100).toFixed(1)}%
                                </span>
                            </span>
                        ) : (
                            '-'
                        )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${isBaselineRow ? '' : getProfitColor(snapshot.netAmountChange)} ${getCellHighlightClass('netAmountChange', snapshot.netAmountChange, isBaselineRow)}`} style={getBar_style(snapshot.netAmountChange, maxAbsValues.netAmountChange ?? 0, minAbsValues.netAmountChange ?? 0)}>
                    <div className="relative">
                        {isBaselineRow ? (
                            '-'
                        ) : (
                            `${snapshot.netAmountChange >= 0 ? '+' : ''}${formatInteger(snapshot.netAmountChange)}`
                        )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${snapshot.marketValueChange ? getProfitColor(snapshot.marketValueChange) : ''} ${getCellHighlightClass('marketValueChange', snapshot.marketValueChange, isBaselineRow)}`} style={getBar_style(snapshot.marketValueChange, maxAbsValues.marketValueChange ?? 0, minAbsValues.marketValueChange ?? 0)}>
                    <div className="relative">
                        {snapshot.marketValueChange != null ? (
                        `${snapshot.marketValueChange >= 0 ? '+' : ''}${formatInteger(snapshot.marketValueChange)}`
                        ) : (
                        '-'
                        )}
                    </div>
                  </td>
                  <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right border-r-2 border-r-gray-400 dark:border-r-gray-500 ${snapshot.operationProfit ? getProfitColor(snapshot.operationProfit) : ''} ${getCellHighlightClass('operationProfit', snapshot.operationProfit, isBaselineRow)}`} style={getBar_style(snapshot.operationProfit, maxAbsValues.operationProfit ?? 0, minAbsValues.operationProfit ?? 0)}>
                    <div className="relative">
                        {snapshot.operationProfit != null ? (
                            <span>
                                {`${snapshot.operationProfit >= 0 ? '+' : ''}${formatInteger(snapshot.operationProfit)}`}
                                {snapshot.profitPerHundred != null && (
                                    <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                                        |{snapshot.profitPerHundred.toFixed(1)}%
                                    </span>
                                )}
                            </span>
                        ) : (
                        '-'
                        )}
                    </div>
                  </td>
                  <td className={`w-20 px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${snapshot.profitCaused ? getProfitColor(snapshot.profitCaused) : ''} ${getCellHighlightClass('profitCaused', snapshot.profitCaused, isBaselineRow)}`} style={getBar_style(snapshot.profitCaused, maxAbsValues.profitCaused ?? 0, minAbsValues.profitCaused ?? 0)}>
                    <div className="relative">
                        {snapshot.profitCaused != null ? (
                            <span>
                                {`${snapshot.profitCaused >= 0 ? '+' : ''}${formatInteger(snapshot.profitCaused)}`}
                                {snapshot.profitCausedPerHundred != null && (
                                    <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                                        |{snapshot.profitCausedPerHundred.toFixed(1)}%
                                    </span>
                                )}
                            </span>
                        ) : (
                            '-'
                        )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${snapshot.operationEffect ? getProfitColor(snapshot.operationEffect) : ''} ${getCellHighlightClass('operationEffect', snapshot.operationEffect, isBaselineRow)}`} style={getBar_style(snapshot.operationEffect, maxAbsValues.operationEffect ?? 0, minAbsValues.operationEffect ?? 0)}>
                    <div className="relative">
                        {snapshot.operationEffect != null ? (
                            formatPercentage(snapshot.operationEffect)
                        ) : (
                            '-'
                        )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
      {selectedSnapshot && (
        <SnapshotDetailModal
          isOpen={!!selectedSnapshot}
          onClose={() => setSelectedSnapshot(null)}
          snapshot={selectedSnapshot}
          funds={funds}
          onTagDoubleClick={onTagDoubleClick}
        />
      )}
    </>
  );
};

export default PortfolioSnapshotTable;
