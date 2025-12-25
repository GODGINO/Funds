import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, ReferenceLine } from 'recharts';
import { IndexData, MarketDataPoint } from '../types';
import { getLocalMarketHistory } from '../services/fundService';

const DinoIcon: React.FC = () => (
    <svg className="dino-icon fill-current text-slate-700 dark:text-gray-500" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1731" height="44" width="44"><path d="M982.92737207 56.98146258h-41.97086855V3.85500886H561.50493039V50.57912671H513.29340118v307.92648747h-46.72411785v48.21152925h-69.84366408v44.26665562h-71.33107543v50.18396602h-49.18158015v46.23909239h-93.96559618V501.65279054h-47.20914328v-47.20914332h-47.20914331v-95.93803304h-46.72411789v282.34947904h45.26904153v48.21152922h49.18158014v47.7265038h46.72411783v47.2091433h47.20914335v45.75406693h46.72411781v190.35631962h95.93803304v-48.69655464h-47.72650379v-46.72411784h47.20914334v-47.20914331h47.20914328v-46.72411791h47.72650379v46.72411791H512v142.66215084h94.77397194v-48.21152925h-45.75406699v-188.41621783h45.75406699v-47.72650374h48.69655468V664.94469029h46.23909242v-165.23200157h48.21152918v45.75406698h45.75406698v-92.47818481h-93.44823571v-94.93564712h187.89885738v-47.20914332h-140.20468865l-0.48502541-51.8007175h233.49124926v-202.06160037z m-328.03887603 65.47843509h-47.20914327v-47.20914332h47.20914327v47.20914332z" p-id="1732"></path></svg>
);

interface PrivacyVeilProps {
  onRefresh: () => void;
  lastRefreshTime: string | null;
  totalDailyProfit: number;
  totalDailyProfitRate: number;
  summaryProfitCaused?: number;
  summaryOperationEffect?: number;
  indexData: IndexData | null;
  marketTurnover: string | null;
  todayTurnoverPoints?: MarketDataPoint[];
}

