
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Fund, UserPosition, ProcessedFund, TagAnalysisData, TagSortOrder, IndexData, TradingRecord, TradeModalState, PortfolioSnapshot, RealTimeData, TransactionType, SortByType, MarketDataPoint, SyncMetadata } from './types';
import { fetchFundData, fetchFundDetails, fetchIndexData, fetchTotalTurnover } from './services/fundService';
import { updateGistData, fetchGistData } from './services/gistService';
import FundInputForm from './components/FundInputForm';
import FundTable from './components/FundTable';
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
import ReportView from './components/ReportView';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

const SYSTEM_TAGS = {
  HOLDING: '持有',
  WATCHING: '自选',
  PROFIT: '盈利',
  LOSS: '亏损',
  RECENT_TRANSACTION: '近期有交易',
  STRONG_BUY: '🔴 强力买入',
  BUY: '🟠 建议买入',
  HOLD: '⚪️ 持有/观望',
  SELL: '🔵 建议减仓',
  STRONG_SELL: '🟢 强力卖出',
};

const ORDERED_SYSTEM_TAGS = [
  SYSTEM_TAGS.HOLDING, 
  SYSTEM_TAGS.WATCHING, 
  SYSTEM_TAGS.PROFIT, 
  SYSTEM_TAGS.LOSS, 
  SYSTEM_TAGS.RECENT_TRANSACTION,
  SYSTEM_TAGS.STRONG_BUY,
  SYSTEM_TAGS.BUY,
  SYSTEM_TAGS.HOLD,
  SYSTEM_TAGS.SELL,
  SYSTEM_TAGS.STRONG_SELL,
];

const LAST_FULL_RELOAD_KEY = 'LAST_FULL_RELOAD_DATE';

const getLocalDateString = () => {
    // 使用瑞典语区域设置 (sv-SE) 是获取 YYYY-MM-DD 本地日期字符串的快捷可靠方式
    return new Date().toLocaleDateString('sv-SE');
};

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
                    !['buy', 'sell', 'dividend-cash', 'dividend-reinvest'].includes(record.type)
                ) {
                    return false;
                }
                const isPending = typeof record.value === 'number';
                const isConfirmed = typeof record.nav === 'number';
                if (!isPending && !isConfirmed) {
                    return false;
                }
            }
        }
    }
    return true;
};

const shouldAutoRefresh = (): boolean => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 18;
};

