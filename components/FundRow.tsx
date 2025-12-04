
import React, { useMemo, useState, useCallback } from 'react';
// FIX: Import the shared ProcessedFund interface.
import { Fund, FundDataPoint, ProcessedFund, TradingRecord, TransactionType, SortByType } from '../types';
import FundChart from './FundChart';

interface FundRowProps {
  fund: ProcessedFund;
  dateHeaders: string[];
  onShowDetails: (fund: Fund) => void;
  onTagDoubleClick: (tag: string) => void;
  onTrade: (fund: ProcessedFund, date: string, type: TransactionType, nav: number, isConfirmed: boolean, editingRecord?: TradingRecord) => void;
  activeSort: SortByType;
  totalPortfolioValue?: number;
  marketValueRank?: number;
}

const SYSTEM_TAG_COLORS: { [key: string]: { bg: string; text: string; } } = {
  '持有': { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300' },
  '自选': { bg: 'bg-gray-200 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300' },
  '盈利': { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
  '亏损': { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
  '推荐操作': { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-800 dark:text-purple-300' },
};

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
  // A simple hashing function to get a deterministic color for each tag
  let hash = 0;
  if (tag.length === 0) return COLORS[6];
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; 
  }
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
};

const TradeLinks: React.FC<{ onTradeClick: (type: 'buy' | 'sell') => void }> = ({ onTradeClick }) => (
    <div className="text-xs mt-1 space-x-2">
        <button onClick={() => onTradeClick('buy')} className="font-semibold text-red-600 dark:text-red-400 hover:underline">买</button>
        <button onClick={() => onTradeClick('sell')} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">卖</button>
    </div>
);

const RecordLink: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="text-xs mt-1">
        <button onClick={onClick} className="font-semibold text-gray-500 dark:text-gray-400 hover:underline">记录</button>
    </div>
);

const FundRow: React.FC<FundRowProps> = ({ fund, dateHeaders, onShowDetails, onTagDoubleClick, onTrade, activeSort, totalPortfolioValue = 0, marketValueRank = 0 }) => {
  const [isCopied, setIsCopied] = useState(false);
  const { trendInfo, baseChartData, zigzagPoints, lastPivotDate, navPercentile } = fund;

  const dataMap = useMemo(() => {
    return new Map<string, FundDataPoint>(fund.data.map(p => [p.date, p]));
  }, [fund.data]);

  const confirmedRecordMap = useMemo(() => {
    return new Map<string, TradingRecord>(
      (fund.userPosition?.tradingRecords || [])
        .filter(r => r.nav !== undefined)
        .map(r => [r.date, r])
    );
  }, [fund.userPosition?.tradingRecords]);

  const pendingRecordMap = useMemo(() => {
    return new Map<string, TradingRecord>(
      (fund.userPosition?.tradingRecords || [])
        .filter(r => r.nav === undefined)
        .map(r => [r.date, r])
    );
  }, [fund.userPosition?.tradingRecords]);


  const historicalDataForToday = useMemo(() => {
    if (!fund.realTimeData) return undefined;
    const realTimeDate = fund.realTimeData.estimationTime.split(' ')[0];
    return dataMap.get(realTimeDate);
  }, [dataMap, fund.realTimeData]);

  const pivotDateSet = useMemo(() => {
    return new Set(zigzagPoints.map(p => p.date));
  }, [zigzagPoints]);

  const latestNAVForComparison = useMemo(() => {
    return fund.baseChartData.length > 0 ? fund.baseChartData[fund.baseChartData.length - 1].unitNAV ?? 0 : 0;
  }, [fund.baseChartData]);

  const systemTags = useMemo(() => {
      const tags: string[] = [];
      const position = fund.userPosition;
      const holdingProfit = fund.holdingProfit ?? 0;

      if (position && position.shares > 0) {
          tags.push('持有');
          if (holdingProfit > 0) {
              tags.push('盈利');
          } else if (holdingProfit < 0) {
              tags.push('亏损');
          }
      } else {
          tags.push('自选');
      }
      return tags;
  }, [fund.userPosition, fund.holdingProfit]);

  const handleCopyCode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the row's onDoubleClick
    navigator.clipboard.writeText(fund.code).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1000);
    }).catch(err => {
        console.error('Failed to copy fund code: ', err);
    });
  }, [fund.code]);

  const isTrendSignificant = useMemo(() => {
    if (!fund.trendInfo) return false;
    const change = fund.trendInfo.change;
    // Highlight if:
    // 1. Drop is significant (less than -4.5%)
    // 2. Mild increase (between 0% and 4.5%)
    return (change < -4.5) || (change > 0 && change < 4.5);
  }, [fund.trendInfo]);
  
  const handleTodayTrade = (type: 'buy' | 'sell') => {
      if (historicalDataForToday) { // Confirmed
          const tradeDate = historicalDataForToday.date;
          const nav = historicalDataForToday.unitNAV;
          onTrade(fund, tradeDate, type, nav, true);
      } else if (fund.realTimeData && fund.realTimeData.estimatedNAV > 0) { // Estimated
          const tradeDate = fund.realTimeData.estimationTime.split(' ')[0];
          const nav = fund.realTimeData.estimatedNAV;
          onTrade(fund, tradeDate, type, nav, false);
      }
  };

  const handleEditTrade = (record: TradingRecord) => {
      onTrade(fund, record.date, record.type, record.nav!, true, record);
  };
  
  const handleEditPendingTrade = (record: TradingRecord) => {
    const navForModal = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
    onTrade(fund, record.date, record.type, navForModal, false, record);
  };

  const todayDateStr = historicalDataForToday?.date || fund.realTimeData?.estimationTime.split(' ')[0];
  const todayRecord = todayDateStr ? confirmedRecordMap.get(todayDateStr) : undefined;
  const todayPendingRecord = todayDateStr ? pendingRecordMap.get(todayDateStr) : undefined;
  const todayTransaction = todayRecord || todayPendingRecord;

  const dailyChangeDisplay = useMemo(() => {
    if (fund.realTimeData?.estimatedChange) {
        const value = parseFloat(fund.realTimeData.estimatedChange);
        if (isNaN(value)) return null;
        const isPositive = value >= 0;
        return {
            text: `今日${isPositive ? '⬆︎' : '⬇︎'} ${Math.abs(value).toFixed(2)}%`,
            colorClass: isPositive ? 'text-red-500' : 'text-green-600',
        };
    }
    if (fund.latestChange) {
        const isPositive = !fund.latestChange.startsWith('-');
        const valueText = fund.latestChange.replace(/^[+-]/, ''); // e.g. "1.23%"
        return {
            text: `今日${isPositive ? '⬆︎' : '⬇︎'} ${valueText}`,
            colorClass: isPositive ? 'text-red-500' : 'text-green-600',
        };
    }
    return null;
  }, [fund.realTimeData, fund.latestChange]);

  const lastTransactionInfo = useMemo(() => {
    const records = fund.userPosition?.tradingRecords?.filter(r => r.nav !== undefined); // Only consider confirmed records
    if (!records || records.length === 0) {
        return null;
    }

    const sortedRecords = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastRecord = sortedRecords[0];

    const latestNAV = latestNAVForComparison;
    
    if (!lastRecord || latestNAV <= 0 || !lastRecord.nav || lastRecord.nav <= 0) {
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tradeDate = new Date(lastRecord.date);
    tradeDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - tradeDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const timeAgo = `${diffDays} 天前`;

    let tradeType = '';
    if (lastRecord.type === 'buy') tradeType = '买入';
    else if (lastRecord.type === 'sell') tradeType = '卖出';
    else if (lastRecord.type === 'dividend-cash') tradeType = '分红';
    else if (lastRecord.type === 'dividend-reinvest') tradeType = '再投';

    const change = ((latestNAV - lastRecord.nav) / lastRecord.nav) * 100;
    const isPositive = change >= 0;
    const changeSinceTradeText = `${isPositive ? '⬆︎' : '⬇︎'}${Math.abs(change).toFixed(2)}%`;
    const colorClass = isPositive ? 'text-red-500' : 'text-green-600';

    let emoji = '';
    if (lastRecord.type === 'buy' || lastRecord.type === 'dividend-reinvest') {
        emoji = isPositive ? '👍' : '👎';
    } else { // sell
        emoji = isPositive ? '👎' : '👍';
    }
    
    return {
        timeAgo,
        tradeType,
        changeSinceTradeText,
        colorClass,
        emoji
    };
  }, [fund.userPosition?.tradingRecords, latestNAVForComparison]);

  const renderRecommendation = () => {
      const smartScore = fund.smartRecommendation;
      
      if (smartScore === undefined) return null;

      let smartLabel = '';
      let smartColorClass = '';
      let icon = '';
      
      if (smartScore >= 75) {
          smartLabel = '强力买入';
          smartColorClass = 'text-red-600 dark:text-red-400 font-bold';
          icon = '🔴';
      } else if (smartScore >= 60) {
          smartLabel = '建议买入';
          smartColorClass = 'text-orange-600 dark:text-orange-400 font-semibold';
          icon = '🟠';
      } else if (smartScore >= 40) {
          smartLabel = '持有/观望';
          smartColorClass = 'text-gray-400 dark:text-gray-500';
          icon = '⚪️';
      } else if (smartScore >= 25) {
          smartLabel = '建议减仓';
          smartColorClass = 'text-blue-500 dark:text-blue-400 font-semibold';
          icon = '🔵';
      } else {
          smartLabel = '强力卖出';
          smartColorClass = 'text-green-600 dark:text-green-400 font-bold';
          icon = '🟢';
      }
      
      return (
          <div className="mt-1 flex items-center gap-1">
              <span className="text-[10px]">{icon}</span>
              <span className={`text-xs font-mono ${smartColorClass}`}>
                  评分: {smartScore.toFixed(0)} {smartLabel} {fund.smartSignalLabel ? `(${fund.smartSignalLabel})` : ''}
              </span>
          </div>
      );
  };

  const marketValueDisplay = useMemo(() => {
      if (!fund.marketValue || fund.marketValue <= 0) return null;
      
      const percent = (totalPortfolioValue > 0) ? (fund.marketValue / totalPortfolioValue) * 100 : 0;
      
      return (
          <div className="flex items-center mt-1 w-full justify-between">
              {/* Left Group: Progress + Rank */}
              <div className="flex items-center gap-2">
                  {/* Fixed width progress bar container (w-40) */}
                  <div className="w-40 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shrink-0">
                      <div 
                          className="h-full bg-blue-400 dark:bg-blue-500 rounded-full" 
                          style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                  </div>
                  {/* Rank & Percent */}
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">
                      #{marketValueRank} {percent.toFixed(0)}%
                  </div>
              </div>
              
              {/* Right Group: Amount (Integer) */}
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300 font-mono">
                  {Math.round(fund.marketValue).toLocaleString()}
              </div>
          </div>
      );
  }, [fund.marketValue, totalPortfolioValue, marketValueRank]);

  return (
    <tr className="border-b border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td 
        className={`p-0 border-r border-gray-300 dark:border-gray-600 text-left md:sticky md:left-0 md:z-[10] w-[250px] min-w-[250px] ${isTrendSignificant ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white dark:bg-gray-900'}`}
        onDoubleClick={() => onShowDetails(fund)}
      >
        <div className="flex flex-col h-full justify-between p-2">
          <div>
            <div className="truncate">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{fund.name}</span>
              <span 
                className={`ml-2 text-xs transition-colors duration-200 ${isCopied ? 'text-green-500 font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-primary-500'}`}
                onClick={handleCopyCode}
                title="点击复制基金代码"
              >
                {isCopied ? '复制成功' : fund.code}
              </span>
            </div>
            
            {marketValueDisplay}

            {(dailyChangeDisplay || trendInfo) && (
                <div className="text-xs mt-0.5 font-semibold">
                    {dailyChangeDisplay && (
                        <span className={dailyChangeDisplay.colorClass}>
                            {dailyChangeDisplay.text}
                        </span>
                    )}
                    {dailyChangeDisplay && trendInfo && (
                        <span className="text-gray-500 dark:text-gray-400">, </span>
                    )}
                    {trendInfo && (
                        <span className={trendInfo.isPositive ? 'text-red-500' : 'text-green-600'}>
                            {trendInfo.text}
                        </span>
                    )}
                </div>
            )}
            {lastTransactionInfo && (
                <div className="text-xs mt-0.5">
                    <span className="text-gray-600 dark:text-gray-400">{lastTransactionInfo.timeAgo}</span>
                    <span className={`font-semibold mx-1 ${lastTransactionInfo.tradeType === '买入' || lastTransactionInfo.tradeType === '再投' ? 'text-red-500' : lastTransactionInfo.tradeType === '分红' ? 'text-yellow-600' : 'text-blue-500'}`}>{lastTransactionInfo.tradeType}</span>
                    <span className={`font-semibold ${lastTransactionInfo.colorClass}`}>{lastTransactionInfo.changeSinceTradeText}</span>
                    <span className="ml-1">{lastTransactionInfo.emoji}</span>
                </div>
            )}
          </div>
          <div>
            {(systemTags.length > 0 || fund.userPosition?.tag) && (
              <div className="mt-1 flex flex-wrap gap-1 items-center">
                {systemTags.map(tag => {
                  // Fallback for custom recommended tag if not in SYSTEM_TAG_COLORS yet (though added in App.tsx)
                  const tagConfig = SYSTEM_TAG_COLORS[tag] || getTagColor(tag);
                  const { bg, text } = tagConfig;
                  return (
                    <span 
                      key={tag} 
                      className={`inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded ${bg} ${text}`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onTagDoubleClick(tag);
                      }}
                    >
                      {tag}
                    </span>
                  );
                })}
                {fund.userPosition?.tag?.split(',').map(t => t.trim()).filter(Boolean).map(tag => {
                  const { bg, text } = getTagColor(tag);
                  return (
                    <span 
                      key={tag} 
                      className={`inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded ${bg} ${text}`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onTagDoubleClick(tag);
                      }}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
            {renderRecommendation()}
          </div>
        </div>
      </td>
      <td className="p-0 border-r border-gray-300 dark:border-gray-600 w-[450px] min-w-[450px] md:sticky md:left-[0px] bg-white dark:bg-gray-900 md:z-[5] relative">
        <div className="absolute inset-0">
          <FundChart 
            baseChartData={baseChartData}
            zigzagPoints={zigzagPoints}
            shares={fund.userPosition?.shares ?? 0}
            lastPivotDate={lastPivotDate} 
            costPrice={fund.userPosition?.cost && fund.userPosition.cost > 0 ? fund.userPosition.cost : null}
            actualCostPrice={fund.actualCost && fund.actualCost > 0 ? fund.actualCost : null}
            showLabels={false}
            navPercentile={navPercentile}
            tradingRecords={fund.userPosition?.tradingRecords}
          />
        </div>
      </td>
      <td className={`p-0 border-r border-gray-300 dark:border-gray-600 w-[60px] min-w-[60px] ${todayTransaction ? (todayTransaction.type === 'buy' || todayTransaction.type === 'dividend-reinvest' ? 'bg-red-50 dark:bg-red-900/20' : todayTransaction.type === 'dividend-cash' ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-blue-50 dark:bg-blue-900/20') : 'bg-white dark:bg-gray-900'}`}>
        <div className="p-0">
            {historicalDataForToday ? (
              <>
                <div className="font-normal font-mono text-xs text-gray-800 dark:text-gray-200">
                  {historicalDataForToday.unitNAV.toFixed(4)}
                </div>
                <div className={`text-sm font-semibold ${
                  historicalDataForToday.dailyGrowthRate.startsWith('-') ? 'text-green-600' : 'text-red-500'
                }`}>
                  {historicalDataForToday.dailyGrowthRate}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  已确认
                </div>
              </>
            ) : (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) ? (
              <>
                <div className="font-normal font-mono text-xs text-gray-800 dark:text-gray-200">
                  {fund.realTimeData.estimatedNAV.toFixed(4)}
                </div>
                <div className={`text-sm font-semibold ${
                  fund.realTimeData.estimatedChange.startsWith('-') ? 'text-green-600' : 'text-red-500'
                }`}>
                  {fund.realTimeData.estimatedChange}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {fund.realTimeData.estimationTime.split(' ')[1] || fund.realTimeData.estimationTime}
                </div>
              </>
            ) : (
              <span className="text-gray-400">-</span>
            )}
            {todayRecord ? (
                <RecordLink onClick={() => handleEditTrade(todayRecord)} />
            ) : todayPendingRecord ? (
                <RecordLink onClick={() => handleEditPendingTrade(todayPendingRecord)} />
            ) : ((historicalDataForToday || fund.realTimeData?.estimatedNAV) && (
                <TradeLinks onTradeClick={handleTodayTrade} />
            ))}
        </div>
      </td>
      {dateHeaders.map(date => {
        const point = dataMap.get(date);
        const record = confirmedRecordMap.get(date);
        const pendingRecord = pendingRecordMap.get(date);
        const pointIsPositive = point ? !point.dailyGrowthRate.startsWith('-') : true;

        let changeFromLatest: string | null = null;
        let changeIsPositive = true;

        if (point && latestNAVForComparison > 0) {
          const diff = ((latestNAVForComparison - point.unitNAV) / point.unitNAV) * 100;
          if (!isNaN(diff)) {
              changeIsPositive = diff >= 0;
              changeFromLatest = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`;
          }
        }
        
        const isPivotDate = pivotDateSet.has(date);
        let cellBgClass = '';
        const transaction = record || pendingRecord;
        if (transaction) {
            if (transaction.type === 'buy' || transaction.type === 'dividend-reinvest') {
                cellBgClass = isPivotDate ? 'bg-red-200 dark:bg-red-900/60' : 'bg-red-50 dark:bg-red-900/20';
            } else if (transaction.type === 'dividend-cash') {
                cellBgClass = isPivotDate ? 'bg-yellow-200 dark:bg-yellow-900/60' : 'bg-yellow-50 dark:bg-yellow-900/20';
            } else {
                cellBgClass = isPivotDate ? 'bg-blue-200 dark:bg-blue-900/60' : 'bg-blue-50 dark:bg-blue-900/20';
            }
        } else if (isPivotDate) {
            cellBgClass = 'bg-gray-200 dark:bg-gray-700';
        }

        return (
          <td key={date} className={`p-0 border-r border-gray-300 dark:border-gray-600 ${cellBgClass}`}>
            {point ? (
              <div className="p-0">
                <div className="font-normal font-mono text-xs text-gray-800 dark:text-gray-200">{point.unitNAV.toFixed(4)}</div>
                <div className={`text-sm font-semibold ${pointIsPositive ? 'text-red-500' : 'text-green-600'}`}>
                  {point.dailyGrowthRate}
                </div>
                 {changeFromLatest !== null && (
                  <div className={`text-xs font-mono mt-1 ${changeIsPositive ? 'text-red-500' : 'text-green-600'}`}>
                    {changeFromLatest}
                  </div>
                )}
                {record ? (
                    <RecordLink onClick={() => handleEditTrade(record)} />
                ) : pendingRecord ? (
                    <RecordLink onClick={() => handleEditPendingTrade(pendingRecord)} />
                ) : (
                    <TradeLinks onTradeClick={(type) => onTrade(fund, date, type, point.unitNAV, true)} />
                )}
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
        );
      })}
    </tr>
  );
};

export default FundRow;
