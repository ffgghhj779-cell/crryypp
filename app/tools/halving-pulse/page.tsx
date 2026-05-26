'use client';

import { useState, useEffect } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Clock, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export default function HalvingPulsePage() {
  const tool = slugToTool('halving-pulse');
  
  // Estimated Next Bitcoin Halving Date (Block 1,050,000 approx late March to mid April 2028)
  const HALVING_DATE = new Date('2028-04-15T00:00:00Z').getTime();

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = HALVING_DATE - now;

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [HALVING_DATE]);

  if (!tool) return notFound();

  const timeBlocks = [
    { label: 'ط£ظٹط§ظ…', value: timeLeft.days },
    { label: 'ط³ط§ط¹ط§طھ', value: timeLeft.hours },
    { label: 'ط¯ظ‚ط§ط¦ظ‚', value: timeLeft.minutes },
    { label: 'ط«ظˆط§ظ†ظٹ', value: timeLeft.seconds }
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-rose-500/70 tracking-widest uppercase border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Event
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظ†ط¨ط¶ ط§ظ„ظˆظ‚طھ</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ط§ظ„ط¹ط¯ ط§ظ„طھظ†ط§ط²ظ„ظٹ ظ„ط­ط¯ط« طھظ†طµظٹظپ ط§ظ„ط¨طھظƒظˆظٹظ† ط§ظ„ظ‚ط§ط¯ظ… (Halving 2028)
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative rounded-3xl border border-rose-500/30 bg-black/60 p-8 flex flex-col items-center justify-center gap-8 shadow-[0_0_40px_rgba(244,63,94,0.15)] overflow-hidden"
        >
          {/* Glowing neon bg */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-[420px] bg-rose-500/20 blur-[100px] rounded-full pointer-events-none" />

          <div className="flex items-center gap-3 z-10 bg-rose-500/10 px-5 py-4 rounded-full border border-rose-500/30">
            <Zap className="w-5 h-5 text-rose-400 animate-pulse" />
            <span className="text-lg font-bold text-rose-400 tracking-wider">ط§ظ„طھظ†طµظٹظپ ط§ظ„ظ‚ط§ط¯ظ…: ط£ط¨ط±ظٹظ„ 2028</span>
          </div>

          <div className="grid grid-cols-4 gap-3 w-full z-10" dir="ltr">
            {timeBlocks.map((block, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center bg-white/[0.03] border border-white/10 rounded-2xl py-4 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
                <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tighter" style={{ textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
                  {block.value.toString().padStart(2, '0')}
                </span>
                <span className="text-sm sm:text-base font-bold text-rose-400/80 uppercase tracking-widest mt-1 font-sans">
                  {block.label}
                </span>
              </div>
            ))}
          </div>

          <p className="text-center text-base text-white/40 leading-relaxed z-10 px-5">
            ظٹظ†ط®ظپط¶ ظ…ط¹ط¯ظ„ ط§ظ„طھط¹ط¯ظٹظ† ط¥ظ„ظ‰ ط§ظ„ظ†طµظپطŒ ظ…ظ…ط§ ظٹظ‚ظ„ظ„ ط§ظ„ط¹ط±ط¶ ظˆظٹط²ظٹط¯ ط§ظ„ظ†ط¯ط±ط©. طھط§ط±ظٹط®ظٹط§ظ‹طŒ ظٹط´ظ‡ط¯ ط§ظ„ط³ظˆظ‚ ط¯ظˆط±ط§طھ طµط¹ظˆط¯ ظ‚ظˆظٹط© ط¨ط¹ط¯ ظƒظ„ طھظ†طµظٹظپ.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
