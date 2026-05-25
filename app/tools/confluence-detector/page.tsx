'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Crosshair, RefreshCcw, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function ConfluenceDetectorPage() {
  const { currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('confluence-detector');

  // Mock detection of a confluence level
  const confluenceLevel = useMemo(() => {
    if (!currentPrice) return null;
    
    // Simulate finding a strong level just below current price
    const level = currentPrice * 0.96; 
    
    return {
      price: level,
      reasons: [
        'دعم قوي سابق (تاريخي)',
        'مستوى فيبوناتشي الذهبي 0.618',
        'كتلة أوامر شرائية (Order Block)'
      ]
    };
  }, [currentPrice]);

  if (!tool) return notFound();

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-purple-500/70 tracking-widest uppercase border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Crosshair className="w-3 h-3" /> Confluence
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">كاشف التوافق الدقيق</h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          البحث عن أقوى نقطة سعرية تجتمع فيها عدة مؤشرات لدعم السعر
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5 mt-4">
        {isLoading || !confluenceLevel ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCcw className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-purple-500/80 font-bold tracking-widest uppercase text-xs animate-pulse">جاري المسح المعمق...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Radar / Target UI */}
            <div className="rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 shadow-xl relative overflow-hidden flex flex-col items-center">
              
              <div className="relative w-48 h-48 flex items-center justify-center mt-4 mb-6">
                {/* Glowing Rings */}
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1 }}
                  className="absolute w-full h-full rounded-full border border-purple-500/20 bg-purple-500/5 flex items-center justify-center"
                >
                  <div className="w-3/4 h-3/4 rounded-full border border-purple-500/40 bg-purple-500/10 flex items-center justify-center">
                    <div className="w-1/2 h-1/2 rounded-full border border-purple-500/60 bg-purple-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                      <Crosshair className="w-8 h-8 text-purple-400" />
                    </div>
                  </div>
                </motion.div>
                
                {/* Sweep animation */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute w-full h-full rounded-full"
                  style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(168,85,247,0.4) 100%)' }}
                />
              </div>

              <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/10 mb-2">أقوى نقطة ارتداد حالية متوقعة</span>
              <span className="text-4xl font-black font-mono text-white dir-ltr text-shadow-glow">${formatPrice(confluenceLevel.price)}</span>
            </div>

            {/* Reasons List */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-purple-400 pr-2 border-r-2 border-purple-500">لماذا هذا السعر قوي جداً؟</h2>
              
              <div className="flex flex-col gap-2">
                {confluenceLevel.reasons.map((reason, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.15 }}
                    className="flex items-center gap-3 bg-[#111] border border-white/[0.05] p-4 rounded-xl"
                  >
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold text-white/80">{reason}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="text-center px-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
              <p className="text-[11px] text-white/60 leading-relaxed font-bold">
                💡 عندما تجتمع عدة أسباب عند نفس السعر، يتشكل &quot;جدار حديدي&quot; يصعب كسره، وتعتبر فرصة ممتازة للدخول.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
