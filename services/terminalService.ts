
import { ProcessedFund, FundDataPoint, TradingRecord, UserPosition, PortfolioSnapshot } from '../types';
import { calculateZigzag } from './chartUtils';

const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const isWeekend = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
};

export const processTerminalCommand = (
    commandLine: string,
    funds: ProcessedFund[],
    setFunds: React.Dispatch<React.SetStateAction<any[]>>,
    settings: { recordCount: number, zigzagThreshold: number },
    snapshots: PortfolioSnapshot[]
): string => {
    const args = commandLine.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    try {
        if (cmd === 'trade') {
            return handleTrade(args.slice(1), funds, setFunds);
        } else if (cmd === 'inspect') {
            return handleInspect(args.slice(1), funds, settings, snapshots);
        } else if (cmd === 'ls' || cmd === 'list') {
            return handleList(funds);
        } else if (cmd === 'help') {
            return getHelpText();
        } else if (cmd === 'clear') {
            return ''; 
        } else if (cmd === '') {
            return '';
        }
        return `Unknown command: ${cmd}. Type 'help' for available commands.`;
    } catch (e: any) {
        return `Error: ${e.message}`;
    }
};

const getHelpText = () => `
Available Commands:

1. trade <action> <targets> <value> [date]
   - action: 'buy' | 'sell'
   - targets: '001234' | '001234,005678' | 'all' | 'tag:TagName'
   - value: amount (for buy) | shares or percentage e.g. '50%' (for sell)
   - date: YYYY-MM-DD (optional, defaults to today)
   Example: trade buy 001234 1000
   Example: trade sell all 50% 2023-10-27

2. inspect [date]
   - date: YYYY-MM-DD (optional, defaults to today)
   - Displays portfolio snapshot (nearest to date) and market data (exact date).

3. ls / list
   - Lists all tracked funds.

4. clear
   - Clears the terminal output.
`;

const handleList = (funds: ProcessedFund[]) => {
    let output = "Code   | Name             | Cost   | Shares\n";
    output += "-------|------------------|--------|--------\n";
    funds.forEach(f => {
        const p = f.userPosition;
        output += `${f.code} | ${f.name.padEnd(16).slice(0, 16)} | ${p?.cost.toFixed(4) || '0.0000'} | ${p?.shares.toFixed(2) || '0.00'}\n`;
    });
    return output;
};

