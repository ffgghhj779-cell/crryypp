'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, ScanSearch, AlertCircle } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

interface FootprintCandle {
  date: string; open: number; high: number; low: number; close: number;
  volume: number; buyVol: number; sellVol: number; delta: number;
}

function calcFootprint(klines: { open: number; high: number; low: number; close: number; volume: number; time: number }[]): FootprintCandle[] {
  return klines.slice(-12).map(k => {
    const range = k.high - k.low || 0.0001;
    const buyVol  = +(k.volume * ((k.close - k.low) / range)).toFixed(2);
    const sellVol = +(k.volume - buyVol).toFixed(2);
    const delta   = +(buyVol - sellVol).toFixed(2);
    return {
      date: new Date(k.time).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
      open: k.open, high: k.high, low: k.low, close: k.close,
      volume: +k.volume.toFixed(2), buyVol, sellVol, delta,
    };
  });
}

const fmtV = (v: number) => v > 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v > 1000 ? `${(v/1000).toFixed(1)}K` : v.toFixed(1);
const fmtP = (p: number) => p.toLocaleString(undefined, { maximumFractionDigits: p > 1000 ? 1 : 4 });

export default function FootprintProPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [candles, setCandles] = useState<FootprintCandle[]>([]);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 20);
      if (klines.length < 5) throw new Error('بيانات غير كافية');
      setCandles(calcFootprint(klines));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const cumDelta   = candles.reduce((s, c) => s + c.delta, 0);
  const dominance  = cumDelta > 0 ? 'buy' : cumDelta < 0 ? 'sell' : 'neutral';
  const domColor   = dominance === 'buy' ? '#10b981' : dominance === 'sell' ? '#ef4444' : '#6b7280';
  const maxAbsDelta = Math.max(...candles.map(c => Math.abs(c.delta)), 1);

  const verdict = candles.length === 0 ? '' :
    dominance === 'buy'
      ? `الدلتا التراكمي موجب (${fmtV(cumDelta)}) — المشترون يتحكمون في آخر 12 جلسة. الضغط الشرائي حقيقي ومدعوم بالحجم.`
      : dominance === 'sell'
      ? `الدلتا التراكمي سالب (${fmtV(cumDelta)}) — البائعون يتحكمون في آخر 12 جلسة. الضغط البيعي قوي. احذر من الانخفاض.`
      : `الدلتا متوازن — لا هيمنة واضحة. السوق في حالة توازن بين المشترين والبائعين.`;

  const tool = slugToTool('footprint-pro');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-teal-500/70 tracking-widest uppercase border border-teal-500/20 bg-teal-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Layers className="w-3 h-3" /> Footprint Pro</span>
        <h1 className="text-xl font-black text-white mt-1">بصمة الحجم (Footprint)</h1>
        <p className="text-sm text-white/40 font-mono">حجم الشراء والبيع لكل شمعة — آخر 12 جلسة يومية</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#14b8a6,#0d9488)', boxShadow: !loading ? '0 0 20px rgba(20,184,166,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحليل...' : 'عرض بصمة الحجم'}
          </button>
        </div>

        <AnimatePresence>
          {candles.length > 0 && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              {/* Cumulative Delta */}
              <div className="rounded-2xl border p-5 flex items-center justify-between" style={{ borderColor: domColor + '40', background: domColor + '0a' }}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: domColor }}>الدلتا التراكمي (12 يوم)</p>
                  <p className="text-2xl font-black font-mono" style={{ color: domColor }}>{cumDelta > 0 ? '+' : ''}{fmtV(cumDelta)}</p>
                </div>
                <span className="text-2xl">{dominance === 'buy' ? '🟢' : dominance === 'sell' ? '🔴' : '⚪'}</span>
              </div>

              {/* Footprint Table */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d0d] overflow-hidden">
                <div className="grid grid-cols-5 px-3 py-2 border-b border-white/[0.06]" style={{ gridTemplateColumns: '2fr 2fr 2fr 2fr 2fr' }}>
                  {['التاريخ','الإغلاق','شراء','بيع','دلتا'].map(h => <p key={h} className="text-xs font-bold text-white/30 uppercase tracking-widest text-center">{h}</p>)}
                </div>
                <div className="flex flex-col">
                  {candles.map((c, i) => {
                    const dColor = c.delta >= 0 ? '#10b981' : '#ef4444';
                    const barW   = Math.abs(c.delta) / maxAbsDelta * 100;

return (
                      <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                        className="grid px-3 py-2.5 border-b border-white/[0.04] relative overflow-hidden"
                        style={{ gridTemplateColumns: '2fr 2fr 2fr 2fr 2fr' }}>
                        <div className="absolute inset-0 pointer-events-none" style={{ width: `${barW}%`, background: dColor + '08' }} />
                        <p className="text-xs text-white/40 font-mono text-center z-10">{c.date}</p>
                        <p className="text-xs font-bold text-white font-mono text-center z-10">{fmtP(c.close)}</p>
                        <p className="text-xs font-bold text-emerald-400 font-mono text-center z-10">{fmtV(c.buyVol)}</p>
                        <p className="text-xs font-bold text-red-400 font-mono text-center z-10">{fmtV(c.sellVol)}</p>
                        <p className="text-xs font-black font-mono text-center z-10" style={{ color: dColor }}>{c.delta > 0 ? '+' : ''}{fmtV(c.delta)}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-white/40 font-mono px-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />شراء</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" />بيع</span>
                <span className="flex items-center gap-1"><span className="w-6 h-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />شريط خلفي = حجم الدلتا</span>
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border p-5" style={{ borderColor: domColor + '30', background: domColor + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: domColor }}>الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
