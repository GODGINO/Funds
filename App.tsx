import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Fund, UserPosition } from './types';
import { fetchFundData, fetchFundDetails } from './services/fundService';
import FundInputForm from './components/FundInputForm';
import FundRow from './components/FundRow';
import FundDetailModal from './components/FundDetailModal';
import { calculateZigzag } from './services/chartUtils';
import ControlsCard from './components/ControlsCard';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

type SortByType = 'trend' | 'dailyChange' | 'navPercentile';

const App: React.FC = () => {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState<number>(100);
  const [zigzagThreshold, setZigzagThreshold] = useState<number>(0.5);
  const [selectedFundForModal, setSelectedFundForModal] = useState<Fund | null>(null);
  const [sortBy, setSortBy] = useState<SortByType>('trend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    const loadSavedFunds = async () => {
      setIsAppLoading(true);
      setError(null);
      try {
        const savedPositionsJSON = localStorage.getItem('userFundPortfolio');
        if (savedPositionsJSON) {
          const savedPositions: UserPosition[] = JSON.parse(savedPositionsJSON);
          if (Array.isArray(savedPositions) && savedPositions.length > 0) {
            
            const fundsPromises = savedPositions.map(async (position) => {
              const [data, details] = await Promise.all([
                fetchFundData(position.code, recordCount),
                fetchFundDetails(position.code)
              ]);

              if (data.length > 0) {
                const latestData = data[data.length - 1];
                return {
                  code: position.code,
                  name: details.name,
                  realTimeData: details.realTimeData,
                  data,
                  latestNAV: latestData?.unitNAV,
                  latestChange: latestData?.dailyGrowthRate,
                  color: '',
                  userPosition: position,
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
        localStorage.removeItem('userFundPortfolio');
      } finally {
        setIsAppLoading(false);
      }
    };

    loadSavedFunds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAppLoading) {
      const positionsToSave = funds
        .map(f => f.userPosition)
        .filter((p): p is UserPosition => !!p);
      localStorage.setItem('userFundPortfolio', JSON.stringify(positionsToSave));
    }
  }, [funds, isAppLoading]);


  const handleAddFund = useCallback(async (details: { code: string; shares: number; cost: number; tag: string }) => {
    const { code, shares, cost, tag } = details;
    
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
      const [data, fundDetails] = await Promise.all([
        fetchFundData(code, recordCount),
        fetchFundDetails(code)
      ]);

      if (data.length === 0) {
        setError(`No data found for fund ${code}.`);
      } else {
        const latestData = data[data.length - 1];
        const newFund: Fund = {
          code,
          name: fundDetails.name,
          realTimeData: fundDetails.realTimeData,
          data,
          latestNAV: latestData?.unitNAV,
          latestChange: latestData?.dailyGrowthRate,
          color: COLORS[funds.length % COLORS.length],
          userPosition: {
            code,
            shares,
            cost,
            realizedProfit: 0,
            tag,
          }
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

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    funds.forEach(fund => {
        if (fund.userPosition?.tag) {
            fund.userPosition.tag
                .split(',')
                .map(t => t.trim())
                .filter(t => t)
                .forEach(t => tagSet.add(t));
        }
    });
    return Array.from(tagSet).sort();
  }, [funds]);

  const processedAndSortedFunds = useMemo(() => {
    const filteredFunds = funds.filter(fund => {
        if (!activeTag) return true;
        if (!fund.userPosition?.tag) return false;
        const fundTags = fund.userPosition.tag.split(',').map(t => t.trim());
        return fundTags.includes(activeTag);
    });
    
    const processed = filteredFunds.map(fund => {
        const baseChartData = [...fund.data];
        if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) {
            baseChartData.push({
                date: fund.realTimeData.estimationTime,
                unitNAV: fund.realTimeData.estimatedNAV,
                cumulativeNAV: fund.realTimeData.estimatedNAV,
                dailyGrowthRate: fund.realTimeData.estimatedChange,
                subscriptionStatus: 'N/A',
                redemptionStatus: 'N/A',
                dividendDistribution: 'N/A',
            });
        }

        const zigzagPoints = calculateZigzag(baseChartData, zigzagThreshold);
        const lastPivotDate = zigzagPoints.length >= 2 ? zigzagPoints[zigzagPoints.length - 2]?.date : null;

        let trendInfo = null;
        if (zigzagPoints.length >= 2 && baseChartData.length > 0) {
            const lastPivot = zigzagPoints[zigzagPoints.length - 2];
            const latestPoint = baseChartData[baseChartData.length - 1];

            if (lastPivot?.date && latestPoint?.date && typeof lastPivot.unitNAV === 'number' && typeof latestPoint.unitNAV === 'number') {
                const pivotDate = new Date(lastPivot.date.split(' ')[0]);
                const latestDate = new Date(latestPoint.date.split(' ')[0]);
                
                if (!isNaN(pivotDate.getTime()) && !isNaN(latestDate.getTime())) {
                    const diffTime = latestDate.getTime() - pivotDate.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    
                    const pivotNAV = lastPivot.unitNAV;
                    const latestNAV = latestPoint.unitNAV;

                    if (pivotNAV !== 0) {
                        const change = ((latestNAV - pivotNAV) / pivotNAV) * 100;
                        const isPositive = change >= 0;
                        const direction = isPositive ? '上涨' : '下跌';
                        const formattedChange = Math.abs(change).toFixed(2);
                        
                        trendInfo = {
                            text: `近${diffDays === 0 ? 1 : diffDays}天, ${direction}${formattedChange}%`,
                            isPositive: isPositive,
                            change: change
                        };
                    }
                }
            }
        }

        let navPercentile: number | null = null;
        if (baseChartData.length > 1) {
            const navValues = baseChartData.map(p => p.unitNAV).filter((v): v is number => typeof v === 'number' && !isNaN(v));
            if (navValues.length > 1) {
                const minNav = Math.min(...navValues);
                const maxNav = Math.max(...navValues);
                const latestNav = navValues[navValues.length - 1];
                
                if (maxNav > minNav) {
                    navPercentile = ((latestNav - minNav) / (maxNav - minNav)) * 100;
                } else {
                    navPercentile = 50; // All values are the same
                }
            }
        }

        let portfolioMetrics = {};
        const position = fund.userPosition;
        if (position && position.shares > 0) {
            const latestNAV = (fund.realTimeData?.estimatedNAV > 0 ? fund.realTimeData?.estimatedNAV : fund.latestNAV) ?? 0;
            const marketValue = position.shares * latestNAV;
            const costBasis = position.shares * position.cost;
            const holdingProfit = marketValue - costBasis;
            const totalProfit = holdingProfit + position.realizedProfit;
            const cumulativeCost = costBasis - position.realizedProfit;
            const actualCost = position.shares > 0 ? cumulativeCost / position.shares : 0;

            portfolioMetrics = {
                marketValue,
                costBasis,
                holdingProfit,
                totalProfit,
                actualCost,
            };
        }
        
        return {
            ...fund,
            trendInfo,
            baseChartData,
            zigzagPoints,
            lastPivotDate,
            navPercentile,
            ...portfolioMetrics,
        };
    });
    
    processed.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'trend':
          const changeA = a.trendInfo?.change ?? -Infinity;
          const changeB = b.trendInfo?.change ?? -Infinity;
          comparison = changeA - changeB;
          break;
        case 'dailyChange':
          const dailyChangeA = a.realTimeData ? parseFloat(a.realTimeData.estimatedChange) : -Infinity;
          const dailyChangeB = b.realTimeData ? parseFloat(b.realTimeData.estimatedChange) : -Infinity;
          comparison = dailyChangeA - dailyChangeB;
          break;
        case 'navPercentile':
          const percentileA = a.navPercentile ?? -1;
          const percentileB = b.navPercentile ?? -1;
          comparison = percentileA - percentileB;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return processed;
  }, [funds, zigzagThreshold, sortBy, sortOrder, activeTag]);
  
  const handleDeleteFund = useCallback((codeToDelete: string) => {
    setFunds(prevFunds => prevFunds.filter(fund => fund.code !== codeToDelete));
    setSelectedFundForModal(null);
  }, []);

  const handleShowFundDetails = useCallback((fund: Fund) => {
    const fullFundData = processedAndSortedFunds.find(f => f.code === fund.code);
    setSelectedFundForModal(fullFundData || fund);
  }, [processedAndSortedFunds]);
  

  const handleCloseModal = useCallback(() => {
    setSelectedFundForModal(null);
  }, []);

  const handleZigzagThresholdChange = useCallback((threshold: number) => {
    setZigzagThreshold(threshold);
  }, []);

  const handleSortByChange = useCallback((newSortBy: SortByType) => {
    setSortBy(newSortBy);
  }, []);

  const handleSortOrderChange = useCallback((newSortOrder: 'asc' | 'desc') => {
    setSortOrder(newSortOrder);
  }, []);
  
  const handleUpdateFundPosition = useCallback((updatedPosition: UserPosition) => {
    setFunds(prevFunds =>
      prevFunds.map(fund =>
        fund.code === updatedPosition.code
          ? { ...fund, userPosition: updatedPosition }
          : fund
      )
    );
  }, []);

  const handleTagDoubleClick = useCallback((tag: string) => {
    setActiveTag(prevActiveTag => (prevActiveTag === tag ? null : tag));
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
        <>
          <ControlsCard
            tags={allTags}
            activeTag={activeTag}
            onTagSelect={setActiveTag}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortByChange={handleSortByChange}
            onSortOrderChange={handleSortOrderChange}
            recordCount={recordCount}
            onRecordCountChange={handleRecordCountChange}
            zigzagThreshold={zigzagThreshold}
            onZigzagThresholdChange={handleZigzagThresholdChange}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            isLoading={isLoading || isAppLoading}
          />
          <div className="w-full overflow-x-auto bg-white dark:bg-gray-900 rounded-lg shadow-md">
            <table className="w-full text-sm text-center border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[250px] min-w-[250px] text-left sticky top-0 left-0 bg-gray-50 dark:bg-gray-800 z-20">基金名称</th>
                  <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[300px] min-w-[300px] sticky top-0 left-[250px] bg-gray-50 dark:bg-gray-800 z-20">净值走势</th>
                  <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[60px] min-w-[60px] sticky top-0 left-[550px] bg-gray-50 dark:bg-gray-800 z-20">实时估值</th>
                  {dateHeaders.map(date => (
                    <th key={date} className="p-0 border-r dark:border-gray-700 font-normal text-gray-500 dark:text-gray-400 min-w-[60px] sticky top-0 bg-gray-50 dark:bg-gray-800">
                      {date.substring(5)}{getWeekday(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="relative z-0">
                {processedAndSortedFunds.map(fund => (
                  <FundRow 
                    key={fund.code} 
                    fund={fund} 
                    dateHeaders={dateHeaders} 
                    onShowDetails={handleShowFundDetails}
                    onTagDoubleClick={handleTagDoubleClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
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
          isLoading={isLoading || isAppLoading || isRefreshing}
        />
        {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
      </div>
      
      {selectedFundForModal && (
        <FundDetailModal 
          fund={selectedFundForModal as Fund} // Casting because processed funds have more properties
          onClose={handleCloseModal}
          onDelete={handleDeleteFund}
          onSave={handleUpdateFundPosition}
          zigzagThreshold={zigzagThreshold}
        />
      )}
    </div>
  );
};

export default App;