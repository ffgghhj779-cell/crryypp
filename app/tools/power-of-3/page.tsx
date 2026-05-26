'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Zap, RefreshCcw, Hand, Scissors, Gem } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function PowerOf3Page() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('power-of-3');

  // Simulate AMD phase based on time of day or mock logic
  const currentPhaseIndex = useMemo(() => {
    if (!currentPrice) return 0;
    const hour = new Date().getHours();
    
    // Simplistic mock:
    // Accumulation (0-8), Manipulation (9-16), Distribution (17-23)
    if (hour < 8) return 0;
    if (hour < 16) return 1;
    return 2;
  }, [currentPrice]);

  if (!tool) return notFound();

  const phases = [
    { 
      id: 0, 
      title: 'طھط¬ظ…ظٹط¹ ط§ظ„ط³ظٹظˆظ„ط© (Accumulation)', 
      desc: 'ط¨ظ†ط§ط، ط§ظ„ظ…ط±ط§ظƒط² ط¨ظ‡ط¯ظˆط، ظˆطھط´ظƒظٹظ„ ط¯ط¹ظ… ط£ط³ط§ط³ظٹ.',
      icon: Hand,
      color: 'text-blue-400',
      activeBg: 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
    },
    { 
      id: 1, 
      title: 'ط¶ط±ط¨ ط§ظ„ط³طھظˆط¨ط§طھ (Manipulation)', 
      desc: 'ط­ط±ظƒط© ظˆظ‡ظ…ظٹط© ط³ط±ظٹط¹ط© ظ„ط®ط¯ط§ط¹ ط§ظ„ظ…طھط¯ط§ظˆظ„ظٹظ† ظˆط¶ط±ط¨ ظˆظ‚ظپ ط§ظ„ط®ط³ط§ط±ط©.',
      icon: Scissors,
      color: 'text-red-400',
      activeBg: 'bg-red-500/20 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
    },
    { 
      id: 2, 
      title: 'طھظˆط²ظٹط¹ ط§ظ„ط£ط±ط¨ط§ط­ (Distribution)', 
      desc: 'ط§ظ„ط­ط±ظƒط© ط§ظ„ط­ظ‚ظٹظ‚ظٹط© ط§ظ„ظ‚ظˆظٹط© ظˆطھظˆط²ظٹط¹ ط§ظ„ط£ط±ط¨ط§ط­ ظپظٹ ط§ظ„ط§طھط¬ط§ظ‡ ط§ظ„ظ…ظ‚طµظˆط¯.',
      icon: Gem,
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> Pattern
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ط§ظ„طھط¬ظ…ظٹط¹ ط§ظ„ط«ظ„ط§ط«ظٹ (AMD)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظƒط´ظپ ط®ط·ظˆط§طھ طµط§ظ†ط¹ ط§ظ„ط³ظˆظ‚ ط§ظ„ط«ظ„ط§ط«ظٹط© ط¯ط§ط®ظ„ ط´ظ…ط¹ط© ط§ظ„ظٹظˆظ… ط§ظ„ظˆط§ط­ط¯
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-yellow-500 animate-spin" />
            <p className="text-yellow-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ طھط­ط¯ظٹط¯ ط§ظ„ظ…ط±ط­ظ„ط© ط§ظ„ط­ط§ظ„ظٹط©...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {phases.map((phase) => {
              const isActive = phase.id === currentPhaseIndex;
              const Icon = phase.icon;

              return (
                <div 
                  key={phase.id} 
                  className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-500 ${isActive ? phase.activeBg : 'bg-[#0d0d0d] border-white/[0.05] opacity-50'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isActive ? 'bg-black/30' : 'bg-white/5'}`}>
                        <Icon className={`w-5 h-5 ${isActive ? phase.color : 'text-white/40'}`} />
                      </div>
                      <span className={`text-lg font-black ${isActive ? phase.color : 'text-white/60'}`}>
                        {phase.title}
                      </span>
                    </div>
                    {isActive && (
                      <span className="text-sm bg-white/10 px-2 py-1 rounded-full font-bold text-white uppercase tracking-widest animate-pulse">
                        ط§ظ„ط¢ظ†
                      </span>
                    )}
                  </div>
                  
                  <p className={`text-sm font-bold leading-relaxed ${isActive ? 'text-white/90' : 'text-white/30'}`}>
                    {phase.desc}
                  </p>
                </div>
              );
            })}

            <div className="mt-4 text-center px-5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
              <p className="text-sm text-yellow-500/80 leading-relaxed font-bold">
                طھظ†ط¨ظٹظ‡: ظ„ط§ طھظ‚ظ… ط¨ط§ظ„ط¯ط®ظˆظ„ ط£ط«ظ†ط§ط، ظ…ط±ط­ظ„ط© &quot;ط¶ط±ط¨ ط§ظ„ط³طھظˆط¨ط§طھ&quot; ظ„ط£ظ†ظ‡ط§ ط­ط±ظƒط© ط®ط§ط¯ط¹ط© ظˆظ…طµظٹط¯ط© ظ„ظ„ظ…طھط¯ط§ظˆظ„ظٹظ†.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
