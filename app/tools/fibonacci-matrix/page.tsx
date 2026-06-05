'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Grid, Clock, Target, Focus } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateFibMatrix, FibMatrixResult, Pivot } from '@/lib/algorithms/fibMatrix';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';

export default function FibMatrixPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FibMatrixResult | null>(null);
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('fibonacci-matrix');
  if (!tool) return notFound();

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
              <div className="rounded-2xl border border-amber-500/20 bg-[#111] p-6 flex flex-col shadow-[0_0_30px_rgba(245,158,11,0.08)] relative overflow-hidden h-[440px]">
                <p className="text-sm font-bold text-amber-500/50 uppercase tracking-widest mb-2 z-10">Time & Price Matrix Intersection — بيانات حقيقية</p>
                <FibMatrixSVGChart result={result} animated={animated} />
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

// ─── SVG Chart Component ──────────────────────────────────────────────────────

function FibMatrixSVGChart({ result, animated }: { result: FibMatrixResult; animated: boolean }) {
  const allPrices = [
    result.baseHigh.price,
    result.baseLow.price,
    ...result.priceLevels.map(p => p.value),
  ];
  const allTimes = [
    result.baseHigh.index,
    result.baseLow.index,
    ...result.timeLevels.map(t => t.value),
  ];

  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;
  const pricePad = priceRange * 0.1;
  const yMin = minPrice - pricePad;
  const yMax = maxPrice + pricePad;
  const yRange = yMax - yMin;

  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const timeRange = maxTime - minTime || 1;
  const timePad = timeRange * 0.1;
  const xMin = minTime - timePad;
  const xMax = maxTime + timePad;
  const xRange = xMax - xMin;

  const width = 800;
  const height = 400;

  const scaleX = (index: number) => ((index - xMin) / xRange) * width;
  const scaleY = (price: number) => height - ((price - yMin) / yRange) * height;

  return (
    <svg className="w-full h-full z-10 absolute inset-0 pt-8 px-2" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <filter id="matrixGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="killZoneGlow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Impulse Reference Line */}
      <motion.line
        x1={scaleX(result.baseLow.index)} y1={scaleY(result.baseLow.price)}
        x2={scaleX(result.baseHigh.index)} y2={scaleY(result.baseHigh.price)}
        stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="10,10"
        initial={{ pathLength: 0 }} animate={animated ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1 }}
      />

      {/* Horizontal Price Levels */}
      {result.priceLevels.map((p, i) => {
        const y = scaleY(p.value);
        return (
          <motion.g key={`p-${i}`} initial={{ opacity: 0 }} animate={animated ? { opacity: 1 } : { opacity: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
            <line x1="0" y1={y} x2={width} y2={y} stroke="rgba(245,158,11,0.4)" strokeWidth="1" filter="url(#matrixGlow)" />
            <rect x="0" y={y - 10} width="55" height="20" fill="rgba(245,158,11,0.1)" />
            <text x="5" y={y + 4} fill="#fcd34d" fontSize="12" fontFamily="monospace" fontWeight="bold">{p.ratio}</text>
          </motion.g>
        );
      })}

      {/* Vertical Time Levels */}
      {result.timeLevels.map((t, i) => {
        const x = scaleX(t.value);
        return (
          <motion.g key={`t-${i}`} initial={{ opacity: 0 }} animate={animated ? { opacity: 1 } : { opacity: 0 }} transition={{ delay: 1 + i * 0.1 }}>
            <line x1={x} y1="0" x2={x} y2={height} stroke="rgba(34,211,238,0.4)" strokeWidth="1" filter="url(#matrixGlow)" />
            <rect x={x - 20} y={height - 20} width="40" height="20" fill="rgba(34,211,238,0.1)" />
            <text x={x} y={height - 5} fill="#67e8f9" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{t.ratio}</text>
          </motion.g>
        );
      })}

      {/* Kill Zones */}
      <AnimatePresence>
        {animated && result.killZones.map((kz, i) => {
          const x = scaleX(kz.timeIndex);
          const y = scaleY(kz.priceLevel);
          const boxSize = 40;
          return (
            <motion.g key={`kz-${i}`}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.8] }}
              transition={{ delay: 2 + i * 0.2, duration: 0.8 }}>
              <rect x={x - boxSize / 2} y={y - boxSize / 2} width={boxSize} height={boxSize}
                fill="rgba(225,29,72,0.3)" stroke="#fb7185" strokeWidth="2"
                filter="url(#killZoneGlow)" rx="8" />
              <circle cx={x} cy={y} r="3" fill="#fff" />
              <text x={x} y={y - boxSize / 2 - 5} fill="#fb7185" fontSize="10"
                fontFamily="monospace" fontWeight="bold" textAnchor="middle">KILL ZONE</text>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
