'use client';

/**
 * app/tools/momentum-intelligence/page.tsx
 *
 * Momentum Intelligence (ط°ظƒط§ط، ط§ظ„ط²ط®ظ…)
 * Evaluates the kinetic energy and speed of price using RSI, MACD, and Stochastic.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Gauge, Activity, Zap, TrendingUp, Info } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateMomentumIntelligence, MomentumIntelligenceResult } from '@/lib/algorithms/momentum';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';

export default function MomentumIntelligencePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MomentumIntelligenceResult | null>(null);
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('momentum-intelligence');
  if (!tool) return notFound();

  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('ط£ط¯ط®ظ„ ط§ط³ظ… ط§ظ„ط£طµظ„.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1h', 100);
      if (klines.length === 0) throw new Error('ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظ…طھط§ط­ط© ظ„ظ‡ط°ط§ ط§ظ„ط£طµظ„.');
      const res = calculateMomentumIntelligence(symbol.toUpperCase(), klines);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، طھظ‚ظٹظٹظ… ط§ظ„ط²ط®ظ….');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-rose-500/70 tracking-widest uppercase border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Gauge className="w-3 h-3" /> Kinetic Engine
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          ط°ظƒط§ط، ط§ظ„ط²ط®ظ… ظˆط§ظ„ظ…ط­ط±ظƒط§طھ
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظ‚ظٹط§ط³ ط³ط±ط¹ط© ظˆط·ط§ظ‚ط© ط­ط±ظƒط© ط§ظ„ط³ط¹ط± ط¨ط¯ظ…ط¬ (RSI, MACD, Stochastic)
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
              className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-lg px-5 py-4 placeholder:text-white/20 focus:outline-none focus:border-rose-500/40 transition-colors"
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
              background: loading ? 'linear-gradient(135deg, #881337, #4c0519)' : 'linear-gradient(135deg, #f43f5e, #be123c)',
              boxShadow: !loading ? '0 0 20px rgba(244, 63, 94, 0.25)' : 'none'
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'ط¬ط§ط±ظٹ طھظ‚ظٹظٹظ… ط§ظ„ط²ط®ظ…...' : 'طھط´ط؛ظٹظ„ ظ…ط­ط±ظƒ ط§ظ„ط²ط®ظ…'}
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
              
              {/* Visual Energy Gauge (Core Output) & State */}
              <div className="flex items-center gap-6 bg-[#111] border border-white/[0.05] rounded-2xl p-5 shadow-xl shadow-rose-900/10 relative overflow-hidden">
                {/* Background glow based on score */}
                <div 
                  className="absolute inset-0 opacity-20 pointer-events-none blur-3xl transition-colors duration-1000"
                  style={{ backgroundColor: getGaugeColor(result.globalScore) }}
                />

                {/* SVG Thermometer / Energy Gauge */}
                <div className="shrink-0 w-8 h-40 rounded-full border border-white/10 bg-black p-1 relative z-10 flex flex-col justify-end overflow-hidden">
                  <motion.div 
                    className="w-full rounded-full"
                    initial={{ height: '0%' }}
                    animate={{ height: `${animated ? result.globalScore : 0}%` }}
                    transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                    style={{
                      background: 'linear-gradient(to top, #3b82f6, #a855f7, #f97316, #ef4444)',
                      boxShadow: `0 0 15px ${getGaugeColor(result.globalScore)}`
                    }}
                  />
                  {/* Gauge markings */}
                  <div className="absolute inset-0 flex flex-col justify-between py-4 items-center pointer-events-none opacity-30">
                    <div className="w-4 h-0.5 bg-white" />
                    <div className="w-2 h-0.5 bg-white" />
                    <div className="w-4 h-0.5 bg-white" />
                    <div className="w-2 h-0.5 bg-white" />
                    <div className="w-4 h-0.5 bg-white" />
                  </div>
                </div>

                <div className="flex flex-col gap-3 z-10 flex-1">
                  <span className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-yellow-500" /> Global Momentum
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-white font-mono tracking-tighter">
                      {result.globalScore}
                    </span>
                    <span className="text-lg font-bold text-white/30">%</span>
                  </div>
                  <span className="text-lg font-black mt-1 tracking-wide" style={{ color: getGaugeColor(result.globalScore) }}>
                    {result.momentumStateAr}
                  </span>
                </div>
              </div>

              {/* Indicator Breakdown Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* RSI */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] items-center text-center gap-1.5">
                  <span className="text-sm font-bold text-white/50 uppercase tracking-wider">RSI (14)</span>
                  <span className="text-xl font-black text-white font-mono">{result.indicators.rsi.value}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(result.indicators.rsi.status)}`} />
                    <span className="text-sm text-white/60 font-bold">{result.indicators.rsi.statusAr}</span>
                  </div>
                </motion.div>

                {/* MACD */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] items-center text-center gap-1.5">
                  <span className="text-sm font-bold text-white/50 uppercase tracking-wider">MACD Hist</span>
                  <span className="text-xl font-black text-white font-mono">{result.indicators.macd.hist}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(result.indicators.macd.status)}`} />
                    <span className="text-sm text-white/60 font-bold">{result.indicators.macd.statusAr}</span>
                  </div>
                </motion.div>

                {/* Stochastic */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-col p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] items-center text-center gap-1.5">
                  <span className="text-sm font-bold text-white/50 uppercase tracking-wider">Stoch %K</span>
                  <span className="text-xl font-black text-white font-mono">{result.indicators.stoch.k}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(result.indicators.stoch.status)}`} />
                    <span className="text-sm text-white/60 font-bold">{result.indicators.stoch.statusAr}</span>
                  </div>
                </motion.div>
              </div>

              {/* Actionable Insight Box */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="flex items-start gap-3 p-6 rounded-xl border border-rose-500/20 bg-rose-500/5 mt-1"
              >
                <Info className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-rose-500/80 mb-1">ط®ظ„ط§طµط© ط·ط§ظ‚ط© ط§ظ„ط²ط®ظ…</span>
                  <span className="text-base font-bold text-white/90 leading-relaxed">
                    {result.insightAr}
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

// â”€â”€â”€ Utility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getGaugeColor(score: number): string {
  if (score >= 75) return '#ef4444'; // Red
  if (score >= 60) return '#f97316'; // Orange
  if (score >= 40) return '#f59e0b'; // Yellow
  if (score >= 25) return '#a855f7'; // Purple
  return '#3b82f6'; // Blue
}

function getStatusDotColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('bullish') || s.includes('oversold')) return 'bg-emerald-500';
  if (s.includes('bearish') || s.includes('overbought')) return 'bg-red-500';
  return 'bg-gray-500';
}
