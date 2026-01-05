
import React from 'react';

interface ReportViewProps {
  isAppLoading: boolean;
  totalDailyProfit: number;
  totalDailyProfitRate: number;
}

const ReportView: React.FC<ReportViewProps> = ({ isAppLoading, totalDailyProfit, totalDailyProfitRate }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-black transition-colors duration-500">
      <div className="text-center font-mono select-none">
        {isAppLoading ? (
          <div className="text-gray-400 dark:text-gray-600 animate-pulse text-2xl tracking-widest">
            loading...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-6xl md:text-8xl font-bold text-black dark:text-white tabular-nums tracking-tighter">
              {totalDailyProfit >= 0 ? '+' : ''}{totalDailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-2xl md:text-3xl font-medium text-gray-500 dark:text-gray-400 tabular-nums">
              {totalDailyProfitRate >= 0 ? '+' : ''}{totalDailyProfitRate.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportView;
