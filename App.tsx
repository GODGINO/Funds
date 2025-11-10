
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Fund, UserPosition } from './types';
import { fetchFundData, fetchFundDetails } from './services/fundService';
import FundInputForm from './components/FundInputForm';
import FundRow from './components/FundRow';
import FundDetailModal from './components/FundDetailModal';
import { calculateZigzag } from './services/chartUtils';
import ControlsCard from './components/ControlsCard';
import ImportModal from './components/ImportModal';
import PrivacyVeil from './components/PrivacyVeil';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

type SortByType = 'trend' | 'dailyChange' | 'navPercentile';

const SYSTEM_TAGS = {
  HOLDING: '持有',
  WATCHING: '自选',
  PROFIT: '盈利',
  LOSS: '亏损',
};
const ORDERED_SYSTEM_TAGS = [SYSTEM_TAGS.HOLDING, SYSTEM_TAGS.WATCHING, SYSTEM_TAGS.PROFIT, SYSTEM_TAGS.LOSS];


const validatePositions = (data: any): data is UserPosition[] => {
    if (!Array.isArray(data)) return false;
    for (const item of data) {
        if (
            typeof item !== 'object' ||
            item === null ||
            typeof item.code !== 'string' ||
            typeof item.shares !== 'number' ||
            typeof item.cost !== 'number' ||
            typeof item.realizedProfit !== 'number' ||
            (item.tag !== undefined && typeof item.tag !== 'string')
        ) {
            return false;
        }
    }
    return true;
};


