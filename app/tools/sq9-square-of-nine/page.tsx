'use client';

/**
 * app/tools/gann-sq9/page.tsx
 *
 * Gann Square of Nine (ظ…ط±ط¨ط¹ ط§ظ„طھط³ط¹ط©)
 * Standalone client-side calculator
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, AlertCircle, TrendingUp, Grid3X3, Settings2, Eye } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { computeSQ9, SQ9Input, SQ9Result, SQ9Cell } from '@/lib/algorithms/sq9';
import { notFound } from 'next/navigation';

export default function GannSQ9Page() {
  // â”€â”€ Hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [pivot, setPivot] = useState('');
  const [step, setStep] = useState('1');
  const [size, setSize] = useState<number>(9);
  const [viewMode, setViewMode] = useState<'price' | 'degree'>('price');
  
  const [result, setResult] = useState<SQ9Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  // â”€â”€ Guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tool = slugToTool('sq9-square-of-nine');
  if (!tool) return notFound();

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCalculate = () => {
    setError('');
    
    if (!symbol.trim()) return setError('ط£ط¯ط®ظ„ ط§ط³ظ… ط§ظ„ط£طµظ„.');
    const p = parseFloat(pivot);
    if (isNaN(p) || p <= 0) return setError('ط£ط¯ط®ظ„ ط³ط¹ط± ط§ط±طھظƒط§ط² طµط­ظٹط­ ظˆظ…ظˆط¬ط¨.');
    const s = parseFloat(step);
    if (isNaN(s) || s <= 0) return setError('ط£ط¯ط®ظ„ ط®ط·ظˆط© ط²ظٹط§ط¯ط© طµط­ظٹط­ط© ظˆظ…ظˆط¬ط¨ط©.');
    
    setLoading(true);
    setAnimated(false);
    
    setTimeout(() => {
      try {
        const input: SQ9Input = { symbol: symbol.toUpperCase().trim(), pivot: p, step: s, size };
        const res = computeSQ9(input);
        setResult(res);
        setTimeout(() => setAnimated(true), 100);
      } catch (err) {
        console.error(err);
        setError('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط§ظ„ظ…ط¹ط§ظ„ط¬ط©.');
      } finally {
        setLoading(false);
      }
    }, 400); // premium delay
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-400/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full">
            Gann آ· SQ9
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          ظ…ط±ط¨ط¹ ط§ظ„طھط³ط¹ط©
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ط­ط§ط³ط¨ط© ط¬ط§ظ† ظ„ظ„طھط±ط¨ظٹط¹ ط§ظ„ط²ظ…ظ†ظٹ ظˆط§ظ„ط³ط¹ط±ظٹ (Square of 9)
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* â”€â”€ Input Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6">
          
          {/* Symbol */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white/50 uppercase tracking-widest">ط±ظ…ط² ط§ظ„ط£طµظ„</label>
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              placeholder="BTCUSDT"
              className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 placeholder:text-white/20 focus:outline-none focus:border-orange-500/40 transition-colors"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Pivot */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest">ط³ط¹ط± ط§ظ„ط§ط±طھظƒط§ط² (ط§ظ„ظ…ط±ظƒط²)</label>
              <input
                type="number"
                value={pivot}
                onChange={e => setPivot(e.target.value)}
                placeholder="ط§ظ„ظ…ط±ظƒط²"
                className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 focus:outline-none focus:border-orange-500/40 transition-colors"
                dir="ltr"
              />
            </div>
            {/* Step */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest">ط®ط·ظˆط© ط§ظ„ط²ظٹط§ط¯ط©</label>
              <input
                type="number"
                value={step}
                onChange={e => setStep(e.target.value)}
                placeholder="1"
                className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 focus:outline-none focus:border-orange-500/40 transition-colors"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Size */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1"><Grid3X3 className="w-3 h-3" /> ط­ط¬ظ… ط§ظ„ط´ط¨ظƒط©</label>
              <div className="relative">
                <select
                  value={size}
                  onChange={e => setSize(Number(e.target.value))}
                  className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 appearance-none focus:outline-none focus:border-orange-500/40 transition-colors cursor-pointer"
                  dir="ltr"
                >
                  <option value={7}>7x7</option>
                  <option value={9}>9x9</option>
                  <option value={11}>11x11</option>
                  <option value={13}>13x13</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Settings2 className="w-6 h-6 text-white/40" />
                </div>
              </div>
            </div>
            
            {/* View Mode */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1"><Eye className="w-3 h-3" /> ط·ط±ظٹظ‚ط© ط§ظ„ط¹ط±ط¶</label>
              <div className="relative">
                <select
                  value={viewMode}
                  onChange={e => setViewMode(e.target.value as 'price' | 'degree')}
                  className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 appearance-none focus:outline-none focus:border-orange-500/40 transition-colors cursor-pointer"
                  dir="rtl"
                >
                  <option value="price">ط£ط³ط¹ط§ط±</option>
                  <option value="degree">ط¯ط±ط¬ط§طھ (ط²ظˆط§ظٹط§)</option>
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Settings2 className="w-6 h-6 text-white/40" />
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
            className="w-full mt-2 flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-lg text-black tracking-wide active:scale-[0.98] transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Sparkles className="w-6 h-6" />}
            {loading ? 'ط¬ط§ط±ظٹ ط§ظ„طھظˆظ„ظٹط¯...' : 'طھظˆظ„ظٹط¯ ط§ظ„ظ…ط±ط¨ط¹'}
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
              className="flex flex-col gap-5"
            >
              {/* Matrix Display */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#050505] p-6 flex flex-col items-center overflow-x-auto relative shadow-2xl shadow-orange-500/5">
                <p className="text-sm font-mono text-white/30 uppercase tracking-widest mb-4">
                  ظ…طµظپظˆظپط© {result.input.size}x{result.input.size} â€” {result.input.symbol}
                </p>
                
                <div 
                  className="grid gap-1 min-w-max"
                  style={{ gridTemplateColumns: `repeat(${result.input.size}, minmax(40px, 1fr))` }}
                  dir="ltr"
                >
                  {result.grid.map((row, y) => 
                    row.map((cell, x) => (
                      <SQ9CellComponent 
                        key={`${x}-${y}`} 
                        cell={cell} 
                        animated={animated} 
                        viewMode={viewMode}
                      />
                    ))
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 mt-6">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                    <span className="text-sm text-white/40 font-mono">ط§ظ„ظ…ط±ظƒط²</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/50" />
                    <span className="text-sm text-white/40 font-mono">ط§ظ„ط²ظˆط§ظٹط§ ط§ظ„ط±ط¦ظٹط³ظٹط©</span>
                  </div>
                </div>
              </div>

              {/* Price Targets Cards */}
              <div className="grid grid-cols-3 gap-3">
                {result.targets.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-sm text-white/40 font-mono uppercase tracking-wider text-center">{t.label}</span>
                    <span className="text-lg font-black text-orange-400 font-mono">{t.value}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* â”€â”€ Disclaimer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <p className="text-sm text-white/25 text-center font-mono leading-relaxed pb-4 max-w-xs mx-auto" dir="rtl">
          ظ‡ط°ظ‡ ط§ظ„ط£ط¯ط§ط© طھط¹طھظ…ط¯ ط¹ظ„ظ‰ ط§ظ„ط¥ط³ظ‚ط§ط· ط§ظ„ظ‡ظ†ط¯ط³ظٹ ط§ظ„ط±ظ‚ظ…ظٹ ظ„ط³ظٹظƒظˆظ„ظˆط¬ظٹط© ط§ظ„ط³ظˆظ‚طŒ ظˆظ„ط§ طھظ‚ط¯ظ… ظ†طµط§ط¦ط­ ظ…ط§ظ„ظٹط©.
        </p>

      </div>
    </div>
  );
}

// â”€â”€â”€ Cell Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SQ9CellComponent({ cell, animated, viewMode }: { cell: SQ9Cell, animated: boolean, viewMode: 'price' | 'degree' }) {
  const isAngle = cell.angle !== null;
  
  let bgClass = "bg-white/[0.03] border-white/[0.05]";
  let textClass = "text-white/60";
  let shadowClass = "";

  if (cell.isCenter) {
    bgClass = "bg-orange-500/90 border-orange-400";
    textClass = "text-black font-black";
    shadowClass = "shadow-[0_0_15px_rgba(249,115,22,0.5)] z-10";
  } else if (isAngle) {
    bgClass = "bg-amber-500/10 border-amber-500/30";
    textClass = "text-amber-400 font-bold";
    shadowClass = "shadow-[inset_0_0_8px_rgba(245,158,11,0.1)]";
  }

  // Calculate cell degree relatively for 'degree' view
  // 0 is right, 90 is down, 180 is left, 270 is up
  let displayValue = cell.value.toString();
  if (viewMode === 'degree' && !cell.isCenter) {
    // Basic calculation for visual degrees (0 at right, 90 at down)
    // Note: This is an approximation for non-angle cells, but standard for angle cells
    if (cell.angle !== null) {
      displayValue = `${cell.angle}آ°`;
    } else {
      displayValue = 'آ·'; // Don't show complex fractions for non-fixed angles
    }
  } else if (viewMode === 'degree' && cell.isCenter) {
    displayValue = '0آ°';
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={animated ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
      transition={{ 
        type: 'spring', 
        stiffness: 200, 
        damping: 20, 
        delay: animated ? cell.ring * 0.05 : 0 
      }}
      className={`
        w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-md border text-sm sm:text-sm font-mono transition-colors
        ${bgClass} ${textClass} ${shadowClass}
      `}
      title={cell.angle !== null ? `${cell.angle}آ°` : ''}
    >
      {displayValue}
    </motion.div>
  );
}
