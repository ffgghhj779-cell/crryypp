'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Rocket, RefreshCcw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function LsmStrategyPage() {
  const { currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('lsm-strategy');

  // Simulate Breakout detection
  const breakout = useMemo(() => {
    if (!candles || candles.length < 20 || !currentPrice) return null;

    // We pretend a breakout just happened for the UI demo based on the current price seed
    const seed = Math.floor(currentPrice);
    
    // Determine breakout type
    const isBullishBreakout = seed % 2 === 0;
    
    // Simulate Stop loss
    const sl = isBullishBreakout ? currentPrice * 0.98 : currentPrice * 1.02;

    return {
      type: isBullishBreakout ? 'buy' : 'sell',
      message: isBullishBreakout ? 'تم اختراق القمة - فرصة شراء' : 'تم كسر القاع - فرصة بيع',
      stopLoss: sl
    };
  }, [candles, currentPrice]);

  if (!tool) return notFound();

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Rocket className="w-3 h-3" /> Strategy
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">كاشف الاختراق (LSM)</h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          يرصد اللحظة التي يخترق فيها السعر المستويات السابقة وينطلق بقوة
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5 mt-4">
        {isLoading || !breakout ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCcw className="w-8 h-8 text-yellow-500 animate-spin" />
            <p className="text-yellow-500/80 font-bold tracking-widest uppercase text-xs animate-pulse">جاري البحث عن اختراقات...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Massive Alert Box */}
            <div className={`rounded-3xl border p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center gap-6 ${breakout.type === 'buy' ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.3)]' : 'bg-red-500/10 border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.3)]'}`}>
              
              {/* Background Glow */}
              <div className={`absolute top-0 right-0 w-48 h-48 blur-[80px] rounded-full pointer-events-none opacity-40 ${breakout.type === 'buy' ? 'bg-emerald-500' : 'bg-red-500'}`} />

              <div className={`p-4 rounded-full border relative z-10 ${breakout.type === 'buy' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
                {breakout.type === 'buy' ? (
                  <ArrowUpRight className="w-16 h-16 animate-bounce" />
                ) : (
                  <ArrowDownRight className="w-16 h-16 animate-bounce" />
                )}
              </div>

              <h2 className={`text-3xl font-black z-10 ${breakout.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                {breakout.message}
              </h2>

              {/* Stop Loss Card */}
              <div className="w-full mt-2 bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between z-10">
                <span className="text-xs font-bold text-white/50">اقتراح وقف الخسارة (Stop Loss):</span>
                <span className="text-xl font-black text-white/90 font-mono dir-ltr">${formatPrice(breakout.stopLoss)}</span>
              </div>
            </div>

            <div className="text-center px-4">
              <p className="text-[11px] text-white/50 leading-relaxed font-bold">
                ⚠️ هذه الاستراتيجية تعتمد على اقتناص السعر فور اختراقه لمستويات المقاومة أو الدعم السابقة. يرجى الالتزام الصارم بوقف الخسارة المذكور.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
