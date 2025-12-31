import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessedFund } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonString: string) => Promise<void>;
  currentData: string;
  funds: ProcessedFund[];
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
}

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
  const [githubToken, setGithubToken] = useState(localStorage.getItem('GITHUB_TOKEN') || '');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens, using the latest currentData
      setJsonInput(currentData);
      setError(null);
      setIsImporting(false);
      setIsCopiedNewFormat(false);

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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">用户数据</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Textarea Container */}
          <div className="mb-2 h-48">
              <textarea
                ref={textareaRef}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder='e.g., [{"code":"007345","shares":1000,"cost":1.7,"realizedProfit":0,"tag":"科技"}]'
                className="w-full h-full p-2 font-mono text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500 resize-none"
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
                    {isAutoSyncEnabled ? "同步: 主" : "同步: 从"}
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
                {isImporting ? <LoadingSpinner /> : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;