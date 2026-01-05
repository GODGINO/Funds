
import React from 'react';

interface ReportViewProps {
  isAppLoading: boolean;
  totalDailyProfit: number;
  totalDailyProfitRate: number;
}

const ReportView: React.FC<ReportViewProps> = ({ isAppLoading, totalDailyProfit }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-black transition-colors duration-500">
      <div className="text-center font-mono select-none">
        {isAppLoading ? (
          <div className="text-gray-400 dark:text-gray-600 animate-pulse text-2xl tracking-widest">
            loading...
          </div>
        ) : (
          <div className="text-black dark:text-white text-2xl tracking-widest tabular-nums">
            {totalDailyProfit >= 0 ? '+' : ''}{totalDailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportView;
