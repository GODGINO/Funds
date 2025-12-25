
import { FundDataPoint, RealTimeData, IndexData, MarketDataPoint, TurnoverResult } from '../types';

function parseHtmlTable(htmlContent: string): FundDataPoint[] {
    const data: FundDataPoint[] = [];
    const tableRegex = /<table class='w782 comm lsjz'>.*?<tbody>(.*?)<\/tbody>.*?<\/table>/s;
    const rowRegex = /<tr>(.*?)<\/tr>/gs;
    const cellRegex = /<td.*?>(.*?)<\/td>/gs;

    const tableMatch = htmlContent.match(tableRegex);
    if (!tableMatch || !tableMatch[1]) {
        return [];
    }
    
    const tableBody = tableMatch[1];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
        const rowContent = rowMatch[1];
        const cells: string[] = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
        }

        if (cells.length >= 4) {
             const unitNAV = parseFloat(cells[1]);
             if (isNaN(unitNAV) || unitNAV === 0) continue; 

            data.push({
                date: cells[0],
                unitNAV: unitNAV,
                cumulativeNAV: parseFloat(cells[2]),
                dailyGrowthRate: cells[3],
                subscriptionStatus: cells[4] || 'N/A',
                redemptionStatus: cells[5] || 'N/A',
                dividendDistribution: cells[6] || 'N/A',
            });
        }
    }
    return data;
}

// Fallback function for fund details
let fundDetailsFallbackPromise: Promise<void> = Promise.resolve();

function fetchFundDetailsFallback(code: string): Promise<{ name: string; realTimeData?: undefined }> {
    const fetchPromise = () => new Promise<{ name: string; realTimeData?: undefined }>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${new Date().getTime()}`;
        script.charset = 'gbk';

        script.onload = () => {
            document.head.removeChild(script);
            const fundName = (window as any).fS_name;
            
            const varsToClean = ['ishb', 'fS_name', 'fS_code', 'fund_sourceRate', 'fund_Rate', 'fund_minsg', 'stockCodes', 'zqCodes', 'stockCodesNew', 'zqCodesNew', 'syl_1n', 'syl_6y', 'syl_3y', 'syl_1y', 'Data_fundSharesPositions', 'Data_netWorthTrend'];
            varsToClean.forEach(v => {
                try {
                    if ((window as any)[v] !== undefined) delete (window as any)[v];
                } catch (e) {
                    (window as any)[v] = undefined;
                }
            });

            if (fundName) {
                resolve({ name: fundName, realTimeData: undefined });
            } else {
                reject(new Error(`Could not parse fallback fund details for ${code}.`));
            }
        };

        script.onerror = () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            reject(new Error(`Failed to fetch fallback fund details for ${code}.`));
        };

        document.head.appendChild(script);
    });

    const result = fundDetailsFallbackPromise.then(() => fetchPromise());
    fundDetailsFallbackPromise = result.then(() => {}, () => {}); 
    return result;
}

const activeRequests = new Map<string, (data: any) => void>();

if (!(window as any).jsonpgz) {
    (window as any).jsonpgz = (data: any) => {
        const code = data?.fundcode;
        if (code && activeRequests.has(code)) {
            const handler = activeRequests.get(code);
            if (handler) {
                handler(data);
            }
        }
    };
}

if (!(window as any)._fundDetailsCache) {
    (window as any)._fundDetailsCache = {};
}
const fundDetailsCache: { [code: string]: { name: string; realTimeData?: RealTimeData } } = (window as any)._fundDetailsCache;


export function fetchFundDetails(code: string): Promise<{ name: string; realTimeData?: RealTimeData }> {
    const fetchPrimary = () => new Promise<{ name: string; realTimeData?: RealTimeData }>((resolve, reject) => {
        activeRequests.set(code, (data: any) => {
            activeRequests.delete(code);
            if (data && data.name) {
                const estimatedNAV = parseFloat(data.gsz);
                if (!isNaN(estimatedNAV)) {
                    const realTimeData: RealTimeData = {
                        estimatedNAV: estimatedNAV,
                        estimatedChange: data.gszzl,
                        estimationTime: data.gztime,
                    };
                    resolve({ name: data.name, realTimeData: realTimeData });
                } else {
                    resolve({ name: data.name, realTimeData: undefined });
                }
            } else {
                reject(new Error('no_fund_details'));
            }
        });

        const script = document.createElement('script');
        script.src = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${new Date().getTime()}`;
        script.charset = 'utf-8';
        script.onload = () => {
            document.head.removeChild(script);
             setTimeout(() => {
                if (activeRequests.has(code)) {
                    activeRequests.delete(code);
                    reject(new Error('timeout_or_parse_error'));
                }
            }, 2000); 
        };
        script.onerror = () => {
            document.head.removeChild(script);
            activeRequests.delete(code);
            reject(new Error('network_error'));
        };
        document.head.appendChild(script);
    });

    const robustFetch = fetchPrimary().then(details => {
        fundDetailsCache[code] = details;
        return details;
    }).catch(error => {
        const cachedData = fundDetailsCache[code];
        if (cachedData && cachedData.realTimeData) {
            return cachedData;
        }
        return fetchFundDetailsFallback(code).then(fallbackDetails => {
             fundDetailsCache[code] = fallbackDetails;
             return fallbackDetails;
        });
    });

    return robustFetch;
}

