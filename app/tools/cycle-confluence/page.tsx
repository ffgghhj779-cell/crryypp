'use client';

import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Target, RefreshCcw, BellRing } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export default function CycleConfluencePage() {
  const tool = slugToTool('cycle-confluence');
  const [loading, setLoading] = useState(true);

  // Simulate cycle confluence detection
  const confluence = {
    detected: true,
    score: 85,
    message: 'تنبيه: نقطة توافق زمني قوي قادمة!',
    details: 'تم رصد تقاطع بين دورة 90 يوم الزمنية ومستوى فيبوناتشي مهم خلال الأسبوع القادم.',
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Cycles
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">توافق الدورات (Confluence)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          اكتشاف التواريخ والمناطق التي تتطابق فيها عدة مؤشرات زمنية وسعرية معاً
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-orange-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري فحص توافق الدورات...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {confluence.detected ? (
              <div className="rounded-3xl border border-orange-500/40 bg-orange-500/10 p-8 flex flex-col items-center text-center gap-6 shadow-[0_0_40px_rgba(249,115,22,0.2)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 blur-[50px] rounded-full pointer-events-none" />
                
                <div className="bg-orange-500/20 p-6 rounded-full border border-orange-500/40 relative">
                  <div className="absolute inset-0 rounded-full border border-orange-400 animate-ping opacity-50" />
                  <BellRing className="w-12 h-12 text-orange-400" />
                </div>

                <div className="flex flex-col gap-3 z-10">
                  <h2 className="text-2xl font-black text-orange-400">{confluence.message}</h2>
                  <p className="text-base text-white/80 font-bold leading-relaxed">{confluence.details}</p>
                </div>

                {/* Strength Meter */}
                <div className="w-full mt-4 flex flex-col gap-3 z-10">
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-white/50 uppercase font-bold tracking-widest">قوة التوافق</span>
                    <span className="text-lg font-black font-mono text-orange-400 dir-ltr">{confluence.score}%</span>
                  </div>
                  <div className="h-3 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${confluence.score}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-l from-orange-400 to-orange-600 rounded-full"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-8 flex flex-col items-center text-center gap-6">
                <Target className="w-12 h-12 text-white/20" />
                <h2 className="text-lg font-bold text-white/50">لا يوجد توافق قوي حالياً</h2>
                <p className="text-sm text-white/30 font-bold">السوق لا يظهر أي تداخل واضح بين الدورات الزمنية في الوقت الحالي.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
