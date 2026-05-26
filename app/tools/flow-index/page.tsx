'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Droplets, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function FlowIndexPage() {
  const { candles, isLoading } = useMarketData();
  const tool = slugToTool('flow-index');

  // Simple Money Flow calculation (Buying vs Selling pressure)
  const flowRatio = useMemo(() => {
    if (!candles || candles.length < 14) return 50;

    const recent = candles.slice(-14);
    let positiveFlow = 0;
    let negativeFlow = 0;

    recent.forEach((c, i) => {
      if (i === 0) return;
      const prev = recent[i - 1];
      const typicalPrice = (c.high + c.low + c.close) / 3;
      const prevTypicalPrice = (prev.high + prev.low + prev.close) / 3;
      const moneyFlow = typicalPrice * c.volume;

      if (typicalPrice > prevTypicalPrice) {
        positiveFlow += moneyFlow;
      } else if (typicalPrice < prevTypicalPrice) {
        negativeFlow += moneyFlow;
      }
    });

    const totalFlow = positiveFlow + negativeFlow;
    if (totalFlow === 0) return 50;

    // Return percentage of positive flow
    return (positiveFlow / totalFlow) * 100;
  }, [candles]);

  if (!tool) return notFound();

  // Determine state
  const isEntering = flowRatio > 50;
  const stateMessage = isEntering ? 'ط³ظٹظˆظ„ط© طھط¯ط®ظ„ ط§ظ„ط³ظˆظ‚ (ط´ط±ط§ط،)' : 'ط³ظٹظˆظ„ط© طھط®ط±ط¬ ظ…ظ† ط§ظ„ط³ظˆظ‚ (ط¨ظٹط¹)';
  const color = isEntering ? 'bg-emerald-400' : 'bg-red-400';
  const textColor = isEntering ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-cyan-500/70 tracking-widest uppercase border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Droplets className="w-3 h-3" /> Volume
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظ…ط¤ط´ط± ط§ظ„طھط¯ظپظ‚</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظ…ظٹط²ط§ظ† ط§ظ„ط³ظٹظˆظ„ط©: ظ‡ظ„ ط§ظ„ط£ظ…ظˆط§ظ„ طھط¯ط®ظ„ ط¥ظ„ظ‰ ط§ظ„ط£طµظ„ ط£ظ… طھط®ط±ط¬ ظ…ظ†ظ‡ ط­ط§ظ„ظٹط§ظ‹طں
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-cyan-500 animate-spin" />
            <p className="text-cyan-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ظ‚ظٹط§ط³ ط§ظ„طھط¯ظپظ‚...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 pt-10 shadow-xl relative overflow-hidden"
          >
            <div className="flex flex-col items-center text-center gap-1">
              <span className={`text-2xl font-black ${textColor}`}>
                {stateMessage}
              </span>
              <span className="text-lg font-bold text-white/50 font-mono dir-ltr">
                {flowRatio.toFixed(1)}% Buying Flow
              </span>
            </div>

            {/* Balance Bar UI */}
            <div className="relative mt-8 px-2 h-16 flex flex-col justify-center">
              {/* Background Bar */}
              <div className="absolute left-0 right-0 h-4 bg-white/5 rounded-full overflow-hidden flex">
                <div className="w-1/2 h-full bg-red-500/20" />
                <div className="w-1/2 h-full bg-emerald-500/20" />
              </div>

              {/* Center Line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2 z-0" />

              {/* Animated Marker */}
              <motion.div 
                initial={{ left: '50%' }}
                animate={{ left: `${100 - flowRatio}%` }} // inverted for RTL layout (100% is left in LTR context but container is RTL, wait: absolute uses LTR coordinates usually. If parent is dir="rtl", left is actually the right side in standard CSS but Next.js/Tailwind behavior might flip it. To be safe, we use standard LTR percentages if we force ltr on the bar.)
                transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                className="absolute top-1/2 -translate-y-1/2 -ml-3 z-10 flex flex-col items-center"
              >
                <div className={`w-6 h-6 rounded-full border-2 border-white shadow-[0_0_15px_currentColor] ${color}`} style={{ color: isEntering ? '#10b981' : '#ef4444' }} />
              </motion.div>
            </div>

            <div className="flex justify-between text-sm text-white/40 font-bold uppercase tracking-widest px-2 -mt-4">
              <span>ط³ظٹظˆظ„ط© طھط®ط±ط¬ (ط¨ظٹط¹)</span>
              <span>ط³ظٹظˆظ„ط© طھط¯ط®ظ„ (ط´ط±ط§ط،)</span>
            </div>

            <div className="mt-2 p-6 rounded-xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-sm text-white/40 leading-relaxed font-bold">
                ظٹظ‚ظٹط³ ظ‡ط°ط§ ط§ظ„ظ…ط¤ط´ط± ط­ط¬ظ… ط§ظ„طھط¯ط§ظˆظ„ ظ…ط¶ط±ظˆط¨ط§ظ‹ ط¨ط³ط¹ط± ط§ظ„ط¥ط؛ظ„ط§ظ‚ ظ„ظ…ط¹ط±ظپط© ظ…ط§ ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ…طھط¯ط§ظˆظ„ظˆظ† ظٹط¶ط®ظˆظ† ط£ظ…ظˆط§ظ„ط§ظ‹ ط¬ط¯ظٹط¯ط© ط£ظ… ظٹط³ط­ط¨ظˆظ†ظ‡ط§.
              </p>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