let fundDataPagePromise: Promise<void> = Promise.resolve();

function fetchEastmoneyPage(url: string): Promise<FundDataPoint[]> {
    const fetchPromise = () => new Promise<FundDataPoint[]>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.charset = 'utf-8';
        script.onload = () => {
            const apiData = (window as any).apidata;
            document.head.removeChild(script);
            (window as any).apidata = undefined;
            if (!apiData || !apiData.content) {
                resolve([]);
                return;
            }
            resolve(parseHtmlTable(apiData.content));
        };
        script.onerror = () => {
            if (script.parentNode) { script.parentNode.removeChild(script); }
            if ((window as any).apidata) { (window as any).apidata = undefined; }
            reject(new Error(`Failed to load script from ${url}.`));
        };
        document.head.appendChild(script);
    });
    const result = fundDataPagePromise.then(() => fetchPromise());
    fundDataPagePromise = result.then(() => {}, () => {}); 
    return result;
}

export async function fetchFundData(
  code: string,
  recordCount: number
): Promise<FundDataPoint[]> {
  const recordsPerPage = 49;
  const pagesToFetch = Math.ceil(recordCount / recordsPerPage);
  const allData: FundDataPoint[] = [];
  const MAX_RETRIES = 10;

  for (let page = 1; page <= pagesToFetch; page++) {
    let success = false;
    let attempts = 0;
    let pageData: FundDataPoint[] = [];
    let lastError: unknown = null;
    while (!success && attempts < MAX_RETRIES) {
      try {
        const targetUrl = `https://fund.eastmoney.com/f10/F10DataApi.aspx?type=lsjz&code=${code}&page=${page}&per=${recordsPerPage}&_=${new Date().getTime()}`;
        pageData = await fetchEastmoneyPage(targetUrl);
        success = true;
      } catch (error) { attempts++; lastError = error; }
    }
    if (!success) break;
    allData.push(...pageData);
    if (pageData.length < recordsPerPage) break;
  }
  return allData.slice(0, recordCount).reverse();
}

// --- Index Data ---
export async function fetchIndexData(): Promise<IndexData | null> {
    try {
        const EXPIRY_MS = 60 * 1000;
        const now = Date.now();
        const cache = (window as any)._sseIndexCache || null;
        if (cache && (now - cache.timestamp) < EXPIRY_MS) {
            const { first, latest } = cache.data;
            return { value: latest, change: latest - first, changePercent: first > 0 ? ((latest - first) / first) * 100 : 0 };
        }
        const ts = Date.now();
        const url = `https://push2delay.eastmoney.com/api/qt/stock/trends2/get?secid=1.000001&fields1=f1,f2,f3&fields2=f51,f52&ndays=1&_=${ts}`;
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error('SSE index fetch failed');
        const json = await resp.json();
        const arr = (json?.data?.trends && Array.isArray(json.data.trends)) ? json.data.trends : [];
        if (!arr.length) throw new Error('SSE trends empty');
        const parseVal = (s: string): number | null => {
            if (!s) return null;
            const parts = String(s).split(',');
            if (parts.length < 2) return null;
            const v = parseFloat(parts[1]);
            return isNaN(v) ? null : v;
        };
        const first = parseVal(arr[0]);
        const latest = parseVal(arr[arr.length - 1]);
        if (first == null || latest == null) throw new Error('SSE parse error');
        (window as any)._sseIndexCache = { timestamp: now, data: { first, latest } };
        return { value: latest, change: latest - first, changePercent: first > 0 ? ((latest - first) / first) * 100 : 0 };
    } catch (error) {
        if ((window as any)._sseIndexCache) {
             const { first, latest } = (window as any)._sseIndexCache.data;
             return { value: latest, change: latest - first, changePercent: first > 0 ? ((latest - first) / first) * 100 : 0 };
        }
        return null;
    }
}

