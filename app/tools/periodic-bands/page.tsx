'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Waves, RefreshCcw, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function PeriodicBandsPage() {
  const { currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('periodic-bands');

  // Simple Band Calculation (e.g. standard deviation or ATR multiplier)
  const bands = useMemo(() => {
    if (!candles || candles.length < 14 || !currentPrice) return null;

    // Simulate an ATR or Standard Deviation calculation for the upcoming week
    const recent = candles.slice(-14);
    let totalRange = 0;
    recent.forEach(c => totalRange += (c.high - c.low));
    
    const avgRange = totalRange / 14;
    
    // Projecting next week's band
    const upper = currentPrice + (avgRange * 3); // 3x ATR as upper bound
    const lower = currentPrice - (avgRange * 3); // 3x ATR as lower bound
    
    const middle = currentPrice;

    return { upper, middle, lower };
  }, [candles, currentPrice]);

  if (!tool) return notFound();

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Waves className="w-3 h-3" /> Bands
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">حاسبة النطاقات الدورية</h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          توقع الحد الأعلى والأدنى لحركة السعر خلال الأسبوع الحالي بناءً على التقلبات السابقة
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5 mt-4">
        {isLoading || !bands ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCcw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-orange-500/80 font-bold tracking-widest uppercase text-xs animate-pulse">جاري حساب النطاقات...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 shadow-xl relative overflow-hidden">
              <div className="text-center border-b border-white/5 pb-4 mb-4">
                <h2 className="text-sm font-bold text-white/70">النطاق السعري المتوقع للأسبوع الحالي</h2>
              </div>

              <div className="flex flex-col gap-4">
                {/* Upper Band */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-red-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white/80">الحد الأعلى (مقاومة)</span>
                      <span className="text-[9px] text-red-400/80 tracking-widest">أقصى صعود متوقع</span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-red-400 font-mono dir-ltr">${formatPrice(bands.upper)}</span>
                </div>

                {/* Middle / Current */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-1 bg-white/20 rounded-full" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white/80">الارتكاز (السعر الحالي)</span>
                    </div>
                  </div>
                  <span className="text-lg font-black text-white/60 font-mono dir-ltr">${formatPrice(bands.middle)}</span>
                </div>

                {/* Lower Band */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="w-6 h-6 text-emerald-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white/80">الحد الأدنى (دعم)</span>
                      <span className="text-[9px] text-emerald-400/80 tracking-widest">أقصى هبوط متوقع</span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-emerald-400 font-mono dir-ltr">${formatPrice(bands.lower)}</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-[11px] text-white/40 leading-relaxed font-bold">
                  غالباً ما يبقى السعر محصوراً بين هذه النطاقات خلال الأسبوع. الشراء بالقرب من الحد الأدنى والبيع بالقرب من الحد الأعلى يعتبر استراتيجية آمنة.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
