'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, ScanSearch, AlertCircle } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart } from '@/components/tools/ToolChart';

function calcRSI(closes: number[], p = 14) {
  if (closes.length < p + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / p, avgL = losses / p;
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (p - 1) + Math.max(0, d)) / p;
    avgL = (avgL * (p - 1) + Math.max(0, -d)) / p;
  }
  return avgL === 0 ? 100 : +(100 - 100 / (1 + avgG / avgL)).toFixed(1);
}

function calcMACD(closes: number[]) {
  const ema = (data: number[], p: number) => {
    const k = 2 / (p + 1); let e = data[0];
    for (let i = 1; i < data.length; i++) e = data[i] * k + e * (1 - k);
    return e;
  };
  if (closes.length < 26) return { macd: 0, signal: 0, hist: 0 };
  const macd = ema(closes, 12) - ema(closes, 26);
  const signal = macd * (2 / 10);
  return { macd: +macd.toFixed(4), signal: +signal.toFixed(4), hist: +(macd - signal).toFixed(4) };
}

function calcStoch(klines: { high: number; low: number; close: number }[], p = 14) {
  if (klines.length < p) return { k: 50, d: 50 };
  const sl = klines.slice(-p);
  const hh = Math.max(...sl.map(c => c.high));
  const ll = Math.min(...sl.map(c => c.low));
  const k = ll === hh ? 50 : +((klines[klines.length - 1].close - ll) / (hh - ll) * 100).toFixed(1);
  const d = k;
  return { k, d };
}

function calcROC(closes: number[], p = 10) {
  if (closes.length < p + 1) return 0;
  const prev = closes[closes.length - 1 - p];
  return prev === 0 ? 0 : +((closes[closes.length - 1] - prev) / prev * 100).toFixed(2);
}

interface MomResult { rsi: number; macd: { macd: number; signal: number; hist: number }; stoch: { k: number; d: number }; roc: number; bullCount: number; bearCount: number; }

export default function MomentumIntelligencePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [result, setResult] = useState<MomResult | null>(null);

  const [klines, setKlines] = useState<Kline[]>([]);
  const [indicatorData, setIndicatorData] = useState<any>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (fetchedKlines.length < 30) throw new Error('بيانات غير كافية');
      const closes = fetchedKlines.map(k => k.close);
      
      const rsi   = calcRSI(closes);
      const macd  = calcMACD(closes);
      const stoch = calcStoch(fetchedKlines);
      const roc   = calcROC(closes);
      
      // Calculate arrays for chart
      const rsiArr = [];
      for (let i = 30; i < closes.length; i++) {
        rsiArr.push({ time: fetchedKlines[i].time, value: calcRSI(closes.slice(0, i + 1)) });
      }

      const macdHistArr = [];
      for (let i = 30; i < closes.length; i++) {
        const m = calcMACD(closes.slice(0, i + 1));
        macdHistArr.push({ time: fetchedKlines[i].time, value: m.hist, color: m.hist >= 0 ? '#10b981' : '#ef4444' });
      }

      const bullCount = [rsi > 50, macd.hist > 0, stoch.k > 50, roc > 0].filter(Boolean).length;
      const bearCount = 4 - bullCount;
      
      setKlines(fetchedKlines);
      setIndicatorData({ rsiArr, macdHistArr });
      setResult({ rsi, macd, stoch, roc, bullCount, bearCount });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const verdict = !result ? '' :
    result.bullCount === 4 ? 'زخم صاعد كامل ✅ — جميع المؤشرات الأربعة تشير للصعود. الاحتمالية عالية جداً لاستمرار الاتجاه الصاعد.'
    : result.bullCount === 3 ? 'زخم صاعد قوي 📈 — 3 من 4 مؤشرات صاعدة. ابحث عن فرصة شراء مع وقف واضح تحت آخر قاع.'
    : result.bullCount === 2 ? 'تعارض في الزخم ⚠️ — الرأي منقسم بين الصعود والهبوط. انتظر توافقاً أكبر قبل الدخول.'
    : result.bullCount === 1 ? 'زخم هبوطي قوي 📉 — 3 من 4 مؤشرات هابطة. كن حذراً وابتعد عن الشراء.'
    : 'زخم هبوطي كامل 🔴 — جميع المؤشرات تشير للهبوط. تجنب الشراء وراقب فرص بيع محتملة.';

  const overallColor = !result ? '#6b7280' : result.bullCount >= 3 ? '#10b981' : result.bullCount <= 1 ? '#ef4444' : '#f59e0b';

  const indicators = !result ? [] : [
    { name: 'RSI (14)', val: `${result.rsi}`, bull: result.rsi > 50, detail: result.rsi > 70 ? 'تشبع شراء' : result.rsi < 30 ? 'تشبع بيع' : result.rsi > 50 ? 'صاعد' : 'هابط' },
    { name: 'MACD Histogram', val: result.macd.hist > 0 ? `+${result.macd.hist}` : `${result.macd.hist}`, bull: result.macd.hist > 0, detail: result.macd.hist > 0 ? 'زخم صاعد' : 'زخم هابط' },
    { name: 'Stochastic %K', val: `${result.stoch.k}`, bull: result.stoch.k > 50, detail: result.stoch.k > 80 ? 'تشبع شراء' : result.stoch.k < 20 ? 'تشبع بيع' : result.stoch.k > 50 ? 'صاعد' : 'هابط' },
    { name: 'ROC (10)', val: `${result.roc > 0 ? '+' : ''}${result.roc}%`, bull: result.roc > 0, detail: result.roc > 0 ? 'عائد موجب' : 'عائد سالب' },
  ];

