import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserPosition, TradingRecord, Fund } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonString: string) => Promise<void>;
  currentData: string;
  funds: Fund[];
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, currentData, funds }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [shouldSaveAfterUpload, setShouldSaveAfterUpload] = useState(false);
  const [isCopiedNewFormat, setIsCopiedNewFormat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens, using the latest currentData
      setJsonInput(currentData);
      setError(null);
      setIsImporting(false);
      setShouldSaveAfterUpload(false);
      setIsCopiedNewFormat(false);
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
    if (shouldSaveAfterUpload && jsonInput) {
      handleSave();
      setShouldSaveAfterUpload(false); // Reset trigger
    }
  }, [shouldSaveAfterUpload, jsonInput, handleSave]);


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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const text = e.target?.result as string;
              if (!text) {
                  throw new Error("文件为空。");
              }
              const data = JSON.parse(text);

              let positionsArray: any[];

              if (Array.isArray(data)) {
                  // Case 1: The file is a direct array of positions (new format)
                  positionsArray = data;
              } else if (data && typeof data === 'object' && Array.isArray(data.subscriptions)) {
                  // Case 2: The file is an object with a 'subscriptions' key (old format)
                  positionsArray = data.subscriptions;
              } else {
                  throw new Error("无效的 JSON 结构。文件应为持仓数组，或包含 'subscriptions' 键的对象。");
              }

              // Basic validation and transformation
              const positions: UserPosition[] = positionsArray.map((sub: any) => {
                  if (typeof sub.code === 'undefined' || typeof sub.shares === 'undefined' || typeof sub.cost === 'undefined' || typeof sub.realizedProfit === 'undefined') {
                      throw new Error(`数组中的某个项目缺少必需字段 (code, shares, cost, realizedProfit)。`);
                  }
                  
                  const newPosition: UserPosition = {
                      code: String(sub.code).padStart(6, '0'),
                      shares: Number(sub.shares),
                      cost: Number(sub.cost),
                      tag: sub.tag || '',
                      realizedProfit: Number(sub.realizedProfit),
                  };

                  if (sub.tradingRecords && Array.isArray(sub.tradingRecords)) {
                      const validatedRecords: TradingRecord[] = sub.tradingRecords.map((record: any) => {
                          const newRecord: TradingRecord = {
                              date: record.date,
                              type: record.type,
                          };
                          // Permissively copy fields that exist, letting main app validation handle correctness.
                          if (record.value !== undefined) newRecord.value = Number(record.value);
                          if (record.nav !== undefined) newRecord.nav = Number(record.nav);
                          if (record.sharesChange !== undefined) newRecord.sharesChange = Number(record.sharesChange);
                          if (record.amount !== undefined) newRecord.amount = Number(record.amount);
                          if (record.realizedProfitChange !== undefined) newRecord.realizedProfitChange = Number(record.realizedProfitChange);
                          
                          return newRecord;
                      });
                      newPosition.tradingRecords = validatedRecords;
                  }
                  
                  return newPosition;
              });
              
              setJsonInput(JSON.stringify(positions, null, 2));
              setError(null);
              setShouldSaveAfterUpload(true);

          } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "文件处理期间发生未知错误。";
              setError(`读取文件失败: ${errorMessage}`);
              setJsonInput(''); // Clear input on error
              setShouldSaveAfterUpload(false);
          } finally {
              // Reset file input to allow re-uploading the same file
              if (event.target) {
                  event.target.value = '';
              }
          }
      };
      reader.readAsText(file);
  };

  const triggerFileSelect = () => {
      fileInputRef.current?.click();
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent adding a new line
      if (!isImporting && jsonInput) {
        handleSave();
      }
    }
  };

  const handleExport = () => {
    const dataToExport = currentData;
    if (!dataToExport) return;

    const blob = new Blob([dataToExport], { type: 'application/json' });
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg m-4 transform transition-all flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">导入/导出缓存数据</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            文本框内已显示您当前的持仓数据，可用于备份或微调。您也可以粘贴新的 JSON 字符串，或上传一个 JSON 文件。这将替换所有现有的本地数据。
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <textarea
            ref={textareaRef}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder='e.g., [{"code":"007345","shares":1000,"cost":1.7,"realizedProfit":0,"tag":"科技"}]'
            className="w-full h-48 p-2 font-mono text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary-500 focus:border-primary-500"
            disabled={isImporting}
          />
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg flex-wrap gap-2">
           <div className="flex items-center gap-2 flex-wrap">
            <button
                onClick={triggerFileSelect}
                type="button"
                className="px-3 py-2 border border-gray-300 dark:border-gray-500 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={isImporting}
            >
                上传文件
            </button>
            <button
                onClick={handleExport}
                type="button"
                className="px-3 py-2 border border-gray-300 dark:border-gray-500 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={isImporting || !jsonInput}
            >
                导出文件
            </button>
            <button
                onClick={handleCopyNewFormat}
                type="button"
                className="px-3 py-2 border border-gray-300 dark:border-gray-500 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={isImporting || !funds.length}
                title="复制外部系统兼容的 JSON 格式 (包含名称、份额、成本)"
            >
                {isCopiedNewFormat ? '复制成功' : '复制json'}
            </button>
           </div>
          <div className="flex items-center space-x-2">
            <button
                onClick={handleSave}
                type="button"
                disabled={isImporting || !jsonInput}
                className="w-28 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 dark:disabled:bg-primary-800 disabled:cursor-not-allowed"
            >
                {isImporting ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : "保存并替换"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;