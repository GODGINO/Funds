
import React from 'react';
import { Fund, ProcessedFund, TradingRecord, TransactionType, SortByType } from '../types';
import FundRow from './FundRow';

interface FundTableProps {
  funds: ProcessedFund[];
  todayHeaderDate: string | null;
  dateHeaders: string[];
  onShowDetails: (fund: Fund) => void;
  onTagDoubleClick: (tag: string) => void;
  onTrade: (fund: ProcessedFund, date: string, type: TransactionType, nav: number, isConfirmed: boolean, editingRecord?: TradingRecord) => void;
  activeSort: SortByType;
  marketStats: { total: number; rankMap: Map<string, number> };
}

const FundTable: React.FC<FundTableProps> = ({
  funds,
  todayHeaderDate,
  dateHeaders,
  onShowDetails,
  onTagDoubleClick,
  onTrade,
  activeSort,
  marketStats
}) => {
  const getWeekday = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[date.getDay()];
  }

  return (
    <div className="w-full pb-4">
      <table className="w-full text-sm text-center border-collapse">
        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-40">
          <tr>
            <th className="p-0 border-r border-gray-300 dark:border-gray-600 font-semibold text-gray-600 dark:text-gray-300 w-[250px] min-w-[250px] text-left md:sticky md:left-0 bg-gray-50 dark:bg-gray-800 md:z-50">基金名称</th>
            <th className="p-0 border-r border-gray-300 dark:border-gray-600 font-semibold text-gray-600 dark:text-gray-300 w-[450px] min-w-[450px] md:sticky md:left-[0px] bg-gray-50 dark:bg-gray-800 md:z-40">净值走势</th>
            <th className="p-0 border-r border-gray-300 dark:border-gray-600 font-semibold text-gray-600 dark:text-gray-300 w-[60px] min-w-[60px] bg-gray-50 dark:bg-gray-800">
              {todayHeaderDate ? (
                <>{todayHeaderDate.substring(5)}{getWeekday(todayHeaderDate)}</>
              ) : (
                '当日净值'
              )}
            </th>
            {dateHeaders.map(date => (
              <th key={date} className="p-0 border-r border-gray-300 dark:border-gray-600 font-normal text-gray-500 dark:text-gray-400 min-w-[60px] bg-gray-50 dark:bg-gray-800">
                {date.substring(5)}{getWeekday(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="relative z-0">
          {funds.map(fund => (
            <FundRow 
              key={fund.code} 
              fund={fund} 
              dateHeaders={dateHeaders} 
              onShowDetails={onShowDetails}
              onTagDoubleClick={onTagDoubleClick}
              onTrade={onTrade}
              activeSort={activeSort}
              totalPortfolioValue={marketStats.total}
              marketValueRank={marketStats.rankMap.get(fund.code) || 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FundTable;
