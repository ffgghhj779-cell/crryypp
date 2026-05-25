'use client';

/**
 * app/tools/fibonacci-matrix/page.tsx
 *
 * Fibonacci Time & Price Matrix (مصفوفة فيبوناتشي الزمنية والسعرية)
 * Visualizes intersecting Fibonacci Time and Price levels to find PRZ Kill Zones.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Grid, Clock, Target, Focus } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateFibMatrix, FibMatrixResult, Pivot } from '@/lib/algorithms/fibMatrix';
import { notFound } from 'next/navigation';

export default function FibMatrixPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FibMatrixResult | null>(null);
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('fibonacci-matrix');
  if (!tool) return notFound();

  const handleCalculate = () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      // Deterministic Mock Input for Visuals
      const swingLow: Pivot = { price: 60000, index: 10 };
      const swingHigh: Pivot = { price: 68000, index: 30 }; // Bullish impulse of 8k, took 20 bars
      const currentBarIndex = 35; // We are slightly past the high

      setTimeout(() => {
        const res = calculateFibMatrix(swingHigh, swingLow, currentBarIndex);
        setResult(res);
        setLoading(false);
        setTimeout(() => setAnimated(true), 100);
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء حساب المصفوفة.');
      setLoading(false);
    }
  };

  const priceStr = (val: number) => {
    return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-amber-500/70 tracking-widest uppercase border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Grid className="w-3 h-3" /> Matrix Projections
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          مصفوفة فيبوناتشي (زمن وسعر)
        </h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          إسقاط تقاطعات السعر والزمن لتحديد مناطق القتل (Kill Zones)
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5">
        
        {/* Control Panel */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-4 shadow-xl shadow-black/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">رمز الأصل المالي</label>
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              placeholder="BTCUSDT"
              className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-sm px-4 py-3 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 transition-colors"
              dir="ltr"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 mt-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 font-black text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #78350f, #451a03)' : 'linear-gradient(135deg, #f59e0b, #b45309)',
              boxShadow: !loading ? '0 0 20px rgba(245, 158, 11, 0.25)' : 'none'
            }}
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-4 h-4" />}
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
              className="flex flex-col gap-4"
            >
              
              {/* Visual Matrix Chart (Core Feature) */}
              <div className="rounded-2xl border border-amber-500/20 bg-[#111] p-4 flex flex-col shadow-[0_0_30px_rgba(245,158,11,0.08)] relative overflow-hidden h-80">
                <p className="text-[10px] font-bold text-amber-500/50 uppercase tracking-widest mb-2 z-10">Time & Price Matrix Intersection</p>
                
                <FibMatrixSVGChart result={result} animated={animated} />
              </div>

              {/* Insights Panel */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Nearest Time Target */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="flex flex-col p-4 rounded-xl border border-white/[0.05] bg-black/40"
                >
                  <span className="text-[10px] font-bold text-white/50 mb-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-cyan-400" /> نافذة زمنية قادمة
                  </span>
                  <span className="text-xl font-black text-cyan-400 font-mono tracking-tighter">
                    شمعة {result.nearestTimeWindow}
                  </span>
                  <span className="text-[9px] text-white/40 mt-1">ترقب الانعكاس حول هذا النطاق</span>
                </motion.div>

                {/* 2. Nearest Price Target */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="flex flex-col p-4 rounded-xl border border-white/[0.05] bg-black/40"
                >
                  <span className="text-[10px] font-bold text-white/50 mb-2 flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-amber-400" /> هدف سعري قادم
                  </span>
                  <span className="text-xl font-black text-amber-400 font-mono tracking-tighter">
                    ${priceStr(result.nearestPriceTarget)}
                  </span>
                  <span className="text-[9px] text-white/40 mt-1">الهدف الذهبي (0.618)</span>
                </motion.div>
              </div>

              <motion.div 
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5"
                >
                  <Focus className="w-8 h-8 text-rose-500/80" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-rose-500/80 mb-0.5">مناطق القتل (Kill Zones) المكتشفة</span>
                    <span className="text-[13px] font-black text-rose-300">
                      يوجد {result.killZones.length} مناطق تقاطع زمنية وسعرية خطرة في المصفوفة.
                    </span>
                  </div>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// ─── SVG Chart Component ────────────────────────────────────────────────────────

function FibMatrixSVGChart({ result, animated }: { result: FibMatrixResult, animated: boolean }) {
  
  // Find limits to establish viewbox scaling
  const allPrices = [
    result.baseHigh.price,
    result.baseLow.price,
    ...result.priceLevels.map(p => p.value)
  ];
  
  const allTimes = [
    result.baseHigh.index,
    result.baseLow.index,
    ...result.timeLevels.map(t => t.value)
  ];

  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;
  const pricePadding = priceRange * 0.1;
  const yMin = minPrice - pricePadding;
  const yMax = maxPrice + pricePadding;
  const yRange = yMax - yMin;

  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const timeRange = maxTime - minTime || 1;
  const timePadding = timeRange * 0.1;
  const xMin = minTime - timePadding;
  const xMax = maxTime + timePadding;
  const xRange = xMax - xMin;

  const width = 800;
  const height = 400;

  // Scale functions
  const scaleX = (index: number) => ((index - xMin) / xRange) * width;
  const scaleY = (price: number) => height - ((price - yMin) / yRange) * height;

  return (
    <svg className="w-full h-full z-10 absolute inset-0 pt-8 px-2" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <filter id="matrixGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="killZoneGlow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Impulse Line Reference */}
      <motion.line 
        x1={scaleX(result.baseLow.index)} 
        y1={scaleY(result.baseLow.price)} 
        x2={scaleX(result.baseHigh.index)} 
        y2={scaleY(result.baseHigh.price)} 
        stroke="rgba(255,255,255,0.2)" 
        strokeWidth="2" 
        strokeDasharray="10,10"
        initial={{ pathLength: 0 }}
        animate={animated ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1 }}
      />

      {/* Horizontal Price Levels */}
      {result.priceLevels.map((p, i) => {
        const y = scaleY(p.value);
        return (
          <motion.g key={`p-${i}`} initial={{ opacity: 0 }} animate={animated ? { opacity: 1 } : { opacity: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
            <line x1="0" y1={y} x2={width} y2={y} stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" filter="url(#matrixGlow)" />
            <rect x="0" y={y - 10} width="60" height="20" fill="rgba(245, 158, 11, 0.1)" />
            <text x="5" y={y + 4} fill="#fcd34d" fontSize="12" fontFamily="monospace" fontWeight="bold">{p.ratio}</text>
          </motion.g>
        );
      })}

      {/* Vertical Time Levels */}
      {result.timeLevels.map((t, i) => {
        const x = scaleX(t.value);
        return (
          <motion.g key={`t-${i}`} initial={{ opacity: 0 }} animate={animated ? { opacity: 1 } : { opacity: 0 }} transition={{ delay: 1 + i * 0.1 }}>
            <line x1={x} y1="0" x2={x} y2={height} stroke="rgba(34, 211, 238, 0.4)" strokeWidth="1" filter="url(#matrixGlow)" />
            <rect x={x - 20} y={height - 20} width="40" height="20" fill="rgba(34, 211, 238, 0.1)" />
            <text x={x} y={height - 5} fill="#67e8f9" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{t.ratio}</text>
          </motion.g>
        );
      })}

      {/* PRZ Kill Zones (Intersections) */}
      <AnimatePresence>
        {animated && result.killZones.map((kz, i) => {
          const x = scaleX(kz.timeIndex);
          const y = scaleY(kz.priceLevel);
          const boxSize = 40;

          return (
            <motion.g 
              key={`kz-${i}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.8] }}
              transition={{ delay: 2 + i * 0.2, duration: 0.8 }}
            >
              <rect 
                x={x - boxSize/2} 
                y={y - boxSize/2} 
                width={boxSize} 
                height={boxSize} 
                fill="rgba(225, 29, 72, 0.3)" 
                stroke="#fb7185" 
                strokeWidth="2"
                filter="url(#killZoneGlow)"
                rx="8"
              />
              <circle cx={x} cy={y} r="3" fill="#fff" />
              <text x={x} y={y - boxSize/2 - 5} fill="#fb7185" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                KILL ZONE
              </text>
            </motion.g>
          );
        })}
      </AnimatePresence>

    </svg>
  );
}
