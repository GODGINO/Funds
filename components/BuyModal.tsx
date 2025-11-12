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


const BuyModal: React.FC<BuyModalProps> = ({ isOpen, onClose, onSubmit, onDelete, onUpdateTask, onCancelTask, tradeState }) => {
    const [amount, setAmount] = useState('');
    const { fund, date, nav, isConfirmed, editingRecord, editingTask } = tradeState;
    const isEditingRecord = !!editingRecord;
    const isEditingTask = !!editingTask;

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
        cost,
        costChangeAmount,
        costChangePercent,
        estimatedShares,
        percentileColor,
        newMarketValue,
        marketValueChangePercent,
        dailyLabel,
    } = useMemo(() => {
        const pos = fund.userPosition;
        const totalShares = pos?.shares || 0;
        const marketValue = fund.marketValue || 0;
        const holdingProfit = fund.holdingProfit || 0;
        const cost = pos?.cost || 0;

        // Daily
        const latestDateInChart = fund.baseChartData.length > 0 ? fund.baseChartData[fund.baseChartData.length - 1]?.date?.split(' ')[0] : null;
        const isLatestAvailableDate = date === latestDateInChart;
        const dailyLabel = isLatestAvailableDate ? '今日收益/率' : '当日收益/率';

        const dataPointIndex = fund.baseChartData.findIndex(p => p.date && p.date.startsWith(date));
        const currentDataPoint = fund.baseChartData[dataPointIndex];
        const yesterdayNAV = dataPointIndex > 0 ? fund.baseChartData[dataPointIndex - 1]?.unitNAV ?? 0 : 0;
        
        const dailyProfit = yesterdayNAV > 0 ? (nav - yesterdayNAV) * totalShares : 0;
        
        let dailyProfitRate = 0;
        const yesterdayMarketValue = yesterdayNAV * totalShares;
        if (yesterdayMarketValue > 0) {
            dailyProfitRate = (dailyProfit / yesterdayMarketValue) * 100;
        } else if (yesterdayNAV > 0) {
            dailyProfitRate = ((nav - yesterdayNAV) / yesterdayNAV) * 100;
        } else if (currentDataPoint?.dailyGrowthRate) {
            dailyProfitRate = parseFloat(currentDataPoint.dailyGrowthRate) || 0;
        }

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

        // Buy dynamics
        const buyAmount = parseFloat(amount) || 0;
        const estimatedShares = nav > 0 ? buyAmount / nav : 0;
        
        const newMarketValue = marketValue + buyAmount;
        const marketValueChangePercent = marketValue > 0 ? (buyAmount / marketValue) * 100 : 0;

        const newTotalShares = totalShares + estimatedShares;
        const newTotalCost = (totalShares * cost) + buyAmount;
        const newAverageCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;
        
        const costChangeAmount = newAverageCost - cost;
        const costChangePercent = cost > 0 ? (costChangeAmount / cost) * 100 : 0;

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
            cost,
            costChangeAmount,
            costChangePercent,
            estimatedShares,
            percentileColor,
            newMarketValue,
            marketValueChangePercent,
            dailyLabel,
        };
    }, [fund, amount, nav, date]);


    useEffect(() => {
        if (isOpen) {
            if (isEditingRecord) {
                setAmount(String(editingRecord.amount));
            } else if (isEditingTask) {
                setAmount(String(editingTask.value));
            } else {
                setAmount('500');
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

     const handleStep = (step: number) => {
        const currentValue = parseFloat(amount) || 0;
        const newValue = Math.max(0, currentValue + step);
        setAmount(String(newValue));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat((parseFloat(amount) || 0).toFixed(2));
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
                    <div className="h-[160px] mb-4">
                        <FundChart 
                            baseChartData={fund.baseChartData}
                            zigzagPoints={fund.zigzagPoints}
                            shares={fund.userPosition?.shares ?? 0}
                            lastPivotDate={fund.lastPivotDate}
                            costPrice={fund.userPosition?.cost}
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
                            <div className="text-sm text-gray-500 dark:text-gray-400">{dailyLabel}</div>
                            <div className={`text-xl font-semibold ${getProfitColor(dailyProfitRate)}`}>{dailyProfitRate >= 0 ? '+' : ''}{dailyProfitRate.toFixed(2)} %</div>
                            {totalShares > 0 && (
                                <div className={`text-sm ${getProfitColor(dailyProfit)}`}>{dailyProfit >= 0 ? '+' : ''}{dailyProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            )}
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
                             <div className={`text-sm ${getProfitColor(1)}`}>
                                {estimatedShares > 0 ? `+${estimatedShares.toFixed(2)}` : <>&nbsp;</>}
                            </div>
                        </div>
                        {/* 估算总值 */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">估算总值</div>
                            <div className="text-xl font-semibold text-gray-900 dark:text-white">
                                {marketValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </div>
                             <div className={`text-sm ${getProfitColor(1)}`}>
                                {parseFloat(amount) > 0
                                    ? `→${newMarketValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (+${marketValueChangePercent.toFixed(2)}%)`
                                    : <>&nbsp;</>
                                }
                            </div>
                        </div>
                        
                         {/* 买入金额 */}
                        <div>
                            <label htmlFor="buy-amount" className="block text-sm text-gray-700 dark:text-gray-300">买入金额</label>
                            <div className="flex items-center mt-1 h-[42px]">
                                <button
                                    type="button"
                                    onClick={() => handleStep(-100)}
                                    disabled={!amount || parseFloat(amount) <= 0}
                                    className="px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 h-full border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none disabled:opacity-50"
                                    aria-label="减少100元"
                                >
                                    <span className="text-xl font-bold">-</span>
                                </button>
                                <input
                                    type="number"
                                    id="buy-amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="500"
                                    required
                                    autoFocus
                                    className="w-full text-center h-full px-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleStep(100)}
                                    className="px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 h-full border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md focus:outline-none"
                                    aria-label="增加100元"
                                >
                                    <span className="text-xl font-bold">+</span>
                                </button>
                            </div>
                        </div>

                        {/* 成本 */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">成本</div>
                            <div className="text-xl font-semibold text-gray-900 dark:text-white">{cost.toFixed(4)}</div>
                            <div className={`text-sm ${getProfitColor(costChangeAmount)}`}>
                                {costChangeAmount !== 0 && !isNaN(costChangeAmount)
                                    ? `${costChangeAmount > 0 ? '+' : ''}${costChangeAmount.toFixed(4)} (${costChangePercent > 0 ? '+' : ''}${costChangePercent.toFixed(2)}%)`
                                    : <>&nbsp;</>
                                }
                            </div>
                        </div>

                        {/* 买入按钮 */}
                        <div>
                           <button type="submit" className="flex items-center justify-center w-full h-[42px] bg-red-500 text-white font-semibold px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900 disabled:bg-gray-300 disabled:text-gray-500"
                            disabled={!amount || parseFloat(amount) <= 0}
                           >
                               {isEditingRecord ? '更新交易' : isEditingTask ? '更新任务' : '买入'}
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

export default BuyModal;