const tool = slugToTool('momentum-intelligence');
  if (!tool) return notFound();

    return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-purple-500/70 tracking-widest uppercase border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Brain className="w-3 h-3" /> Momentum Intelligence</span>
        <h1 className="text-xl font-black text-white mt-1">محلل الزخم المتكامل</h1>
        <p className="text-sm text-white/40 font-mono">RSI + MACD + Stochastic + ROC — توافق 4 مؤشرات زخم حقيقية</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#9333ea,#6d28d9)', boxShadow: !loading ? '0 0 20px rgba(147,51,234,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحليل...' : 'تشغيل محلل الزخم'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              {/* ToolChart Component */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-purple-500/20 shadow-lg shadow-purple-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Momentum View
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 1D</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  overlays={[
                    { type: 'line', data: indicatorData.rsiArr, color: '#c084fc', title: 'RSI(14)', priceScaleId: 'left', lineWidth: 2 },
                    { type: 'histogram', data: indicatorData.macdHistArr, title: 'MACD Hist', priceScaleId: 'left' }
                  ]}
                />
              </div>

              {/* Overall Score */}
              <div className="rounded-2xl border p-6 flex items-center justify-between" style={{ borderColor: overallColor + '40', background: overallColor + '0a' }}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: overallColor }}>نتيجة الزخم الكلي</p>
                  <p className="text-2xl font-black text-white">{result.bullCount}/4 صاعد</p>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({length: 4}).map((_,i) => (
                    <motion.div key={i} initial={{scale:0}} animate={{scale:1}} transition={{delay: i*0.1, type:'spring'}}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: i < result.bullCount ? '#10b981' : '#ef4444' }}>
                      <span className="text-xs font-black text-black">{i < result.bullCount ? '▲' : '▼'}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* 4 Indicators */}
              <div className="flex flex-col gap-3">
                {indicators.map((ind, i) => (
                  <motion.div key={ind.name} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:i*0.1}}
                    className="rounded-xl border p-4 flex items-center justify-between"
                    style={{ borderColor: (ind.bull ? '#10b981' : '#ef4444') + '30', background: (ind.bull ? '#10b981' : '#ef4444') + '08' }}>
                    <div>
                      <p className="text-xs text-white/40 uppercase tracking-widest">{ind.name}</p>
                      <p className="text-lg font-black font-mono" style={{ color: ind.bull ? '#10b981' : '#ef4444' }}>{ind.val}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 rounded-full text-xs font-black" style={{ background: (ind.bull ? '#10b981' : '#ef4444') + '20', color: ind.bull ? '#10b981' : '#ef4444' }}>
                        {ind.detail}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border p-5" style={{ borderColor: overallColor + '30', background: overallColor + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: overallColor }}>الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
