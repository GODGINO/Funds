
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Fund } from '../types';
import { fetchGistData, updateGistData } from '../services/gistService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonString: string) => Promise<void>;
  currentData: string;
  funds: Fund[];
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
}

const PullIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <path d="M66.0002 63C66.5306 63 67.0394 63.2107 67.4144 63.5858C67.7895 63.9609 68.0002 64.4696 68.0002 65V91H76.2642C77.8642 91 78.8162 92.784 77.9282 94.112L65.6642 112.504C65.4816 112.778 65.2341 113.003 64.9438 113.158C64.6536 113.313 64.3294 113.394 64.0002 113.394C63.671 113.394 63.3469 113.313 63.0566 113.158C62.7663 113.003 62.5189 112.778 62.3362 112.504L50.0722 94.104C49.8729 93.8029 49.7588 93.4534 49.742 93.0926C49.7253 92.7319 49.8066 92.3733 49.9772 92.055C50.1478 91.7368 50.4015 91.4706 50.7112 91.2849C51.0209 91.0991 51.3751 91.0007 51.7362 91H60.0002V65C60.0002 64.4696 60.2109 63.9609 60.586 63.5858C60.9611 63.2107 61.4698 63 62.0002 63H66.0002ZM64.0002 15C71.8007 15.0091 79.33 17.8629 85.1769 23.0264C91.0237 28.1898 94.7866 35.3085 95.7602 43.048C103.421 43.5078 110.615 46.8822 115.867 52.4788C121.118 58.0753 124.028 65.4695 124 73.144C123.92 89.728 110.136 103 93.5442 103H90.0002C89.4698 103 88.9611 102.789 88.586 102.414C88.2109 102.039 88.0002 101.53 88.0002 101V97C88.0002 96.4696 88.2109 95.9609 88.586 95.5858C88.9611 95.2107 89.4698 95 90.0002 95H93.6082C105.92 95 116.208 84.92 116 72.616C115.893 66.85 113.529 61.356 109.416 57.3142C105.302 53.2724 99.7672 51.0053 94.0002 51H90.0002C89.4698 51 88.9611 50.7893 88.586 50.4142C88.2109 50.0391 88.0002 49.5304 88.0002 49V47.4C88.0002 34.264 77.6002 23.256 64.4642 23C61.2745 22.9416 58.1051 23.519 55.141 24.6986C52.1769 25.8783 49.4774 27.6365 47.2001 29.8706C44.9228 32.1047 43.1132 34.77 41.877 37.711C40.6409 40.652 40.0029 43.8098 40.0002 47V49C40.0002 49.5304 39.7895 50.0391 39.4144 50.4142C39.0393 50.7893 38.5306 51 38.0002 51H34.0002C28.2332 51.0053 22.6984 53.2724 18.5848 57.3142C14.4712 61.356 12.107 66.85 12.0002 72.616C11.7922 84.928 22.0802 95 34.3922 95H38.0002C38.5306 95 39.0393 95.2107 39.4144 95.5858C39.7895 95.9609 40.0002 96.4696 40.0002 97V101C40.0002 101.53 39.7895 102.039 39.4144 102.414C39.0393 102.789 38.5306 103 38.0002 103H34.4562C17.8642 103 4.0802 89.728 4.0002 73.144C3.97211 65.4695 6.88238 58.0753 12.1338 52.4788C17.3852 46.8822 24.5795 43.5078 32.2402 43.048C33.2138 35.3085 36.9767 28.1898 42.8235 23.0264C48.6704 17.8629 56.1997 15.0091 64.0002 15Z" fill="currentColor"/>
  </svg>
);

const SyncIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <path d="M64.0061 63C64.3351 63.0001 64.6593 63.0811 64.9494 63.2363C65.2397 63.3917 65.4875 63.6167 65.6701 63.8906L77.9338 82.291C78.133 82.592 78.2471 82.9412 78.2639 83.3018C78.2806 83.6625 78.1991 84.0216 78.0285 84.3398C77.858 84.6578 77.6045 84.9237 77.2951 85.1094C76.9854 85.2951 76.6309 85.3939 76.2697 85.3945H68.0061V111.395C68.0061 111.925 67.7951 112.434 67.4201 112.809C67.0451 113.184 66.5364 113.394 66.0061 113.395H62.0061C61.4756 113.395 60.9661 113.184 60.591 112.809C60.2161 112.434 60.0061 111.925 60.0061 111.395V85.3945H51.7414C50.1416 85.3943 49.1894 83.6101 50.0773 82.2822L62.342 63.8906C62.5246 63.6168 62.7715 63.3916 63.0617 63.2363C63.352 63.081 63.6768 63 64.0061 63ZM64.0002 15C71.8006 15.0091 79.3301 17.863 85.177 23.0264C91.0238 28.1898 94.7873 35.3084 95.7609 43.0479C103.422 43.5077 110.616 46.8821 115.867 52.4785C121.119 58.0749 124.028 65.4692 124 73.1436C123.92 89.7276 110.136 103 93.5441 103H90.0002C89.4699 103 88.9611 102.789 88.5861 102.414C88.2112 102.039 88.0002 101.53 88.0002 101V97C88.0002 96.4697 88.2112 95.961 88.5861 95.5859C88.9611 95.211 89.4699 95.0001 90.0002 95H93.6086C105.921 95 116.208 84.9201 116 72.6162C115.893 66.8503 113.53 61.3562 109.416 57.3145C105.303 53.2727 99.7672 51.0053 94.0002 51H90.0002C89.4699 50.9999 88.9611 50.789 88.5861 50.4141C88.2112 50.039 88.0002 49.5303 88.0002 49V47.4004C88.0002 34.2645 77.6008 23.2562 64.465 23C61.2755 22.9416 58.1058 23.5187 55.1418 24.6982C52.1778 25.8778 49.4777 27.6361 47.2004 29.8701C44.9231 32.1042 43.1133 34.7699 41.8772 37.7109C40.641 40.6519 40.0029 43.8098 40.0002 47V49C40.0002 49.5303 39.7901 50.039 39.4152 50.4141C39.0402 50.7891 38.5306 51 38.0002 51H34.0002C28.2334 51.0054 22.6987 53.2727 18.5852 57.3145C14.4717 61.3562 12.107 66.8503 12.0002 72.6162C11.7923 84.9281 22.0808 95 34.3928 95H38.0002C38.5306 95 39.0402 95.2109 39.4152 95.5859C39.7901 95.961 40.0002 96.4697 40.0002 97V101C40.0002 101.53 39.7901 102.039 39.4152 102.414C39.0402 102.789 38.5306 103 38.0002 103H34.4563C17.8644 103 4.0802 89.7274 4.0002 73.1436C3.97222 65.4692 6.88268 58.0749 12.134 52.4785C17.3854 46.882 24.5798 43.5077 32.2404 43.0479C33.2141 35.3084 36.9776 28.1898 42.8244 23.0264C48.6711 17.8631 56.2 15.0092 64.0002 15Z" fill="currentColor"/>
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, currentData, funds, isAutoSyncEnabled, onToggleAutoSync }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isCopiedNewFormat, setIsCopiedNewFormat] = useState(false);
  const [gistLoading, setGistLoading] = useState<'pull' | 'push' | null>(null);
  const [githubToken, setGithubToken] = useState(localStorage.getItem('GITHUB_TOKEN') || '');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens, using the latest currentData
      setJsonInput(currentData);
      setError(null);
      setIsImporting(false);
      setIsCopiedNewFormat(false);
      setGistLoading(null);

      setGithubToken(localStorage.getItem('GITHUB_TOKEN') || '');
      
      // Auto-select text content after a short delay
      setTimeout(() => {
        textareaRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentData]);

  const handleSave = useCallback(async () => {
    setError(null);
    setIsImporting(true);
    try {
      await onImport(jsonInput);
      // If the import is successful, close the modal automatically.
      onClose();
    } catch (err) {
      // On failure, display the error and keep the modal open.
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsImporting(false);
    }
  }, [jsonInput, onImport, onClose]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleGistPull = async () => {
      setGistLoading('pull');
      setError(null);
      try {
          // For pulling public gists, token is optional but helps with rate limits.
          // If the gist is private, token is required.
          const content = await fetchGistData(githubToken);
          setJsonInput(content);

      } catch (err) {
          setError(err instanceof Error ? `拉取失败: ${err.message}` : '拉取 Gist 失败。');
      } finally {
          setGistLoading(null);
      }
  };

  const handleGistPush = async () => {
      if (!githubToken) {
          setError('请先输入 GitHub Token 以进行同步。');
          return;
      }
      if (!jsonInput) {
          setError('内容为空，无法同步。');
          return;
      }

      setGistLoading('push');
      setError(null);
      try {
          await updateGistData(githubToken, jsonInput);
      } catch (err) {
          setError(err instanceof Error ? `同步失败: ${err.message}` : '同步到 Gist 失败。');
      } finally {
          setGistLoading(null);
      }
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent adding a new line
      if (!isImporting && jsonInput) {
        handleSave();
      }
    }
  };

  const handleCopyNewFormat = () => {
    if (!funds || funds.length === 0) return;

    const newFormatData = funds.map((fund, index) => ({
      name: fund.name,
      code: fund.code,
      cyfe: fund.userPosition?.shares ?? 0,
      cbj: fund.userPosition?.cost ?? 0,
      originSort: index
    }));

    navigator.clipboard.writeText(JSON.stringify(newFormatData));
    setIsCopiedNewFormat(true);
    setTimeout(() => setIsCopiedNewFormat(false), 2000);
  };


  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl m-4 transform transition-all flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">导入/导出/同步数据</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          
          {/* Gist Controls & Textarea Container */}
          <div className="flex gap-4 mb-2 h-48">
              {githubToken && (
                <div className="flex flex-col gap-2 w-12 flex-shrink-0 h-full">
                    {!isAutoSyncEnabled && (
                        <button 
                            onClick={handleGistPull}
                            disabled={gistLoading !== null}
                            className="flex-1 w-full flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            title="拉取数据 (Pull)"
                        >
                            {gistLoading === 'pull' ? <LoadingSpinner /> : <PullIcon />}
                        </button>
                    )}
                    {isAutoSyncEnabled && (
                        <button 
                            onClick={handleGistPush}
                            disabled={gistLoading !== null}
                            className="flex-1 w-full flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            title="同步数据"
                        >
                            {gistLoading === 'push' ? <LoadingSpinner /> : <SyncIcon />}
                        </button>
                    )}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder='e.g., [{"code":"007345","shares":1000,"cost":1.7,"realizedProfit":0,"tag":"科技"}]'
                className="flex-1 h-full p-2 font-mono text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 resize-none"
                disabled={isImporting}
              />
          </div>
          
          {/* Error Message */}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg flex-wrap gap-4">
           <div className="flex items-center gap-4 flex-wrap">
            <button
                onClick={handleCopyNewFormat}
                type="button"
                className="px-3 py-2 border border-gray-300 dark:border-gray-500 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={isImporting || !funds.length}
                title="复制外部系统兼容的 JSON 格式 (包含名称、份额、成本)"
            >
                {isCopiedNewFormat ? '复制成功' : '复制json'}
            </button>
            
            {githubToken && (
                <button
                    onClick={() => onToggleAutoSync(!isAutoSyncEnabled)}
                    type="button"
                    className={`px-3 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors ${
                        isAutoSyncEnabled
                            ? 'bg-green-600 hover:bg-green-700 text-white border-transparent'
                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                    title="开启后，当交易发生时自动同步到 Gist"
                >
                    自动同步
                </button>
            )}
           </div>
          <div className="flex items-center gap-4">
            <button
                onClick={handleSave}
                type="button"
                disabled={isImporting || !jsonInput}
                className="w-28 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 dark:disabled:bg-primary-800 disabled:cursor-not-allowed"
            >
                {isImporting ? <LoadingSpinner /> : "保存并替换"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
