import React from 'react';
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

      // FIX: Correctly handle children of React elements.
      // The `React.isValidElement` type guard is enhanced with a generic type `PropsWithChildren`
      // to ensure TypeScript correctly infers that `titleElement.props.children` exists and is accessible.
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
          <th className={`p-0 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer ${className}`} onClick={() => onSortChange(sortableKey)}>
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
    <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg shadow-md p-4">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs text-center border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="p-0 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 text-left">
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
                <div className={`font-mono font-normal ${getProfitColor(totals.recentProfitRate)}`}>{formatPercentage(totals.recentProfitRate)}</div>
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {data.map(item => {
              const isSelected = activeTag === item.tag;
              return (
                <tr 
                  key={item.tag} 
                  className={`border-b dark:border-gray-800 cursor-pointer ${isSelected ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  onDoubleClick={() => onTagDoubleClick(item.tag)}
                >
                  <td className="p-0 border-x dark:border-gray-700 text-left font-medium px-1">
                    {item.tag}
                    <span className="text-gray-500 dark:text-gray-400 ml-1">({item.fundCount})</span>
                  </td>
                  <td className="p-0 border-x dark:border-gray-700 font-mono text-right">
                    {formatIntegerWithCommas(item.totalCostBasis)}
                    {totals.totalCostBasis !== 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">({((item.totalCostBasis / totals.totalCostBasis) * 100).toFixed(0)}%)</span>
                    )}
                  </td>
                  <td className="p-0 border-x dark:border-gray-700 font-mono text-right">
                    {formatIntegerWithCommas(item.totalMarketValue)}
                    {totals.totalMarketValue !== 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">({((item.totalMarketValue / totals.totalMarketValue) * 100).toFixed(0)}%)</span>
                    )}
                  </td>
                  <td className="p-0 border-x dark:border-gray-700 font-mono text-right">
                    {formatIntegerWithCommas(item.cumulativeMarketValue)}
                    {totals.cumulativeMarketValue !== 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">({((item.cumulativeMarketValue / totals.cumulativeMarketValue) * 100).toFixed(0)}%)</span>
                    )}
                  </td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.totalHoldingProfit)}`}>
                    <span>{formatIntegerWithCommas(item.totalHoldingProfit)}</span>
                    {totals.totalHoldingProfit !== 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">({((item.totalHoldingProfit / totals.totalHoldingProfit) * 100).toFixed(0)}%)</span>
                    )}
                  </td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.grandTotalProfit)}`}>
                    <span>{formatIntegerWithCommas(item.grandTotalProfit)}</span>
                    {totals.grandTotalProfit !== 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">({((item.grandTotalProfit / totals.grandTotalProfit) * 100).toFixed(0)}%)</span>
                    )}
                  </td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getEfficiencyColor(item.holdingEfficiency)}`}>
                      {formatEfficiency(item.holdingEfficiency)}
                  </td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.holdingProfitRate)}`}>{formatPercentage(item.holdingProfitRate)}</td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.totalProfitRate)}`}>{formatPercentage(item.totalProfitRate)}</td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.totalDailyProfit)}`}>
                    <span>{formatIntegerWithCommas(item.totalDailyProfit)}</span>
                    {totals.totalDailyProfit !== 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">({((item.totalDailyProfit / totals.totalDailyProfit) * 100).toFixed(0)}%)</span>
                    )}
                  </td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getEfficiencyColor(item.dailyEfficiency)}`}>
                      {formatEfficiency(item.dailyEfficiency)}
                  </td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.dailyProfitRate)}`}>{formatPercentage(item.dailyProfitRate)}</td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.totalRecentProfit)}`}>
                    <span>{formatIntegerWithCommas(item.totalRecentProfit)}</span>
                    {totals.totalRecentProfit !== 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">({((item.totalRecentProfit / totals.totalRecentProfit) * 100).toFixed(0)}%)</span>
                    )}
                  </td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getEfficiencyColor(item.recentEfficiency)}`}>
                      {formatEfficiency(item.recentEfficiency)}
                  </td>
                  <td className={`p-0 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(item.recentProfitRate)}`}>{formatPercentage(item.recentProfitRate)}</td>
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