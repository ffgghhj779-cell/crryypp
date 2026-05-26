'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Activity, RefreshCcw, TrendingUp, BarChart2, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function TripleAnalysisPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('triple-analysis');

  // Mock 3 pillars of analysis
  const analysis = useMemo(() => {
    if (!currentPrice) return null;

    const seed = Math.floor(currentPrice);
    
    const trend = seed % 2 === 0 ? 1 : -1; // 1 = Bull, -1 = Bear
    const volume = seed % 3 !== 0 ? 1 : -1;
    const momentum = seed % 5 !== 0 ? 1 : -1;

    return { trend, volume, momentum };
  }, [currentPrice]);

  if (!tool) return notFound();

  let totalScore = 0;
  if (analysis) {
    totalScore = analysis.trend + analysis.volume + analysis.momentum;
  }

  let finalAction = '';
  let actionColor = '';
  let actionBg = '';
  let desc = '';

  if (totalScore >= 2) {
    finalAction = 'شراء';
    actionColor = 'text-emerald-400';
    actionBg = 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]';
    desc = 'التوافق الثلاثي إيجابي. الاتجاه والسيولة والزخم تدعم الصعود.';
  } else if (totalScore <= -2) {
    finalAction = 'بيع';
    actionColor = 'text-red-400';
    actionBg = 'bg-red-500/10 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]';
    desc = 'التوافق الثلاثي سلبي. الأفضل التخارج أو البيع حالياً.';
  } else {
    finalAction = 'انتظار';
    actionColor = 'text-yellow-400';
    actionBg = 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]';
    desc = 'إشارات متعارضة. لا يوجد توافق بين الاتجاه والسيولة. يفضل الانتظار.';
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-purple-500/70 tracking-widest uppercase border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Confluence
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">التحليل الثلاثي البسيط</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          دمج (الاتجاه + السيولة + الزخم) للحصول على قرار واحد مبسط
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading || !analysis ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-purple-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري دمج البيانات...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* 3 Pillars Grid */}
            <div className="grid gap-3">
              <div className={`rounded-2xl border p-6 flex items-center justify-between ${analysis.trend > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-center gap-3">
                  <TrendingUp className={`w-5 h-5 ${analysis.trend > 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  <span className="text-base font-bold text-white/80">حالة الاتجاه (Trend)</span>
                </div>
                <span className={`text-sm font-black ${analysis.trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {analysis.trend > 0 ? 'صاعد إيجابي' : 'هابط سلبي'}
                </span>
              </div>

              <div className={`rounded-2xl border p-6 flex items-center justify-between ${analysis.volume > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-center gap-3">
                  <BarChart2 className={`w-5 h-5 ${analysis.volume > 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  <span className="text-base font-bold text-white/80">السيولة (Volume)</span>
                </div>
                <span className={`text-sm font-black ${analysis.volume > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {analysis.volume > 0 ? 'شراء قوي' : 'بيع قوي'}
                </span>
              </div>

              <div className={`rounded-2xl border p-6 flex items-center justify-between ${analysis.momentum > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-center gap-3">
                  <Zap className={`w-5 h-5 ${analysis.momentum > 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  <span className="text-base font-bold text-white/80">الزخم (Momentum)</span>
                </div>
                <span className={`text-sm font-black ${analysis.momentum > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {analysis.momentum > 0 ? 'تسارع للأعلى' : 'تسارع للأسفل'}
                </span>
              </div>
            </div>

            {/* Final Verdict */}
            <div className={`mt-4 rounded-3xl border p-8 flex flex-col items-center text-center gap-3 relative overflow-hidden ${actionBg}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[40px] rounded-full pointer-events-none" />
              
              <span className="text-sm text-white/60 font-bold uppercase tracking-widest z-10">القرار النهائي بناءً على التحليل:</span>
              <h2 className={`text-4xl font-black tracking-tight z-10 ${actionColor}`}>
                {finalAction}
              </h2>
              
              <div className="mt-2 px-5 py-4 bg-black/30 rounded-xl border border-white/5 z-10">
                <p className="text-sm text-white/70 font-bold">{desc}</p>
              </div>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
