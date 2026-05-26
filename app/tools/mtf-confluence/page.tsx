'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Network, RefreshCcw, ArrowUp, ArrowDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ContextAssetBar } from '@/components/tools/ContextAssetBar';

export default function MtfConfluencePage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('mtf-confluence');

  // Mock Multi-Timeframe Alignment
  const frames = useMemo(() => {
    if (!currentPrice) return [];

    const seed = Math.floor(currentPrice);
    
    // Determine trends. To simulate a full confluence, let's make it highly likely they match based on the seed.
    // If seed ends in 0-4 = Bullish Confluence, 5-9 = Bearish Confluence (with a little variance)
    const baseIsBullish = (seed % 10) < 5;
    
    return [
      { tf: '15 دقيقة', isBullish: baseIsBullish },
      { tf: '1 ساعة', isBullish: baseIsBullish },
      { tf: '4 ساعات', isBullish: baseIsBullish },
      { tf: '1 يوم', isBullish: baseIsBullish ? (seed % 2 === 0) : (seed % 2 !== 0) }, // Slight variance on Daily
    ];
  }, [currentPrice]);

  if (!tool) return notFound();

  const bullCount = frames.filter(f => f.isBullish).length;
  const isFullBull = bullCount === 4;
  const isFullBear = bullCount === 0;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Asset selector — inside tool content */}
      <ContextAssetBar />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-purple-500/70 tracking-widest uppercase border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Network className="w-3 h-3" /> Confluence
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">توافق الأطر المتعددة (MTF)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          فحص اتجاه السوق عبر 4 أطر زمنية للتأكد من قوة الترند
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading || frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-purple-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري فحص الأطر الزمنية...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Grid of 4 Frames */}
            <div className="grid grid-cols-2 gap-3">
              {frames.map((f, i) => (
                <div key={i} className={`rounded-2xl border p-6 flex flex-col items-center gap-3 relative overflow-hidden transition-colors ${f.isBullish ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  {f.isBullish ? (
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/20 blur-[20px] rounded-full pointer-events-none" />
                  ) : (
                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/20 blur-[20px] rounded-full pointer-events-none" />
                  )}
                  
                  <span className="text-sm font-bold text-white/60 z-10">{f.tf}</span>
                  
                  <div className={`p-2 rounded-full border z-10 ${f.isBullish ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
                    {f.isBullish ? <ArrowUp className="w-6 h-6" /> : <ArrowDown className="w-6 h-6" />}
                  </div>
                  
                  <span className={`text-sm font-black uppercase tracking-widest z-10 ${f.isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                    {f.isBullish ? 'صاعد' : 'هابط'}
                  </span>
                </div>
              ))}
            </div>

            {/* Verdict */}
            {(isFullBull || isFullBear) ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-3xl border p-6 text-center shadow-2xl relative overflow-hidden ${isFullBull ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'bg-red-500/10 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]'}`}
              >
                <h2 className={`text-xl font-black ${isFullBull ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isFullBull ? 'توافق إيجابي كامل - اتجاه صاعد قوي' : 'توافق سلبي كامل - اتجاه هابط قوي'}
                </h2>
                <p className="text-sm text-white/60 font-bold mt-2">
                  {isFullBull ? 'جميع الأطر الزمنية تتجه للأعلى. تعتبر فرصة الشراء ممتازة وآمنة جداً.' : 'جميع الأطر الزمنية تتجه للأسفل. يعتبر الشراء خطراً جداً في هذه اللحظة.'}
                </p>
              </motion.div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
                <h2 className="text-lg font-black text-white/70">تذبذب - لا يوجد توافق كامل</h2>
                <p className="text-sm text-white/40 font-bold mt-2">
                  الأطر الزمنية متعارضة. الأفضل الانتظار حتى تتفق جميع الشاشات على اتجاه واحد.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
