

import React, { useRef } from 'react';

type SortByType = 'trend' | 'dailyChange' | 'navPercentile';

const recordCountOptions = [10, 50, 100, 150, 200, 300];

interface ControlsCardProps {
  tags: string[];
  activeTag: string | null;
  onTagSelect: (tag: string | null) => void;
  sortBy: SortByType;
  sortOrder: 'asc' | 'desc';
  onSortByChange: (newSortBy: SortByType) => void;
  onSortOrderChange: (newSortOrder: 'asc' | 'desc') => void;
  recordCount: number;
  onRecordCountChange: (count: number) => void;
  zigzagThreshold: number;
  onZigzagThresholdChange: (threshold: number) => void;
  onRefresh: () => void;
  onLongPressRefresh: () => void;
  isRefreshing: boolean;
  isLoading: boolean;
  totalDailyProfit: number;
  totalDailyProfitRate: number;
}

const ControlsCard: React.FC<ControlsCardProps> = ({ 
  tags,
  activeTag,
  onTagSelect,
  sortBy, 
  sortOrder, 
  onSortByChange, 
  onSortOrderChange,
  recordCount,
  onRecordCountChange,
  zigzagThreshold,
  onZigzagThresholdChange,
  onRefresh,
  onLongPressRefresh,
  isRefreshing,
  isLoading,
  totalDailyProfit,
  totalDailyProfitRate,
}) => {
  const isDisabled = isLoading || isRefreshing;
  const profitColor = totalDailyProfit >= 0 ? 'text-red-500' : 'text-green-600';
  
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef<boolean>(false);

  const handlePressStart = () => {
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onLongPressRefresh();
    }, 3000);
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleClick = () => {
    if (longPressTriggered.current) {
      return;
    }
    onRefresh();
  };
  
  return (
    <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg shadow-md p-3 flex items-end justify-between flex-wrap gap-4">
      <div className="flex items-end flex-wrap gap-4">
        {/* Tag Filter Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">筛选</label>
          <select
            value={activeTag || ''}
            onChange={(e) => onTagSelect(e.target.value || null)}
            disabled={isDisabled || tags.length === 0}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          >
            <option value="">All</option>
            {tags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>

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
            className="w-20 block px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          />
        </div>
        {/* Daily Stats */}
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">今日收益</label>
            <div className={`py-1.5 text-sm font-semibold ${profitColor}`}>
                {totalDailyProfit > 0 ? '+' : ''}{totalDailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">今日收益率</label>
            <div className={`py-1.5 text-sm font-semibold ${profitColor}`}>
                {totalDailyProfitRate > 0 ? '+' : ''}{totalDailyProfitRate.toFixed(2)}%
            </div>
        </div>
      </div>
      
      {/* Right-side group for refresh */}
      <div className="flex items-end">
        {/* Refresh Button */}
        <div>
           <button
            type="button"
            onClick={handleClick}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            disabled={isDisabled}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh real-time data. Long press to reload all historical data."
            title="单击刷新实时估值, 长按3秒重载历史数据"
          >
            {isRefreshing ? (
              <svg className="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor">
                <path d="M980.949037 530.566288c-10.860076 52.126224-26.368832 98.918742-46.840014 140.378222-69.787059 141.334182-189.054562 215.486946-357.791136 222.327175-80.031013 3.14684-155.557844-7.24897-226.744391-31.058319v-0.956628l-31.481778 73.469745c-6.331811 11.652807-11.511654 15.436507-18.373289 20.125994-5.413314 3.700079-14.85584 6.258224-21.184307 6.912478-6.466943 0.668971-11.14974 0.222767-19.622927-2.229681-6.703759-1.940685-9.492699-5.052069-11.818712-6.68971-2.325343-1.644331-7.67845-7.690491-8.919391-8.919391L79.092447 693.519607c-4.029213-6.841567-6.354556-13.408856-7.134576-19.841681-0.771993-6.29368-0.310403-11.630731 1.090422-16.007808 1.392798-4.37574 3.71881-8.483891 7.134577-12.312413a78.55058 78.55058 0 0 1 10.231912-9.440519c3.414428-2.598953 7.133907-4.650687 11.16914-6.567289 4.029213-1.916602 6.823505-3.011708 8.065115-3.285985 1.394136-0.273609 2.325343-0.68235 3.098005-1.36537l278.546164-68.683258c14.889289-3.14684 29.13971-4.187759 37.982838-2.544765 8.839114 1.642993 10.767758 2.185528 16.501509 4.236593 5.74111 2.190211 12.264246 7.581449 15.150187 12.945259 2.758168 5.126994 3.877356 9.853275 4.657376 13.682465 0.771993 3.833204 0.771993 8.210282 0 13.133908-0.779351 4.924965-1.400156 8.345414-2.020961 9.854613-0.773331 1.637641-1.083733 2.597615-1.083733 3.280634l-32.570193 73.475766c57.697415 19.562051 111.97438 31.602192 163.15401 36.256892 51.185651 4.650687 94.761087 3.555581 130.589838-3.285986s69.324131-18.198688 100.184434-33.932887c30.866993-15.732861 55.216201-31.331928 73.208847-46.652703 17.987293-15.325458 34.117523-32.288556 48.233481-50.901338 14.266477-18.606092 23.105591-31.327245 26.983616-38.168143 3.722824-6.705766 6.668972-12.452227 8.684582-16.829304zM48.542546 487.902659c14.889289-61.569419 35.828751-115.612245 62.969576-162.131153C189.521504 195.795115 313.12996 132.313107 482.639864 135.459947c75.222449 1.230238 143.615373 13.408856 205.343339 36.799428l33.496718-72.508433c4.707549-7.897872 9.581672-13.355338 14.853833-17.458807 5.429369-4.107482 10.894193-5.663509 15.543542-6.62482 4.808564-0.956629 9.900103-1.392129 14.866544-0.705765 5.112946 0.68235 7.442303 1.003457 11.73509 2.425021 3.865315 1.280411 4.692163 1.460364 8.417662 3.512098 3.71881 2.19088 7.107817 4.738322 10.536294 8.083177l6.243507 7.358681 150.592741 249.407792c3.413759 7.522579 5.429369 14.364146 6.050174 20.796303 0.778013 6.29368 0.310403 11.630731-1.083733 16.007808-1.392798 4.37574-3.877356 8.483891-7.602187 12.178618-3.720148 3.827852-7.285764 6.841567-10.70153 8.892632a86.290575 86.290575 0 0 1-11.163119 6.153196l-8.065115 3.833204c-1.394136 0.68235-2.325343 0.956629-3.104026 0.956629l-280.561105 62.253107c-19.075709 2.597615-34.26938 2.190211-45.748923-0.956628-11.47486-3.14684-19.273725-10.712233-22.530944-16.049954-3.408407-5.332368-4.844688-8.837108-5.463487-16.334266-0.541198-6.557254-0.111049-9.56361 0.668971-12.71045 0.771993-3.14684 2.66585-8.539415 4.059985-10.456017l34.585803-72.515123c-56.919401-20.657826-111.043842-33.931549-162.691082-39.537527-51.490032-5.611329-95.067475-5.611329-130.583817 0-35.518349 5.605977-69.172275 16.00647-100.654052 31.058319-31.481777 15.046497-56.457142 30.098345-74.754839 45.284657-18.303048 15.185643-34.895537 31.740669-49.784825 49.939357-14.889289 18.19735-24.347201 30.78471-28.535629 37.626276-3.875349 6.702421-6.668972 12.040141-8.063108 15.734199z m0-13.380089" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlsCard;