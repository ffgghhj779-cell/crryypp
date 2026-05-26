'use client';

/**
 * app/tools/ema-ribbon/page.tsx
 *
 * EMA Ribbon (شريط المتوسطات)
 * Visual tool for trend strength analysis using 8 EMAs.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, ChevronDown, Activity, TrendingUp } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { analyzeEmaRibbon, EmaRibbonResult } from '@/lib/algorithms/emaRibbon';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';

export default function EmaRibbonPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  
  const [result, setResult] = useState<EmaRibbonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  // ── Guard ──────────────────────────────────────────────────────────────────
  const tool = slugToTool('ema-ribbon');
  if (!tool) return notFound();

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), timeframe.toLowerCase(), 100);
      if (klines.length === 0) throw new Error('لا توجد بيانات متاحة لهذا الأصل.');
      
      const res = analyzeEmaRibbon(symbol.toUpperCase().trim(), klines);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء جلب البيانات أو المعالجة.');
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
          <span className="text-sm font-black text-emerald-400/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full">
            Trend Strength
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          شريط المتوسطات (EMA Ribbon)
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          تحليل قوة الاتجاه بناءً على 8 متوسطات أسية (أرقام فيبوناتشي)
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* ── Input Form ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">رمز الأصل</label>
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                placeholder="BTCUSDT"
                className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-base px-5 py-4 placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">الإطار الزمني</label>
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={e => setTimeframe(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-base px-5 py-4 appearance-none focus:outline-none focus:border-emerald-500/40 transition-colors cursor-pointer"
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
              background: loading ? 'linear-gradient(135deg, #0f766e, #064e3b)' : 'linear-gradient(135deg, #10b981, #047857)',
              boxShadow: !loading ? '0 0 20px rgba(16, 185, 129, 0.2)' : 'none'
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جارٍ التحليل...' : 'تشغيل شريط المتوسطات'}
          </button>
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
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
              {/* Top Banner */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none transition-colors duration-1000"
                  style={{ 
                    background: `radial-gradient(circle at center, ${
                      result.status === 'Expanding Bullish' ? '#10b981' : result.status === 'Expanding Bearish' ? '#ef4444' : '#9ca3af'
                    } 0%, transparent 70%)` 
                  }}
                />
                
                <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1 z-10">حالة الشريط (Ribbon State)</p>
                
                <h2 className={`text-2xl font-black tracking-widest z-10 mt-1 mb-2 ${
                  result.status === 'Expanding Bullish' ? 'text-emerald-500' : result.status === 'Expanding Bearish' ? 'text-red-500' : 'text-gray-400'
                }`} style={{ textShadow: `0 0 15px currentColor` }}>
                  {result.statusAr}
                </h2>

                <div className="flex flex-col items-center gap-1 w-full mt-2">
                  <div className="flex justify-between w-full px-2 mb-1">
                    <span className="text-sm font-mono text-white/30 uppercase">Weak</span>
                    <span className="text-sm font-black text-white/80">{result.trendStrengthLabelAr} ({result.trendStrengthPct}%)</span>
                    <span className="text-sm font-mono text-white/30 uppercase">Strong</span>
                  </div>
                  {/* Gauge Progress */}
                  <div className="h-1.5 w-full bg-black/50 rounded-full border border-white/[0.05] overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={animated ? { width: `${result.trendStrengthPct}%` } : { width: 0 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className={`h-full rounded-r-full ${
                        result.status === 'Expanding Bullish' ? 'bg-gradient-to-l from-emerald-400 to-emerald-600' : 
                        result.status === 'Expanding Bearish' ? 'bg-gradient-to-l from-red-400 to-red-600' : 
                        'bg-gradient-to-l from-gray-400 to-gray-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Visual Ribbon Graph */}
              <RibbonVisualizer result={result} animated={animated} />

              {/* EMAs Data List */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-6 flex flex-col shadow-xl">
                <div className="flex items-center gap-3 mb-3 px-1">
                  <Activity className="w-6 h-6 text-emerald-500/70" />
                  <span className="text-sm font-bold text-white/50 uppercase tracking-widest">المتوسطات الأسية (EMAs)</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {result.emas.map((ema, i) => {
                    const isBullish = result.status === 'Expanding Bullish';
                    const isBearish = result.status === 'Expanding Bearish';
                    // Base opacity on index (shorter EMAs = brighter)
                    const opacity = 1 - (i * 0.08); 
                    const color = isBullish ? `rgba(16,185,129,${opacity})` : isBearish ? `rgba(239,68,68,${opacity})` : `rgba(156,163,175,${opacity})`;
                    
                    return (
                      <motion.div 
                        key={ema.length}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * i, type: "spring", stiffness: 120 }}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.03] bg-white/[0.02]"
                        style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
                      >
                        <span className="text-sm font-bold text-white/60 uppercase">EMA {ema.length}</span>
                        <span className="text-sm font-mono text-white/90">
                          {ema.value >= 1000 ? ema.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : ema.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── SVG Ribbon Component ────────────────────────────────────────────────────

function RibbonVisualizer({ result, animated }: { result: EmaRibbonResult, animated: boolean }) {
  const width = 320;
  const height = 200;
  
  const isBullish = result.status === 'Expanding Bullish';
  const isBearish = result.status === 'Expanding Bearish';

  // Base colors for gradient
  const brightColor = isBullish ? '#10b981' : isBearish ? '#ef4444' : '#9ca3af'; // Bright Green/Red
  const darkColor = isBullish ? '#064e3b' : isBearish ? '#7f1d1d' : '#374151'; // Dark Green/Red
  
  const renderLine = (i: number, spacingFactor: number) => {
    // Generate curved path: M x1,y1 Q cx,cy x2,y2
    const startY = height / 2;
    // Max spread at the right edge
    const maxSpread = 80; 
    let endY = height / 2;
    
    // Direction multiplier: if bullish, shorter EMAs go UP, longer EMAs go DOWN
    // Wait, in trading view, if bullish, price goes UP. EMA 8 is TOP. EMA 233 is BOTTOM.
    // So index 0 (EMA 8) should have higher endY in conventional charts.
    // In SVG, Y=0 is TOP. So EMA 8 should be lower Y (higher on screen).
    const dir = isBullish ? 1 : isBearish ? -1 : 0;
    
    // Mapping 8 lines from top to bottom
    // i ranges 0 to 7. 
    // Normalized position from -3.5 to 3.5
    const pos = (i - 3.5); 
    
    if (dir !== 0) {
      endY = (height / 2) + (pos * 10 * spacingFactor * dir);
    } else {
      // Contracting - jumbled in center
      endY = (height / 2) + (pos * 5 * spacingFactor);
    }

    const controlY = startY + (endY - startY) / 2;

    const path = `M 0,${startY} Q ${width * 0.6},${controlY} ${width},${endY}`;
    
    // Interpolate color from bright to dark
    const interpolateColor = (color1: string, color2: string, factor: number) => {
      const hex = (c: string) => parseInt(c.slice(1), 16);
      const r1 = hex(color1) >> 16, g1 = (hex(color1) >> 8) & 0xff, b1 = hex(color1) & 0xff;
      const r2 = hex(color2) >> 16, g2 = (hex(color2) >> 8) & 0xff, b2 = hex(color2) & 0xff;
      const r = Math.round(r1 + factor * (r2 - r1));
      const g = Math.round(g1 + factor * (g2 - g1));
      const b = Math.round(b1 + factor * (b2 - b1));
      return `rgb(${r},${g},${b})`;
    };

    const strokeColor = interpolateColor(brightColor, darkColor, i / 7);

    return (
      <motion.path
        key={i}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={animated ? { pathLength: 1, opacity: 1 - (i * 0.05) } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 1.5, delay: i * 0.05, ease: "easeInOut" }}
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={3}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${strokeColor}80)` }}
      />
    );
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] flex items-center justify-center p-6 shadow-xl overflow-hidden relative">
      {/* Background grid lines for charting feel */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
           style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible z-10">
        {result.emas.map((ema, i) => renderLine(i, ema.spacingFactor))}
      </svg>
    </div>
  );
}
