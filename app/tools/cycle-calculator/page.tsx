'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hexagon, ScanSearch, AlertCircle, Calendar } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

interface CycleDate { date: string; cycleDays: number; daysLeft: number; }
interface CalcResult { avgCycleDays: number; lastLowDate: string; lastLowPrice: number; nextDates: CycleDate[]; currentPrice: number; }

function calcCycles(klines: { low: number; close: number; time: number }[]): CalcResult {
  const currentPrice = klines[klines.length - 1].close;
  // Find swing lows
  const lows: { time: number; price: number }[] = [];
  for (let i = 2; i < klines.length - 2; i++) {
    const c = klines[i];
    if (c.low < klines[i-1].low && c.low < klines[i-2].low && c.low < klines[i+1].low && c.low < klines[i+2].low)
      lows.push({ time: klines[i].time, price: c.low });
  }

  let avgCycleDays = 90;
  if (lows.length >= 2) {
    const gaps = [];
    for (let i = 1; i < lows.length; i++)
      gaps.push((lows[i].time - lows[i-1].time) / (86400000));
    avgCycleDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }

  const lastLow = lows[lows.length - 1] ?? { time: klines[0].time, price: klines[0].low };
  const lastLowDate = new Date(lastLow.time).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const now = Date.now();

  const nextDates: CycleDate[] = [1, 2, 3].map(n => {
    const ts = lastLow.time + n * avgCycleDays * 86400000;
    return {
      date: new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
      cycleDays: n * avgCycleDays,
      daysLeft: Math.round((ts - now) / 86400000),
    };
  });

  return { avgCycleDays, lastLowDate, lastLowPrice: lastLow.price, nextDates, currentPrice };
}

const fmtP = (p: number) => p.toLocaleString(undefined, { maximumFractionDigits: p > 1000 ? 1 : 4 });

export default function CycleCalculatorPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [result, setResult] = useState<CalcResult | null>(null);

  const handleCalc = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 200);
      if (klines.length < 20) throw new Error('بيانات غير كافية');
      setResult(calcCycles(klines));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const verdict = !result ? '' :
    `متوسط الدورة = ${result.avgCycleDays} يوماً. ` +
    (result.nextDates[0].daysLeft > 0
      ? `أقرب تاريخ انعكاس متوقع: ${result.nextDates[0].date} (بعد ${result.nextDates[0].daysLeft} يوماً). عند هذه التواريخ يرتفع احتمال انعكاس اتجاه السوق.`
      : `أقرب تاريخ مرّ بالفعل — راقب الدورة التالية: ${result.nextDates[1].date}.`);

const tool = slugToTool('cycle-calculator');
  if (!tool) return notFound();

    return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Hexagon className="w-3 h-3" /> Cycles</span>
        <h1 className="text-xl font-black text-white mt-1">حاسبة الدورات الزمنية</h1>
        <p className="text-sm text-white/40 font-mono">كشف القيعان التاريخية وحساب متوسط الدورة لإسقاط التواريخ القادمة</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleCalc} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: !loading ? '0 0 20px rgba(249,115,22,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الحساب...' : 'حساب الدورات (200 شمعة يومية)'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4">
                  <p className="text-xs text-orange-400/60 mb-1">متوسط الدورة</p>
                  <p className="text-2xl font-black text-orange-400">{result.avgCycleDays}<span className="text-sm text-white/30"> يوم</span></p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/[0.08] p-4">
                  <p className="text-xs text-white/40 mb-1">آخر قاع مكتشف</p>
                  <p className="text-sm font-black text-white font-mono">{fmtP(result.lastLowPrice)}</p>
                  <p className="text-xs text-white/30">{result.lastLowDate}</p>
                </div>
              </div>

              {/* Projected dates */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-white/30 uppercase tracking-widest">التواريخ المتوقعة للانعكاس</p>
                {result.nextDates.map((nd, i) => (
                  <motion.div key={i} initial={{opacity:0,x:-15}} animate={{opacity:1,x:0}} transition={{delay:i*0.1}}
                    className={`rounded-xl border p-4 flex items-center justify-between ${nd.daysLeft > 0 ? 'border-orange-500/20 bg-orange-500/05' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${nd.daysLeft > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-white/30'}`}>{i+1}</div>
                      <div>
                        <p className="text-xs text-white/30 font-mono">{nd.cycleDays} يوم من القاع</p>
                        <p className="text-sm font-black text-white">{nd.date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-black font-mono ${nd.daysLeft > 0 ? 'text-orange-400' : 'text-white/20'}`}>
                      {nd.daysLeft > 0 ? `${nd.daysLeft}+` : `${nd.daysLeft}`}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Visual Hex Spinner */}
              <div className="rounded-3xl border border-orange-500/20 bg-[#0d0d0d] p-8 flex justify-center items-center overflow-hidden relative h-48">
                <div className="absolute w-48 h-48 bg-orange-500/10 blur-[60px] rounded-full" />
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="relative z-10 w-28 h-28">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-orange-400 opacity-70" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" strokeDasharray="6,4" />
                    <rect x="27" y="27" width="46" height="46" transform="rotate(45 50 50)" strokeDasharray="4,6" />
                    <circle cx="50" cy="50" r="15" opacity="0.5" />
                  </svg>
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-black text-orange-400 font-mono">{result.avgCycleDays}</p>
                    <p className="text-xs text-white/30">يوم/دورة</p>
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/08 p-5">
                <p className="text-sm font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" /> الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
