
import React, { useEffect } from 'react';

interface GeminiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  analysisResult: string | null;
  error: string | null;
  onGenerate: () => void;
}

const GeminiAdvisorModal: React.FC<GeminiAdvisorModalProps> = ({ 
  isOpen, 
  onClose, 
  isLoading, 
  analysisResult, 
  error,
  onGenerate 
}) => {
  
  useEffect(() => {
    if (isOpen && !analysisResult && !isLoading) {
      onGenerate();
    }
  }, [isOpen, analysisResult, isLoading, onGenerate]);

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

  if (!isOpen) return null;

  // Simple formatter to make markdown slightly nicer without a library
  const formatText = (text: string) => {
    return text.split('\n').map((line, index) => {
      if (line.startsWith('## ')) {
        return <h3 key={index} className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-white">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={index} className="text-md font-bold mt-3 mb-1 text-gray-800 dark:text-gray-200">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
         return <p key={index} className="font-bold my-1 text-gray-800 dark:text-gray-200">{line.replace(/\*\*/g, '')}</p>
      }
      if (line.trim().startsWith('- ')) {
        return <li key={index} className="ml-4 list-disc text-gray-700 dark:text-gray-300">{line.replace('- ', '')}</li>
      }
      return <p key={index} className="my-1 text-gray-700 dark:text-gray-300 min-h-[1em]">{line}</p>;
    });
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center transition-opacity"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl m-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 rounded-t-lg">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gemini 智能投顾</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="relative w-12 h-12">
                 <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-200 rounded-full animate-pulse"></div>
                 <div className="absolute top-0 left-0 w-full h-full border-t-4 border-purple-600 rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 animate-pulse">正在分析持仓数据与市场趋势...</p>
              <p className="text-xs text-gray-400">分析目标: 最大化操作收益与造成盈亏</p>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <div className="text-red-500 text-5xl mb-4">!</div>
              <p className="text-gray-800 dark:text-gray-200 font-medium">{error}</p>
              <button 
                onClick={onGenerate}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
              >
                重试
              </button>
            </div>
          ) : analysisResult ? (
            <div className="prose dark:prose-invert max-w-none">
              {formatText(analysisResult)}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700 rounded-b-lg flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <span>由此分析仅供参考，不构成投资建议。历史业绩不代表未来表现。</span>
          {!isLoading && (
             <button 
                onClick={onGenerate}
                className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium"
             >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
               </svg>
               重新分析
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeminiAdvisorModal;
