'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Crosshair, RefreshCcw, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function ConfluenceDetectorPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('confluence-detector');

  // Mock detection of a confluence level
  const confluenceLevel = useMemo(() => {
    if (!currentPrice) return null;
    
    // Simulate finding a strong level just below current price
    const level = currentPrice * 0.96; 
    
    return {
      price: level,
      reasons: [
        'ط¯ط¹ظ… ظ‚ظˆظٹ ط³ط§ط¨ظ‚ (طھط§ط±ظٹط®ظٹ)',
        'ظ…ط³طھظˆظ‰ ظپظٹط¨ظˆظ†ط§طھط´ظٹ ط§ظ„ط°ظ‡ط¨ظٹ 0.618',
        'ظƒطھظ„ط© ط£ظˆط§ظ…ط± ط´ط±ط§ط¦ظٹط© (Order Block)'
      ]
    };
  }, [currentPrice]);

  if (!tool) return notFound();

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-purple-500/70 tracking-widest uppercase border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Crosshair className="w-3 h-3" /> Confluence
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظƒط§ط´ظپ ط§ظ„طھظˆط§ظپظ‚ ط§ظ„ط¯ظ‚ظٹظ‚</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ط§ظ„ط¨ط­ط« ط¹ظ† ط£ظ‚ظˆظ‰ ظ†ظ‚ط·ط© ط³ط¹ط±ظٹط© طھط¬طھظ…ط¹ ظپظٹظ‡ط§ ط¹ط¯ط© ظ…ط¤ط´ط±ط§طھ ظ„ط¯ط¹ظ… ط§ظ„ط³ط¹ط±
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading || !confluenceLevel ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-purple-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ط§ظ„ظ…ط³ط­ ط§ظ„ظ…ط¹ظ…ظ‚...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Radar / Target UI */}
            <div className="rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 shadow-xl relative overflow-hidden flex flex-col items-center">
              
              <div className="relative w-48 h-48 flex items-center justify-center mt-4 mb-6">
                {/* Glowing Rings */}
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1 }}
                  className="absolute w-full h-full rounded-full border border-purple-500/20 bg-purple-500/5 flex items-center justify-center"
                >
                  <div className="w-3/4 h-3/4 rounded-full border border-purple-500/40 bg-purple-500/10 flex items-center justify-center">
                    <div className="w-1/2 h-1/2 rounded-full border border-purple-500/60 bg-purple-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                      <Crosshair className="w-8 h-8 text-purple-400" />
                    </div>
                  </div>
                </motion.div>
                
                {/* Sweep animation */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute w-full h-full rounded-full"
                  style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(168,85,247,0.4) 100%)' }}
                />
              </div>

              <span className="text-sm text-white/50 font-bold uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/10 mb-2">ط£ظ‚ظˆظ‰ ظ†ظ‚ط·ط© ط§ط±طھط¯ط§ط¯ ط­ط§ظ„ظٹط© ظ…طھظˆظ‚ط¹ط©</span>
              <span className="text-4xl font-black font-mono text-white dir-ltr text-shadow-glow">${formatPrice(confluenceLevel.price)}</span>
            </div>

            {/* Reasons List */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-purple-400 pr-2 border-r-2 border-purple-500">ظ„ظ…ط§ط°ط§ ظ‡ط°ط§ ط§ظ„ط³ط¹ط± ظ‚ظˆظٹ ط¬ط¯ط§ظ‹طں</h2>
              
              <div className="flex flex-col gap-3">
                {confluenceLevel.reasons.map((reason, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.15 }}
                    className="flex items-center gap-3 bg-[#111] border border-white/[0.05] p-6 rounded-xl"
                  >
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <span className="text-base font-bold text-white/80">{reason}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="text-center px-5 bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
              <p className="text-sm text-white/60 leading-relaxed font-bold">
                ًں’، ط¹ظ†ط¯ظ…ط§ طھط¬طھظ…ط¹ ط¹ط¯ط© ط£ط³ط¨ط§ط¨ ط¹ظ†ط¯ ظ†ظپط³ ط§ظ„ط³ط¹ط±طŒ ظٹطھط´ظƒظ„ &quot;ط¬ط¯ط§ط± ط­ط¯ظٹط¯ظٹ&quot; ظٹطµط¹ط¨ ظƒط³ط±ظ‡طŒ ظˆطھط¹طھط¨ط± ظپط±طµط© ظ…ظ…طھط§ط²ط© ظ„ظ„ط¯ط®ظˆظ„.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