const MARKET_HISTORY_KEY = 'ginos_market_history_v1';
export function getLocalMarketHistory(): Record<string, MarketDataPoint[]> {
    try { return JSON.parse(localStorage.getItem(MARKET_HISTORY_KEY) || '{}'); } catch { return {}; }
}
function saveLocalMarketHistory(date: string, data: MarketDataPoint[]) {
    const history = getLocalMarketHistory();
    history[date] = data;
    const dates = Object.keys(history).sort();
    if (dates.length > 5) {
        const newHistory: any = {};
        dates.slice(-5).forEach(d => newHistory[d] = history[d]);
        localStorage.setItem(MARKET_HISTORY_KEY, JSON.stringify(newHistory));
    } else { localStorage.setItem(MARKET_HISTORY_KEY, JSON.stringify(history)); }
}

export async function fetchTotalTurnover(): Promise<TurnoverResult | null> {
    try {
        const now = Date.now();
        const cache = (window as any)._sseTurnoverCache || null;
        if (cache && (now - cache.timestamp) < 60000) return cache.data;

        const fetchTrends = async (secid: string, fields: string) => {
            const url = `https://push2delay.eastmoney.com/api/qt/stock/trends2/get?secid=${secid}&fields1=f1&fields2=${fields}&ndays=1&iscr=0&_=${now}`;
            const res = await fetch(url, { cache: 'no-store' });
            return res.json();
        };

        const [shData, szData] = await Promise.all([
            fetchTrends('1.000001', 'f51,f52,f57'), // SH Index starts from 9:15
            fetchTrends('0.399001', 'f51,f57')      // SZ Index starts from 9:30
        ]);

        const parseTrends = (data: any, isSH: boolean) => {
            const trends = data?.data?.trends;
            if (!Array.isArray(trends)) return [];
            return trends.map((item: string) => {
                const parts = item.split(',');
                if (isSH) {
                    if (parts.length < 3) return null;
                    const [dt, indStr, valStr] = parts;
                    const [d, t] = dt.split(' ');
                    const ind = parseFloat(indStr);
                    const val = parseFloat(valStr);
                    if (!d || !t || isNaN(ind) || isNaN(val)) return null;
                    return { d, t, val, ind };
                } else {
                    if (parts.length < 2) return null;
                    const [dt, valStr] = parts;
                    const [d, t] = dt.split(' ');
                    const val = parseFloat(valStr);
                    if (!d || !t || isNaN(val)) return null;
                    return { d, t, val };
                }
            }).filter((x): x is any => x !== null);
        };

        const shPoints = parseTrends(shData, true);
        const szPoints = parseTrends(szData, false);
        if (shPoints.length === 0) return null;

        const combinedPoints: MarketDataPoint[] = [];
        const szMap = new Map(szPoints.map((p: any) => [p.t, p.val]));
        const todayDate = shPoints[0].d;

        for (const shP of shPoints) {
            const szVal = szMap.get(shP.t) || 0;
            // 9:15 - 9:30: Indices are present, but Turnover is 0
            const val = shP.t < "09:30" ? 0 : (shP.val + szVal);
            combinedPoints.push({ t: shP.t, val: val, ind: shP.ind });
        }

        const totalToday = combinedPoints.reduce((acc, p) => acc + p.val, 0);
        const latestTime = combinedPoints[combinedPoints.length - 1].t;
        if (latestTime >= "15:00") saveLocalMarketHistory(todayDate, combinedPoints);

        const history = getLocalMarketHistory();
        const historyDates = Object.keys(history).filter(d => d !== todayDate).sort();
        const yesterdayDate = historyDates[historyDates.length - 1]; 
        let yesterdaySum = 0;
        if (yesterdayDate) {
            yesterdaySum = history[yesterdayDate].reduce((acc, p) => p.t <= latestTime ? acc + p.val : acc, 0);
        }

        const toTrillion = (val: number) => (val / 1000000000000).toFixed(2);
        let display = `${toTrillion(totalToday)}`;
        if (yesterdaySum > 0) {
             const diff = totalToday - yesterdaySum;
             display += ` (${diff >= 0 ? '+' : ''}${toTrillion(diff)})`;
        }

        const turnoverResult: TurnoverResult = { display, points: combinedPoints };
        (window as any)._sseTurnoverCache = { timestamp: now, data: turnoverResult };
        return turnoverResult;
    } catch (error) {
        if ((window as any)._sseTurnoverCache) return (window as any)._sseTurnoverCache.data;
        return null;
    }
}
