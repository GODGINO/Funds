
import React from 'react';

interface ReportViewProps {
  isAppLoading: boolean;
  totalDailyProfit: number;
  totalDailyProfitRate: number;
  lastRefreshTime: string | null;
  onRefresh: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ isAppLoading, totalDailyProfit, totalDailyProfitRate, lastRefreshTime, onRefresh }) => {
  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-black transition-colors duration-500 select-none cursor-default"
      onDoubleClick={onRefresh}
    >
      <div className="text-center font-mono">
        {isAppLoading ? (
          <div className="text-gray-400 dark:text-gray-600 animate-pulse text-2xl tracking-widest uppercase">
            loading...
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-black dark:text-white text-2xl tracking-widest tabular-nums">
              {totalDailyProfit >= 0 ? '+' : ''}{totalDailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-gray-400 dark:text-gray-500 text-sm tracking-widest mt-1 tabular-nums">
              {totalDailyProfitRate >= 0 ? '+' : ''}{totalDailyProfitRate.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {/* 底部最后更新时间 */}
      {!isAppLoading && lastRefreshTime && (
        <div className="absolute bottom-10 left-0 right-0 text-center">
          <div className="text-gray-400 dark:text-gray-600 font-mono text-xs tracking-widest uppercase opacity-60">
            {lastRefreshTime}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportView;
