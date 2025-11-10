
import React, { useState } from 'react';

const DinoIcon: React.FC = () => (
    <svg className="dino-icon fill-current text-slate-700" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1731" height="44" width="44"><path d="M982.92737207 56.98146258h-41.97086855V3.85500886H561.50493039V50.57912671H513.29340118v307.92648747h-46.72411785v48.21152925h-69.84366408v44.26665562h-71.33107543v50.18396602h-49.18158015v46.23909239h-93.96559618V501.65279054h-47.20914328v-47.20914332h-47.20914331v-95.93803304h-46.72411789v282.34947904h45.26904153v48.21152922h49.18158014v47.7265038h46.72411783v47.2091433h47.20914335v45.75406693h46.72411781v190.35631962h95.93803304v-48.69655464h-47.72650379v-46.72411784h47.20914334v-47.20914331h47.20914328v-46.72411791h47.72650379v46.72411791H512v142.66215084h94.77397194v-48.21152925h-45.75406699v-188.41621783h45.75406699v-47.72650374h48.69655468V664.94469029h46.23909242v-165.23200157h48.21152918v45.75406698h45.75406698v-92.47818481h-93.44823571v-94.93564712h187.89885738v-47.20914332h-140.20468865l-0.48502541-51.8007175h233.49124926v-202.06160037z m-328.03887603 65.47843509h-47.20914327v-47.20914332h47.20914327v47.20914332z" p-id="1732"></path></svg>
);

interface PrivacyVeilProps {
  onRefresh: () => void;
  lastRefreshTime: string | null;
  totalDailyProfit: number;
  totalDailyProfitRate: number;
}

const PrivacyVeil: React.FC<PrivacyVeilProps> = ({ 
    onRefresh, 
    lastRefreshTime,
    totalDailyProfit,
    totalDailyProfitRate,
}) => {
  const [isHovering, setIsHovering] = useState(false);

  const formattedProfit = `${totalDailyProfit >= 0 ? '+' : ''}${totalDailyProfit.toFixed(2)}`;
  const formattedRate = `${totalDailyProfitRate >= 0 ? '+' : ''}${totalDailyProfitRate.toFixed(2)}%`;

  return (
    <div
      className="fixed inset-0 bg-white z-[200] flex flex-col justify-between items-center text-slate-700 font-sans p-8"
      onContextMenu={(e) => e.preventDefault()}
      onClick={onRefresh}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
        <div className="w-full max-w-lg text-left pt-12">
            <DinoIcon />
            <h1 className="text-3xl font-semibold text-slate-800 mt-4 mb-2">未连接到互联网</h1>
            <p className="text-lg mb-2">请试试以下办法：</p>
            <ul className="list-disc list-inside space-y-1 text-lg text-slate-600 mb-1">
                <li>检查网线、调制解调器和路由器</li>
                <li>重新连接到 Wi-Fi 网络</li>
            </ul>
            <p className="text-base text-slate-500">{isHovering ? `${formattedProfit} ${formattedRate}` : '-'}</p>
            <p className="text-base text-slate-500">ERR_INTERNET_DISCONNECTED</p>
        </div>
        <div className="w-full max-w-lg text-left text-lg text-slate-500 pb-4">
            未连接到互联网 {lastRefreshTime}
        </div>
    </div>
  );
};

export default PrivacyVeil;
