'use client';

/**
 * app/tools/unified-decision/page.tsx
 *
 * Unified Decision - 6 Tools (ط§ظ„ظ‚ط±ط§ط± ط§ظ„ظ…ظˆط­ط¯)
 * Features a Hexagonal Radar Chart visualizing the 6 indicators.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, ChevronDown, Activity, Info } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateUnifiedDecision, UnifiedDecisionResult } from '@/lib/algorithms/unifiedDecision';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';

export default function UnifiedDecisionPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  
  const [result, setResult] = useState<UnifiedDecisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  // â”€â”€ Guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tool = slugToTool('unified-decision-6-tools');
  if (!tool) return notFound();

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('ط£ط¯ط®ظ„ ط§ط³ظ… ط§ظ„ط£طµظ„.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), timeframe.toLowerCase(), 100);
      if (klines.length === 0) throw new Error('ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظ…طھط§ط­ط© ظ„ظ‡ط°ط§ ط§ظ„ط£طµظ„.');
      
      const res = calculateUnifiedDecision(symbol.toUpperCase().trim(), klines);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط¬ظ„ط¨ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط£ظˆ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-amber-400/70 tracking-widest uppercase border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full">
            Consensus Engine
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          ط§ظ„ظ‚ط±ط§ط± ط§ظ„ظ…ظˆط­ط¯ (6 ط£ط¯ظˆط§طھ)
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظ†ط¸ط§ظ… طھط¬ظ…ظٹط¹ظٹ ظ„ظ‚ظٹط§ط³ ط§ظ„ط²ط®ظ… ظˆط§ظ„ط§طھط¬ط§ظ‡ ط¹ط¨ط± 6 ظ…ط¤ط´ط±ط§طھ ظ…ط³طھظ‚ظ„ط©
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* â”€â”€ Input Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">ط±ظ…ط² ط§ظ„ط£طµظ„</label>
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                placeholder="BTCUSDT"
                className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 transition-colors"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">ط§ظ„ط¥ط·ط§ط± ط§ظ„ط²ظ…ظ†ظٹ</label>
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={e => setTimeframe(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 appearance-none focus:outline-none focus:border-amber-500/40 transition-colors cursor-pointer"
                  dir="ltr"
                >
                  <option value="15m">15m</option>
                  <option value="1h">1H</option>
                  <option value="4h">4H</option>
                  <option value="1d">1D</option>
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
                  <p className="text-base text-red-300">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-lg tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #78350f, #451a03)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: !loading ? '0 0 20px rgba(245, 158, 11, 0.2)' : 'none'
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'ط¬ط§ط±ظچ ط§ظ„طھط­ظ„ظٹظ„...' : 'طھط´ط؛ظٹظ„ ط§ظ„ظ‚ط±ط§ط± ط§ظ„ظ…ظˆط­ط¯'}
          </button>
        </div>

        {/* â”€â”€ Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="flex flex-col gap-6"
            >
              {/* Verdict Header */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none transition-colors duration-1000"
                  style={{ 
                    background: `radial-gradient(circle at center, ${
                      result.verdictEn === 'BULL' ? '#10b981' : result.verdictEn === 'BEAR' ? '#ef4444' : '#9ca3af'
                    } 0%, transparent 70%)` 
                  }}
                />
                <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1 z-10">ط§ظ„ط«ظ‚ط© ط§ظ„ظ†ظ‡ط§ط¦ظٹط© (Confidence)</p>
                <div className="flex items-baseline gap-3 z-10">
                  <span className={`text-5xl font-black font-mono tracking-tighter ${
                    result.verdictEn === 'BULL' ? 'text-emerald-400' : result.verdictEn === 'BEAR' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {result.confidencePct}%
                  </span>
                  <span className={`text-lg font-black tracking-widest ${
                    result.verdictEn === 'BULL' ? 'text-emerald-500' : result.verdictEn === 'BEAR' ? 'text-red-500' : 'text-gray-500'
                  }`} style={{ textShadow: `0 0 15px currentColor` }}>
                    {result.verdictEn}
                  </span>
                </div>
              </div>

              {/* Radar Chart Visual */}
              <RadarChart result={result} animated={animated} />

              {/* Breakout Grid */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                {result.indicators.map((ind, i) => {
                  let badgeColor = "bg-gray-500/20 text-gray-400 border-gray-500/30";
                  if (ind.score === 1) badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                  if (ind.score === -1) badgeColor = "bg-red-500/20 text-red-400 border-red-500/30";
                  
                  return (
                    <motion.div 
                      key={ind.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * i, type: "spring", stiffness: 120 }}
                      className="rounded-xl border border-white/[0.05] bg-black/40 p-3 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-white/40 uppercase truncate" dir="ltr">{ind.nameEn}</span>
                        <div className={`px-1.5 py-0.5 rounded border text-sm font-bold tracking-widest ${badgeColor}`}>
                          {ind.label}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-white/80">{ind.nameAr}</span>
                      <span className="text-sm text-white/50 mt-1">{ind.valueText}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* AI Summary Box */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="rounded-xl border-t-2 border-t-amber-500 border-white/[0.05] bg-amber-500/[0.03] p-6 text-right shadow-inner mb-2"
              >
                <div className="flex items-center gap-3 mb-2 justify-end">
                  <Activity className="w-6 h-6 text-amber-500" />
                  <span className="text-sm font-black text-amber-500 tracking-widest uppercase">ظ…ظ„ط®طµ ط§ظ„ط°ظƒط§ط، ط§ظ„ط§طµط·ظ†ط§ط¹ظٹ</span>
                </div>
                <p className="text-sm text-amber-50 font-medium leading-relaxed">
                  {result.summaryAr}
                </p>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// â”€â”€ Radar Chart Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RadarChart({ result, animated }: { result: UnifiedDecisionResult, animated: boolean }) {
  const size = 300;
  const center = size / 2;
  const radius = 100;
  
  // Outer hexagon coordinates
  const outerPoints = Array.from({ length: 6 }).map((_, i) => {
    const angle = i * (Math.PI * 2) / 6 - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      labelX: center + (radius + 25) * Math.cos(angle),
      labelY: center + (radius + 25) * Math.sin(angle),
      label: result.indicators[i].nameEn,
    };
  });

  // Inner webs (Grid)
  const webs = [0.33, 0.66, 1].map(rScale => {
    const r = radius * rScale;
    const pts = Array.from({ length: 6 }).map((_, i) => {
      const angle = i * (Math.PI * 2) / 6 - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    });
    return pts.join(' ');
  });

  // Data Polygon calculation
  // score: -1 -> 33% radius (inner core), 0 -> 66% radius, +1 -> 100% radius (outer edge)
  const dataPoints = result.indicators.map((ind, i) => {
    const rScale = ind.score === 1 ? 1 : ind.score === 0 ? 0.66 : 0.33;
    const r = radius * rScale;
    const angle = i * (Math.PI * 2) / 6 - Math.PI / 2;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  });

  const dataPolygonString = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
  
  const polygonColor = result.verdictEn === 'BULL' ? '#10b981' : result.verdictEn === 'BEAR' ? '#ef4444' : '#9ca3af';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] flex items-center justify-center p-6 shadow-xl"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Background Grids */}
        {webs.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        {/* Spokes */}
        {outerPoints.map((p, i) => (
          <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}

        {/* Data Polygon */}
        <motion.polygon
          initial={{ opacity: 0 }}
          animate={animated ? { opacity: 1 } : { opacity: 0 }}
          points={dataPolygonString}
          fill={`${polygonColor}40`}
          stroke={polygonColor}
          strokeWidth={2}
          style={{ transformOrigin: "center" }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* Data Points (Dots) */}
        {dataPoints.map((p, i) => (
          <motion.circle
            key={i}
            initial={{ r: 0 }}
            animate={animated ? { r: 4 } : { r: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            cx={p.x}
            cy={p.y}
            fill={polygonColor}
          />
        ))}

        {/* Labels */}
        {outerPoints.map((p, i) => (
          <text
            key={i}
            x={p.labelX}
            y={p.labelY}
            fill="rgba(255,255,255,0.4)"
            fontSize="9"
            fontFamily="monospace"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {p.label}
          </text>
        ))}
      </svg>
    </motion.div>
  );
}
