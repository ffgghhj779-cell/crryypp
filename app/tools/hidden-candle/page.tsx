'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { EyeOff, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function HiddenCandlePage() {
  const { currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('hidden-candle');

  // Predict next candle based on last 3
  const predicted = useMemo(() => {
    if (!candles || candles.length < 3 || !currentPrice) return null;

    const last3 = candles.slice(-3);
    
    // Average True Range of last 3
    let totalRange = 0;
    let netDirection = 0; // Positive = up, Negative = down
    
    last3.forEach(c => {
      totalRange += (c.high - c.low);
      netDirection += (c.close - c.open);
    });

    const atr = totalRange / 3;
    const isBullish = netDirection >= 0;
    
    // The predicted open is roughly the current price
    const pOpen = currentPrice;
    
    // Add momentum to predict close
    const pClose = isBullish ? pOpen + (atr * 0.6) : pOpen - (atr * 0.6);
    
    // Wicks
    const pHigh = Math.max(pOpen, pClose) + (atr * 0.2);
    const pLow = Math.min(pOpen, pClose) - (atr * 0.2);

    return { open: pOpen, high: pHigh, low: pLow, close: pClose, isBullish };
  }, [candles, currentPrice]);

  if (!tool) return notFound();

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-fuchsia-500/70 tracking-widest uppercase border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <EyeOff className="w-3 h-3" /> Prediction
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">الشمعة المخفية</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          توقع شكل وأهداف الشمعة القادمة قبل أن تتشكل في السوق
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading || !predicted ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-fuchsia-500 animate-spin" />
            <p className="text-fuchsia-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري توقع الشمعة القادمة...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 shadow-xl relative overflow-hidden"
          >
            <div className="flex justify-center mb-4">
              <h2 className="text-base font-bold text-white/70 border-b border-white/10 pb-2">
                الهدف المتوقع للشمعة القادمة
              </h2>
            </div>

            {/* Abstract Holographic Candlestick */}
            <div className="flex items-center justify-center py-8 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-fuchsia-500/10 blur-[60px] rounded-full pointer-events-none" />
              
              <div className="relative flex flex-col items-center justify-center w-32 h-48">
                {/* Wicks */}
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: '100%' }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className={`absolute w-1 ${predicted.isBullish ? 'bg-emerald-500/50' : 'bg-red-500/50'} z-0 shadow-[0_0_10px_currentColor]`}
                />
                
                {/* Body */}
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '60%', opacity: 1 }}
                  transition={{ duration: 0.8, type: 'spring' }}
                  className={`relative w-16 ${predicted.isBullish ? 'bg-emerald-500/30 border-emerald-400' : 'bg-red-500/30 border-red-400'} border-2 border-dashed rounded-sm backdrop-blur-sm z-10 flex items-center justify-center shadow-[0_0_20px_currentColor]`}
                >
                  <span className="text-sm font-black text-white/80 tracking-widest uppercase opacity-70">
                    مخفية
                  </span>
                </motion.div>
              </div>

              {/* Price Labels */}
              <div className="absolute right-4 top-0 flex items-center gap-3">
                <span className="text-sm text-white/40 font-bold uppercase tracking-widest">أعلى سعر متوقع</span>
                <span className="text-base font-mono font-black text-white/90">{formatPrice(predicted.high)}</span>
              </div>
              
              <div className="absolute left-4 bottom-0 flex items-center gap-3">
                <span className="text-base font-mono font-black text-white/90">{formatPrice(predicted.low)}</span>
                <span className="text-sm text-white/40 font-bold uppercase tracking-widest">أدنى سعر متوقع</span>
              </div>
            </div>

            {/* Data Grid */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className={`rounded-xl p-6 flex flex-col gap-1 items-center justify-center border ${predicted.isBullish ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                <span className="text-sm text-white/50 uppercase font-bold tracking-widest">سعر الإغلاق المتوقع</span>
                <span className={`text-xl font-mono font-black ${predicted.isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPrice(predicted.close)}
                </span>
              </div>
              <div className="rounded-xl p-6 flex flex-col gap-1 items-center justify-center border border-white/5 bg-white/[0.02]">
                <span className="text-sm text-white/50 uppercase font-bold tracking-widest">الاتجاه المتوقع</span>
                <span className={`text-lg font-black ${predicted.isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                  {predicted.isBullish ? 'صاعد 📈' : 'هابط 📉'}
                </span>
              </div>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
