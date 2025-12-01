
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TradeModalState, TransactionType } from '../types';
import FundChart from './FundChart';

interface BuyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (fund: TradeModalState['fund'], date: string, type: TransactionType, value: number, isConfirmed: boolean, nav: number, isEditing: boolean) => void;
    onDelete: (fundCode: string, recordDate: string) => void;
    tradeState: TradeModalState;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const BuyModal: React.FC<BuyModalProps> = ({ isOpen, onClose, onSubmit, onDelete, tradeState }) => {
    const { fund, date, nav, isConfirmed, editingRecord } = tradeState;
    const isEditing = !!editingRecord;
    const isPending = isEditing && editingRecord.nav === undefined;

    // Determine initial tab based on editing record type, default to 'buy'
    const [activeTab, setActiveTab] = useState<TransactionType>(() => {
        if (editingRecord) {
            if (editingRecord.type === 'dividend-cash') return 'dividend-cash';
            if (editingRecord.type === 'dividend-reinvest') return 'dividend-reinvest';
        }
        return 'buy';
    });

    const [amount, setAmount] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const amountInputRef = useRef<HTMLInputElement>(null);

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
        realizedProfit,
        
        // Dynamic Preview Values
        newTotalShares,
        newMarketValue,
        marketValueChangePercent,
        sharesChangeAmount,
        
        newCost,
        costChangeAmount,
        costChangePercent,
        
        newRealizedProfit,
        realizedProfitChangeAmount,

        percentileColor,
        dailyLabel,
        inputLabel,
        submitLabel,
        stepValue
    } = useMemo(() => {
        const pos = fund.userPosition;
        const totalShares = pos?.shares || 0;
        const marketValue = fund.marketValue || 0;
        const holdingProfit = fund.holdingProfit || 0;
        const cost = pos?.cost || 0;
        const realizedProfit = pos?.realizedProfit || 0;

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

        // Dynamic Calculations based on Tab
        const inputValue = parseFloat(amount) || 0;
        
        let newTotalShares = totalShares;
        let newTotalCost = totalShares * cost;
        let newRealizedProfit = realizedProfit;
        
        let inputLabel = '买入金额';
        let submitLabel = '买入';
        let stepValue = 100;

        if (activeTab === 'buy') {
            const estimatedShares = nav > 0 ? inputValue / nav : 0;
            newTotalShares = totalShares + estimatedShares;
            newTotalCost = (totalShares * cost) + inputValue;
            inputLabel = '买入金额';
            submitLabel = '买入';
            stepValue = 100;
        } else if (activeTab === 'dividend-cash') {
            newRealizedProfit = realizedProfit + inputValue;
            // Shares and Cost Basis do not change for Cash Dividend
            inputLabel = '分红金额';
            submitLabel = '确认分红';
            stepValue = 10;
        } else if (activeTab === 'dividend-reinvest') {
            newTotalShares = totalShares + inputValue; // inputValue is shares
            // Total Cost Basis does not change (money stays in), but Unit Cost will decrease
            inputLabel = '获配份额';
            submitLabel = '确认再投';
            stepValue = 10;
        }

        const newCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;
        const newMarketValue = newTotalShares * nav; // Approximation using transaction NAV
        const marketValueChangePercent = marketValue > 0 ? ((newMarketValue - marketValue) / marketValue) * 100 : 0;
        
        const costChangeAmount = newCost - cost;
        const costChangePercent = cost > 0 ? (costChangeAmount / cost) * 100 : 0;
        
        const sharesChangeAmount = newTotalShares - totalShares;
        const realizedProfitChangeAmount = newRealizedProfit - realizedProfit;

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
            realizedProfit,
            
            newTotalShares,
            newMarketValue,
            marketValueChangePercent,
            sharesChangeAmount,
            
            newCost,
            costChangeAmount,
            costChangePercent,
            
            newRealizedProfit,
            realizedProfitChangeAmount,

            percentileColor,
            dailyLabel,
            inputLabel,
            submitLabel,
            stepValue
        };
    }, [fund, amount, nav, date, activeTab]);


    useEffect(() => {
        if (isOpen) {
            if (isEditing) {
                let initialValue: number | undefined;
                if (editingRecord.type === 'buy') initialValue = isPending ? editingRecord.value : editingRecord.amount;
                // For cash dividend, map realizedProfitChange to the input value
                else if (editingRecord.type === 'dividend-cash') initialValue = isPending ? editingRecord.value : editingRecord.realizedProfitChange;
                else if (editingRecord.type === 'dividend-reinvest') initialValue = isPending ? editingRecord.value : editingRecord.sharesChange;
                
                setAmount(String(initialValue ?? ''));
            } else {
                // Set default value for 'buy' tab only
                if (activeTab === 'buy') {
                    setAmount('500');
                } else {
                    setAmount('');
                }
            }
            setIsCopied(false);
            setTimeout(() => {
                amountInputRef.current?.select();
            }, 50); 
        }
    }, [isOpen, isEditing, isPending, editingRecord, activeTab]);
    
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
        setAmount(String(newValue.toFixed(2))); // Formatting for decimal steps
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat((parseFloat(amount) || 0).toFixed(2));
        if (!numericAmount || numericAmount <= 0) return;

        onSubmit(fund, date, activeTab, numericAmount, isConfirmed, nav, isEditing);
    };

    const handleDeleteOrCancel = () => {
        if (isEditing) {
            onDelete(fund.code, date);
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(fund.code).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 1000);
        }).catch(err => {
            console.error('Failed to copy fund code: ', err);
        });
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
                        {isEditing ? '修改记录' : '新增记录'} - {fund.name}
                        <span 
                            className={`ml-2 text-base font-normal transition-colors duration-200 hover:text-primary-500 ${isCopied ? 'text-green-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}
                            onClick={handleCopyCode}
                            title="点击复制基金代码"
                        >
                            {isCopied ? '复制成功' : fund.code}
                        </span>
                    </h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                {!isEditing && (
                    <div className="flex border-b dark:border-gray-700">
                        <button
                            type="button"
                            className={`flex-1 py-3 text-sm font-medium focus:outline-none ${activeTab === 'buy' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            onClick={() => { setActiveTab('buy'); setAmount('500'); }}
                        >
                            买入
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-3 text-sm font-medium focus:outline-none ${activeTab === 'dividend-cash' ? 'text-yellow-600 border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            onClick={() => { setActiveTab('dividend-cash'); setAmount(''); }}
                        >
                            现金分红
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-3 text-sm font-medium focus:outline-none ${activeTab === 'dividend-reinvest' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            onClick={() => { setActiveTab('dividend-reinvest'); setAmount(''); }}
                        >
                            红利再投
                        </button>
                    </div>
                )}

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
                        {!isEditing || isPending ? (
                             <span className={`ml-3 text-xs font-bold ${isConfirmed ? 'text-green-600' : 'text-yellow-600'}`}>
                                ({isConfirmed ? `收盘净值: ${nav.toFixed(4)}` : '任务待确认'})
                            </span>
                        ) : null}
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
                        
                        {/* 份额 (Dynamic) */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">份额</div>
                            <div className="text-xl font-semibold text-gray-900 dark:text-white">{totalShares.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                             <div className={`text-sm ${getProfitColor(1)}`}>
                                {sharesChangeAmount > 0 ? `+${sharesChangeAmount.toFixed(2)}` : <>&nbsp;</>}
                            </div>
                        </div>
                        
                        {/* 估算总值 (Buy/Reinvest Only, mostly) */}
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">估算总值</div>
                            <div className="text-xl font-semibold text-gray-900 dark:text-white">
                                {marketValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </div>
                             <div className={`text-sm ${getProfitColor(1)}`}>
                                {marketValueChangePercent > 0
                                    ? `(+${marketValueChangePercent.toFixed(2)}%)`
                                    : <>&nbsp;</>
                                }
                            </div>
                        </div>
                        
                         {/* Dynamic Input */}
                        <div>
                            <label htmlFor="amount-input" className="block text-sm text-gray-700 dark:text-gray-300">{inputLabel}</label>
                            <div className="flex items-center mt-1 h-[42px]">
                                <button
                                    type="button"
                                    onClick={() => handleStep(-stepValue)}
                                    disabled={!amount || parseFloat(amount) <= 0}
                                    className="px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 h-full border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none disabled:opacity-50"
                                >
                                    <span className="text-xl font-bold">-</span>
                                </button>
                                <input
                                    type="number"
                                    id="amount-input"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={activeTab === 'buy' ? "500" : ""}
                                    required
                                    autoFocus
                                    ref={amountInputRef}
                                    step="0.01"
                                    className="w-full text-center h-full px-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleStep(stepValue)}
                                    className="px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 h-full border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md focus:outline-none"
                                >
                                    <span className="text-xl font-bold">+</span>
                                </button>
                            </div>
                        </div>

                        {/* Cost / Realized Profit Display (Dynamic) */}
                        {activeTab === 'dividend-cash' ? (
                            <div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">落袋收益</div>
                                <div className="text-xl font-semibold text-gray-900 dark:text-white">{realizedProfit.toFixed(2)}</div>
                                <div className={`text-sm ${getProfitColor(realizedProfitChangeAmount)}`}>
                                    {realizedProfitChangeAmount > 0 
                                        ? `+${realizedProfitChangeAmount.toFixed(2)}`
                                        : <>&nbsp;</>
                                    }
                                </div>
                            </div>
                        ) : (
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
                        )}

                        {/* Submit Button */}
                        <div>
                           <button type="submit" className={`flex items-center justify-center w-full h-[42px] text-white font-semibold px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:bg-gray-300 disabled:text-gray-500 ${activeTab === 'buy' ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500' : activeTab === 'dividend-cash' ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-600' : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-600'}`}
                            disabled={!amount || parseFloat(amount) <= 0}
                           >
                               {isEditing ? '更新记录' : submitLabel}
                           </button>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                {isEditing && (
                    <div className="flex justify-start items-center px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 flex-shrink-0">
                       <button 
                            type="button" 
                            onClick={handleDeleteOrCancel}
                            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            删除记录
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default BuyModal;
