'use client';

/**
 * app/tools/matrix-4x4/page.tsx
 *
 * 4x4 Matrix (طھظˆط§ظپظ‚ ط§ظ„ط£ط·ط±)
 * Visual Grid analyzing 4 indicators across 4 timeframes.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, ChevronDown, AlignJustify, Activity } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { analyzeMatrix4x4Single, Matrix4x4Result, MTFRow, MatrixSignal } from '@/lib/algorithms/matrix4x4';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';

export default function Matrix4x4Page() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  
  const [result, setResult] = useState<Matrix4x4Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  // â”€â”€ Guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tool = slugToTool('matrix-4x4');
  if (!tool) return notFound();

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('ط£ط¯ط®ظ„ ط§ط³ظ… ط§ظ„ط£طµظ„.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1h', 100);
      if (klines.length === 0) throw new Error('ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظ…طھط§ط­ط© ظ„ظ‡ط°ط§ ط§ظ„ط£طµظ„.');
      
      const res = analyzeMatrix4x4Single(symbol.toUpperCase().trim(), klines);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط¬ظ„ط¨ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط£ظˆ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©.');
    } finally {
      setLoading(false);
    }
  };

  const getCellColor = (signal: MatrixSignal) => {
    if (signal === 'bullish' || signal === 'oversold') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
    if (signal === 'bearish' || signal === 'overbought') return 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
    return 'bg-gray-500/10 text-gray-500 border-white/[0.08]';
  };

  const getCellText = (signal: MatrixSignal) => {
    if (signal === 'bullish' || signal === 'oversold') return 'ط¥ظٹط¬ط§ط¨ظٹ';
    if (signal === 'bearish' || signal === 'overbought') return 'ط³ظ„ط¨ظٹ';
    return 'ظ…ط­ط§ظٹط¯';
  };

  const getCellScore = (signal: MatrixSignal): number => {
    if (signal === 'bullish' || signal === 'oversold') return 1;
    if (signal === 'bearish' || signal === 'overbought') return -1;
    return 0;
  };

  const indicators = ['RSI', 'MACD', 'EMA', 'Stoch'];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-amber-400/70 tracking-widest uppercase border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full">
            Confluence Matrix
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          طھظˆط§ظپظ‚ ط§ظ„ط£ط·ط± (4x4)
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظ…طµظپظˆظپط© ط§ظ„طھظˆط§ظپظ‚ ظ„طھط­ظ„ظٹظ„ 4 ظ…ط¤ط´ط±ط§طھ ط¹ط¨ط± 4 ط¥ط·ط§ط±ط§طھ ط²ظ…ظ†ظٹط©
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* â”€â”€ Input Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
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
            className="w-full flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-lg tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #78350f, #451a03)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: !loading ? '0 0 20px rgba(245, 158, 11, 0.2)' : 'none'
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'ط¬ط§ط±ظچ ط§ظ„طھط­ظ„ظٹظ„...' : 'طھط´ط؛ظٹظ„ ظ…طµظپظˆظپط© ط§ظ„طھظˆط§ظپظ‚'}
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
              {/* Consensus Bar */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 flex flex-col shadow-lg">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white/40 uppercase tracking-widest">ط§ظ„طھظˆط§ظپظ‚ ط§ظ„ط¹ط§ظ… (Global Confluence)</span>
                    <span className={`text-2xl font-black tracking-widest ${
                      result.overallBias === 'BULL' ? 'text-emerald-500' : result.overallBias === 'BEAR' ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {result.overallBias}
                    </span>
                  </div>
                  <span className={`text-3xl font-black font-mono tracking-tighter ${
                    result.overallBias === 'BULL' ? 'text-emerald-400' : result.overallBias === 'BEAR' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {result.globalConfluencePct}%
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="h-2.5 w-full bg-black/50 rounded-full border border-white/[0.05] relative overflow-hidden flex">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={animated ? { width: `${result.globalConfluencePct}%` } : { width: 0 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={`h-full rounded-r-full ${
                      result.overallBias === 'BULL' ? 'bg-gradient-to-l from-emerald-400 to-emerald-600 shadow-[0_0_10px_#10b981]' : 
                      result.overallBias === 'BEAR' ? 'bg-gradient-to-l from-red-400 to-red-600 shadow-[0_0_10px_#ef4444]' : 
                      'bg-gradient-to-l from-gray-400 to-gray-600'
                    }`}
                  />
                </div>
              </div>

              {/* 4x4 Glowing Grid */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-6 flex flex-col shadow-xl overflow-x-auto">
                <div className="min-w-[300px]">
                  {/* Grid Header (Indicators) */}
                  <div className="grid grid-cols-5 gap-3 mb-2">
                    <div className="text-sm font-bold text-white/30 uppercase tracking-widest flex items-center justify-center">ط§ظ„ظپط±ظٹظ…</div>
                    {indicators.map((ind, i) => (
                      <div key={i} className="text-sm font-bold text-amber-500/70 font-mono uppercase tracking-widest flex items-center justify-center bg-amber-500/5 rounded border border-amber-500/10 py-1.5">
                        {ind}
                      </div>
                    ))}
                  </div>

                  {/* Grid Rows (Timeframes) */}
                  <div className="flex flex-col gap-3">
                    {result.rows.map((row, rowIndex) => (
                      <div key={row.timeframe} className="grid grid-cols-5 gap-3">
                        {/* Timeframe Label */}
                        <div className="flex items-center justify-center bg-white/[0.03] border border-white/[0.05] rounded-lg py-4">
                          <span className="text-sm font-black text-white/80 font-mono">{row.timeframe}</span>
                        </div>
                        
                        {/* Cells */}
                         {[row.rsi, row.macd, row.ema, row.position].map((ind, colIndex) => (
                          <motion.div
                            key={`${rowIndex}-${colIndex}`}
                            initial={{ rotateX: 90, opacity: 0 }}
                            animate={animated ? { rotateX: 0, opacity: 1 } : { rotateX: 90, opacity: 0 }}
                            transition={{ delay: 0.1 * (rowIndex * 4 + colIndex), duration: 0.4, type: "spring" }}
                            className={`flex flex-col items-center justify-center rounded-lg border py-4 ${getCellColor(ind.signal)} transition-colors`}
                            style={{ transformOrigin: "center" }}
                          >
                            <span className="text-sm font-bold uppercase tracking-widest mb-0.5">{getCellText(ind.signal)}</span>
                            <span className="text-sm opacity-60 font-mono">
                              {getCellScore(ind.signal) > 0 ? '+1' : getCellScore(ind.signal) < 0 ? '-1' : '0'}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary Text Box */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="rounded-xl border-t-2 border-t-amber-500 border-white/[0.05] bg-amber-500/[0.03] p-6 text-right shadow-inner"
              >
                <div className="flex items-center gap-3 mb-2 justify-end">
                  <AlignJustify className="w-6 h-6 text-amber-500" />
                  <span className="text-sm font-black text-amber-500 tracking-widest uppercase">ط®ظ„ط§طµط© ط§ظ„ظ…طµظپظˆظپط©</span>
                </div>
                <p className="text-sm text-amber-50 font-medium leading-relaxed">
                  {result.dominantTfAr}
                </p>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
