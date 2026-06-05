'use client';

import { useState, useCallback } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Search, ScanSearch, AlertCircle, ArrowDown, ArrowUp, Minus, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';

interface Fractal {
  index: number;
  type: 'bullish' | 'bearish';
  price: number;
}

interface FractalResult {
  lastFractal: Fractal | null;
  allFractals: Fractal[];
  currentStructure: 'bullish' | 'bearish' | 'neutral';
  currentPrice: number;
  distancePct: number;
}

function detectFractals(klines: { high: number; low: number; close: number }[]): FractalResult {
  const fractals: Fractal[] = [];
  for (let i = 2; i < klines.length - 2; i++) {
    const c = klines[i];
    const l1 = klines[i - 1]; const l2 = klines[i - 2];
    const r1 = klines[i + 1]; const r2 = klines[i + 2];
    const isBearish = c.high > l1.high && c.high > l2.high && c.high > r1.high && c.high > r2.high;
    const isBullish = c.low  < l1.low  && c.low  < l2.low  && c.low  < r1.low  && c.low  < r2.low;
    if (isBearish) fractals.push({ index: i, type: 'bearish', price: c.high });
    else if (isBullish) fractals.push({ index: i, type: 'bullish', price: c.low });
  }
  const last = fractals[fractals.length - 1] ?? null;
  const cp = klines[klines.length - 1].close;
  const dist = last ? +Math.abs((cp - last.price) / last.price * 100).toFixed(2) : 0;
  const struct = last ? last.type : 'neutral';
  return { lastFractal: last, allFractals: fractals, currentStructure: struct, currentPrice: cp, distancePct: dist };
}

export default function FractalDetectorPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FractalResult | null>(null);

  const handleScan = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 50);
      if (klines.length < 5) throw new Error('بيانات غير كافية');
      const res = detectFractals(klines);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const fmtPrice = (p: number) =>
    p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  const verdictText = !result ? '' :
    result.currentStructure === 'bullish'
      ? `آخر فراكتل هبوطي (Bullish) عند ${fmtPrice(result.lastFractal!.price)} — يشير إلى نهاية موجة هبوط محتملة. ابحث عن تأكيد شرائي (شمعة دافعة صاعدة) قبل الدخول.`
      : result.currentStructure === 'bearish'
      ? `آخر فراكتل صعودي (Bearish) عند ${fmtPrice(result.lastFractal!.price)} — يشير إلى نهاية موجة صعود محتملة. كن حذراً وتوقع انعكاساً.`
      : 'لا يوجد فراكتل مؤكد في آخر 50 شمعة. الاتجاه الحالي مستمر دون إشارة انعكاس واضحة.';

const tool = slugToTool('fractal-detector');
  if (!tool) return notFound();

    return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-fuchsia-500/70 tracking-widest uppercase border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Search className="w-3 h-3" /> Williams Fractal
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">كاشف الفراكتل</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          رصد القمم والقيعان الانعكاسية بنمط الفراكتل الخماسي (Williams) من بيانات حقيقية
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Input */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white transition-all disabled:opacity-50"
            style={{
              background: loading ? '#1a1a1a' : 'linear-gradient(135deg, #d946ef, #a21caf)',
              boxShadow: !loading ? '0 0 20px rgba(217,70,239,0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الفحص...' : 'فحص الفراكتل (50 شمعة يومية)'}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-5">

              {/* Main Visual */}
              <motion.div
                className={`flex flex-col items-center justify-center gap-6 rounded-3xl border p-8 py-14 shadow-xl relative overflow-hidden
                  ${result.currentStructure === 'bullish' ? 'bg-emerald-500/10 border-emerald-500/30' :
                    result.currentStructure === 'bearish' ? 'bg-red-500/10 border-red-500/30' :
                    'bg-white/5 border-white/10'}`}
              >
                {result.currentStructure !== 'neutral' && (
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 blur-[80px] rounded-full pointer-events-none opacity-20 ${result.currentStructure === 'bullish' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                )}
                <div className="relative flex items-center justify-center">
                  {result.currentStructure === 'bullish' && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                      className="bg-emerald-500/20 p-6 rounded-full border border-emerald-500/30">
                      <ArrowUp className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                    </motion.div>
                  )}
                  {result.currentStructure === 'bearish' && (
                    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                      className="bg-red-500/20 p-6 rounded-full border border-red-500/30">
                      <ArrowDown className="w-16 h-16 text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                    </motion.div>
                  )}
                  {result.currentStructure === 'neutral' && (
                    <div className="bg-white/5 p-6 rounded-full border border-white/10">
                      <Minus className="w-12 h-12 text-white/20" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center z-10 text-center gap-2">
                  <h2 className={`text-2xl font-black ${result.currentStructure === 'bullish' ? 'text-emerald-400' : result.currentStructure === 'bearish' ? 'text-red-400' : 'text-white/40'}`}>
                    {result.currentStructure === 'bullish' ? 'فراكتل صاعد (Bullish)' :
                     result.currentStructure === 'bearish' ? 'فراكتل هابط (Bearish)' :
                     'لا يوجد فراكتل مؤكد'}
                  </h2>
                  {result.lastFractal && (
                    <p className="text-base font-bold text-white/60 font-mono">{fmtPrice(result.lastFractal.price)}</p>
                  )}
                  <p className="text-xs text-white/30 font-mono">المسافة من السعر الحالي: {result.distancePct}%</p>
                </div>
              </motion.div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4 flex flex-col gap-1">
                  <p className="text-xs text-white/40 uppercase tracking-widest">السعر الحالي</p>
                  <p className="text-base font-black text-white font-mono">{fmtPrice(result.currentPrice)}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4 flex flex-col gap-1">
                  <p className="text-xs text-emerald-400/60 uppercase tracking-widest">فراكتلات صاعدة</p>
                  <p className="text-xl font-black text-emerald-400">
                    {result.allFractals.filter(f => f.type === 'bullish').length}
                  </p>
                </div>
                <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4 flex flex-col gap-1">
                  <p className="text-xs text-red-400/60 uppercase tracking-widest">فراكتلات هابطة</p>
                  <p className="text-xl font-black text-red-400">
                    {result.allFractals.filter(f => f.type === 'bearish').length}
                  </p>
                </div>
              </div>

              {/* Verdict Card */}
              <div className={`rounded-2xl border p-5 ${result.currentStructure === 'bullish' ? 'border-emerald-500/20 bg-emerald-500/10' : result.currentStructure === 'bearish' ? 'border-red-500/20 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                <p className={`text-sm font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${result.currentStructure === 'bullish' ? 'text-emerald-400' : result.currentStructure === 'bearish' ? 'text-red-400' : 'text-white/40'}`}>
                  <Shield className="w-4 h-4" /> الدليل الإرشادي الفني
                </p>
                <p className="text-sm text-white/70 leading-relaxed">{verdictText}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
