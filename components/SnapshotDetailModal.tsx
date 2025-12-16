
import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PortfolioSnapshot, ProcessedFund, TradingRecord, TransactionType } from '../types';

interface SnapshotDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    snapshot: PortfolioSnapshot;
    funds: ProcessedFund[];
    onTagDoubleClick: (tag: string) => void;
}

const getProfitColor = (value: number) => value >= 0 ? 'text-red-500' : 'text-green-600';

const COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300' },
  { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
  { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
  { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-800 dark:text-purple-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/50', text: 'text-pink-800 dark:text-pink-300' },
  { bg: 'bg-gray-200 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300' },
];

const getTagColor = (tag: string) => {
  let hash = 0;
  if (tag.length === 0) return COLORS[6];
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
};

const TagBadge: React.FC<{ tag: string, onDoubleClick: (t: string) => void }> = ({ tag, onDoubleClick }) => {
    const { bg, text } = getTagColor(tag);
    return (
        <span
            className={`inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded ${bg} ${text} hover:opacity-80`}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick(tag);
            }}
        >
            {tag}
        </span>
    );
};

const TypeBadge: React.FC<{ type: TransactionType }> = ({ type }) => {
    if (type === 'dividend-reinvest') {
        return <span className="inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 ml-1">红利再投</span>;
    }
    if (type === 'dividend-cash') {
        return <span className="inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 ml-1">现金分红</span>;
    }
    return null;
};

