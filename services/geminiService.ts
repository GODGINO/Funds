
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedFund, PortfolioSnapshot, IndexData, GeminiAdviceResponse } from '../types';

// 硅基流动硬编码配置 (保底方案)
const SILICON_FLOW_KEY = 'sk-qmebwcebnibdwslnohyiladmqizjpwqhmrnttlsobwmcayen';
const SILICON_FLOW_MODEL = 'Pro/deepseek-ai/DeepSeek-V3.2';

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

/**
 * 使用硅基流动 API (DeepSeek-V3.2) 进行分析
 */
async function generateViaSiliconFlow(prompt: string): Promise<GeminiAdviceResponse> {
    console.debug("[SiliconFlow] Using DeepSeek-V3.2 Fallback...");
    
    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SILICON_FLOW_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: SILICON_FLOW_MODEL,
            messages: [
                {
                    role: 'system',
                    content: '你是一位专业的基金投资顾问，擅长执行金字塔加仓策略。请严格按照 JSON 格式输出建议。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            stream: false,
            response_format: { type: 'json_object' }, // 强制 JSON 输出
            temperature: 0.7,
        })
    };

    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
    if (!response.ok) {
        throw new Error(`SiliconFlow API Error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    console.debug("[SiliconFlow] Raw Response:", content);
    return JSON.parse(content);
}

/**
 * 使用 Google Gemini API 进行分析
 */
async function generateViaGemini(prompt: string, apiKey: string): Promise<GeminiAdviceResponse> {
    console.debug("[Gemini] Using Google Gemini API...");
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                marketOverview: { type: Type.STRING },
                sentimentScore: { type: Type.NUMBER },
                strategySummary: { type: Type.STRING },
                pyramidSignals: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            code: { type: Type.STRING },
                            name: { type: Type.STRING },
                            level: { type: Type.STRING },
                            amount: { type: Type.NUMBER },
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
                            action: { type: Type.STRING },
                            priority: { type: Type.STRING },
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

    console.debug("[Gemini] Raw Response:", response.text);
    return JSON.parse(response.text);
}

export async function generatePortfolioAdvice(context: AnalysisContext): Promise<GeminiAdviceResponse> {
  const { funds, indexData, activeTag } = context;

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
输出必须为结构化的 JSON 数据。
`;

  console.debug("[AI API] Request Context:", systemPrompt);

  try {
    const geminiKey = process.env.API_KEY;
    
    // 如果存在环境变量 Key，优先使用 Gemini，否则使用 SiliconFlow
    if (geminiKey && geminiKey.trim() !== '') {
        return await generateViaGemini(systemPrompt, geminiKey);
    } else {
        return await generateViaSiliconFlow(systemPrompt);
    }
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    throw new Error("AI 分析暂时不可用，请检查网络或稍后重试。");
  }
}
