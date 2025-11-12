import React, { useState, useMemo, useEffect } from 'react';
import { TradeModalState } from '../types';
import FundChart from './FundChart';

interface SellModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (fund: TradeModalState['fund'], date: string, type: 'buy' | 'sell', value: number, isConfirmed: boolean, nav: number, isEditing: boolean) => void;
    onDelete: (fundCode: string, recordDate: string) => void;
    onUpdateTask: (taskId: string, newValue: number) => void;
    onCancelTask: (taskId: string) => void;
    tradeState: TradeModalState;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const SellModal: React.FC<SellModalProps> = ({ isOpen, onClose, onSubmit, onDelete, onUpdateTask, onCancelTask, tradeState }) => {
    const [shares, setShares] = useState('');
    const [error, setError] = useState('');

    const { fund, date, nav, isConfirmed, editingRecord, editingTask } = tradeState;
    const isEditingRecord = !!editingRecord;
    const isEditingTask = !!editingTask;
    const position = fund.userPosition;

    const availableShares = useMemo(() => {
        if (!position) return 0;
        // If editing a CONFIRMED record, add back the shares from that record to calculate the pool available before that trade.
        if (isEditingRecord) {
            return position.shares - editingRecord.sharesChange;
        }
        // If creating a NEW trade or editing a PENDING task, the available shares are simply what's currently held.
        return position.shares;
    }, [position, isEditingRecord, editingRecord]);


    const estimatedProfit = useMemo(() => {
        const numericShares = parseFloat(shares);
        if (!numericShares || isNaN(numericShares) || nav <= 0 || !position || position.cost <= 0) {
            return 0;
        }
        return (nav - position.cost) * numericShares;
    }, [shares, nav, position]);

    const {
        dailyProfit,
        dailyProfitRate,
        recentProfit,
        recentProfitRate,
        holdingProfit,
        holdingProfitRate,
        navPercentile,
        totalShares,
        marketValue,
        sellPercentage,
        sellAmount,
        percentileColor,
    } = useMemo(() => {
        const pos = fund.userPosition;

        const totalShares = pos?.shares || 0;
        const marketValue = fund.marketValue || 0;
        const holdingProfit = fund.holdingProfit || 0;

        // Daily
        const yesterdayNAV = fund.baseChartData.length > 1 ? fund.baseChartData[fund.baseChartData.length - 2]?.unitNAV ?? 0 : 0;
        const dailyProfit = yesterdayNAV > 0 ? (nav - yesterdayNAV) * totalShares : 0;
        const yesterdayMarketValue = yesterdayNAV * totalShares;
        const dailyProfitRate = yesterdayMarketValue > 0 ? (dailyProfit / yesterdayMarketValue) * 100 : 0;

        // Recent
        const recentProfit = fund.recentProfit || 0;
        const recentProfitRate = fund.trendInfo?.change || 0;

        // Holding
        const costBasis = fund.costBasis || 0;
        const holdingProfitRate = costBasis > 0 ? (holdingProfit / costBasis) * 100 : 0;

        // Percentile
        const navPercentile = fund.navPercentile ?? null;
        let percentileColor = 'text-gray-500 dark:text-gray-400';
        if (navPercentile !== null) {
            if (navPercentile <= 20) percentileColor = 'text-green-600 dark:text-green-500';
            else if (navPercentile >= 80) percentileColor = 'text-red-500 dark:text-red-500';
            else percentileColor = 'text-yellow-600 dark:text-yellow-400';
        }

        // Sell dynamics
        const numericSellShares = parseFloat(shares) || 0;
        const sellPercentage = totalShares > 0 ? (numericSellShares / totalShares) * 100 : 0;
        const sellAmount = numericSellShares * nav;

        return {
            dailyProfit,
            dailyProfitRate,
            recentProfit,
            recentProfitRate,
            holdingProfit,
            holdingProfitRate,
            navPercentile,
            totalShares,
            marketValue,
            sellPercentage,
            sellAmount,
            percentileColor,
        };
    }, [fund, shares, nav]);


    useEffect(() => {
        if (isOpen) {
            if (isEditingRecord) {
                setShares(String(Math.abs(editingRecord.sharesChange)));
            } else if (isEditingTask) {
                setShares(String(editingTask.value));
            } else {
                // Default to ~500 CNY worth of shares, rounded to the nearest hundred.
                if (nav > 0 && availableShares > 0) {
                    const defaultAmountInCny = 500;
                    const calculatedShares = defaultAmountInCny / nav;

                    let roundedShares = Math.round(calculatedShares / 100) * 100;
                    
                    // If rounding results in 0, but the calculated value is positive (i.e., < 50),
                    // a default of 0 is not helpful. We'll set a minimum of 100.
                    if (roundedShares === 0 && calculatedShares > 0) {
                        roundedShares = 100;
                    }

                    // The default value cannot exceed what's available.
                    const finalShares = Math.min(roundedShares, availableShares);

                    // Since the logic is about rounding to whole hundreds, we'll output an integer.
                    // Using Math.floor to be safe with fractional available shares.
                    setShares(finalShares > 0 ? String(Math.floor(finalShares)) : '');
                } else {
                    setShares('');
                }
            }
            setError('');
        }
    }, [isOpen, isEditingRecord, editingRecord, isEditingTask, editingTask, nav, availableShares]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSharesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setShares(value);
        const numericValue = parseFloat(value);
        if (numericValue > availableShares) {
            setError(`超过可用份额: ${availableShares.toFixed(2)}`);
        } else {
            setError('');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericShares = parseFloat(shares);
        if (!numericShares || numericShares <= 0 || error) return;
        
        if (isEditingTask) {
            onUpdateTask(editingTask.id, numericShares);
        } else {
            onSubmit(fund, date, 'sell', numericShares, isConfirmed, nav, isEditingRecord);
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
                        {isEditingRecord ? '修改卖出记录' : isEditingTask ? '修改卖出任务' : '卖出'} {fund.name}
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

                    <div className="grid grid-cols-3 gap-y-4 gap-x-2 text-left items-end">
                        {/* 今日收益/率 */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">今日收益/率</div>
                            <div className={`text-xl font-semibold ${getProfitColor(dailyProfitRate)}`}>{dailyProfitRate >= 0 ? '+' : ''}{dailyProfitRate.toFixed(2)} %</div>
                            <div className={`text-sm ${getProfitColor(dailyProfit)}`}>{dailyProfit >= 0 ? '+' : ''}{dailyProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        </div>
                        {/* 近期收益/率 */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">近期收益/率</div>
                            <div className={`text-xl font-semibold ${getProfitColor(recentProfitRate)}`}>{recentProfitRate >= 0 ? '+' : ''}{recentProfitRate.toFixed(2)} %</div>
                            <div className={`text-sm ${getProfitColor(recentProfit)}`}>{recentProfit >= 0 ? '+' : ''}{recentProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        </div>
                        {/* 持有收益/率 */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">持有收益/率</div>
                            <div className={`text-xl font-semibold ${getProfitColor(holdingProfitRate)}`}>{holdingProfitRate >= 0 ? '+' : ''}{holdingProfitRate.toFixed(2)} %</div>
                            <div className={`text-sm ${getProfitColor(holdingProfit)}`}>{holdingProfit >= 0 ? '+' : ''}{holdingProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        </div>
                        {/* 分位点 */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">分位点</div>
                            <div className={`text-xl font-semibold ${percentileColor}`}>{navPercentile ? `${navPercentile.toFixed(0)}%` : '-'}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">&nbsp;</div> {/* Placeholder for alignment */}
                        </div>
                        {/* 份额 */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">份额</div>
                            <div className="text-xl font-semibold text-gray-900 dark:text-white">{totalShares.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            <div className={`text-sm ${getProfitColor(-1)}`}>
                                {sellPercentage > 0 ? `-${sellPercentage.toFixed(2)}%` : <>&nbsp;</>}
                            </div>
                        </div>
                        {/* 估算总值 */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">估算总值</div>
                            <div className="text-xl font-semibold text-gray-900 dark:text-white">{marketValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {sellAmount > 0 ? `-${sellAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : <>&nbsp;</>}
                            </div>
                        </div>
                        {/* 卖出份额 */}
                        <div>
                            <label htmlFor="sell-shares" className="block text-sm text-gray-700 dark:text-gray-300">卖出份额</label>
                            <input
                                type="number"
                                id="sell-shares"
                                value={shares}
                                onChange={handleSharesChange}
                                placeholder={`可用 ${availableShares.toFixed(2)}`}
                                required
                                autoFocus
                                max={availableShares}
                                className={`block w-full px-3 bg-white dark:bg-gray-700 border rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none sm:text-sm h-[42px] ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500'}`}
                            />
                            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                        </div>
                        
                        {/* 落袋收益 */}
                        <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300">落袋收益:</label>
                            <div className="h-[42px] flex items-center">
                                <span className={`text-lg font-semibold ${getProfitColor(estimatedProfit)}`}>
                                    {estimatedProfit.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* 卖出按钮 */}
                        <div>
                           <button type="submit" className="flex items-center justify-center w-full h-[42px] bg-sky-400 text-white font-semibold px-4 rounded-md hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400 dark:focus:ring-offset-gray-900 disabled:bg-gray-300 disabled:text-gray-500"
                            disabled={!shares || parseFloat(shares) <= 0 || !!error}
                           >
                               {isEditingRecord ? '更新交易' : isEditingTask ? '更新任务' : '卖出'}
                           </button>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                {(isEditingRecord || isEditingTask) && (
                    <div className="flex justify-start items-center px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 flex-shrink-0">
                       <button 
                            type="button" 
                            onClick={handleDeleteOrCancel}
                            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            {isEditingRecord ? '删除交易' : '取消任务'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default SellModal;