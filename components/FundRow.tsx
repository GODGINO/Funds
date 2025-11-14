import React, { useMemo, useState, useCallback } from 'react';
// FIX: Import the shared ProcessedFund interface.
import { Fund, FundDataPoint, ProcessedFund, TradingRecord, TradingTask } from '../types';
import FundChart from './FundChart';

// FIX: Removed local ProcessedFund interface, now imported from types.ts.

interface FundRowProps {
  fund: ProcessedFund;
  dateHeaders: string[];
  onShowDetails: (fund: Fund) => void;
  onTagDoubleClick: (tag: string) => void;
  onTrade: (fund: ProcessedFund, date: string, type: 'buy' | 'sell', nav: number, isConfirmed: boolean, editingRecord?: TradingRecord) => void;
  onOpenTaskModal: (task: TradingTask) => void;
  tradingTasks: TradingTask[];
}

const SYSTEM_TAG_COLORS: { [key: string]: { bg: string; text: string; } } = {
  '持有': { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300' },
  '自选': { bg: 'bg-gray-200 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300' },
  '盈利': { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
  '亏损': { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
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

const FundRow: React.FC<FundRowProps> = ({ fund, dateHeaders, onShowDetails, onTagDoubleClick, onTrade, onOpenTaskModal, tradingTasks }) => {
  const [isCopied, setIsCopied] = useState(false);
  const { trendInfo, baseChartData, zigzagPoints, lastPivotDate, navPercentile } = fund;

  const dataMap = useMemo(() => {
    return new Map<string, FundDataPoint>(fund.data.map(p => [p.date, p]));
  }, [fund.data]);

  const tradingRecordMap = useMemo(() => {
    return new Map<string, TradingRecord>(fund.userPosition?.tradingRecords?.map(r => [r.date, r]) || []);
  }, [fund.userPosition?.tradingRecords]);

  const pendingTaskMap = useMemo(() => {
    return new Map<string, TradingTask>(
      tradingTasks
        .filter(task => task.code === fund.code && task.status === 'pending')
        .map(task => [task.date, task])
    );
  }, [tradingTasks, fund.code]);


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
    return fund.trendInfo && Math.abs(fund.trendInfo.change) > 4.5;
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
      onTrade(fund, record.date, record.type, record.nav, true, record);
  };

  const todayDateStr = historicalDataForToday?.date || fund.realTimeData?.estimationTime.split(' ')[0];
  const todayRecord = todayDateStr ? tradingRecordMap.get(todayDateStr) : undefined;
  const todayPendingTask = todayDateStr ? pendingTaskMap.get(todayDateStr) : undefined;
  const todayTransaction = todayRecord || todayPendingTask;

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
    const records = fund.userPosition?.tradingRecords;
    if (!records || records.length === 0) {
        return null;
    }

    const sortedRecords = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastRecord = sortedRecords[0];

    const latestNAV = latestNAVForComparison;
    
    if (!lastRecord || latestNAV <= 0 || lastRecord.nav <= 0) {
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tradeDate = new Date(lastRecord.date);
    tradeDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - tradeDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const timeAgo = `${diffDays} 天前`;

    const tradeType = lastRecord.type === 'buy' ? '买入' : '卖出';

    const change = ((latestNAV - lastRecord.nav) / lastRecord.nav) * 100;
    const isPositive = change >= 0;
    const changeSinceTradeText = `${isPositive ? '⬆︎' : '⬇︎'}${Math.abs(change).toFixed(2)}%`;
    const colorClass = isPositive ? 'text-red-500' : 'text-green-600';

    let emoji = '';
    if (lastRecord.type === 'buy') {
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
                className={`ml-2 text-xs transition-colors duration-200 ${isCopied ? 'text-green-500 font-semibold' : 'text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary-500'}`}
                onClick={handleCopyCode}
                title="点击复制基金代码"
              >
                {isCopied ? '复制成功' : fund.code}
              </span>
            </div>
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
                    <span className={`font-semibold mx-1 ${lastTransactionInfo.tradeType === '买入' ? 'text-red-500' : 'text-blue-500'}`}>{lastTransactionInfo.tradeType}</span>
                    <span className={`font-semibold ${lastTransactionInfo.colorClass}`}>{lastTransactionInfo.changeSinceTradeText}</span>
                    <span className="ml-1">{lastTransactionInfo.emoji}</span>
                </div>
            )}
          </div>
          <div>
            {(systemTags.length > 0 || fund.userPosition?.tag) && (
              <div className="mt-1 flex flex-wrap gap-1 items-center">
                {systemTags.map(tag => {
                  const { bg, text } = SYSTEM_TAG_COLORS[tag];
                  return (
                    <span 
                      key={tag} 
                      className={`inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded ${bg} ${text} cursor-pointer`}
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
                      className={`inline-block px-1.5 py-0.5 text-[10px] leading-none font-medium rounded ${bg} ${text} cursor-pointer`}
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
          </div>
        </div>
      </td>
      <td className="p-0 border-r border-gray-300 dark:border-gray-600 w-[450px] min-w-[450px] md:sticky md:left-[250px] bg-white dark:bg-gray-900 md:z-[5] relative">
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
      <td className={`p-0 border-r border-gray-300 dark:border-gray-600 w-[60px] min-w-[60px] ${todayTransaction ? (todayTransaction.type === 'buy' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20') : 'bg-white dark:bg-gray-900'}`}>
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
            ) : todayPendingTask ? (
                <RecordLink onClick={() => onOpenTaskModal(todayPendingTask)} />
            ) : ((historicalDataForToday || fund.realTimeData?.estimatedNAV) && (
                <TradeLinks onTradeClick={handleTodayTrade} />
            ))}
        </div>
      </td>
      {dateHeaders.map(date => {
        const point = dataMap.get(date);
        const record = tradingRecordMap.get(date);
        const pendingTask = pendingTaskMap.get(date);
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
        const transaction = record || pendingTask;
        if (transaction) {
            if (transaction.type === 'buy') {
                cellBgClass = isPivotDate ? 'bg-red-200 dark:bg-red-900/60' : 'bg-red-50 dark:bg-red-900/20';
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
                ) : pendingTask ? (
                    <RecordLink onClick={() => onOpenTaskModal(pendingTask)} />
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