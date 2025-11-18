import React, { useMemo, useEffect } from 'react';
import { ProcessedFund, TradingRecord } from '../types';

interface TransactionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  funds: ProcessedFund[];
  onEdit: (fund: ProcessedFund, record: TradingRecord) => void;
  onDelete: (fundCode: string, recordDate: string) => void;
}

const TransactionManagerModal: React.FC<TransactionManagerModalProps> = ({ isOpen, onClose, funds, onEdit, onDelete }) => {
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

  const pendingRecords = useMemo(() => {
    if (!funds) return [];
    const records: { fund: ProcessedFund, record: TradingRecord }[] = [];
    funds.forEach(fund => {
      if (fund.userPosition?.tradingRecords) {
        fund.userPosition.tradingRecords.forEach(record => {
          if (record.nav === undefined) { // This identifies a pending record
            records.push({ fund, record });
          }
        });
      }
    });
    return records.sort((a, b) => new Date(a.record.date).getTime() - new Date(b.record.date).getTime());
  }, [funds]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center transition-opacity"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 transform transition-all flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">待处理交易管理</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {pendingRecords.length > 0 ? (
            <div className="border rounded-md dark:border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="p-2">基金名称</th>
                    <th className="p-2">日期</th>
                    <th className="p-2">类型</th>
                    <th className="p-2 text-right">金额/份额</th>
                    <th className="p-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRecords.map(({ fund, record }) => (
                    <tr key={`${fund.code}-${record.date}`} className="border-t dark:border-gray-700">
                      <td className="p-2 font-medium">{fund.name} <span className="text-gray-500">{fund.code}</span></td>
                      <td className="p-2 font-mono">{record.date}</td>
                      <td className={`p-2 font-semibold ${record.type === 'buy' ? 'text-red-500' : 'text-blue-500'}`}>
                        {record.type === 'buy' ? '买入' : '卖出'}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {record.value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center space-x-2">
                        <button
                          onClick={() => onEdit(fund, record)}
                          className="font-medium text-primary-600 hover:text-primary-500"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => onDelete(fund.code, record.date)}
                          className="font-medium text-red-600 hover:text-red-500"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400">没有待处理的交易。</p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end items-center px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 border border-gray-300 dark:border-gray-500 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionManagerModal;
