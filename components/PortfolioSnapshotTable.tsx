import React from 'react';
import { PortfolioSnapshot } from '../types';

interface PortfolioSnapshotTableProps {
  snapshots: PortfolioSnapshot[];
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const formatCurrency = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const PortfolioSnapshotTable: React.FC<PortfolioSnapshotTableProps> = ({ snapshots }) => {
  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">持仓切片分析</h3>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="p-2 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">切片日期</th>
              <th className="p-2 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">总成本</th>
              <th className="p-2 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">持有总值</th>
              <th className="p-2 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">累计总值</th>
              <th className="p-2 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">总收益</th>
              <th className="p-2 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">收益率</th>
              <th className="p-2 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">日收益</th>
              <th className="p-2 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">日收益率</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map(snapshot => {
              const isBaselineRow = snapshot.snapshotDate === '基准持仓';
              const rowClasses = isBaselineRow
                ? 'bg-gray-100 dark:bg-gray-800 font-semibold'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50';

              return (
              <tr key={snapshot.snapshotDate} className={`border-b dark:border-gray-800 ${rowClasses}`}>
                <td className="p-2 border-x dark:border-gray-700 font-mono">{snapshot.snapshotDate}</td>
                <td className="p-2 border-x dark:border-gray-700 font-mono text-right">{formatCurrency(snapshot.totalCostBasis)}</td>
                <td className="p-2 border-x dark:border-gray-700 font-mono text-right">{formatCurrency(snapshot.currentMarketValue)}</td>
                <td className="p-2 border-x dark:border-gray-700 font-mono text-right">{formatCurrency(snapshot.cumulativeValue)}</td>
                <td className={`p-2 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.totalProfit)}`}>
                  {snapshot.totalProfit >= 0 ? '+' : ''}{formatCurrency(snapshot.totalProfit)}
                </td>
                <td className={`p-2 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.profitRate)}`}>
                  {formatPercentage(snapshot.profitRate)}
                </td>
                <td className={`p-2 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.dailyProfit)}`}>
                  {snapshot.dailyProfit >= 0 ? '+' : ''}{formatCurrency(snapshot.dailyProfit)}
                </td>
                <td className={`p-2 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.dailyProfitRate)}`}>
                  {formatPercentage(snapshot.dailyProfitRate)}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortfolioSnapshotTable;