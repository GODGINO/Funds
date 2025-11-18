import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TradeModalState } from '../types';
import FundChart from './FundChart';

interface SellModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (fund: TradeModalState['fund'], date: string, type: 'buy' | 'sell', value: number, isConfirmed: boolean, nav: number, isEditing: boolean) => void;
    onDelete: (fundCode: string, recordDate: string) => void;
    tradeState: TradeModalState;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const SellModal: React.FC<SellModalProps> = ({ isOpen, onClose, onSubmit, onDelete, tradeState }) => {
    const [shares, setShares] = useState('');
    const [error, setError] = useState('');
    const sharesInputRef = useRef<HTMLInputElement>(null);

    const { fund, date, nav, isConfirmed, editingRecord } = tradeState;
    const isEditing = !!editingRecord;
    const isPending = isEditing && editingRecord.nav === undefined;
    const position = fund.userPosition;

    const availableShares = useMemo(() => {
        if (!position) return 0;
        // If editing a CONFIRMED record, add back the shares from that record to calculate the pool available before that trade.
        if (isEditing && !isPending) {
            return position.shares - editingRecord.sharesChange!;
        }
        // If creating a NEW trade or editing a PENDING record, the available shares are what's currently held.
        return position.shares;
    }, [position, isEditing, isPending, editingRecord]);


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
        dailyLabel,
    } = useMemo(() => {
        const pos = fund.userPosition;

        const totalShares = pos?.shares || 0;
        const marketValue = fund.marketValue || 0;
        const holdingProfit = fund.holdingProfit || 0;

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
            dailyLabel,
        };
    }, [fund, shares, nav, date]);


    useEffect(() => {
        if (isOpen) {
            if (isEditing) {
                const initialValue = isPending ? editingRecord.value : Math.abs(editingRecord.sharesChange!);
                setShares(String(initialValue ?? ''));
            } else {
                // Default to ~500 CNY worth of shares, rounded to the nearest hundred.
                if (nav > 0 && availableShares > 0) {
                    const defaultAmountInCny = 500;
                    const calculatedShares = defaultAmountInCny / nav;

                    let roundedShares = Math.round(calculatedShares / 100) * 100;
                    
                    if (roundedShares === 0 && calculatedShares > 0) {
                        roundedShares = 100;
                    }

                    const finalShares = Math.min(roundedShares, availableShares);
                    setShares(finalShares > 0 ? String(Math.floor(finalShares)) : '');
                } else {
                    setShares('');
                }
            }
            setError('');
            setTimeout(() => {
                sharesInputRef.current?.select();
            }, 50);
        }
    }, [isOpen, isEditing, isPending, editingRecord, nav, availableShares]);

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
        if (value === '') {
            setError('');
            return;
        }
        const numericValue = parseFloat(value);
        if (numericValue > availableShares) {
            setError(`超过可用份额: ${availableShares.toFixed(2)}`);
        } else {
            setError('');
        }
    };

    const stepValue = useMemo(() => {
        if (nav < 1) {
            return 200;
        } else if (nav < 2) {
            return 100;
        } else {
            return 50;
        }
    }, [nav]);

    const handleStep = (step: number) => {
        const currentValue = parseFloat(shares) || 0;
        const newValue = currentValue + step;
        const clampedValue = Math.max(0, Math.min(newValue, availableShares));
        const roundedValue = Math.round(clampedValue * 100) / 100;
        handleSharesChange({ target: { value: String(roundedValue) } } as React.ChangeEvent<HTMLInputElement>);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericShares = parseFloat((parseFloat(shares) || 0).toFixed(2));
        if (!numericShares || numericShares <= 0 || error) return;
        
        onSubmit(fund, date, 'sell', numericShares, isConfirmed, nav, isEditing);
    };

    const handleDeleteOrCancel = () => {
        if (isEditing) {
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
                        {isEditing ? '修改卖出记录' : '卖出'} {fund.name}
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
                            <div className="flex items-center mt-1 h-[42px]">
                                <button
                                    type="button"
                                    onClick={() => handleStep(-stepValue)}
                                    disabled={!shares || parseFloat(shares) <= 0}
                                    className="px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 h-full border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none disabled:opacity-50"
                                    aria-label={`减少${stepValue}份额`}
                                >
                                    <span className="text-xl font-bold">-</span>
                                </button>
                                <input
                                    type="number"
                                    id="sell-shares"
                                    value={shares}
                                    onChange={handleSharesChange}
                                    placeholder={`可用 ${availableShares.toFixed(2)}`}
                                    required
                                    autoFocus
                                    ref={sharesInputRef}
                                    max={availableShares}
                                    step="0.01"
                                    className={`w-full text-center h-full px-3 bg-white dark:bg-gray-700 border placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${error ? 'border-red-500 text-red-600 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleStep(stepValue)}
                                    disabled={parseFloat(shares) >= availableShares}
                                    className="px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 h-full border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md focus:outline-none disabled:opacity-50"
                                    aria-label={`增加${stepValue}份额`}
                                >
                                    <span className="text-xl font-bold">+</span>
                                </button>
                            </div>
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
                           <button type="submit" className="flex items-center justify-center w-full h-[42px] bg-primary-500 text-white font-semibold px-4 rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900 disabled:bg-gray-300 disabled:text-gray-500"
                            disabled={!shares || parseFloat(shares) <= 0 || !!error}
                           >
                               {isEditing ? '更新记录' : '卖出'}
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

export default SellModal;