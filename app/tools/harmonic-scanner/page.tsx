'use client';

/**
 * app/tools/harmonic-scanner/page.tsx
 *
 * Harmonic Pattern Scanner (ماسح الهارمونيك الأوتوماتيكي)
 * Detects and visualizes geometric harmonic setups (XABCD) using ZigZag data.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Triangle, CheckCircle, Crosshair, Target, ShieldAlert } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { scanHarmonicPatterns, HarmonicPatternResult, HarmonicPoint } from '@/lib/algorithms/harmonicScanner';
import { notFound } from 'next/navigation';

export default function HarmonicScannerPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<HarmonicPatternResult | null>(null);
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('harmonic-scanner');
  if (!tool) return notFound();

  const handleScan = () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      // Simulate scanning delay
      setTimeout(() => {
        const res = scanHarmonicPatterns([]); // Mocking empty ZigZag data for now
        setResult(res);
        setLoading(false);
        setTimeout(() => setAnimated(true), 100);
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء المسح.');
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
          <span className="text-[9px] font-black text-fuchsia-500/70 tracking-widest uppercase border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Triangle className="w-3 h-3" /> Geometric Engine
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          ماسح الهارمونيك الأوتوماتيكي
        </h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          رصد النماذج التوافقية (XABCD) وتحديد مناطق الانعكاس (PRZ)
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
              className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-sm px-4 py-3 placeholder:text-white/20 focus:outline-none focus:border-fuchsia-500/40 transition-colors"
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
            onClick={handleScan}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 font-black text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #701a75, #4a044e)' : 'linear-gradient(135deg, #d946ef, #a21caf)',
              boxShadow: !loading ? '0 0 20px rgba(217, 70, 239, 0.25)' : 'none'
            }}
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {loading ? 'جاري المسح الهندسي...' : 'تشغيل ماسح الهارمونيك'}
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
              {/* Pattern Match Details Card */}
              <div className={`rounded-xl border p-4 flex items-center justify-between shadow-lg ${
                result.isBullish ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3" /> تم رصد تطابق هندسي
                  </span>
                  <span className={`text-sm font-black tracking-widest ${
                    result.isBullish ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    نموذج {result.patternNameAr} {result.isBullish ? 'صاعد (Bullish)' : 'هابط (Bearish)'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">معدل التوافق</span>
                  <span className="text-xl font-black text-white font-mono">{result.accuracyPct}%</span>
                </div>
              </div>

              {/* Geometric Visual Chart */}
              <div className="rounded-2xl border border-fuchsia-500/20 bg-[#111] p-4 flex flex-col shadow-[0_0_30px_rgba(217,70,239,0.1)] relative overflow-hidden h-72">
                <p className="text-[10px] font-bold text-fuchsia-400/50 uppercase tracking-widest mb-2 z-10">Geometric Scanner Map</p>
                <div className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }} />
                
                <HarmonicSVGChart result={result} animated={animated} />
              </div>

              {/* Trade Execution Box */}
              <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5">
                <span className="text-[11px] font-bold text-white/70 uppercase tracking-widest border-b border-white/[0.05] pb-2 mb-1">
                  خطة التداول الأوتوماتيكية (Execution Box)
                </span>
                
                {/* PRZ Zone */}
                <div className="flex justify-between items-center p-3 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-fuchsia-400 uppercase tracking-widest flex items-center gap-1.5"><Crosshair className="w-3 h-3" /> PRZ Entry Zone</span>
                    <span className="text-xs font-bold text-fuchsia-200">منطقة الانعكاس المحتملة</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-white font-mono">${priceStr(result.przEnd)}</span>
                    <span className="text-sm font-black text-white font-mono">${priceStr(result.przStart)}</span>
                  </div>
                </div>

                {/* SL & TPs */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div className="flex flex-col p-3 rounded-lg bg-red-500/5 border border-red-500/10 gap-1.5">
                    <span className="text-[10px] font-mono text-red-500/70 uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Stop Loss</span>
                    <span className="text-lg font-black text-red-400 font-mono">${priceStr(result.stopLoss)}</span>
                  </div>
                  <div className="flex flex-col p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 gap-1.5">
                    <span className="text-[10px] font-mono text-emerald-500/70 uppercase tracking-widest flex items-center gap-1"><Target className="w-3 h-3" /> Targets</span>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-white/40 font-mono">TP1</span>
                      <span className="text-xs font-black text-emerald-400 font-mono">${priceStr(result.tp1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-white/40 font-mono">TP2</span>
                      <span className="text-xs font-black text-emerald-400 font-mono">${priceStr(result.tp2)}</span>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// ─── SVG Chart Component ────────────────────────────────────────────────────────

function HarmonicSVGChart({ result, animated }: { result: HarmonicPatternResult, animated: boolean }) {
  const points = result.points;
  const isBull = result.isBullish;
  
  // Find min/max for scaling
  const minPrice = Math.min(...points.map(p => p.price));
  const maxPrice = Math.max(...points.map(p => p.price));
  const priceRange = maxPrice - minPrice || 1;
  const padding = priceRange * 0.2; // 20% padding
  
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;
  const yRange = yMax - yMin;

  const width = 800;
  const height = 300;

  // Scale functions
  const scaleX = (index: number) => (index / 60) * width; // Total index range is 0 to 60
  const scaleY = (price: number) => height - ((price - yMin) / yRange) * height;

  const pts = points.map(p => ({ ...p, x: scaleX(p.index), y: scaleY(p.price) }));
  
  const x = pts[0];
  const a = pts[1];
  const b = pts[2];
  const c = pts[3];
  const d = pts[4];

  const primaryColor = isBull ? '#10b981' : '#f97316'; // Emerald for Bullish, Orange for Bearish
  const fillAlpha = 'rgba(217, 70, 239, 0.15)'; // Fuchsia tint for triangles

  return (
    <svg className="w-full h-full z-10" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <filter id="harmonicGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Triangles Fill */}
      {animated && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.5 }}>
          <polygon points={`${x.x},${x.y} ${a.x},${a.y} ${b.x},${b.y}`} fill={fillAlpha} stroke="none" />
          <polygon points={`${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`} fill={fillAlpha} stroke="none" />
        </motion.g>
      )}

      {/* Harmonic Outline Path X-A-B-C-D */}
      <motion.path 
        d={`M ${x.x} ${x.y} L ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y}`} 
        fill="none" 
        stroke={primaryColor}
        strokeWidth="3" 
        strokeLinejoin="round"
        filter="url(#harmonicGlow)"
        initial={{ pathLength: 0 }}
        animate={animated ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* Connect X to B, and B to D, and X to A internally? Usually we connect XB and BD in harmonic drawings */}
      <motion.path 
        d={`M ${x.x} ${x.y} L ${b.x} ${b.y} L ${d.x} ${d.y}`} 
        fill="none" 
        stroke={primaryColor}
        strokeWidth="1" 
        strokeDasharray="5,5"
        initial={{ opacity: 0 }}
        animate={animated ? { opacity: 0.5 } : { opacity: 0 }}
        transition={{ duration: 1, delay: 1.5 }}
      />

      {/* Points and Labels */}
      <AnimatePresence>
        {animated && pts.map((p, i) => (
          <motion.g 
            key={p.label}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.5 + (i * 0.1), type: 'spring' }}
          >
            <circle cx={p.x} cy={p.y} r="5" fill="#111" stroke={primaryColor} strokeWidth="2" />
            <text 
              x={p.x} 
              y={p.label === 'A' || p.label === 'C' ? p.y - 12 : p.y + 20} 
              fontSize="14" 
              fontWeight="bold" 
              fill="#fff" 
              textAnchor="middle"
            >
              {p.label}
            </text>
          </motion.g>
        ))}
      </AnimatePresence>

      {/* Ratios */}
      <AnimatePresence>
        {animated && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
            <RatioLabel x={(x.x + b.x)/2} y={(x.y + b.y)/2} val={result.ratios.xb} />
            <RatioLabel x={(a.x + c.x)/2} y={(a.y + c.y)/2} val={result.ratios.ac} />
            <RatioLabel x={(b.x + d.x)/2} y={(b.y + d.y)/2} val={result.ratios.bd} />
            {/* XD Ratio near D */}
            <RatioLabel x={(x.x + d.x)/2} y={(x.y + d.y)/2 + 20} val={result.ratios.xd} color="#d946ef" />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

function RatioLabel({ x, y, val, color = '#6b7280' }: { x: number, y: number, val: number, color?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#000" stroke={color} strokeWidth="1" opacity="0.8" />
      <text x="0" y="4" fontSize="10" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="monospace">
        {val}
      </text>
    </g>
  );
}
