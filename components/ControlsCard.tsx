import React from 'react';

type SortByType = 'trend' | 'dailyChange' | 'navPercentile';

const recordCountOptions = [10, 50, 100, 150, 200, 300];

interface ControlsCardProps {
  sortBy: SortByType;
  sortOrder: 'asc' | 'desc';
  onSortByChange: (newSortBy: SortByType) => void;
  onSortOrderChange: (newSortOrder: 'asc' | 'desc') => void;
  recordCount: number;
  onRecordCountChange: (count: number) => void;
  zigzagThreshold: number;
  onZigzagThresholdChange: (threshold: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isLoading: boolean;
}

const ControlsCard: React.FC<ControlsCardProps> = ({ 
  sortBy, 
  sortOrder, 
  onSortByChange, 
  onSortOrderChange,
  recordCount,
  onRecordCountChange,
  zigzagThreshold,
  onZigzagThresholdChange,
  onRefresh,
  isRefreshing,
  isLoading
}) => {
  const isDisabled = isLoading || isRefreshing;
  
  return (
    <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg shadow-md p-3 flex items-end justify-between flex-wrap gap-4">
      <div className="flex items-end flex-wrap gap-4">
        {/* Sorting Controls */}
        <div className="flex items-end gap-2">
           <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">排序</label>
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value as SortByType)}
                disabled={isDisabled}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              >
                <option value="trend">近期趋势</option>
                <option value="dailyChange">今日涨幅</option>
                <option value="navPercentile">分位点</option>
              </select>
           </div>
          <div>
            <select
              value={sortOrder}
              onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')}
              disabled={isDisabled}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </div>
        </div>

        {/* Data Controls */}
        <div>
          <label htmlFor="record-count" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">数据范围</label>
          <select
            id="record-count"
            value={recordCount}
            onChange={(e) => onRecordCountChange(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full md:w-16 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          >
            {recordCountOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="zigzag-threshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">趋势阈值 (%)</label>
          <input
            type="number"
            id="zigzag-threshold"
            value={zigzagThreshold}
            onChange={(e) => onZigzagThresholdChange(Math.max(0, Number(e.target.value)))}
            min="0"
            step="0.5"
            disabled={isDisabled}
            className="w-full md:w-20 block px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          />
        </div>
      </div>
      
      {/* Refresh Button */}
      <div>
         <button
          type="button"
          onClick={onRefresh}
          disabled={isDisabled}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh real-time data"
        >
          {isRefreshing ? (
            <svg className="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M2.985 19.644A8.25 8.25 0 0116.023 9.348m0 0v-4.992m0 0H9.348m6.675 0l-3.181 3.183" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default ControlsCard;
