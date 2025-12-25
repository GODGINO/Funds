
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
// NOTE: We keep the fallback serial (using a promise chain) because the fallback API 
// (eastmoney/pingzhongdata) pollutes global variables (fS_name, etc.) without a unique ID in the response.
// Running these in parallel would cause race conditions on the global variables.
let fundDetailsFallbackPromise: Promise<void> = Promise.resolve();

function fetchFundDetailsFallback(code: string): Promise<{ name: string; realTimeData?: undefined }> {
    const fetchPromise = () => new Promise<{ name: string; realTimeData?: undefined }>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${new Date().getTime()}`;
        script.charset = 'gbk';

        script.onload = () => {
            document.head.removeChild(script);
            const fundName = (window as any).fS_name;
            
            // Cleanup global variables to avoid pollution.
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

// --- JSONP implementation for fundgz.1234567.com.cn ---

// CONCURRENCY UPGRADE:
// Instead of a serial queue, we use a "Global Router Pattern".
// The server always calls `jsonpgz(data)`. We define this function ONCE.
// It looks at `data.fundcode` and routes the response to the correct pending Promise.
// This allows full concurrency.

const activeRequests = new Map<string, (data: any) => void>();

// Initialize the global JSONP router once
if (!(window as any).jsonpgz) {
    (window as any).jsonpgz = (data: any) => {
        // The API returns 'fundcode' in the data object
        const code = data?.fundcode;
        if (code && activeRequests.has(code)) {
            const handler = activeRequests.get(code);
            if (handler) {
                handler(data);
                // We don't delete immediately here to be safe, logic handles cleanup via callback execution
            }
        }
    };
}

// In-memory cache for fund details
if (!(window as any)._fundDetailsCache) {
    (window as any)._fundDetailsCache = {};
}
const fundDetailsCache: { [code: string]: { name: string; realTimeData?: RealTimeData } } = (window as any)._fundDetailsCache;


export function fetchFundDetails(code: string): Promise<{ name: string; realTimeData?: RealTimeData }> {
    
    // Concurrent Primary Fetcher
    const fetchPrimary = () => new Promise<{ name: string; realTimeData?: RealTimeData }>((resolve, reject) => {
        // Register the handler for this specific fund code
        activeRequests.set(code, (data: any) => {
            // Remove from active requests
            activeRequests.delete(code);
            
            if (data && data.name) {
                const estimatedNAV = parseFloat(data.gsz);
                if (!isNaN(estimatedNAV)) {
                    const realTimeData: RealTimeData = {
                        estimatedNAV: estimatedNAV,
                        estimatedChange: data.gszzl,
                        estimationTime: data.gztime,
                    };
                    resolve({ 
                        name: data.name,
                        realTimeData: realTimeData
                    });
                } else {
                    // Fund exists, but no valid real-time data
                    resolve({
                        name: data.name,
                        realTimeData: undefined
                    });
                }
            } else {
                reject(new Error('no_fund_details'));
            }
        });

        const script = document.createElement('script');
        // Add timestamp to bypass browser cache
        script.src = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${new Date().getTime()}`;
        script.charset = 'utf-8';

        script.onload = () => {
            document.head.removeChild(script);
            // If the script loaded but didn't execute the callback (e.g. empty file or bad format),
            // we need a timeout or a check. But usually, if it loads, jsonpgz fires first.
            // We'll leave the cleanup to the handler or the timeout logic if we added one.
            // For now, if the API returns 200 OK but invalid JS, the promise might hang without a timeout wrapper.
            // Adding a simple safety cleanup if handler wasn't called:
             setTimeout(() => {
                if (activeRequests.has(code)) {
                    activeRequests.delete(code);
                    reject(new Error('timeout_or_parse_error'));
                }
            }, 2000); // 2s safety timeout after load
        };

        script.onerror = () => {
            document.head.removeChild(script);
            activeRequests.delete(code);
            reject(new Error('network_error'));
        };

        document.head.appendChild(script);
    });

    // Robust Logic:
    // 1. Try Primary (Concurrent).
    // 2. If Primary fails, CHECK CACHE FIRST. If cache has real data, use it.
    // 3. Only if Cache is useless, use Fallback (Serialized).
    
    // Note: We removed the `fundDetailsPromise` chain. `fetchPrimary` is now called immediately.
    const robustFetch = fetchPrimary().then(details => {
        // Primary success: update cache
        fundDetailsCache[code] = details;
        return details;
    }).catch(error => {
        // Primary failed. Check cache for valid data.
        const cachedData = fundDetailsCache[code];
        if (cachedData && cachedData.realTimeData) {
            console.warn(`[FundService] Primary fetch failed for ${code}, using cached real-time data.`);
            return cachedData;
        }

        // Cache is missing or invalid. Now we must try fallback to at least get the Name.
        console.warn(`[FundService] Primary fetch failed for ${code} and no cache. Trying fallback.`);
        return fetchFundDetailsFallback(code).then(fallbackDetails => {
             // Fallback success (got name). Update cache, preserving existing if any race occurred (unlikely).
             fundDetailsCache[code] = fallbackDetails;
             return fallbackDetails;
        });
    });

    return robustFetch;
}

