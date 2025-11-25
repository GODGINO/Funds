
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
// FIX: Import ProcessedFund for better type safety
import { Fund, UserPosition, ProcessedFund, TagAnalysisData, TagSortOrder, IndexData, TradingRecord, TradeModalState, PortfolioSnapshot, RealTimeData } from './types';
import { fetchFundData, fetchFundDetails, fetchIndexData } from './services/fundService';
import FundInputForm from './components/FundInputForm';
import FundRow from './components/FundRow';
import FundDetailModal from './components/FundDetailModal';
import { calculateZigzag } from './services/chartUtils';
import ControlsCard from './components/ControlsCard';
import ImportModal from './components/ImportModal';
import PrivacyVeil from './components/PrivacyVeil';
import TagAnalysisTable from './components/TagAnalysisTable';
import BuyModal from './components/BuyModal';
import SellModal from './components/SellModal';
import PortfolioSnapshotTable from './components/PortfolioSnapshotTable';
import TransactionManagerModal from './components/TransactionManagerModal';
import GeminiAdvisorModal from './components/GeminiAdvisorModal';
import { generatePortfolioAdvice } from './services/geminiService';
import TerminalModal from './components/TerminalModal';
import { processTerminalCommand } from './services/terminalService';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

type SortByType = 'trend' | 'dailyChange' | 'navPercentile' | 'amount' | 'holdingProfitRate' | 'totalProfitRate';

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
            typeof item !== 'object' || item === null ||
            typeof item.code !== 'string' ||
            typeof item.shares !== 'number' ||
            typeof item.cost !== 'number' ||
            typeof item.realizedProfit !== 'number' ||
            (item.tag !== undefined && typeof item.tag !== 'string')
        ) {
            return false;
        }
        if (item.tradingRecords !== undefined) {
            if (!Array.isArray(item.tradingRecords)) return false;
            for (const record of item.tradingRecords) {
                if (
                    typeof record !== 'object' || record === null ||
                    typeof record.date !== 'string' ||
                    (record.type !== 'buy' && record.type !== 'sell')
                ) {
                    return false;
                }
                // A record is either pending (has 'value') or confirmed (has 'nav', 'sharesChange', 'amount').
                const isPending = typeof record.value === 'number';
                const isConfirmed = typeof record.nav === 'number' && typeof record.sharesChange === 'number' && typeof record.amount === 'number';
                if (!isPending && !isConfirmed) {
                    return false; // It must be one or the other to be valid.
                }
            }
        }
    }
    return true;
};

const shouldAutoRefresh = (): boolean => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // Sunday: 0, Monday: 1, ..., Saturday: 6
    const hour = now.getHours();

    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    const isTradingHours = hour >= 9 && hour < 16; // 9:00 AM to 3:59 PM

    return isWeekday && isTradingHours;
};

