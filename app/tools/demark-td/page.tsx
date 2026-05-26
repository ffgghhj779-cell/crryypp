'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Layers, RefreshCcw, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function DemarkTdPage() {
  const { candles, isLoading } = useMarketData();
  const tool = slugToTool('demark-td');

  // Simulate TD Sequential (Counting 1 to 9 based on Close vs Close 4 bars ago)
  const tdData = useMemo(() => {
    if (!candles || candles.length < 15) return { count: 0, isBullishSetup: true };

    let count = 0;
    let isBullishSetup = true; // Looking for a bullish reversal (meaning price has been dropping)

    // A very simplified scan of the last few bars
    // Normally TD counts up to 9 consecutive closes lower than the close 4 bars prior.
    const recent = candles.slice(-13);
    
    // We will just find the current streak direction and length up to 9.
    for (let i = 4; i < recent.length; i++) {
      const c = recent[i];
      const c4 = recent[i - 4];
      
      if (c.close < c4.close) {
        // Bearish trend -> Bullish setup
        if (!isBullishSetup && count > 0) count = 0; // reset
        isBullishSetup = true;
        count = Math.min(count + 1, 9);
      } else if (c.close > c4.close) {
        // Bullish trend -> Bearish setup
        if (isBullishSetup && count > 0) count = 0; // reset
        isBullishSetup = false;
        count = Math.min(count + 1, 9);
      } else {
        count = 0;
      }
    }

    return { count, isBullishSetup };
  }, [candles]);

  if (!tool) return notFound();

  const isExhausted = tdData.count === 9;
  const blocks = Array.from({ length: 9 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-cyan-500/70 tracking-widest uppercase border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Pattern
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظ†ظ…ظˆط°ط¬ ط§ظ„ط¥ط±ظ‡ط§ظ‚ (TD)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظٹط­ط³ط¨ ط§ظ„ط´ظ…ظˆط¹ ط§ظ„ظ…طھطھط§ظ„ظٹط© ظ„طھظˆظ‚ط¹ ظ„ط­ط¸ط© ط¥ط±ظ‡ط§ظ‚ ط§ظ„ط¨ط§ط¦ط¹ظٹظ† ط£ظˆ ط§ظ„ظ…ط´طھط±ظٹظ†
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-cyan-500 animate-spin" />
            <p className="text-cyan-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ط­ط³ط§ط¨ ط§ظ„ط´ظ…ظˆط¹...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            <div className="rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 pt-8 shadow-xl relative overflow-hidden">
              <div className="text-center mb-6">
                <span className="text-lg font-bold text-white/60">
                  ط§ظ„ط³ظٹط§ظ‚ ط§ظ„ط­ط§ظ„ظٹ: {tdData.isBullishSetup ? 'ظ‡ط¨ظˆط· ظ…طھطھط§ظ„ظٹ' : 'طµط¹ظˆط¯ ظ…طھطھط§ظ„ظٹ'}
                </span>
              </div>

              {/* Blocks */}
              <div className="flex justify-center gap-1.5 dir-ltr">
                {blocks.map(num => {
                  const isActive = num <= tdData.count;
                  const isCurrent = num === tdData.count;
                  
                  let bgColor = 'bg-white/5 border-white/10';
                  let textColor = 'text-white/20';

                  if (isActive) {
                    if (tdData.isBullishSetup) {
                      bgColor = 'bg-red-500/20 border-red-500/40';
                      textColor = 'text-red-400';
                    } else {
                      bgColor = 'bg-emerald-500/20 border-emerald-500/40';
                      textColor = 'text-emerald-400';
                    }
                  }

                  if (num === 9 && isActive) {
                    bgColor = tdData.isBullishSetup ? 'bg-red-500 border-red-400' : 'bg-emerald-500 border-emerald-400';
                    textColor = 'text-white font-black';
                  }

                  return (
                    <motion.div 
                      key={num}
                      initial={{ y: 0 }}
                      animate={{ y: isCurrent ? -10 : 0 }}
                      className={`w-8 h-12 flex items-center justify-center rounded-md border ${bgColor} ${isCurrent ? 'shadow-lg' : ''} transition-colors`}
                      style={{ boxShadow: (num === 9 && isActive) ? `0 0 20px ${tdData.isBullishSetup ? '#ef4444' : '#10b981'}` : 'none' }}
                    >
                      <span className={`text-lg font-mono ${textColor}`}>{num}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Alert */}
              {isExhausted && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-8 p-6 rounded-xl border flex items-center gap-3 ${tdData.isBullishSetup ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}
                >
                  <AlertTriangle className={`w-6 h-6 animate-pulse ${tdData.isBullishSetup ? 'text-emerald-400' : 'text-red-400'}`} />
                  <div className="flex flex-col gap-1">
                    <span className={`text-lg font-black ${tdData.isBullishSetup ? 'text-emerald-400' : 'text-red-400'}`}>
                      ط§ط­طھظ…ط§ظ„ ط§ظ†ط¹ظƒط§ط³ ط§ظ„ط³ط¹ط± ظ‚ط±ظٹط¨ط§ظ‹!
                    </span>
                    <span className="text-sm text-white/50 font-bold">
                      {tdData.isBullishSetup ? 'طھظ… ط¥ط±ظ‡ط§ظ‚ ط§ظ„ط¨ط§ط¦ط¹ظٹظ† ط¨ط§ظ„ظƒط§ظ…ظ„. ظ‚ط¯ ظٹط¨ط¯ط£ ط§ظ„طµط¹ظˆط¯ ط§ظ„ط¢ظ†.' : 'طھظ… ط¥ط±ظ‡ط§ظ‚ ط§ظ„ظ…ط´طھط±ظٹظ† ط¨ط§ظ„ظƒط§ظ…ظ„. ظ‚ط¯ ظٹط¨ط¯ط£ ط§ظ„ظ‡ط¨ظˆط· ط§ظ„ط¢ظ†.'}
                    </span>
                  </div>
                </motion.div>
              )}

              {!isExhausted && (
                <div className="mt-8 text-center text-sm text-white/40 font-bold border-t border-white/5 pt-4">
                  ظ†ظ†طھط¸ط± ظˆطµظˆظ„ ط§ظ„ط¹ط¯ط§ط¯ ط¥ظ„ظ‰ ط§ظ„ط±ظ‚ظ… 9 ظ„طھط£ظƒظٹط¯ ط§ظ„طھط¹ط¨ ظˆط§ظ†ط¹ظƒط§ط³ ط§ظ„ط§طھط¬ط§ظ‡.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