const isMobileDevice = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
  const [isPrivacyModeEnabled, setIsPrivacyModeEnabled] = useState(() => !isMobileDevice());
  const [isVeiled, setIsVeiled] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const [tagSortKey, setTagSortKey] = useState<keyof TagAnalysisData>('dailyProfitRate');
  const [tagSortOrder, setTagSortOrder] = useState<TagSortOrder>('desc');
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [marketTurnover, setMarketTurnover] = useState<string | null>(null);
  const [marketTurnoverPoints, setMarketTurnoverPoints] = useState<MarketDataPoint[]>([]);
  
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(() => {
    return localStorage.getItem('AUTO_SYNC_ENABLED') === 'true';
  });

  const [isReportMode, setIsReportMode] = useState(() => localStorage.getItem('GINOS_REPORT_MODE') === 'true');

  const inactivityTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const appLoaded = useRef<boolean>(false);
  const fundTableContainerRef = useRef<HTMLDivElement>(null);
  const blockSaveRef = useRef<boolean>(false);

  const getCurrentTimeString = useCallback(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }, []);

  const scrollToFundTable = useCallback(() => {
    setTimeout(() => {
        if (fundTableContainerRef.current) {
            const targetY = fundTableContainerRef.current.offsetTop;
            window.scrollTo({ top: Math.max(0, targetY), left: 0, behavior: 'smooth' });
        }
    }, 100);
  }, []);

  useEffect(() => {
    if (!isAppLoading && !appLoaded.current) {
        setLastRefreshTime(getCurrentTimeString());
        appLoaded.current = true;
    }
  }, [isAppLoading, getCurrentTimeString]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const reportFromUrl = urlParams.get('report');
    let shouldClean = false;

    if (tokenFromUrl) {
      localStorage.setItem('GITHUB_TOKEN', tokenFromUrl);
      urlParams.delete('token');
      shouldClean = true;
    }
    if (reportFromUrl === 'true') {
        localStorage.setItem('GINOS_REPORT_MODE', 'true');
        setIsReportMode(true);
        urlParams.delete('report');
        shouldClean = true;
    }
    if (shouldClean) {
      const newSearch = urlParams.toString();
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '');
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  useEffect(() => {
    const isAnyModalOpen = isVeiled || !!selectedFundForModal || isImportModalOpen || isTransactionManagerOpen || isGeminiModalOpen || isTerminalOpen || !!buyModalState || !!sellModalState;
    document.body.style.overflow = isAnyModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isVeiled, selectedFundForModal, isImportModalOpen, isTransactionManagerOpen, isGeminiModalOpen, isTerminalOpen, buyModalState, sellModalState]);

  useEffect(() => {
    if (!isPrivacyModeEnabled || isReportMode) {
      if (isVeiled) setIsVeiled(false);
      return;
    }
    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = window.setTimeout(() => { setIsVeiled(true); }, 8000);
    };
    const handleMouseLeave = () => setIsVeiled(true);
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setIsVeiled(prev => {
        const isNowVeiled = !prev;
        if (!isNowVeiled) resetTimer();
        return isNowVeiled;
      });
    };
    const handleActivity = () => { if (!isVeiled) resetTimer(); };
    const handleTouchStart = () => {
      if (!isVeiled) return;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = window.setTimeout(() => { setIsVeiled(false); }, 500);
    };
    const handleTouchEndOrCancel = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

    document.body.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('wheel', handleActivity);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEndOrCancel);
    window.addEventListener('touchcancel', handleTouchEndOrCancel);
    resetTimer();
    return () => {
      document.body.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEndOrCancel);
      window.removeEventListener('touchcancel', handleTouchEndOrCancel);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, [isPrivacyModeEnabled, isVeiled, isReportMode]);

  useEffect(() => {
    if (isVeiled && !isMobileDevice()) window.location.href = 'feishu://';
  }, [isVeiled]);

  useEffect(() => {
      if (!isAppLoading && funds.length === 0) setIsPrivacyModeEnabled(false);
  }, [funds.length, isAppLoading]);

  const loadFundsFromPositions = useCallback(async (positions: UserPosition[]) => {
      setIsAppLoading(true);
      setError(null);
      blockSaveRef.current = false;
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
                const originalPosition = positions[index];
                failedCodes.push(code);
                loadedFunds.push({
                  code: code,
                  name: `加载失败 (${code})`,
                  data: [],
                  realTimeData: undefined,
                  latestNAV: undefined,
                  latestChange: undefined,
                  userPosition: originalPosition,
                });
            }
        });
        if (loadedFunds.length > 0) {
          setFunds(loadedFunds.map((fund, index) => ({ ...fund, color: COLORS[index % COLORS.length] })));
          // 初始化加载即包含全量历史，打上今日标记
          localStorage.setItem(LAST_FULL_RELOAD_KEY, getLocalDateString());
        } else {
          setFunds([]);
        }
        if (failedCodes.length > 0) {
            setError(failedCodes.length === positions.length ? "网络错误：所有基金数据加载失败。" : `部分基金加载失败: ${failedCodes.join(', ')}。`);
        }
      } catch (err) {
        setError("加载基金时发生未知错误。为防止数据丢失，本地保存已暂停。");
        blockSaveRef.current = true;
      } finally {
        setIsAppLoading(false);
      }
  }, [recordCount]);

  useEffect(() => {
    const loadSavedData = async () => {
      const token = localStorage.getItem('GITHUB_TOKEN');
      const isAutoSync = localStorage.getItem('AUTO_SYNC_ENABLED') === 'true';
      let deviceId = localStorage.getItem('GINOS_DEVICE_ID');
      if (!deviceId) {
          deviceId = self.crypto.randomUUID();
          localStorage.setItem('GINOS_DEVICE_ID', deviceId);
      }
      try {
          const { fundData, metadata, marketHistory } = await fetchGistData(token || undefined);
          if (metadata && metadata.masterId !== deviceId && isAutoSync) {
              localStorage.setItem('AUTO_SYNC_ENABLED', 'false');
              setIsAutoSyncEnabled(false);
          }
          if (token && fundData && fundData.trim()) localStorage.setItem('userFundPortfolio', fundData);
          if (marketHistory) {
              try {
                  const cloudHistory = JSON.parse(marketHistory);
                  const localHistory = JSON.parse(localStorage.getItem('ginos_market_history_v1') || '{}');
                  const merged = { ...cloudHistory, ...localHistory };
                  const finalHistory: any = {};
                  Object.keys(merged).sort().slice(-5).forEach(d => finalHistory[d] = merged[d]);
                  localStorage.setItem('ginos_market_history_v1', JSON.stringify(finalHistory));
              } catch (e) {}
          }
      } catch (e) {}
      try {
        fetchIndexData().then(setIndexData);
        fetchTotalTurnover().then(res => { if (res) { setMarketTurnover(res.display); setMarketTurnoverPoints(res.points); } });
        const savedPositionsJSON = localStorage.getItem('userFundPortfolio');
        if (savedPositionsJSON) {
          const savedPositions = JSON.parse(savedPositionsJSON);
           if (validatePositions(savedPositions)) await loadFundsFromPositions(savedPositions);
           else { localStorage.removeItem('userFundPortfolio'); setIsAppLoading(false); }
        } else setIsAppLoading(false);
      } catch (err) {
        localStorage.removeItem('userFundPortfolio');
        setIsAppLoading(false);
      }
    };
    loadSavedData();
  }, [loadFundsFromPositions]);

  useEffect(() => {
    if (!isAppLoading && !blockSaveRef.current) {
      const positionsToSave = funds.map(f => f.userPosition).filter((p): p is UserPosition => !!p);
      localStorage.setItem('userFundPortfolio', JSON.stringify(positionsToSave));
    }
  }, [funds, isAppLoading]);

  const handleAddFund = useCallback(async (details: { code: string; shares: number; cost: number; tag: string }): Promise<boolean> => {
    const { code, shares, cost, tag } = details;
    if (!code.trim()) { setError('Please provide a fund code.'); return false; }
    if (funds.some(f => f.code === code)) { setError(`Fund ${code} is already being tracked.`); return false; }
    setIsLoading(true); setError(null);
    try {
      const [data, fundDetails] = await Promise.all([fetchFundData(code, recordCount), fetchFundDetails(code)]);
      if (!fundDetails.name) throw new Error(`无法找到基金 ${code} 的信息。`);
      const latestData = data[data.length - 1];
      const newFund: Fund = {
        code, name: fundDetails.name, realTimeData: fundDetails.realTimeData, data, latestNAV: latestData?.unitNAV, latestChange: latestData?.dailyGrowthRate, color: COLORS[funds.length % COLORS.length],
        userPosition: { code, shares, cost, realizedProfit: 0, tag, tradingRecords: [] }
      };
      setFunds(prevFunds => [...prevFunds, newFund]);
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); return false; }
    finally { setIsLoading(false); }
  }, [funds, recordCount]);
  
  const handleRefresh = useCallback(async () => {
    if (funds.length === 0) return;
    setLastRefreshTime(getCurrentTimeString());
    setIsRefreshing(true); setError(null);
    const indexPromise = fetchIndexData();
    const turnoverPromise = fetchTotalTurnover();
    const initialFetchResults = await Promise.allSettled(funds.map(fund => fetchFundDetails(fund.code)));
    const updatedDetailsMap = new Map<string, { realTimeData?: RealTimeData }>();
    const failedCodesToRetry: string[] = [];
    initialFetchResults.forEach((result, index) => {
        const code = funds[index].code;
        if (result.status === 'fulfilled') updatedDetailsMap.set(code, { realTimeData: result.value.realTimeData });
        else failedCodesToRetry.push(code);
    });
    if (failedCodesToRetry.length > 0) {
        const retryResults = await Promise.allSettled(failedCodesToRetry.map(code => fetchFundDetails(code)));
        retryResults.forEach((result, index) => {
            const code = failedCodesToRetry[index];
            if (result.status === 'fulfilled') updatedDetailsMap.set(code, { realTimeData: result.value.realTimeData });
        });
    }
    if (updatedDetailsMap.size > 0) {
        setFunds(currentFunds => currentFunds.map(fund => {
            const newDetails = updatedDetailsMap.get(fund.code);
            return newDetails ? { ...fund, ...newDetails } : fund;
        }));
    }
    try {
        const newIndexData = await indexPromise; setIndexData(newIndexData);
        const res = await turnoverPromise;
        if (res) { setMarketTurnover(res.display); setMarketTurnoverPoints(res.points); }
    } catch (err) {} finally { setIsRefreshing(false); }
}, [funds, getCurrentTimeString]);

  const handleFullReload = useCallback(async () => {
    if (funds.length === 0) return;
    setIsLoading(true); setError(null);
    try {
      const updatedFundsPromises = funds.map(async (fund) => {
        const newData = await fetchFundData(fund.code, recordCount);
        const latestData = newData[newData.length - 1];
        return { ...fund, data: newData, latestNAV: latestData?.unitNAV, latestChange: latestData?.dailyGrowthRate };
      });
      setFunds(await Promise.all(updatedFundsPromises));
      // 标记今日全量更新已完成
      localStorage.setItem(LAST_FULL_RELOAD_KEY, getLocalDateString());
    } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred while fully reloading funds.'); }
    finally { setIsLoading(false); }
  }, [funds, recordCount]);

  useEffect(() => {
    if (isRefreshing || isLoading || isAppLoading) return;
    
    const intervalId = setInterval(async () => {
      if (!shouldAutoRefresh()) return;

      const today = getLocalDateString();
      const lastFullReload = localStorage.getItem(LAST_FULL_RELOAD_KEY);

      if (lastFullReload !== today) {
          // 每日首次触发：进行全量历史重载
          console.log(`[AutoRefresh] 发现新的一天 (${today})，正在执行每日全量校准...`);
          await handleFullReload();
      } else {
          // 今日已全量过：仅进行轻量实时刷新
          handleRefresh();
      }
    }, 3 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [handleRefresh, handleFullReload, isRefreshing, isLoading, isAppLoading]);

  useEffect(() => {
    document.body.style.cursor = (isLoading || isRefreshing || isAppLoading) ? 'wait' : 'default';
    return () => { document.body.style.cursor = 'default'; };
  }, [isLoading, isRefreshing, isAppLoading]);

  const handleRecordCountChange = useCallback(async (newRecordCount: number) => {
    setRecordCount(newRecordCount);
    if (funds.length === 0) return;
    setIsLoading(true); setError(null);
    try {
      const updatedFundsPromises = funds.map(async (fund) => {
        const newData = await fetchFundData(fund.code, newRecordCount);
        const latestData = newData[newData.length - 1];
        return { ...fund, data: newData, latestNAV: latestData?.unitNAV, latestChange: latestData?.dailyGrowthRate };
      });
      setFunds(await Promise.all(updatedFundsPromises));
    } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred while updating funds.'); }
    finally { setIsLoading(false); }
  }, [funds]);

  const handleImportData = useCallback(async (jsonString: string) => {
    try {
        if (!jsonString.trim()) throw new Error("Input is empty.");
        const data = JSON.parse(jsonString);
        if (!validatePositions(data)) throw new Error("Invalid JSON format.");
        setFunds([]); await loadFundsFromPositions(data);
    } catch (error) { throw error instanceof Error ? error : new Error("Failed to parse or validate JSON data."); }
  }, [loadFundsFromPositions]);

  const processedFunds = useMemo((): ProcessedFund[] => {
    return funds.map((fund): ProcessedFund => {
        const baseChartData = [...fund.data];
        if (fund.realTimeData && !isNaN(fund.realTimeData.estimatedNAV) && fund.realTimeData.estimatedNAV > 0) {
            const realTimeDate = fund.realTimeData.estimationTime.split(' ')[0];
            if (!fund.data.some(d => d.date === realTimeDate)) {
                baseChartData.push({
                    date: fund.realTimeData.estimationTime, unitNAV: fund.realTimeData.estimatedNAV, cumulativeNAV: fund.realTimeData.estimatedNAV,
                    dailyGrowthRate: fund.realTimeData.estimatedChange, subscriptionStatus: 'N/A', redemptionStatus: 'N/A', dividendDistribution: 'N/A',
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
                if (record.nav === undefined) continue;
                if (record.type === 'buy') {
                    currentShares = parseFloat((currentShares + record.sharesChange!).toFixed(2));
                    currentTotalCost = parseFloat((currentTotalCost + record.amount!).toFixed(2));
                } else if (record.type === 'sell') { 
                    const costBasisBeforeSell = currentShares > 0 ? currentTotalCost / currentShares : 0;
                    currentTotalCost = parseFloat((currentTotalCost - costBasisBeforeSell * Math.abs(record.sharesChange!)).toFixed(2));
                    currentShares = parseFloat((currentShares + record.sharesChange!).toFixed(2));
                    currentRealizedProfit = parseFloat((currentRealizedProfit + (record.realizedProfitChange ?? 0)).toFixed(2));
                    if (currentShares < 1e-6) { currentShares = 0; currentTotalCost = 0; }
                } else if (record.type === 'dividend-cash') {
                    currentRealizedProfit = parseFloat((currentRealizedProfit + (record.realizedProfitChange || 0)).toFixed(2));
                } else if (record.type === 'dividend-reinvest') {
                    currentShares = parseFloat((currentShares + record.sharesChange!).toFixed(2));
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
            calculatedUserPosition = { ...position, shares: currentShares, cost: currentShares > 0 ? parseFloat((currentTotalCost / currentShares).toFixed(4)) : 0, realizedProfit: currentRealizedProfit };
            portfolioMetrics = { marketValue, costBasis, holdingProfit, totalProfit, holdingProfitRate, totalProfitRate, actualCost, userPosition: calculatedUserPosition };
        }
        const lastPivotDate = zigzagPoints.length >= 2 ? zigzagPoints[zigzagPoints.length - 2]?.date : null;
        let trendInfo = null; let recentProfit = 0; let initialMarketValueForTrend = 0;
        if (zigzagPoints.length >= 2 && baseChartData.length > 0) {
            const lastPivot = zigzagPoints[zigzagPoints.length - 2];
            const latestPoint = baseChartData[baseChartData.length - 1];
            if (lastPivot?.date && latestPoint?.date && typeof lastPivot.unitNAV === 'number' && typeof latestPoint.unitNAV === 'number') {
                const pivotDate = new Date(lastPivot.date.split(' ')[0]);
                const latestDate = new Date(latestPoint.date.split(' ')[0]);
                if (!isNaN(pivotDate.getTime()) && !isNaN(latestDate.getTime())) {
                    const diffTime = latestDate.getTime() - pivotDate.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    const pivotNAV = lastPivot.unitNAV; const latestNAV = latestPoint.unitNAV;
                    if (pivotNAV !== 0) {
                        const change = ((latestNAV - pivotNAV) / pivotNAV) * 100;
                        const isPositive = change >= 0;
                        let trendText = `近${diffDays === 0 ? 1 : diffDays}天, ${isPositive ? '⬆︎' : '⬇︎'}${Math.abs(change).toFixed(2)}%`;
                        const shares = calculatedUserPosition?.shares;
                        if (shares && shares > 0) {
                            const profit = parseFloat(((latestNAV - pivotNAV) * shares).toFixed(2));
                            trendText += `, ${profit.toFixed(0)} 元`; recentProfit = profit; initialMarketValueForTrend = parseFloat((pivotNAV * shares).toFixed(2));
                        }
                        trendInfo = { text: trendText, isPositive, change, days: diffDays === 0 ? 1 : diffDays };
                    }
                }
            }
        }
        let navPercentile: number | null = null;
        if (baseChartData.length > 1) {
            const navValues = baseChartData.map(p => p.unitNAV).filter((v): v is number => typeof v === 'number' && !isNaN(v));
            if (navValues.length > 1) {
                const minNav = Math.min(...navValues); const maxNav = Math.max(...navValues);
                const latestNav = navValues[navValues.length - 1];
                navPercentile = maxNav > minNav ? ((latestNav - minNav) / (maxNav - minNav)) * 100 : 50;
            }
        }
        const percentile = navPercentile ?? 50; const recentChange = trendInfo ? trendInfo.change : 0;
        let dailyChange = 0;
        if (fund.realTimeData?.estimatedChange) dailyChange = parseFloat(fund.realTimeData.estimatedChange);
        else if (fund.latestChange) dailyChange = parseFloat(fund.latestChange.replace('%', ''));
        const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
        const scorePercentile = 100 - percentile;
        let smartTrendScore = 50; let smartSignalLabel = '';
        if (recentChange < -3) { smartTrendScore = clamp(50 + Math.abs(recentChange) * 2, 0, 100); smartSignalLabel = '超跌'; }
        else if (recentChange >= -3 && recentChange < 0) { smartTrendScore = 50; smartSignalLabel = '磨底'; }
        else if (recentChange >= 0 && recentChange < 4.5) { smartTrendScore = 50 + (recentChange / 4.5) * 30; smartSignalLabel = '爬坡'; }
        else if (recentChange >= 4.5 && recentChange <= 9) { smartTrendScore = 100; smartSignalLabel = '主升'; }
        else { smartTrendScore = clamp(100 - (recentChange - 9) * 25, 0, 100); smartSignalLabel = '过热'; }
        let smartDailyScore = 50;
        if (recentChange < 0) smartDailyScore = clamp(50 - (dailyChange * 5), 0, 100);
        else smartDailyScore = clamp(50 + (dailyChange * 5), 0, 100);
        const smartRecommendation = (0.5 * scorePercentile) + (0.3 * smartTrendScore) + (0.2 * smartDailyScore);
        return { ...fund, ...portfolioMetrics, initialUserPosition: fund.userPosition, trendInfo, baseChartData, zigzagPoints, lastPivotDate, navPercentile, recentProfit, initialMarketValueForTrend, smartRecommendation, smartSignalLabel };
    });
  }, [funds, zigzagThreshold]);

  const allTags = useMemo(() => {
    const customTagSet = new Set<string>(); const systemTagSet = new Set<string>();
    processedFunds.forEach(fund => {
        const position = fund.userPosition;
        if (position && position.shares > 0) {
            systemTagSet.add(SYSTEM_TAGS.HOLDING);
            const latestNAV = (fund.realTimeData?.estimatedNAV && fund.realTimeData.estimatedNAV > 0 ? fund.realTimeData.estimatedNAV : fund.latestNAV) ?? 0;
            if ((latestNAV - position.cost) * position.shares > 0) systemTagSet.add(SYSTEM_TAGS.PROFIT);
            else if ((latestNAV - position.cost) * position.shares < 0) systemTagSet.add(SYSTEM_TAGS.LOSS);
        } else systemTagSet.add(SYSTEM_TAGS.WATCHING);
        if (fund.userPosition?.tag) fund.userPosition.tag.split(',').map(t => t.trim()).filter(t => t).forEach(t => customTagSet.add(t));
        if (fund.trendInfo && fund.trendInfo.days > 0 && fund.lastPivotDate && fund.userPosition?.tradingRecords) {
             if (fund.userPosition.tradingRecords.some(r => new Date(r.date).getTime() >= new Date(fund.lastPivotDate!).getTime())) systemTagSet.add(SYSTEM_TAGS.RECENT_TRANSACTION);
        }
        const smartS = fund.smartRecommendation;
        if (smartS !== undefined) {
            if (smartS >= 75) systemTagSet.add(SYSTEM_TAGS.STRONG_BUY);
            else if (smartS >= 60) systemTagSet.add(SYSTEM_TAGS.BUY);
            else if (smartS >= 40) systemTagSet.add(SYSTEM_TAGS.HOLD);
            else if (smartS >= 25) systemTagSet.add(SYSTEM_TAGS.SELL);
            else systemTagSet.add(SYSTEM_TAGS.STRONG_SELL);
        }
    });
    return [...ORDERED_SYSTEM_TAGS.filter(tag => systemTagSet.has(tag)), ...Array.from(customTagSet).sort()];
}, [processedFunds]);

  const analysisResults = useMemo(() => {
    let totalCostBasis = 0; let totalMarketValue = 0; let totalHoldingProfit = 0; let grandTotalProfit = 0;
    let totalDailyProfit = 0; let totalYesterdayMarketValue = 0; let totalRecentProfit = 0;
    let totalInitialMarketValueForTrend = 0; let totalRecentOperationAmount = 0; let totalHasRecentTransaction = false;
    processedFunds.forEach(fund => {
        grandTotalProfit += fund.totalProfit ?? 0;
        const recentOps = (fund.userPosition?.tradingRecords || []).filter(r => r.nav !== undefined && fund.lastPivotDate && new Date(r.date).getTime() >= new Date(fund.lastPivotDate!).getTime());
        if (recentOps.length > 0) {
             totalHasRecentTransaction = true;
             recentOps.forEach(r => { if (r.type === 'dividend-cash') totalRecentOperationAmount -= (r.realizedProfitChange || 0); else totalRecentOperationAmount += (r.amount || 0); });
        }
        const position = fund.userPosition;
        if (position && position.shares > 0) {
            totalCostBasis += fund.costBasis ?? 0; totalMarketValue += fund.marketValue ?? 0; totalHoldingProfit += fund.holdingProfit ?? 0;
            totalRecentProfit += fund.recentProfit ?? 0; totalInitialMarketValueForTrend += fund.initialMarketValueForTrend ?? 0;
            const chartPoints = fund.baseChartData;
            if (chartPoints.length >= 2) {
                const todayNAV = chartPoints[chartPoints.length - 1]?.unitNAV; const yesterdayNAV = chartPoints[chartPoints.length - 2]?.unitNAV;
                if (yesterdayNAV && todayNAV && todayNAV > 0) {
                    totalDailyProfit += parseFloat(((todayNAV - yesterdayNAV) * position.shares).toFixed(2));
                    totalYesterdayMarketValue += parseFloat((yesterdayNAV * position.shares).toFixed(2));
                }
            }
        }
    });
    const totals = {
        totalCostBasis, totalMarketValue, cumulativeMarketValue: totalCostBasis + grandTotalProfit, grandTotalProfit, totalHoldingProfit, totalDailyProfit,
        totalRecentProfit, totalRecentOperationAmount, totalYesterdayMarketValue, totalInitialMarketValueForTrend,
        holdingProfitRate: totalCostBasis > 0 ? (totalHoldingProfit / totalCostBasis) * 100 : 0,
        totalProfitRate: totalCostBasis > 0 ? (grandTotalProfit / totalCostBasis) * 100 : 0,
        dailyProfitRate: totalYesterdayMarketValue > 0 ? (totalDailyProfit / totalYesterdayMarketValue) * 100 : 0,
        recentProfitRate: totalInitialMarketValueForTrend > 0 ? (totalRecentProfit / totalInitialMarketValueForTrend) * 100 : 0,
        hasRecentTransaction: totalHasRecentTransaction,
    };
    const metricsByTag: { [tag: string]: any } = {};
    processedFunds.forEach(fund => {
        const recentOps = (fund.userPosition?.tradingRecords || []).filter(r => r.nav !== undefined && fund.lastPivotDate && new Date(r.date).getTime() >= new Date(fund.lastPivotDate!).getTime());
        const hasRecentTx = recentOps.length > 0; let fundRecentOpAmount = 0;
        if (hasRecentTx) recentOps.forEach(r => { if (r.type === 'dividend-cash') fundRecentOpAmount -= (r.realizedProfitChange || 0); else fundRecentOpAmount += (r.amount || 0); });
        const position = fund.userPosition; if (!position || !position.tag) return;
        position.tag.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
            if (!metricsByTag[tag]) metricsByTag[tag] = { totalCostBasis: 0, totalMarketValue: 0, totalHoldingProfit: 0, totalRealizedProfit: 0, totalDailyProfit: 0, totalYesterdayMarketValue: 0, totalRecentProfit: 0, totalInitialMarketValueForTrend: 0, totalRecentOperationAmount: 0, fundCodes: new Set<string>(), sumDailyRates: 0, dailyRateCount: 0, sumRecentRates: 0, recentRateCount: 0, hasRecentTransaction: false };
            metricsByTag[tag].fundCodes.add(fund.code); metricsByTag[tag].totalRealizedProfit += position.realizedProfit || 0; metricsByTag[tag].totalRecentOperationAmount += fundRecentOpAmount;
            if (hasRecentTx) metricsByTag[tag].hasRecentTransaction = true;
            const dailyChangeStr = fund.realTimeData?.estimatedChange ?? fund.latestChange;
            const dailyChange = dailyChangeStr ? parseFloat(dailyChangeStr) : null;
            if (dailyChange !== null && !isNaN(dailyChange)) { metricsByTag[tag].sumDailyRates += dailyChange; metricsByTag[tag].dailyRateCount++; }
            if (fund.trendInfo?.change) { metricsByTag[tag].sumRecentRates += fund.trendInfo.change; metricsByTag[tag].recentRateCount++; }
            if (position.shares > 0) {
                const chartPoints = fund.baseChartData; let dailyProfit = 0; let yesterdayMarketValue = 0;
                if (chartPoints.length >= 2) {
                    const todayNAV = chartPoints[chartPoints.length - 1]?.unitNAV; const yesterdayNAV = chartPoints[chartPoints.length - 2]?.unitNAV;
                    if (yesterdayNAV && todayNAV && todayNAV > 0) { dailyProfit = parseFloat(((todayNAV - yesterdayNAV) * position.shares).toFixed(2)); yesterdayMarketValue = parseFloat((yesterdayNAV * position.shares).toFixed(2)); }
                }
                metricsByTag[tag].totalCostBasis += fund.costBasis ?? 0; metricsByTag[tag].totalMarketValue += fund.marketValue ?? 0; metricsByTag[tag].totalHoldingProfit += fund.holdingProfit ?? 0;
                metricsByTag[tag].totalDailyProfit += dailyProfit; metricsByTag[tag].totalYesterdayMarketValue += yesterdayMarketValue; metricsByTag[tag].totalRecentProfit += fund.recentProfit ?? 0;
                metricsByTag[tag].totalInitialMarketValueForTrend += fund.initialMarketValueForTrend ?? 0;
            }
        });
    });
    const data = Object.entries(metricsByTag).map(([tag, metrics]) => {
        const grandTotalProfit = metrics.totalHoldingProfit + metrics.totalRealizedProfit;
        const dailyProfitRate = metrics.totalYesterdayMarketValue > 0 ? (metrics.totalDailyProfit / metrics.totalYesterdayMarketValue) * 100 : (metrics.dailyRateCount > 0 ? metrics.sumDailyRates / metrics.dailyRateCount : 0);
        const recentProfitRate = metrics.totalInitialMarketValueForTrend > 0 ? (metrics.totalRecentProfit / metrics.totalInitialMarketValueForTrend) * 100 : (metrics.recentRateCount > 0 ? metrics.sumRecentRates / metrics.recentRateCount : 0);
        const marketValueContribution = totals.totalMarketValue > 0 ? (metrics.totalMarketValue / totals.totalMarketValue) : 0;
        const holdingProfitContribution = totals.totalHoldingProfit !== 0 ? (metrics.totalHoldingProfit / Math.abs(totals.totalHoldingProfit)) : 0;
        const holdingEfficiency = marketValueContribution > 0 ? (holdingProfitContribution / marketValueContribution) : 0;
        const dailyProfitContribution = totals.totalDailyProfit !== 0 ? (metrics.totalDailyProfit / Math.abs(totals.totalDailyProfit)) : 0;
        const dailyEfficiency = marketValueContribution > 0 ? (dailyProfitContribution / marketValueContribution) : 0;
        const recentProfitContribution = totals.totalRecentProfit !== 0 ? (metrics.totalRecentProfit / Math.abs(totals.totalRecentProfit)) : 0;
        const recentEfficiency = marketValueContribution > 0 ? (recentProfitContribution / marketValueContribution) : 0;
        return { tag, fundCount: metrics.fundCodes.size, ...metrics, grandTotalProfit, cumulativeMarketValue: metrics.totalCostBasis + grandTotalProfit, holdingProfitRate: metrics.totalCostBasis > 0 ? (metrics.totalHoldingProfit / metrics.totalCostBasis) * 100 : 0, totalProfitRate: metrics.totalCostBasis > 0 ? (grandTotalProfit / metrics.totalCostBasis) * 100 : 0, dailyProfitRate, recentProfitRate, holdingEfficiency, dailyEfficiency, recentEfficiency, hasRecentTransaction: metrics.hasRecentTransaction };
    });
    data.sort((a, b) => {
      const valA = a[tagSortKey]; const valB = b[tagSortKey];
      if (typeof valA !== 'number' || typeof valB !== 'number') return 0;
      if (tagSortOrder === 'asc') return valA - valB; if (tagSortOrder === 'desc') return valB - valA;
      if (tagSortOrder === 'abs_asc') return Math.abs(valA) - Math.abs(valB); if (tagSortOrder === 'abs_desc') return Math.abs(valB) - Math.abs(valA);
      return 0;
    });
    return { tagAnalysisData: data, portfolioTotals: totals };
  }, [processedFunds, tagSortKey, tagSortOrder]);

  const processedAndSortedFunds = useMemo(() => {
    const filteredFunds = processedFunds.filter(fund => {
        if (!activeTag) return true;
        if (activeTag.startsWith('TX_DATE:')) return fund.userPosition?.tradingRecords?.some(r => r.date === activeTag.substring(8)) ?? false;
        if (activeTag === 'TX_PENDING') return fund.userPosition?.tradingRecords?.some(r => r.nav === undefined) ?? false;
        const position = fund.userPosition;
        switch (activeTag) {
            case SYSTEM_TAGS.HOLDING: return position && position.shares > 0;
            case SYSTEM_TAGS.WATCHING: return !position || position.shares === 0;
            case SYSTEM_TAGS.PROFIT: return (fund.holdingProfit ?? 0) > 0;
            case SYSTEM_TAGS.LOSS: return (fund.holdingProfit ?? 0) < 0;
            case SYSTEM_TAGS.RECENT_TRANSACTION: return fund.lastPivotDate && position?.tradingRecords && position.tradingRecords.some(r => new Date(r.date).getTime() >= new Date(fund.lastPivotDate!).getTime());
            case SYSTEM_TAGS.STRONG_BUY: return (fund.smartRecommendation ?? 0) >= 75;
            case SYSTEM_TAGS.BUY: const s = fund.smartRecommendation ?? 0; return s >= 60 && s < 75;
            case SYSTEM_TAGS.HOLD: const h = fund.smartRecommendation ?? 0; return h >= 40 && h < 60;
            case SYSTEM_TAGS.SELL: const sl = fund.smartRecommendation ?? 0; return sl >= 25 && sl < 40;
            case SYSTEM_TAGS.STRONG_SELL: return (fund.smartRecommendation ?? 0) < 25;
        }
        return position?.tag?.split(',').map(t => t.trim()).includes(activeTag) ?? false;
    });
    filteredFunds.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'trend': comparison = (a.trendInfo?.change ?? -Infinity) - (b.trendInfo?.change ?? -Infinity); break;
        case 'dailyChange': comparison = (a.realTimeData ? parseFloat(a.realTimeData.estimatedChange) : -Infinity) - (b.realTimeData ? parseFloat(b.realTimeData.estimatedChange) : -Infinity); break;
        case 'navPercentile': comparison = (a.navPercentile ?? -1) - (b.navPercentile ?? -1); break;
        case 'amount': comparison = (a.marketValue ?? -Infinity) - (b.marketValue ?? -Infinity); break;
        case 'holdingProfitRate': comparison = (a.holdingProfitRate ?? -Infinity) - (b.holdingProfitRate ?? -Infinity); break;
        case 'totalProfitRate': comparison = (a.totalProfitRate ?? -Infinity) - (b.totalProfitRate ?? -Infinity); break;
        case 'smartScore': comparison = (a.smartRecommendation ?? -1) - (b.smartRecommendation ?? -1); break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    return filteredFunds;
  }, [processedFunds, sortBy, sortOrder, activeTag]);
  
  const filteredMarketStats = useMemo(() => {
      const total = processedAndSortedFunds.reduce((sum, f) => sum + (f.marketValue || 0), 0);
      const sortedByValue = [...processedAndSortedFunds].sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
      const rankMap = new Map<string, number>();
      sortedByValue.forEach((f, i) => { if ((f.marketValue || 0) > 0) rankMap.set(f.code, i + 1); });
      return { total, rankMap };
  }, [processedAndSortedFunds]);

  const handleDeleteFund = useCallback((codeToDelete: string) => { setFunds(prevFunds => prevFunds.filter(fund => fund.code !== codeToDelete)); setSelectedFundForModal(null); }, []);
  const handleShowFundDetails = useCallback((fund: Fund) => { setSelectedFundForModal(processedAndSortedFunds.find(f => f.code === fund.code) || fund); }, [processedAndSortedFunds]);
  const handleCloseModal = useCallback(() => { setSelectedFundForModal(null); }, []);
  const handleZigzagThresholdChange = useCallback((threshold: number) => { setZigzagThreshold(threshold); }, []);
  const handleSortByChange = useCallback((newSortBy: SortByType) => { setSortBy(newSortBy); }, []);
  const handleSortOrderChange = useCallback((newSortOrder: 'asc' | 'desc') => { setSortOrder(newSortOrder); }, []);
  
  const handleUpdateFundPosition = useCallback((updatedPosition: UserPosition, resetTradingRecords: boolean) => {
    setFunds(prevFunds => prevFunds.map(fund => {
        if (fund.code !== updatedPosition.code) return fund;
        if (resetTradingRecords) return { ...fund, userPosition: { ...updatedPosition, tradingRecords: [] } };
        const existingPosition = fund.userPosition || { code: fund.code, shares: 0, cost: 0, realizedProfit: 0, tradingRecords: [] };
        return { ...fund, userPosition: { ...existingPosition, tag: updatedPosition.tag, realizedProfit: updatedPosition.realizedProfit } };
      })
    );
  }, []);

  const handleTagSelect = useCallback((tag: string | null) => { setActiveTag(tag); scrollToFundTable(); }, [scrollToFundTable]);
  const handleTagDoubleClick = useCallback((tag: string) => { setActiveTag(prev => (prev === tag) ? (tag === SYSTEM_TAGS.HOLDING ? null : SYSTEM_TAGS.HOLDING) : tag); scrollToFundTable(); }, [scrollToFundTable]);
  const handleSnapshotFilter = useCallback((date: string) => { const tag = date === '待成交' ? 'TX_PENDING' : `TX_DATE:${date}`; setActiveTag(prev => prev === tag ? null : tag); scrollToFundTable(); }, [scrollToFundTable]);
  const handleTagSortChange = useCallback((newKey: keyof TagAnalysisData) => {
    setTagSortKey(prevKey => {
      if (prevKey === newKey) setTagSortOrder(prev => (prev === 'desc' ? 'asc' : prev === 'asc' ? 'abs_asc' : prev === 'abs_asc' ? 'abs_desc' : 'desc'));
      else setTagSortOrder('desc');
      return newKey;
    });
  }, []);

  const todayHeaderDate = useMemo(() => {
    if (funds.length === 0) return null;
    const realTimeDate = funds.find(f => f.realTimeData)?.realTimeData?.estimationTime.split(' ')[0];
    if (realTimeDate) return realTimeDate;
    const allDates = new Set<string>(); funds.forEach(fund => fund.data.forEach(d => allDates.add(d.date)));
    if (allDates.size === 0) return null;
    return Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
  }, [funds]);

  const dateHeaders = useMemo(() => {
    if (funds.length === 0 || !todayHeaderDate) return [];
    const allDates = new Set<string>(); funds.forEach(fund => fund.data.forEach(d => allDates.add(d.date)));
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    if (sortedDates.length === 0) return [];
    return sortedDates[0] === todayHeaderDate ? sortedDates.slice(1) : sortedDates;
  }, [funds, todayHeaderDate]);

  const handleOpenTradeModal = useCallback((fund: ProcessedFund, date: string, type: TransactionType, nav: number, isConfirmed: boolean, editingRecord?: TradingRecord) => {
    const modalState: TradeModalState = { fund, date, nav, isConfirmed, editingRecord };
    if (type === 'sell') setSellModalState(modalState); else setBuyModalState(modalState);
  }, []);

 const handleTradeSubmit = useCallback((fund: ProcessedFund, date: string, type: TransactionType, value: number, isConfirmed: boolean, nav: number, isEditing: boolean) => {
    const fundToUpdate = funds.find(f => f.code === fund.code); if (!fundToUpdate || !fundToUpdate.userPosition) return;
    const currentRecords = fundToUpdate.userPosition.tradingRecords || []; let newRecord: TradingRecord;
    if (!isConfirmed) newRecord = { date, type, value };
    else {
        if (type === 'buy') newRecord = { date, type: 'buy', nav, sharesChange: parseFloat((value / nav).toFixed(2)), amount: value };
        else if (type === 'sell') newRecord = { date, type: 'sell', nav, sharesChange: -value, amount: parseFloat((-(value * nav)).toFixed(2)), realizedProfitChange: parseFloat(((nav - (fund.userPosition?.cost ?? 0)) * value).toFixed(2)) };
        else if (type === 'dividend-cash') newRecord = { date, type: 'dividend-cash', nav, realizedProfitChange: value };
        else if (type === 'dividend-reinvest') newRecord = { date, type: 'dividend-reinvest', nav, sharesChange: value, amount: 0 };
        else newRecord = { date, type, value };
    }
    const existingRecordIndex = currentRecords.findIndex(r => r.date === date);
    const updatedRecords = (isEditing || existingRecordIndex !== -1) ? currentRecords.map(r => r.date === date ? newRecord : r) : [...currentRecords, newRecord];
    setFunds(prevFunds => prevFunds.map(f => f.code === fund.code ? { ...f, userPosition: { ...f.userPosition!, tradingRecords: updatedRecords } } : f));
    setBuyModalState(null); setSellModalState(null);
}, [funds]);

const handleTradeDelete = useCallback((fundCode: string, recordDate: string) => {
    const fundToUpdate = funds.find(f => f.code === fundCode); if (!fundToUpdate || !fundToUpdate.userPosition?.tradingRecords) return;
    setFunds(prevFunds => prevFunds.map(f => f.code === fundCode ? { ...f, userPosition: { ...f.userPosition!, tradingRecords: f.userPosition!.tradingRecords!.filter(r => r.date !== recordDate) } } : f));
    setBuyModalState(null); setSellModalState(null);
}, [funds]);

  const processPendingTasks = useCallback(() => {
    if (funds.length === 0) return;
    let fundsToUpdate: { [code: string]: TradingRecord[] } = {};
    funds.forEach(fund => {
        if (!fund.userPosition?.tradingRecords) return;
        const pendingRecords = fund.userPosition.tradingRecords.filter(r => r.nav === undefined);
        if (pendingRecords.length === 0) return;
        let recordsChanged = false;
        const newRecords = fund.userPosition.tradingRecords.map((record): TradingRecord => {
            if (record.nav !== undefined) return record;
            const confirmedDataPoint = fund.data.find(d => d.date === record.date);
            if (confirmedDataPoint) {
                recordsChanged = true; const confirmedNAV = confirmedDataPoint.unitNAV; const pendingValue = record.value!;
                if (record.type === 'buy') return { date: record.date, type: 'buy', nav: confirmedNAV, sharesChange: parseFloat((pendingValue / confirmedNAV).toFixed(2)), amount: pendingValue };
                else if (record.type === 'sell') return { date: record.date, type: 'sell', nav: confirmedNAV, sharesChange: -pendingValue, amount: parseFloat((-(pendingValue * confirmedNAV)).toFixed(2)), realizedProfitChange: parseFloat(((confirmedNAV - (processedFunds.find(f => f.code === fund.code)?.userPosition?.cost ?? 0)) * pendingValue).toFixed(2)) };
                else if (record.type === 'dividend-cash') return { date: record.date, type: 'dividend-cash', nav: confirmedNAV, realizedProfitChange: pendingValue };
                else if (record.type === 'dividend-reinvest') return { date: record.date, type: 'dividend-reinvest', nav: confirmedNAV, sharesChange: pendingValue, amount: 0 };
            }
            return record;
        });
        if (recordsChanged) fundsToUpdate[fund.code] = newRecords;
    });
    if (Object.keys(fundsToUpdate).length > 0) setFunds(prevFunds => prevFunds.map(f => fundsToUpdate[f.code] ? { ...f, userPosition: { ...f.userPosition!, tradingRecords: fundsToUpdate[f.code] } } : f));
}, [funds, processedFunds]);

  useEffect(() => { if (!isAppLoading && funds.length > 0) processPendingTasks(); }, [isAppLoading, funds, processPendingTasks]);

  const currentPortfolioJSON = useMemo(() => JSON.stringify(funds.map(f => f.userPosition).filter((p): p is UserPosition => !!p), null, 2), [funds]);
  const fishingFundsJSON = useMemo(() => JSON.stringify(processedFunds.map((fund, index) => ({
      name: fund.name,
      code: fund.code,
      cyfe: fund.userPosition?.shares ?? 0,
      cbj: fund.userPosition?.cost ?? 0,
      originSort: index
  })), null, 2), [processedFunds]);

  const handleToggleAutoSync = useCallback((enabled: boolean) => {
    setIsAutoSyncEnabled(enabled); localStorage.setItem('AUTO_SYNC_ENABLED', String(enabled));
    if (enabled) {
        const token = localStorage.getItem('GITHUB_TOKEN'); const deviceId = localStorage.getItem('GINOS_DEVICE_ID');
        if (token && deviceId) updateGistData(token, currentPortfolioJSON, fishingFundsJSON, { masterId: deviceId, lastActive: Date.now() }).catch(e => console.error(e));
    }
  }, [currentPortfolioJSON, fishingFundsJSON]);
  
  useEffect(() => {
     if (isAppLoading || !isAutoSyncEnabled) return;
     const token = localStorage.getItem('GITHUB_TOKEN'); if (!token) return;
     const timer = setTimeout(() => { updateGistData(token, currentPortfolioJSON, fishingFundsJSON).catch(e => console.error(e)); }, 2000); 
     return () => clearTimeout(timer);
  }, [currentPortfolioJSON, fishingFundsJSON, isAutoSyncEnabled, isAppLoading]);

  const portfolioSnapshots = useMemo((): PortfolioSnapshot[] => {
    const allTransactionDates = new Set<string>();
    funds.forEach(fund => fund.userPosition?.tradingRecords?.forEach(record => { if (record.nav !== undefined) allTransactionDates.add(record.date); }));
    const latestNavMap = new Map(processedFunds.map(f => [f.code, f.baseChartData[f.baseChartData.length - 1]?.unitNAV ?? 0]));
    let historicalSnapshots: PortfolioSnapshot[] = [];
    if (allTransactionDates.size > 0) {
        const snapshots = Array.from(allTransactionDates).sort().map(snapshotDate => {
            let snapshotTotalCostBasis = 0; let snapshotTotalRealizedProfit = 0; let netAmountChangeOnDate = 0; let totalBuyAmountOnDate = 0; let totalBuyFloatingProfitOnDate = 0; let totalSellAmountOnDate = 0; let totalSellOpportunityProfitOnDate = 0; let totalSellRealizedProfitOnDate = 0; let totalDailyActionValue = 0;
            const snapshotHoldings: { code: string; shares: number; }[] = [];
            funds.forEach(fund => {
                const position = fund.userPosition; if (!position) return;
                let sharesForFund = position.shares; let totalCostForFund = position.shares * position.cost; let realizedProfitForFund = position.realizedProfit;
                const relevantRecords = (position.tradingRecords || []).filter(r => r.nav !== undefined && new Date(r.date).getTime() <= new Date(snapshotDate).getTime()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                for (const record of relevantRecords) {
                    const latestNAV = latestNavMap.get(fund.code) ?? 0;
                    if (record.date === snapshotDate) {
                        netAmountChangeOnDate += (record.amount || 0);
                        if (record.type === 'buy') { totalBuyFloatingProfitOnDate += latestNAV > 0 ? (latestNAV - record.nav!) * record.sharesChange! : 0; totalBuyAmountOnDate += record.amount!; totalDailyActionValue += Math.abs(record.amount!); }
                        else if (record.type === 'sell') { totalSellOpportunityProfitOnDate += latestNAV > 0 ? (record.nav! - latestNAV) * Math.abs(record.sharesChange!) : 0; totalSellRealizedProfitOnDate += record.realizedProfitChange ?? 0; totalSellAmountOnDate += Math.abs(record.amount!); totalDailyActionValue += Math.abs(record.amount!); }
                        else if (record.type === 'dividend-cash') { netAmountChangeOnDate -= (record.realizedProfitChange || 0); totalSellRealizedProfitOnDate += (record.realizedProfitChange || 0); totalSellAmountOnDate += (record.realizedProfitChange || 0); totalDailyActionValue += Math.abs(record.realizedProfitChange || 0); }
                        else if (record.type === 'dividend-reinvest') { const reinvestValue = record.nav! * record.sharesChange!; totalBuyAmountOnDate += reinvestValue; totalBuyFloatingProfitOnDate += latestNAV > 0 ? (latestNAV - record.nav!) * record.sharesChange! : 0; totalDailyActionValue += reinvestValue; }
                    }
                    if (record.type === 'buy') { sharesForFund += record.sharesChange!; totalCostForFund += record.amount!; }
                    else if (record.type === 'sell') { const costBasisPerShareBeforeSell = sharesForFund > 0 ? totalCostForFund / sharesForFund : 0; totalCostForFund -= costBasisPerShareBeforeSell * Math.abs(record.sharesChange!); sharesForFund += record.sharesChange!; realizedProfitForFund += (record.realizedProfitChange ?? 0); if (sharesForFund < 1e-6) { sharesForFund = 0; totalCostForFund = 0; } }
                    else if (record.type === 'dividend-cash') { realizedProfitForFund += (record.realizedProfitChange || 0); }
                    else if (record.type === 'dividend-reinvest') { sharesForFund += record.sharesChange!; }
                }
                if (sharesForFund > 0) { snapshotHoldings.push({ code: fund.code, shares: sharesForFund }); snapshotTotalCostBasis += totalCostForFund; }
                snapshotTotalRealizedProfit += realizedProfitForFund;
            });
            let currentMarketValue = 0; let dailyProfit = 0; let yesterdayMarketValue = 0;
            snapshotHoldings.forEach(holding => {
                const currentFundData = processedFunds.find(f => f.code === holding.code);
                if (currentFundData?.baseChartData?.length) {
                    const chartData = currentFundData.baseChartData; const latestNAV = chartData[chartData.length - 1].unitNAV ?? 0; const yesterdayNAV = chartData.length > 1 ? (chartData[chartData.length - 2].unitNAV ?? 0) : 0;
                    if (latestNAV > 0) currentMarketValue += holding.shares * latestNAV;
                    if (yesterdayNAV > 0 && latestNAV > 0) { dailyProfit += (latestNAV - yesterdayNAV) * holding.shares; yesterdayMarketValue += holding.shares * yesterdayNAV; }
                }
            });
            return { snapshotDate, totalCostBasis: snapshotTotalCostBasis, currentMarketValue, cumulativeValue: currentMarketValue + snapshotTotalRealizedProfit, holdingProfit: currentMarketValue - snapshotTotalCostBasis, totalProfit: (currentMarketValue + snapshotTotalRealizedProfit) - snapshotTotalCostBasis, profitRate: snapshotTotalCostBasis > 0 ? ((currentMarketValue + snapshotTotalRealizedProfit - snapshotTotalCostBasis) / snapshotTotalCostBasis) * 100 : 0, dailyProfit, dailyProfitRate: yesterdayMarketValue > 0 ? (dailyProfit / yesterdayMarketValue) * 100 : 0, netAmountChange: netAmountChangeOnDate, totalBuyAmount: totalBuyAmountOnDate, totalBuyFloatingProfit: totalBuyFloatingProfitOnDate, totalSellAmount: totalSellAmountOnDate, totalSellOpportunityProfit: totalSellOpportunityProfitOnDate, totalSellRealizedProfit: totalSellRealizedProfitOnDate, totalDailyActionValue };
        });
        historicalSnapshots = snapshots.reverse();
    }
    let baselineTotalCostBasis = 0; let baselineTotalRealizedProfit = 0; const baselineHoldings: { code: string; shares: number; }[] = [];
    funds.forEach(fund => { if (fund.userPosition) { baselineHoldings.push({ code: fund.code, shares: fund.userPosition.shares }); baselineTotalCostBasis += fund.userPosition.shares * fund.userPosition.cost; baselineTotalRealizedProfit += fund.userPosition.realizedProfit; } });
    let baselineCurrentMarketValue = 0; let baselineDailyProfit = 0; let baselineYesterdayMarketValue = 0;
    baselineHoldings.forEach(holding => {
        const currentFundData = processedFunds.find(f => f.code === holding.code);
        if (currentFundData?.baseChartData?.length) {
            const chartData = currentFundData.baseChartData; const latestNAV = chartData[chartData.length - 1].unitNAV ?? 0; const yesterdayNAV = chartData.length > 1 ? (chartData[chartData.length - 2].unitNAV ?? 0) : 0;
            if (latestNAV > 0) baselineCurrentMarketValue += holding.shares * latestNAV;
            if (yesterdayNAV > 0 && latestNAV > 0) { baselineDailyProfit += (latestNAV - yesterdayNAV) * holding.shares; baselineYesterdayMarketValue += holding.shares * yesterdayNAV; }
        }
    });
    const baselineSnapshot: PortfolioSnapshot = { snapshotDate: '基准持仓', totalCostBasis: baselineTotalCostBasis, currentMarketValue: baselineCurrentMarketValue, cumulativeValue: baselineCurrentMarketValue + baselineTotalRealizedProfit, holdingProfit: baselineCurrentMarketValue - baselineTotalCostBasis, totalProfit: baselineCurrentMarketValue + baselineTotalRealizedProfit - baselineTotalCostBasis, profitRate: baselineTotalCostBasis > 0 ? (baselineCurrentMarketValue + baselineTotalRealizedProfit - baselineTotalCostBasis) / baselineTotalCostBasis * 100 : 0, dailyProfit: baselineDailyProfit, dailyProfitRate: baselineYesterdayMarketValue > 0 ? (baselineDailyProfit / baselineYesterdayMarketValue) * 100 : 0, totalDailyActionValue: 0 };
    const allSnapshots: PortfolioSnapshot[] = [...historicalSnapshots, baselineSnapshot];
    if (funds.some(f => f.userPosition?.tradingRecords?.some(r => r.nav === undefined))) {
        let pendingTotalCostBasis = 0; let pendingTotalRealizedProfit = 0; let pendingCurrentMarketValue = 0; let pendingDailyProfit = 0; let pendingYesterdayMarketValue = 0; let pendingNetAmountChange = 0; let pendingTotalBuyAmount = 0; let pendingTotalSellAmount = 0; let pendingTotalSellRealizedProfit = 0; let pendingTotalDailyActionValue = 0;
        funds.forEach(fund => {
            const pf = processedFunds.find(p => p.code === fund.code); if (!pf) return;
            let shares = pf.userPosition?.shares || 0; let totalCost = shares * (pf.userPosition?.cost || 0); let realized = pf.userPosition?.realizedProfit || 0;
            const price = pf.realTimeData?.estimatedNAV || pf.latestNAV || 0; const yesterdayPrice = pf.baseChartData.length > 1 ? (pf.baseChartData[pf.baseChartData.length - 2].unitNAV ?? 0) : 0;
            (fund.userPosition?.tradingRecords?.filter(r => r.nav === undefined) || []).forEach(r => {
                const val = r.value || 0;
                if (r.type === 'buy') { const sChange = price > 0 ? val / price : 0; shares += sChange; totalCost += val; pendingNetAmountChange += val; pendingTotalBuyAmount += val; pendingTotalDailyActionValue += val; }
                else if (r.type === 'sell') { const sChange = val; const cash = sChange * price; const avgCost = shares > 0 ? totalCost / shares : 0; const costPart = avgCost * sChange; const profit = cash - costPart; shares -= sChange; totalCost -= costPart; realized += profit; pendingNetAmountChange -= cash; pendingTotalSellAmount += cash; pendingTotalSellRealizedProfit += profit; pendingTotalDailyActionValue += cash; }
                else if (r.type === 'dividend-cash') { realized += val; pendingNetAmountChange -= val; pendingTotalSellAmount += val; pendingTotalSellRealizedProfit += val; pendingTotalDailyActionValue += val; }
                else if (r.type === 'dividend-reinvest') { shares += val; const reinvestValue = price * val; pendingTotalBuyAmount += reinvestValue; pendingTotalDailyActionValue += reinvestValue; }
                if (shares < 1e-6) { shares = 0; totalCost = 0; }
            });
            pendingTotalCostBasis += totalCost; pendingTotalRealizedProfit += realized; if (price > 0) pendingCurrentMarketValue += shares * price;
            if (yesterdayPrice && yesterdayPrice > 0 && price > 0) { pendingDailyProfit += shares * (price - yesterdayPrice); pendingYesterdayMarketValue += shares * yesterdayPrice; }
        });
        allSnapshots.unshift({ snapshotDate: '待成交', totalCostBasis: pendingTotalCostBasis, currentMarketValue: pendingCurrentMarketValue, cumulativeValue: pendingCurrentMarketValue + pendingTotalRealizedProfit, holdingProfit: pendingCurrentMarketValue - pendingTotalCostBasis, totalProfit: (pendingCurrentMarketValue + pendingTotalRealizedProfit) - pendingTotalCostBasis, profitRate: pendingTotalCostBasis > 0 ? ((pendingCurrentMarketValue + pendingTotalRealizedProfit - pendingTotalCostBasis) / pendingTotalCostBasis) * 100 : 0, dailyProfit: pendingDailyProfit, dailyProfitRate: pendingYesterdayMarketValue > 0 ? (pendingDailyProfit / pendingYesterdayMarketValue) * 100 : 0, netAmountChange: pendingNetAmountChange, totalBuyAmount: pendingTotalBuyAmount, totalSellAmount: pendingTotalSellAmount, totalSellRealizedProfit: pendingTotalSellRealizedProfit, totalDailyActionValue: pendingTotalDailyActionValue });
    }
    return allSnapshots.map((s, index) => {
      if (index < allSnapshots.length - 1) {
          const prev = allSnapshots[index + 1]; const marketValueChange = s.currentMarketValue - prev.currentMarketValue;
          if (s.snapshotDate === '待成交') return { ...s, marketValueChange, dailyProfit: undefined, dailyProfitRate: undefined };
          const actionBase = s.totalDailyActionValue || Math.abs(s.netAmountChange ?? 0);
          const operationProfit = marketValueChange - (s.netAmountChange ?? 0);
          const profitPerHundred = actionBase > 1e-6 ? (operationProfit / actionBase) * 100 : undefined;
          const profitCaused = s.dailyProfit - prev.dailyProfit;
          const profitCausedPerHundred = actionBase > 1e-6 ? (profitCaused / actionBase) * 100 : undefined;
          const operationEffect = Math.abs(prev.dailyProfit) > 1e-6 ? (profitCaused / Math.abs(prev.dailyProfit)) * 100 : 100;
          return { ...s, marketValueChange, operationProfit, profitPerHundred, profitCaused, profitCausedPerHundred, operationEffect };
      }
      return s;
    });
}, [funds, processedFunds]);

  const snapshotSummary = useMemo(() => {
    if (portfolioSnapshots.length < 2) return { summaryProfitCaused: undefined, summaryOperationEffect: undefined };
    const latest = (portfolioSnapshots.find(s => s.snapshotDate !== '待成交') || portfolioSnapshots[0]);
    const baseline = portfolioSnapshots[portfolioSnapshots.length - 1];
    if (baseline.snapshotDate !== '基准持仓') return { summaryProfitCaused: undefined, summaryOperationEffect: undefined };
    const summaryProfitCaused = latest.dailyProfit - baseline.dailyProfit;
    const summaryOperationEffect = Math.abs(baseline.dailyProfit) > 1e-6 ? (summaryProfitCaused / Math.abs(baseline.dailyProfit)) * 100 : 100;
    return { summaryProfitCaused, summaryOperationEffect };
  }, [portfolioSnapshots]);
  
  const handleEditPendingRecord = useCallback((fund: ProcessedFund, record: TradingRecord) => {
    setIsTransactionManagerOpen(false); const navForModal = fund.realTimeData?.estimatedNAV || fund.latestNAV || 0;
    handleOpenTradeModal(fund, record.date, record.type, navForModal, false, record);
  }, [handleOpenTradeModal]);

  const handleGenerateAdvice = useCallback(async () => {
    setIsGeminiLoading(true); setGeminiError(null);
    try { setGeminiAnalysisResult(await generatePortfolioAdvice({ funds: processedFunds, snapshots: portfolioSnapshots, indexData, activeTag })); }
    catch (err) { setGeminiError(err instanceof Error ? err.message : '生成建议失败'); }
    finally { setIsGeminiLoading(false); }
  }, [processedFunds, portfolioSnapshots, indexData, activeTag]);

  const handleTerminalCommand = useCallback((cmd: string) => processTerminalCommand(cmd, processedFunds, setFunds, { recordCount, zigzagThreshold }, portfolioSnapshots), [processedFunds, setFunds, recordCount, zigzagThreshold, portfolioSnapshots]);

  if (isReportMode) return <ReportView isAppLoading={isAppLoading} isRefreshing={isRefreshing} totalDailyProfit={analysisResults.portfolioTotals.totalDailyProfit} totalDailyProfitRate={analysisResults.portfolioTotals.dailyProfitRate} lastRefreshTime={lastRefreshTime} onRefresh={handleRefresh} />;

  return (
    <div className="min-h-screen w-fit min-w-full bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200 font-sans p-4">
      {isVeiled && <PrivacyVeil onRefresh={handleRefresh} lastRefreshTime={lastRefreshTime} totalDailyProfit={analysisResults.portfolioTotals.totalDailyProfit} totalDailyProfitRate={analysisResults.portfolioTotals.dailyProfitRate} summaryProfitCaused={snapshotSummary.summaryProfitCaused} summaryOperationEffect={snapshotSummary.summaryOperationEffect} indexData={indexData} marketTurnover={marketTurnover} todayTurnoverPoints={marketTurnoverPoints} />}
      {isAppLoading ? (
         <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-md sticky left-4 w-[calc(100vw-2rem)]">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Loading Your Funds...</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Please wait while we fetch the latest data.</p>
        </div>
      ) : funds.length > 0 ? (
        <>
          <div className="sticky left-4 z-30 w-[calc(100vw-2rem)]">
            <ControlsCard tags={allTags} activeTag={activeTag} onTagSelect={handleTagSelect} sortBy={sortBy} sortOrder={sortOrder} onSortByChange={handleSortByChange} onSortOrderChange={handleSortOrderChange} recordCount={recordCount} onRecordCountChange={handleRecordCountChange} zigzagThreshold={zigzagThreshold} onZigzagThresholdChange={handleZigzagThresholdChange} onRefresh={handleRefresh} onLongPressRefresh={handleFullReload} isRefreshing={isRefreshing} isLoading={isLoading || isAppLoading} totalDailyProfit={analysisResults.portfolioTotals.totalDailyProfit} totalDailyProfitRate={analysisResults.portfolioTotals.dailyProfitRate} summaryProfitCaused={snapshotSummary.summaryProfitCaused} summaryOperationEffect={snapshotSummary.summaryOperationEffect} onOpenGemini={() => setIsGeminiModalOpen(true)} indexData={indexData} marketTurnover={marketTurnover} />
          </div>
          <div className="sticky left-4 z-20 w-[calc(100vw-2rem)]">
            <TagAnalysisTable data={analysisResults.tagAnalysisData} totals={analysisResults.portfolioTotals} activeTag={activeTag} onTagDoubleClick={handleTagDoubleClick} sortKey={tagSortKey} sortOrder={tagSortOrder} onSortChange={handleTagSortChange} />
          </div>
          <div ref={fundTableContainerRef} className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4">
            <FundTable funds={processedAndSortedFunds} todayHeaderDate={todayHeaderDate} dateHeaders={dateHeaders} onShowDetails={handleShowFundDetails} onTagDoubleClick={handleTagDoubleClick} onTrade={handleOpenTradeModal} onSnapshotFilter={handleSnapshotFilter} activeSort={sortBy} marketStats={filteredMarketStats} />
          </div>
          {portfolioSnapshots.length > 1 && (
            <div className="sticky left-4 z-20 w-[calc(100vw-2rem)]">
              <PortfolioSnapshotTable snapshots={portfolioSnapshots} funds={processedFunds} onTagDoubleClick={handleTagDoubleClick} onSnapshotFilter={handleSnapshotFilter} activeTag={activeTag} />
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-md sticky left-4 w-[calc(100vw-2rem)]">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">暂无数据</h3>
        </div>
      )}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mt-6 sticky left-4 z-20 w-[calc(100vw-2rem)]">
        <FundInputForm onAddFund={handleAddFund} isLoading={isLoading || isAppLoading || isRefreshing} onOpenImportModal={() => setIsImportModalOpen(true)} onOpenTransactionManager={() => setIsTransactionManagerOpen(true)} onOpenTerminal={() => setIsTerminalOpen(true)} pendingTaskCount={funds.reduce((c, f) => c + (f.userPosition?.tradingRecords?.filter(r => r.nav === undefined).length ?? 0), 0)} isPrivacyModeEnabled={isPrivacyModeEnabled} onPrivacyModeChange={setIsPrivacyModeEnabled} />
        {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
      </div>
      {selectedFundForModal && <FundDetailModal fund={selectedFundForModal} onClose={handleCloseModal} onDelete={handleDeleteFund} onSave={handleUpdateFundPosition} zigzagThreshold={zigzagThreshold} />}
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImportData} currentData={currentPortfolioJSON} funds={processedFunds} isAutoSyncEnabled={isAutoSyncEnabled} onToggleAutoSync={handleToggleAutoSync} />
      <TransactionManagerModal isOpen={isTransactionManagerOpen} onClose={() => setIsTransactionManagerOpen(false)} funds={processedFunds} onEdit={handleEditPendingRecord} onDelete={handleTradeDelete} />
      <GeminiAdvisorModal isOpen={isGeminiModalOpen} onClose={() => setIsGeminiModalOpen(false)} isLoading={isGeminiLoading} analysisResult={geminiAnalysisResult} error={geminiError} onGenerate={handleGenerateAdvice} />
      <TerminalModal isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} onCommand={handleTerminalCommand} />
      {buyModalState && <BuyModal isOpen={!!buyModalState} onClose={() => setBuyModalState(null)} onSubmit={handleTradeSubmit} onDelete={handleTradeDelete} tradeState={buyModalState} />}
      {sellModalState && <SellModal isOpen={!!sellModalState} onClose={() => setSellModalState(null)} onSubmit={handleTradeSubmit} onDelete={handleTradeDelete} tradeState={sellModalState} />}
    </div>
  );
};

export default App;