
export interface FundDataPoint {
  date: string;
  unitNAV: number;
  cumulativeNAV: number;
  dailyGrowthRate: string;
  subscriptionStatus: string;
  redemptionStatus: string;
  dividendDistribution: string;
}

export interface RealTimeData {
  estimatedNAV: number;
  estimatedChange: string;
  estimationTime: string;
}

export interface TradingRecord {
  date: string;              // 交易确认/申请日期
  type: 'buy' | 'sell';      // 交易类型

  // Fields for PENDING trades
  // For 'buy', this is the amount. For 'sell', this is the shares.
  value?: number;

  // Fields for CONFIRMED trades
  nav?: number;              // 确认成交的单位净值
  sharesChange?: number;     // 确认的份额变化 (买入为正, 卖出为负)
  amount?: number;           // 确认的交易金额 (买入时为正, 卖出时为负)
  realizedProfitChange?: number; // 落袋收益变化 (仅卖出时有)
}


export interface UserPosition {
  code: string;
  shares: number;
  cost: number;
  tag?: string;
  realizedProfit: number;
  tradingRecords?: TradingRecord[]; // Now stores both confirmed and pending records
}

// The TradingTask interface is no longer needed and has been removed.

export interface Fund {
  code: string;
  name: string;
  data: FundDataPoint[];
  realTimeData?: RealTimeData;
  latestNAV?: number;
  latestChange?: string;
  color?: string;
  userPosition?: UserPosition;
}

export interface ProcessedFund extends Fund {
    trendInfo: {
        text: string;
        isPositive: boolean;
        change: number;
        days: number;
    } | null;
    baseChartData: Partial<FundDataPoint>[];
    zigzagPoints: Partial<FundDataPoint>[];
    lastPivotDate: string | null;
    navPercentile: number | null;
    marketValue?: number;
    costBasis?: number;
    holdingProfit?: number;
    totalProfit?: number;
    holdingProfitRate?: number;
    totalProfitRate?: number;
    actualCost?: number;
    recentProfit?: number;
    initialMarketValueForTrend?: number;
    initialUserPosition?: UserPosition;
}

export type TagSortOrder = 'asc' | 'desc' | 'abs_asc' | 'abs_desc';

export interface TagAnalysisData {
  tag: string;
  fundCount: number;
  totalCostBasis: number;
  totalMarketValue: number;
  cumulativeMarketValue: number;
  totalHoldingProfit: number;
  grandTotalProfit: number;
  totalDailyProfit: number;
  totalYesterdayMarketValue: number;
  totalRecentProfit: number;
  totalInitialMarketValueForTrend: number;
  holdingProfitRate: number;
  totalProfitRate: number;
  dailyProfitRate: number;
  recentProfitRate: number;
  holdingEfficiency: number;
  dailyEfficiency: number;
  recentEfficiency: number;
  hasRecentTransaction: boolean;
}

export interface IndexData {
  value: number;
  change: number;
  changePercent: number;
}

// 交易弹窗上下文状态
export interface TradeModalState {
  fund: ProcessedFund;
  date: string;
  nav: number; // The NAV for estimation or confirmed transaction
  isConfirmed: boolean; // True if NAV is final for that day
  editingRecord?: TradingRecord; // Optional: The record being edited (can be pending or confirmed)
}

export interface PortfolioSnapshot {
  snapshotDate: string;
  totalCostBasis: number;
  currentMarketValue: number;
  cumulativeValue: number;
  totalProfit: number;
  profitRate: number;
  dailyProfit: number;
  dailyProfitRate: number;
  netAmountChange?: number;
  marketValueChange?: number;
  operationProfit?: number;
  profitPerHundred?: number;
  profitCaused?: number;
  profitCausedPerHundred?: number;
  operationEffect?: number;
  totalBuyAmount?: number;
  totalBuyFloatingProfit?: number;
  totalSellAmount?: number;
  totalSellOpportunityProfit?: number;
  totalSellRealizedProfit?: number;
}