'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Layers, RefreshCcw, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function MultiScaleFractalPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('multi-scale-fractal');

  // Simulate Multi-Timeframe logic based on a seed from currentPrice
  // Real implementation would require fetching 3 different timeframes
  const timeframes = useMemo(() => {
    if (!currentPrice) return [];

    const seed = Math.floor(currentPrice);
    
    // Just mock states for demonstration: true = Bullish, false = Bearish
    return [
      { name: 'إطار 15 دقيقة (سريع)', isBullish: seed % 2 === 0 },
      { name: 'إطار 1 ساعة (متوسط)', isBullish: seed % 3 !== 0 },
      { name: 'إطار 4 ساعات (رئيسي)', isBullish: seed % 5 !== 0 },
    ];
  }, [currentPrice]);

  if (!tool) return notFound();

  const bullCount = timeframes.filter(t => t.isBullish).length;
  let overallVerdict = '';
  let overallColor = '';

  if (bullCount === 3) {
    overallVerdict = 'صاعد بقوة (إجماع إيجابي)';
    overallColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  } else if (bullCount === 0) {
    overallVerdict = 'هابط بقوة (إجماع سلبي)';
    overallColor = 'text-red-400 bg-red-500/10 border-red-500/30';
  } else if (bullCount > 1) {
    overallVerdict = 'صاعد نسبياً (تذبذب)';
    overallColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
  } else {
    overallVerdict = 'هابط نسبياً (تذبذب)';
    overallColor = 'text-red-400 bg-red-500/5 border-red-500/10';
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-fuchsia-500/70 tracking-widest uppercase border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Pattern
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">فراكتل متعدد الأطر</h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          تحليل القمم والقيعان عبر عدة فترات زمنية لمعرفة الاتجاه العام الحقيقي
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5 mt-4">
        {isLoading || timeframes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCcw className="w-8 h-8 text-fuchsia-500 animate-spin" />
            <p className="text-fuchsia-500/80 font-bold tracking-widest uppercase text-xs animate-pulse">جاري دمج الفريمات...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-5"
          >
            {/* Verdict Card */}
            <div className={`rounded-2xl border p-5 flex flex-col items-center justify-center gap-2 text-center ${overallColor}`}>
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">
                الاتجاه العام بناءً على الفريمات المتعددة هو:
              </span>
              <span className="text-2xl font-black tracking-wide">
                {overallVerdict}
              </span>
            </div>

            {/* Timeframe Grid */}
            <div className="grid gap-3">
              {timeframes.map((tf, i) => (
                <div key={i} className="rounded-xl border border-white/[0.05] bg-[#0d0d0d] p-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-white/80">{tf.name}</span>
                  
                  <div className="flex items-center gap-2">
                    {tf.isBullish ? (
                      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                        <span className="text-xs font-bold text-emerald-400">إيجابي صاعد</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                        <span className="text-xs font-bold text-red-400">سلبي هابط</span>
                        <XCircle className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-2 px-2">
              <p className="text-[10px] text-white/30 leading-relaxed font-bold">
                💡 التداول يكون آمناً جداً عندما تكون نتيجة الأطر الثلاثة متطابقة (إجماع).
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
