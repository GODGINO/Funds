import React, { useState, useEffect } from 'react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonString: string) => Promise<void>;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setJsonInput('');
      setError(null);
      setIsImporting(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setError(null);
    setIsImporting(true);
    try {
      await onImport(jsonInput);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsImporting(false);
    }
  };

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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg m-4 transform transition-all flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">从 JSON 导入数据</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            粘贴您的基金持仓数据 JSON 字符串。这将替换所有现有的本地数据。
          </p>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='e.g., [{"code":"007345","shares":1000,"cost":1.7,"realizedProfit":0,"tag":"科技"}]'
            className="w-full h-48 p-2 font-mono text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500"
            disabled={isImporting}
          />
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end items-center px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg space-x-2">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 border border-gray-300 dark:border-gray-500 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={isImporting}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            type="button"
            disabled={isImporting}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 dark:disabled:bg-primary-800 disabled:cursor-not-allowed"
          >
            {isImporting ? (
                 <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  正在导入...
                </>
            ) : "保存并替换"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
