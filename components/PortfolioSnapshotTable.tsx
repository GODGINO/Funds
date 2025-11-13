import React, { useState } from 'react';
import { PortfolioSnapshot, ProcessedFund } from '../types';
import SnapshotDetailModal from './SnapshotDetailModal';

interface PortfolioSnapshotTableProps {
  snapshots: PortfolioSnapshot[];
  funds: ProcessedFund[];
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const formatCurrency = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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


const PortfolioSnapshotTable: React.FC<PortfolioSnapshotTableProps> = ({ snapshots, funds }) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<PortfolioSnapshot | null>(null);

  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg shadow-md p-4">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 text-left">切片日期</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">总成本</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">持有总值</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">累计总值</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">总收益</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">收益率</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">日收益</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">日收益率</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">金额变动</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">总值变动</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">操作收益</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">每百收益</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">买入金额</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">浮盈</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">卖出金额</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">机会收益</th>
                <th className="px-1 py-0.5 border dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300">落袋</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map(snapshot => {
                const isBaselineRow = snapshot.snapshotDate === '基准持仓';
                const rowClasses = isBaselineRow
                  ? 'bg-primary-50 dark:bg-primary-900/30 font-semibold'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50';
                
                const daysAgo = isBaselineRow ? null : getDaysAgo(snapshot.snapshotDate);

                return (
                <tr key={snapshot.snapshotDate} onClick={() => setSelectedSnapshot(snapshot)} className={`border-b dark:border-gray-800 cursor-pointer ${rowClasses}`}>
                  <td className="px-1 py-0.5 border-x dark:border-gray-700 font-mono text-left">
                    <span>{isBaselineRow ? snapshot.snapshotDate : snapshot.snapshotDate.substring(2)}</span>
                    {daysAgo !== null && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">{daysAgo}</span>
                    )}
                  </td>
                  <td className="px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right">{formatCurrency(snapshot.totalCostBasis)}</td>
                  <td className="px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right">{formatCurrency(snapshot.currentMarketValue)}</td>
                  <td className="px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right">{formatCurrency(snapshot.cumulativeValue)}</td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.totalProfit)}`}>
                    {snapshot.totalProfit >= 0 ? '+' : ''}{formatCurrency(snapshot.totalProfit)}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.profitRate)}`}>
                    {formatPercentage(snapshot.profitRate)}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.dailyProfit)}`}>
                    {snapshot.dailyProfit >= 0 ? '+' : ''}{formatCurrency(snapshot.dailyProfit)}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.dailyProfitRate)}`}>
                    {formatPercentage(snapshot.dailyProfitRate)}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${isBaselineRow ? '' : getProfitColor(snapshot.netAmountChange)}`}>
                    {isBaselineRow ? (
                        '-'
                    ) : (
                        `${snapshot.netAmountChange >= 0 ? '+' : ''}${formatCurrency(snapshot.netAmountChange)}`
                    )}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${snapshot.marketValueChange ? getProfitColor(snapshot.marketValueChange) : ''}`}>
                    {snapshot.marketValueChange != null ? (
                      `${snapshot.marketValueChange >= 0 ? '+' : ''}${formatCurrency(snapshot.marketValueChange)}`
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${snapshot.operationProfit ? getProfitColor(snapshot.operationProfit) : ''}`}>
                    {snapshot.operationProfit != null ? (
                      `${snapshot.operationProfit >= 0 ? '+' : ''}${formatCurrency(snapshot.operationProfit)}`
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${snapshot.profitPerHundred ? getProfitColor(snapshot.profitPerHundred) : ''}`}>
                    {snapshot.profitPerHundred != null ? (
                      `${snapshot.profitPerHundred >= 0 ? '+' : ''}${snapshot.profitPerHundred.toFixed(2)}`
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right`}>
                      {snapshot.totalBuyAmount ? formatCurrency(snapshot.totalBuyAmount) : '-'}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.totalBuyFloatingProfit ?? 0)}`}>
                      {(snapshot.totalBuyAmount ?? 0) > 0 ? `${(snapshot.totalBuyFloatingProfit ?? 0) >= 0 ? '+' : ''}${formatCurrency(snapshot.totalBuyFloatingProfit ?? 0)}` : '-'}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right`}>
                      {snapshot.totalSellAmount ? formatCurrency(snapshot.totalSellAmount) : '-'}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.totalSellOpportunityProfit ?? 0)}`}>
                      {(snapshot.totalSellAmount ?? 0) > 0 ? `${(snapshot.totalSellOpportunityProfit ?? 0) >= 0 ? '+' : ''}${formatCurrency(snapshot.totalSellOpportunityProfit ?? 0)}` : '-'}
                  </td>
                  <td className={`px-1 py-0.5 border-x dark:border-gray-700 font-mono text-right ${getProfitColor(snapshot.totalSellRealizedProfit ?? 0)}`}>
                      {(snapshot.totalSellAmount ?? 0) > 0 ? `${(snapshot.totalSellRealizedProfit ?? 0) >= 0 ? '+' : ''}${formatCurrency(snapshot.totalSellRealizedProfit ?? 0)}` : '-'}
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
        />
      )}
    </>
  );
};

export default PortfolioSnapshotTable;