const App: React.FC = () => {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState<number>(100);
  const [zigzagThreshold, setZigzagThreshold] = useState<number>(2);
  const [selectedFundForModal, setSelectedFundForModal] = useState<Fund | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortByType>('trend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTag, setActiveTag] = useState<string | null>(SYSTEM_TAGS.HOLDING);
  const [isPrivacyModeEnabled, setIsPrivacyModeEnabled] = useState(window.innerWidth >= 768);
  const [isVeiled, setIsVeiled] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const inactivityTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const appLoaded = useRef<boolean>(false);

  const getCurrentTimeString = useCallback(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }, []);

  // Effect for initial timestamp
  useEffect(() => {
    // This effect runs whenever isAppLoading changes.
    // We only want to set the timestamp ONCE after the initial load completes.
    if (!isAppLoading && !appLoaded.current) {
        setLastRefreshTime(getCurrentTimeString());
        appLoaded.current = true; // Mark that the app has loaded
    }
  }, [isAppLoading, getCurrentTimeString]);

  // Effect for Privacy Mode
  useEffect(() => {
    if (!isPrivacyModeEnabled) {
      if (isVeiled) setIsVeiled(false); // Unveil if mode is disabled
      return;
    }

    const resetTimer = () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      inactivityTimer.current = window.setTimeout(() => {
        setIsVeiled(true);
      }, 8000); // 8 seconds
    };

    const handleMouseLeave = () => {
      setIsVeiled(true);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setIsVeiled(prev => {
        const isNowVeiled = !prev;
        if (!isNowVeiled) { // Just unveiled
            resetTimer();
        }
        return isNowVeiled;
      });
    };
    
    const handleActivity = () => {
        if (isVeiled) return; // don't reset timer if veiled
        resetTimer();
    };

    const handleTouchStart = () => {
      if (!isVeiled) return; // Only act when veiled
      
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      
      longPressTimer.current = window.setTimeout(() => {
        setIsVeiled(false);
      }, 500); // 500ms for long press
    };

    const handleTouchEndOrCancel = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };

    document.body.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('wheel', handleActivity);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEndOrCancel);
    window.addEventListener('touchcancel', handleTouchEndOrCancel);
    
    resetTimer(); // Initial timer setup

    return () => {
      document.body.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEndOrCancel);
      window.removeEventListener('touchcancel', handleTouchEndOrCancel);
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [isPrivacyModeEnabled, isVeiled]);

  const loadFundsFromPositions = useCallback(async (positions: UserPosition[]) => {
      setIsAppLoading(true);
      setError(null);
      
      try {
        if (!Array.isArray(positions) || positions.length === 0) {
          setFunds([]);
          setIsAppLoading(false);
          return;
        }

        const fundLoadingPromises = positions.map(async (position) => {
            const [data, details] = await Promise.all([
              fetchFundData(position.code, recordCount),
              fetchFundDetails(position.code)
            ]);

            const latestData = data[data.length - 1];
            return {
              code: position.code,
              name: details.name,
              realTimeData: details.realTimeData,
              data,
              latestNAV: latestData?.unitNAV,
              latestChange: latestData?.dailyGrowthRate,
              userPosition: position,
            };
        });

        const results = await Promise.allSettled(fundLoadingPromises);
      
        const loadedFunds: Omit<Fund, 'color'>[] = [];
        const failedCodes: string[] = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                loadedFunds.push(result.value);
            } else {
                const code = positions[index].code;
                console.error(`Failed to load data for fund ${code}`, result.reason);
                failedCodes.push(code);
            }
        });

        if (loadedFunds.length > 0) {
          const loadedFundsWithColor = loadedFunds.map((fund, index) => ({
            ...fund,
            color: COLORS[index % COLORS.length]
          }));
          setFunds(loadedFundsWithColor);
        } else {
          setFunds([]);
        }

        if (failedCodes.length > 0) {
            setError(`部分基金加载失败: ${failedCodes.join(', ')}. 请检查基金代码是否正确或稍后再试。`);
        }

      } catch (err) {
        setError("加载基金时发生未知错误。");
        setFunds([]);
      } finally {
        setIsAppLoading(false);
      }
  }, [recordCount]);

  useEffect(() => {
    const loadSavedFunds = async () => {
      try {
        const savedPositionsJSON = localStorage.getItem('userFundPortfolio');
        if (savedPositionsJSON) {
          const savedPositions: UserPosition[] = JSON.parse(savedPositionsJSON);
          await loadFundsFromPositions(savedPositions);
        } else {
          setIsAppLoading(false);
        }
      } catch (err) {
        setError("Failed to load saved funds. They may be out of date.");
        localStorage.removeItem('userFundPortfolio');
        setIsAppLoading(false);
      }
    };

    loadSavedFunds();
  }, [loadFundsFromPositions]);

  useEffect(() => {
    if (!isAppLoading) {
      const positionsToSave = funds
        .map(f => f.userPosition)
        .filter((p): p is UserPosition => !!p);
      localStorage.setItem('userFundPortfolio', JSON.stringify(positionsToSave));
    }
  }, [funds, isAppLoading]);


  const handleAddFund = useCallback(async (details: { code: string; shares: number; cost: number; tag: string }): Promise<boolean> => {
    const { code, shares, cost, tag } = details;
    
    if (!code.trim()) {
      setError('Please provide a fund code.');
      return false;
    }
    if (funds.some(f => f.code === code)) {
      setError(`Fund ${code} is already being tracked.`);
      return false;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [data, fundDetails] = await Promise.all([
        fetchFundData(code, recordCount),
        fetchFundDetails(code)
      ]);

      if (!fundDetails.name) {
          throw new Error(`无法找到基金 ${code} 的信息。`);
      }
      
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [funds, recordCount]);
  
  const handleRefresh = useCallback(async () => {
    if (funds.length === 0) return;

    setLastRefreshTime(getCurrentTimeString());

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
  }, [funds, getCurrentTimeString]);

  // Auto-refresh data every 3 minutes
  useEffect(() => {
    // Do not set up the interval if a refresh is already in progress or if there are no funds to refresh.
    if (isRefreshing || funds.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      handleRefresh();
    }, 3 * 60 * 1000); // 3 minutes

    // The cleanup function will run when dependencies change, clearing the old interval.
    return () => clearInterval(intervalId);
  }, [handleRefresh, isRefreshing, funds.length]);

  // Global cursor loading state
  useEffect(() => {
    const isCurrentlyLoading = isLoading || isRefreshing || isAppLoading;
    if (isCurrentlyLoading) {
      document.body.style.cursor = 'wait';
    } else {
      document.body.style.cursor = 'default';
    }
    // Cleanup function to reset cursor if component unmounts while loading
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [isLoading, isRefreshing, isAppLoading]);


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

      // FIX: A block-scoped variable was used before its declaration.
      const updatedFunds = await Promise.all(updatedFundsPromises);
      setFunds(updatedFunds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while updating funds.');
    } finally {
      setIsLoading(false);
    }
  }, [funds]);

  const handleImportData = useCallback(async (jsonString: string) => {
    try {
        if (!jsonString.trim()) {
            throw new Error("Input is empty. Please paste your JSON data.");
        }
        const data = JSON.parse(jsonString);

        if (!validatePositions(data)) {
            throw new Error("Invalid JSON format. Please ensure it's an array of fund positions with correct keys (code, shares, cost, realizedProfit).");
        }
        
        await loadFundsFromPositions(data);
    } catch (error) {
        console.error("Import failed:", error);
        if (error instanceof SyntaxError) {
            throw new Error("Invalid JSON. Please check for syntax errors like missing commas or quotes.");
        }
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to parse or validate JSON data.");
    }
  }, [loadFundsFromPositions]);

  const allTags = useMemo(() => {
    const customTagSet = new Set<string>();
    const systemTagSet = new Set<string>();

    funds.forEach(fund => {
        const position = fund.userPosition;
        if (position && position.shares > 0) {
            systemTagSet.add(SYSTEM_TAGS.HOLDING);
            const latestNAV = (fund.realTimeData?.estimatedNAV > 0 ? fund.realTimeData.estimatedNAV : fund.latestNAV) ?? 0;
            const holdingProfit = (latestNAV - position.cost) * position.shares;
            if (holdingProfit > 0) {
                systemTagSet.add(SYSTEM_TAGS.PROFIT);
            } else if (holdingProfit < 0) {
                systemTagSet.add(SYSTEM_TAGS.LOSS);
            }
        } else {
            systemTagSet.add(SYSTEM_TAGS.WATCHING);
        }
        
        if (fund.userPosition?.tag) {
            fund.userPosition.tag
                .split(',')
                .map(t => t.trim())
                .filter(t => t)
                .forEach(t => customTagSet.add(t));
        }
    });
    
    const sortedSystemTags = ORDERED_SYSTEM_TAGS.filter(tag => systemTagSet.has(tag));
    const customTags = Array.from(customTagSet).sort();

    return [...sortedSystemTags, ...customTags];
}, [funds]);

  const processedFunds = useMemo(() => {
    return funds.map(fund => {
        const baseChartData = [...fund.data];
        
        if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) {
            const realTimeDate = fund.realTimeData.estimationTime.split(' ')[0];
            const hasHistoricalDataForToday = fund.data.some(
                dataPoint => dataPoint.date === realTimeDate
            );

            if (!hasHistoricalDataForToday) {
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
                        
                        let trendText = `近${diffDays === 0 ? 1 : diffDays}天, ${direction}${formattedChange}%`;
                        const shares = fund.userPosition?.shares;
                        if (shares && shares > 0) {
                            const profit = (latestNAV - pivotNAV) * shares;
                            trendText += `, ${profit.toFixed(0)} 元`;
                        }
                        
                        trendInfo = {
                            text: trendText,
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
                    navPercentile = 50;
                }
            }
        }

        let portfolioMetrics = {};
        const position = fund.userPosition;
        if (position) {
            const latestNAV = baseChartData.length > 0 ? (baseChartData[baseChartData.length - 1].unitNAV ?? 0) : 0;
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
  }, [funds, zigzagThreshold]);

  const processedAndSortedFunds = useMemo(() => {
    const filteredFunds = processedFunds.filter(fund => {
        if (!activeTag) return true;
        
        const position = fund.userPosition;
        switch (activeTag) {
            case SYSTEM_TAGS.HOLDING:
                return position && position.shares > 0;
            case SYSTEM_TAGS.WATCHING:
                return !position || position.shares === 0;
            case SYSTEM_TAGS.PROFIT:
                return (fund as any).holdingProfit > 0;
            case SYSTEM_TAGS.LOSS:
                return (fund as any).holdingProfit < 0;
        }

        if (!position?.tag) return false;
        const fundTags = position.tag.split(',').map(t => t.trim());
        return fundTags.includes(activeTag);
    });
    
    filteredFunds.sort((a, b) => {
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

    return filteredFunds;
  }, [processedFunds, sortBy, sortOrder, activeTag]);
  
  const dailyPortfolioMetrics = useMemo(() => {
    let totalDailyProfit = 0;
    let totalYesterdayMarketValue = 0;

    processedFunds.forEach(fund => {
        const shares = fund.userPosition?.shares;
        if (!shares || shares <= 0) {
            return; // Skip funds not held
        }

        const chartPoints = fund.baseChartData;
        if (chartPoints.length < 2) {
            return; // Not enough data
        }

        const todayNAV = chartPoints[chartPoints.length - 1]?.unitNAV;
        const yesterdayNAV = chartPoints[chartPoints.length - 2]?.unitNAV;

        if (yesterdayNAV && todayNAV && todayNAV > 0) {
            totalDailyProfit += (todayNAV - yesterdayNAV) * shares;
            totalYesterdayMarketValue += yesterdayNAV * shares;
        }
    });

    const totalDailyProfitRate = totalYesterdayMarketValue > 0
        ? (totalDailyProfit / totalYesterdayMarketValue) * 100
        : 0;

    return { totalDailyProfit, totalDailyProfitRate };
  }, [processedFunds]);

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
    setActiveTag(prevActiveTag => {
      if (prevActiveTag === tag) {
        // When toggling off the active tag:
        // If it's the '持有' tag, revert to 'All' (null).
        // For any other tag, revert to the new default '持有'.
        return tag === SYSTEM_TAGS.HOLDING ? null : SYSTEM_TAGS.HOLDING;
      }
      // When selecting a new tag, just activate it.
      return tag;
    });
  }, []);

  const dateHeaders = useMemo(() => {
    if (funds.length === 0) return [];
    
    const allDates = new Set<string>();
    funds.forEach(fund => {
      fund.data.forEach(dataPoint => {
        allDates.add(dataPoint.date);
      });
    });

    const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    if (sortedDates.length === 0) {
        return [];
    }
    
    // The third column is dedicated to "today's" data (real-time or confirmed).
    // Therefore, the historical columns should never show today's date to avoid redundancy.
    // We determine "today" based on the date from the real-time data, which is the most reliable source for the current trading day's date.
    const todayDateStr = funds.find(f => f.realTimeData)?.realTimeData?.estimationTime.split(' ')[0];

    // If the most recent date from historical data matches "today", it means the NAV for today has been confirmed
    // and is included in the historical data (`fund.data`). We must remove it from the `dateHeaders`
    // to avoid duplication with the third column.
    if (todayDateStr && sortedDates[0] === todayDateStr) {
        return sortedDates.slice(1);
    }
    
    return sortedDates;
  }, [funds]);

  const getWeekday = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[date.getDay()];
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200 font-sans p-4">
      {isVeiled && (
        <PrivacyVeil 
          onRefresh={handleRefresh} 
          lastRefreshTime={lastRefreshTime} 
          totalDailyProfit={dailyPortfolioMetrics.totalDailyProfit}
          totalDailyProfitRate={dailyPortfolioMetrics.totalDailyProfitRate}
        />
      )}
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
            totalDailyProfit={dailyPortfolioMetrics.totalDailyProfit}
            totalDailyProfitRate={dailyPortfolioMetrics.totalDailyProfitRate}
          />
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-center border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[250px] min-w-[250px] text-left md:sticky top-0 md:left-0 bg-gray-50 dark:bg-gray-800 md:z-20">基金名称</th>
                    <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[300px] min-w-[300px] md:sticky top-0 md:left-[250px] bg-gray-50 dark:bg-gray-800 md:z-20">净值走势</th>
                    <th className="p-0 border-r dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 w-[60px] min-w-[60px] md:sticky top-0 md:left-[550px] bg-gray-50 dark:bg-gray-800 md:z-20">当日净值</th>
                    {dateHeaders.map(date => (
                      <th key={date} className="p-0 border-r dark:border-gray-700 font-normal text-gray-500 dark:text-gray-400 min-w-[60px] md:sticky top-0 bg-gray-50 dark:bg-gray-800">
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
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">暂无数据</h3>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mt-6">
        <FundInputForm 
          onAddFund={handleAddFund} 
          isLoading={isLoading || isAppLoading || isRefreshing}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          isPrivacyModeEnabled={isPrivacyModeEnabled}
          onPrivacyModeChange={setIsPrivacyModeEnabled}
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

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportData}
      />
    </div>
  );
};

export default App;
