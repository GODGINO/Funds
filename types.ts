
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
  date: string;
  type: TransactionType;
  value?: number;
  nav?: number;
  sharesChange?: number;
  amount?: number;
  realizedProfitChange?: number;
}

export interface UserPosition {
  code: string;
  shares: number;
  cost: number;
  tag?: string;
  realizedProfit: number;
  tradingRecords?: TradingRecord[];
}

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

export interface TradeModalState {
  fund: ProcessedFund;
  date: string;
  nav: number;
  isConfirmed: boolean;
  editingRecord?: TradingRecord;
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

// AI 投顾结构化输出定义
export interface GeminiPyramidSignal {
    code: string;
    name: string;
    level: string; // "1档(-4.5%)", "2档(-9%)", "3档(-13.5%)"
    amount: number;
    reason: string;
}

export interface GeminiFundAction {
    code: string;
    name: string;
    action: '买入' | '卖出' | '持有' | '调仓';
    priority: '高' | '中' | '低';
    advice: string;
}

export interface GeminiAdviceResponse {
    marketOverview: string;
    sentimentScore: number; // 0-100
    strategySummary: string;
    pyramidSignals: GeminiPyramidSignal[];
    fundActions: GeminiFundAction[];
    riskWarnings: string[];
}
