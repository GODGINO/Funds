
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedFund, PortfolioSnapshot, IndexData, GeminiAdviceResponse } from '../types';

interface AnalysisContext {
  funds: ProcessedFund[];
  snapshots: PortfolioSnapshot[];
  indexData: IndexData | null;
  activeTag: string | null;
}

function formatFundDataForPrompt(fund: ProcessedFund): string {
  const position = fund.userPosition;
  const holdingStatus = position && position.shares > 0 ? 
    `持有: ${position.shares.toFixed(2)}份, 成本: ${position.cost.toFixed(4)}, 市值: ${fund.marketValue?.toFixed(2)}, 持有收益: ${fund.holdingProfit?.toFixed(2)}` : 
    "未持有 (自选观察)";

  const trend = fund.trendInfo ? 
    `近期趋势: ${fund.trendInfo.text} (${fund.trendInfo.isPositive ? '上涨' : '下跌'})` : 
    "趋势不明";
  
  const zigzagSummary = fund.zigzagPoints.slice(-3).map(p => 
    `${p.date?.split(' ')[0]}: ${p.unitNAV}`
  ).join(' -> ');

  const confirmedRecords = position?.tradingRecords?.filter(r => r.nav !== undefined && r.type === 'buy') || [];
  const lastBuyRecord = confirmedRecords.length > 0 ? confirmedRecords[confirmedRecords.length - 1] : null;
  const currentNAV = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
  const currentChange = fund.realTimeData?.estimatedChange || fund.latestChange || '0';
  
  let pyramidSignal = "无上次买入记录";
  if (lastBuyRecord && lastBuyRecord.nav && currentNAV > 0) {
      const changeFromLastBuy = ((currentNAV - lastBuyRecord.nav) / lastBuyRecord.nav) * 100;
      pyramidSignal = `距上次买入(${lastBuyRecord.date} @ ${lastBuyRecord.nav.toFixed(4)}): ${changeFromLastBuy >= 0 ? '+' : ''}${changeFromLastBuy.toFixed(2)}%`;
  }

  return `
- 基金: ${fund.name} (${fund.code})
  当前净值: ${currentNAV.toFixed(4)} (${currentChange}%)
  分位点: ${fund.navPercentile ? fund.navPercentile.toFixed(2) + '%' : 'N/A'}
  状态: ${holdingStatus}
  趋势: ${trend}
  金字塔参考: ${pyramidSignal}
  Zigzag: ${zigzagSummary}
  `;
}

export async function generatePortfolioAdvice(context: AnalysisContext): Promise<GeminiAdviceResponse> {
  const { funds, snapshots, indexData, activeTag } = context;

  const targetFunds = activeTag 
    ? funds.filter(f => {
        const p = f.userPosition;
        if (activeTag === '持有') return p && p.shares > 0;
        if (activeTag === '自选') return !p || p.shares === 0;
        return p?.tag?.includes(activeTag);
      }) 
    : funds;

  const fundsContext = targetFunds.map(formatFundDataForPrompt).join('\n');
  const marketContext = indexData ? `上证指数: ${indexData.value} (${indexData.changePercent.toFixed(2)}%)` : "大盘数据不可用";

  const systemPrompt = `
你是一位专业的基金投资顾问。请基于用户当前执行的 **4.5% 金字塔加仓策略** 进行深度分析。
大盘环境: ${marketContext}
当前基金池:
${fundsContext}

策略规则:
1. 距上次买入跌幅达 -4.5%: 买入 1倍(500元)。
2. 距上次买入跌幅达 -9.0%: 买入 2倍(1000元)。
3. 距上次买入跌幅达 -13.5%: 买入 4倍(2000元)。

请必须检查每只基金的“金字塔参考”，找出触发以上规则的基金，并给出具体的买卖建议。
输出必须为结构化的 JSON。
`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                marketOverview: { type: Type.STRING, description: "市场大环境及策略执行概况" },
                sentimentScore: { type: Type.NUMBER, description: "市场情绪评分 0-100" },
                strategySummary: { type: Type.STRING, description: "针对当前组合的策略总结" },
                pyramidSignals: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            code: { type: Type.STRING },
                            name: { type: Type.STRING },
                            level: { type: Type.STRING, description: "触发的加仓档位" },
                            amount: { type: Type.NUMBER, description: "建议买入金额" },
                            reason: { type: Type.STRING }
                        },
                        required: ["code", "name", "level", "amount", "reason"]
                    }
                },
                fundActions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            code: { type: Type.STRING },
                            name: { type: Type.STRING },
                            action: { type: Type.STRING, enum: ["买入", "卖出", "持有", "调仓"] },
                            priority: { type: Type.STRING, enum: ["高", "中", "低"] },
                            advice: { type: Type.STRING }
                        },
                        required: ["code", "name", "action", "priority", "advice"]
                    }
                },
                riskWarnings: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ["marketOverview", "sentimentScore", "strategySummary", "pyramidSignals", "fundActions", "riskWarnings"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw new Error("AI 分析暂时不可用，请检查 API 配置或网络。");
  }
}
