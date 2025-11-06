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
        {subValue && <div className={`text-xs text-blue-500`}>{subValue}</div>}
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

    const percentileColor = useMemo(() => {
        if (navPercentile === null) return 'text-gray-500 dark:text-gray-400';
        if (navPercentile <= 20) return 'text-green-600 dark:text-green-500';
        if (navPercentile >= 80) return 'text-red-500 dark:text-red-500';
        return 'text-yellow-600 dark:text-yellow-400';
    }, [navPercentile]);

    const { chartData, lastPivotDate, latestNAV, yesterdayNAV } = useMemo(() => {
        const baseChartData = [...fund.data];
        if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) {
            baseChartData.push({
                date: fund.realTimeData.estimationTime,
                unitNAV: fund.realTimeData.estimatedNAV,
                cumulativeNAV: fund.realTimeData.estimatedNAV,
                dailyGrowthRate: fund.realTimeData.estimatedChange,
                subscriptionStatus: 'N/A',
                redemptionStatus: 'N/A',
                dividendDistribution: 'N/A',
            });
        }
        
        const zigzagPoints = calculateZigzag(baseChartData, zigzagThreshold);
        const zigzagMap = new Map(zigzagPoints.map(p => [p.date, p.unitNAV]));

        const finalChartData = baseChartData.map((p, index, arr) => {
            const zigzagNAV = zigzagMap.get(p.date);
            let dailyProfit = 0;
            if (index > 0 && numericShares > 0) {
                const prevPoint = arr[index - 1];
                const currentNav = p.unitNAV ?? 0;
                const prevNav = prevPoint.unitNAV ?? 0;
                if (currentNav > 0 && prevNav > 0) {
                     dailyProfit = (currentNav - prevNav) * numericShares;
                }
            }
            return { ...p, zigzagNAV, dailyProfit };
        });

        const pivotDate = zigzagPoints.length >= 2 ? zigzagPoints[zigzagPoints.length - 2]?.date : null;
        
        const nav = (fund.realTimeData?.estimatedNAV > 0 ? fund.realTimeData.estimatedNAV : fund.latestNAV) ?? 0;
        const yNav = fund.data.length > 1 ? fund.data[fund.data.length - 1].unitNAV : fund.latestNAV ?? 0;

        return { chartData: finalChartData, lastPivotDate: pivotDate, latestNAV: nav, yesterdayNAV: yNav };
    }, [fund.data, fund.realTimeData, fund.latestNAV, zigzagThreshold, numericShares]);

    const metrics = useMemo(() => {
        const marketValue = numericShares * latestNAV;
        const costBasis = numericShares * numericCost;
        const holdingProfit = marketValue - costBasis;
        
        // Use the editable value for real-time calculation
        const currentTotalProfit = parseFloat(editableTotalProfit) || 0;
        const realizedProfit = currentTotalProfit - holdingProfit;

        const cumulativeCost = costBasis - realizedProfit;
        const actualCost = numericShares > 0 ? cumulativeCost / numericShares : 0;
        
        const dailyProfit = fund.realTimeData?.estimatedNAV > 0 && yesterdayNAV > 0
            ? (fund.realTimeData.estimatedNAV - yesterdayNAV) * numericShares
            : 0;

        const dailyProfitRate = marketValue > 0 && dailyProfit !== 0 ? (dailyProfit / (marketValue - dailyProfit)) * 100 : 0;
        
        const holdingProfitRate = costBasis > 0 ? (holdingProfit / costBasis) * 100 : 0;
        // Use the editable value for real-time calculation
        const totalProfitRate = costBasis > 0 ? (currentTotalProfit / costBasis) * 100 : 0;
        
        return { marketValue, costBasis, holdingProfit, realizedProfit, cumulativeCost, actualCost, totalProfit: currentTotalProfit, dailyProfit, dailyProfitRate, holdingProfitRate, totalProfitRate };
    }, [numericShares, numericCost, latestNAV, yesterdayNAV, editableTotalProfit, fund.realTimeData]);

    useEffect(() => {
      // Initialize editableTotalProfit from saved data when modal opens or fund changes
      const initialHoldingProfit = (numericShares * latestNAV) - (numericShares * numericCost);
      const initialRealizedProfit = fund.userPosition?.realizedProfit ?? 0;
      const initialTotalProfit = initialHoldingProfit + initialRealizedProfit;
      setEditableTotalProfit(initialTotalProfit.toFixed(2));
    }, [fund, numericShares, numericCost, latestNAV]);


    const handleSave = useCallback(() => {
        onSave({
            code: fund.code,
            shares: numericShares,
            cost: numericCost,
            tag,
            realizedProfit: metrics.realizedProfit, // Use the dynamically calculated realized profit
        });
        onClose();
    }, [fund.code, numericShares, numericCost, tag, metrics.realizedProfit, onSave, onClose]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isConfirmModalOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, isConfirmModalOpen]);

    const handleOpenConfirmModal = () => setIsConfirmModalOpen(true);
    const handleConfirmDelete = () => onDelete(fund.code);

    const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

    return (
        <>
            <div 
                className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center transition-opacity" 
                onClick={(e) => { if (e.target === e.currentTarget && !isConfirmModalOpen) onClose(); }}
                aria-modal="true"
                role="dialog"
            >
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl m-4 transform transition-all max-h-[90vh] flex flex-col">
                    {/* Modal Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleOpenConfirmModal}
                                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 focus:outline-none"
                                aria-label="Delete fund"
                            >
                                <svg className="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {fund.name}
                                <span className="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">{fund.code}</span>
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 overflow-y-auto">
                        <div className="h-[250px] mb-6">
                            <FundChart 
                                chartData={chartData} 
                                lastPivotDate={lastPivotDate} 
                                costPrice={numericCost > 0 ? numericCost : null}
                                actualCostPrice={metrics.actualCost > 0 ? metrics.actualCost : null}
                            />
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-2 text-center mb-6">
                            <StatDisplay label="估算总值" value={`${metrics.marketValue.toFixed(2)} 元`} isLarge/>
                            <StatDisplay label="总 / 累计成本" value={`${metrics.costBasis.toFixed(2)} 元`} subValue={`${metrics.cumulativeCost.toFixed(2)} 元`} isLarge/>
                            <StatDisplay label="持有收益" value={`${metrics.holdingProfit.toFixed(2)} 元`} colorClass={getProfitColor(metrics.holdingProfit)} isLarge/>
                            <StatDisplay label="落袋收益" value={`${metrics.realizedProfit.toFixed(2)} 元`} colorClass={getProfitColor(metrics.realizedProfit)} isLarge/>

                            <StatDisplay label="今日收益" value={`${metrics.dailyProfit.toFixed(2)} 元`} colorClass={getProfitColor(metrics.dailyProfit)}/>
                            <StatDisplay label="今日收益率" value={`${metrics.dailyProfitRate.toFixed(2)}%`} colorClass={getProfitColor(metrics.dailyProfitRate)}/>
                            <StatDisplay label="持有 / 累计收益率" value={`${metrics.holdingProfitRate.toFixed(2)}%`} subValue={`${metrics.totalProfitRate.toFixed(2)}%`} colorClass={getProfitColor(metrics.holdingProfitRate)}/>
                            <StatDisplay 
                                label="分位点" 
                                value={navPercentile !== null ? `${navPercentile.toFixed(2)}%` : '-'} 
                                colorClass={percentileColor}
                            />
                        </div>

                        {/* Input Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-gray-500">最新净值</label>
                                <input type="text" readOnly value={latestNAV.toFixed(4)} className="mt-1 w-full p-2 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded text-center"/>
                            </div>
                             <div>
                                <label className="block text-xs text-gray-500">成本 / 实际成本</label>
                                <input type="number" value={cost} onChange={e => setCost(e.target.value)} className="mt-1 w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-center focus:ring-primary-500 focus:border-primary-500"/>
                                <div className="text-xs text-blue-500 text-center mt-1">{metrics.actualCost.toFixed(4)}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">份额</label>
                                <input type="number" value={shares} onChange={e => setShares(e.target.value)} className="mt-1 w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-center focus:ring-primary-500 focus:border-primary-500"/>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">累计收益</label>
                                <input type="number" value={editableTotalProfit} onChange={e => setEditableTotalProfit(e.target.value)} className="mt-1 w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-center focus:ring-primary-500 focus:border-primary-500"/>
                            </div>
                        </div>

                        {/* Tag Input */}
                        <div>
                           <label className="block text-xs text-gray-500">标签</label>
                           <input type="text" value={tag} onChange={e => setTag(e.target.value)} placeholder="☀️新能源, ⬆️, 等下跌" className="mt-1 w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 focus:border-primary-500"/>
                        </div>
                    </div>
                    
                    {/* Modal Footer */}
                    <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 flex-shrink-0">
                       <button onClick={handleSave} className="w-full bg-primary-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900">
                           保存
                       </button>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="确认删除"
                message={`您确定要取消订阅基金 ${fund.name} (${fund.code}) 吗？`}
            />
        </>
    );
};

export default FundDetailModal;