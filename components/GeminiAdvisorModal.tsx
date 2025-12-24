
import React, { useEffect, useMemo } from 'react';
import { GeminiAdviceResponse } from '../types';

interface GeminiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  analysisResult: GeminiAdviceResponse | null;
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
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sentimentColor = useMemo(() => {
    if (!analysisResult) return 'text-gray-400';
    const score = analysisResult.sentimentScore ?? 50;
    if (score >= 70) return 'text-red-500';
    if (score <= 30) return 'text-green-500';
    return 'text-yellow-500';
  }, [analysisResult]);

  if (!isOpen) return null;

  // 使用本地变量保存数组并提供默认值，防止渲染崩溃
  const pyramidSignals = analysisResult?.pyramidSignals || [];
  const fundActions = analysisResult?.fundActions || [];
  const riskWarnings = analysisResult?.riskWarnings || [];

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center transition-opacity"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Gemini 智能投顾 v2.0</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-6">
              <div className="relative w-16 h-16">
                 <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-100 rounded-full animate-pulse"></div>
                 <div className="absolute top-0 left-0 w-full h-full border-t-4 border-indigo-600 rounded-full animate-spin"></div>
              </div>
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 font-medium text-lg">正在进行全维数据透视...</p>
                <p className="text-gray-400 text-sm mt-1">分析目标: 4.5% 金字塔加仓策略最优解</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 text-2xl font-bold mb-4">!</div>
              <p className="text-gray-800 dark:text-gray-200 font-semibold text-lg">{error}</p>
              <button onClick={onGenerate} className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-md transition-all">重试分析</button>
            </div>
          ) : analysisResult ? (
            <div className="space-y-6 pb-4">
              {/* 1. Market Header Card */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3 bg-indigo-50 dark:bg-gray-800/50 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                      <h4 className="text-indigo-800 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">市场与策略概览</h4>
                      <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{analysisResult.marketOverview}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center text-center">
                      <h4 className="text-gray-500 dark:text-gray-400 text-xs font-bold mb-2">市场情绪</h4>
                      <div className={`text-4xl font-black ${sentimentColor}`}>{analysisResult.sentimentScore ?? 0}</div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
                          <div className={`h-full ${sentimentColor.replace('text-', 'bg-')} transition-all duration-1000`} style={{ width: `${analysisResult.sentimentScore ?? 0}%` }}></div>
                      </div>
                  </div>
              </div>

              {/* 2. Pyramid Signals Section */}
              <section>
                  <div className="flex items-center gap-2 mb-3">
                      <span className="text-red-500">🚨</span>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white">金字塔策略信号</h4>
                  </div>
                  {pyramidSignals.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {pyramidSignals.map((sig, i) => (
                              <div key={i} className="bg-white dark:bg-gray-800 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="font-bold text-gray-900 dark:text-white">{sig.name}</div>
                                      <span className="bg-red-100 text-red-700 text-[10px] font-black px-1.5 py-0.5 rounded">{sig.level}</span>
                                  </div>
                                  <div className="text-2xl font-mono font-bold text-red-600 mb-2">+{sig.amount} <span className="text-xs font-normal text-gray-400">CNY</span></div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{sig.reason}</p>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="bg-gray-50 dark:bg-gray-800/30 p-8 rounded-xl text-center text-gray-500 border border-dashed border-gray-200 dark:border-gray-700">
                          当前无触发金字塔加仓规则的基金。
                      </div>
                  )}
              </section>

              {/* 3. Action List */}
              <section>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3">组合优化建议</h4>
                  <div className="space-y-3">
                      {fundActions.map((item, i) => (
                          <div key={i} className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 group hover:border-indigo-300 transition-colors">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                                  item.action === '买入' ? 'bg-red-50 text-red-600' : 
                                  item.action === '卖出' ? 'bg-blue-50 text-blue-600' :
                                  item.action === '调仓' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-600'
                              }`}>
                                  {item.action}
                              </div>
                              <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className="font-bold text-gray-800 dark:text-gray-200">{item.name}</span>
                                      <span className={`text-[10px] px-1 rounded font-medium ${
                                          item.priority === '高' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                                      }`}>优先级:{item.priority}</span>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.advice}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </section>

              {/* 4. Risk Warnings */}
              <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <h4 className="font-bold">风险雷达</h4>
                  </div>
                  <ul className="space-y-1.5">
                      {riskWarnings.map((warn, i) => (
                          <li key={i} className="text-sm text-amber-700 dark:text-amber-500/80 flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 flex-shrink-0"></span>
                              {warn}
                          </li>
                      ))}
                  </ul>
              </section>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 rounded-b-lg flex justify-between items-center shadow-inner">
          <div className="text-[10px] text-gray-400 leading-relaxed max-w-md">
            AI 生成内容仅供参考。投资有风险，入市需谨慎。建议结合市场情况与个人风险承受能力进行决策。
          </div>
          {!isLoading && (
             <button 
                onClick={onGenerate}
                className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-all font-bold text-sm"
             >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
               </svg>
               重新扫描
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeminiAdvisorModal;
