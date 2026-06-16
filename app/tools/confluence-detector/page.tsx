'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, ScanSearch, Shield, Star, AlertCircle } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart } from '@/components/tools/ToolChart';

interface ConfluenceLevel {
  price: number;
  type: 'support' | 'resistance';
  sources: string[];
  strength: number;
  distancePct: number;
}

export default function ConfluenceDetectorPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [levels, setLevels] = useState<ConfluenceLevel[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [klines, setKlines] = useState<any[]>([]);

  const tool = slugToTool('confluence-detector');
  if (!tool) return notFound();

  const handleScan = async () => {
    setError('');
    setLoading(true);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (fetchedKlines.length < 10) throw new Error('بيانات غير كافية');

      setKlines(fetchedKlines);
      const cp = fetchedKlines[fetchedKlines.length - 1].close;
      setCurrentPrice(cp);

      // ─── Swing High/Low from last 100 candles ────────────────────────
      const swingHigh = Math.max(...fetchedKlines.map(k => k.high));
      const swingLow  = Math.min(...fetchedKlines.map(k => k.low));
      const range = swingHigh - swingLow;

      // ─── Fibonacci Levels ─────────────────────────────────────────────
      const fibRatios = [0.236, 0.382, 0.5, 0.618, 0.786];
      const fibLevels = fibRatios.map(r => ({
        price: swingLow + range * r,
        label: `فيبوناتشي ${r}`
      }));

      // ─── Pivot Points (from previous completed candle) ────────────────
      const prev = fetchedKlines[fetchedKlines.length - 2];
      const pp = (prev.high + prev.low + prev.close) / 3;
      const r1 = 2 * pp - prev.low;
      const r2 = pp + (prev.high - prev.low);
      const s1 = 2 * pp - prev.high;
      const s2 = pp - (prev.high - prev.low);
      const pivotLevels = [
        { price: pp, label: 'Pivot PP' },
        { price: r1, label: 'Pivot R1' },
        { price: r2, label: 'Pivot R2' },
        { price: s1, label: 'Pivot S1' },
        { price: s2, label: 'Pivot S2' },
      ];

      // ─── VWAP (last 20 candles) ───────────────────────────────────────
      const last20 = fetchedKlines.slice(-20);
      const vwapNum = last20.reduce((acc, k) => acc + ((k.high + k.low + k.close) / 3) * k.volume, 0);
      const vwapDen = last20.reduce((acc, k) => acc + k.volume, 0);
      const vwap = vwapNum / (vwapDen || 1);

      // ─── Merge all levels ─────────────────────────────────────────────
      const allLevels = [
        ...fibLevels,
        ...pivotLevels,
        { price: vwap, label: 'VWAP (20)' },
      ];

      // ─── Group by confluence (±0.5% tolerance) ───────────────────────
      const grouped: ConfluenceLevel[] = [];
      for (const lv of allLevels) {
        const tol = lv.price * 0.005;
        const existing = grouped.find(g => Math.abs(g.price - lv.price) <= tol);
        if (existing) {
          existing.sources.push(lv.label);
          existing.price = (existing.price + lv.price) / 2;
        } else {
          grouped.push({
            price: lv.price,
            type: lv.price > cp ? 'resistance' : 'support',
            sources: [lv.label],
            strength: 1,
            distancePct: +Math.abs((lv.price - cp) / cp * 100).toFixed(2),
          });
        }
      }
      grouped.forEach(g => { g.strength = Math.min(5, g.sources.length); });

      const sorted = grouped
        .sort((a, b) => b.strength - a.strength || a.distancePct - b.distancePct)
        .slice(0, 6);
      setLevels(sorted);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const fmtPrice = (p: number) =>
    p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  const strongestResistance = levels.filter(l => l.type === 'resistance').sort((a, b) => b.strength - a.strength)[0];
  const strongestSupport    = levels.filter(l => l.type === 'support').sort((a, b) => b.strength - a.strength)[0];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool!} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-purple-500/70 tracking-widest uppercase border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Crosshair className="w-3 h-3" /> Confluence Detector
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">كاشف مستويات التوافق</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          يجمع فيبوناتشي + Pivot Points + VWAP ليكشف أقوى المستويات السعرية
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
              background: loading ? '#1a1a1a' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
              boxShadow: !loading ? '0 0 20px rgba(168,85,247,0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري المسح...' : 'تشغيل ماسح التوافق'}
          </button>
        </div>

        {/* Current Price */}
        {currentPrice > 0 && (
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
            <span className="text-sm text-white/40 font-bold uppercase tracking-widest">السعر الحالي</span>
            <span className="text-xl font-black text-white font-mono">{fmtPrice(currentPrice)}</span>
          </div>
        )}

        {/* Levels List */}
        <AnimatePresence>
          {levels.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              
              {/* ToolChart Component */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-purple-500/20 shadow-lg shadow-purple-500/5 mb-2">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2">
                    <Crosshair className="w-4 h-4" /> Confluence Zones
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 1D</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  priceLines={levels.map(l => ({
                    price: l.price,
                    title: `${l.strength} Stars`,
                    color: l.type === 'resistance' ? '#ef4444' : '#10b981',
                    lineStyle: 0,
                    lineWidth: Math.min(l.strength, 4) as 1 | 2 | 3 | 4
                  }))}
                />
              </div>

              <h2 className="text-base font-bold text-purple-400 pr-2 border-r-2 border-purple-500">
                أقوى مستويات التوافق
              </h2>
              {levels.map((lv, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`rounded-xl border p-4 flex flex-col gap-2 ${lv.type === 'resistance' ? 'border-red-500/20 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-bold uppercase tracking-widest ${lv.type === 'resistance' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {lv.type === 'resistance' ? '🔴 مقاومة' : '🟢 دعم'}
                      </span>
                      <span className="text-lg font-black text-white font-mono">{fmtPrice(lv.price)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-white/40">المسافة</span>
                      <span className="text-sm font-bold text-white/70">{lv.distancePct}%</span>
                      {/* Stars */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} className={`w-3 h-3 ${s < lv.strength ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Sources */}
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/[0.05]">
                    {lv.sources.map((src, j) => (
                      <span key={j} className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-xs font-bold text-white/60">
                        <Shield className="w-3 h-3" /> {src}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Verdict Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5 mt-2"
              >
                <p className="text-sm font-black text-purple-400 uppercase tracking-widest mb-3">الدليل الإرشادي</p>
                <div className="flex flex-col gap-2">
                  {strongestResistance && (
                    <div className="flex items-start gap-2">
                      <span className="text-red-400 font-bold text-sm shrink-0">🔴</span>
                      <p className="text-sm text-white/70">
                        المقاومة الرئيسية عند <span className="font-black text-red-300 font-mono">{fmtPrice(strongestResistance.price)}</span> ({strongestResistance.strength} مؤشرات متوافقة) — يُعتبر حاجزاً قوياً أمام السعر.
                      </p>
                    </div>
                  )}
                  {strongestSupport && (
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold text-sm shrink-0">🟢</span>
                      <p className="text-sm text-white/70">
                        الدعم الرئيسي عند <span className="font-black text-emerald-300 font-mono">{fmtPrice(strongestSupport.price)}</span> ({strongestSupport.strength} مؤشرات متوافقة) — منطقة قوية للارتداد.
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-white/40 mt-2 pt-2 border-t border-white/10">
                    💡 كلما زاد عدد المؤشرات المتوافقة عند سعر واحد (نجوم أكثر) كلما زادت أهمية هذا المستوى. استخدمه كنقطة دخول أو وقف خسارة.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
