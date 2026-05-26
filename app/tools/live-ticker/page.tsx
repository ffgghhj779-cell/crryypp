'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Activity, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';

export default function LiveTickerPage() {
  const { symbol, currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('live-ticker');

  if (!tool) return notFound();

  // Calculate 24h change if we have candles (assuming 1d timeframe or at least enough candles)
  // We'll just take the open of the current candle, or the close of the previous if available.
  const lastCandle = candles[candles.length - 1];
  const previousCandle = candles[candles.length - 2];
  
  let changePct = 0;
  let isPositive = true;

  if (lastCandle && currentPrice !== null) {
    const referencePrice = previousCandle ? previousCandle.close : lastCandle.open;
    changePct = ((currentPrice - referencePrice) / referencePrice) * 100;
    isPositive = changePct >= 0;
  }

  // Simple sparkline path
  const sparklineData = candles.slice(-20).map(c => c.close);
  const maxPrice = Math.max(...sparklineData);
  const minPrice = Math.min(...sparklineData);
  const range = maxPrice - minPrice || 1;
  const path = sparklineData.map((p, i) => {
    const x = (i / (sparklineData.length - 1)) * 100;
    const y = 100 - ((p - minPrice) / range) * 100;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-blue-500/70 tracking-widest uppercase border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Real-time
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">السعر الحي</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          متابعة لحظية لسعر الأصل مع النسبة المئوية للتغير
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-blue-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري جلب البيانات المباشرة...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-8 flex flex-col items-center justify-center gap-6 shadow-[0_0_40px_rgba(59,130,246,0.1)] overflow-hidden"
          >
            {/* Glowing orb background */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-96 ${isPositive ? 'bg-emerald-500/20' : 'bg-red-500/20'} blur-[100px] rounded-full pointer-events-none`} />

            <div className="flex flex-col items-center z-10">
              <span className="text-base font-bold text-white/50 tracking-widest uppercase mb-2">{symbol}</span>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl text-white/40 font-mono font-light">$</span>
                <span className="text-6xl font-black text-white font-mono tracking-tighter" style={{ textShadow: '0 0 30px rgba(255,255,255,0.2)' }}>
                  {currentPrice != null
                    ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: currentPrice > 1000 ? 1 : 4 })
                    : '----'}
                </span>
              </div>
            </div>

            <div className={`flex items-center gap-3 px-5 py-4 rounded-full border ${isPositive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} z-10`}>
              {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span className="text-lg font-black tracking-wider dir-ltr">{isPositive ? '+' : ''}{changePct.toFixed(2)}%</span>
            </div>

            {/* Sparkline */}
            {sparklineData.length > 0 && (
              <div className="w-full h-16 mt-4 relative z-10 opacity-60">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.5" />
                      <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${path} L 100 100 L 0 100 Z`} fill="url(#sparklineGrad)" />
                  <path d={path} fill="none" stroke={isPositive ? '#10b981' : '#ef4444'} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
