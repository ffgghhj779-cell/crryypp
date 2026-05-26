'use client';

/**
 * app/tools/pattern-scanner/page.tsx
 *
 * Classic Chart Patterns Scanner (ظ…ظƒطھط´ظپ ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ظƒظ„ط§ط³ظٹظƒظٹط© ط§ظ„ط£ظˆطھظˆظ…ط§طھظٹظƒظٹ)
 * Detects and visualizes classic patterns like Head & Shoulders and Triangles.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Eye, Rocket, Crosshair, Target, ShieldAlert, Zap } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { scanClassicPatterns, PatternResult, PatternPoint } from '@/lib/algorithms/patternScanner';
import { notFound } from 'next/navigation';

export default function PatternScannerPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PatternResult | null>(null);
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('pattern-scanner');
  if (!tool) return notFound();

  const handleScan = () => {
    setError('');
    if (!symbol.trim()) return setError('ط£ط¯ط®ظ„ ط§ط³ظ… ط§ظ„ط£طµظ„.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      setTimeout(() => {
        const res = scanClassicPatterns([]); // Mock array of ZigZag pivots
        setResult(res);
        setLoading(false);
        setTimeout(() => setAnimated(true), 100);
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط§ظ„ظ…ط³ط­.');
      setLoading(false);
    }
  };

  const priceStr = (val: number) => {
    return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Eye className="w-3 h-3" /> Classic Patterns
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          ظ…ظƒطھط´ظپ ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ظƒظ„ط§ط³ظٹظƒظٹط©
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ط§ظ„ط±طµط¯ ط§ظ„ط£ظˆطھظˆظ…ط§طھظٹظƒظٹ ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ظ…ط«ظ„ط«ط§طھ ظˆط§ظ„ط±ط£ط³ ظˆط§ظ„ظƒطھظپظٹظ† ظˆط§ظ„ظ‚ظ…ظ… ط§ظ„ظ…ط²ط¯ظˆط¬ط©
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        
        {/* Control Panel */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white/50 uppercase tracking-widest">ط±ظ…ط² ط§ظ„ط£طµظ„ ط§ظ„ظ…ط§ظ„ظٹ</label>
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              placeholder="BTCUSDT"
              className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 placeholder:text-white/20 focus:outline-none focus:border-orange-500/40 transition-colors"
              dir="ltr"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-4.5 mt-2">
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <p className="text-base text-red-300">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-lg tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #7c2d12, #431407)' : 'linear-gradient(135deg, #ea580c, #9a3412)',
              boxShadow: !loading ? '0 0 20px rgba(234, 88, 12, 0.25)' : 'none'
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'ط¬ط§ط±ظٹ ط§ظ„ظپط­طµ ط§ظ„ظ…طھظ‚ط¯ظ…...' : 'ظ…ط³ط­ ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ظƒظ„ط§ط³ظٹظƒظٹط©'}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              key={result.patternType}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="flex flex-col gap-6"
            >
              
              {/* Status Card */}
              <div className={`rounded-xl border p-6 flex flex-col gap-3 shadow-lg ${
                result.isBullish ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> طھظ… ط§ظ„طھط¹ط±ظپ ط¹ظ„ظ‰ ظ‡ظٹظƒظ„
                    </span>
                    <span className={`text-lg font-black tracking-widest ${
                      result.isBullish ? 'text-emerald-400' : 'text-orange-400'
                    }`}>
                      {result.patternNameAr}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 py-4 rounded-lg bg-black/40 border border-white/[0.05]">
                  <Rocket className={`w-6 h-6 ${result.isBullish ? 'text-emerald-500' : 'text-orange-500'}`} />
                  <span className="text-base font-bold text-white/80">{result.statusAr}</span>
                </div>
              </div>

              {/* Visual Pattern Chart */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-6 flex flex-col shadow-[0_0_30px_rgba(234,88,12,0.1)] relative overflow-hidden h-[420px]">
                <p className="text-sm font-bold text-orange-500/50 uppercase tracking-widest mb-2 z-10">{result.patternNameEn} Visualizer</p>
                <div className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }} />
                
                <PatternSVGChart result={result} animated={animated} />
              </div>

              {/* Trade Parameters Table */}
              <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md overflow-hidden">
                <div className="bg-white/[0.02] border-b border-white/[0.05] p-3">
                  <span className="text-sm font-bold text-white/70 uppercase tracking-widest flex items-center gap-3">
                    <Crosshair className="w-6 h-6 text-orange-400" /> ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„طµظپظ‚ط© ط§ظ„ظ…ظ‚طھط±ط­ط©
                  </span>
                </div>
                
                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/[0.05]">
                  <div className="flex flex-col p-6 gap-1">
                    <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Entry Trigger (ط§ظ„ط§ط®طھط±ط§ظ‚)</span>
                    <span className="text-lg font-black text-white font-mono">${priceStr(result.entryTrigger)}</span>
                  </div>
                  <div className="flex flex-col p-6 gap-1">
                    <span className="text-sm font-bold text-red-500/70 uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Stop Loss (ط§ظ„ط¥ظ„ط؛ط§ط،)</span>
                    <span className="text-lg font-black text-red-400 font-mono">${priceStr(result.stopLoss)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/[0.05] border-t border-white/[0.05] bg-emerald-500/5">
                  <div className="flex flex-col p-6 gap-1 border-emerald-500/10">
                    <span className="text-sm font-bold text-emerald-500/70 uppercase tracking-widest flex items-center gap-1"><Target className="w-3 h-3" /> Target 1 (ظ‡ط¯ظپ ط£ظˆظ„)</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">${priceStr(result.target1)}</span>
                  </div>
                  <div className="flex flex-col p-6 gap-1 border-emerald-500/10">
                    <span className="text-sm font-bold text-emerald-500/70 uppercase tracking-widest flex items-center gap-1"><Target className="w-3 h-3" /> Target 2 (ظ‡ط¯ظپ ط«ط§ظ†ظٹ)</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">${priceStr(result.target2)}</span>
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

// â”€â”€â”€ SVG Chart Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PatternSVGChart({ result, animated }: { result: PatternResult, animated: boolean }) {
  const points = result.points;
  
  const minPrice = Math.min(...points.map(p => p.price));
  const maxPrice = Math.max(...points.map(p => p.price));
  const priceRange = maxPrice - minPrice || 1;
  const padding = priceRange * 0.2;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;
  const yRange = yMax - yMin;

  const width = 800;
  const height = 300;

  // Assuming X index is up to 100 max
  const scaleX = (index: number) => (index / 100) * width;
  const scaleY = (price: number) => height - ((price - yMin) / yRange) * height;

  const pts = points.map(p => ({ ...p, x: scaleX(p.index), y: scaleY(p.price) }));
  
  // Wave path
  const wavePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg className="w-full h-full z-10" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <filter id="patternGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Raw Price Wave */}
      <motion.path 
        d={wavePath} 
        fill="none" 
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="3" 
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={animated ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* Triangle Pattern Overlays */}
      {result.patternType === 'TRIANGLE' && result.triangleUpper && result.triangleLower && animated && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}>
          <line 
            x1={scaleX(result.triangleUpper[0].index)} y1={scaleY(result.triangleUpper[0].price)}
            x2={scaleX(result.triangleUpper[1].index)} y2={scaleY(result.triangleUpper[1].price)}
            stroke="#10b981" strokeWidth="2" strokeDasharray="6,6" filter="url(#patternGlow)"
          />
          <line 
            x1={scaleX(result.triangleLower[0].index)} y1={scaleY(result.triangleLower[0].price)}
            x2={scaleX(result.triangleLower[1].index)} y2={scaleY(result.triangleLower[1].price)}
            stroke="#10b981" strokeWidth="2" strokeDasharray="6,6" filter="url(#patternGlow)"
          />
        </motion.g>
      )}

      {/* Head & Shoulders Overlays */}
      {result.patternType === 'HEAD_AND_SHOULDERS' && animated && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}>
          
          {/* Neckline */}
          {result.necklineStart && result.necklineEnd && (
            <line 
              x1={scaleX(result.necklineStart.index)} y1={scaleY(result.necklineStart.price)}
              x2={scaleX(result.necklineEnd.index)} y2={scaleY(result.necklineEnd.price)}
              stroke="#f97316" strokeWidth="3" strokeDasharray="10,5" filter="url(#patternGlow)"
            />
          )}

          {/* Circles for LS, Head, RS */}
          {result.circles?.map((c, i) => (
            <g key={i}>
              <circle 
                cx={scaleX(c.index)} cy={scaleY(c.price)} 
                r="18" fill="none" stroke="#f97316" strokeWidth="2" filter="url(#patternGlow)"
              />
              {c.label && (
                <text x={scaleX(c.index)} y={scaleY(c.price) - 25} fill="#f97316" fontSize="14" fontWeight="bold" textAnchor="middle">
                  {c.label}
                </text>
              )}
            </g>
          ))}
        </motion.g>
      )}

      {/* Node Markers on Wave */}
      <AnimatePresence>
        {animated && pts.map((p, i) => (
          <motion.g 
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.5 + (i * 0.1), type: 'spring' }}
          >
            <circle cx={p.x} cy={p.y} r="4" fill="#111" stroke="#fff" strokeWidth="2" />
          </motion.g>
        ))}
      </AnimatePresence>

    </svg>
  );
}
