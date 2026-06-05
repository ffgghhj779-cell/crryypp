'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ScanSearch, AlertCircle, Target } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

interface LiqZone { price: number; strength: number; side: 'buy' | 'sell'; label: string; }
interface LiqResult { buySide: LiqZone[]; sellSide: LiqZone[]; currentPrice: number; nearestBuy: LiqZone; nearestSell: LiqZone; }

function detectLiquidityZones(klines: { high: number; low: number; close: number; volume: number }[]): LiqResult {
  const currentPrice = klines[klines.length - 1].close;
  // Find swing highs (resistance / sell-side liq) and swing lows (support / buy-side liq)
  const swingHighs: { price: number; vol: number }[] = [];
  const swingLows:  { price: number; vol: number }[] = [];

  for (let i = 2; i < klines.length - 2; i++) {
    const c = klines[i], l1 = klines[i-1], l2 = klines[i-2], r1 = klines[i+1], r2 = klines[i+2];
    if (c.high > l1.high && c.high > l2.high && c.high > r1.high && c.high > r2.high)
      swingHighs.push({ price: c.high, vol: c.volume });
    if (c.low < l1.low && c.low < l2.low && c.low < r1.low && c.low < r2.low)
      swingLows.push({ price: c.low, vol: c.volume });
  }

  // Sort by volume strength and take top 5
  const maxVol = Math.max(...klines.map(k => k.volume), 1);
  const toZones = (arr: typeof swingHighs, side: 'buy' | 'sell'): LiqZone[] =>
    arr
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 5)
      .map((z, i) => ({ price: z.price, strength: Math.round((z.vol / maxVol) * 100), side, label: `مستوى ${i + 1}` }))
      .sort((a, b) => side === 'sell' ? b.price - a.price : a.price - b.price);

  const sellSide = toZones(swingHighs, 'sell');
  const buySide  = toZones(swingLows,  'buy');

  const nearestSell = sellSide.find(z => z.price > currentPrice) ?? sellSide[0];
  const nearestBuy  = buySide.find(z => z.price < currentPrice)  ?? buySide[0];

  return { buySide, sellSide, currentPrice, nearestBuy, nearestSell };
}

const fmtP = (p: number) => p.toLocaleString(undefined, { maximumFractionDigits: p > 1000 ? 1 : 4 });

export default function LiquidityHeatmapPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [result, setResult] = useState<LiqResult | null>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (klines.length < 10) throw new Error('بيانات غير كافية');
      setResult(detectLiquidityZones(klines));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const verdict = !result ? '' :
    `أقرب سيولة بيعية (مقاومة): ${fmtP(result.nearestSell?.price)} — وأقرب سيولة شرائية (دعم): ${fmtP(result.nearestBuy?.price)}. ` +
    `السوق يتحرك نحو أعلى مستوى سيولة. عند الاقتراب من هذه المناطق توقع تسارعاً في الحركة أو انعكاساً.`;

const tool = slugToTool('liquidity-heatmap');
  if (!tool) return notFound();

    return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Flame className="w-3 h-3" /> Liquidity Map</span>
        <h1 className="text-xl font-black text-white mt-1">خريطة السيولة</h1>
        <p className="text-sm text-white/40 font-mono">رصد مناطق السيولة الشرائية والبيعية من البيانات الحقيقية</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#f97316,#c2410c)', boxShadow: !loading ? '0 0 20px rgba(249,115,22,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الفحص...' : 'كشف مناطق السيولة'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              {/* Current Price Banner */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">السعر الحالي</span>
                <span className="text-base font-black text-white font-mono">{fmtP(result.currentPrice)}</span>
              </div>

              {/* Sell Side (Resistance) */}
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                <p className="text-xs font-bold text-red-400/60 uppercase tracking-widest mb-3">🔴 سيولة بيعية (مقاومات)</p>
                <div className="flex flex-col gap-2">
                  {result.sellSide.map((z, i) => (
                    <motion.div key={i} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}}
                      className="flex items-center gap-3 relative overflow-hidden rounded-lg px-3 py-2.5" style={{ background: '#ef444408' }}>
                      <div className="absolute inset-0 right-auto" style={{ width: `${z.strength}%`, background: '#ef444415' }} />
                      <span className="text-xs text-white/30 font-mono w-12 z-10">#{i+1}</span>
                      <span className="flex-1 text-sm font-black text-white font-mono z-10">{fmtP(z.price)}</span>
                      <div className="flex items-center gap-1 z-10">
                        <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.max(16, z.strength * 0.8)}px` }} />
                        <span className="text-xs text-red-400 font-mono">{z.strength}%</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Buy Side (Support) */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-xs font-bold text-emerald-400/60 uppercase tracking-widest mb-3">🟢 سيولة شرائية (دعوم)</p>
                <div className="flex flex-col gap-2">
                  {result.buySide.map((z, i) => (
                    <motion.div key={i} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}}
                      className="flex items-center gap-3 relative overflow-hidden rounded-lg px-3 py-2.5" style={{ background: '#10b98108' }}>
                      <div className="absolute inset-0 right-auto" style={{ width: `${z.strength}%`, background: '#10b98115' }} />
                      <span className="text-xs text-white/30 font-mono w-12 z-10">#{i+1}</span>
                      <span className="flex-1 text-sm font-black text-white font-mono z-10">{fmtP(z.price)}</span>
                      <div className="flex items-center gap-1 z-10">
                        <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${Math.max(16, z.strength * 0.8)}px` }} />
                        <span className="text-xs text-emerald-400 font-mono">{z.strength}%</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/08 p-5">
                <p className="text-sm font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Target className="w-4 h-4" /> الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
