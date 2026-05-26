'use client';

/**
 * app/tools/triple-lens/page.tsx
 *
 * Triple Lens (العدسة الثلاثية)
 * Analyzes an asset using 3 lenses: Ichimoku, Bollinger, Volume Profile.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, AlertCircle, ScanSearch, ChevronDown, Activity, BarChart2, TrendingUp, Info } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { analyzeTripleLens, TripleLensResult } from '@/lib/algorithms/tripleLens';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';

export default function TripleLensPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  
  const [result, setResult] = useState<TripleLensResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  // ── Guard ──────────────────────────────────────────────────────────────────
  const tool = slugToTool('triple-lens');
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
      
      const res = analyzeTripleLens(symbol.toUpperCase().trim(), klines);
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
            Multifactor · TA
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          العدسة الثلاثية
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          تحليل موحد باستخدام (Ichimoku, Bollinger, Volume Profile)
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* ── Input Form ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
          <div className="grid grid-cols-2 gap-3">
            {/* Symbol */}
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

            {/* Timeframe */}
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
            {loading ? 'جارٍ التحليل...' : 'تشغيل العدسة الثلاثية'}
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
              {/* Main Score Area */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                {/* Background Glow */}
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none transition-colors duration-1000"
                  style={{ 
                    background: `radial-gradient(circle at center, ${
                      result.overallBias === 'BULL' ? '#10b981' : result.overallBias === 'BEAR' ? '#ef4444' : '#9ca3af'
                    } 0%, transparent 70%)` 
                  }}
                />
                
                <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1 z-10">الحكم الموحد</p>
                
                <div className="flex items-baseline gap-3 z-10">
                  <span className={`text-5xl font-black font-mono tracking-tighter ${
                    result.overallBias === 'BULL' ? 'text-emerald-400' : result.overallBias === 'BEAR' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {result.consensusScorePct}%
                  </span>
                  <span className={`text-lg font-black tracking-widest ${
                    result.overallBias === 'BULL' ? 'text-emerald-500' : result.overallBias === 'BEAR' ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {result.overallBias}
                  </span>
                </div>
                
                {/* Tally */}
                <div className="flex items-center gap-3 mt-4 z-10 bg-black/40 px-5 py-4 rounded-full border border-white/[0.05]">
                  <span className="text-sm font-mono text-emerald-400 font-bold">{result.bullCount} BULL</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-sm font-mono text-gray-400 font-bold">{result.neutralCount} WAIT</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-sm font-mono text-red-400 font-bold">{result.bearCount} BEAR</span>
                </div>
                
                {/* Power Meter */}
                <div className="w-full mt-6 z-10">
                  <div className="h-2 w-full bg-black/50 rounded-full border border-white/[0.05] relative overflow-hidden flex">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={animated ? { width: `${result.consensusScorePct}%` } : { width: 0 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className={`h-full rounded-r-full ${
                        result.overallBias === 'BULL' ? 'bg-gradient-to-l from-emerald-400 to-emerald-600' : 
                        result.overallBias === 'BEAR' ? 'bg-gradient-to-l from-red-400 to-red-600' : 
                        'bg-gradient-to-l from-gray-400 to-gray-600'
                      }`}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 px-1">
                    <span className="text-sm font-bold text-red-500/70">BEAR (0%)</span>
                    <span className="text-sm font-bold text-gray-500/70">NEUTRAL (50%)</span>
                    <span className="text-sm font-bold text-emerald-500/70">BULL (100%)</span>
                  </div>
                </div>
              </div>

              {/* Verdict Text Box */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl border-r-2 border-r-emerald-500 border-white/[0.05] bg-emerald-500/[0.03] p-6 text-right shadow-inner"
              >
                <p className="text-sm text-emerald-50 font-medium leading-relaxed">
                  {result.verdictTextAr}
                </p>
              </motion.div>

              {/* ── Lens Cards ────────────────────────────────────────────── */}
              <div className="flex flex-col gap-3 mt-2">
                <LensCard 
                  title="Ichimoku Cloud" 
                  subtitle="الاتجاه (Trend)"
                  icon={<TrendingUp className="w-6 h-6 text-white/50" />}
                  data={result.lenses.ichimoku}
                  delay={0.4}
                  rows={[
                    { label: 'السعر والسحابة', value: result.lenses.ichimoku.priceVsCloud },
                    { label: 'Tenkan / Kijun', value: result.lenses.ichimoku.tenkanKijun },
                    { label: 'Chikou Span', value: result.lenses.ichimoku.chikouSpan },
                    { label: 'سحابة المستقبل', value: result.lenses.ichimoku.futureCloud },
                    { label: 'المسافة عن السحابة', value: result.lenses.ichimoku.cloudDistancePct },
                  ]}
                />
                
                <LensCard 
                  title="Bollinger Bands" 
                  subtitle="التقلب (Volatility)"
                  icon={<Activity className="w-6 h-6 text-white/50" />}
                  data={result.lenses.bollinger}
                  delay={0.5}
                  rows={[
                    { label: '%B Position', value: result.lenses.bollinger.pctB },
                    { label: 'السعر / SMA20', value: result.lenses.bollinger.priceVsSMA },
                    { label: 'عرض النطاق', value: result.lenses.bollinger.bandwidth },
                    { label: 'حالة الضغط', value: result.lenses.bollinger.squeezeStatus },
                  ]}
                />
                
                <LensCard 
                  title="Volume Profile" 
                  subtitle="السيولة (Liquidity)"
                  icon={<BarChart2 className="w-6 h-6 text-white/50" />}
                  data={result.lenses.volumeProfile}
                  delay={0.6}
                  rows={[
                    { label: 'نقطة التحكم POC', value: result.lenses.volumeProfile.poc },
                    { label: 'السعر مقارنة بـ POC', value: result.lenses.volumeProfile.priceVsPocPct },
                    { label: 'منطقة القيمة VA', value: result.lenses.volumeProfile.valueArea },
                  ]}
                />
              </div>

              {/* Guide */}
              <div className="flex items-start gap-3 mt-4 px-2 mb-4">
                <Info className="w-6 h-6 text-white/20 shrink-0 mt-0.5" />
                <p className="text-sm text-white/30 leading-relaxed font-mono">
                  <strong>دليل القراءة:</strong> يتم حساب درجة الإجماع من خلال تجميع النقاط المستخرجة من الإطار الزمني المختار لكل نظام من الأنظمة الثلاثة. (Ichimoku: 5 نقاط، Bollinger: 4 نقاط، Volume Profile: 4 نقاط).
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────────

function LensCard({ title, subtitle, icon, data, delay, rows }: { title: string, subtitle: string, icon: React.ReactNode, data: any, delay: number, rows: { label: string, value: string }[] }) {
  const [open, setOpen] = useState(true);
  
  let colorClass = "text-gray-400 bg-gray-500/10 border-gray-500/20";
  if (data.bias === 'BULL') colorClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (data.bias === 'BEAR') colorClass = "text-red-400 bg-red-500/10 border-red-500/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-xl border border-white/[0.05] bg-[#0d0d0d] overflow-hidden"
    >
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/[0.05] flex items-center justify-center">
            {icon}
          </div>
          <div className="text-right flex flex-col items-start">
            <span className="text-sm text-white/40 font-mono tracking-widest">{subtitle}</span>
            <span className="text-base font-bold text-white/90">{title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-2 py-1 rounded border flex flex-col items-center ${colorClass}`}>
            <span className="text-sm font-black font-mono leading-none">{data.score}/{data.maxScore}</span>
            <span className="text-sm font-bold tracking-widest mt-0.5">{data.bias}</span>
          </div>
          <ChevronDown className={`w-6 h-6 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 border-t border-white/[0.04]">
              <div className="flex flex-col gap-1">
                {rows.map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-4 px-1 border-b border-white/[0.02] last:border-0">
                    <span className="text-sm font-bold text-white/80">{r.value}</span>
                    <span className="text-sm text-white/40 uppercase tracking-wide">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
