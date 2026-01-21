import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PortfolioSnapshot, ProcessedFund, TradingRecord, TransactionType, TagSortOrder } from '../types';

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
        return <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 ml-1">现金分红</span>;
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
    const [buySortKey, setBuySortKey] = useState<string>('amount');
    const [buySortOrder, setBuySortOrder] = useState<TagSortOrder>('desc');
    const [sellSortKey, setSellSortKey] = useState<string>('amount');
    const [sellSortOrder, setSellSortOrder] = useState<TagSortOrder>('desc');

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

    const sortRecords = (records: any[], key: string, order: TagSortOrder) => {
        return [...records].sort((a, b) => {
            const valA = a[key] ?? 0;
            const valB = b[key] ?? 0;
            if (order === 'asc') return valA - valB;
            if (order === 'desc') return valB - valA;
            if (order === 'abs_asc') return Math.abs(valA) - Math.abs(valB);
            if (order === 'abs_desc') return Math.abs(valB) - Math.abs(valA);
            return 0;
        });
    };

    const handleBuySortChange = useCallback((key: string) => {
        if (buySortKey === key) {
            setBuySortOrder(prev => (prev === 'desc' ? 'asc' : prev === 'asc' ? 'abs_asc' : prev === 'abs_asc' ? 'abs_desc' : 'desc'));
        } else {
            setBuySortKey(key);
            setBuySortOrder('desc');
        }
    }, [buySortKey]);

    const handleSellSortChange = useCallback((key: string) => {
        if (sellSortKey === key) {
            setSellSortOrder(prev => (prev === 'desc' ? 'asc' : prev === 'asc' ? 'abs_asc' : prev === 'abs_asc' ? 'abs_desc' : 'desc'));
        } else {
            setSellSortKey(key);
            setSellSortOrder('desc');
        }
    }, [sellSortKey]);

    const getSortIndicator = (key: string, currentKey: string, currentOrder: TagSortOrder) => {
        if (key !== currentKey) return null;
        if (currentOrder === 'desc') return '▼';
        if (currentOrder === 'asc') return '▲';
        if (currentOrder === 'abs_desc') return '|▼|';
        if (currentOrder === 'abs_asc') return '|▲|';
        return null;
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
                buyTotals: { floatingProfit: 0, amount: 0, profitCaused: 0 }, 
                detailedSellRecords: [],
                sellTotals: { opportunityProfit: 0, realizedProfit: 0, amount: 0, profitCaused: 0 },
                initialHoldings: holdings 
            };
        }

        const snapshotDate = snapshot.snapshotDate;
        const isPendingSnapshot = snapshotDate === '待成交';
        const latestNavMap = new Map(funds.map(f => [f.code, f.baseChartData[f.baseChartData.length - 1]?.unitNAV ?? 0]));
        const yesterdayNavMap = new Map(funds.map(f => [f.code, f.baseChartData.length > 1 ? (f.baseChartData[f.baseChartData.length - 2]?.unitNAV ?? 0) : 0]));

        const detailedBuys: any[] = [];
        const detailedSells: any[] = [];
        
        let totalBuyFloatingProfit = 0;
        let totalBuyAmount = 0;
        let totalBuyProfitCaused = 0;
        let totalSellOpportunityProfit = 0;
        let totalSellRealizedProfit = 0;
        let totalSellAmount = 0;
        let totalSellProfitCaused = 0;

        funds.forEach(fund => {
            const position = fund.userPosition;
            if (!position?.tradingRecords) return;

            const recordsOnDate = isPendingSnapshot
                ? position.tradingRecords.filter(r => r.nav === undefined)
                : position.tradingRecords.filter(r => r.date === snapshotDate);
            
            if (recordsOnDate.length === 0) return;

            const tags = position.tag ? position.tag.split(',').map(t => t.trim()).filter(Boolean) : [];

            let prevShares: number = fund.initialUserPosition?.shares ?? 0;
            let prevTotalCost: number = (fund.initialUserPosition?.shares ?? 0) * (fund.initialUserPosition?.cost ?? 0);

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
                    prevShares += record.sharesChange ?? 0;
                    if (prevShares < 1e-6) {
                        prevShares = 0;
                        prevTotalCost = 0;
                    }
                }
            }
            
            const prevAvgCost = prevShares > 0 ? prevTotalCost / prevShares : 0;

            recordsOnDate.forEach(record => {
                const latestNAV = latestNavMap.get(fund.code) ?? 0;
                const yesterdayNAV = yesterdayNavMap.get(fund.code) ?? 0;
                const dailyProfitPerShare = (latestNAV > 0 && yesterdayNAV > 0) ? (latestNAV - yesterdayNAV) : 0;
                
                if (record.type === 'buy' || record.type === 'dividend-reinvest') {
                    let sChange: number = record.sharesChange ?? 0;
                    let rAmount: number = record.amount ?? 0;
                    let rNav: number = record.nav ?? 0;

                    if (isPendingSnapshot && record.nav === undefined) {
                        const val = record.value || 0;
                        const price = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
                        if (record.type === 'buy') {
                            rAmount = val;
                            sChange = price > 0 ? val / price : 0;
                            rNav = price;
                        } else if (record.type === 'dividend-reinvest') {
                            sChange = val;
                            rNav = price;
                        }
                    }

                    const newTotalShares = prevShares + sChange;
                    const newTotalCost = prevTotalCost + rAmount;
                    const newAvgCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;

                    const costChange = newAvgCost - prevAvgCost;
                    const costChangePercent = prevAvgCost > 0 ? (costChange / prevAvgCost) * 100 : 0;
                    const sharesChangePercent = prevShares > 0 ? (sChange / prevShares) * 100 : 100;
                    const floatingProfit = latestNAV > 0 ? (latestNAV - rNav) * sChange : 0;
                    const profitCaused = dailyProfitPerShare * sChange;
                    
                    const tradeValue = rAmount > 0 ? rAmount : (rNav * sChange);
                    const floatingProfitPercent = tradeValue > 0 ? (floatingProfit / tradeValue) * 100 : 0;
                    const profitCausedPercent = tradeValue > 0 ? (profitCaused / tradeValue) * 100 : 0;

                    totalBuyFloatingProfit += floatingProfit;
                    totalBuyAmount += rAmount;
                    totalBuyProfitCaused += profitCaused;

                    detailedBuys.push({
                        fundCode: fund.code,
                        fundName: fund.name,
                        type: record.type,
                        tags,
                        costChange, costChangePercent,
                        sharesChange: sChange, sharesChangePercent,
                        floatingProfit, floatingProfitPercent,
                        profitCaused, profitCausedPercent,
                        amount: rAmount
                    });

                } else if (record.type === 'sell' || record.type === 'dividend-cash') { 
                    let sChange: number = record.sharesChange ?? 0;
                    let rNav: number = record.nav ?? 0;
                    let rAmount: number = record.amount ?? 0; 
                    if (record.type === 'dividend-cash') {
                        rAmount = -(record.realizedProfitChange ?? 0); 
                    }
                    
                    let realizedProfit: number = record.realizedProfitChange ?? 0;

                    if (isPendingSnapshot && record.nav === undefined) {
                        const val = record.value || 0;
                        const price = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
                        
                        if (record.type === 'sell') {
                            sChange = -val;
                            rNav = price;
                            const cashIn = val * price;
                            rAmount = -cashIn;
                            realizedProfit = (price - prevAvgCost) * val;
                        } else if (record.type === 'dividend-cash') {
                            rNav = price;
                            realizedProfit = val;
                            rAmount = -val;
                        }
                    }

                    const sharesChangePercent = prevShares > 0 ? (sChange / prevShares) * 100 : 0;
                    const opportunityProfit = latestNAV > 0 ? (rNav - latestNAV) * Math.abs(sChange) : 0;
                    const profitCaused = dailyProfitPerShare * sChange;
                    
                    const opportunityProfitPercent = (record.type === 'sell' && rNav > 0) ? ((rNav - latestNAV) / rNav) * 100 : 0;
                    const profitCausedPercent = Math.abs(rAmount) > 0 ? (profitCaused / Math.abs(rAmount)) * 100 : 0;
                        
                    const realizedProfitPercent = (record.type === 'sell' && prevAvgCost > 0) 
                        ? ((rNav - prevAvgCost) / prevAvgCost) * 100 
                        : 0;

                    totalSellOpportunityProfit += opportunityProfit;
                    totalSellRealizedProfit += realizedProfit;
                    totalSellAmount += Math.abs(rAmount);
                    totalSellProfitCaused += profitCaused;

                    detailedSells.push({
                        fundCode: fund.code,
                        fundName: fund.name,
                        type: record.type,
                        tags,
                        sharesChange: sChange, sharesChangePercent,
                        opportunityProfit, opportunityProfitPercent,
                        realizedProfit, realizedProfitPercent,
                        profitCaused, profitCausedPercent,
                        amount: Math.abs(rAmount)
                    });
                }
            });
        });

        detailedBuys.forEach(r => {
            r.amountPercent = totalBuyAmount > 0 ? (r.amount / totalBuyAmount) * 100 : 0;
        });
        const sortedBuys = sortRecords(detailedBuys, buySortKey, buySortOrder);

        detailedSells.forEach(r => {
            r.amountPercent = totalSellAmount > 0 ? (r.amount / totalSellAmount) * 100 : 0;
        });
        const sortedSells = sortRecords(detailedSells, sellSortKey, sellSortOrder);

        return { 
            detailedBuyRecords: sortedBuys,
            buyTotals: { floatingProfit: totalBuyFloatingProfit, amount: totalBuyAmount, profitCaused: totalBuyProfitCaused },
            detailedSellRecords: sortedSells,
            sellTotals: { opportunityProfit: totalSellOpportunityProfit, realizedProfit: totalSellRealizedProfit, amount: totalSellAmount, profitCaused: totalSellProfitCaused },
            initialHoldings: [] 
        };

    }, [snapshot, funds, buySortKey, buySortOrder, sellSortKey, sellSortOrder]);
    
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
    const modalMaxWidthClass = hasOnlyOneType ? 'max-w-2xl' : 'max-w-7xl';


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
        <div className="">
            <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-gray-200 dark:bg-gray-700 h-fit select-none sticky top-0 z-20">
                    <tr>
                        <th className="p-1 border dark:border-gray-600 whitespace-nowrap bg-gray-200 dark:bg-gray-700">
                            <div>基金名称</div>
                            <div className="font-mono font-normal text-gray-500">汇总</div>
                        </th>
                        <th className="p-1 text-right border dark:border-gray-600 whitespace-nowrap bg-gray-200 dark:bg-gray-700">
                            <div>份额变化</div>
                            <div className="font-mono font-normal text-gray-400">-</div>
                        </th>
                        <th className="p-1 text-right border dark:border-gray-600 whitespace-nowrap bg-gray-200 dark:bg-gray-700">
                            <div>成本变化</div>
                            <div className="font-mono font-normal text-gray-400">-</div>
                        </th>
                        <th 
                            className="p-1 text-right border dark:border-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 bg-gray-200 dark:bg-gray-700"
                            onClick={() => handleBuySortChange('profitCaused')}
                        >
                            <div>{getSortIndicator('profitCaused', buySortKey, buySortOrder)} 造成今日盈亏</div>
                            <div className={`font-mono font-normal ${getProfitColor(buyTotals.profitCaused)}`}>
                                {buyTotals.profitCaused >= 0 ? '+' : ''}{buyTotals.profitCaused.toFixed(2)}|{buyTotals.amount > 0 ? `${((buyTotals.profitCaused / buyTotals.amount) * 100) > 0 ? '+' : ''}${((buyTotals.profitCaused / buyTotals.amount) * 100).toFixed(2)}%` : '0.00%'}
                            </div>
                        </th>
                        <th 
                            className="p-1 text-right border dark:border-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 bg-gray-200 dark:bg-gray-700"
                            onClick={() => handleBuySortChange('floatingProfit')}
                        >
                            <div>{getSortIndicator('floatingProfit', buySortKey, buySortOrder)} {snapshot.snapshotDate === '待成交' ? '预估浮盈' : '浮盈'}</div>
                            <div className={`font-mono font-normal ${getProfitColor(buyTotals.floatingProfit)}`}>
                                {buyTotals.floatingProfit.toFixed(2)}|{buyTotals.amount > 0 ? `${((buyTotals.floatingProfit / buyTotals.amount) * 100) > 0 ? '+' : ''}${((buyTotals.floatingProfit / buyTotals.amount) * 100).toFixed(2)}%` : '0.00%'}
                            </div>
                        </th>
                        <th 
                            className="p-1 text-right border dark:border-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 bg-gray-200 dark:bg-gray-700"
                            onClick={() => handleBuySortChange('amount')}
                        >
                            <div>{getSortIndicator('amount', buySortKey, buySortOrder)} 买入</div>
                            <div className="font-mono font-normal text-gray-500">{buyTotals.amount.toFixed(2)}</div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {detailedBuyRecords.map((record, index) => (
                        <tr key={`buy-${index}`} className="border-b dark:border-gray-700 h-fit hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="p-1">
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
                            <td className="p-1 text-right font-mono">
                                <div className={getProfitColor(1)}>+{record.sharesChange.toFixed(2)}</div>
                                <div className={`${getProfitColor(1)} opacity-70`}>+{record.sharesChangePercent.toFixed(2)}%</div>
                            </td>
                            <td className="p-1 text-right font-mono text-gray-500">
                                <div className={getProfitColor(record.costChange * -1)}>{record.costChange.toFixed(4)}</div>
                                <div className={`opacity-70`}>{`${record.costChangePercent > 0 ? '+' : ''}${record.costChangePercent.toFixed(2)}%`}</div>
                            </td>
                            <td className="p-1 text-right font-mono">
                                <div className={getProfitColor(record.profitCaused)}>{record.profitCaused >= 0 ? '+' : ''}{record.profitCaused.toFixed(2)}</div>
                                <div className={`${getProfitColor(record.profitCaused)} opacity-70`}>{`${record.profitCausedPercent >= 0 ? '+' : ''}${record.profitCausedPercent.toFixed(2)}%`}</div>
                            </td>
                            <td className="p-1 text-right font-mono">
                                <div className={getProfitColor(record.floatingProfit)}>{record.floatingProfit.toFixed(2)}</div>
                                <div className={`${getProfitColor(record.floatingProfit)} opacity-70`}>{`${record.floatingProfitPercent > 0 ? '+' : ''}${record.floatingProfitPercent.toFixed(2)}%`}</div>
                            </td>
                            <td className="p-1 text-right font-mono">
                                <div>{record.amount.toFixed(2)}</div>
                                <div className="text-gray-500 dark:text-gray-400 opacity-70">{record.amountPercent.toFixed(1)}%</div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderSellTable = () => (
        <div className="">
            <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-gray-200 dark:bg-gray-700 h-fit select-none sticky top-0 z-20">
                    <tr>
                        <th className="p-1 border dark:border-gray-600 whitespace-nowrap bg-gray-200 dark:bg-gray-700">
                            <div>基金名称</div>
                            <div className="font-mono font-normal text-gray-500">汇总</div>
                        </th>
                        <th className="p-1 text-right border dark:border-gray-600 whitespace-nowrap bg-gray-200 dark:bg-gray-700">
                            <div>份额变化</div>
                            <div className="font-mono font-normal text-gray-400">-</div>
                        </th>
                        <th 
                            className="p-1 text-right border dark:border-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 bg-gray-200 dark:bg-gray-700"
                            onClick={() => handleSellSortChange('profitCaused')}
                        >
                            <div>{getSortIndicator('profitCaused', sellSortKey, sellSortOrder)} 造成今日盈亏</div>
                            <div className={`font-mono font-normal ${getProfitColor(sellTotals.profitCaused)}`}>
                                {sellTotals.profitCaused >= 0 ? '+' : ''}{sellTotals.profitCaused.toFixed(2)}|{sellTotals.amount > 0 ? `${((sellTotals.profitCaused / sellTotals.amount) * 100) > 0 ? '+' : ''}${((sellTotals.profitCaused / sellTotals.amount) * 100).toFixed(2)}%` : '0.00%'}
                            </div>
                        </th>
                        <th 
                            className="p-1 text-right border dark:border-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 bg-gray-200 dark:bg-gray-700"
                            onClick={() => handleSellSortChange('opportunityProfit')}
                        >
                            <div>{getSortIndicator('opportunityProfit', sellSortKey, sellSortOrder)} {snapshot.snapshotDate === '待成交' ? '预估机会收益' : '机会收益'}</div>
                            <div className={`font-mono font-normal ${getProfitColor(sellTotals.opportunityProfit)}`}>
                                {sellTotals.opportunityProfit.toFixed(2)}|{sellTotals.amount > 0 ? `${((sellTotals.opportunityProfit / sellTotals.amount) * 100) > 0 ? '+' : ''}${((sellTotals.opportunityProfit / sellTotals.amount) * 100).toFixed(2)}%` : '0.00%'}
                            </div>
                        </th>
                        <th 
                            className="p-1 text-right border dark:border-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 bg-gray-200 dark:bg-gray-700"
                            onClick={() => handleSellSortChange('realizedProfit')}
                        >
                            <div>{getSortIndicator('realizedProfit', sellSortKey, sellSortOrder)} {snapshot.snapshotDate === '待成交' ? '预估落袋' : '落袋'}</div>
                            <div className={`font-mono font-normal ${getProfitColor(sellTotals.realizedProfit)}`}>
                                {sellTotals.realizedProfit.toFixed(2)}|{sellTotals.amount > 0 ? `${((sellTotals.realizedProfit / sellTotals.amount) * 100) > 0 ? '+' : ''}${((sellTotals.realizedProfit / sellTotals.amount) * 100).toFixed(2)}%` : '0.00%'}
                            </div>
                        </th>
                        <th 
                            className="p-1 text-right border dark:border-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 bg-gray-200 dark:bg-gray-700"
                            onClick={() => handleSellSortChange('amount')}
                        >
                            <div>{getSortIndicator('amount', sellSortKey, sellSortOrder)} 到账</div>
                            <div className="font-mono font-normal text-gray-500">{sellTotals.amount.toFixed(2)}</div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {detailedSellRecords.map((record, index) => (
                        <tr key={`sell-${index}`} className="border-b dark:border-gray-700 h-fit hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="p-1">
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
                            <td className="p-1 text-right font-mono">
                                <div className={getProfitColor(record.sharesChange)}>{record.sharesChange.toFixed(2)}</div>
                                <div className={`${getProfitColor(record.sharesChange)} opacity-70`}>{record.sharesChangePercent.toFixed(2)}%</div>
                            </td>
                            <td className="p-1 text-right font-mono">
                                <div className={getProfitColor(record.profitCaused)}>{record.profitCaused >= 0 ? '+' : ''}{record.profitCaused.toFixed(2)}</div>
                                <div className={`${getProfitColor(record.profitCaused)} opacity-70`}>{`${record.profitCausedPercent >= 0 ? '+' : ''}${record.profitCausedPercent.toFixed(2)}%`}</div>
                            </td>
                            <td className="p-1 text-right font-mono">
                                <div className={getProfitColor(record.opportunityProfit)}>{`${record.opportunityProfit > 0 ? '+' : ''}${record.opportunityProfit.toFixed(2)}`}</div>
                                <div className={`${getProfitColor(record.opportunityProfit)} opacity-70`}>{`${record.opportunityProfitPercent > 0 ? '+' : ''}${record.opportunityProfitPercent.toFixed(2)}%`}</div>
                            </td>
                            <td className="p-1 text-right font-mono">
                                <div className={getProfitColor(record.realizedProfit)}>{record.realizedProfit.toFixed(2)}</div>
                                <div className={`${[getProfitColor(record.realizedProfit)]} opacity-70`}>{`${record.realizedProfitPercent > 0 ? '+' : ''}${record.realizedProfitPercent.toFixed(2)}%`}</div>
                            </td>
                            <td className="p-1 text-right font-mono">
                                <div>{record.amount.toFixed(2)}</div>
                                <div className="text-gray-500 dark:text-gray-400 opacity-70">{record.amountPercent.toFixed(1)}%</div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderTransactionTables = () => {
        if (hasOnlyOneType) {
             return (
                 <div className="mx-auto w-full max-w-2xl flex flex-col items-start px-6">
                     {hasBuys ? renderBuyHeader() : renderSellHeader()}
                     <div className="w-full">
                         {hasBuys ? renderBuyTable() : renderSellTable()}
                     </div>
                 </div>
             )
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0 items-start px-6">
                <div className="flex flex-col">
                    {renderBuyHeader()}
                    {renderBuyTable()}
                </div>
                
                <div className="flex flex-col mt-6 md:mt-0">
                    {renderSellHeader()}
                    {renderSellTable()}
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    const renderInitialHoldingsTable = () => (
        <div className="flex justify-center p-6">
            <div className="w-full max-w-3xl">
                <h4 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    初始持仓
                </h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                            <tr>
                                <th className="p-2 border dark:border-gray-600">基金名称</th>
                                <th className="p-2 text-right border dark:border-gray-600">初始份额</th>
                                <th className="p-2 text-right border dark:border-gray-600">初始成本</th>
                                <th className="p-2 text-right border dark:border-gray-600">初始总成本</th>
                                <th className="p-2 text-right border dark:border-gray-600">落袋收益</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialHoldings.map((h, index) => (
                                <tr key={`${h.name}-${index}`} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40">
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

                <div className="overflow-y-auto flex-1 pt-0">
                    {snapshot.snapshotDate === '基准持仓' ? (
                        initialHoldings.length > 0 ? renderInitialHoldingsTable() : <p className="p-6 text-center text-gray-500 dark:text-gray-400">无初始持仓记录。</p>
                    ) : (
                        (hasBuys || hasSells) ? (
                            <div className="pt-6">{renderTransactionTables()}</div>
                        ) : (
                            <p className="p-6 text-center text-gray-500 dark:text-gray-400">该日期无交易记录。</p>
                        )
                    )}
                </div>

            </div>
        </div>,
        document.body
    );
};

export default SnapshotDetailModal;