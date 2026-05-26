'use client';

/**
 * app/tools/atr-volatility/page.tsx
 *
 * ATR Volatility Engine (محرك التقلبات)
 * Visualizes the current market volatility using ATR vs SMA(ATR).
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Activity, ChevronDown, ShieldAlert, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateVolatility, VolatilityResult } from '@/lib/algorithms/volatility';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';

export default function AtrVolatilityPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  
  const [result, setResult] = useState<VolatilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('atr-volatility');
  if (!tool) return notFound();

  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), timeframe.toLowerCase(), 200); // Need more klines for SMA(ATR, 20) of ATR(14)
      if (klines.length === 0) throw new Error('لا توجد بيانات متاحة لهذا الأصل.');
      
      const res = calculateVolatility(symbol.toUpperCase().trim(), klines);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء جلب البيانات أو المعالجة.');
    } finally {
      setLoading(false);
    }
  };

  const priceStr = (val: number) => {
    if (val >= 1000) return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (val >= 1) return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
    return val.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-amber-500/70 tracking-widest uppercase border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Activity className="w-3 h-3" /> Volatility Engine
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          محرك التقلبات (ATR)
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          قياس السيولة وسرعة الحركة لحساب الإيقاف الآمن
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Input Form */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest">رمز الأصل المالي</label>
              <SymbolDropdown value={symbol} onChange={setSymbol} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">الإطار الزمني</label>
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={e => setTimeframe(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-base px-5 py-4 appearance-none focus:outline-none focus:border-amber-500/40 transition-colors cursor-pointer"
                  dir="ltr"
                >
                  <option value="1h">1H</option>
                  <option value="4h">4H</option>
                  <option value="1d">1D</option>
                  <option value="1w">1W</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-6 h-6 text-white/40" />
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-4.5 mt-2">
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-base tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #78350f, #451a03)' : 'linear-gradient(135deg, #f59e0b, #b45309)',
              boxShadow: !loading ? '0 0 20px rgba(245, 158, 11, 0.25)' : 'none'
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري القياس...' : 'تشغيل محرك التقلبات'}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="flex flex-col gap-6"
            >
              {/* Visual Speedometer/Gauge Chart */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-6 flex flex-col items-center shadow-[0_0_30px_rgba(245,158,11,0.05)] relative overflow-hidden">
                <p className="text-sm font-bold text-white/50 uppercase tracking-widest mb-6">مؤشر سرعة السوق (Speedometer)</p>
                
                <div className="relative w-64 h-32 overflow-hidden flex justify-center mb-2">
                  {/* Gauge Background SVG */}
                  <svg className="w-full h-full" viewBox="0 0 200 100">
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" /> {/* Green - Low */}
                        <stop offset="50%" stopColor="#f59e0b" /> {/* Yellow/Orange - Normal */}
                        <stop offset="100%" stopColor="#ef4444" /> {/* Red - Extreme */}
                      </linearGradient>
                    </defs>
                    {/* Background Arc */}
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="#222"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    {/* Colored Arc */}
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="url(#gaugeGradient)"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    
                    {/* The Needle */}
                    <motion.g
                      initial={{ rotate: -90 }}
                      animate={animated ? { rotate: -90 + (180 * result.volatilityPct) / 100 } : { rotate: -90 }}
                      transition={{ type: 'spring', stiffness: 60, damping: 15, delay: 0.3 }}
                      style={{ originX: "100px", originY: "100px" }}
                    >
                      <path d="M 97 100 L 100 25 L 103 100 Z" fill="#fff" />
                      <circle cx="100" cy="100" r="6" fill="#fff" />
                    </motion.g>
                  </svg>
                  
                  <div className="absolute bottom-0 text-3xl font-black font-mono text-white tracking-tighter">
                    {result.volatilityPct}%
                  </div>
                </div>

                <div className="w-full flex justify-between text-sm font-bold text-white/40 uppercase tracking-widest mt-2 px-5">
                  <span className="text-emerald-500/70">Low</span>
                  <span className="text-amber-500/70">Normal</span>
                  <span className="text-red-500/70">Extreme</span>
                </div>
              </div>

              {/* Status Cards (CSS Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Volatility State */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className={`flex flex-col p-6 rounded-xl border border-white/[0.05] ${
                    result.state === 'Expanding' ? 'bg-amber-500/10 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' : 'bg-emerald-500/10 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]'
                  }`}
                >
                  <span className="text-sm font-bold text-white/50 mb-2 flex items-center gap-1.5">
                    <Activity className="w-3 h-3" /> حالة السوق
                  </span>
                  <span className={`text-lg font-black tracking-widest ${
                    result.state === 'Expanding' ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  }`}>
                    {result.stateAr}
                  </span>
                </motion.div>
                
                {/* 2. ATR Value */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="flex flex-col p-6 rounded-xl border border-white/[0.05] bg-black/40"
                >
                  <span className="text-sm font-bold text-white/50 mb-2 flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> قيمة التقلب اليومي (ATR)
                  </span>
                  <span className="text-xl font-black text-white font-mono tracking-tighter">
                    ${priceStr(result.atrValue)}
                  </span>
                  <span className="text-sm text-white/40 mt-1">متوسط حركة الشمعة</span>
                </motion.div>

                {/* 3. Safe Stop Loss */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="flex flex-col p-6 rounded-xl border border-rose-500/20 bg-rose-500/5 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-8 h-8 bg-rose-500/20 blur-xl rounded-full" />
                  <span className="text-sm font-bold text-rose-500/80 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3 h-3" /> نطاق الوقف الآمن (SL)
                  </span>
                  <span className="text-base font-black text-rose-300 leading-snug">
                    أبعد وقفك بمقدار <span className="font-mono bg-rose-500/20 px-1 rounded border border-rose-500/30">${priceStr(result.safeStopLossDist)}</span> عن نقطة الدخول
                  </span>
                  <span className="text-sm text-rose-500/60 mt-2 font-bold tracking-widest">معدل الحماية: 1.5x ATR</span>
                </motion.div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