const PrivacyVeil: React.FC<PrivacyVeilProps> = ({ 
    onRefresh, 
    lastRefreshTime,
    totalDailyProfit,
    totalDailyProfitRate,
    summaryProfitCaused,
    summaryOperationEffect,
    indexData,
    marketTurnover,
    todayTurnoverPoints = []
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [showTurnoverChart, setShowTurnoverChart] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = window.setTimeout(() => {
        setIsHovering(false);
        if (!isMobile) {
            window.location.href = 'feishu://';
        }
    }, 8000);
  };

  const handleMouseEnter = () => {
      setIsHovering(true);
      resetIdleTimer();
  };

  const handleMouseMove = () => {
      if (!isHovering) setIsHovering(true);
      resetIdleTimer();
  };

  const handleMouseLeave = () => {
      setIsHovering(false);
      if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
      }
      if (!isMobile) {
          window.location.href = 'feishu://';
      }
  };

  useEffect(() => {
      return () => {
          if (idleTimerRef.current) {
              clearTimeout(idleTimerRef.current);
          }
      };
  }, []);

  const formattedProfit = `${totalDailyProfit >= 0 ? '+' : ''}${totalDailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formattedRate = `${totalDailyProfitRate >= 0 ? '+' : ''}${totalDailyProfitRate.toFixed(2)}%`;
  
  let formattedProfitCaused = '';
  if (summaryProfitCaused !== undefined) {
    formattedProfitCaused = `${summaryProfitCaused >= 0 ? '+' : ''}${summaryProfitCaused.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  let formattedOperationEffect = '';
  if (summaryOperationEffect !== undefined) {
    formattedOperationEffect = `${summaryOperationEffect >= 0 ? '+' : ''}${summaryOperationEffect.toFixed(2)}%`;
  }

  let formattedIndex = '';
  if (indexData) {
      const value = indexData.value.toFixed(2);
      const change = `${indexData.change >= 0 ? '+' : ''}${indexData.change.toFixed(2)}`;
      const changePercent = `${indexData.changePercent >= 0 ? '+' : ''}${indexData.changePercent.toFixed(2)}%`;
      formattedIndex = `${value} ${change} ${changePercent}`;
  }

  const hoverContent = [
    formattedProfit,
    formattedRate,
    formattedProfitCaused,
    formattedOperationEffect,
    formattedIndex,
    marketTurnover,
  ].filter(Boolean).join(' ');

  const { turnoverChartData, indexChartData, dayIndices, distributionDots } = useMemo(() => {
      if (!isHovering) return { turnoverChartData: [], indexChartData: [], dayIndices: [], distributionDots: [] };
      
      const history = getLocalMarketHistory();
      const todayDate = todayTurnoverPoints.length > 0 ? todayTurnoverPoints[0].t.split(' ')[0] : '';
      const historicalDates = Object.keys(history).filter(d => d !== todayDate).sort();
      const allDates = [...historicalDates.slice(-5), todayDate].filter(Boolean);

      // --- 1. Index Chart Data (Continuous Time Axis) ---
      const iData: any[] = [];
      const dayIndices: number[] = [];
      
      allDates.forEach((date, dateIdx) => {
          const points = date === todayDate ? todayTurnoverPoints : (history[date] || []);
          if (points.length === 0) return;

          if (iData.length > 0) dayIndices.push(iData.length);
          const sorted = [...points].sort((a, b) => a.t.localeCompare(b.t));
          
          sorted.forEach((p, pIdx) => {
              const globalIdx = iData.length;
              const obj: any = { id: globalIdx };
              const key = `v${allDates.length - 1 - dateIdx}`; 
              if (p.ind > 0) obj[key] = p.ind;
              
              if (pIdx === sorted.length - 1 && dateIdx < allDates.length - 1) {
                  const nextKey = `v${allDates.length - 1 - (dateIdx + 1)}`;
                  obj[nextKey] = p.ind;
              }
              iData.push(obj);
          });
      });

      // --- 2. Turnover Chart Data (Overlapping Time Axis) ---
      const timeSlots: string[] = [];
      let hour = 9, min = 15;
      while (hour < 15 || (hour === 15 && min === 0)) {
          if (hour === 11 && min > 30) { hour = 13; min = 1; continue; }
          if (hour === 13 && min === 0) { min = 1; continue; }
          timeSlots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
          min++;
          if (min === 60) { hour++; min = 0; }
      }

      const dayTurnoverMaps = allDates.map(date => {
          const points = date === todayDate ? todayTurnoverPoints : (history[date] || []);
          const map = new Map<string, number>();
          let sum = 0;
          [...points].sort((a,b) => a.t.localeCompare(b.t)).forEach(p => {
              sum += p.val;
              map.set(p.t, sum);
          });
          return map;
      });

      const tData = timeSlots.map(t => {
          const obj: any = { t };
          dayTurnoverMaps.forEach((map, i) => {
              const val = map.get(t);
              const key = `v${allDates.length - 1 - i}`; 
              if (val !== undefined) obj[key] = val;
          });
          return obj;
      });

      // --- 3. Vertical Distribution Dots ---
      let dots: number[] = [];
      if (todayTurnoverPoints.length > 0) {
          const lastPoint = todayTurnoverPoints[todayTurnoverPoints.length - 1];
          const currentTime = lastPoint.t;
          const valsAtCurrent = dayTurnoverMaps.map(map => map.get(currentTime) || 0).filter(v => v > 0);
          if (valsAtCurrent.length > 0) {
              const minV = Math.min(...valsAtCurrent);
              const maxV = Math.max(...valsAtCurrent);
              dots = valsAtCurrent.map(v => maxV > minV ? (v - minV) / (maxV - minV) : 0.5).reverse();
          }
      }

      return { turnoverChartData: tData, indexChartData: iData, dayIndices, distributionDots: dots };
  }, [isHovering, todayTurnoverPoints]);

  const lineColors = [
      '#000000',               // Today (v0): Pure Black
      'rgba(0, 0, 0, 0.75)',   // Y-1 (v1)
      'rgba(0, 0, 0, 0.55)',   // Y-2 (v2)
      'rgba(0, 0, 0, 0.4)',    // Y-3 (v3)
      'rgba(0, 0, 0, 0.25)',   // Y-4 (v4)
      'rgba(0, 0, 0, 0.15)',   // Y-5 (v5)
  ];

  const toggleChart = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowTurnoverChart(prev => !prev);
  };

  return (
    <div
      className="fixed inset-0 bg-white dark:bg-gray-900 z-[200] flex flex-col justify-center items-center text-slate-700 dark:text-gray-400 font-sans p-8 select-none"
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={onRefresh}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
        <div className="w-full max-w-3xl text-left">
            {/* Horizontal Layout: Dino on left, Chart on right */}
            <div className="flex items-end gap-3 w-full">
                <div className="flex-shrink-0 mb-1">
                    <DinoIcon />
                </div>
                
                <div 
                    className="h-[88px] flex-1 flex items-end overflow-hidden transition-opacity duration-300 cursor-pointer relative" 
                    style={{ opacity: isHovering ? 1 : 0 }}
                    onClick={toggleChart}
                >
                    <div className="flex-1 h-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            {showTurnoverChart ? (
                                <LineChart data={turnoverChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="t" hide padding={{ left: 0, right: 0 }} />
                                    <YAxis hide domain={['dataMin', 'dataMax']} padding={{ top: 0, bottom: 0 }} />
                                    {lineColors.map((color, i) => (
                                        <Line 
                                            key={`turnover-${i}`} 
                                            type="monotone" 
                                            dataKey={`v${i}`} 
                                            stroke={color} 
                                            strokeWidth={i === 0 ? 2 : 1} 
                                            dot={false} 
                                            isAnimationActive={false} 
                                            connectNulls 
                                        />
                                    ))}
                                </LineChart>
                            ) : (
                                <LineChart data={indexChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="id" hide padding={{ left: 0, right: 0 }} />
                                    <YAxis hide domain={['dataMin', 'dataMax']} padding={{ top: 0, bottom: 0 }} />
                                    {dayIndices.map(idx => (
                                        <ReferenceLine key={idx} x={idx} stroke="rgba(0,0,0,0.1)" strokeWidth={1} />
                                    ))}
                                    {lineColors.map((color, i) => (
                                        <Line 
                                            key={`index-${i}`} 
                                            type="monotone" 
                                            dataKey={`v${i}`} 
                                            stroke={color} 
                                            strokeWidth={i === 0 ? 2 : 1} 
                                            dot={false} 
                                            isAnimationActive={false} 
                                            connectNulls 
                                        />
                                    ))}
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>

                    {/* Vertical Distribution Indicator - Always visible */}
                    {distributionDots.length > 0 && (
                        <div className="w-1 h-full relative ml-[2px] bg-gray-50 dark:bg-gray-800/20 overflow-hidden shrink-0">
                            {distributionDots.map((pos, i) => (
                                <div 
                                    key={i}
                                    className="absolute left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                                    style={{ 
                                        bottom: `calc(${pos * 100}% - ${pos * 4}px)`,
                                        backgroundColor: lineColors[i],
                                        zIndex: lineColors.length - i
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <h1 className="text-3xl font-semibold mt-4 mb-2 text-slate-700 dark:text-gray-400">未连接到互联网</h1>
            <p className="text-lg mb-2 text-slate-700 dark:text-gray-400">请试试以下办法：</p>
            <ul className="list-disc list-inside space-y-1 text-lg text-slate-600 dark:text-gray-400 mb-1">
                <li>检查网线、调制解调器和路由器</li>
                <li>重新连接到 Wi-Fi 网络</li>
            </ul>
            <p className="text-base text-slate-500 dark:text-gray-500 min-h-[1.5em]">
                {isHovering ? <span>{hoverContent}</span> : '-'}
            </p>
            <p className="text-base text-slate-500 dark:text-gray-500">ERR_INTERNET_DISCONNECTED</p>
            <div className="text-lg mt-20 text-slate-700 dark:text-gray-400">
                未连接到互联网 {lastRefreshTime}
            </div>
        </div>
    </div>
  );
};

export default PrivacyVeil;