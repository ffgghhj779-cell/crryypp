'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Droplets, ScanSearch, AlertCircle } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

function calcMFI(klines: { high: number; low: number; close: number; volume: number }[], period = 14): number {
  if (klines.length < period + 1) return 50;
  const slice = klines.slice(-(period + 1));
  let posFlow = 0, negFlow = 0;
  for (let i = 1; i < slice.length; i++) {
    const tp = (slice[i].high + slice[i].low + slice[i].close) / 3;
    const prevTp = (slice[i - 1].high + slice[i - 1].low + slice[i - 1].close) / 3;
    const mf = tp * slice[i].volume;
    if (tp > prevTp) posFlow += mf; else negFlow += mf;
  }
  if (negFlow === 0) return 100;
  if (posFlow === 0) return 0;
  return +(100 - 100 / (1 + posFlow / negFlow)).toFixed(1);
}

export default function FlowIndexPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [mfi, setMfi]       = useState<number | null>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 30);
      if (klines.length < 15) throw new Error('بيانات غير كافية');
      setMfi(calcMFI(klines));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const state = mfi === null ? null : mfi >= 80 ? { label: 'تشبع شراء', color: '#ef4444', bg: '#ef444410', advice: 'MFI فوق 80 — السوق في منطقة تشبع شراء. ابحث عن إشارة بيع للانعكاس.' }
    : mfi <= 20 ? { label: 'تشبع بيع', color: '#10b981', bg: '#10b98110', advice: 'MFI تحت 20 — السوق في منطقة تشبع بيع. ابحث عن فرصة شراء عند التأكيد.' }
    : mfi >= 60 ? { label: 'ضغط شراء', color: '#f59e0b', bg: '#f59e0b10', advice: 'MFI بين 60-80 — الضغط الشرائي سائد. الاتجاه الصاعد مدعوم ولكن راقب التشبع.' }
    : mfi <= 40 ? { label: 'ضغط بيع', color: '#f97316', bg: '#f9731610', advice: 'MFI بين 20-40 — الضغط البيعي سائد. توقع استمرار الهبوط ما لم يتعافَ.' }
    : { label: 'محايد', color: '#6b7280', bg: '#6b728010', advice: 'MFI بين 40-60 — السوق محايد. لا توجد إشارة قوية. انتظر خروجاً واضحاً من النطاق.' };

  const angle = mfi !== null ? -90 + (mfi / 100) * 180 : -90;

const tool = slugToTool('flow-index');
  if (!tool) return notFound();

    return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-sky-500/70 tracking-widest uppercase border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Droplets className="w-3 h-3" /> Money Flow Index</span>
        <h1 className="text-xl font-black text-white mt-1">مؤشر تدفق الأموال (MFI-14)</h1>
        <p className="text-sm text-white/40 font-mono">قياس ضغط الشراء والبيع بالحجم — مقياس 0-100</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: !loading ? '0 0 20px rgba(14,165,233,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الحساب...' : 'حساب MFI'}
          </button>
        </div>

        <AnimatePresence>
          {mfi !== null && state && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              {/* Gauge */}
              <div className="rounded-3xl border border-white/[0.08] bg-[#111] p-8 flex flex-col items-center gap-4 relative overflow-hidden">
                <p className="text-xs font-bold text-white/30 uppercase tracking-widest">مقياس MFI</p>
                <div className="relative w-56 h-28 overflow-hidden">
                  <svg viewBox="0 0 200 100" className="w-full h-full">
                    <defs>
                      <linearGradient id="mfiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%"   stopColor="#10b981" />
                        <stop offset="30%"  stopColor="#f59e0b" />
                        <stop offset="70%"  stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                    {/* Track */}
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#222" strokeWidth="18" strokeLinecap="round" />
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#mfiGrad)" strokeWidth="18" strokeLinecap="round" />
                    {/* Zones */}
                    <text x="12"  y="95" fill="#10b981" fontSize="9" fontFamily="monospace">0</text>
                    <text x="88"  y="22" fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="middle">50</text>
                    <text x="182" y="95" fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="end">100</text>
                    {/* Needle */}
                    <motion.g initial={{ rotate: -90 }} animate={{ rotate: angle }} transition={{ type: 'spring', stiffness: 50, damping: 14 }} style={{ originX: '100px', originY: '100px' }}>
                      <line x1="100" y1="100" x2="100" y2="28" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="100" cy="100" r="5" fill="#fff" />
                    </motion.g>
                  </svg>
                  <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
                    <span className="text-4xl font-black font-mono text-white">{mfi}</span>
                  </div>
                </div>
                {/* Zone Labels */}
                <div className="flex w-full justify-between text-xs font-bold uppercase tracking-widest">
                  <span className="text-emerald-400">تشبع بيع</span>
                  <span className="text-white/30">محايد</span>
                  <span className="text-red-400">تشبع شراء</span>
                </div>
                {/* State Badge */}
                <span className="px-5 py-2 rounded-full text-sm font-black" style={{ background: state.color + '20', color: state.color, border: `1px solid ${state.color}40` }}>{state.label}</span>
              </div>

              {/* Zones Reference */}
              <div className="grid grid-cols-3 gap-2">
                {[['<20', 'تشبع بيع', '#10b981'], ['20-80', 'منطقة عادية', '#6b7280'], ['>80', 'تشبع شراء', '#ef4444']].map(([range, lbl, col]) => (
                  <div key={range} className="rounded-xl p-3 flex flex-col gap-1" style={{ background: col + '10', border: `1px solid ${col}20` }}>
                    <p className="text-xs font-mono font-bold" style={{ color: col }}>{range}</p>
                    <p className="text-xs text-white/50">{lbl}</p>
                  </div>
                ))}
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border p-5" style={{ borderColor: state.color + '30', background: state.color + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: state.color }}>الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed">{state.advice}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
