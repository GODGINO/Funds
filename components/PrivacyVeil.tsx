
import React, { useState, useRef, useEffect } from 'react';
import { IndexData } from '../types';

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
}

const PrivacyVeil: React.FC<PrivacyVeilProps> = ({ 
    onRefresh, 
    lastRefreshTime,
    totalDailyProfit,
    totalDailyProfitRate,
    summaryProfitCaused,
    summaryOperationEffect,
    indexData,
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
    }
    // Set an 8-second timer. If no activity occurs within this window while inside the veil,
    // hide the data and trigger the boss key redirect.
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
      // Ensure data is shown if it was hidden by timeout but user starts moving again
      if (!isHovering) setIsHovering(true);
      resetIdleTimer();
  };

  const handleMouseLeave = () => {
      setIsHovering(false);
      if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
      }
      // Redirect to Boss Key app when leaving the veil/window (on PC)
      if (!isMobile) {
          window.location.href = 'feishu://';
      }
  };

  // Cleanup timer on unmount
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
  ].filter(Boolean).join(' ');

  return (
    <div
      className="fixed inset-0 bg-white dark:bg-gray-900 z-[200] flex flex-col justify-center items-center text-slate-700 dark:text-gray-400 font-sans p-8 select-none"
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={onRefresh}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
        <div className="w-full max-w-lg text-left">
            <DinoIcon />
            <h1 className="text-3xl font-semibold mt-4 mb-2 text-slate-700 dark:text-gray-400">未连接到互联网</h1>
            <p className="text-lg mb-2 text-slate-700 dark:text-gray-400">请试试以下办法：</p>
            <ul className="list-disc list-inside space-y-1 text-lg text-slate-600 dark:text-gray-400 mb-1">
                <li>检查网线、调制解调器和路由器</li>
                <li>重新连接到 Wi-Fi 网络</li>
            </ul>
            <p className="text-base text-slate-500 dark:text-gray-500">
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
