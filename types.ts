
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

export interface UserPosition {
  code: string;
  shares: number;
  cost: number;
  tag?: string;
  realizedProfit: number;
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
