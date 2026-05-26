'use client';

import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Hexagon, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useMemo, useEffect } from 'react';

// Module-level constant â€” moved out of useMemo to fix TS2304 dep array error
const LAST_CYCLE_LOW = new Date('2022-11-21T00:00:00Z');

export default function CycleCalculatorPage() {
  const tool = slugToTool('cycle-calculator');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const cycles = useMemo(() => {
    const lastLowDate = LAST_CYCLE_LOW;
    // Basic Geometric time cycle offsets in days (Square of 9 logic: 90, 180, 270, 360)
    // Here we just project a few upcoming dates based on multiples of 90 days from the low.
    const dates = [];
    const now = new Date().getTime();
    
    // Find the next 3 geometric dates
    for (let i = 1; i <= 20; i++) {
      const days = i * 90; // 90-day cycles (Square)
      const targetDate = new Date(lastLowDate.getTime() + days * 24 * 60 * 60 * 1000);
      
      if (targetDate.getTime() > now && dates.length < 3) {
        dates.push({
          date: targetDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
          cycleName: `ط¯ظˆط±ط© ${days} ظٹظˆظ… (ط²ط§ظˆظٹط© ظ‡ظ†ط¯ط³ظٹط©)`,
        });
      }
    }
    return dates;
  }, []);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Hexagon className="w-3 h-3" /> Cycles
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ط­ط§ط³ط¨ط© ط§ظ„ط¯ظˆط±ط§طھ ظˆط§ظ„ط£ط´ظƒط§ظ„</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ط­ط³ط§ط¨ ط§ظ„طھظˆط§ط±ظٹط® ط§ظ„ظ‚ط§ط¯ظ…ط© ط§ظ„ظ…طھظˆظ‚ط¹ط© ظ„ظ„ط§ظ†ط¹ظƒط§ط³ ط§ظ„ط³ط¹ط±ظٹ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط§ظ„ط£ط´ظƒط§ظ„ ط§ظ„ظ‡ظ†ط¯ط³ظٹط©
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-orange-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ط­ط³ط§ط¨ ط§ظ„ط¯ظˆط±ط§طھ ط§ظ„ط²ظ…ظ†ظٹط©...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Visual Graphic */}
            <div className="rounded-3xl border border-orange-500/20 bg-[#0d0d0d] p-8 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.1)] relative overflow-hidden h-96">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-orange-500/10 blur-[50px] rounded-full pointer-events-none" />
              
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="relative w-32 h-32 flex items-center justify-center z-10"
              >
                {/* SVG Hexagon / Square abstraction */}
                <svg viewBox="0 0 100 100" className="w-full h-full text-orange-400 opacity-80" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" strokeDasharray="5,5" />
                  <rect x="25" y="25" width="50" height="50" transform="rotate(45 50 50)" />
                  <circle cx="50" cy="50" r="45" opacity="0.3" />
                </svg>
              </motion.div>
            </div>

            {/* Dates List */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-white/80 pr-2 border-r-2 border-orange-500">ط§ظ„طھظˆط§ط±ظٹط® ط§ظ„ظ‚ط§ط¯ظ…ط© ط§ظ„ظ…طھظˆظ‚ط¹ط© ظ„ظ„ط§ظ†ط¹ظƒط§ط³:</h2>
              
              {cycles.map((c, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-xl border border-white/[0.05] bg-[#111] p-6 flex flex-col gap-3 relative overflow-hidden"
                >
                  <div className="absolute top-0 bottom-0 right-0 w-1 bg-orange-500/50" />
                  <span className="text-sm text-orange-400 font-bold tracking-widest uppercase">{c.cycleName}</span>
                  <span className="text-lg font-black text-white/90">{c.date}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-2 text-center px-2">
              <p className="text-sm text-white/40 leading-relaxed font-bold">
                طھط¹طھظ…ط¯ ظ‡ط°ظ‡ ط§ظ„طھظˆط§ط±ظٹط® ط¹ظ„ظ‰ ظ‚ظˆط§ظ†ظٹظ† ط§ظ„ط²ظ…ظ† ط§ظ„ظ‡ظ†ط¯ط³ظٹط©. ط¹ظ†ط¯ظ…ط§ ظ†طµظ„ ط¥ظ„ظ‰ ظ‡ط°ظ‡ ط§ظ„طھظˆط§ط±ظٹط®طŒ ظٹط²ط¯ط§ط¯ ط§ط­طھظ…ط§ظ„ طھط؛ظٹظٹط± ظ…ط³ط§ط± ط§ظ„ط³ظˆظ‚ ط¨ط´ظƒظ„ ط¬ط°ط±ظٹ.
              </p>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
