import React, { useState, useMemo, useEffect } from 'react';
import { TradeModalState } from '../types';
import FundChart from './FundChart';

interface BuyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (fund: TradeModalState['fund'], date: string, type: 'buy' | 'sell', value: number, isConfirmed: boolean, nav: number, isEditing: boolean) => void;
    onDelete: (fundCode: string, recordDate: string) => void;
    onUpdateTask: (taskId: string, newValue: number) => void;
    onCancelTask: (taskId: string) => void;
    tradeState: TradeModalState;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const StatDisplay: React.FC<{ label: string; value: string; colorClass?: string; }> = ({ label, value, colorClass }) => (
    <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className={`text-lg font-semibold ${colorClass || 'text-gray-900 dark:text-white'}`}>{value}</div>
    </div>
);


const BuyModal: React.FC<BuyModalProps> = ({ isOpen, onClose, onSubmit, onDelete, onUpdateTask, onCancelTask, tradeState }) => {
    const [amount, setAmount] = useState('');
    const { fund, date, nav, isConfirmed, editingRecord, editingTask } = tradeState;
    const isEditingRecord = !!editingRecord;
    const isEditingTask = !!editingTask;
    const position = fund.userPosition;

    const estimatedShares = useMemo(() => {
        const numericAmount = parseFloat(amount);
        if (!numericAmount || isNaN(numericAmount) || nav <= 0) {
            return 0;
        }
        return numericAmount / nav;
    }, [amount, nav]);

    useEffect(() => {
        if (isOpen) {
            if (isEditingRecord) {
                setAmount(String(editingRecord.amount));
            } else if (isEditingTask) {
                setAmount(String(editingTask.value));
            } else {
                setAmount('');
            }
        }
    }, [isOpen, isEditingRecord, editingRecord, isEditingTask, editingTask]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (!numericAmount || numericAmount <= 0) return;

        if (isEditingTask) {
            onUpdateTask(editingTask.id, numericAmount);
        } else {
            onSubmit(fund, date, 'buy', numericAmount, isConfirmed, nav, isEditingRecord);
        }
    };

    const handleDeleteOrCancel = () => {
        if (isEditingTask) {
            onCancelTask(editingTask.id);
        } else if (isEditingRecord) {
            onDelete(fund.code, date);
        }
    };

    if (!isOpen) return null;
    
    return (
        <div 
            className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center transition-opacity" 
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            aria-modal="true"
            role="dialog"
        >
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-xl m-4 transform transition-all max-h-[90vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {isEditingRecord ? '修改买入记录' : isEditingTask ? '修改买入任务' : '买入'} {fund.name}
                        <span className="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">{fund.code}</span>
                    </h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto">
                    <div className="h-[200px] mb-6">
                        <FundChart 
                            baseChartData={fund.baseChartData}
                            zigzagPoints={fund.zigzagPoints}
                            shares={position?.shares ?? 0}
                            lastPivotDate={fund.lastPivotDate}
                            costPrice={position?.cost}
                            actualCostPrice={fund.actualCost}
                            navPercentile={fund.navPercentile}
                            tradingRecords={fund.userPosition?.tradingRecords}
                        />
                    </div>
                    
                    <div className="mb-4">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">交易日期:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">{date}</span>
                        {!isEditingRecord && (
                             <span className={`ml-3 text-xs font-bold ${isConfirmed ? 'text-green-600' : 'text-yellow-600'}`}>
                                ({isConfirmed ? `收盘净值: ${nav.toFixed(4)}` : '任务待确认'})
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <StatDisplay label="成交净值" value={nav.toFixed(4)} />
                        <StatDisplay label="当前份额" value={(position?.shares || 0).toLocaleString()} />
                        <StatDisplay label="当前成本" value={(position?.cost || 0).toFixed(4)} />
                        <StatDisplay 
                            label="当前持有收益" 
                            value={`${(fund.holdingProfit || 0).toFixed(2)} 元`}
                            colorClass={getProfitColor(fund.holdingProfit || 0)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                            <label htmlFor="buy-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">买入金额 (元)</label>
                            <input
                                type="number"
                                id="buy-amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="500"
                                required
                                autoFocus
                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            />
                        </div>
                        <div className="text-center md:text-left pb-1">
                             <div className="text-sm text-gray-500 dark:text-gray-400">
                                {isConfirmed ? '成交份额:' : '预计可得份额 ≈'}
                            </div>
                            <div className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                                {estimatedShares > 0 ? estimatedShares.toFixed(2) : '0.00'} 份
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-between items-center px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 flex-shrink-0">
                   {(isEditingRecord || isEditingTask) ? (
                        <button 
                            type="button" 
                            onClick={handleDeleteOrCancel}
                            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            {isEditingRecord ? '删除交易' : '取消任务'}
                        </button>
                   ) : <div></div>}
                   <button type="submit" className="bg-primary-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900 disabled:bg-primary-300"
                    disabled={!amount || parseFloat(amount) <= 0}
                   >
                       {isEditingRecord ? '更新交易' : isEditingTask ? '更新任务' : '买入'}
                   </button>
                </div>
            </form>
        </div>
    );
};

export default BuyModal;