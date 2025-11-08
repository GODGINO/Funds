import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Fund, UserPosition } from '../types';
import FundChart from './FundChart';
import ConfirmationModal from './ConfirmationModal';
import { calculateZigzag } from '../services/chartUtils';

interface FundDetailModalProps {
  fund: Fund;
  onClose: () => void;
  onDelete: (code: string) => void;
  onSave: (position: UserPosition) => void;
  zigzagThreshold: number;
}


const StatDisplay: React.FC<{ label: string; value: string; subValue?: string; colorClass?: string; isLarge?: boolean }> = ({ label, value, subValue, colorClass, isLarge = false }) => (
    <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className={`${isLarge ? 'text-2xl' : 'text-lg'} font-semibold ${colorClass || 'text-gray-900 dark:text-white'}`}>{value}</div>
        {subValue && <div className={`text-xs ${colorClass}`}>{subValue}</div>}
    </div>
);

const FundDetailModal: React.FC<FundDetailModalProps> = ({ fund, onClose, onDelete, onSave, zigzagThreshold }) => {
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Form state
    const [shares, setShares] = useState<string>(String(fund.userPosition?.shares ?? 0));
    const [cost, setCost] = useState<string>(String(fund.userPosition?.cost ?? 0));
    const [tag, setTag] = useState<string>(fund.userPosition?.tag ?? '');
    const [editableTotalProfit, setEditableTotalProfit] = useState<string>('');

    const numericShares = useMemo(() => parseFloat(shares) || 0, [shares]);
    const numericCost = useMemo(() => parseFloat(cost) || 0, [cost]);

    const navPercentile = (fund as any).navPercentile as number | null;

    const { chartData, lastPivotDate, latestNAV, yesterdayNAV } = useMemo(() => {
        const baseChartData = [...fund.data];
        if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) {
            const realTimeDate = fund.realTimeData.estimationTime.split(' ')[0];
            const hasHistoricalDataForToday = fund.data.some(
                dataPoint => dataPoint.date === realTimeDate
            );
            if (!hasHistoricalDataForToday) {
                 baseChartData.push({
                    date: fund.realTimeData.estimationTime,
                    unitNAV: fund.realTimeData.estimatedNAV,
                    cumulativeNAV: fund.realTimeData.estimatedNAV,
                    dailyGrowthRate: `${fund.realTimeData.estimatedChange}%`,
                    subscriptionStatus: 'N/A',
                    redemptionStatus: 'N/A',
                    dividendDistribution: 'N/A',
                });
            }
        }

        const zigzagPoints = calculateZigzag(baseChartData, zigzagThreshold);
        const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));

        const chartDataWithZigzag = baseChartData.map(p => ({
            ...p,
            zigzagNAV: zigzagMap.get(p.date),
        }));

        const lastPivotDate = zigzagPoints.length >= 2 ? zigzagPoints[zigzagPoints.length - 2]?.date : null;

        const latestNAV = baseChartData.length > 0 ? (baseChartData[baseChartData.length - 1].unitNAV ?? 0) : 0;
        const yesterdayNAV = baseChartData.length > 1 ? (baseChartData[baseChartData.length - 2].unitNAV ?? 0) : 0;
        
        return { chartData: chartDataWithZigzag, lastPivotDate, latestNAV, yesterdayNAV };
    }, [fund.data, fund.realTimeData, zigzagThreshold]);

    const portfolioMetrics = useMemo(() => {
        const marketValue = numericShares * latestNAV;
        const costBasis = numericShares * numericCost;
        const holdingProfit = marketValue - costBasis;
        
        const initialTotalProfit = holdingProfit + (fund.userPosition?.realizedProfit ?? 0);
        // Use the user-edited value if it exists, otherwise use the calculated one
        const totalProfit = editableTotalProfit ? (parseFloat(editableTotalProfit) || 0) : initialTotalProfit;
        
        const realizedProfit = totalProfit - holdingProfit;
        
        const cumulativeCost = costBasis - realizedProfit;
        const actualCost = numericShares > 0 ? cumulativeCost / numericShares : 0;

        const dailyProfit = yesterdayNAV > 0 ? (latestNAV - yesterdayNAV) * numericShares : 0;
        const dailyProfitRate = yesterdayNAV > 0 ? ((latestNAV - yesterdayNAV) / yesterdayNAV) * 100 : 0;

        return {
            marketValue,
            costBasis,
            holdingProfit,
            totalProfit,
            realizedProfit,
            actualCost,
            dailyProfit,
            dailyProfitRate,
        };
    }, [numericShares, numericCost, latestNAV, yesterdayNAV, fund.userPosition, editableTotalProfit]);

     useEffect(() => {
        // Initialize the editableTotalProfit only once when the component mounts or fund changes
        setEditableTotalProfit(portfolioMetrics.totalProfit.toFixed(2));
    }, [fund.code]); // Depend only on fund.code to reset on fund change

    const handleSave = useCallback(() => {
        const updatedPosition: UserPosition = {
            code: fund.code,
            shares: numericShares,
            cost: numericCost,
            tag: tag.trim(),
            realizedProfit: portfolioMetrics.realizedProfit,
        };
        onSave(updatedPosition);
        onClose();
    }, [fund.code, numericShares, numericCost, tag, portfolioMetrics.realizedProfit, onSave, onClose]);

    const handleDelete = () => {
        onDelete(fund.code);
        setIsConfirmModalOpen(false);
    };

    const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

    const percentileColor = useMemo(() => {
        if (navPercentile === null || navPercentile === undefined) return 'text-gray-500 dark:text-gray-400';
        if (navPercentile <= 20) return 'text-green-600 dark:text-green-500';
        if (navPercentile >= 80) return 'text-red-500 dark:text-red-500';
        return 'text-yellow-600 dark:text-yellow-400';
    }, [navPercentile]);


    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // This makes the modal content not scrollable when the modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const showActualCost = portfolioMetrics.actualCost.toFixed(4) !== numericCost.toFixed(4);

    return (
        <div 
            className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 transform transition-all flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{fund.name} <span className="text-gray-500 dark:text-gray-400">{fund.code}</span></h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Stats */}
                        <div className="space-y-4">
                           <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                <StatDisplay label="估算总值" value={portfolioMetrics.marketValue.toFixed(2)} isLarge />
                                <StatDisplay label="持有收益" value={portfolioMetrics.holdingProfit.toFixed(2)} colorClass={getProfitColor(portfolioMetrics.holdingProfit)} isLarge />
                                <StatDisplay label="累计收益" value={portfolioMetrics.totalProfit.toFixed(2)} colorClass={getProfitColor(portfolioMetrics.totalProfit)} isLarge />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <StatDisplay 
                                    label="今日估算" 
                                    value={`${portfolioMetrics.dailyProfit >= 0 ? '+' : ''}${portfolioMetrics.dailyProfit.toFixed(2)}`} 
                                    subValue={`${portfolioMetrics.dailyProfitRate >= 0 ? '+' : ''}${portfolioMetrics.dailyProfitRate.toFixed(2)}%`} 
                                    colorClass={getProfitColor(portfolioMetrics.dailyProfit)} 
                                />
                                <StatDisplay label="最新净值" value={latestNAV.toFixed(4)} />
                                <StatDisplay 
                                    label="分位点" 
                                    value={navPercentile ? `${navPercentile.toFixed(0)}%` : '-'} 
                                    colorClass={percentileColor}
                                />
                                <StatDisplay label="持有成本" value={portfolioMetrics.costBasis.toFixed(2)} />
                                <StatDisplay label="持仓份额" value={numericShares.toLocaleString()} />
                                <StatDisplay label="持仓成本价" value={numericCost.toFixed(4)} />
                                {showActualCost && (
                                    <StatDisplay label="实际成本价" value={portfolioMetrics.actualCost.toFixed(4)} />
                                )}
                            </div>
                        </div>

                        {/* Right: Chart */}
                        <div className="h-64">
                             <FundChart 
                                chartData={chartData} 
                                lastPivotDate={lastPivotDate} 
                                costPrice={numericCost}
                                actualCostPrice={showActualCost ? portfolioMetrics.actualCost : null}
                                navPercentile={navPercentile}
                             />
                        </div>
                    </div>

                    {/* Form */}
                    <div className="mt-6 border-t dark:border-gray-700 pt-4">
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">份额</label>
                                <input type="number" value={shares} onChange={e => setShares(e.target.value)} className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">成本</label>
                                <input type="number" step="0.0001" value={cost} onChange={e => setCost(e.target.value)} className="mt-1 w-full form-input" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">累计收益</label>
                                <input type="number" value={editableTotalProfit} onChange={e => setEditableTotalProfit(e.target.value)} className="mt-1 w-full form-input" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">标签</label>
                                <input type="text" value={tag} onChange={e => setTag(e.target.value)} className="mt-1 w-full form-input" />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="flex justify-between items-center px-6 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
                    <button
                        onClick={() => setIsConfirmModalOpen(true)}
                        className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        删除
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        保存
                    </button>
                </div>
            </div>

            <ConfirmationModal 
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleDelete}
                title="确认删除"
                message={`您确定要删除基金 ${fund.name} (${fund.code}) 吗？此操作不可撤销。`}
            />
            
            {/* FIX: Removed unsupported 'jsx' and 'global' props from the <style> tag. This syntax is specific to Next.js's styled-jsx and is not standard in this React project, causing a TypeScript error. */}
            <style>{`
                .form-input {
                    display: block;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                    color: #111827;
                    background-color: #fff;
                    border: 1px solid #d1d5db;
                    border-radius: 0.375rem;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                }
                .dark .form-input {
                    color: #d1d5db;
                    background-color: #374151;
                    border-color: #4b5563;
                }
                .form-input:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    --tw-ring-color: #3b82f6;
                    border-color: var(--tw-ring-color);
                }
            `}</style>
        </div>
    );
};

export default FundDetailModal;
