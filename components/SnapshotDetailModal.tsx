import React, { useMemo, useEffect } from 'react';
import { PortfolioSnapshot, ProcessedFund, TradingRecord } from '../types';

interface SnapshotDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    snapshot: PortfolioSnapshot;
    funds: ProcessedFund[];
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const SnapshotDetailModal: React.FC<SnapshotDetailModalProps> = ({ isOpen, onClose, snapshot, funds }) => {
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

    const { detailedBuyRecords, buyTotals, detailedSellRecords, sellTotals, initialHoldings } = useMemo(() => {
        if (snapshot.snapshotDate === '基准持仓') {
            const holdings = funds
                .filter(f => f.initialUserPosition && f.initialUserPosition.shares > 0)
                .map(f => ({
                    name: f.name,
                    shares: f.initialUserPosition!.shares,
                    cost: f.initialUserPosition!.cost,
                    totalCost: f.initialUserPosition!.shares * f.initialUserPosition!.cost,
                }));
            return { 
                detailedBuyRecords: [],
                buyTotals: { floatingProfit: 0, amount: 0 }, 
                detailedSellRecords: [],
                sellTotals: { opportunityProfit: 0, realizedProfit: 0, amount: 0 },
                initialHoldings: holdings 
            };
        }

        const snapshotDate = snapshot.snapshotDate;
        const latestNavMap = new Map(funds.map(f => [f.code, f.baseChartData[f.baseChartData.length - 1]?.unitNAV ?? 0]));

        const detailedBuys: any[] = [];
        const detailedSells: any[] = [];
        
        let totalBuyFloatingProfit = 0;
        let totalBuyAmount = 0;
        let totalSellOpportunityProfit = 0;
        let totalSellRealizedProfit = 0;
        let totalSellAmount = 0;

        funds.forEach(fund => {
            const position = fund.userPosition;
            if (!position?.tradingRecords) return;

            const recordsOnDate = position.tradingRecords.filter(r => r.date === snapshotDate);
            if (recordsOnDate.length === 0) return;

            // FIX: Start replay from the initial user position, not the final calculated one.
            let prevShares = fund.initialUserPosition?.shares ?? 0;
            let prevTotalCost = (fund.initialUserPosition?.shares ?? 0) * (fund.initialUserPosition?.cost ?? 0);

            // Replay all transactions BEFORE the snapshot date to get the state at the start of the day.
            const recordsBeforeDate = (position.tradingRecords)
                .filter(r => new Date(r.date).getTime() < new Date(snapshotDate).getTime())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const record of recordsBeforeDate) {
                if (record.type === 'buy') {
                    prevShares += record.sharesChange;
                    prevTotalCost += record.amount;
                } else { // sell
                    const costBasisPerShareBeforeSell = prevShares > 0 ? prevTotalCost / prevShares : 0;
                    prevTotalCost -= costBasisPerShareBeforeSell * Math.abs(record.sharesChange);
                    prevShares += record.sharesChange; // sharesChange is negative for sell
                    if (prevShares < 1e-6) {
                        prevShares = 0;
                        prevTotalCost = 0;
                    }
                }
            }
            
            const prevAvgCost = prevShares > 0 ? prevTotalCost / prevShares : 0;

            recordsOnDate.forEach(record => {
                const latestNAV = latestNavMap.get(fund.code) ?? 0;
                
                if (record.type === 'buy') {
                    const newTotalShares = prevShares + record.sharesChange;
                    const newTotalCost = prevTotalCost + record.amount;
                    const newAvgCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;

                    const costChange = newAvgCost - prevAvgCost;
                    const costChangePercent = prevAvgCost > 0 ? (costChange / prevAvgCost) * 100 : 0;
                    // FIX: If prevShares is 0, this is the first purchase, so the change is 100%.
                    const sharesChangePercent = prevShares > 0 ? (record.sharesChange / prevShares) * 100 : 100;
                    const floatingProfit = latestNAV > 0 ? (latestNAV - record.nav) * record.sharesChange : 0;
                    const floatingProfitPercent = record.nav > 0 && record.amount > 0 ? (floatingProfit / record.amount) * 100 : 0;

                    totalBuyFloatingProfit += floatingProfit;
                    totalBuyAmount += record.amount;

                    detailedBuys.push({
                        fundName: fund.name,
                        costChange, costChangePercent,
                        sharesChange: record.sharesChange, sharesChangePercent,
                        floatingProfit, floatingProfitPercent,
                        amount: record.amount
                    });

                } else { // sell
                    // FIX: The prevShares is now correct, so this calculation is correct.
                    const sharesChangePercent = prevShares > 0 ? (record.sharesChange / prevShares) * 100 : 0;
                    const opportunityProfit = latestNAV > 0 ? (record.nav - latestNAV) * Math.abs(record.sharesChange) : 0;
                    const opportunityProfitPercent = record.nav > 0 ? ((record.nav - latestNAV) / record.nav) * 100 : 0;
                    const realizedProfit = record.realizedProfitChange ?? 0;
                    // FIX: The prevAvgCost is now correct, so this percentage is also correct.
                    const realizedProfitPercent = prevAvgCost > 0 ? ((record.nav - prevAvgCost) / prevAvgCost) * 100 : 0;

                    totalSellOpportunityProfit += opportunityProfit;
                    totalSellRealizedProfit += realizedProfit;
                    totalSellAmount += Math.abs(record.amount);

                    detailedSells.push({
                        fundName: fund.name,
                        sharesChange: record.sharesChange, sharesChangePercent,
                        opportunityProfit, opportunityProfitPercent,
                        realizedProfit, realizedProfitPercent,
                        amount: Math.abs(record.amount)
                    });
                }
            });
        });

        return { 
            detailedBuyRecords: detailedBuys,
            buyTotals: { floatingProfit: totalBuyFloatingProfit, amount: totalBuyAmount },
            detailedSellRecords: detailedSells,
            sellTotals: { opportunityProfit: totalSellOpportunityProfit, realizedProfit: totalSellRealizedProfit, amount: totalSellAmount },
            initialHoldings: [] 
        };

    }, [snapshot, funds]);
    
    const netAmountChange = useMemo(() => {
        if (snapshot.snapshotDate === '基准持仓') {
            return 0;
        }
        return buyTotals.amount - sellTotals.amount;
    }, [buyTotals.amount, sellTotals.amount, snapshot.snapshotDate]);

    const hasBuys = detailedBuyRecords.length > 0;
    const hasSells = detailedSellRecords.length > 0;
    const hasOnlyOneType = (hasBuys && !hasSells) || (!hasBuys && hasSells);
    const modalMaxWidthClass = hasOnlyOneType ? 'max-w-xl' : 'max-w-6xl';


    if (!isOpen) return null;

    const renderTransactionTables = () => (
        <div className={`grid grid-cols-1 ${!hasOnlyOneType ? 'md:grid-cols-2' : ''} gap-x-6 gap-y-4`}>
            {/* Buy Operations Column */}
            {hasBuys && (
                <div className={`${hasOnlyOneType ? 'mx-auto w-full' : ''}`}>
                    <h4 className="text-xl font-bold mb-3 text-red-600">买入操作</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-200 dark:bg-gray-700">
                                <tr>
                                    <th className="p-2 whitespace-nowrap">基金名称</th>
                                    <th className="p-2 text-right whitespace-nowrap">份额变化</th>
                                    <th className="p-2 text-right whitespace-nowrap">成本变化</th>
                                    <th className="p-2 text-right whitespace-nowrap">浮盈</th>
                                    <th className="p-2 text-right whitespace-nowrap">买入</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailedBuyRecords.map((record, index) => (
                                    <tr key={`buy-${index}`} className="border-b dark:border-gray-700">
                                        <td className="p-2 font-semibold">{record.fundName}</td>
                                        <td className="p-2 text-right font-mono">
                                            <div className={getProfitColor(1)}>+{record.sharesChange.toFixed(2)}</div>
                                            <div className={`${getProfitColor(1)} text-xs`}>+{record.sharesChangePercent.toFixed(2)}%</div>
                                        </td>
                                        <td className="p-2 text-right font-mono">
                                            <div className={getProfitColor(record.costChange * -1)}>{record.costChange.toFixed(4)}</div>
                                            <div className={`${getProfitColor(record.costChange * -1)} text-xs`}>{`${record.costChangePercent > 0 ? '+' : ''}${record.costChangePercent.toFixed(2)}%`}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono">
                                            <div className={getProfitColor(record.floatingProfit)}>{record.floatingProfit.toFixed(2)}</div>
                                            <div className={`${getProfitColor(record.floatingProfit)} text-xs`}>{`${record.floatingProfitPercent > 0 ? '+' : ''}${record.floatingProfitPercent.toFixed(2)}%`}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono">{record.amount.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t dark:border-gray-600 font-bold">
                                    <td className="p-2 text-left" colSpan={3}>汇总</td>
                                    <td className="p-2 text-right font-mono">
                                        <div className={getProfitColor(buyTotals.floatingProfit)}>{buyTotals.floatingProfit.toFixed(2)}</div>
                                    </td>
                                    <td className="p-2 text-right font-mono">{buyTotals.amount.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Sell Operations Column */}
            {hasSells && (
                <div className={`${hasOnlyOneType ? 'mx-auto w-full' : ''}`}>
                    <h4 className="text-xl font-bold mb-3 text-blue-600">卖出操作</h4>
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-200 dark:bg-gray-700">
                                <tr>
                                    <th className="p-2 whitespace-nowrap">基金名称</th>
                                    <th className="p-2 text-right whitespace-nowrap">份额变化</th>
                                    <th className="p-2 text-right whitespace-nowrap">机会收益</th>
                                    <th className="p-2 text-right whitespace-nowrap">落袋</th>
                                    <th className="p-2 text-right whitespace-nowrap">到账</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailedSellRecords.map((record, index) => (
                                    <tr key={`sell-${index}`} className="border-b dark:border-gray-700">
                                        <td className="p-2 font-semibold">{record.fundName}</td>
                                        <td className="p-2 text-right font-mono">
                                            <div className={getProfitColor(-1)}>{record.sharesChange.toFixed(2)}</div>
                                            <div className={`${getProfitColor(-1)} text-xs`}>{record.sharesChangePercent.toFixed(2)}%</div>
                                        </td>
                                        <td className="p-2 text-right font-mono">
                                            <div className={getProfitColor(record.opportunityProfit)}>{`${record.opportunityProfit > 0 ? '+' : ''}${record.opportunityProfit.toFixed(2)}`}</div>
                                            <div className={`${getProfitColor(record.opportunityProfit)} text-xs`}>{`${record.opportunityProfitPercent > 0 ? '+' : ''}${record.opportunityProfitPercent.toFixed(2)}%`}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono">
                                            <div className={getProfitColor(record.realizedProfit)}>{record.realizedProfit.toFixed(2)}</div>
                                            <div className={`${getProfitColor(record.realizedProfit)} text-xs`}>{`${record.realizedProfitPercent > 0 ? '+' : ''}${record.realizedProfitPercent.toFixed(2)}%`}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono">{record.amount.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t dark:border-gray-600 font-bold">
                                    <td className="p-2 text-left" colSpan={2}>汇总</td>
                                    <td className="p-2 text-right font-mono">
                                        <div className={getProfitColor(sellTotals.opportunityProfit)}>{`${sellTotals.opportunityProfit > 0 ? '+' : ''}${sellTotals.opportunityProfit.toFixed(2)}`}</div>
                                    </td>
                                    <td className="p-2 text-right font-mono">
                                        <div className={getProfitColor(sellTotals.realizedProfit)}>{sellTotals.realizedProfit.toFixed(2)}</div>
                                    </td>
                                    <td className="p-2 text-right font-mono">{sellTotals.amount.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    const renderInitialHoldingsTable = () => (
        <div className="flex justify-center">
            <div className="w-full max-w-3xl">
                <h4 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    初始持仓
                </h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-200 dark:bg-gray-700">
                            <tr>
                                <th className="p-2">基金名称</th>
                                <th className="p-2 text-right">初始份额</th>
                                <th className="p-2 text-right">初始成本</th>
                                <th className="p-2 text-right">初始总成本</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialHoldings.map((h, index) => (
                                <tr key={`${h.name}-${index}`} className="border-b dark:border-gray-700">
                                    <td className="p-2">{h.name}</td>
                                    <td className="p-2 text-right font-mono">{h.shares.toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono">{h.cost.toFixed(4)}</td>
                                    <td className="p-2 text-right font-mono">{h.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center transition-opacity"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            aria-modal="true"
            role="dialog"
        >
            <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg shadow-xl w-full ${modalMaxWidthClass} m-4 transform transition-all flex flex-col max-h-[90vh]`}>
                <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700 bg-white dark:bg-gray-900 rounded-t-lg">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-baseline flex-wrap">
                        <span>操作明细: {snapshot.snapshotDate}</span>
                        {netAmountChange !== 0 && (
                            <span className="ml-4">
                                <span>金额变动: </span>
                                <span className={getProfitColor(netAmountChange)}>
                                    {netAmountChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </span>
                        )}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none" aria-label="Close">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {snapshot.snapshotDate === '基准持仓' ? (
                        initialHoldings.length > 0 ? renderInitialHoldingsTable() : <p className="text-center text-gray-500 dark:text-gray-400">无初始持仓记录。</p>
                    ) : (
                        (hasBuys || hasSells) ? (
                            renderTransactionTables()
                        ) : (
                            <p className="text-center text-gray-500 dark:text-gray-400">该日期无交易记录。</p>
                        )
                    )}
                </div>

            </div>
        </div>
    );
};

export default SnapshotDetailModal;