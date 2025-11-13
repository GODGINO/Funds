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

// 新增：交易记录接口
// 当一个任务被成功执行后，会在基金的持仓信息中留下一条永久的、不可变的记录。
export interface TradingRecord {
  date: string;              // 交易确认日期 (作为唯一标识的一部分)
  type: 'buy' | 'sell';      // 交易类型
  nav: number;               // 确认成交的单位净值
  sharesChange: number;      // 份额变化 (买入为正, 卖出为负)
  amount: number;            // 交易金额 (买入时为正, 卖出时为负)
  realizedProfitChange?: number; // 落袋收益变化 (仅卖出时有)
}

export interface UserPosition {
  code: string;
  shares: number;
  cost: number;
  tag?: string;
  realizedProfit: number;
  tradingRecords?: TradingRecord[]; // 新增：存储所有已完成的交易记录
}

// 新增：交易任务接口
// 仅用于表示所有待处理的、净值未确认的交易请求。
export interface TradingTask {
  id: string;          // 唯一ID (例如，用时间戳生成)
  code: string;        // 基金代码
  name: string;        // 基金名称 (方便在管理列表中显示)
  type: 'buy' | 'sell';// 交易类型
  date: string;        // 交易申请日期 (YYYY-MM-DD)
  value: number;       // 交易数值: 买入时是金额, 卖出时是份额
  status: 'pending' | 'completed' | 'failed'; // 任务状态
  createdAt: number;   // 任务创建时间戳
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
    } | null;
    baseChartData: Partial<FundDataPoint>[];
    zigzagPoints: Partial<FundDataPoint>[];
    lastPivotDate: string | null;
    navPercentile: number | null;
    marketValue?: number;
    costBasis?: number;
    holdingProfit?: number;
    totalProfit?: number;
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
  editingRecord?: TradingRecord; // Optional: The record being edited
  editingTask?: TradingTask; // Optional: The task being edited
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
  netAmountChange: number;
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