const FundNameDisplay: React.FC<{ name: string; code: string }> = ({ name, code }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 1000);
        }).catch(err => {
            console.error('Failed to copy fund code: ', err);
        });
    };

    return (
        <div
            className="relative group inline-block"
            onClick={handleCopy}
            title={`点击复制代码: ${code}`}
        >
            <div className={`font-semibold transition-opacity duration-200 ${isCopied ? 'opacity-0' : 'opacity-100 group-hover:text-primary-500'}`}>
                {name}
            </div>
            <div className={`absolute left-0 top-0 font-semibold text-green-500 transition-opacity duration-200 ${isCopied ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                已复制代码
            </div>
        </div>
    );
};

const SnapshotDetailModal: React.FC<SnapshotDetailModalProps> = ({ isOpen, onClose, snapshot, funds, onTagDoubleClick }) => {
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

    const handleTagAction = (tag: string) => {
        onClose();
        onTagDoubleClick(tag);
    };

    const { detailedBuyRecords, buyTotals, detailedSellRecords, sellTotals, initialHoldings } = useMemo(() => {
        if (snapshot.snapshotDate === '基准持仓') {
            const holdings = funds
                .filter(f => f.initialUserPosition)
                .map(f => ({
                    fundCode: f.code,
                    name: f.name,
                    tags: f.initialUserPosition?.tag ? f.initialUserPosition.tag.split(',').map(t => t.trim()).filter(Boolean) : [],
                    shares: f.initialUserPosition!.shares,
                    cost: f.initialUserPosition!.cost,
                    totalCost: f.initialUserPosition!.shares * f.initialUserPosition!.cost,
                    realizedProfit: f.initialUserPosition!.realizedProfit,
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
        const isPendingSnapshot = snapshotDate === '待成交';
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

            // Select records based on snapshot type
            const recordsOnDate = isPendingSnapshot
                ? position.tradingRecords.filter(r => r.nav === undefined)
                : position.tradingRecords.filter(r => r.date === snapshotDate);
            
            if (recordsOnDate.length === 0) return;

            const tags = position.tag ? position.tag.split(',').map(t => t.trim()).filter(Boolean) : [];

            let prevShares: number = fund.initialUserPosition?.shares ?? 0;
            let prevTotalCost: number = (fund.initialUserPosition?.shares ?? 0) * (fund.initialUserPosition?.cost ?? 0);

            // Replay all transactions BEFORE the snapshot date to get the state at the start of the day.
            // For pending snapshot, we replay ALL confirmed transactions.
            const recordsBeforeDate = (position.tradingRecords)
                .filter(r => isPendingSnapshot ? r.nav !== undefined : new Date(r.date).getTime() < new Date(snapshotDate).getTime())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const record of recordsBeforeDate) {
                if (record.type === 'buy' || record.type === 'dividend-reinvest') {
                    prevShares += record.sharesChange ?? 0;
                    prevTotalCost += record.amount ?? 0;
                } else if (record.type === 'sell') { 
                    const costBasisPerShareBeforeSell = prevShares > 0 ? prevTotalCost / prevShares : 0;
                    prevTotalCost -= costBasisPerShareBeforeSell * Math.abs(record.sharesChange ?? 0);
                    prevShares += record.sharesChange ?? 0; // sharesChange is negative for sell
                    if ((prevShares as number) < 1e-6) {
                        prevShares = 0;
                        prevTotalCost = 0;
                    }
                }
                // dividend-cash does not change shares or cost basis (it only changes realized profit)
            }
            
            const prevAvgCost = prevShares > 0 ? prevTotalCost / prevShares : 0;

            recordsOnDate.forEach(record => {
                const latestNAV = latestNavMap.get(fund.code) ?? 0;
                
                // Group 'dividend-reinvest' with 'buy' (Inflow/Share Increase)
                if (record.type === 'buy' || record.type === 'dividend-reinvest') {
                    let sChange = record.sharesChange ?? 0;
                    let rAmount = record.amount ?? 0;
                    let rNav = record.nav ?? 0;

                    // Simulation logic for Pending Snapshot
                    if (isPendingSnapshot && record.nav === undefined) {
                        const val = record.value || 0;
                        const price = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
                        if (record.type === 'buy') {
                            rAmount = val;
                            sChange = price > 0 ? val / price : 0;
                            rNav = price;
                        } else if (record.type === 'dividend-reinvest') {
                            sChange = val; // value is shares
                            rNav = price;
                            // rAmount remains 0
                        }
                    }

                    const newTotalShares = prevShares + sChange;
                    const newTotalCost = prevTotalCost + rAmount;
                    const newAvgCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;

                    const costChange = newAvgCost - prevAvgCost;
                    const costChangePercent = prevAvgCost > 0 ? (costChange / prevAvgCost) * 100 : 0;
                    const sharesChangePercent = (prevShares as number) > 0 ? (sChange / (prevShares as number)) * 100 : 100;
                    const floatingProfit = latestNAV > 0 ? (latestNAV - rNav) * sChange : 0;
                    
                    // For Reinvest, amount is 0, so floatingProfitPercent would be Infinity/NaN if we divide by amount.
                    // Instead, calculate profit percent based on the value of shares obtained (rNav * sChange).
                    const tradeValue = rAmount > 0 ? rAmount : (rNav * sChange);
                    const floatingProfitPercent = tradeValue > 0 ? (floatingProfit / tradeValue) * 100 : 0;

                    totalBuyFloatingProfit += floatingProfit;
                    totalBuyAmount += rAmount;

                    detailedBuys.push({
                        fundCode: fund.code,
                        fundName: fund.name,
                        type: record.type,
                        tags,
                        costChange, costChangePercent,
                        sharesChange: sChange, sharesChangePercent,
                        floatingProfit, floatingProfitPercent,
                        amount: rAmount
                    });

                } else if (record.type === 'sell' || record.type === 'dividend-cash') { 
                    // Group 'dividend-cash' with 'sell' (Outflow/Payout)
                    let sChange = record.sharesChange ?? 0;
                    let rNav = record.nav ?? 0;
                    
                    // Determine amount for display (Cash Flow)
                    // For Sell: record.amount is negative (outflow of value from market).
                    // For Dividend: record.amount is 0, but we want to show realizedProfitChange as cash received.
                    let rAmount = record.amount ?? 0; 
                    if (record.type === 'dividend-cash') {
                        rAmount = -(record.realizedProfitChange ?? 0); 
                    }
                    
                    let realizedProfit = record.realizedProfitChange ?? 0;

                    // Simulation logic for Pending Snapshot
                    if (isPendingSnapshot && record.nav === undefined) {
                        const val = record.value || 0;
                        const price = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
                        
                        if (record.type === 'sell') {
                            sChange = -val; // value is shares
                            rNav = price;
                            const cashIn = val * price;
                            rAmount = -cashIn;
                            
                            // Calc estimated realized profit
                            realizedProfit = (price - prevAvgCost) * val;
                        } else if (record.type === 'dividend-cash') {
                            // value is cash amount
                            rNav = price; // Just as reference
                            realizedProfit = val;
                            rAmount = -val;
                        }
                    }

                    const sharesChangePercent = (prevShares as number) > 0 ? (sChange / (prevShares as number)) * 100 : 0;
                    const opportunityProfit = latestNAV > 0 ? (rNav - latestNAV) * Math.abs(sChange) : 0;
                    
                    // For opportunity profit percent: 
                    // Sell: based on price difference vs trade nav.
                    // Cash Div: sChange is 0, so opportunity profit is 0.
                    const opportunityProfitPercent = (record.type === 'sell' && rNav > 0) ? ((rNav - latestNAV) / rNav) * 100 : 0;
                        
                    const realizedProfitPercent = (record.type === 'sell' && prevAvgCost > 0) 
                        ? ((rNav - prevAvgCost) / prevAvgCost) * 100 
                        : 0; // For cash dividend, calculating a "yield" percent against cost basis is complex here, keeping it simple 0 for now.

                    totalSellOpportunityProfit += opportunityProfit;
                    totalSellRealizedProfit += realizedProfit;
                    totalSellAmount += Math.abs(rAmount);

                    detailedSells.push({
                        fundCode: fund.code,
                        fundName: fund.name,
                        type: record.type,
                        tags,
                        sharesChange: sChange, sharesChangePercent,
                        opportunityProfit, opportunityProfitPercent,
                        realizedProfit, realizedProfitPercent,
                        amount: Math.abs(rAmount)
                    });
                }
            });
        });

        // Calculate percentages and sort by amount descending
        // For Reinvest/CashDiv where amount might be 0, this sort might push them to bottom, which is fine.
        detailedBuys.forEach(r => {
            r.amountPercent = totalBuyAmount > 0 ? (r.amount / totalBuyAmount) * 100 : 0;
        });
        detailedBuys.sort((a, b) => b.amount - a.amount);

        detailedSells.forEach(r => {
            r.amountPercent = totalSellAmount > 0 ? (r.amount / totalSellAmount) * 100 : 0;
        });
        detailedSells.sort((a, b) => b.amount - a.amount);

        return { 
            detailedBuyRecords: detailedBuys,
            buyTotals: { floatingProfit: totalBuyFloatingProfit, amount: totalBuyAmount },
            detailedSellRecords: detailedSells,
            sellTotals: { opportunityProfit: totalSellOpportunityProfit, realizedProfit: totalSellRealizedProfit, amount: totalSellAmount },
            initialHoldings: [] 
        };

    }, [snapshot, funds]);
    
    const uniqueBuyTags = useMemo(() => {
        const tagSet = new Set<string>();
        detailedBuyRecords.forEach(r => r.tags?.forEach((t: string) => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [detailedBuyRecords]);

    const uniqueSellTags = useMemo(() => {
        const tagSet = new Set<string>();
        detailedSellRecords.forEach(r => r.tags?.forEach((t: string) => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [detailedSellRecords]);

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


    const renderBuyHeader = () => (
        <div className="flex flex-col">
            <h4 className="text-xl font-bold mb-1 text-red-600">买入 / 增持</h4>
            {uniqueBuyTags.length > 0 ? (
                <div className="flex flex-wrap gap-1 mb-3">
                    {uniqueBuyTags.map(tag => (
                        <TagBadge key={tag} tag={tag} onDoubleClick={handleTagAction} />
                    ))}
                </div>
            ) : (
                <div className="mb-3"></div>
            )}
        </div>
    );

    const renderSellHeader = () => (
        <div className="flex flex-col">
            <h4 className="text-xl font-bold mb-1 text-blue-600">卖出 / 分红</h4>
            {uniqueSellTags.length > 0 ? (
                <div className="flex flex-wrap gap-1 mb-3">
                    {uniqueSellTags.map(tag => (
                        <TagBadge key={tag} tag={tag} onDoubleClick={handleTagAction} />
                    ))}
                </div>
            ) : (
                <div className="mb-3"></div>
            )}
        </div>
    );

    const renderBuyTable = () => (
        <div className="overflow-x-auto h-full">
            <table className="w-full text-sm text-left h-full">
                <thead className="bg-gray-200 dark:bg-gray-700 h-fit">
                    <tr>
                        <th className="p-2 whitespace-nowrap">基金名称</th>
                        <th className="p-2 text-right whitespace-nowrap">份额变化</th>
                        <th className="p-2 text-right whitespace-nowrap">成本变化</th>
                        <th className="p-2 text-right whitespace-nowrap">{snapshot.snapshotDate === '待成交' ? '预估浮盈' : '浮盈'}</th>
                        <th className="p-2 text-right whitespace-nowrap">买入</th>
                    </tr>
                </thead>
                <tbody>
                    {detailedBuyRecords.map((record, index) => (
                        <tr key={`buy-${index}`} className="border-b dark:border-gray-700 h-fit">
                            <td className="p-2">
                                <FundNameDisplay name={record.fundName} code={record.fundCode} />
                                <TypeBadge type={record.type} />
                                {record.tags && record.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                        {record.tags.map((tag: string) => (
                                            <TagBadge key={tag} tag={tag} onDoubleClick={handleTagAction} />
                                        ))}
                                    </div>
                                )}
                            </td>
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
                            <td className="p-2 text-right font-mono">
                                <div>{record.amount.toFixed(2)}</div>
                                <div className="text-gray-500 dark:text-gray-400 text-xs">{record.amountPercent.toFixed(1)}%</div>
                            </td>
                        </tr>
                    ))}
                    {/* Spacer Row to push Footer down */}
                    <tr className="border-none bg-transparent">
                        <td colSpan={5} className="p-0 border-none h-full"></td>
                    </tr>
                </tbody>
                <tfoot className="h-fit">
                    <tr className="border-t dark:border-gray-600 font-bold">
                        <td className="p-2 text-left" colSpan={3}>汇总</td>
                        <td className="p-2 text-right font-mono">
                            <div className={getProfitColor(buyTotals.floatingProfit)}>{buyTotals.floatingProfit.toFixed(2)}</div>
                            <div className={`${getProfitColor(buyTotals.floatingProfit)} text-xs font-normal`}>
                                {buyTotals.amount > 0 
                                    ? `${((buyTotals.floatingProfit / buyTotals.amount) * 100) > 0 ? '+' : ''}${((buyTotals.floatingProfit / buyTotals.amount) * 100).toFixed(2)}%`
                                    : '0.00%'
                                }
                            </div>
                        </td>
                        <td className="p-2 text-right font-mono">{buyTotals.amount.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    const renderSellTable = () => (
        <div className="overflow-x-auto h-full">
            <table className="w-full text-sm text-left h-full">
                <thead className="bg-gray-200 dark:bg-gray-700 h-fit">
                    <tr>
                        <th className="p-2 whitespace-nowrap">基金名称</th>
                        <th className="p-2 text-right whitespace-nowrap">份额变化</th>
                        <th className="p-2 text-right whitespace-nowrap">{snapshot.snapshotDate === '待成交' ? '预估机会收益' : '机会收益'}</th>
                        <th className="p-2 text-right whitespace-nowrap">{snapshot.snapshotDate === '待成交' ? '预估落袋' : '落袋'}</th>
                        <th className="p-2 text-right whitespace-nowrap">到账</th>
                    </tr>
                </thead>
                <tbody>
                    {detailedSellRecords.map((record, index) => (
                        <tr key={`sell-${index}`} className="border-b dark:border-gray-700 h-fit">
                            <td className="p-2">
                                <FundNameDisplay name={record.fundName} code={record.fundCode} />
                                <TypeBadge type={record.type} />
                                {record.tags && record.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                        {record.tags.map((tag: string) => (
                                            <TagBadge key={tag} tag={tag} onDoubleClick={handleTagAction} />
                                        ))}
                                    </div>
                                )}
                            </td>
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
                            <td className="p-2 text-right font-mono">
                                <div>{record.amount.toFixed(2)}</div>
                                <div className="text-gray-500 dark:text-gray-400 text-xs">{record.amountPercent.toFixed(1)}%</div>
                            </td>
                        </tr>
                    ))}
                    {/* Spacer Row to push Footer down */}
                    <tr className="border-none bg-transparent">
                        <td colSpan={5} className="p-0 border-none h-full"></td>
                    </tr>
                </tbody>
                <tfoot className="h-fit">
                    <tr className="border-t dark:border-gray-600 font-bold">
                        <td className="p-2 text-left" colSpan={2}>汇总</td>
                        <td className="p-2 text-right font-mono">
                            <div className={getProfitColor(sellTotals.opportunityProfit)}>{`${sellTotals.opportunityProfit > 0 ? '+' : ''}${sellTotals.opportunityProfit.toFixed(2)}`}</div>
                            <div className={`${getProfitColor(sellTotals.opportunityProfit)} text-xs font-normal`}>
                                {sellTotals.amount > 0 
                                    ? `${((sellTotals.opportunityProfit / sellTotals.amount) * 100) > 0 ? '+' : ''}${((sellTotals.opportunityProfit / sellTotals.amount) * 100).toFixed(2)}%`
                                    : '0.00%'
                                }
                            </div>
                        </td>
                        <td className="p-2 text-right font-mono">
                            <div className={getProfitColor(sellTotals.realizedProfit)}>{sellTotals.realizedProfit.toFixed(2)}</div>
                            <div className={`${getProfitColor(sellTotals.realizedProfit)} text-xs font-normal`}>
                                {sellTotals.amount > 0 
                                    ? `${((sellTotals.realizedProfit / sellTotals.amount) * 100) > 0 ? '+' : ''}${((sellTotals.realizedProfit / sellTotals.amount) * 100).toFixed(2)}%`
                                    : '0.00%'
                                }
                            </div>
                        </td>
                        <td className="p-2 text-right font-mono">{sellTotals.amount.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    const renderTransactionTables = () => {
        if (hasOnlyOneType) {
             return (
                 <div className="mx-auto w-full max-w-xl flex flex-col h-full">
                     {hasBuys ? renderBuyHeader() : renderSellHeader()}
                     <div className="flex-1 mt-0">
                         {hasBuys ? renderBuyTable() : renderSellTable()}
                     </div>
                 </div>
             )
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-[auto_1fr] gap-x-6 gap-y-0 h-full">
                {/* Buy Header - Order 1 on mobile, Col 1 Row 1 on desktop */}
                <div className="order-1 md:order-none md:col-start-1 md:row-start-1">
                    {renderBuyHeader()}
                </div>
                
                {/* Buy Table - Order 2 on mobile, Col 1 Row 2 on desktop */}
                <div className="order-2 md:order-none md:col-start-1 md:row-start-2 overflow-x-auto h-full mb-6 md:mb-0">
                     {renderBuyTable()}
                </div>

                {/* Sell Header - Order 3 on mobile, Col 2 Row 1 on desktop */}
                <div className="order-3 md:order-none md:col-start-2 md:row-start-1">
                    {renderSellHeader()}
                </div>

                {/* Sell Table - Order 4 on mobile, Col 2 Row 2 on desktop */}
                <div className="order-4 md:order-none md:col-start-2 md:row-start-2 overflow-x-auto h-full">
                    {renderSellTable()}
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

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
                                <th className="p-2 text-right">落袋收益</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialHoldings.map((h, index) => (
                                <tr key={`${h.name}-${index}`} className="border-b dark:border-gray-700">
                                    <td className="p-2">
                                        <FundNameDisplay name={h.name} code={h.fundCode} />
                                        {h.tags && h.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {h.tags.map((tag: string) => (
                                                    <TagBadge key={tag} tag={tag} onDoubleClick={handleTagAction} />
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-2 text-right font-mono">{h.shares.toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono">{h.cost.toFixed(4)}</td>
                                    <td className="p-2 text-right font-mono">{h.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className={`p-2 text-right font-mono ${getProfitColor(h.realizedProfit)}`}>{h.realizedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const headerTitle = snapshot.snapshotDate === '待成交' ? '待成交任务明细' : `操作明细: ${snapshot.snapshotDate}`;

    return createPortal(
        <div
            className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[100] flex justify-center items-center transition-opacity"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            aria-modal="true"
            role="dialog"
        >
            <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg shadow-xl w-full ${modalMaxWidthClass} m-4 transform transition-all flex flex-col max-h-[90vh]`}>
                <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700 bg-white dark:bg-gray-900 rounded-t-lg flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-baseline flex-wrap">
                        <span>{headerTitle}</span>
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

                <div className="p-6 overflow-y-auto flex-1">
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
        </div>,
        document.body
    );
};

export default SnapshotDetailModal;
