'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ScanSearch, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

interface DeltaCandle { open: number; high: number; low: number; close: number; volume: number; buyVol: number; sellVol: number; delta: number; }
interface DeltaResult { candles: DeltaCandle[]; cumDelta: number; avgDelta: number; dominance: 'buy' | 'sell' | 'neutral'; currentPrice: number; }

function calcDelta(klines: { open: number; high: number; low: number; close: number; volume: number }[]): DeltaResult {
  const candles: DeltaCandle[] = klines.slice(-20).map(k => {
    const range = k.high - k.low || 0.0001;
    const buyVol  = k.volume * ((k.close - k.low) / range);
    const sellVol = k.volume - buyVol;
    return { ...k, buyVol: +buyVol.toFixed(2), sellVol: +sellVol.toFixed(2), delta: +(buyVol - sellVol).toFixed(2) };
  });
  const cumDelta = candles.reduce((s, c) => s + c.delta, 0);
  const avgDelta = cumDelta / candles.length;
  const dominance: 'buy' | 'sell' | 'neutral' = cumDelta > 0 ? 'buy' : cumDelta < 0 ? 'sell' : 'neutral';
  const currentPrice = klines[klines.length - 1].close;
  return { candles, cumDelta: +cumDelta.toFixed(0), avgDelta: +avgDelta.toFixed(0), dominance, currentPrice };
}

export default function VolumeDeltaPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DeltaResult | null>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 50);
      if (klines.length < 5) throw new Error('بيانات غير كافية');
      setResult(calcDelta(klines));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const fmtVol = (v: number) => v > 1_000_000 ? `${(v/1_000_000).toFixed(2)}M` : v > 1000 ? `${(v/1000).toFixed(1)}K` : v.toFixed(0);
  const domColor = result?.dominance === 'buy' ? '#10b981' : result?.dominance === 'sell' ? '#ef4444' : '#6b7280';
  const verdict = !result ? '' :
    result.dominance === 'buy'
      ? `دلتا الحجم التراكمي موجب (+${fmtVol(result.cumDelta)}) — المشترون يسيطرون. الضغط الشرائي قوي. توقع استمرار الصعود أو تأكيد الدعم.`
      : result.dominance === 'sell'
      ? `دلتا الحجم التراكمي سالب (${fmtVol(result.cumDelta)}) — البائعون يسيطرون. الضغط البيعي قوي. كن حذراً وتوقع مقاومة أو هبوطاً.`
      : `الدلتا متوازن — لا يوجد هيمنة واضحة للمشترين أو البائعين.`;

  const maxVol = result ? Math.max(...result.candles.map(c => c.volume)) : 1;

  const tool = slugToTool('volume-delta');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-cyan-500/70 tracking-widest uppercase border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Activity className="w-3 h-3" /> Volume Delta</span>
        <h1 className="text-xl font-black text-white mt-1">محلل دلتا الحجم</h1>
        <p className="text-sm text-white/40 font-mono">حجم المشترين مقابل البائعين — الضغط الحقيقي في السوق</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all" style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#06b6d4,#0891b2)', boxShadow: !loading ? '0 0 20px rgba(6,182,212,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحليل...' : 'تحليل الحجم (20 شمعة)'}
          </button>
        </div>
        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              {/* Dominance Card */}
              <div className="rounded-2xl border p-6 flex items-center justify-between" style={{ borderColor: domColor + '40', background: domColor + '10' }}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: domColor }}>هيمنة الحجم</p>
                  <p className="text-2xl font-black text-white">{result.dominance === 'buy' ? '🟢 مشترون' : result.dominance === 'sell' ? '🔴 بائعون' : '⚪ متوازن'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40">الدلتا التراكمي</p>
                  <p className="text-xl font-black font-mono" style={{ color: domColor }}>{result.cumDelta > 0 ? '+' : ''}{fmtVol(result.cumDelta)}</p>
                </div>
              </div>
              {/* Bar Chart */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5">
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">دلتا الحجم — آخر 20 شمعة يومية</p>
                <div className="flex items-end gap-1 h-32">
                  {result.candles.map((c, i) => {
                    const h = Math.abs(c.delta) / (Math.max(...result.candles.map(x => Math.abs(x.delta))) || 1) * 100;

return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`D: ${fmtVol(c.delta)}`}>
                        <div className="w-full rounded-sm" style={{ height: `${Math.max(4, h)}%`, background: c.delta >= 0 ? '#10b981' : '#ef4444', opacity: 0.8 }} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-white/20 font-mono"><span>أقدم</span><span>أحدث</span></div>
              </div>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4"><p className="text-xs text-emerald-400/60 mb-1">متوسط شراء/شمعة</p><p className="text-base font-black text-emerald-400 font-mono">{fmtVol(result.candles.reduce((s,c)=>s+c.buyVol,0)/result.candles.length)}</p></div>
                <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4"><p className="text-xs text-red-400/60 mb-1">متوسط بيع/شمعة</p><p className="text-base font-black text-red-400 font-mono">{fmtVol(result.candles.reduce((s,c)=>s+c.sellVol,0)/result.candles.length)}</p></div>
              </div>
              {/* Verdict */}
              <div className="rounded-2xl border p-5" style={{ borderColor: domColor + '30', background: domColor + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: domColor }}>الدليل الإرشادي الفني</p>
                <p className="text-sm text-white/70 leading-relaxed">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
