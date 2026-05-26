'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { CircleDot, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function FibonacciCirclesPage() {
  const { symbol, currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('fibonacci-circles');

  // Calculate Fibonacci radiuses based on recent high/low
  const circles = useMemo(() => {
    if (!candles || candles.length === 0 || !currentPrice) return [];

    const recent = candles.slice(-100);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));
    
    // The "center" of the circles is usually a major pivot. We'll use the Low for an uptrend sim.
    const centerPrice = low;
    const radiusScale = (high - low);

    const ratios = [
      { r: 0.236, name: 'مستوى 0.236' },
      { r: 0.382, name: 'مستوى 0.382' },
      { r: 0.5, name: 'مستوى 0.500' },
      { r: 0.618, name: 'مستوى 0.618' },
      { r: 0.786, name: 'مستوى 0.786' },
      { r: 1.0, name: 'مستوى 1.000' },
    ];

    return ratios.map(ratio => {
      // Calculate support/resistance price targets based on the radius
      const targetResistance = centerPrice + (radiusScale * ratio.r);
      return {
        ...ratio,
        resistance: targetResistance,
        support: centerPrice - (radiusScale * ratio.r * 0.5) // Just a mock support formula for UI
      };
    });
  }, [candles, currentPrice]);

  if (!tool) return notFound();

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-emerald-500/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <CircleDot className="w-3 h-3" /> Geometry
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">دوائر فيبوناتشي</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          تحليل الدعوم والمقاومات باستخدام الأقواس والدوائر الهندسية
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-emerald-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري رسم الدوائر...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Visual Graphic */}
            <div className="rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-8 flex items-center justify-center relative overflow-hidden shadow-xl min-h-[250px]">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[300px] max-h-[300px] flex items-center justify-center">
                {circles.slice().reverse().map((c, i) => {
                  const size = (c.r * 100);
                  const isGolden = c.r === 0.618;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.8, ease: "easeOut" }}
                      className={`absolute rounded-full border border-dashed ${isGolden ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] bg-amber-500/5 z-10' : 'border-emerald-500/30'}`}
                      style={{ width: `${size}%`, height: `${size}%` }}
                    />
                  );
                })}
                <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white] z-20" />
              </div>
              
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 z-30">
                <span className="text-sm text-white/50 font-bold tracking-widest">المركز: القاع الأخير</span>
              </div>
            </div>

            {/* Data Table */}
            <div className="rounded-2xl border border-white/[0.05] bg-[#111] overflow-hidden">
              <div className="grid grid-cols-3 bg-white/[0.02] border-b border-white/[0.05] p-3 text-sm font-bold text-white/40 uppercase tracking-widest text-center">
                <div className="text-right pl-2">النسبة</div>
                <div>الدعم (Support)</div>
                <div className="text-left pr-2">المقاومة (Resistance)</div>
              </div>
              
              <div className="flex flex-col">
                {circles.map((c, i) => {
                  const isGolden = c.r === 0.618;
                  return (
                    <div key={i} className={`grid grid-cols-3 p-3 items-center text-sm font-mono border-b border-white/[0.02] last:border-0 ${isGolden ? 'bg-amber-500/10' : ''}`}>
                      <div className={`text-right pl-2 font-bold ${isGolden ? 'text-amber-400' : 'text-emerald-400'}`}>{c.name}</div>
                      <div className="text-center text-red-400">{formatPrice(c.support)}</div>
                      <div className="text-left pr-2 text-emerald-400">{formatPrice(c.resistance)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
