
import React, { useMemo } from 'react';
import { TagAnalysisData, TagSortOrder } from '../types';

interface TagAnalysisTableProps {
  data: TagAnalysisData[];
  totals: Omit<TagAnalysisData, 'tag' | 'fundCount' | 'holdingEfficiency' | 'dailyEfficiency' | 'recentEfficiency'>;
  activeTag: string | null;
  onTagDoubleClick: (tag: string) => void;
  sortKey: keyof TagAnalysisData;
  sortOrder: TagSortOrder;
  onSortChange: (key: keyof TagAnalysisData) => void;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';
const getEfficiencyColor = (value: number) => value >= 1 ? 'text-red-500' : 'text-green-600';

const formatIntegerWithCommas = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const formatEfficiency = (value: number) => {
    if (isNaN(value) || !isFinite(value)) {
        return '-';
    }
    return `${value.toFixed(2)}x`;
};

const TagAnalysisTable: React.FC<TagAnalysisTableProps> = ({ data, totals, activeTag, onTagDoubleClick, sortKey, sortOrder, onSortChange }) => {
  if (data.length === 0) {
    return null;
  }

  const maxAbsValues = useMemo(() => {
    if (!data || data.length === 0) {
        return {};
    }

    const numericKeys: (keyof TagAnalysisData)[] = [
        'totalCostBasis', 'totalMarketValue', 'cumulativeMarketValue', 
        'totalHoldingProfit', 'grandTotalProfit', 'holdingEfficiency', 
        'holdingProfitRate', 'totalProfitRate', 'totalDailyProfit', 
        'dailyEfficiency', 'dailyProfitRate', 'totalRecentProfit', 
        'recentEfficiency', 'recentProfitRate'
    ];
    
    const maxVals: Partial<Record<keyof TagAnalysisData, number>> = {};

    numericKeys.forEach(key => {
        const absValues = data
            .map(s => s[key] as number | undefined)
            .filter((v): v is number => typeof v === 'number' && isFinite(v))
            .map(v => Math.abs(v));

        if (absValues.length > 0) {
            maxVals[key] = Math.max(...absValues);
        }
    });

    return maxVals;
  }, [data]);

  const getBarStyle = (value: number | undefined | null, maxAbsValue: number | undefined, type: 'normal' | 'efficiency' = 'normal') => {
    if (value == null || maxAbsValue == null || maxAbsValue === 0) return {};
    const widthPercent = Math.min(100, (Math.abs(value) / maxAbsValue) * 100);
    
    let color: string;
    if (type === 'efficiency') {
      color = value >= 1 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
    } else {
      color = value >= 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
    }
    
    const backgroundImage = `linear-gradient(to left, ${color} ${widthPercent}%, transparent ${widthPercent}%)`;
    
    return { backgroundImage };
  };

  const getSortIndicator = (key: keyof TagAnalysisData) => {
    if (sortKey !== key) return null;
    if (sortOrder === 'desc') return '▼';
    if (sortOrder === 'asc') return '▲';
    if (sortOrder === 'abs_desc') return '|▼|';
    if (sortOrder === 'abs_asc') return '|▲|';
    return null;
  };
  
  const SortableHeader: React.FC<{ sortableKey: keyof TagAnalysisData; children: React.ReactNode; className?: string }> = ({ sortableKey, children, className }) => {
      const indicator = getSortIndicator(sortableKey);
      const childrenArray = React.Children.toArray(children);
      const titleElement = childrenArray[0];
      const valueElement = childrenArray.length > 1 ? childrenArray[1] : null;

      let newTitleElement;
      if (React.isValidElement<React.PropsWithChildren>(titleElement)) {
          const newTitle = indicator
              ? `${indicator} ${titleElement.props.children}`
              : titleElement.props.children;
          newTitleElement = React.cloneElement(titleElement, { ...titleElement.props, children: newTitle });
      } else {
          const newTitle = indicator ? `${indicator} ${titleElement}` : titleElement;
          newTitleElement = <span>{newTitle}</span>;
      }

      return (
          <th className={`p-0 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 ${className}`} onClick={() => onSortChange(sortableKey)}>
              <div className="flex justify-end">
                  <div className="text-right">
                      {newTitleElement}
                      {valueElement}
                  </div>
              </div>
          </th>
      );
  };


  return (
    <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 select-none">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs text-center border-collapse table-fixed">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="p-0 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 text-left sticky left-0 z-10 bg-gray-50 dark:bg-gray-800">
                <div className="px-1">标签</div>
              </th>
              <SortableHeader sortableKey="totalCostBasis">
                <div>总成本</div>
                <div className="font-mono font-normal">{formatIntegerWithCommas(totals.totalCostBasis)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="totalMarketValue">
                <div>估算总值</div>
                <div className="font-mono font-normal">{formatIntegerWithCommas(totals.totalMarketValue)}</div>
              </SortableHeader>
               <SortableHeader sortableKey="cumulativeMarketValue">
                <div>累计总值</div>
                <div className="font-mono font-normal">{formatIntegerWithCommas(totals.cumulativeMarketValue)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="totalHoldingProfit">
                <div>持有收益</div>
                <div className={`font-mono font-normal ${getProfitColor(totals.totalHoldingProfit)}`}>{formatIntegerWithCommas(totals.totalHoldingProfit)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="grandTotalProfit">
                <div>累计收益</div>
                <div className={`font-mono font-normal ${getProfitColor(totals.grandTotalProfit)}`}>{formatIntegerWithCommas(totals.grandTotalProfit)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="holdingEfficiency">
                <div>收益效率</div>
              </SortableHeader>
              <SortableHeader sortableKey="holdingProfitRate">
                <div>持有收益率</div>
                <div className={`font-mono font-normal ${getProfitColor(totals.holdingProfitRate)}`}>{formatPercentage(totals.holdingProfitRate)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="totalProfitRate">
                <div>累计收益率</div>
                <div className={`font-mono font-normal ${getProfitColor(totals.totalProfitRate)}`}>{formatPercentage(totals.totalProfitRate)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="totalDailyProfit">
                <div>今日收益</div>
                <div className={`font-mono font-normal ${getProfitColor(totals.totalDailyProfit)}`}>{formatIntegerWithCommas(totals.totalDailyProfit)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="dailyEfficiency">
                <div>今日效率</div>
              </SortableHeader>
              <SortableHeader sortableKey="dailyProfitRate">
                <div>今日收益率</div>
                <div className={`font-mono font-normal ${getProfitColor(totals.dailyProfitRate)}`}>{formatPercentage(totals.dailyProfitRate)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="totalRecentProfit">
                <div>近期收益</div>
                <div className={`font-mono font-normal ${getProfitColor(totals.totalRecentProfit)}`}>{formatIntegerWithCommas(totals.totalRecentProfit)}</div>
              </SortableHeader>
              <SortableHeader sortableKey="recentEfficiency">
                <div>近期效率</div>
              </SortableHeader>
              <SortableHeader sortableKey="recentProfitRate">
                <div>近期收益率</div>
                <div className={`font-mono font-normal ${getProfitColor(totals.recentProfitRate)}`}>
                    <div className="relative flex items-center justify-end gap-1">
                        {formatPercentage(totals.recentProfitRate)}
                    </div>
                </div>
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {data.map(item => {
              const isSelected = activeTag === item.tag;
              const recentProfitRate = item.recentProfitRate;
              const isRecentSignificant = recentProfitRate < -4.5 || (recentProfitRate > 0 && recentProfitRate < 4.5);
              const recentHighlightClass = (isRecentSignificant && !isSelected) 
                  ? 'bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-300 dark:group-hover:bg-gray-600' 
                  : '';

              return (
                <tr 
                  key={item.tag} 
                  className={`group border-b dark:border-gray-800 ${isSelected ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  onDoubleClick={() => onTagDoubleClick(item.tag)}
                >
                  <td className={`p-0 border-x dark:border-gray-700 text-left font-medium px-1 sticky left-0 z-10 ${isSelected ? 'bg-gray-300 dark:bg-gray-600' : 'bg-white dark:bg-gray-900 group-hover:bg-gray-100 dark:group-hover:bg-gray-800'}`}>
                    {item.tag}
                    <span className="text-gray-500 dark:text-gray-400 ml-1">{item.fundCount}</span>
                  </td>
                  <td className="px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right" style={getBarStyle(item.totalCostBasis, maxAbsValues.totalCostBasis)}>
                    <div className="relative">
                      {formatIntegerWithCommas(item.totalCostBasis)}
                      {totals.totalCostBasis !== 0 && (
                        <span className="text-gray-500 dark:text-gray-400 ml-1">{((item.totalCostBasis / totals.totalCostBasis) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right" style={getBarStyle(item.totalMarketValue, maxAbsValues.totalMarketValue)}>
                    <div className="relative">
                      {formatIntegerWithCommas(item.totalMarketValue)}
                      {totals.totalMarketValue !== 0 && (
                        <span className="text-gray-500 dark:text-gray-400 ml-1">{((item.totalMarketValue / totals.totalMarketValue) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right" style={getBarStyle(item.cumulativeMarketValue, maxAbsValues.cumulativeMarketValue)}>
                    <div className="relative">
                      {formatIntegerWithCommas(item.cumulativeMarketValue)}
                      {totals.cumulativeMarketValue !== 0 && (
                        <span className="text-gray-500 dark:text-gray-400 ml-1">{((item.cumulativeMarketValue / totals.cumulativeMarketValue) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.totalHoldingProfit)}`} style={getBarStyle(item.totalHoldingProfit, maxAbsValues.totalHoldingProfit)}>
                    <div className="relative">
                      <span>{formatIntegerWithCommas(item.totalHoldingProfit)}</span>
                      {totals.totalHoldingProfit !== 0 && (
                        <span className="text-gray-500 dark:text-gray-400 ml-1">{((item.totalHoldingProfit / Math.abs(totals.totalHoldingProfit)) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.grandTotalProfit)}`} style={getBarStyle(item.grandTotalProfit, maxAbsValues.grandTotalProfit)}>
                    <div className="relative">
                      <span>{formatIntegerWithCommas(item.grandTotalProfit)}</span>
                      {totals.grandTotalProfit !== 0 && (
                        <span className="text-gray-500 dark:text-gray-400 ml-1">{((item.grandTotalProfit / Math.abs(totals.grandTotalProfit)) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getEfficiencyColor(item.holdingEfficiency)}`} style={getBarStyle(item.holdingEfficiency, maxAbsValues.holdingEfficiency, 'efficiency')}>
                      <div className="relative">{formatEfficiency(item.holdingEfficiency)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.holdingProfitRate)}`} style={getBarStyle(item.holdingProfitRate, maxAbsValues.holdingProfitRate)}>
                    <div className="relative">{formatPercentage(item.holdingProfitRate)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.totalProfitRate)}`} style={getBarStyle(item.totalProfitRate, maxAbsValues.totalProfitRate)}>
                    <div className="relative">{formatPercentage(item.totalProfitRate)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.totalDailyProfit)}`} style={getBarStyle(item.totalDailyProfit, maxAbsValues.totalDailyProfit)}>
                    <div className="relative">
                      <span>{formatIntegerWithCommas(item.totalDailyProfit)}</span>
                      {totals.totalDailyProfit !== 0 && (
                        <span className="text-gray-500 dark:text-gray-400 ml-1">{((item.totalDailyProfit / Math.abs(totals.totalDailyProfit)) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getEfficiencyColor(item.dailyEfficiency)}`} style={getBarStyle(item.dailyEfficiency, maxAbsValues.dailyEfficiency, 'efficiency')}>
                      <div className="relative">{formatEfficiency(item.dailyEfficiency)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.dailyProfitRate)}`} style={getBarStyle(item.dailyProfitRate, maxAbsValues.dailyProfitRate)}>
                    <div className="relative">{formatPercentage(item.dailyProfitRate)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.totalRecentProfit)}`} style={getBarStyle(item.totalRecentProfit, maxAbsValues.totalRecentProfit)}>
                    <div className="relative">
                      <span>{formatIntegerWithCommas(item.totalRecentProfit)}</span>
                      {totals.totalRecentProfit !== 0 && (
                        <span className="text-gray-500 dark:text-gray-400 ml-1">{((item.totalRecentProfit / Math.abs(totals.totalRecentProfit)) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getEfficiencyColor(item.recentEfficiency)}`} style={getBarStyle(item.recentEfficiency, maxAbsValues.recentEfficiency, 'efficiency')}>
                      <div className="relative">{formatEfficiency(item.recentEfficiency)}</div>
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.recentProfitRate)} ${recentHighlightClass}`} style={getBarStyle(item.recentProfitRate, maxAbsValues.recentProfitRate)}>
                    <div className="relative flex items-center justify-end gap-1">
                        {item.hasRecentTransaction && <span className="text-gray-800 dark:text-gray-200 text-[10px] leading-none transform translate-y-px">●</span>}
                        {formatPercentage(item.recentProfitRate)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TagAnalysisTable;
