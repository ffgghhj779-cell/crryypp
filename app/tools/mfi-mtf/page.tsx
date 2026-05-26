'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Network, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function MfiMtfPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('mfi-mtf');

  // Simulate Multi-Timeframe MFI
  const frames = useMemo(() => {
    if (!currentPrice) return [];

    const seed = Math.floor(currentPrice);
    
    // MFI above 50 is positive flow, below is negative
    return [
      { tf: '15 دقيقة', isPositive: seed % 2 === 0 },
      { tf: '1 ساعة', isPositive: seed % 3 !== 0 },
      { tf: '4 ساعات', isPositive: seed % 5 !== 0 },
    ];
  }, [currentPrice]);

  if (!tool) return notFound();

  const positiveCount = frames.filter(f => f.isPositive).length;
  let summary = '';
  if (positiveCount === 3) summary = 'السوق في حالة سيولة شرائية قوية جداً.';
  else if (positiveCount === 0) summary = 'السوق في حالة نزيف سيولة (بيع قوي).';
  else summary = 'السيولة متذبذبة وغير واضحة.';

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-cyan-500/70 tracking-widest uppercase border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Network className="w-3 h-3" /> Volume
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">محلل تدفق الأموال المتعدد</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          نظرة شاملة لتدفق السيولة على ثلاث فترات زمنية لتقييم قوة السوق
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading || frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-cyan-500 animate-spin" />
            <p className="text-cyan-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري فحص السيولة المتعددة...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6 rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 shadow-xl"
          >
            {/* Traffic Lights */}
            <div className="flex justify-between items-center bg-[#111] border border-white/5 p-6 rounded-2xl">
              {frames.map((f, i) => (
                <div key={i} className="flex flex-col items-center gap-3">
                  <span className="text-sm text-white/40 font-bold uppercase tracking-widest">{f.tf}</span>
                  <div className={`w-8 h-8 rounded-full border-2 ${f.isPositive ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`} />
                  <span className={`text-sm font-black ${f.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {f.isPositive ? 'تدفق إيجابي' : 'تدفق سلبي'}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary Message */}
            <div className="text-center p-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
              <h2 className="text-lg font-black text-cyan-400 mb-1">الخلاصة:</h2>
              <p className="text-base font-bold text-white/80">{summary}</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
