import React, { useState } from 'react';

interface FundInputFormProps {
  onAddFund: (details: { code: string; shares: number; cost: number; tag: string }) => Promise<boolean>;
  isLoading: boolean;
  onOpenImportModal: () => void;
  onOpenTransactionManager: () => void;
  isPrivacyModeEnabled: boolean;
  onPrivacyModeChange: (enabled: boolean) => void;
}

const FundInputForm: React.FC<FundInputFormProps> = ({ 
  onAddFund, 
  isLoading, 
  onOpenImportModal,
  onOpenTransactionManager,
  isPrivacyModeEnabled,
  onPrivacyModeChange,
}) => {
  const [code, setCode] = useState<string>('');
  const [shares, setShares] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [tag, setTag] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paddedCode = code.trim().padStart(6, '0');
    const success = await onAddFund({
      code: paddedCode,
      shares: parseFloat((parseFloat(shares) || 0).toFixed(2)),
      cost: parseFloat((parseFloat(cost) || 0).toFixed(4)),
      tag: tag.trim(),
    });

    if (success) {
      setCode('');
      setShares('');
      setCost('');
      setTag('');
    }
  };

  const isDisabled = isLoading;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-9 gap-4 items-end">
      {/* Fund Code */}
      <div className="md:col-span-1">
        <label htmlFor="fund-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fund Code</label>
        <input
          type="text"
          id="fund-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g., 8888"
          disabled={isDisabled}
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
        />
      </div>

      {/* Shares */}
      <div className="md:col-span-1">
        <label htmlFor="fund-shares" className="block text-sm font-medium text-gray-700 dark:text-gray-300">份额</label>
        <input
          type="number"
          id="fund-shares"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="e.g., 1000"
          step="0.01"
          disabled={isDisabled}
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
        />
      </div>
      
      {/* Cost */}
      <div className="md:col-span-1">
        <label htmlFor="fund-cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">成本</label>
        <input
          type="number"
          id="fund-cost"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="e.g., 1.25"
          step="0.0001"
          disabled={isDisabled}
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
        />
      </div>

      {/* Tag */}
      <div className="md:col-span-2">
        <label htmlFor="fund-tag" className="block text-sm font-medium text-gray-700 dark:text-gray-300">标签</label>
        <input
          type="text"
          id="fund-tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g., 科技, 长线"
          disabled={isDisabled}
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
        />
      </div>
      
      {/* Add Button */}
      <div className="md:col-span-1">
        <button
          type="submit"
          disabled={isDisabled}
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
      </div>
      
      {/* Import Button */}
       <div className="md:col-span-1">
        <button
          type="button"
          onClick={onOpenImportModal}
          disabled={isDisabled}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          导入
        </button>
      </div>

      {/* Transaction Manager Button */}
      <div className="md:col-span-1">
        <button
          type="button"
          onClick={onOpenTransactionManager}
          disabled={isDisabled}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          交易管理
        </button>
      </div>

       {/* Privacy Toggle */}
      <div className="md:col-span-1 flex justify-center pb-1">
        <label htmlFor="privacy-toggle" className="flex flex-col items-center cursor-pointer" title="隐私模式 (移出窗口, 右键或8秒无操作时触发)">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">隐私模式</span>
          <div className="relative">
            <input
              id="privacy-toggle"
              type="checkbox"
              className="sr-only"
              checked={isPrivacyModeEnabled}
              onChange={e => onPrivacyModeChange(e.target.checked)}
              disabled={isDisabled}
            />
            <div className={`block w-10 h-6 rounded-full transition-colors ${isPrivacyModeEnabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isPrivacyModeEnabled ? 'translate-x-4' : ''}`}></div>
          </div>
        </label>
      </div>
    </form>
  );
};

export default FundInputForm;