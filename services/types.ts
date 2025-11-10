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
  code:string;
  name: string;
  data: FundDataPoint[];
  realTimeData?: RealTimeData;
  latestNAV?: number;
  latestChange?: string;
  color?: string;
  userPosition?: UserPosition;
}

// FIX: Add ProcessedFund interface for better type safety with derived fund data.
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