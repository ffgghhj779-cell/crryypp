'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { BarChart3, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function VolumeDeltaPage() {
  const { symbol, candles, isLoading } = useMarketData();
  const tool = slugToTool('volume-delta');

  // Calculate mock delta based on OHLCV shape
  // Since we only get OHLCV from Binance, "true" delta requires tick data.
  // We approximate it: if close > open, assume more buy volume. if close < open, assume more sell volume.
  const deltas = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    
    return candles.slice(-30).map(c => {
      const body = c.close - c.open;
      const range = c.high - c.low;
      const isBull = body >= 0;
      
      // Approximation: ratio of body to range determines net delta
      const netRatio = range === 0 ? 0 : Math.abs(body) / range;
      const delta = isBull ? (c.volume * netRatio) : -(c.volume * netRatio);
      
      return { time: c.time, delta, isBull };
    });
  }, [candles]);

  if (!tool) return notFound();

  const totalDelta = deltas.reduce((acc, curr) => acc + curr.delta, 0);
  const isNetBull = totalDelta >= 0;
  
  const maxAbsDelta = Math.max(...deltas.map(d => Math.abs(d.delta)), 1);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-indigo-500/70 tracking-widest uppercase border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3" /> Volume
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظ…ط­ظ„ظ„ ط¯ظ„طھط§ ط§ظ„ط­ط¬ظ…</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ط­ط³ط§ط¨ طµط§ظپظٹ ط£ط­ط¬ط§ظ… ط§ظ„طھط¯ط§ظˆظ„ (ط§ظ„ظپط±ظ‚ ط¨ظٹظ† ط§ظ„ط´ط±ط§ط، ظˆط§ظ„ط¨ظٹط¹) ظ„ظ„ط´ظ…ظˆط¹ ط§ظ„ط£ط®ظٹط±ط©
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-indigo-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ط­ط³ط§ط¨ ط£ط­ط¬ط§ظ… ط§ظ„طھط¯ط§ظˆظ„...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-5"
          >
            {/* Summary Card */}
            <div className={`rounded-2xl border p-6 flex flex-col items-center justify-center gap-3 relative overflow-hidden ${isNetBull ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full pointer-events-none ${isNetBull ? 'bg-emerald-500/20' : 'bg-red-500/20'}`} />
              
              <span className={`text-sm font-bold uppercase tracking-widest ${isNetBull ? 'text-emerald-500/80' : 'text-red-500/80'}`}>
                ط§ظ„ط²ط®ظ… ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط­ط§ظ„ظٹ (طµط§ظپظٹ ط§ظ„ط¯ظ„طھط§)
              </span>
              <div className="flex flex-col items-center gap-1 z-10">
                <span className={`text-4xl font-black ${isNetBull ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isNetBull ? 'ط¶ط؛ط· ط´ط±ط§ط¦ظٹ' : 'ط¶ط؛ط· ط¨ظٹط¹ظٹ'}
                </span>
                <span className="text-lg font-mono font-bold text-white/60 dir-ltr">
                  {isNetBull ? '+' : ''}{totalDelta.toLocaleString(undefined, { maximumFractionDigits: 2 })} {symbol.replace('USDT', '')}
                </span>
              </div>
            </div>

            {/* Histogram Chart */}
            <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 pt-8 h-96 flex items-end justify-center gap-[2px] relative overflow-hidden">
              {/* Zero Line */}
              <div className="absolute top-1/2 left-0 right-0 border-t border-white/[0.05] border-dashed" />
              
              {deltas.map((d, i) => {
                const heightPct = (Math.abs(d.delta) / maxAbsDelta) * 50; // max 50% of container height (from center)
                return (
                  <div key={i} className="w-full relative h-full flex flex-col justify-center">
                    {d.isBull ? (
                      <div className="absolute bottom-1/2 w-full bg-emerald-500/80 rounded-t-sm" style={{ height: `${heightPct}%` }} />
                    ) : (
                      <div className="absolute top-1/2 w-full bg-red-500/80 rounded-b-sm" style={{ height: `${heightPct}%` }} />
                    )}
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
