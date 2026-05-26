'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Footprints, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function FootprintProPage() {
  const { symbol, currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('footprint-pro');

  // Simulate volume clusters (Footprint) for the current candle or recent price range
  const clusters = useMemo(() => {
    if (!candles || candles.length === 0 || !currentPrice) return [];
    
    // Take the last candle to represent current period footprint
    const last = candles[candles.length - 1];
    const range = last.high - last.low;
    if (range <= 0) return [];

    const numClusters = 12;
    const step = range / numClusters;
    
    // Seed predictable randomness based on currentPrice and volume
    const seed = Math.floor(currentPrice) + last.volume;
    
    let pocIndex = 0;
    let maxVol = 0;

    const data = Array.from({ length: numClusters }).map((_, i) => {
      const priceLevel = last.low + step * i;
      
      // Simulate volume bell curve around current price or middle of candle
      const distFromCenter = Math.abs(i - (numClusters / 2));
      const baseVol = last.volume / numClusters;
      // Add randomness and bell shape
      const clusterVol = baseVol * (1 - distFromCenter * 0.15) + (seed % (i+1)) * (baseVol * 0.1);
      
      const bidVol = clusterVol * (0.3 + ((seed * i) % 40) / 100);
      const askVol = clusterVol - bidVol;

      if (clusterVol > maxVol) {
        maxVol = clusterVol;
        pocIndex = i;
      }

      return { priceLevel, bidVol, askVol, totalVol: clusterVol };
    });

    // Mark Point of Control
    const result = data.map((d, i) => ({ ...d, isPOC: i === pocIndex }));
    
    // Reverse so highest price is at top
    return result.reverse();
  }, [candles, currentPrice]);

  if (!tool) return notFound();

  const maxTotalVol = Math.max(...clusters.map(c => c.totalVol), 1);
  const formatSize = (s: number) => s.toLocaleString(undefined, { maximumFractionDigits: 1 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-indigo-500/70 tracking-widest uppercase border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Footprints className="w-3 h-3" /> OrderFlow
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظ…ط­ظ„ظ„ ط¨طµظ…ط© ط§ظ„ط­ط¬ظ… (Footprint)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          طھط­ظ„ظٹظ„ ط§ظ„ط³ظٹظˆظ„ط© ط§ظ„ظ…طھط¯ط§ظˆظ„ط© ط¯ط§ط®ظ„ ظ…ط³طھظˆظٹط§طھ ط§ظ„ط³ط¹ط± ظ„ظ„ط´ظ…ط¹ط© ط§ظ„ط­ط§ظ„ظٹط©
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-indigo-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ط¬ظ„ط¨ ط¨طµظ…ط© ط§ظ„ط­ط¬ظ…...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-6 shadow-xl"
          >
            {/* Legend */}
            <div className="flex justify-between items-center text-sm font-bold tracking-widest uppercase text-white/40 mb-2 px-2 border-b border-white/[0.05] pb-2">
              <span>ط¹ظ‚ظˆط¯ ط§ظ„ط¨ظٹط¹ (Asks)</span>
              <span>ط§ظ„ط³ط¹ط±</span>
              <span>ط¹ظ‚ظˆط¯ ط§ظ„ط´ط±ط§ط، (Bids)</span>
            </div>

            {/* Clusters */}
            <div className="flex flex-col gap-1">
              {clusters.map((c, i) => {
                const widthPct = Math.max((c.totalVol / maxTotalVol) * 100, 5);
                const isPOC = c.isPOC;
                
                return (
                  <div key={i} className="relative flex items-center justify-between py-4 px-2 rounded overflow-hidden group">
                    {/* Background Bar */}
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 bg-indigo-500/10 -z-10 transition-all" style={{ width: `${widthPct}%` }} />
                    
                    {isPOC && <div className="absolute inset-0 border border-indigo-400/50 rounded pointer-events-none -z-10 bg-indigo-500/5" />}

                    {/* Asks (Red) */}
                    <div className="text-red-400/80 text-base font-mono font-bold w-1/3 text-right">
                      {formatSize(c.askVol)}
                    </div>

                    {/* Price */}
                    <div className={`text-base font-mono font-black text-center w-1/3 ${isPOC ? 'text-indigo-400 shadow-indigo-400/50' : 'text-white/60'}`} style={{ textShadow: isPOC ? '0 0 10px currentColor' : 'none' }}>
                      {c.priceLevel.toLocaleString(undefined, { minimumFractionDigits: (currentPrice ?? 0) > 1000 ? 1 : 2, maximumFractionDigits: (currentPrice ?? 0) > 1000 ? 1 : 2 })}
                      {isPOC && <div className="text-sm uppercase tracking-widest mt-0.5 text-indigo-400/80">ظ†ظ‚ط·ط© ط§ظ„ط§ط±طھظƒط§ط²</div>}
                    </div>

                    {/* Bids (Green) */}
                    <div className="text-emerald-400/80 text-base font-mono font-bold w-1/3 text-left">
                      {formatSize(c.bidVol)}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
