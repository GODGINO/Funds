
import { GoogleGenAI } from "@google/genai";
import { ProcessedFund, PortfolioSnapshot, IndexData } from '../types';

// REMOVED TOP LEVEL INIT to prevent app crash on load if API key is missing
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

  // Calculate drop from last buy for pyramid strategy
  const confirmedRecords = position?.tradingRecords?.filter(r => r.nav !== undefined && r.type === 'buy') || [];
  const lastBuyRecord = confirmedRecords.length > 0 ? confirmedRecords[confirmedRecords.length - 1] : null;
  const currentNAV = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
  // Explicitly capture today's change percentage
  const currentChange = fund.realTimeData?.estimatedChange || fund.latestChange || '0';
  
  let pyramidSignal = "无上次买入记录，参考Zigzag趋势建仓";
  if (lastBuyRecord && lastBuyRecord.nav && currentNAV > 0) {
      const changeFromLastBuy = ((currentNAV - lastBuyRecord.nav) / lastBuyRecord.nav) * 100;
      pyramidSignal = `距上次买入(${lastBuyRecord.date} @ ${lastBuyRecord.nav.toFixed(4)}): ${changeFromLastBuy >= 0 ? '+' : ''}${changeFromLastBuy.toFixed(2)}%`;
  }

  const trades = position?.tradingRecords?.slice(-3).map(r => 
    `${r.date} ${r.type === 'buy' ? '买入' : '卖出'} (净值:${r.nav?.toFixed(4) ?? '待定'})`
  ).join('; ') || "近期无交易";

  // Construct full history string (Date:NAV(Change%))
  // We use baseChartData to include the real-time point if available.
  const historyStr = fund.baseChartData.map(d => {
    const dateStr = d.date?.split(' ')[0] || 'N/A';
    const navStr = d.unitNAV !== undefined ? d.unitNAV.toFixed(4) : 'N/A';
    let rateStr = String(d.dailyGrowthRate || '0');
    if (!rateStr.includes('%')) rateStr += '%';
    return `${dateStr}:${navStr}(${rateStr})`;
  }).join('; ');

  return `
- 基金名称: ${fund.name} (${fund.code})
  当前净值: ${currentNAV.toFixed(4)}
  今日涨跌: ${currentChange}%
  估值分位点: ${fund.navPercentile ? fund.navPercentile.toFixed(2) + '%' : 'N/A'} (0%低估 - 100%高估)
  状态: ${holdingStatus}
  趋势概览: ${trend}
  金字塔参考: ${pyramidSignal}
  关键拐点(Zigzag): ${zigzagSummary}
  近期交易: ${trades}
  完整历史数据(Date:NAV(Change)): [${historyStr}]
  `;
}

function formatSnapshotsForPrompt(snapshots: PortfolioSnapshot[]): string {
  if (!snapshots || snapshots.length === 0) return "暂无切片数据";
  
  // Take the last 3 operational snapshots (excluding baseline if possible) to show recent effectiveness
  const recent = snapshots.filter(s => s.snapshotDate !== '基准持仓').slice(0, 3);
  
  return recent.map(s => `
  日期: ${s.snapshotDate}
  操作收益: ${s.operationProfit?.toFixed(2) ?? 0} (目标: 越大越好, 代表波动捕获能力)
  造成盈亏: ${s.profitCaused?.toFixed(2) ?? 0} (目标: 越大越好, 代表对日收益能力的提升)
  操作效果: ${s.operationEffect?.toFixed(2) ?? 0}%
  `).join('\n');
}

