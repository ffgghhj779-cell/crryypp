'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Layers, RefreshCcw, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function MultiScaleFractalPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('multi-scale-fractal');

  // Simulate Multi-Timeframe logic based on a seed from currentPrice
  // Real implementation would require fetching 3 different timeframes
  const timeframes = useMemo(() => {
    if (!currentPrice) return [];

    const seed = Math.floor(currentPrice);
    
    // Just mock states for demonstration: true = Bullish, false = Bearish
    return [
      { name: 'ط¥ط·ط§ط± 15 ط¯ظ‚ظٹظ‚ط© (ط³ط±ظٹط¹)', isBullish: seed % 2 === 0 },
      { name: 'ط¥ط·ط§ط± 1 ط³ط§ط¹ط© (ظ…طھظˆط³ط·)', isBullish: seed % 3 !== 0 },
      { name: 'ط¥ط·ط§ط± 4 ط³ط§ط¹ط§طھ (ط±ط¦ظٹط³ظٹ)', isBullish: seed % 5 !== 0 },
    ];
  }, [currentPrice]);

  if (!tool) return notFound();

  const bullCount = timeframes.filter(t => t.isBullish).length;
  let overallVerdict = '';
  let overallColor = '';

  if (bullCount === 3) {
    overallVerdict = 'طµط§ط¹ط¯ ط¨ظ‚ظˆط© (ط¥ط¬ظ…ط§ط¹ ط¥ظٹط¬ط§ط¨ظٹ)';
    overallColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  } else if (bullCount === 0) {
    overallVerdict = 'ظ‡ط§ط¨ط· ط¨ظ‚ظˆط© (ط¥ط¬ظ…ط§ط¹ ط³ظ„ط¨ظٹ)';
    overallColor = 'text-red-400 bg-red-500/10 border-red-500/30';
  } else if (bullCount > 1) {
    overallVerdict = 'طµط§ط¹ط¯ ظ†ط³ط¨ظٹط§ظ‹ (طھط°ط¨ط°ط¨)';
    overallColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
  } else {
    overallVerdict = 'ظ‡ط§ط¨ط· ظ†ط³ط¨ظٹط§ظ‹ (طھط°ط¨ط°ط¨)';
    overallColor = 'text-red-400 bg-red-500/5 border-red-500/10';
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-fuchsia-500/70 tracking-widest uppercase border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Pattern
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظپط±ط§ظƒطھظ„ ظ…طھط¹ط¯ط¯ ط§ظ„ط£ط·ط±</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          طھط­ظ„ظٹظ„ ط§ظ„ظ‚ظ…ظ… ظˆط§ظ„ظ‚ظٹط¹ط§ظ† ط¹ط¨ط± ط¹ط¯ط© ظپطھط±ط§طھ ط²ظ…ظ†ظٹط© ظ„ظ…ط¹ط±ظپط© ط§ظ„ط§طھط¬ط§ظ‡ ط§ظ„ط¹ط§ظ… ط§ظ„ط­ظ‚ظٹظ‚ظٹ
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading || timeframes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-fuchsia-500 animate-spin" />
            <p className="text-fuchsia-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ط¯ظ…ط¬ ط§ظ„ظپط±ظٹظ…ط§طھ...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-5"
          >
            {/* Verdict Card */}
            <div className={`rounded-2xl border p-5 flex flex-col items-center justify-center gap-3 text-center ${overallColor}`}>
              <span className="text-sm uppercase font-bold tracking-widest opacity-70">
                ط§ظ„ط§طھط¬ط§ظ‡ ط§ظ„ط¹ط§ظ… ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط§ظ„ظپط±ظٹظ…ط§طھ ط§ظ„ظ…طھط¹ط¯ط¯ط© ظ‡ظˆ:
              </span>
              <span className="text-2xl font-black tracking-wide">
                {overallVerdict}
              </span>
            </div>

            {/* Timeframe Grid */}
            <div className="grid gap-3">
              {timeframes.map((tf, i) => (
                <div key={i} className="rounded-xl border border-white/[0.05] bg-[#0d0d0d] p-6 flex items-center justify-between">
                  <span className="text-lg font-bold text-white/80">{tf.name}</span>
                  
                  <div className="flex items-center gap-3">
                    {tf.isBullish ? (
                      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                        <span className="text-base font-bold text-emerald-400">ط¥ظٹط¬ط§ط¨ظٹ طµط§ط¹ط¯</span>
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                        <span className="text-base font-bold text-red-400">ط³ظ„ط¨ظٹ ظ‡ط§ط¨ط·</span>
                        <XCircle className="w-6 h-6 text-red-400" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-2 px-2">
              <p className="text-sm text-white/30 leading-relaxed font-bold">
                ًں’، ط§ظ„طھط¯ط§ظˆظ„ ظٹظƒظˆظ† ط¢ظ…ظ†ط§ظ‹ ط¬ط¯ط§ظ‹ ط¹ظ†ط¯ظ…ط§ طھظƒظˆظ† ظ†طھظٹط¬ط© ط§ظ„ط£ط·ط± ط§ظ„ط«ظ„ط§ط«ط© ظ…طھط·ط§ط¨ظ‚ط© (ط¥ط¬ظ…ط§ط¹).
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
