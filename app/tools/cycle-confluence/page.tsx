'use client';

import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Target, RefreshCcw, BellRing } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export default function CycleConfluencePage() {
  const tool = slugToTool('cycle-confluence');
  const [loading, setLoading] = useState(true);

  // Simulate cycle confluence detection
  const confluence = {
    detected: true,
    score: 85,
    message: 'طھظ†ط¨ظٹظ‡: ظ†ظ‚ط·ط© طھظˆط§ظپظ‚ ط²ظ…ظ†ظٹ ظ‚ظˆظٹ ظ‚ط§ط¯ظ…ط©!',
    details: 'طھظ… ط±طµط¯ طھظ‚ط§ط·ط¹ ط¨ظٹظ† ط¯ظˆط±ط© 90 ظٹظˆظ… ط§ظ„ط²ظ…ظ†ظٹط© ظˆظ…ط³طھظˆظ‰ ظپظٹط¨ظˆظ†ط§طھط´ظٹ ظ…ظ‡ظ… ط®ظ„ط§ظ„ ط§ظ„ط£ط³ط¨ظˆط¹ ط§ظ„ظ‚ط§ط¯ظ….',
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Cycles
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">طھظˆط§ظپظ‚ ط§ظ„ط¯ظˆط±ط§طھ (Confluence)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ط§ظƒطھط´ط§ظپ ط§ظ„طھظˆط§ط±ظٹط® ظˆط§ظ„ظ…ظ†ط§ط·ظ‚ ط§ظ„طھظٹ طھطھط·ط§ط¨ظ‚ ظپظٹظ‡ط§ ط¹ط¯ط© ظ…ط¤ط´ط±ط§طھ ط²ظ…ظ†ظٹط© ظˆط³ط¹ط±ظٹط© ظ…ط¹ط§ظ‹
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-orange-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ظپط­طµ طھظˆط§ظپظ‚ ط§ظ„ط¯ظˆط±ط§طھ...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {confluence.detected ? (
              <div className="rounded-3xl border border-orange-500/40 bg-orange-500/10 p-8 flex flex-col items-center text-center gap-6 shadow-[0_0_40px_rgba(249,115,22,0.2)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 blur-[50px] rounded-full pointer-events-none" />
                
                <div className="bg-orange-500/20 p-6 rounded-full border border-orange-500/40 relative">
                  <div className="absolute inset-0 rounded-full border border-orange-400 animate-ping opacity-50" />
                  <BellRing className="w-12 h-12 text-orange-400" />
                </div>

                <div className="flex flex-col gap-3 z-10">
                  <h2 className="text-2xl font-black text-orange-400">{confluence.message}</h2>
                  <p className="text-lg text-white/80 font-bold leading-relaxed">{confluence.details}</p>
                </div>

                {/* Strength Meter */}
                <div className="w-full mt-4 flex flex-col gap-3 z-10">
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-white/50 uppercase font-bold tracking-widest">ظ‚ظˆط© ط§ظ„طھظˆط§ظپظ‚</span>
                    <span className="text-lg font-black font-mono text-orange-400 dir-ltr">{confluence.score}%</span>
                  </div>
                  <div className="h-3 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${confluence.score}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-l from-orange-400 to-orange-600 rounded-full"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-8 flex flex-col items-center text-center gap-6">
                <Target className="w-12 h-12 text-white/20" />
                <h2 className="text-lg font-bold text-white/50">ظ„ط§ ظٹظˆط¬ط¯ طھظˆط§ظپظ‚ ظ‚ظˆظٹ ط­ط§ظ„ظٹط§ظ‹</h2>
                <p className="text-sm text-white/30 font-bold">ط§ظ„ط³ظˆظ‚ ظ„ط§ ظٹط¸ظ‡ط± ط£ظٹ طھط¯ط§ط®ظ„ ظˆط§ط¶ط­ ط¨ظٹظ† ط§ظ„ط¯ظˆط±ط§طھ ط§ظ„ط²ظ…ظ†ظٹط© ظپظٹ ط§ظ„ظˆظ‚طھ ط§ظ„ط­ط§ظ„ظٹ.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
