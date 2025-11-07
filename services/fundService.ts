import { FundDataPoint, RealTimeData } from '../types';

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

// Global promise to serialize requests to fund details API (fundgz) to avoid race conditions
// on the global `jsonpgz` callback function.
let fundDetailsPromise: Promise<void> = Promise.resolve();

export function fetchFundDetails(code: string): Promise<{ name: string; realTimeData?: RealTimeData }> {
    const fetchPrimary = () => new Promise<{ name: string; realTimeData?: RealTimeData }>((resolve, reject) => {
        const script = document.createElement('script');
        // Add a timestamp to prevent browser caching
        script.src = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${new Date().getTime()}`;
        script.charset = 'utf-8';

        (window as any).jsonpgz = (data: any) => {
            document.head.removeChild(script);
            (window as any).jsonpgz = undefined;

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
                    // Fund exists, but no valid real-time data (e.g., gsz is '--')
                    resolve({
                        name: data.name,
                        realTimeData: undefined
                    });
                }
            } else {
                 // No data or no name in response (e.g., empty jsonpgz() call)
                reject(new Error('no_fund_details'));
            }
        };

        script.onerror = () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            if ((window as any).jsonpgz) {
                (window as any).jsonpgz = undefined;
            }
            reject(new Error('network_error'));
        };

        document.head.appendChild(script);
    });

    const serializedFetch = fundDetailsPromise.then(() => fetchPrimary());
    // FIX: Ensure the promise assigned back to fundDetailsPromise resolves to void to match its inferred type.
    fundDetailsPromise = serializedFetch.then(() => {}, () => {}); // Chain and prevent unhandled rejections from breaking the chain
    
    return serializedFetch.catch(error => {
        return fetchFundDetailsFallback(code).catch(fallbackError => {
            // If fallback also fails, throw a more specific error.
            throw new Error(`Failed to fetch fund details for ${code} from both primary and fallback sources. The fund might not exist or the code is incorrect.`);
        });
    });
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

  for (let page = 1; page <= pagesToFetch; page++) {
    try {
      const targetUrl = `https://fund.eastmoney.com/f10/F10DataApi.aspx?type=lsjz&code=${code}&page=${page}&per=${recordsPerPage}&_=${new Date().getTime()}`;
      const pageData = await fetchEastmoneyPage(targetUrl);
      allData.push(...pageData);

      // Stop if we received an empty page, or less than a full page, indicating no more data.
      if (pageData.length < recordsPerPage) {
          break;
      }
    } catch (error) {
        console.error(`Error fetching page ${page} for fund ${code}:`, error);
        // On error, we stop fetching more pages for this fund and return what we have so far.
        // This makes it more resilient to single page failures.
        break; 
    }
  }

  return allData.slice(0, recordCount).reverse();
}