export async function generatePortfolioAdvice(context: AnalysisContext) {
  const { funds, snapshots, indexData, activeTag } = context;

  // Filter funds if a tag is active to focus analysis
  const targetFunds = activeTag 
    ? funds.filter(f => {
        const p = f.userPosition;
        if (activeTag === '持有') return p && p.shares > 0;
        if (activeTag === '自选') return !p || p.shares === 0;
        if (activeTag === '盈利') return (f.holdingProfit || 0) > 0;
        if (activeTag === '亏损') return (f.holdingProfit || 0) < 0;
        return p?.tag?.includes(activeTag);
      }) 
    : funds;

  const fundsContext = targetFunds.map(formatFundDataForPrompt).join('\n');
  const snapshotContext = formatSnapshotsForPrompt(snapshots);
  const marketContext = indexData ? `上证指数: ${indexData.value} (涨跌: ${indexData.changePercent.toFixed(2)}%)` : "大盘数据不可用";

  // Split instructions and data for clearer LLM logic using systemInstruction
  const instructions = `
你是一位世界顶级的基金投资顾问。你的目标是帮助用户最大化两个核心指标：
1. **操作收益 (Operation Profit)**: 衡量用户通过低买高卖捕获的市场波动收益。
2. **造成盈亏 (Profit Caused/Caused Profit)**: 衡量用户的操作对整个组合“每日盈利能力”的提升（即：是否在上涨前加仓了？是否在下跌前减仓了？）。

**用户当前执行的策略：4.5% 金字塔加仓法**
这是一个严格的左侧网格交易策略，旨在通过分批抄底降低成本。
- **基础买入单位**: 500元。
- **触发规则 (基于"距上次买入涨跌幅")**:
  1. **第一档加仓**: 当跌幅达到 **-4.5%** 时，买入 **1倍单位 (500元)**。
  2. **第二档加仓**: 当跌幅达到 **-9.0%** (在此基础上再跌4.5%) 时，买入 **2倍单位 (1000元)**。
  3. **第三档加仓**: 当跌幅达到 **-13.5%** (在此基础上再跌4.5%) 时，买入 **4倍单位 (2000元)**。
- **止盈规则**: 当收益率达到满意水平或估值过高(分位点>80%)时，分批止盈。

**分析指令**:
1. **策略扫描 (Priority)**: 
   - 仔细检查每只基金的“金字塔参考”数据。
   - **必须高亮指出**任何触及 -4.5%, -9.0%, -13.5% 阈值的基金，并明确建议对应的加仓金额。
2. **趋势确认**:
   - 结合 Zigzag 拐点和**提供的完整历史数据(Date:NAV(Change))**。
   - 观察历史走势，判断当前是处于下跌中继、底部震荡还是上升回调。
   - 如果处于下跌趋势中且触发金字塔信号，建议按计划执行以摊低成本。
   - 如果处于上升趋势回调（N字底），更是绝佳的买入机会。
3. **最大化指标**:
   - 指出哪些操作（加仓或止盈）能最有效地提升“操作收益”和“造成盈亏”。
   - 对于长期亏损且无波动的“僵尸基金”，建议是否调仓。

请输出一段 Markdown 格式报告，包含：
1. **市场与策略概况**: 简述。
2. **🚨金字塔加仓信号**: 列出触发 -4.5%/-9%/-13.5% 规则的基金及建议买入金额。
3. **操作建议**: 其他买卖或持仓建议，请引用具体的历史数据或涨跌幅来支持你的观点。
4. **风险提示**: 针对当前组合的最大风险点。
`;

  const data = `
请基于以下数据进行分析：
- **大盘环境**: ${marketContext}
- **历史操作效果**: ${snapshotContext}
- **当前基金池状态**: 
${fundsContext}
`;

  // LOGGING THE PROMPT AS REQUESTED
  console.log("%c--- Gemini System Prompt ---", "color: #8e44ad; font-weight: bold; font-size: 12px;");
  console.log(instructions);
  console.log(data);

  try {
    // Initialize AI client lazily and inside try-catch to avoid crashes if API key is missing or invalid
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-pro-preview for complex reasoning task.
    // Explicitly using systemInstruction in config to provide guidelines.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: data,
      config: {
        systemInstruction: instructions,
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    if (String(error).includes("API key")) {
        throw new Error("API Key 无效或未配置。请检查 Netlify 环境变量 GEMINI_API_KEY。");
    }
    throw new Error("AI 分析暂时不可用，请检查网络或稍后再试。");
  }
}