// --- JSONP-style implementation for fund.eastmoney.com ---

// Global promise to serialize page fetches for fund data (eastmoney) to avoid race conditions
// on the global `apidata` variable.
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
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            if ((window as any).apidata) {
                (window as any).apidata = undefined;
            }
            reject(new Error(`Failed to load script from ${url}.`));
        };
        document.head.appendChild(script);
    });

    const result = fundDataPagePromise.then(() => fetchPromise());
    // FIX: Ensure the promise assigned back to fundDataPagePromise resolves to void to match its inferred type.
    fundDataPagePromise = result.then(() => {}, () => {}); // Chain and prevent unhandled rejections
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
      } catch (error) {
        attempts++;
        lastError = error;
      }
    }

    if (!success) {
      console.warn(`Could not fetch page ${page} for fund ${code} after ${MAX_RETRIES} attempts. This is a non-critical error, and the app will proceed with the data loaded so far. Final error:`, lastError);
      break;
    }

    allData.push(...pageData);

    if (pageData.length < recordsPerPage) {
      break;
    }
  }

  return allData.slice(0, recordCount).reverse();
}

// --- Index Data ---
export async function fetchIndexData(): Promise<IndexData | null> {
    try {
        const EXPIRY_MS = 60 * 1000; // 1 minute cache
        const now = Date.now();
        const cache = (window as any)._sseIndexCache || null;

        if (cache && (now - cache.timestamp) < EXPIRY_MS) {
            const { first, latest } = cache.data;
            const change = latest - first;
            const changePercent = first > 0 ? (change / first) * 100 : 0;
            return {
                value: latest,
                change,
                changePercent,
            };
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

        const firstStr = arr[0];
        const lastStr = arr[arr.length - 1];
        const first = parseVal(firstStr);
        const latest = parseVal(lastStr);

        if (first == null || latest == null) throw new Error('SSE parse error');

        (window as any)._sseIndexCache = {
            timestamp: now,
            data: { first, latest }
        };

        const change = latest - first;
        const changePercent = first > 0 ? (change / first) * 100 : 0;

        return {
            value: latest,
            change,
            changePercent,
        };
    } catch (error) {
        // On failure, return stale cache data if available.
        if ((window as any)._sseIndexCache) {
             const { first, latest } = (window as any)._sseIndexCache.data;
             const change = latest - first;
             const changePercent = first > 0 ? (change / first) * 100 : 0;
             return {
                 value: latest,
                 change,
                 changePercent,
             };
        }
        return null;
    }
}

// --- Total Turnover (Both Markets) with LocalStorage Caching ---
// Strategy:
// 1. Fetch Today's real-time minute data.
// 2. Since historical APIs are flaky, we implement a "Self-Recording" mechanism.
//    If today's market is closed (time >= 15:00), we save today's full curve to localStorage.
// 3. To compare, we try to load the "Most Recent Previous Day" from localStorage.
//    If found, we sum its turnover up to the current time and calculate the diff.

const MARKET_HISTORY_KEY = 'ginos_market_history_v1';

export function getLocalMarketHistory(): Record<string, MarketDataPoint[]> {
    try {
        return JSON.parse(localStorage.getItem(MARKET_HISTORY_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveLocalMarketHistory(date: string, data: MarketDataPoint[]) {
    const history = getLocalMarketHistory();
    history[date] = data;
    
    // Prune: Keep only last 5 days to safe space
    const dates = Object.keys(history).sort();
    if (dates.length > 5) {
        const newHistory: any = {};
        dates.slice(-5).forEach(d => newHistory[d] = history[d]);
        localStorage.setItem(MARKET_HISTORY_KEY, JSON.stringify(newHistory));
    } else {
        localStorage.setItem(MARKET_HISTORY_KEY, JSON.stringify(history));
    }
}

export async function fetchTotalTurnover(): Promise<TurnoverResult | null> {
    try {
        const EXPIRY_MS = 60 * 1000; // 1 minute cache
        const now = Date.now();
        const cache = (window as any)._sseTurnoverCache || null;

        if (cache && (now - cache.timestamp) < EXPIRY_MS) {
            return cache.data;
        }

        // Fetch Today's Trends (Real-time minute data)
        const fetchTrends = async (secid: string, fields: string) => {
            const url = `https://push2delay.eastmoney.com/api/qt/stock/trends2/get?secid=${secid}&fields1=f1&fields2=${fields}&ndays=1&iscr=0&_=${now}`;
            const res = await fetch(url, { cache: 'no-store' });
            return res.json();
        };

        // fields2=f51,f52,f57 returns "Date Time, Index, TurnoverAmount"
        const [shData, szData] = await Promise.all([
            fetchTrends('1.000001', 'f51,f52,f57'),
            fetchTrends('0.399001', 'f51,f57')
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

        // SH Index API (trends2) starts from 09:15
        // Align SZ to SH timeline
        const combinedPoints: MarketDataPoint[] = [];
        const szMap = new Map(szPoints.map((p: any) => [p.t, p.val]));
        const todayDate = shPoints[0].d;

        for (const shP of shPoints) {
            const szVal = szMap.get(shP.t) || 0;
            // Pad 9:15-9:30 turnover with 0 per user request
            const val = shP.t < "09:30" ? 0 : (shP.val + szVal);
            
            combinedPoints.push({
                t: shP.t,
                val: val,
                ind: shP.ind
            });
        }

        if (combinedPoints.length === 0) return null;

        // 1. Calculate Today's Cumulative Turnover
        const totalToday = combinedPoints.reduce((acc, p) => acc + p.val, 0);
        const lastPoint = combinedPoints[combinedPoints.length - 1];
        const latestTime = lastPoint.t;

        // 2. Persistence Logic: If market is closed (>15:00), save today's curve to LS
        if (latestTime >= "15:00") {
             saveLocalMarketHistory(todayDate, combinedPoints);
        }

        // 3. Comparison Logic: Find "Yesterday" from LocalStorage
        const history = getLocalMarketHistory();
        const historyDates = Object.keys(history).filter(d => d !== todayDate).sort();
        const yesterdayDate = historyDates[historyDates.length - 1]; 
        
        let yesterdaySum = 0;
        let hasYesterday = false;

        if (yesterdayDate) {
            const yesterdayPoints = history[yesterdayDate];
            if (Array.isArray(yesterdayPoints)) {
                // Sum turnover up to the SAME TIME as today
                yesterdaySum = yesterdayPoints.reduce((acc, p) => {
                    return p.t <= latestTime ? acc + p.val : acc;
                }, 0);
                if (yesterdaySum > 0) hasYesterday = true;
            }
        }

        // 4. Format Output
        const toTrillion = (val: number) => (val / 1000000000000).toFixed(2);
        let result = `${toTrillion(totalToday)}`;
        
        if (hasYesterday) {
             const diff = totalToday - yesterdaySum;
             const sign = diff >= 0 ? '+' : '';
             result += ` (${sign}${toTrillion(diff)})`;
        }

        const turnoverResult: TurnoverResult = {
            display: result,
            points: combinedPoints
        };

        // Cache
        (window as any)._sseTurnoverCache = {
            timestamp: now,
            data: turnoverResult
        };

        return turnoverResult;

    } catch (error) {
        console.error("Turnover Fetch Error", error);
        if ((window as any)._sseTurnoverCache) {
             return (window as any)._sseTurnoverCache.data;
        }
        return null;
    }
}
