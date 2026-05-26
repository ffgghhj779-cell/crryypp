'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Flame, RefreshCcw, Crosshair } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ContextAssetBar } from '@/components/tools/ContextAssetBar';

export default function LiquidityHeatmapPage() {
  const { symbol, currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('liquidity-heatmap');

  // Simulate liquidity pools based on swing highs and lows from recent candles
  const heatmapData = useMemo(() => {
    if (!candles || candles.length === 0 || !currentPrice) return [];

    // Simple swing logic (highest high / lowest low in windows)
    const windowSize = 20;
    const swings = [];
    
    for (let i = windowSize; i < candles.length - windowSize; i += 5) {
      const slice = candles.slice(i - windowSize, i + windowSize);
      const high = Math.max(...slice.map(c => c.high));
      const low = Math.min(...slice.map(c => c.low));
      
      // Add significant pools
      if (candles[i].high === high) swings.push({ price: high, type: 'Buy Stops (Shorts Liquidated)', intensity: 80 + (i % 20) });
      if (candles[i].low === low) swings.push({ price: low, type: 'Sell Stops (Longs Liquidated)', intensity: 80 + (i % 20) });
    }

    // Clean up and sort around current price
    const filtered = swings
      .filter((v, i, a) => a.findIndex(t => Math.abs(t.price - v.price) < currentPrice * 0.005) === i)
      .sort((a, b) => b.price - a.price)
      .slice(0, 10); // Keep top 10 zones

    // Ensure current price is roughly in the middle for UI representation
    let hasCurrent = false;
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i].price > currentPrice && filtered[i+1].price < currentPrice) {
        filtered.splice(i + 1, 0, { price: currentPrice, type: 'Current Price', intensity: 0 });
        hasCurrent = true;
        break;
      }
    }
    
    if (!hasCurrent) {
      filtered.push({ price: currentPrice, type: 'Current Price', intensity: 0 });
      filtered.sort((a, b) => b.price - a.price);
    }

    return filtered;
  }, [candles, currentPrice]);

  if (!tool) return notFound();

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 2, maximumFractionDigits: p > 1000 ? 1 : 2 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Asset selector — inside tool content */}
      <ContextAssetBar />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Flame className="w-3 h-3" /> Liquidity
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">خريطة السيولة (Heatmap)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          تحديد مناطق تركز الأوامر والسيولة العالية المتوقعة (Stops)
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-yellow-500 animate-spin" />
            <p className="text-yellow-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري فحص السيولة...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 shadow-xl relative overflow-hidden"
          >
            {/* Legend */}
            <div className="flex justify-between text-sm text-white/40 font-bold tracking-widest uppercase pb-2 border-b border-white/[0.05] mb-2 px-1">
              <span>السعر</span>
              <span>كثافة السيولة</span>
            </div>

            <div className="flex flex-col relative w-full border-r-2 border-white/10 pr-4 gap-3 py-4">
              {heatmapData.map((d, i) => {
                const isCurrent = d.intensity === 0;
                
                // Color mapping based on intensity (Yellow/Orange/Red heatmap feel)
                let color = 'bg-white/10';
                let shadow = 'none';
                let textColor = 'text-white/40';
                
                if (!isCurrent) {
                  if (d.intensity > 90) { color = 'bg-yellow-400'; shadow = '0 0 20px rgba(250,204,21,0.6)'; textColor = 'text-yellow-400'; }
                  else if (d.intensity > 85) { color = 'bg-orange-500'; shadow = '0 0 15px rgba(249,115,22,0.5)'; textColor = 'text-orange-400'; }
                  else { color = 'bg-red-500'; shadow = '0 0 10px rgba(239,68,68,0.4)'; textColor = 'text-red-400'; }
                }

                return (
                  <div key={i} className="flex items-center justify-between w-full relative">
                    {/* Node on the timeline */}
                    <div 
                      className={`absolute -right-[23px] w-6 h-6 rounded-full border-[3px] border-[#0d0d0d] z-10 ${isCurrent ? 'bg-blue-500' : color}`}
                      style={{ boxShadow: shadow }}
                    />
                    
                    {isCurrent ? (
                      <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-lg w-full">
                        <Crosshair className="w-6 h-6 text-blue-400 animate-pulse" />
                        <span className="text-base font-black font-mono text-blue-400">{formatPrice(d.price)}</span>
                        <span className="text-sm text-blue-400/80 font-bold ml-auto">السعر الحالي</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col">
                          <span className={`text-base font-black font-mono ${textColor}`}>{formatPrice(d.price)}</span>
                          <span className="text-sm text-white/30 uppercase tracking-widest">{d.type}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 w-1/2 justify-end">
                          <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden flex justify-end relative">
                            <div className={`absolute right-0 h-full rounded-full ${color}`} style={{ width: `${d.intensity}%`, boxShadow: shadow }} />
                          </div>
                          <span className={`text-sm font-mono font-bold w-6 text-left ${textColor}`}>{Math.round(d.intensity)}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.05] text-sm text-white/30 font-bold text-center leading-relaxed px-5">
              مناطق سيولة عالية (Stops) غالباً ما تجذب السعر لاختبارها قبل الانعكاس أو استمرار الاتجاه.
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
