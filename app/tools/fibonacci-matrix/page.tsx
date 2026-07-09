'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Grid, Clock, Target, Focus } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateFibMatrix, FibMatrixResult, Pivot } from '@/lib/algorithms/fibMatrix';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { ToolChart, ChartMarker, HorizontalLine } from '@/components/tools/ToolChart';

export default function FibMatrixPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FibMatrixResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);
  const [animated, setAnimated] = useState(false);

  
  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل.');
    setLoading(true);
    setAnimated(false);

    try {
      // Fetch real OHLCV data
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (klines.length < 20) throw new Error('بيانات غير كافية لحساب المصفوفة.');

      // Find real Swing High and Swing Low from last 100 candles
      let swingHighIdx = 0;
      let swingLowIdx = 0;
      let highVal = klines[0].high;
      let lowVal = klines[0].low;

      klines.forEach((k, i) => {
        if (k.high > highVal) { highVal = k.high; swingHighIdx = i; }
        if (k.low  < lowVal)  { lowVal  = k.low;  swingLowIdx  = i; }
      });

      const swingHigh: Pivot = { price: highVal, index: swingHighIdx };
      const swingLow:  Pivot = { price: lowVal,  index: swingLowIdx  };
      const currentBarIndex = klines.length - 1;

      const res = calculateFibMatrix(swingHigh, swingLow, currentBarIndex);
      setKlines(klines);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حساب المصفوفة.');
    } finally {
      setLoading(false);
    }
  };

  const priceStr = (val: number) =>
    val.toLocaleString(undefined, { maximumFractionDigits: val > 100 ? 1 : 5 });

  const chartLines: HorizontalLine[] = useMemo(() => {
    if (!result) return [];
    return result.priceLevels.map(p => ({
      price: p.value,
      color: '#f59e0b',
      title: `Fib ${p.ratio}`,
      lineStyle: 2,
    }));
  }, [result]);

  const chartMarkers: ChartMarker[] = useMemo(() => {
    if (!result || klines.length === 0) return [];
    
    // Base high/low
    const markers: ChartMarker[] = [
      { time: klines[result.baseHigh.index]?.time || 0, position: 'aboveBar', shape: 'arrowDown', color: '#ef4444', text: 'H', size: 1 },
      { time: klines[result.baseLow.index]?.time || 0, position: 'belowBar', shape: 'arrowUp', color: '#10b981', text: 'L', size: 1 },
    ];
    
    // Time levels
    result.timeLevels.forEach(t => {
      // It might project into the future, but we only have history klines.
      // If it's outside our klines array, we can't easily mark it on the time scale with ToolChart right now,
      // but we can mark the ones that fall within our fetched data.
      if (t.value < klines.length) {
        markers.push({
          time: klines[t.value].time,
          position: 'aboveBar',
          shape: 'square',
          color: '#8b5cf6',
          text: `T ${t.ratio}`,
        });
      }
    });

    return markers.filter(m => m.time !== 0);
  }, [result, klines]);

  const tool = slugToTool('fibonacci-matrix');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-amber-500/70 tracking-widest uppercase border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Grid className="w-3 h-3" /> Matrix Projections
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">مصفوفة فيبوناتشي (زمن وسعر)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          إسقاط تقاطعات السعر والزمن لتحديد مناطق القتل (Kill Zones) — بيانات حقيقية
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Control Panel */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-4 shadow-xl shadow-black/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white/50 uppercase tracking-widest">رمز الأصل المالي</label>
            <SymbolDropdown value={symbol} onChange={setSymbol} />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3 mt-2">
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-base tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #78350f, #451a03)' : 'linear-gradient(135deg, #f59e0b, #b45309)',
              boxShadow: !loading ? '0 0 20px rgba(245, 158, 11, 0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري بناء المصفوفة...' : 'تشغيل مصفوفة فيبوناتشي'}
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
              {/* Swing Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-xs text-emerald-400/60 uppercase tracking-widest mb-1">Swing Low (الأدنى)</p>
                  <p className="text-lg font-black text-emerald-400 font-mono">{priceStr(result.baseLow.price)}</p>
                  <p className="text-xs text-white/30">شمعة رقم {result.baseLow.index}</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-xs text-red-400/60 uppercase tracking-widest mb-1">Swing High (الأعلى)</p>
                  <p className="text-lg font-black text-red-400 font-mono">{priceStr(result.baseHigh.price)}</p>
                  <p className="text-xs text-white/30">شمعة رقم {result.baseHigh.index}</p>
                </div>
              </div>

              {/* Visual Matrix Chart */}
              <div className="rounded-2xl border border-amber-500/20 bg-[#111] p-6 flex flex-col shadow-[0_0_30px_rgba(245,158,11,0.08)] relative overflow-hidden">
                <p className="text-sm font-bold text-amber-500/50 uppercase tracking-widest mb-4 z-10">Time & Price Matrix Intersection — بيانات حقيقية</p>
                <ToolChart 
                  klines={klines} 
                  height={360} 
                  priceLines={chartLines} 
                  markers={chartMarkers} 
                />
              </div>

              {/* Insights Panel */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="flex flex-col p-5 rounded-xl border border-white/[0.05] bg-black/40"
                >
                  <span className="text-sm font-bold text-white/50 mb-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-cyan-400" /> نافذة زمنية قادمة
                  </span>
                  <span className="text-xl font-black text-cyan-400 font-mono tracking-tighter">
                    شمعة {result.nearestTimeWindow}
                  </span>
                  <span className="text-xs text-white/40 mt-1">ترقب الانعكاس حول هذا النطاق</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="flex flex-col p-5 rounded-xl border border-white/[0.05] bg-black/40"
                >
                  <span className="text-sm font-bold text-white/50 mb-2 flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-amber-400" /> هدف سعري قادم
                  </span>
                  <span className="text-xl font-black text-amber-400 font-mono tracking-tighter">
                    {priceStr(result.nearestPriceTarget)}
                  </span>
                  <span className="text-xs text-white/40 mt-1">الهدف الذهبي (0.618)</span>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="flex items-center gap-3 p-5 rounded-xl border border-rose-500/20 bg-rose-500/5"
              >
                <Focus className="w-8 h-8 text-rose-500/80 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-rose-500/80 mb-0.5">مناطق القتل (Kill Zones) المكتشفة</span>
                  <span className="text-base font-black text-rose-300">
                    يوجد {result.killZones.length} مناطق تقاطع زمنية وسعرية خطرة في المصفوفة.
                  </span>
                </div>
              </motion.div>

              {/* Verdict Card */}
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                <p className="text-sm font-black text-amber-400 uppercase tracking-widest mb-2">الدليل الإرشادي الفني</p>
                <div className="flex flex-col gap-1.5 text-sm text-white/70">
                  <p>📊 تحليل من <span className="font-black text-white">Swing Low عند {priceStr(result.baseLow.price)}</span> إلى <span className="font-black text-white">Swing High عند {priceStr(result.baseHigh.price)}</span></p>
                  <p>⏱️ الهدف الزمني القادم: <span className="font-black text-cyan-400">شمعة {result.nearestTimeWindow}</span></p>
                  <p>💰 الهدف السعري القادم (0.618): <span className="font-black text-amber-400 font-mono">{priceStr(result.nearestPriceTarget)}</span></p>
                  <p>🎯 عدد مناطق القتل: <span className="font-black text-red-400">{result.killZones.length} مناطق</span></p>
                  <p className="mt-1 pt-2 border-t border-white/10 text-white/50">
                    💡 عند تقاطع مستوى فيبوناتشي السعري مع النافذة الزمنية، تتشكّل منطقة قتل (Kill Zone) عالية الاحتمالية — راقب تصرف السعر عندها.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
