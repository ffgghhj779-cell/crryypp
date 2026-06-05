'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scale, ScanSearch, AlertCircle, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';

interface GannResult {
  price: number;
  sqrtPrice: number;
  nearestAngle: number;
  nearestAnglePrice: number;
  allAngles: { angle: number; price: number; distance: number }[];
  isSquared: boolean;
  squaringScore: number; // 0-100
  verdict: string;
  recommendation: string;
}

function calcGann(price: number): GannResult {
  const sqrtPrice = Math.sqrt(price);
  const angles = [90, 180, 270, 360, 450, 540, 630, 720];

  const allAngles = angles.map(angle => {
    const candidatePrice = angle * angle;
    return {
      angle,
      price: candidatePrice,
      distance: Math.abs(sqrtPrice - angle),
    };
  });

  // Find nearest whole angle (nearest integer sqrt)
  const nearestInt = Math.round(sqrtPrice);
  const nearestAngle = nearestInt * nearestInt;
  const distancePct = Math.abs(price - nearestAngle) / nearestAngle * 100;

  // Also check multiples of 45°
  const gann45s = [45, 90, 135, 180, 225, 270, 315, 360, 405, 450];
  const nearestGann45 = gann45s.reduce((prev, curr) =>
    Math.abs(sqrtPrice - curr / 45 * 10) < Math.abs(sqrtPrice - prev / 45 * 10) ? curr : prev
  );

  // Closest angle-price
  const closestAngle = allAngles.sort((a, b) => a.distance - b.distance)[0];
  const sortedAngles = [...allAngles].sort((a, b) => a.distance - b.distance);

  // Squaring score: 100 = perfect square, 0 = far
  const squaringScore = Math.max(0, Math.round(100 - distancePct * 10));
  const isSquared = squaringScore >= 75;

  const verdict = isSquared
    ? `السعر قريب من مربع زمني عند ${nearestAngle.toFixed(0)} — احتمالية انعكاس عالية`
    : `السعر بعيد عن أي مربع زمني — الاتجاه مرجح للاستمرار`;

  const recommendation = isSquared
    ? `⚠️ تنبيه: السعر عند ${price.toLocaleString()} قريب من مربع Gann (√${price.toFixed(0)} ≈ ${sqrtPrice.toFixed(2)}). هذه منطقة انتباه قصوى — ابحث عن تأكيد الانعكاس قبل الدخول.`
    : `✅ السعر يتحرك بعيداً عن مناطق التربيع. الاتجاه مرجح أن يستمر. أقرب منطقة تربيع عند ${closestAngle.price.toFixed(0)}.`;

  return {
    price,
    sqrtPrice: +sqrtPrice.toFixed(4),
    nearestAngle,
    nearestAnglePrice: nearestAngle,
    allAngles: sortedAngles,
    isSquared,
    squaringScore,
    verdict,
    recommendation,
  };
}

export default function GannSquaringPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [result, setResult] = useState<GannResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tool = slugToTool('gann-squaring');
  if (!tool) return notFound();

  const handleAnalyze = async () => {
    setError('');
    setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 2);
      if (!klines || klines.length === 0) throw new Error('لا توجد بيانات لهذا الأصل');
      const price = klines[klines.length - 1].close;
      const res = calcGann(price);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const priceStr = (p: number) =>
    p.toLocaleString(undefined, { minimumFractionDigits: p > 100 ? 0 : 4, maximumFractionDigits: p > 100 ? 0 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool!} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Scale className="w-3 h-3" /> Gann Geometry
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">كاشف تربيع السعر والزمن</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          نظرية Gann: عندما يساوي الجذر التربيعي للسعر زاوية زمنية → نقطة انعكاس محتملة
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
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white transition-all disabled:opacity-50"
            style={{
              background: loading ? '#1a1a1a' : 'linear-gradient(135deg, #eab308, #ca8a04)',
              boxShadow: !loading ? '0 0 20px rgba(234,179,8,0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الحساب...' : 'تحليل التربيع'}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-5">

              {/* Main Visual */}
              <div className={`rounded-3xl border p-8 flex flex-col items-center justify-center shadow-xl relative overflow-hidden transition-all ${result.isSquared ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'bg-[#0d0d0d] border-white/10'}`}>
                {result.isSquared && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none" />
                )}
                <motion.div
                  animate={result.isSquared ? { rotate: [0, 5, -5, 0] } : { rotate: 15 }}
                  transition={result.isSquared ? { repeat: Infinity, duration: 4, ease: 'easeInOut' } : {}}
                  className="mb-6"
                >
                  <Scale className={`w-20 h-20 ${result.isSquared ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]' : 'text-white/20'}`} />
                </motion.div>

                {/* Score Ring */}
                <div className="relative w-28 h-28 mb-4">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={result.isSquared ? '#10b981' : '#eab308'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - result.squaringScore / 100) }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className={`text-2xl font-black ${result.isSquared ? 'text-emerald-400' : 'text-yellow-400'}`}>{result.squaringScore}</span>
                    <span className="text-xs text-white/40 font-bold">/ 100</span>
                  </div>
                </div>

                <h2 className={`text-xl font-black z-10 text-center ${result.isSquared ? 'text-emerald-400' : 'text-white/40'}`}>{result.verdict}</h2>
              </div>

              {/* Math Breakdown */}
              <div className="rounded-xl border border-white/[0.08] bg-[#111] p-5">
                <p className="text-sm font-bold text-yellow-400/60 uppercase tracking-widest mb-4">الحسابات الهندسية</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'السعر الحالي', val: priceStr(result.price), color: 'text-white' },
                    { label: '√ السعر', val: result.sqrtPrice.toFixed(4), color: 'text-yellow-400' },
                    { label: 'أقرب مربع كامل', val: priceStr(result.nearestAnglePrice), color: 'text-blue-400' },
                    { label: 'درجة التربيع', val: `${result.squaringScore}%`, color: result.isSquared ? 'text-emerald-400' : 'text-white/60' },
                  ].map(item => (
                    <div key={item.label} className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-white/30 mb-1">{item.label}</p>
                      <p className={`text-lg font-black font-mono ${item.color}`}>{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Angle Table */}
              <div className="rounded-xl border border-white/[0.08] bg-[#111] p-5">
                <p className="text-sm font-bold text-yellow-400/60 uppercase tracking-widest mb-3">مناطق التربيع الرئيسية</p>
                <div className="flex flex-col gap-2">
                  {result.allAngles.slice(0, 5).map((a, i) => {
                    const isClosest = i === 0;
                    return (
                      <div key={a.angle} className={`flex items-center justify-between px-3 py-2 rounded-lg ${isClosest ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/[0.03]'}`}>
                        <span className={`text-sm font-bold font-mono ${isClosest ? 'text-yellow-400' : 'text-white/40'}`}>√{a.price.toFixed(0)} ≈ {a.angle}</span>
                        <span className={`text-sm font-black font-mono ${isClosest ? 'text-white' : 'text-white/30'}`}>{priceStr(a.price)}</span>
                        {isClosest && <Zap className="w-4 h-4 text-yellow-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Verdict */}
              <div className={`rounded-2xl border p-5 ${result.isSquared ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-yellow-500/20 bg-yellow-500/10'}`}>
                <p className={`text-sm font-black uppercase tracking-widest mb-2 ${result.isSquared ? 'text-emerald-400' : 'text-yellow-400'}`}>الدليل الإرشادي الفني</p>
                <p className="text-sm text-white/70 leading-relaxed">{result.recommendation}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
