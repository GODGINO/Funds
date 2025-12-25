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

export type TransactionType = 'buy' | 'sell' | 'dividend-cash' | 'dividend-reinvest';

export interface TradingRecord {
  date: string;              // 交易确认/申请日期
  type: TransactionType;     // 交易类型

  // Fields for PENDING trades
  // For 'buy' / 'dividend-cash', this is the amount (money).
  // For 'sell' / 'dividend-reinvest', this is the shares.
  value?: number;

  // Fields for CONFIRMED trades
  nav?: number;              // 确认成交的单位净值 (对于现金分红为除权日净值)
  sharesChange?: number;     // 确认的份额变化 (买入/再投为正, 卖出为负, 现金分红为0)
  amount?: number;           // 确认的本金变动 (买入为正, 卖出为负, 分红/再投为0)
  // dividendAmount has been removed. Use realizedProfitChange for cash dividends.
  realizedProfitChange?: number; // 落袋收益变化 (卖出或现金分红时产生)
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

export interface MarketDataPoint {
    t: string;
    val: number;
    ind: number;
}

export interface TurnoverResult {
    display: string;
    points: MarketDataPoint[];
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
    smartRecommendation?: number;
    smartSignalLabel?: string;
}

export type TagSortOrder = 'asc' | 'desc' | 'abs_asc' | 'abs_desc';

export type SortByType = 'trend' | 'dailyChange' | 'navPercentile' | 'amount' | 'holdingProfitRate' | 'totalProfitRate' | 'smartScore';

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
  totalRecentOperationAmount: number; // 新增：近期操作总额
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
  holdingProfit: number;
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