const handleTrade = (args: string[], funds: ProcessedFund[], setFunds: React.Dispatch<React.SetStateAction<any[]>>) => {
    if (args.length < 3) {
        throw new Error("Usage: trade <action> <targets> <value> [date]");
    }

    const action = args[0].toLowerCase();
    if (action !== 'buy' && action !== 'sell') {
        throw new Error("Invalid action. Use 'buy' or 'sell'.");
    }

    const targetStr = args[1];
    const valueStr = args[2];
    const dateStr = args[3] || formatDate(new Date());
    const todayStr = formatDate(new Date());

    // 1. Resolve Targets
    let targetFunds: ProcessedFund[] = [];
    if (targetStr === 'all') {
        targetFunds = funds.filter(f => f.userPosition && f.userPosition.shares > 0);
    } else if (targetStr.startsWith('tag:')) {
        const tag = targetStr.substring(4);
        targetFunds = funds.filter(f => f.userPosition?.tag?.includes(tag));
    } else {
        const codes = targetStr.split(',');
        targetFunds = funds.filter(f => codes.includes(f.code));
        const foundCodes = targetFunds.map(f => f.code);
        const missing = codes.filter(c => !foundCodes.includes(c));
        if (missing.length > 0) throw new Error(`Funds not found: ${missing.join(', ')}`);
    }

    if (targetFunds.length === 0) return "No matching funds found.";

    let outputLog = `Executing ${action.toUpperCase()} on ${targetFunds.length} funds for date ${dateStr}:\n`;
    const updates: { [code: string]: TradingRecord } = {};

    // 2. Process each fund
    targetFunds.forEach(fund => {
        let tradeValue = 0;
        let isPercentage = false;

        // Parse Value
        if (valueStr.endsWith('%')) {
            isPercentage = true;
            const pct = parseFloat(valueStr.slice(0, -1));
            if (isNaN(pct) || pct <= 0 || pct > 100) throw new Error(`Invalid percentage: ${valueStr}`);
            
            if (action === 'buy') throw new Error("Percentage buy not supported yet (requires cash balance).");
            
            const currentShares = fund.userPosition?.shares || 0;
            tradeValue = currentShares * (pct / 100);
        } else {
            tradeValue = parseFloat(valueStr);
            if (isNaN(tradeValue) || tradeValue <= 0) throw new Error(`Invalid value: ${valueStr}`);
        }

        // Logic for Sell Amount/Shares check
        if (action === 'sell' && !isPercentage) {
            // value is shares
             const currentShares = fund.userPosition?.shares || 0;
             if (tradeValue > currentShares) {
                 outputLog += `[SKIP] ${fund.code}: Insufficient shares (Have: ${currentShares}, Sell: ${tradeValue})\n`;
                 return;
             }
        }

        // 3. Determine NAV and Status
        // Check strict history first
        const historyPoint = fund.data.find(d => d.date === dateStr);
        
        let nav = historyPoint?.unitNAV;
        let isConfirmed = !!historyPoint;
        
        let newRecord: TradingRecord;

        if (isConfirmed && nav) {
             if (action === 'buy') {
                newRecord = {
                    date: dateStr, type: 'buy', nav,
                    amount: tradeValue,
                    sharesChange: parseFloat((tradeValue / nav).toFixed(2))
                };
             } else {
                 // Sell
                 const sharesToSell = tradeValue; 
                 newRecord = {
                    date: dateStr, type: 'sell', nav,
                    sharesChange: -sharesToSell,
                    amount: parseFloat((-(sharesToSell * nav)).toFixed(2)),
                    // Note: realizedProfitChange will be calculated by the app's replay logic 
                    // when the state updates.
                    realizedProfitChange: parseFloat(((nav - (fund.userPosition?.cost || 0)) * sharesToSell).toFixed(2))
                 };
             }
             outputLog += `[SUCCESS] ${fund.code}: ${action.toUpperCase()} Confirmed @ ${nav.toFixed(4)}\n`;
             updates[fund.code] = newRecord;
        } else {
            // Pending Logic Check
            
            // A. If date is in the past and no history found -> It was a non-trading day (holiday/weekend) OR data missing.
            // We treat it as invalid to be safe and avoid "stuck" pending tasks for past dates.
            if (dateStr < todayStr) {
                 outputLog += `[FAIL] ${fund.code}: ${dateStr} 是非交易日 (无历史数据)\n`;
                 return;
            }

            // B. If date is today or future, check if it is a weekend.
            if (isWeekend(dateStr)) {
                outputLog += `[FAIL] ${fund.code}: ${dateStr} 是周末 (非交易日)\n`;
                return;
            }

            // C. Valid future/today trading day -> Create Pending
            newRecord = {
                date: dateStr,
                type: action as 'buy' | 'sell',
                value: tradeValue
            };
            outputLog += `[PENDING] ${fund.code}: ${action.toUpperCase()} queued for ${dateStr}\n`;
            updates[fund.code] = newRecord;
        }
    });

    // 4. Apply Updates
    if (Object.keys(updates).length > 0) {
        setFunds((prevFunds: any[]) => {
            return prevFunds.map(f => {
                const record = updates[f.code];
                if (!record) return f;

                const currentRecords = f.userPosition?.tradingRecords || [];
                // Replace any existing record for the same date to enforce "one trade per day" rule per spec
                const updatedRecords = [
                    ...currentRecords.filter((r: TradingRecord) => r.date !== dateStr),
                    record
                ];
                
                return {
                    ...f,
                    userPosition: {
                        ...f.userPosition,
                        tradingRecords: updatedRecords
                    }
                };
            });
        });
    }

    return outputLog;
};

