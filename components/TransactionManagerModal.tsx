
import React, { useEffect } from 'react';
import { TradingTask } from '../types';

interface TransactionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TradingTask[];
  onCancelTask: (taskId: string) => void;
}

const TransactionManagerModal: React.FC<TransactionManagerModalProps> = ({ isOpen, onClose, tasks, onCancelTask }) => {
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

  const pendingTasks = tasks.filter(task => task.status === 'pending');

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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 transform transition-all flex flex-col max-h-[80vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">交易任务管理</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {pendingTasks.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="p-2 border-b dark:border-gray-600">状态</th>
                    <th className="p-2 border-b dark:border-gray-600">类型</th>
                    <th className="p-2 border-b dark:border-gray-600">基金名称</th>
                    <th className="p-2 border-b dark:border-gray-600">交易日期</th>
                    <th className="p-2 border-b dark:border-gray-600 text-right">金额/份额</th>
                    <th className="p-2 border-b dark:border-gray-600 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTasks.map(task => (
                    <tr key={task.id} className="border-b dark:border-gray-700">
                      <td className="p-2">
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100">
                          待处理
                        </span>
                      </td>
                      <td className={`p-2 font-semibold ${task.type === 'buy' ? 'text-red-500' : 'text-green-600'}`}>
                        {task.type === 'buy' ? '买入' : '卖出'}
                      </td>
                      <td className="p-2 text-gray-800 dark:text-gray-200">{task.name}</td>
                      <td className="p-2">{task.date}</td>
                      <td className="p-2 text-right font-mono">
                        {task.value.toLocaleString()} {task.type === 'buy' ? '元' : '份'}
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => onCancelTask(task.id)}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                        >
                          取消
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">没有待处理的交易任务。</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg text-right">
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
