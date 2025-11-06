import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Fund } from './types';
import { fetchFundData, fetchFundDetails } from './services/fundService';
import FundInputForm from './components/FundInputForm';
import FundRow from './components/FundRow';
import FundDetailModal from './components/FundDetailModal';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

const App: React.FC = () => {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState<number>(100);
  const [zigzagThreshold, setZigzagThreshold] = useState<number>(0.5);
  const [selectedFundForModal, setSelectedFundForModal] = useState<Fund | null>(null);

  useEffect(() => {
    const loadSavedFunds = async () => {
      setIsAppLoading(true);
      setError(null);
      try {
        const savedCodesJSON = localStorage.getItem('subscribedFundCodes');
        if (savedCodesJSON) {
          const savedCodes: string[] = JSON.parse(savedCodesJSON);
          if (Array.isArray(savedCodes) && savedCodes.length > 0) {
            
            const fundsPromises = savedCodes.map(async (code) => {
              const [data, details] = await Promise.all([
                fetchFundData(code, recordCount),
                fetchFundDetails(code)
              ]);

              if (data.length > 0) {
                const latestData = data[data.length - 1];
                return {
                  code,
                  name: details.name,
                  realTimeData: details.realTimeData,
                  data,
                  latestNAV: latestData?.unitNAV,
                  latestChange: latestData?.dailyGrowthRate,
                  color: '',
                };
              }
              return null;
            });
            
            const loadedFundsData = (await Promise.all(fundsPromises)).filter(Boolean) as Omit<Fund, 'color'>[];
            const loadedFundsWithColor = loadedFundsData.map((fund, index) => ({
              ...fund,
              color: COLORS[index % COLORS.length]
            }));
            
            setFunds(loadedFundsWithColor);
          }
        }
      } catch (err) {
        setError("Failed to load saved funds. They may be out of date or the API is unavailable.");
        localStorage.removeItem('subscribedFundCodes');
      } finally {
        setIsAppLoading(false);
      }
    };

    loadSavedFunds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAppLoading) {
      const fundCodes = funds.map(f => f.code);
      localStorage.setItem('subscribedFundCodes', JSON.stringify(fundCodes));
    }
  }, [funds, isAppLoading]);


  const handleAddFund = useCallback(async (code: string) => {
    if (!code.trim()) {
      setError('Please provide a fund code.');
      return;
    }
    if (funds.some(f => f.code === code)) {
      setError(`Fund ${code} is already being tracked.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [data, details] = await Promise.all([
        fetchFundData(code, recordCount),
        fetchFundDetails(code)
      ]);

      if (data.length === 0) {
        setError(`No data found for fund ${code}.`);
      } else {
        const latestData = data[data.length - 1];
        const newFund: Fund = {
          code,
          name: details.name,
          realTimeData: details.realTimeData,
          data,
          latestNAV: latestData?.unitNAV,
          latestChange: latestData?.dailyGrowthRate,
          color: COLORS[funds.length % COLORS.length],
        };
        setFunds(prevFunds => [...prevFunds, newFund]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [funds, recordCount]);
  
  const handleRefresh = useCallback(async () => {
    if (funds.length === 0) return;

    setIsRefreshing(true);
    setError(null);
    try {
      const updatedFundsPromises = funds.map(async (fund) => {
        const details = await fetchFundDetails(fund.code);
        return {
          ...fund,
          realTimeData: details.realTimeData,
        };
      });

      const updatedFunds = await Promise.all(updatedFundsPromises);
      setFunds(updatedFunds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while refreshing data.');
    } finally {
      setIsRefreshing(false);
    }
  }, [funds]);


  const handleRecordCountChange = useCallback(async (newRecordCount: number) => {
    setRecordCount(newRecordCount);
    if (funds.length === 0) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const updatedFundsPromises = funds.map(async (fund) => {
        const newData = await fetchFundData(fund.code, newRecordCount);
        const latestData = newData[newData.length - 1];
        return { 
          ...fund, 
          data: newData,
          latestNAV: latestData?.unitNAV,
          latestChange: latestData?.dailyGrowthRate,
        };
      });

      const updatedFunds = await Promise.all(updatedFundsPromises);
      setFunds(updatedFunds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while updating funds.');
    } finally {
      setIsLoading(false);
    }
  }, [funds]);
  
  const handleDeleteFund = useCallback((codeToDelete: string) => {
    setFunds(prevFunds => prevFunds.filter(fund => fund.code !== codeToDelete));
    setSelectedFundForModal(null);
  }, []);

  const handleShowFundDetails = useCallback((fund: Fund) => {
    setSelectedFundForModal(fund);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedFundForModal(null);
  }, []);

  const handleZigzagThresholdChange = useCallback((threshold: number) => {
    setZigzagThreshold(threshold);
  }, []);

  const dateHeaders = useMemo(() => {
    if (funds.length === 0) return [];
    
    const allDates = new Set<string>();
    funds.forEach(fund => {
      fund.data.forEach(dataPoint => {
        allDates.add(dataPoint.date);
      });
    });

    return Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [funds]);

  const getWeekday = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[date.getDay()];
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200 font-sans p-4">
      {isAppLoading ? (
         <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Loading Your Funds...</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Please wait while we fetch the latest data.
          </p>
        </div>
      ) : funds.length > 0 ? (
        <div className="w-full overflow-x-auto bg-white dark:bg-gray-900 rounded-lg shadow-md">
          <table className="w-full text-sm text-center border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[200px] min-w-[200px] text-left sticky top-0 left-0 bg-gray-50 dark:bg-gray-800 z-20">基金名称</th>
                <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[300px] min-w-[300px] sticky top-0 left-[200px] bg-gray-50 dark:bg-gray-800 z-20">净值走势</th>
                <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[60px] min-w-[60px] sticky top-0 left-[500px] bg-gray-50 dark:bg-gray-800 z-20">实时估值</th>
                {dateHeaders.map(date => (
                  <th key={date} className="p-0 border-r dark:border-gray-700 font-normal text-gray-500 dark:text-gray-400 min-w-[60px] sticky top-0 bg-gray-50 dark:bg-gray-800">
                    {date.substring(5)}{getWeekday(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="relative z-0">
              {funds.map(fund => (
                <FundRow 
                  key={fund.code} 
                  fund={fund} 
                  dateHeaders={dateHeaders} 
                  onShowDetails={handleShowFundDetails}
                  zigzagThreshold={zigzagThreshold}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">暂无基金数据</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            输入基金代码，开始跟踪对比。
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mt-6">
        <FundInputForm 
          onAddFund={handleAddFund} 
          isLoading={isLoading || isAppLoading}
          recordCount={recordCount}
          onRecordCountChange={handleRecordCountChange}
          zigzagThreshold={zigzagThreshold}
          onZigzagThresholdChange={handleZigzagThresholdChange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
      </div>
      
      {selectedFundForModal && (
        <FundDetailModal 
          fund={selectedFundForModal}
          onClose={handleCloseModal}
          onDelete={handleDeleteFund}
          zigzagThreshold={zigzagThreshold}
        />
      )}
    </div>
  );
};

export default App;
