'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Search, RefreshCcw, ArrowDown, ArrowUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function FractalDetectorPage() {
  const { candles, isLoading } = useMarketData();
  const tool = slugToTool('fractal-detector');

  // Detect Williams Fractals (5 candle pattern: 2 lower highs, 1 high, 2 lower highs for Bearish... vice versa for Bullish)
  const fractalState = useMemo(() => {
    if (!candles || candles.length < 5) return null;

    // Check the most recent fully formed 5-candle window (offset by 1 to ignore the live forming candle)
    const window = candles.slice(-6, -1);
    if (window.length < 5) return null;

    const c1 = window[0];
    const c2 = window[1];
    const c3 = window[2]; // The middle candle
    const c4 = window[3];
    const c5 = window[4];

    const isBearishFractal = c3.high > c1.high && c3.high > c2.high && c3.high > c4.high && c3.high > c5.high;
    const isBullishFractal = c3.low < c1.low && c3.low < c2.low && c3.low < c4.low && c3.low < c5.low;

    if (isBearishFractal) {
      return { type: 'bearish', message: 'طھظ… ط±طµط¯ ظ‚ظ…ط© ط§ظ†ط¹ظƒط§ط³ظٹط©', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
    }
    if (isBullishFractal) {
      return { type: 'bullish', message: 'طھظ… ط±طµط¯ ظ‚ط§ط¹ ط§ظ†ط¹ظƒط§ط³ظٹ', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    }

    return { type: 'neutral', message: 'ط¬ط§ط±ظٹ طھظƒظˆظٹظ† ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ط³ط¹ط±ظٹط©...', color: 'text-white/40', bg: 'bg-white/5 border-white/10' };
  }, [candles]);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-fuchsia-500/70 tracking-widest uppercase border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Search className="w-3 h-3" /> Pattern
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظƒط§ط´ظپ ط§ظ„ظپط±ط§ظƒطھظ„</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ط§ظ„ط¨ط­ط« ط¹ظ† ط§ظ„ظ‚ظ…ظ… ظˆط§ظ„ظ‚ظٹط¹ط§ظ† ط§ظ„ط§ظ†ط¹ظƒط§ط³ظٹط© ط§ظ„ظ…ط¤ظƒط¯ط© ط¨ط§ط³طھط®ط¯ط§ظ… ظ†ظ…ط· ط§ظ„ظپط±ط§ظƒطھظ„ ط§ظ„ط®ظ…ط§ط³ظٹ
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading || !fractalState ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-fuchsia-500 animate-spin" />
            <p className="text-fuchsia-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ظپط­طµ ط§ظ„ط´ظ…ظˆط¹...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex flex-col items-center justify-center gap-6 rounded-3xl border ${fractalState.bg} p-8 py-16 shadow-xl relative overflow-hidden`}
          >
            {fractalState.type !== 'neutral' && (
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 blur-[80px] rounded-full pointer-events-none opacity-20 ${fractalState.type === 'bullish' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            )}

            <div className="relative flex items-center justify-center">
              {fractalState.type === 'bearish' && (
                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  className="bg-red-500/20 p-6 rounded-full border border-red-500/30"
                >
                  <ArrowDown className="w-16 h-16 text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                </motion.div>
              )}
              {fractalState.type === 'bullish' && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                  className="bg-emerald-500/20 p-6 rounded-full border border-emerald-500/30"
                >
                  <ArrowUp className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                </motion.div>
              )}
              {fractalState.type === 'neutral' && (
                <div className="bg-white/5 p-6 rounded-full border border-white/10">
                  <Search className="w-12 h-12 text-white/20" />
                </div>
              )}
            </div>

            <div className="flex flex-col items-center z-10 text-center">
              <h2 className={`text-2xl font-black ${fractalState.color} mb-2`}>
                {fractalState.message}
              </h2>
              {fractalState.type !== 'neutral' ? (
                <p className="text-sm text-white/60 font-bold leading-relaxed max-w-[250px]">
                  ظ‡ط°ط§ ط§ظ„ظ†ظ…ظˆط°ط¬ ظٹط´ظٹط± ط¥ظ„ظ‰ ط§ط­طھظ…ط§ظ„ ظƒط¨ظٹط± ظ„ط§ظ†طھظ‡ط§ط، ط§ظ„ظ…ظˆط¬ط© ط§ظ„ط­ط§ظ„ظٹط© ظˆط¨ط¯ط، ط§ظ†ط¹ظƒط§ط³ ظپظٹ ط§ظ„ط§طھط¬ط§ظ‡ ط§ظ„ظ…ط¹ط§ظƒط³.
                </p>
              ) : (
                <p className="text-sm text-white/40 font-bold leading-relaxed max-w-[250px]">
                  ظ„ط§ ظٹظˆط¬ط¯ ظ‚ظ…ط© ط£ظˆ ظ‚ط§ط¹ ظ…ط¤ظƒط¯ ظپظٹ ط§ظ„ط´ظ…ظˆط¹ ط§ظ„ط®ظ…ط³ط© ط§ظ„ط£ط®ظٹط±ط©. ط§ظ„ط§طھط¬ط§ظ‡ ط§ظ„ط­ط§ظ„ظٹ ظ„ط§ ظٹط²ط§ظ„ ظ…ط³طھظ…ط±ط§ظ‹.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
