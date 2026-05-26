'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Scale, RefreshCcw, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function GannSquaringPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('gann-squaring');

  // Simulate Gann Squaring
  const squaring = useMemo(() => {
    if (!currentPrice) return null;

    const seed = Math.floor(currentPrice);
    
    // Let's pretend it's squared if the seed is divisible by 7 (just for demonstration)
    const isSquared = seed % 7 === 0;

    return {
      isSquared,
      status: isSquared ? 'ط§ظ„ط³ط¹ط± ظˆط§ظ„ط²ظ…ظ† ظپظٹ ط­ط§ظ„ط© طھظˆط§ط²ظ†' : 'ط؛ظٹط± ظ…طھظˆط§ط²ظ†',
      action: isSquared ? 'ط§ط­طھظ…ط§ظ„ظٹط© ط§ظ†ط¹ظƒط§ط³ ط§ظ„ط³ط¹ط± ط¹ط§ظ„ظٹط© ط¬ط¯ط§ظ‹' : 'ط§ظ„ط§طھط¬ط§ظ‡ ظ…ط³طھظ…ط± ظˆظ„ط§ ظٹظˆط¬ط¯ ط§ظ†ط¹ظƒط§ط³ ط­ط§ظ„ظٹط§ظ‹'
    };
  }, [currentPrice]);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Scale className="w-3 h-3" /> Geometry
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظƒط§ط´ظپ طھط±ط¨ظٹط¹ ط§ظ„ط³ط¹ط± ظˆط§ظ„ط²ظ…ظ†</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظٹط·ط¨ظ‚ ظ†ط¸ط±ظٹط© ط¬ط§ظ† (Gann) ظ„ظ…ط¹ط±ظپط© ظ…ط§ ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظˆظ‚طھ ظˆط§ظ„ط³ط¹ط± ظ‚ط¯ طھط·ط§ط¨ظ‚ط§
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading || !squaring ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-yellow-500 animate-spin" />
            <p className="text-yellow-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ظ‚ظٹط§ط³ ط§ظ„طھظˆط§ط²ظ†...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Core Graphic */}
            <div className={`rounded-3xl border p-8 flex flex-col items-center justify-center shadow-xl relative overflow-hidden h-[420px] transition-colors ${squaring.isSquared ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'bg-[#0d0d0d] border-white/10'}`}>
              
              {/* Glowing Background */}
              {squaring.isSquared && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none" />
              )}

              {/* The Balance Graphic */}
              <div className="relative w-32 h-32 flex items-center justify-center z-10 mb-6">
                {squaring.isSquared ? (
                  <motion.div 
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="relative"
                  >
                    <Scale className="w-24 h-24 text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border border-emerald-400/50 rounded-full animate-ping opacity-50" />
                  </motion.div>
                ) : (
                  <motion.div 
                    animate={{ rotate: 15 }} // Tilted to show imbalance
                    className="relative"
                  >
                    <Scale className="w-24 h-24 text-white/20" />
                    <Activity className="absolute bottom-0 right-0 w-8 h-8 text-white/10" />
                  </motion.div>
                )}
              </div>

              {/* Status Text */}
              <h2 className={`text-2xl font-black z-10 text-center ${squaring.isSquared ? 'text-emerald-400' : 'text-white/40'}`}>
                {squaring.status}
              </h2>
              <p className={`text-base font-bold mt-2 z-10 text-center ${squaring.isSquared ? 'text-white/90' : 'text-white/30'}`}>
                {squaring.action}
              </p>
            </div>

            <div className="text-center px-5 bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-6">
              <p className="text-sm text-white/50 leading-relaxed font-bold">
                ًں’، ط¹ظ†ط¯ظ…ط§ ظٹظƒطھظ…ظ„ ظ†ظ…ط· &quot;ط§ظ„طھط±ط¨ظٹط¹&quot;طŒ ظٹط¹ظ†ظٹ ط°ظ„ظƒ ط£ظ† ط§ظ„ط³ظˆظ‚ ط§ط³طھط؛ط±ظ‚ ط§ظ„ظˆظ‚طھ ط§ظ„ظƒط§ظپظٹ ظ„ظ„ظˆطµظˆظ„ ط¥ظ„ظ‰ ظ‡ط°ط§ ط§ظ„ط³ط¹ط± ط§ظ„ط¯ظ‚ظٹظ‚طŒ ظ…ظ…ط§ ظٹط¬ط¹ظ„ظ‡ ظ†ظ‚ط·ط© ط§ظ†ط¹ظƒط§ط³ ط´ط¨ظ‡ ظ…ط¤ظƒط¯ط©.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
