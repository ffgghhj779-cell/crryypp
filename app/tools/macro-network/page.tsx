'use client';

import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Server, Activity, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export default function MacroNetworkPage() {
  const tool = slugToTool('macro-network');
  
  // Simulate mock on-chain data
  const [data, setData] = useState({
    hashrate: 654.3, // EH/s
    difficulty: 83.9, // Trillions
    activeMiners: 145000,
    status: 'ط´ط¨ظƒط© ظ…ط³طھظ‚ط±ط© ظˆط¢ظ…ظ†ط©'
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
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
            <Server className="w-3 h-3" /> Macro
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظ…ط§ظƒط±ظˆ ط§ظ„ط´ط¨ظƒط© ظˆط§ظ„طھط¹ط¯ظٹظ†</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظ†ط¸ط±ط© ط¹ط§ظ…ط© ط¹ظ„ظ‰ ظ‚ظˆط© ظˆطµط­ط© ط´ط¨ظƒط© ط§ظ„ط¨ظ„ظˆظƒطھط´ظٹظ† (ط®ط§طµط© ط¨ط§ظ„ط¨طھظƒظˆظٹظ†)
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <Activity className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-orange-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ظپط­طµ ط§ظ„ط´ط¨ظƒط©...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Status Card */}
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 flex items-center justify-center gap-3 relative overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none" />
              <ShieldCheck className="w-8 h-8 text-emerald-400 z-10" />
              <span className="text-2xl font-black text-emerald-400 tracking-wide z-10">
                {data.status}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500/50 to-transparent" />
                <span className="text-sm text-white/40 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Zap className="w-3 h-3" /> ظ‚ظˆط© ط§ظ„طھط¹ط¯ظٹظ† (Hashrate)
                </span>
                <span className="text-2xl font-black text-white/90 font-mono dir-ltr text-right">
                  {data.hashrate} <span className="text-base text-white/40">EH/s</span>
                </span>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500/50 to-transparent" />
                <span className="text-sm text-white/40 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Server className="w-3 h-3" /> طµط¹ظˆط¨ط© ط§ظ„طھط¹ط¯ظٹظ† (Difficulty)
                </span>
                <span className="text-2xl font-black text-white/90 font-mono dir-ltr text-right">
                  {data.difficulty} <span className="text-base text-white/40">T</span>
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 flex items-center justify-between mt-1">
              <span className="text-sm text-white/40 font-bold uppercase tracking-widest">ط¹ط¯ط¯ ط§ظ„ظ…ط¹ط¯ظ†ظٹظ† ط§ظ„ظ†ط´ط·ظٹظ† طھظ‚ط±ظٹط¨ط§ظ‹</span>
              <span className="text-lg font-black text-white/80 font-mono">
                {data.activeMiners.toLocaleString()}
              </span>
            </div>

            <div className="mt-2 text-center px-5">
              <p className="text-sm text-white/30 leading-relaxed font-bold">
                ًں’، ط§ط±طھظپط§ط¹ ظ‚ظˆط© ط§ظ„طھط¹ط¯ظٹظ† ظٹط¹ظ†ظٹ ط£ظ† ط§ظ„ط´ط¨ظƒط© ط£طµط¨ط­طھ ط£ظƒط«ط± ط£ظ…ط§ظ†ط§ظ‹ ظˆظٹطµط¹ط¨ ط§ط®طھط±ط§ظ‚ظ‡ط§طŒ ظˆظ‡ظˆ ظ…ط¤ط´ط± ط¥ظٹط¬ط§ط¨ظٹ ط¬ط¯ط§ظ‹ ظ„ط«ظ‚ط© ط§ظ„ظ…ط³طھط«ظ…ط±ظٹظ† ط¹ظ„ظ‰ ط§ظ„ظ…ط¯ظ‰ ط§ظ„ط·ظˆظٹظ„.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