const handleInspect = (args: string[], funds: ProcessedFund[], settings: { recordCount: number, zigzagThreshold: number }, snapshots: PortfolioSnapshot[]) => {
    const targetDate = args[0] || formatDate(new Date());
    
    // 1. Find relevant snapshot (Nearest <= targetDate)
    const sortedSnapshots = [...snapshots].sort((a, b) => {
        if (a.snapshotDate === '基准持仓') return -1;
        if (b.snapshotDate === '基准持仓') return 1;
        return new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime();
    });

    const snapshot = sortedSnapshots.find(s => s.snapshotDate !== '基准持仓' && s.snapshotDate <= targetDate);
    const finalSnapshot = snapshot || sortedSnapshots.find(s => s.snapshotDate === '基准持仓');

    if (!finalSnapshot) {
        return `No portfolio snapshot found on or before ${targetDate}.`;
    }

    const s = finalSnapshot;
    const snapshotDate = s.snapshotDate;

    // --- Output Formatting ---
    const fmtMoney = (v: number | undefined) => (v ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const fmtPct = (v: number | undefined) => (v ?? 0).toFixed(2) + '%';
    const fmtSign = (v: number | undefined) => (v ?? 0) >= 0 ? '+' : '';
    const fmtVal = (v: number | undefined) => {
        const val = v ?? 0;
        return `${fmtSign(val)}${fmtMoney(val)}`;
    }

    // Calculate Global Totals
    let totalOperationProfit = 0;
    let totalProfitCaused = 0;
    snapshots.forEach(snap => {
        if (snap.snapshotDate !== '基准持仓') {
            totalOperationProfit += snap.operationProfit || 0;
            totalProfitCaused += snap.profitCaused || 0;
        }
    });

    const lines: string[] = [];
    lines.push(`总操作收益: ${fmtVal(totalOperationProfit)}`);
    lines.push(`总造成盈亏: ${fmtVal(totalProfitCaused)}`);
    lines.push(`--- Portfolio Snapshot @ ${snapshotDate} ---`);
    if (snapshotDate !== targetDate && snapshotDate !== '基准持仓') {
        lines.push(`(Note: Using nearest snapshot. Requested: ${targetDate})`);
    }
    
    lines.push(`总成本: ${fmtMoney(s.totalCostBasis)}`);
    lines.push(`持有总值: ${fmtMoney(s.currentMarketValue)}`);
    lines.push(`累计总值: ${fmtMoney(s.cumulativeValue)}`);
    lines.push(`总收益: ${fmtVal(s.totalProfit)}`);
    lines.push(`收益率: ${fmtSign(s.profitRate)}${fmtPct(s.profitRate)}`);
    lines.push(`日收益: ${fmtVal(s.dailyProfit)}`);
    lines.push(`日收益率: ${fmtSign(s.dailyProfitRate)}${fmtPct(s.dailyProfitRate)}`);
    
    lines.push(`----------------`);
    lines.push(`⬆︎买入: ${fmtMoney(s.totalBuyAmount)}`);
    lines.push(`浮盈: ${fmtVal(s.totalBuyFloatingProfit)}`);
    lines.push(`⬇︎卖出: ${fmtMoney(s.totalSellAmount)}`);
    lines.push(`机会收益: ${fmtVal(s.totalSellOpportunityProfit)}`);
    lines.push(`落袋: ${fmtVal(s.totalSellRealizedProfit)}`);
    
    if (s.snapshotDate !== '基准持仓') {
        lines.push(`----------------`);
        lines.push(`▲金额: ${fmtVal(s.netAmountChange)}`);
        lines.push(`总值变动: ${fmtVal(s.marketValueChange)}`);
        lines.push(`操作收益: ${fmtVal(s.operationProfit)}`);
        lines.push(`每百收益: ${fmtVal(s.profitPerHundred)}`);
        lines.push(`造成盈亏: ${fmtVal(s.profitCaused)}`);
        lines.push(`每百造成: ${fmtVal(s.profitCausedPerHundred)}`);
        lines.push(`操作效果: ${fmtSign(s.operationEffect)}${fmtPct(s.operationEffect)}`);
    }

    lines.push(`--------------------------------------`);

    // --- 2. Fund Matrix (Historical NAV Data) ---
    // NOTE: We strictly use `targetDate` for the matrix view, not `snapshotDate`.
    const headers = ["Code", "Name", "Trend(T)", "Pctl(T)", `NAV(${targetDate})`, "Chg%"];
    const historyLimit = settings.recordCount > 1 ? settings.recordCount - 1 : 0;
    
    for(let i=1; i <= historyLimit; i++) {
        headers.push(`NAV(T-${i})`, `Chg(T-${i})`);
    }

    const rows: string[][] = [];

    funds.forEach(fund => {
        // Strict Slice based on the requested targetDate
        const matrixDate = targetDate; 
        
        // Use baseChartData to include real-time data if available
        const history = fund.baseChartData.filter(d => {
            if(!d.date) return false;
            return d.date.split(' ')[0] <= matrixDate;
        });
        
        if (history.length === 0) return; 

        const latest = history[history.length - 1]; // This is the data at T
        
        const zigzag = calculateZigzag(history, settings.zigzagThreshold);
        let trendStr = "-";
        if (zigzag.length >= 2) {
             const pivot = zigzag[zigzag.length - 2];
             const end = zigzag[zigzag.length - 1]; 
             if (pivot.unitNAV && end.unitNAV && pivot.date && end.date) {
                 const chg = ((end.unitNAV - pivot.unitNAV) / pivot.unitNAV) * 100;
                 const pDate = new Date(pivot.date.split(' ')[0]);
                 const eDate = new Date(end.date.split(' ')[0]);
                 const diffDays = Math.round((eDate.getTime() - pDate.getTime()) / (86400000));
                 trendStr = `${chg >= 0 ? 'UP' : 'DN'} ${Math.abs(chg).toFixed(1)}% (${diffDays}d)`;
             }
        }

        const navs = history.map(d => d.unitNAV).filter((n): n is number => typeof n === 'number');
        const min = Math.min(...navs);
        const max = Math.max(...navs);
        let pctl = 0;
        if (latest.unitNAV !== undefined && max > min) {
             pctl = ((latest.unitNAV - min) / (max - min)) * 100;
        } else {
             pctl = 50;
        }

        const fmtChg = (val: string | undefined) => {
            if (!val) return '-';
            return val.includes('%') ? val : val + '%';
        };

        const row = [
            fund.code,
            fund.name.slice(0, 8),
            trendStr,
            pctl.toFixed(1) + '%',
            latest.unitNAV?.toFixed(4) ?? '-',
            fmtChg(latest.dailyGrowthRate)
        ];

        const reversedHistory = history.slice(0, history.length - 1).reverse();
        for(let i=0; i < historyLimit; i++) {
            const h = reversedHistory[i];
            if (h && h.unitNAV !== undefined) {
                row.push(h.unitNAV.toFixed(4), fmtChg(h.dailyGrowthRate));
            } else {
                row.push("-", "-");
            }
        }
        rows.push(row);
    });

    const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] || "").length)));
    const formatRow = (r: string[]) => r.map((c, i) => (c || "").padEnd(colWidths[i])).join(" | ");
    
    let matrixOutput = formatRow(headers) + "\n";
    matrixOutput += colWidths.map(w => "-".repeat(w)).join("-|-") + "\n";
    rows.forEach(r => {
        matrixOutput += formatRow(r) + "\n";
    });

    return lines.join('\n') + "\n\n" + matrixOutput;
};
