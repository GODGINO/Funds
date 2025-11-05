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

// --- JSONP implementation for fundgz.1234567.com.cn ---

// Global promise to serialize requests to fund details API (fundgz) to avoid race conditions
// on the global `jsonpgz` callback function.
let fundDetailsPromise: Promise<void> = Promise.resolve();

export function fetchFundDetails(code: string): Promise<{ name: string; realTimeData?: RealTimeData }> {
    const fetchPromise = () => new Promise<{ name: string; realTimeData?: RealTimeData }>((resolve, reject) => {
        const script = document.createElement('script');
        // Add a timestamp to prevent browser caching
        script.src = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${new Date().getTime()}`;
        script.charset = 'utf-8';

        (window as any).jsonpgz = (data: any) => {
            document.head.removeChild(script);
            (window as any).jsonpgz = undefined;

            if (data && data.name) {
                const realTimeData: RealTimeData = {
                    estimatedNAV: parseFloat(data.gsz),
                    estimatedChange: data.gszzl,
                    estimationTime: data.gztime,
                };
                resolve({ 
                    name: data.name,
                    realTimeData: realTimeData
                });
            } else {
                reject(new Error(`Could not parse fund details for ${code}. The fund might not exist.`));
            }
        };

        script.onerror = () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            if ((window as any).jsonpgz) {
                (window as any).jsonpgz = undefined;
            }
            reject(new Error(`Failed to fetch fund details for ${code}. Check the fund code and your network connection.`));
        };

        document.head.appendChild(script);
    });

    const result = fundDetailsPromise.then(() => fetchPromise());
    // FIX: Ensure the promise assigned back to fundDetailsPromise resolves to void to match its inferred type.
    fundDetailsPromise = result.then(() => {}, () => {}); // Chain and prevent unhandled rejections from breaking the chain
    
    return result;
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

  // If after all attempts we have no data, throw an error. This is important for the initial add.
  if (allData.length === 0) {
      throw new Error(`Could not fetch any historical data for fund ${code}.`);
  }

  return allData.slice(0, recordCount).reverse();
}