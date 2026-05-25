'use client';

import { useState, useEffect } from 'react';
import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { BarChart2, TrendingUp, TrendingDown, Clock, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';

export default function DailyCloseStatsPage() {
  const { symbol, currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('daily-close-stats');

  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      // Calculate time until next UTC midnight
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const distance = tomorrow.getTime() - now.getTime();

      if (distance > 0) {
        setTimeLeft({
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!tool) return notFound();

  // Determine Daily Open from context candles
  // Since we don't strictly know if candles are 1D, we take the last candle's open as the period open
  // If the user selects 1D globally, it matches perfectly.
  const lastCandle = candles[candles.length - 1];
  const dailyOpen = lastCandle ? lastCandle.open : 0;
  
  const distanceToOpen = currentPrice - dailyOpen;
  const distancePct = dailyOpen > 0 ? (distanceToOpen / dailyOpen) * 100 : 0;
  const isPositive = distanceToOpen >= 0;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-emerald-500/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <BarChart2 className="w-3 h-3" /> Statistics
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">إحصاءات الإغلاق اليومي</h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          قياس المسافة من الافتتاح اليومي والوقت المتبقي لإغلاق الشمعة
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-emerald-500/80 font-bold tracking-widest uppercase text-xs animate-pulse">جاري حساب الإحصاءات...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            {/* Countdown Card */}
            <div className="rounded-3xl border border-white/[0.08] bg-[#111] p-6 flex flex-col items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />
              
              <div className="flex items-center gap-2 text-white/50">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold tracking-widest uppercase">متبقي للإغلاق (UTC 00:00)</span>
              </div>

              <div className="flex items-center justify-center gap-4 w-full" dir="ltr">
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-white font-mono">{timeLeft.hours.toString().padStart(2, '0')}</span>
                  <span className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Hours</span>
                </div>
                <span className="text-2xl text-white/20 font-bold mb-4">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-white font-mono">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                  <span className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Mins</span>
                </div>
                <span className="text-2xl text-white/20 font-bold mb-4">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-white font-mono">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                  <span className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Secs</span>
                </div>
              </div>
            </div>

            {/* Price Distance Card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 flex flex-col gap-2">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">الافتتاح (Open)</span>
                <span className="text-xl font-black text-white/90 font-mono">
                  ${dailyOpen.toLocaleString(undefined, { minimumFractionDigits: dailyOpen > 1000 ? 1 : 4 })}
                </span>
              </div>
              <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 flex flex-col gap-2">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">السعر الحالي (Now)</span>
                <span className="text-xl font-black text-white/90 font-mono">
                  ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: currentPrice > 1000 ? 1 : 4 })}
                </span>
              </div>
            </div>

            {/* Verdict Card */}
            <div className={`rounded-2xl border p-5 flex flex-col items-center justify-center gap-3 ${isPositive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isPositive ? 'text-emerald-500/80' : 'text-red-500/80'}`}>
                مسافة السعر من الافتتاح
              </span>
              <div className="flex items-center gap-3">
                {isPositive ? <TrendingUp className="w-8 h-8 text-emerald-400" /> : <TrendingDown className="w-8 h-8 text-red-400" />}
                <div className="flex flex-col" dir="ltr">
                  <span className={`text-3xl font-black font-mono leading-none ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{distancePct.toFixed(2)}%
                  </span>
                  <span className={`text-xs font-mono font-bold mt-1 ${isPositive ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                    {isPositive ? '+' : ''}{distanceToOpen.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 4 })} $
                  </span>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
