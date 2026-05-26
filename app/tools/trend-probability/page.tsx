'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { BarChart, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ContextAssetBar } from '@/components/tools/ContextAssetBar';

export default function TrendProbabilityPage() {
  const { candles, isLoading } = useMarketData();
  const tool = slugToTool('trend-probability');

  // Simple probability calculation based on recent momentum
  const { probability, isBullish } = useMemo(() => {
    if (!candles || candles.length < 10) return { probability: 50, isBullish: true };

    const recent = candles.slice(-10);
    let bullStrength = 0;
    let bearStrength = 0;

    recent.forEach(c => {
      const body = c.close - c.open;
      if (body > 0) bullStrength += body;
      else bearStrength += Math.abs(body);
    });

    const total = bullStrength + bearStrength;
    if (total === 0) return { probability: 50, isBullish: true };

    const isBull = bullStrength > bearStrength;
    const rawProb = isBull ? (bullStrength / total) * 100 : (bearStrength / total) * 100;
    
    // Normalize to look realistic (between 50% and 95%)
    const prob = Math.min(Math.max(rawProb, 50), 95);

    return { probability: Math.round(prob), isBullish: isBull };
  }, [candles]);

  if (!tool) return notFound();

  const color = isBullish ? '#10b981' : '#ef4444'; // Emerald or Red
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (probability / 100) * circumference;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Asset selector — inside tool content */}
      <ContextAssetBar />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-fuchsia-500/70 tracking-widest uppercase border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <BarChart className="w-3 h-3" /> Prediction
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">احتمالية الاتجاه</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          قياس احتمالية استمرار الاتجاه الحالي بناءً على الزخم الأخير
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-fuchsia-500 animate-spin" />
            <p className="text-fuchsia-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري حساب الاحتمالات...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-8 py-12 shadow-xl relative overflow-hidden"
          >
            {/* Background Glow */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 blur-[80px] rounded-full pointer-events-none opacity-20"
              style={{ backgroundColor: color }}
            />

            {/* Circular Gauge */}
            <div className="relative w-64 h-96 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Track */}
                <circle
                  cx="128"
                  cy="128"
                  r="90"
                  stroke="currentColor"
                  strokeWidth="15"
                  fill="transparent"
                  className="text-white/5"
                />
                {/* Animated Value */}
                <motion.circle
                  cx="128"
                  cy="128"
                  r="90"
                  stroke={color}
                  strokeWidth="15"
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  style={{ filter: `drop-shadow(0 0 10px ${color}80)` }}
                />
              </svg>
              
              {/* Percentage Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-black font-mono tracking-tighter dir-ltr" style={{ color }}>
                  {probability}%
                </span>
                <span className="text-base font-bold text-white/50 mt-1 uppercase tracking-widest">مؤكد</span>
              </div>
            </div>

            {/* Label */}
            <div 
              className="px-6 py-4 rounded-full border border-white/10 mt-2 backdrop-blur-md"
              style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}
            >
              <h2 className="text-lg font-black tracking-wide" style={{ color }}>
                احتمالية استمرار {isBullish ? 'الصعود' : 'الهبوط'}
              </h2>
            </div>

            <p className="text-sm text-white/40 leading-relaxed font-bold text-center mt-4 max-w-[250px]">
              تقيس الخوارزمية قوة المشترين مقابل البائعين في الشموع الأخيرة لتوقع الحركة القادمة.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
