'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Map, RefreshCcw, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function WyckoffMapPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('wyckoff-map');

  // Simulate Wyckoff Phase detection
  const currentPhaseIndex = useMemo(() => {
    if (!currentPrice) return 0;
    
    // 0: Accumulation, 1: Markup, 2: Distribution, 3: Markdown
    // Just mock it based on price parity
    const seed = Math.floor(currentPrice);
    return seed % 4;
  }, [currentPrice]);

  if (!tool) return notFound();

  const phases = [
    { id: 0, title: 'طھط¬ظ…ظٹط¹ (ط´ط±ط§ط،)', icon: ArrowRightLeft, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
    { id: 1, title: 'طµط¹ظˆط¯', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50' },
    { id: 2, title: 'طھطµط±ظٹظپ (ط¨ظٹط¹)', icon: ArrowRightLeft, color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/50' },
    { id: 3, title: 'ظ‡ط¨ظˆط·', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Map className="w-3 h-3" /> Pattern
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ط®ط±ظٹط·ط© ظˆط§ظٹظƒظˆظپ</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          طھط­ط¯ظٹط¯ ظ…ظˆظ‚ط¹ ط§ظ„ط³ط¹ط± ط§ظ„ط­ط§ظ„ظٹ ط¶ظ…ظ† ط¯ظˆط±ط© ط§ظ„ط³ظˆظ‚ ط§ظ„ظƒط¨ط±ظ‰ ظ„ظ…ط¹ط±ظپط© ط­ط±ظƒط© ط§ظ„ط­ظٹطھط§ظ†
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-yellow-500 animate-spin" />
            <p className="text-yellow-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ طھط­ظ„ظٹظ„ ظ…ط³ط§ط± ظˆط§ظٹظƒظˆظپ...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Visual 4-Step Progress */}
            <div className="rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 py-10 shadow-xl relative overflow-hidden flex flex-col gap-8">
              <h2 className="text-center text-lg font-bold text-white/70">ط§ظ„ظ…ط±ط­ظ„ط© ط§ظ„ط­ط§ظ„ظٹط© ظ„ظ„ط³ظˆظ‚:</h2>

              <div className="relative flex justify-between items-center px-2">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-6 right-6 h-1 bg-white/5 -translate-y-1/2 z-0 rounded-full" />
                
                {/* Active Line (Progress) */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentPhaseIndex / 3) * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute top-1/2 right-6 h-1 bg-gradient-to-l from-yellow-400 to-white/20 -translate-y-1/2 z-0 rounded-full"
                />

                {phases.map((phase) => {
                  const isActive = phase.id === currentPhaseIndex;
                  const isPast = phase.id < currentPhaseIndex;
                  const Icon = phase.icon;

                  let nodeBg = 'bg-[#111] border-white/10';
                  let iconColor = 'text-white/20';

                  if (isActive) {
                    nodeBg = `${phase.bg} ${phase.border} shadow-[0_0_20px_currentColor]`;
                    iconColor = phase.color;
                  } else if (isPast) {
                    nodeBg = 'bg-white/10 border-white/20';
                    iconColor = 'text-white/50';
                  }

                  return (
                    <div key={phase.id} className="relative z-10 flex flex-col items-center gap-3">
                      <motion.div 
                        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${nodeBg}`}
                        style={{ color: isActive ? 'inherit' : '' }}
                      >
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      </motion.div>
                      <span className={`text-sm font-black tracking-widest ${isActive ? phase.color : 'text-white/40'}`}>
                        {phase.title}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Description Box */}
              <div className="mt-4 p-6 rounded-xl border border-white/10 bg-white/5 text-center">
                <span className={`text-lg font-black ${phases[currentPhaseIndex].color}`}>
                  {phases[currentPhaseIndex].title}
                </span>
                <p className="text-sm text-white/50 font-bold mt-2">
                  {currentPhaseIndex === 0 && 'ط§ظ„ط­ظٹطھط§ظ† طھظ‚ظˆظ… ط¨ط´ط±ط§ط، ظˆطھط¬ظ…ظٹط¹ ط§ظ„ظƒظ…ظٹط§طھ ط¨ط¨ط·ط،. ط§ظ„ط³ط¹ط± ظٹطھط­ط±ظƒ ط¨ط´ظƒظ„ ط¹ط±ط¶ظٹ ظ…ظ…ظ„.'}
                  {currentPhaseIndex === 1 && 'طھظ… ط§ظ„ط§ظ†طھظ‡ط§ط، ظ…ظ† ط§ظ„طھط¬ظ…ظٹط¹ ظˆط¨ط¯ط£ ط§ظ„ط³ط¹ط± ط¨ط§ظ„طµط¹ظˆط¯ ط§ظ„ظ‚ظˆظٹ ظˆط§ظ„ظ…ط³طھظ…ط±.'}
                  {currentPhaseIndex === 2 && 'ط§ظ„ط­ظٹطھط§ظ† طھظ‚ظˆظ… ط¨ط¨ظٹط¹ ط£ط±ط¨ط§ط­ظ‡ط§ ط¨ط¨ط·ط، ظ„ظ„ط¬ظ…ظ‡ظˆط±. ط§ظ„ط³ط¹ط± ظٹطھط­ط±ظƒ ط¨ط´ظƒظ„ ط¹ط±ط¶ظٹ ظ…طھط°ط¨ط°ط¨.'}
                  {currentPhaseIndex === 3 && 'طھظ… ط§ظ„ط§ظ†طھظ‡ط§ط، ظ…ظ† ط§ظ„ط¨ظٹط¹ ظˆط¨ط¯ط£ ط§ظ„ط³ط¹ط± ط¨ط§ظ„ط§ظ†ظ‡ظٹط§ط± ظˆط§ظ„ظ‡ط¨ظˆط· ط§ظ„ط³ط±ظٹط¹.'}
                </p>
              </div>

            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
