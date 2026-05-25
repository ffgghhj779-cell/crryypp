'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Zap, RefreshCcw, Hand, Scissors, Gem } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function PowerOf3Page() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('power-of-3');

  // Simulate AMD phase based on time of day or mock logic
  const currentPhaseIndex = useMemo(() => {
    if (!currentPrice) return 0;
    const hour = new Date().getHours();
    
    // Simplistic mock:
    // Accumulation (0-8), Manipulation (9-16), Distribution (17-23)
    if (hour < 8) return 0;
    if (hour < 16) return 1;
    return 2;
  }, [currentPrice]);

  if (!tool) return notFound();

  const phases = [
    { 
      id: 0, 
      title: 'تجميع السيولة (Accumulation)', 
      desc: 'بناء المراكز بهدوء وتشكيل دعم أساسي.',
      icon: Hand,
      color: 'text-blue-400',
      activeBg: 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
    },
    { 
      id: 1, 
      title: 'ضرب الستوبات (Manipulation)', 
      desc: 'حركة وهمية سريعة لخداع المتداولين وضرب وقف الخسارة.',
      icon: Scissors,
      color: 'text-red-400',
      activeBg: 'bg-red-500/20 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
    },
    { 
      id: 2, 
      title: 'توزيع الأرباح (Distribution)', 
      desc: 'الحركة الحقيقية القوية وتوزيع الأرباح في الاتجاه المقصود.',
      icon: Gem,
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> Pattern
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">التجميع الثلاثي (AMD)</h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          كشف خطوات صانع السوق الثلاثية داخل شمعة اليوم الواحد
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCcw className="w-8 h-8 text-yellow-500 animate-spin" />
            <p className="text-yellow-500/80 font-bold tracking-widest uppercase text-xs animate-pulse">جاري تحديد المرحلة الحالية...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-4"
          >
            {phases.map((phase) => {
              const isActive = phase.id === currentPhaseIndex;
              const Icon = phase.icon;

              return (
                <div 
                  key={phase.id} 
                  className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-500 ${isActive ? phase.activeBg : 'bg-[#0d0d0d] border-white/[0.05] opacity-50'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isActive ? 'bg-black/30' : 'bg-white/5'}`}>
                        <Icon className={`w-5 h-5 ${isActive ? phase.color : 'text-white/40'}`} />
                      </div>
                      <span className={`text-sm font-black ${isActive ? phase.color : 'text-white/60'}`}>
                        {phase.title}
                      </span>
                    </div>
                    {isActive && (
                      <span className="text-[9px] bg-white/10 px-2 py-1 rounded-full font-bold text-white uppercase tracking-widest animate-pulse">
                        الآن
                      </span>
                    )}
                  </div>
                  
                  <p className={`text-[11px] font-bold leading-relaxed ${isActive ? 'text-white/90' : 'text-white/30'}`}>
                    {phase.desc}
                  </p>
                </div>
              );
            })}

            <div className="mt-4 text-center px-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-[11px] text-yellow-500/80 leading-relaxed font-bold">
                تنبيه: لا تقم بالدخول أثناء مرحلة &quot;ضرب الستوبات&quot; لأنها حركة خادعة ومصيدة للمتداولين.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
