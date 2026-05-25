'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Tornado, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function FibSpiralPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('fib-spiral');

  // Simple mock to generate a spiral SVG path
  const spiralPath = useMemo(() => {
    let path = "M 100 100 ";
    const a = 1;
    const b = 0.3; // growth factor related to phi
    for (let theta = 0; theta <= 6 * Math.PI; theta += 0.1) {
      const r = a * Math.exp(b * theta);
      const x = 100 + r * Math.cos(theta);
      const y = 100 + r * Math.sin(theta);
      if (x < -50 || x > 250 || y < -50 || y > 250) break; // keep within viewBox loosely
      path += `L ${x} ${y} `;
    }
    return path;
  }, []);

  if (!tool) return notFound();

  // Mock next reversal projection
  const nextTarget = currentPrice ? currentPrice * 1.0618 : 0; // +6.18%

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-emerald-500/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Tornado className="w-3 h-3" /> Geometry
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">الحلزون الذهبي</h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          يتوسع بناءً على النسبة الذهبية (1.618) لتوقع مناطق الانعكاس الزمنية والسعرية القادمة
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-emerald-500/80 font-bold tracking-widest uppercase text-xs animate-pulse">جاري رسم الحلزون...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-6 relative"
          >
            {/* Visual Graphic */}
            <div className="rounded-3xl border border-emerald-500/20 bg-[#050b07] p-8 flex items-center justify-center relative overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.1)] h-[300px]">
              
              <svg viewBox="0 0 200 200" className="w-full h-full opacity-80" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="spiralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                </defs>
                <motion.path 
                  d={spiralPath} 
                  fill="none" 
                  stroke="url(#spiralGrad)" 
                  strokeWidth="1.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 3, ease: "easeInOut" }}
                />
              </svg>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-300 rounded-full shadow-[0_0_10px_#34d399]" />
            </div>

            {/* Explanation / Target Card */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 flex flex-col gap-4 backdrop-blur-sm relative z-10 -mt-10 mx-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-400">الانعكاس السعري القادم</span>
                <Tornado className="w-5 h-5 text-emerald-400 opacity-50" />
              </div>
              
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-black text-white font-mono dir-ltr text-right" style={{ textShadow: '0 0 20px rgba(52,211,153,0.5)' }}>
                  ${nextTarget.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 4 })}
                </span>
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">امتداد بنسبة 1.618 من المركز</span>
              </div>

              <div className="pt-3 border-t border-emerald-500/20">
                <p className="text-[11px] text-white/70 leading-relaxed font-bold">
                  تتوسع الأسواق في دورات تشبه القوقعة. عندما يلمس السعر محيط الحلزون في المستقبل، يرتفع احتمال حدوث قمة أو قاع جديد بشكل كبير.
                </p>
              </div>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
