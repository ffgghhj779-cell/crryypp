'use client';

/**
 * app/tools/atr-volatility/page.tsx
 *
 * ATR Volatility Engine (محرك التقلبات)
 * Visualizes the current market volatility using ATR vs SMA(ATR).
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Activity, ChevronDown, ShieldAlert, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateVolatility, VolatilityResult } from '@/lib/algorithms/volatility';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { ToolChart, OverlaySeries } from '@/components/tools/ToolChart';

export default function AtrVolatilityPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  
  const [result, setResult] = useState<VolatilityResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  
  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), timeframe.toLowerCase(), 200); 
      if (fetchedKlines.length === 0) throw new Error('لا توجد بيانات متاحة لهذا الأصل.');
      
      const res = calculateVolatility(symbol.toUpperCase().trim(), fetchedKlines);
      setKlines(fetchedKlines);
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

  const chartOverlays: OverlaySeries[] = useMemo(() => {
    if (!result || klines.length === 0) return [];
    
    // We expect the result arrays to match the klines length
    const timeMapped = klines.map(k => k.time);
    
    const overlays: OverlaySeries[] = [];
    
    // 1. Bollinger Bands
    if (result.bbUpperArr && result.bbUpperArr.length === klines.length) {
      overlays.push({
        type: 'line',
        title: 'BB Upper',
        color: '#60a5fa', // blue-400
        lineWidth: 1,
        data: result.bbUpperArr.map((v, i) => ({ time: timeMapped[i], value: v }))
      });
      overlays.push({
        type: 'line',
        title: 'BB Lower',
        color: '#60a5fa',
        lineWidth: 1,
        data: result.bbLowerArr.map((v, i) => ({ time: timeMapped[i], value: v }))
      });
    }

    // 2. Keltner Channels
    if (result.kcUpperArr && result.kcUpperArr.length === klines.length) {
      overlays.push({
        type: 'line',
        title: 'KC Upper',
        color: '#c084fc', // purple-400
        lineWidth: 1,
        data: result.kcUpperArr.map((v, i) => ({ time: timeMapped[i], value: v }))
      });
      overlays.push({
        type: 'line',
        title: 'KC Lower',
        color: '#c084fc',
        lineWidth: 1,
        data: result.kcLowerArr.map((v, i) => ({ time: timeMapped[i], value: v }))
      });
    }

    // 3. SMA 20 (Basis)
    if (result.sma20Arr && result.sma20Arr.length === klines.length) {
      overlays.push({
        type: 'line',
        title: 'SMA 20',
        color: '#f87171', // red-400
        lineWidth: 2,
        data: result.sma20Arr.map((v, i) => ({ time: timeMapped[i], value: v }))
      });
    }

    return overlays;
  }, [result, klines]);

  const tool = slugToTool('atr-volatility');
  if (!tool) return notFound();

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

              {/* ToolChart Component */}
              <div className="rounded-2xl bg-black p-4 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> ATR Price Targets
                  </p>
                  <p className="text-xs font-mono text-white/40">{result.symbol} • {timeframe.toUpperCase()}</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  overlays={chartOverlays}
                  priceLines={[
                    { price: result.targetUp1, color: '#10b981', title: '+1.5 ATR', lineStyle: 2 },
                    { price: result.targetUp2, color: '#10b981', title: '+2.5 ATR', lineStyle: 2 },
                    { price: result.targetDn1, color: '#ef4444', title: '-1.5 ATR', lineStyle: 2 },
                    { price: result.targetDn2, color: '#ef4444', title: '-2.5 ATR', lineStyle: 2 },
                  ]}
                />
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
                    أبعد وقفك بمقدار <span className="font-mono bg-rose-500/20 px-1 rounded border border-rose-500/30">${priceStr(result.safeStopLossDist)}</span>
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