// FIX: Corrected component structure. A misplaced closing brace `}` was causing all subsequent hooks and the return statement to be outside the component scope, leading to multiple errors.
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
  const [isTransactionManagerOpen, setIsTransactionManagerOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [geminiAnalysisResult, setGeminiAnalysisResult] = useState<string | null>(null);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  const [buyModalState, setBuyModalState] = useState<TradeModalState | null>(null);
  const [sellModalState, setSellModalState] = useState<TradeModalState | null>(null);
  const [sortBy, setSortBy] = useState<SortByType>('trend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isPrivacyModeEnabled, setIsPrivacyModeEnabled] = useState(window.innerWidth >= 768);
  const [isVeiled, setIsVeiled] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const [tagSortKey, setTagSortKey] = useState<keyof TagAnalysisData>('totalDailyProfit');
  const [tagSortOrder, setTagSortOrder] = useState<TagSortOrder>('desc');
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const inactivityTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const appLoaded = useRef<boolean>(false);
  const fundTableContainerRef = useRef<HTMLDivElement>(null);

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

  // Effect to capture Token from URL and clean it up
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('GITHUB_TOKEN', tokenFromUrl);
      urlParams.delete('token');
      const newSearch = urlParams.toString();
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '');
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

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
    const loadSavedData = async () => {
      try {
        // Start fetching index data immediately.
        const indexPromise = fetchIndexData().then(setIndexData);

        const savedPositionsJSON = localStorage.getItem('userFundPortfolio');
        if (savedPositionsJSON) {
          const savedPositions = JSON.parse(savedPositionsJSON);
           if (validatePositions(savedPositions)) {
                await loadFundsFromPositions(savedPositions);
           } else {
                console.warn("本地存储的持仓数据格式无效，将重新开始。");
                localStorage.removeItem('userFundPortfolio');
                setIsAppLoading(false);
           }
        } else {
          setIsAppLoading(false);
        }
        
        // Wait for index data too before considering the app fully loaded,
        // though it doesn't block fund display.
        await indexPromise;

      } catch (err) {
        setError("加载已保存的基金失败，数据可能已过期。");
        localStorage.removeItem('userFundPortfolio');
        setIsAppLoading(false);
      }
    };

    loadSavedData();
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
          tradingRecords: [],
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

    const indexPromise = fetchIndexData();

    // Step 1: Initial fetch for all funds using Promise.allSettled
    const initialFetchResults = await Promise.allSettled(
        funds.map(fund => fetchFundDetails(fund.code))
    );

    const updatedDetailsMap = new Map<string, { realTimeData?: RealTimeData }>();
    const failedCodesToRetry: string[] = [];

    initialFetchResults.forEach((result, index) => {
        const code = funds[index].code;
        if (result.status === 'fulfilled') {
            updatedDetailsMap.set(code, { realTimeData: result.value.realTimeData });
        } else {
            // This case now only happens if fetch fails AND there's no cache.
            failedCodesToRetry.push(code);
        }
    });

    // Step 2: Silently retry failed funds once
    if (failedCodesToRetry.length > 0) {
        const retryResults = await Promise.allSettled(
            failedCodesToRetry.map(code => fetchFundDetails(code))
        );

        retryResults.forEach((result, index) => {
            const code = failedCodesToRetry[index];
            if (result.status === 'fulfilled') {
                updatedDetailsMap.set(code, { realTimeData: result.value.realTimeData });
            } else {
                console.warn(`[刷新警告] 基金 ${code} 实时数据获取失败，将继续展示旧数据。`);
            }
        });
    }

    // Step 3: Apply all successful updates (from initial fetch and retry) in one go
    if (updatedDetailsMap.size > 0) {
        setFunds(currentFunds =>
            currentFunds.map(fund => {
                const newDetails = updatedDetailsMap.get(fund.code);
                return newDetails ? { ...fund, ...newDetails } : fund;
            })
        );
    }

    // Step 4: Finalize by updating index data and resetting loading state
    try {
        const newIndexData = await indexPromise;
        setIndexData(newIndexData);
    } catch (err) {
        // Log index error but don't show a blocking UI error
        console.error("Failed to refresh index data:", err);
    } finally {
        setIsRefreshing(false);
    }
}, [funds, getCurrentTimeString]);


  // Auto-refresh data every 3 minutes on weekdays during trading hours
  useEffect(() => {
    // Do not set up the interval if a refresh is already in progress.
    if (isRefreshing) {
      return;
    }

    const intervalId = setInterval(() => {
      if (shouldAutoRefresh()) {
        handleRefresh();
      }
    }, 3 * 60 * 1000); // 3 minutes

    // The cleanup function will run when dependencies change, clearing the old interval.
    return () => clearInterval(intervalId);
  }, [handleRefresh, isRefreshing]);

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
// FIX: Corrected a syntax error in the catch block. The `=>` is invalid syntax for a catch block and was causing a major parsing failure.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while updating funds.');
    } finally {
      setIsLoading(false);
    }
  }, [funds]);

  const handleFullReload = useCallback(async () => {
    if (funds.length === 0) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const updatedFundsPromises = funds.map(async (fund) => {
        const newData = await fetchFundData(fund.code, recordCount);
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
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fully reloading funds.');
    } finally {
      setIsLoading(false);
    }
  }, [funds, recordCount]);

  const handleImportData = useCallback(async (jsonString: string) => {
    try {
        if (!jsonString.trim()) {
            throw new Error("Input is empty. Please paste your JSON data.");
        }
        const data = JSON.parse(jsonString);

        if (!validatePositions(data)) {
            throw new Error("Invalid JSON format. Please ensure it's an array of fund positions with correct keys (code, shares, cost, realizedProfit, and valid tradingRecords).");
        }
        
        // When importing, we replace everything, so clear existing funds.
        setFunds([]); 
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

  // FIX: Add explicit return type to useMemo for processedFunds to ensure properties are recognized downstream.
  const processedFunds = useMemo((): ProcessedFund[] => {
    return funds.map((fund): ProcessedFund => {
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
        
        let portfolioMetrics: Partial<ProcessedFund> = {};
        let calculatedUserPosition = fund.userPosition;

        const position = fund.userPosition;
        if (position) {
            let currentShares = position.shares;
            let currentTotalCost = position.shares * position.cost;
            let currentRealizedProfit = position.realizedProfit;

            const sortedRecords = (position.tradingRecords || []).slice().sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const record of sortedRecords) {
                // Only process confirmed records for portfolio calculation
                if (record.nav === undefined) continue;

                if (record.type === 'buy') {
                    currentShares = parseFloat((currentShares + record.sharesChange!).toFixed(2));
                    currentTotalCost = parseFloat((currentTotalCost + record.amount!).toFixed(2));
                } else { // sell
                    const costBasisBeforeSell = currentShares > 0 ? currentTotalCost / currentShares : 0;
                    currentTotalCost = parseFloat((currentTotalCost - costBasisBeforeSell * Math.abs(record.sharesChange!)).toFixed(2));
                    currentShares = parseFloat((currentShares + record.sharesChange!).toFixed(2));
                    currentRealizedProfit = parseFloat((currentRealizedProfit + (record.realizedProfitChange ?? 0)).toFixed(2));
                    if (currentShares < 1e-6) {
                        currentShares = 0;
                        currentTotalCost = 0;
                    }
                }
            }

            const latestNAV = baseChartData.length > 0 ? (baseChartData[baseChartData.length - 1].unitNAV ?? 0) : 0;
            const marketValue = parseFloat((currentShares * latestNAV).toFixed(2));
            const costBasis = currentTotalCost;
            const holdingProfit = parseFloat((marketValue - costBasis).toFixed(2));
            const totalProfit = parseFloat((holdingProfit + currentRealizedProfit).toFixed(2));
            const actualCost = currentShares > 0 ? parseFloat(((costBasis - currentRealizedProfit) / currentShares).toFixed(4)) : 0;
            const holdingProfitRate = costBasis > 0 ? parseFloat(((holdingProfit / costBasis) * 100).toFixed(2)) : 0;
            const totalProfitRate = costBasis > 0 ? parseFloat(((totalProfit / costBasis) * 100).toFixed(2)) : 0;
            
            calculatedUserPosition = {
                ...position,
                shares: currentShares,
                cost: currentShares > 0 ? parseFloat((currentTotalCost / currentShares).toFixed(4)) : 0,
                realizedProfit: currentRealizedProfit,
            };

            portfolioMetrics = {
                marketValue,
                costBasis,
                holdingProfit,
                totalProfit,
                holdingProfitRate,
                totalProfitRate,
                actualCost,
                userPosition: calculatedUserPosition
            };
        }
        
        const lastPivotDate = zigzagPoints.length >= 2 ? zigzagPoints[zigzagPoints.length - 2]?.date : null;

        let trendInfo = null;
        let recentProfit = 0;
        let initialMarketValueForTrend = 0;

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
                        const direction = isPositive ? '⬆︎' : '⬇︎';
                        const formattedChange = Math.abs(change).toFixed(2);
                        
                        let trendText = `近${diffDays === 0 ? 1 : diffDays}天, ${direction}${formattedChange}%`;
                        const shares = calculatedUserPosition?.shares;
                        if (shares && shares > 0) {
                            const profit = parseFloat(((latestNAV - pivotNAV) * shares).toFixed(2));
                            trendText += `, ${profit.toFixed(0)} 元`;
                            recentProfit = profit;
                            initialMarketValueForTrend = parseFloat((pivotNAV * shares).toFixed(2));
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
        
        return {
            ...fund,
            ...portfolioMetrics,
            initialUserPosition: fund.userPosition, // Keep the original "base" position here for replay logic
            trendInfo,
            baseChartData,
            zigzagPoints,
            lastPivotDate,
            navPercentile,
            recentProfit,
            initialMarketValueForTrend,
        };
    });
  }, [funds, zigzagThreshold]);

  const analysisResults = useMemo(() => {
    // First, calculate totals for the entire portfolio
    let totalCostBasis = 0;
    let totalMarketValue = 0;
    let totalHoldingProfit = 0;
    let grandTotalProfit = 0;
    let totalDailyProfit = 0;
    let totalYesterdayMarketValue = 0;
    let totalRecentProfit = 0;
    let totalInitialMarketValueForTrend = 0;

    processedFunds.forEach(fund => {
        // 累计收益（grandTotalProfit）需要包含已清仓基金的落袋收益，
        // 因此它应该对所有基金进行累加。
        grandTotalProfit += fund.totalProfit ?? 0;

        const position = fund.userPosition;
        // 其他指标仅与当前持仓有关。
        if (position && position.shares > 0) {
            totalCostBasis += fund.costBasis ?? 0;
            totalMarketValue += fund.marketValue ?? 0;
            totalHoldingProfit += fund.holdingProfit ?? 0;
            totalRecentProfit += fund.recentProfit ?? 0;
            totalInitialMarketValueForTrend += fund.initialMarketValueForTrend ?? 0;
            
            const chartPoints = fund.baseChartData;
            if (chartPoints.length >= 2) {
                const todayNAV = chartPoints[chartPoints.length - 1]?.unitNAV;
                const yesterdayNAV = chartPoints[chartPoints.length - 2]?.unitNAV;
                if (yesterdayNAV && todayNAV && todayNAV > 0) {
                    const dailyProfit = parseFloat(((todayNAV - yesterdayNAV) * position.shares).toFixed(2));
                    totalDailyProfit += dailyProfit;
                    totalYesterdayMarketValue += parseFloat((yesterdayNAV * position.shares).toFixed(2));
                }
            }
        }
    });

    const totals = {
        totalCostBasis,
        totalMarketValue,
        cumulativeMarketValue: totalCostBasis + grandTotalProfit,
        grandTotalProfit,
        totalHoldingProfit,
        totalDailyProfit,
        totalRecentProfit,
        // FIX: Add missing properties to the totals object to match the component's expected type.
        totalYesterdayMarketValue,
        totalInitialMarketValueForTrend,
        holdingProfitRate: totalCostBasis > 0 ? (totalHoldingProfit / totalCostBasis) * 100 : 0,
        totalProfitRate: totalCostBasis > 0 ? (grandTotalProfit / totalCostBasis) * 100 : 0,
        dailyProfitRate: totalYesterdayMarketValue > 0 ? (totalDailyProfit / totalYesterdayMarketValue) * 100 : 0,
        recentProfitRate: totalInitialMarketValueForTrend > 0 ? (totalRecentProfit / totalInitialMarketValueForTrend) * 100 : 0,
    };
    
    // Second, calculate metrics per tag
    const metricsByTag: { [tag: string]: {
        totalCostBasis: number;
        totalMarketValue: number;
        totalHoldingProfit: number;
        totalRealizedProfit: number;
        totalDailyProfit: number;
        totalYesterdayMarketValue: number;
        totalRecentProfit: number;
        totalInitialMarketValueForTrend: number;
        fundCodes: Set<string>;
        sumDailyRates: number;
        dailyRateCount: number;
        sumRecentRates: number;
        recentRateCount: number;
    } } = {};

    processedFunds.forEach(fund => {
        const position = fund.userPosition;
        if (!position || !position.tag) return;

        const customTags = position.tag.split(',').map(t => t.trim()).filter(Boolean);

        customTags.forEach(tag => {
            if (!metricsByTag[tag]) {
                metricsByTag[tag] = {
                    totalCostBasis: 0,
                    totalMarketValue: 0,
                    totalHoldingProfit: 0,
                    totalRealizedProfit: 0,
                    totalDailyProfit: 0,
                    totalYesterdayMarketValue: 0,
                    totalRecentProfit: 0,
                    totalInitialMarketValueForTrend: 0,
                    fundCodes: new Set<string>(),
                    sumDailyRates: 0,
                    dailyRateCount: 0,
                    sumRecentRates: 0,
                    recentRateCount: 0,
                };
            }
            // Aggregate metrics that apply to ALL tagged funds (including zero-share)
            metricsByTag[tag].fundCodes.add(fund.code);
            metricsByTag[tag].totalRealizedProfit += position.realizedProfit || 0;

            const dailyChangeStr = fund.realTimeData?.estimatedChange ?? fund.latestChange;
            const dailyChange = dailyChangeStr ? parseFloat(dailyChangeStr) : null;
            if (dailyChange !== null && !isNaN(dailyChange)) {
                metricsByTag[tag].sumDailyRates += dailyChange;
                metricsByTag[tag].dailyRateCount++;
            }
            if (fund.trendInfo?.change) {
                metricsByTag[tag].sumRecentRates += fund.trendInfo.change;
                metricsByTag[tag].recentRateCount++;
            }

            // Only aggregate share-dependent financial data if the fund is actually held.
            if (position.shares > 0) {
                const chartPoints = fund.baseChartData;
                let dailyProfit = 0;
                let yesterdayMarketValue = 0;
                if (chartPoints.length >= 2) {
                    const todayNAV = chartPoints[chartPoints.length - 1]?.unitNAV;
                    const yesterdayNAV = chartPoints[chartPoints.length - 2]?.unitNAV;
                    if (yesterdayNAV && todayNAV && todayNAV > 0) {
                        dailyProfit = parseFloat(((todayNAV - yesterdayNAV) * position.shares).toFixed(2));
                        yesterdayMarketValue = parseFloat((yesterdayNAV * position.shares).toFixed(2));
                    }
                }
                
                metricsByTag[tag].totalCostBasis += fund.costBasis ?? 0;
                metricsByTag[tag].totalMarketValue += fund.marketValue ?? 0;
                metricsByTag[tag].totalHoldingProfit += fund.holdingProfit ?? 0;
                metricsByTag[tag].totalDailyProfit += dailyProfit;
                metricsByTag[tag].totalYesterdayMarketValue += yesterdayMarketValue;
                metricsByTag[tag].totalRecentProfit += fund.recentProfit ?? 0;
                metricsByTag[tag].totalInitialMarketValueForTrend += fund.initialMarketValueForTrend ?? 0;
            }
        });
    });

    // Finally, map tag metrics to final data structure, including efficiency ratios
    const data = Object.entries(metricsByTag).map(([tag, metrics]) => {
        const grandTotalProfit = metrics.totalHoldingProfit + metrics.totalRealizedProfit;
        
        const dailyProfitRate = metrics.totalYesterdayMarketValue > 0 
            ? (metrics.totalDailyProfit / metrics.totalYesterdayMarketValue) * 100 
            : (metrics.dailyRateCount > 0 ? metrics.sumDailyRates / metrics.dailyRateCount : 0);
    
        const recentProfitRate = metrics.totalInitialMarketValueForTrend > 0
            ? (metrics.totalRecentProfit / metrics.totalInitialMarketValueForTrend) * 100
            : (metrics.recentRateCount > 0 ? metrics.sumRecentRates / metrics.recentRateCount : 0);

        const marketValueContribution = totals.totalMarketValue > 0 ? (metrics.totalMarketValue / totals.totalMarketValue) : 0;

        const holdingProfitContribution = totals.totalHoldingProfit !== 0 ? (metrics.totalHoldingProfit / Math.abs(totals.totalHoldingProfit)) : 0;
        const holdingEfficiency = marketValueContribution > 0 ? (holdingProfitContribution / marketValueContribution) : 0;

        const dailyProfitContribution = totals.totalDailyProfit !== 0 ? (metrics.totalDailyProfit / Math.abs(totals.totalDailyProfit)) : 0;
        const dailyEfficiency = marketValueContribution > 0 ? (dailyProfitContribution / marketValueContribution) : 0;
        
        const recentProfitContribution = totals.totalRecentProfit !== 0 ? (metrics.totalRecentProfit / Math.abs(totals.totalRecentProfit)) : 0;
        const recentEfficiency = marketValueContribution > 0 ? (recentProfitContribution / marketValueContribution) : 0;

        return {
            tag,
            fundCount: metrics.fundCodes.size,
            ...metrics,
            grandTotalProfit,
            cumulativeMarketValue: metrics.totalCostBasis + grandTotalProfit,
            holdingProfitRate: metrics.totalCostBasis > 0 ? (metrics.totalHoldingProfit / metrics.totalCostBasis) * 100 : 0,
            totalProfitRate: metrics.totalCostBasis > 0 ? (grandTotalProfit / metrics.totalCostBasis) * 100 : 0,
            dailyProfitRate,
            recentProfitRate,
            holdingEfficiency,
            dailyEfficiency,
            recentEfficiency,
        };
    })
    
    data.sort((a, b) => {
      // FIX: Replaced the sort implementation with a more type-safe version to prevent errors.
      // This checks if values are numbers before attempting arithmetic operations.
      const valA = a[tagSortKey];
      const valB = b[tagSortKey];
      if (typeof valA !== 'number' || typeof valB !== 'number') {
        return 0;
      }
      if (tagSortOrder === 'asc') return valA - valB;
      if (tagSortOrder === 'desc') return valB - valA;
      if (tagSortOrder === 'abs_asc') return Math.abs(valA) - Math.abs(valB);
      if (tagSortOrder === 'abs_desc') return Math.abs(valB) - Math.abs(valA);
      return 0;
    });

    return { tagAnalysisData: data, portfolioTotals: totals };

  }, [processedFunds, tagSortKey, tagSortOrder]);


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
        case 'amount':
          const amountA = a.marketValue ?? -Infinity;
          const amountB = b.marketValue ?? -Infinity;
          comparison = amountA - amountB;
          break;
        case 'holdingProfitRate':
          const rateA = a.holdingProfitRate ?? -Infinity;
          const rateB = b.holdingProfitRate ?? -Infinity;
          comparison = rateA - rateB;
          break;
        case 'totalProfitRate':
          const totalRateA = a.totalProfitRate ?? -Infinity;
          const totalRateB = b.totalProfitRate ?? -Infinity;
          comparison = totalRateA - totalRateB;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filteredFunds;
  }, [processedFunds, sortBy, sortOrder, activeTag]);
  

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
  
  const handleUpdateFundPosition = useCallback((updatedPosition: UserPosition, resetTradingRecords: boolean) => {
    setFunds(prevFunds =>
      prevFunds.map(fund => {
        if (fund.code !== updatedPosition.code) {
          return fund;
        }

        if (resetTradingRecords) {
          // Case 2: Shares or cost changed. Reset history.
          return {
            ...fund,
            userPosition: {
              ...updatedPosition,
              tradingRecords: [] // Clear trading records
            }
          };
        } else {
          // Case 1: Only tag/profit changed. Merge selectively.
          const existingPosition = fund.userPosition || { code: fund.code, shares: 0, cost: 0, realizedProfit: 0, tradingRecords: [] };
          return {
            ...fund,
            userPosition: {
              ...existingPosition,
              // Only apply the non-structural changes from the modal.
              // This prevents overwriting the base shares/cost with the calculated
              // values from the modal, which would cause double-counting on the next replay.
              tag: updatedPosition.tag,
              realizedProfit: updatedPosition.realizedProfit,
            }
          };
        }
      })
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
      
      // When selecting a new tag, schedule the scroll and activate it.
      setTimeout(() => {
        fundTableContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      
      return tag;
    });
  }, []);

  const handleTagSortChange = useCallback((newKey: keyof TagAnalysisData) => {
    setTagSortKey(prevKey => {
      if (prevKey === newKey) {
        setTagSortOrder(prevOrder => {
          if (prevOrder === 'desc') return 'asc';
          if (prevOrder === 'asc') return 'abs_desc';
          if (prevOrder === 'abs_desc') return 'abs_asc';
          return 'desc'; // from 'abs_asc' back to 'desc'
        });
      } else {
        setTagSortOrder('desc'); // Reset to default when key changes
      }
      return newKey;
    });
  }, []);

  const todayHeaderDate = useMemo(() => {
    if (funds.length === 0) {
        return null;
    }

    // Prefer real-time data date as it's most current
    const realTimeDate = funds.find(f => f.realTimeData)?.realTimeData?.estimationTime.split(' ')[0];
    if (realTimeDate) {
        return realTimeDate;
    }

    // Fallback to the latest date from historical data
    const allDates = new Set<string>();
    funds.forEach(fund => {
      fund.data.forEach(dataPoint => {
        allDates.add(dataPoint.date);
      });
    });
    
    if (allDates.size === 0) {
        return null;
    }
    
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return sortedDates[0] || null;

  }, [funds]);

  const dateHeaders = useMemo(() => {
    if (funds.length === 0 || !todayHeaderDate) return [];
    
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
    // We determine "today" based on the todayHeaderDate.
    // If the most recent date from historical data matches "today", it means the NAV for today has been confirmed
    // and is included in the historical data (`fund.data`). We must remove it from the `dateHeaders`
    // to avoid duplication with the third column.
    if (sortedDates[0] === todayHeaderDate) {
        return sortedDates.slice(1);
    }
    
    return sortedDates;
  }, [funds, todayHeaderDate]);

  const getWeekday = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[date.getDay()];
  }

  const handleOpenTradeModal = useCallback((fund: ProcessedFund, date: string, type: 'buy' | 'sell', nav: number, isConfirmed: boolean, editingRecord?: TradingRecord) => {
    const modalState: TradeModalState = { fund, date, nav, isConfirmed, editingRecord };
    if (type === 'buy') {
      setBuyModalState(modalState);
    } else {
      setSellModalState(modalState);
    }
  }, []);

 const handleTradeSubmit = useCallback((
    fund: ProcessedFund,
    date: string,
    type: 'buy' | 'sell',
    value: number, // amount for buy, shares for sell
    isConfirmed: boolean,
    nav: number,
    isEditing: boolean
) => {
    const fundToUpdate = funds.find(f => f.code === fund.code);
    if (!fundToUpdate || !fundToUpdate.userPosition) return;

    const currentRecords = fundToUpdate.userPosition.tradingRecords || [];
    let newRecord: TradingRecord;

    if (!isConfirmed) {
        // Create a new PENDING record for unconfirmed trades
        newRecord = { date, type, value };
    } else {
        // Process confirmed trades immediately, creating a CONFIRMED record
        if (type === 'buy') {
            newRecord = {
                date: date, type: 'buy', nav: nav,
                sharesChange: parseFloat((value / nav).toFixed(2)),
                amount: value,
            };
        } else { // sell
            const costBasisForSale = fund.userPosition?.cost ?? 0;
            newRecord = {
                date: date, type: 'sell', nav: nav,
                sharesChange: -value,
                amount: parseFloat((-(value * nav)).toFixed(2)),
                realizedProfitChange: parseFloat(((nav - costBasisForSale) * value).toFixed(2))
            };
        }
    }
    
    let updatedRecords;
    const existingRecordIndex = currentRecords.findIndex(r => r.date === date);

    if (isEditing || existingRecordIndex !== -1) {
        // If editing or a record for this date already exists, replace it.
        updatedRecords = currentRecords.map(r => r.date === date ? newRecord : r);
    } else {
        // Otherwise, add the new record.
        updatedRecords = [...currentRecords, newRecord];
    }

    setFunds(prevFunds => prevFunds.map(f =>
        f.code === fund.code ? {
            ...f,
            userPosition: {
                ...f.userPosition!,
                tradingRecords: updatedRecords
            }
        } : f
    ));

    setBuyModalState(null);
    setSellModalState(null);
}, [funds]);

const handleTradeDelete = useCallback((fundCode: string, recordDate: string) => {
    const fundToUpdate = funds.find(f => f.code === fundCode);
    if (!fundToUpdate || !fundToUpdate.userPosition?.tradingRecords) return;

    const updatedRecords = fundToUpdate.userPosition.tradingRecords.filter(r => r.date !== recordDate);
    
    setFunds(prevFunds => prevFunds.map(f =>
        f.code === fundCode ? {
            ...f,
            userPosition: {
                ...f.userPosition!,
                tradingRecords: updatedRecords
            }
        } : f
    ));
    
    setBuyModalState(null);
    setSellModalState(null);
}, [funds]);

  const processPendingTasks = useCallback(() => {
    if (funds.length === 0) return;

    let fundsToUpdate: { [code: string]: TradingRecord[] } = {};

    funds.forEach(fund => {
        if (!fund.userPosition?.tradingRecords) return;

        const pendingRecords = fund.userPosition.tradingRecords.filter(r => r.nav === undefined);
        if (pendingRecords.length === 0) return;

        let recordsChanged = false;
        // FIX: Explicitly set the return type of the `map` callback function to `TradingRecord`. This ensures that the newly created record objects are correctly typed and prevents TypeScript from widening the `type` property to a generic `string`, which was causing a type incompatibility with `TradingRecord[]`.
        const newRecords = fund.userPosition.tradingRecords.map((record): TradingRecord => {
            // if it's not pending, return as is
            if (record.nav !== undefined) return record;

            const confirmedDataPoint = fund.data.find(d => d.date === record.date);
            if (confirmedDataPoint) {
                recordsChanged = true;
                const confirmedNAV = confirmedDataPoint.unitNAV;
                
                if (record.type === 'buy') {
                    const buyAmount = record.value!;
                    return {
                        date: record.date, type: 'buy', nav: confirmedNAV,
                        sharesChange: parseFloat((buyAmount / confirmedNAV).toFixed(2)),
                        amount: buyAmount,
                    };
                } else { // sell
                    // Find processed fund to get cost basis at the time of the trade
                    const processedFund = processedFunds.find(f => f.code === fund.code);
                    const costBasisForSale = processedFund?.userPosition?.cost ?? 0;
                    const sellShares = record.value!;
                    return {
                        date: record.date, type: 'sell', nav: confirmedNAV,
                        sharesChange: -sellShares,
                        amount: parseFloat((-(sellShares * confirmedNAV)).toFixed(2)),
                        realizedProfitChange: parseFloat(((confirmedNAV - costBasisForSale) * sellShares).toFixed(2)),
                    };
                }
            }
            // if not confirmed yet, return the pending record
            return record;
        });

        if (recordsChanged) {
            fundsToUpdate[fund.code] = newRecords;
        }
    });

    if (Object.keys(fundsToUpdate).length > 0) {
        setFunds(prevFunds => prevFunds.map(f => {
            if (fundsToUpdate[f.code]) {
                return {
                    ...f,
                    userPosition: {
                        ...f.userPosition!,
                        tradingRecords: fundsToUpdate[f.code]
                    }
                };
            }
            return f;
        }));
    }
}, [funds, processedFunds]);

  useEffect(() => {
    if (!isAppLoading && funds.length > 0) {
      processPendingTasks();
    }
    // This effect should run after initial load or a data refresh (which updates funds).
  }, [isAppLoading, funds, processPendingTasks]);

  const currentPortfolioJSON = useMemo(() => {
    const positionsToSave = funds
      .map(f => f.userPosition)
      .filter((p): p is UserPosition => !!p);
    return JSON.stringify(positionsToSave, null, 2);
  }, [funds]);

  const portfolioSnapshots = useMemo((): PortfolioSnapshot[] => {
    const allTransactionDates = new Set<string>();
    funds.forEach(fund => {
        fund.userPosition?.tradingRecords?.forEach(record => {
             // Only confirmed records create snapshots
            if (record.nav !== undefined) {
                allTransactionDates.add(record.date);
            }
        });
    });

    const latestNavMap = new Map(processedFunds.map(f => [f.code, f.baseChartData[f.baseChartData.length - 1]?.unitNAV ?? 0]));
    let historicalSnapshots: PortfolioSnapshot[] = [];

    if (allTransactionDates.size > 0) {
        const sortedDates = Array.from(allTransactionDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        const snapshots = sortedDates.map(snapshotDate => {
            let snapshotTotalCostBasis = 0;
            let snapshotTotalRealizedProfit = 0;
            const snapshotHoldings: { code: string; shares: number; }[] = [];
            let netAmountChangeOnDate = 0;
            let totalBuyAmountOnDate = 0;
            let totalBuyFloatingProfitOnDate = 0;
            let totalSellAmountOnDate = 0;
            let totalSellOpportunityProfitOnDate = 0;
            let totalSellRealizedProfitOnDate = 0;

            funds.forEach(fund => {
                const position = fund.userPosition;
                if (!position) return;

                let sharesForFund = position.shares;
                let totalCostForFund = position.shares * position.cost;
                let realizedProfitForFund = position.realizedProfit;

                const relevantRecords = (position.tradingRecords || [])
                    .filter(r => r.nav !== undefined && new Date(r.date).getTime() <= new Date(snapshotDate).getTime())
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                for (const record of relevantRecords) {
                    if (record.date === snapshotDate) {
                        netAmountChangeOnDate += record.amount!;
                        
                        const latestNAV = latestNavMap.get(fund.code) ?? 0;
                        if (record.type === 'buy') {
                            const floatingProfit = latestNAV > 0 ? (latestNAV - record.nav!) * record.sharesChange! : 0;
                            totalBuyFloatingProfitOnDate += floatingProfit;
                            totalBuyAmountOnDate += record.amount!;
                        } else { // sell
                            const opportunityProfit = latestNAV > 0 ? (record.nav! - latestNAV) * Math.abs(record.sharesChange!) : 0;
                            totalSellOpportunityProfitOnDate += opportunityProfit;
                            totalSellRealizedProfitOnDate += record.realizedProfitChange ?? 0;
                            totalSellAmountOnDate += Math.abs(record.amount!);
                        }
                    }

                    if (record.type === 'buy') {
                        sharesForFund += record.sharesChange!;
                        totalCostForFund += record.amount!;
                    } else { // sell
                        const costBasisPerShareBeforeSell = sharesForFund > 0 ? totalCostForFund / sharesForFund : 0;
                        totalCostForFund -= costBasisPerShareBeforeSell * Math.abs(record.sharesChange!);
                        sharesForFund += record.sharesChange!; // sharesChange is negative for sell
                        realizedProfitForFund += (record.realizedProfitChange ?? 0);
                        if (sharesForFund < 1e-6) {
                            sharesForFund = 0;
                            totalCostForFund = 0;
                        }
                    }
                }
                
                if (sharesForFund > 0) {
                    snapshotHoldings.push({ code: fund.code, shares: sharesForFund });
                    snapshotTotalCostBasis += totalCostForFund;
                }
                snapshotTotalRealizedProfit += realizedProfitForFund;
            });

            let currentMarketValue = 0;
            let dailyProfit = 0;
            let yesterdayMarketValue = 0;
            
            snapshotHoldings.forEach(holding => {
                const currentFundData = processedFunds.find(f => f.code === holding.code);
                if (currentFundData?.baseChartData && currentFundData.baseChartData.length > 0) {
                    const chartData = currentFundData.baseChartData;
                    const latestNAV = chartData[chartData.length - 1].unitNAV ?? 0;
                    const yesterdayNAV = chartData.length > 1 ? (chartData[chartData.length - 2].unitNAV ?? 0) : 0;
                    
                    if (latestNAV > 0) {
                        currentMarketValue += holding.shares * latestNAV;
                    }
                    if (yesterdayNAV > 0 && latestNAV > 0) {
                        dailyProfit += (latestNAV - yesterdayNAV) * holding.shares;
                        yesterdayMarketValue += holding.shares * yesterdayNAV;
                    }
                }
            });

            const cumulativeValue = currentMarketValue + snapshotTotalRealizedProfit;
            const totalProfit = cumulativeValue - snapshotTotalCostBasis;
            const profitRate = snapshotTotalCostBasis > 0 ? (totalProfit / snapshotTotalCostBasis) * 100 : 0;
            const dailyProfitRate = yesterdayMarketValue > 0 ? (dailyProfit / yesterdayMarketValue) * 100 : 0;

            return {
                snapshotDate,
                totalCostBasis: snapshotTotalCostBasis,
                currentMarketValue,
                cumulativeValue,
                totalProfit,
                profitRate,
                dailyProfit,
                dailyProfitRate,
                netAmountChange: netAmountChangeOnDate,
                totalBuyAmount: totalBuyAmountOnDate,
                totalBuyFloatingProfit: totalBuyFloatingProfitOnDate,
                totalSellAmount: totalSellAmountOnDate,
                totalSellOpportunityProfit: totalSellOpportunityProfitOnDate,
                totalSellRealizedProfit: totalSellRealizedProfitOnDate,
            };
        });

        historicalSnapshots = snapshots.reverse(); // Newest first
    }

    // Always generate a baseline snapshot.
    // For new users, this will be an empty portfolio.
    // For users with holdings, it reflects the state before any trading records are applied.
    let baselineTotalCostBasis = 0;
    let baselineTotalRealizedProfit = 0;
    const baselineHoldings: { code: string; shares: number; }[] = [];

    // Calculate baseline state from initial positions, ignoring tradingRecords
    funds.forEach(fund => {
        const position = fund.userPosition;
        // The user wants to include funds that have been sold off (shares=0) but have realized profit.
        // The baseline should reflect the initial state of ALL funds, regardless of their current shares.
        if (position) {
            baselineHoldings.push({ code: fund.code, shares: position.shares });
            baselineTotalCostBasis += position.shares * position.cost;
            baselineTotalRealizedProfit += position.realizedProfit;
        }
    });
    
    // Evaluate baseline holdings against current market data
    let baselineCurrentMarketValue = 0;
    let baselineDailyProfit = 0;
    let baselineYesterdayMarketValue = 0;

    baselineHoldings.forEach(holding => {
        const currentFundData = processedFunds.find(f => f.code === holding.code);
        if (currentFundData?.baseChartData && currentFundData.baseChartData.length > 0) {
            const chartData = currentFundData.baseChartData;
            const latestNAV = chartData[chartData.length - 1].unitNAV ?? 0;
            const yesterdayNAV = chartData.length > 1 ? (chartData[chartData.length - 2].unitNAV ?? 0) : 0;

            if (latestNAV > 0) {
                baselineCurrentMarketValue += holding.shares * latestNAV;
            }
            if (yesterdayNAV > 0 && latestNAV > 0) {
                baselineDailyProfit += (latestNAV - yesterdayNAV) * holding.shares;
                baselineYesterdayMarketValue += holding.shares * yesterdayNAV;
            }
        }
    });
    
    const baselineCumulativeValue = baselineCurrentMarketValue + baselineTotalRealizedProfit;
    const baselineTotalProfit = baselineCumulativeValue - baselineTotalCostBasis;
    const baselineProfitRate = baselineTotalCostBasis > 0 ? (baselineTotalProfit / baselineTotalCostBasis) * 100 : 0;
    const baselineDailyProfitRate = baselineYesterdayMarketValue > 0 ? (baselineDailyProfit / baselineYesterdayMarketValue) * 100 : 0;

    const baselineSnapshot: PortfolioSnapshot = {
        snapshotDate: '基准持仓',
        totalCostBasis: baselineTotalCostBasis,
        currentMarketValue: baselineCurrentMarketValue,
        cumulativeValue: baselineCumulativeValue,
        totalProfit: baselineTotalProfit,
        profitRate: baselineProfitRate,
        dailyProfit: baselineDailyProfit,
        dailyProfitRate: baselineDailyProfitRate,
    };

    const allSnapshots = [...historicalSnapshots, baselineSnapshot];

    const snapshotsWithChange = allSnapshots.map((snapshot, index) => {
      if (index < allSnapshots.length - 1) {
          const previousSnapshot = allSnapshots[index + 1];
          const marketValueChange = snapshot.currentMarketValue - previousSnapshot.currentMarketValue;
          const operationProfit = marketValueChange - (snapshot.netAmountChange ?? 0);
          const profitPerHundred = (snapshot.netAmountChange ?? 0) !== 0 ? (operationProfit / Math.abs(snapshot.netAmountChange ?? 0)) * 100 : undefined;
          
          const profitCaused = snapshot.dailyProfit - previousSnapshot.dailyProfit;
          const profitCausedPerHundred = (snapshot.netAmountChange ?? 0) !== 0 ? (profitCaused / Math.abs(snapshot.netAmountChange ?? 0)) * 100 : undefined;
          
          const operationEffect = Math.abs(previousSnapshot.dailyProfit) > 1e-6
              ? (profitCaused / Math.abs(previousSnapshot.dailyProfit)) * 100 
              : 100;

          return { ...snapshot, marketValueChange, operationProfit, profitPerHundred, profitCaused, profitCausedPerHundred, operationEffect };
      }
      return snapshot;
    });

    return snapshotsWithChange;
}, [funds, processedFunds]);

  const snapshotSummary = useMemo(() => {
    if (portfolioSnapshots.length < 2) {
      return { summaryProfitCaused: undefined, summaryOperationEffect: undefined };
    }

    const latestSnapshot = portfolioSnapshots[0];
    const baselineSnapshot = portfolioSnapshots[portfolioSnapshots.length - 1];

    // Ensure we have a valid baseline to compare against
    if (baselineSnapshot.snapshotDate !== '基准持仓') {
       return { summaryProfitCaused: undefined, summaryOperationEffect: undefined };
    }

    const summaryProfitCaused = latestSnapshot.dailyProfit - baselineSnapshot.dailyProfit;
    
    // This logic is duplicated from PortfolioSnapshotTable, as requested for consistency.
    const summaryOperationEffect = Math.abs(baselineSnapshot.dailyProfit) > 1e-6
        ? (summaryProfitCaused / Math.abs(baselineSnapshot.dailyProfit)) * 100
        : 100;

    return { summaryProfitCaused, summaryOperationEffect };
  }, [portfolioSnapshots]);
  
  const pendingTaskCount = useMemo(() => {
    return funds.reduce((count, fund) => {
        const pendingRecords = fund.userPosition?.tradingRecords?.filter(r => r.nav === undefined).length ?? 0;
        return count + pendingRecords;
    }, 0);
  }, [funds]);
  
  const handleEditPendingRecord = useCallback((fund: ProcessedFund, record: TradingRecord) => {
    setIsTransactionManagerOpen(false); // Close manager modal first
    const navForModal = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
    handleOpenTradeModal(fund, record.date, record.type, navForModal, false, record);
  }, [handleOpenTradeModal]);

  const handleGenerateAdvice = useCallback(async () => {
    setIsGeminiLoading(true);
    setGeminiError(null);
    try {
      const result = await generatePortfolioAdvice({
        funds: processedFunds,
        snapshots: portfolioSnapshots,
        indexData: indexData,
        activeTag: activeTag,
      });
      setGeminiAnalysisResult(result);
    } catch (err) {
      setGeminiError(err instanceof Error ? err.message : '生成建议失败');
    } finally {
      setIsGeminiLoading(false);
    }
  }, [processedFunds, portfolioSnapshots, indexData, activeTag]);

  const handleOpenGemini = () => {
    setIsGeminiModalOpen(true);
    // Reset result if user wants to start fresh every time they open, 
    // or keep it if you want caching. Here we keep it unless funds change,
    // but the effect in modal handles auto-generation if empty.
  };

  const handleTerminalCommand = useCallback((cmd: string) => {
     return processTerminalCommand(cmd, processedFunds, setFunds, { recordCount, zigzagThreshold }, portfolioSnapshots);
  }, [processedFunds, setFunds, recordCount, zigzagThreshold, portfolioSnapshots]);


  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200 font-sans p-4">
      {isVeiled && (
        <PrivacyVeil 
          onRefresh={handleRefresh} 
          lastRefreshTime={lastRefreshTime} 
          totalDailyProfit={analysisResults.portfolioTotals.totalDailyProfit}
          totalDailyProfitRate={analysisResults.portfolioTotals.dailyProfitRate}
          summaryProfitCaused={snapshotSummary.summaryProfitCaused}
          summaryOperationEffect={snapshotSummary.summaryOperationEffect}
          indexData={indexData}
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
            onLongPressRefresh={handleFullReload}
            isRefreshing={isRefreshing}
            isLoading={isLoading || isAppLoading}
            totalDailyProfit={analysisResults.portfolioTotals.totalDailyProfit}
            totalDailyProfitRate={analysisResults.portfolioTotals.dailyProfitRate}
            summaryProfitCaused={snapshotSummary.summaryProfitCaused}
            summaryOperationEffect={snapshotSummary.summaryOperationEffect}
            onOpenGemini={handleOpenGemini}
          />
          <TagAnalysisTable 
            data={analysisResults.tagAnalysisData} 
            totals={analysisResults.portfolioTotals} 
            activeTag={activeTag}
            onTagDoubleClick={handleTagDoubleClick}
            sortKey={tagSortKey}
            sortOrder={tagSortOrder}
            onSortChange={handleTagSortChange}
          />
          <div ref={fundTableContainerRef} className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4">
            <div className="w-full overflow-x-auto pb-4">
              <table className="w-full text-sm text-center border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="p-0 border-r border-gray-300 dark:border-gray-600 font-semibold text-gray-600 dark:text-gray-300 w-[250px] min-w-[250px] text-left md:sticky top-0 md:left-0 bg-gray-50 dark:bg-gray-800 md:z-30">基金名称</th>
                    <th className="p-0 border-r border-gray-300 dark:border-gray-600 font-semibold text-gray-600 dark:text-gray-300 w-[450px] min-w-[450px] md:sticky top-0 md:left-[0px] bg-gray-50 dark:bg-gray-800 md:z-20">净值走势</th>
                    <th className="p-0 border-r border-gray-300 dark:border-gray-600 font-semibold text-gray-600 dark:text-gray-300 w-[60px] min-w-[60px] bg-gray-50 dark:bg-gray-800">
                      {todayHeaderDate ? (
                        <>{todayHeaderDate.substring(5)}{getWeekday(todayHeaderDate)}</>
                      ) : (
                        '当日净值'
                      )}
                    </th>
                    {dateHeaders.map(date => (
                      <th key={date} className="p-0 border-r border-gray-300 dark:border-gray-600 font-normal text-gray-500 dark:text-gray-400 min-w-[60px] md:sticky top-0 bg-gray-50 dark:bg-gray-800">
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
                      onTrade={handleOpenTradeModal}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {portfolioSnapshots.length > 1 && <PortfolioSnapshotTable snapshots={portfolioSnapshots} funds={processedFunds} />}
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
          onOpenTransactionManager={() => setIsTransactionManagerOpen(true)}
          onOpenTerminal={() => setIsTerminalOpen(true)}
          pendingTaskCount={pendingTaskCount}
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
        currentData={currentPortfolioJSON}
        funds={funds}
      />
      
      <TransactionManagerModal
        isOpen={isTransactionManagerOpen}
        onClose={() => setIsTransactionManagerOpen(false)}
        funds={processedFunds}
        onEdit={handleEditPendingRecord}
        onDelete={handleTradeDelete}
      />

      <GeminiAdvisorModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        isLoading={isGeminiLoading}
        analysisResult={geminiAnalysisResult}
        error={geminiError}
        onGenerate={handleGenerateAdvice}
      />

      <TerminalModal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        onCommand={handleTerminalCommand}
      />

      {buyModalState && (
          <BuyModal 
              isOpen={!!buyModalState}
              onClose={() => setBuyModalState(null)}
              onSubmit={handleTradeSubmit}
              onDelete={handleTradeDelete}
              tradeState={buyModalState}
          />
      )}

      {sellModalState && (
          <SellModal 
              isOpen={!!sellModalState}
              onClose={() => setSellModalState(null)}
              onSubmit={handleTradeSubmit}
              onDelete={handleTradeDelete}
              tradeState={sellModalState}
          />
      )}
    </div>
  );
};

export default App;
