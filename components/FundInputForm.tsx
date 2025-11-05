import React, { useState } from 'react';

interface FundInputFormProps {
  onAddFund: (code: string) => void;
  isLoading: boolean;
  recordCount: number;
  onRecordCountChange: (count: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const recordCountOptions = [10, 50, 100, 150, 200, 300];

const FundInputForm: React.FC<FundInputFormProps> = ({ onAddFund, isLoading, recordCount, onRecordCountChange, onRefresh, isRefreshing }) => {
  const [code, setCode] = useState<string>('007345');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trim and pad the code with leading zeros to make it 6 digits long.
    const paddedCode = code.trim().padStart(6, '0');
    onAddFund(paddedCode);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <div className="md:col-span-1">
        <label htmlFor="fund-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fund Code</label>
        <input
          type="text"
          id="fund-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g., 8888"
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="record-count" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recent Records</label>
        <select
          id="record-count"
          value={recordCount}
          onChange={(e) => onRecordCountChange(Number(e.target.value))}
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        >
          {recordCountOptions.map(option => (
            <option key={option} value={option}>{`Last ${option} records`}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center space-x-2">
        <button
          type="submit"
          disabled={isLoading || isRefreshing}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 disabled:cursor-not-allowed dark:disabled:bg-primary-800"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Fetching...
            </>
          ) : 'Add Fund'}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || isRefreshing}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-primary-600 text-sm font-medium rounded-md shadow-sm text-primary-600 bg-white dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-800 dark:disabled:text-gray-500 dark:disabled:border-gray-700"
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : 'Refresh'}
        </button>
      </div>
    </form>
  );
};

export default FundInputForm;