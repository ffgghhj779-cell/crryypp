'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, ScanSearch, AlertCircle } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

interface OrderLevel { price: number; size: number; side: 'bid' | 'ask'; pct: number; }
interface BookResult { bids: OrderLevel[]; asks: OrderLevel[]; currentPrice: number; spread: number; bidWall: number; askWall: number; }

function buildOrderBook(klines: { high: number; low: number; close: number; volume: number }[]): BookResult {
  const currentPrice = klines[klines.length - 1].close;
  const avgVol = klines.reduce((s, k) => s + k.volume, 0) / klines.length;

  // Generate 5 bid levels from swing lows below current price
  const lows = [...klines].sort((a, b) => a.low - b.low);
  const highs = [...klines].sort((a, b) => b.high - a.high);

  const bids: OrderLevel[] = lows
    .filter(k => k.low < currentPrice)
    .slice(0, 8)
    .map(k => ({ price: k.low, size: +(k.volume).toFixed(2), side: 'bid' as const, pct: 0 }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 5);

  const asks: OrderLevel[] = highs
    .filter(k => k.high > currentPrice)
    .slice(0, 8)
    .map(k => ({ price: k.high, size: +(k.volume).toFixed(2), side: 'ask' as const, pct: 0 }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);

  const maxSize = Math.max(...[...bids, ...asks].map(l => l.size), 1);
  bids.forEach(b => b.pct = Math.round(b.size / maxSize * 100));
  asks.forEach(a => a.pct = Math.round(a.size / maxSize * 100));

  const bidWall = bids.reduce((s, b) => s + b.size, 0);
  const askWall = asks.reduce((s, a) => s + a.size, 0);
  const spread  = asks[0] && bids[0] ? +(asks[0].price - bids[0].price).toFixed(4) : 0;

  return { bids, asks, currentPrice, spread, bidWall, askWall };
}

const fmtP = (p: number) => p.toLocaleString(undefined, { maximumFractionDigits: p > 1000 ? 1 : 4 });
const fmtV = (v: number) => v > 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v > 1000 ? `${(v/1000).toFixed(1)}K` : v.toFixed(1);

export default function OrderBookPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [book, setBook]     = useState<BookResult | null>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 60);
      if (klines.length < 10) throw new Error('بيانات غير كافية');
      setBook(buildOrderBook(klines));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const bias    = book ? book.bidWall > book.askWall ? 'buy' : 'sell' : 'neutral';
  const biasClr = bias === 'buy' ? '#10b981' : bias === 'sell' ? '#ef4444' : '#6b7280';

  const verdict = !book ? '' :
    bias === 'buy'
      ? `جدار الشراء (${fmtV(book.bidWall)}) أقوى من جدار البيع (${fmtV(book.askWall)}) — الضغط الشرائي يدعم الصعود. السعر محمي من الأسفل.`
      : `جدار البيع (${fmtV(book.askWall)}) أقوى من جدار الشراء (${fmtV(book.bidWall)}) — مقاومة قوية من الأعلى. توقع صعوبة في الاختراق.`;

const tool = slugToTool('order-book');
  if (!tool) return notFound();

    return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-blue-500/70 tracking-widest uppercase border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><BookOpen className="w-3 h-3" /> Order Book</span>
        <h1 className="text-xl font-black text-white mt-1">دفتر الأوامر</h1>
        <p className="text-sm text-white/40 font-mono">مستويات الدعم والمقاومة كأوامر شراء وبيع مُرتبة</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)', boxShadow: !loading ? '0 0 20px rgba(59,130,246,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحميل...' : 'عرض دفتر الأوامر'}
          </button>
        </div>

        <AnimatePresence>
          {book && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              {/* Book Table */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d0d] overflow-hidden" dir="ltr">
                {/* ASK header */}
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/10">
                  <p className="text-xs font-bold text-red-400/60 uppercase tracking-widest text-center">عروض البيع (Asks)</p>
                </div>
                {/* ASKs — reversed so lowest ask is closest to mid */}
                {[...book.asks].reverse().map((a, i) => (
                  <motion.div key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.05}}
                    className="relative flex items-center px-4 py-2.5 border-b border-white/[0.03] overflow-hidden">
                    <div className="absolute inset-0 left-auto" style={{ width: `${a.pct}%`, background: '#ef444412' }} />
                    <span className="flex-1 text-sm font-black text-red-400 font-mono z-10">{fmtP(a.price)}</span>
                    <span className="text-xs text-white/30 font-mono z-10">{fmtV(a.size)}</span>
                  </motion.div>
                ))}
                {/* Current Price */}
                <div className="px-4 py-3 bg-white/[0.06] border-y border-white/20 flex items-center justify-between">
                  <span className="text-xs text-white/40 font-bold uppercase">السعر الحالي</span>
                  <span className="text-base font-black text-white font-mono">{fmtP(book.currentPrice)}</span>
                  <span className="text-xs text-white/30 font-mono">Spread: {fmtP(book.spread)}</span>
                </div>
                {/* BIDs */}
                {book.bids.map((b, i) => (
                  <motion.div key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.05}}
                    className="relative flex items-center px-4 py-2.5 border-b border-white/[0.03] overflow-hidden">
                    <div className="absolute inset-0 right-auto" style={{ width: `${b.pct}%`, background: '#10b98112' }} />
                    <span className="flex-1 text-sm font-black text-emerald-400 font-mono z-10">{fmtP(b.price)}</span>
                    <span className="text-xs text-white/30 font-mono z-10">{fmtV(b.size)}</span>
                  </motion.div>
                ))}
                {/* BID header */}
                <div className="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/10">
                  <p className="text-xs font-bold text-emerald-400/60 uppercase tracking-widest text-center">أوامر الشراء (Bids)</p>
                </div>
              </div>

              {/* Wall Comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                  <p className="text-xs text-emerald-400/60 mb-1">جدار الشراء</p>
                  <p className="text-lg font-black text-emerald-400 font-mono">{fmtV(book.bidWall)}</p>
                </div>
                <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4">
                  <p className="text-xs text-red-400/60 mb-1">جدار البيع</p>
                  <p className="text-lg font-black text-red-400 font-mono">{fmtV(book.askWall)}</p>
                </div>
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border p-5" style={{ borderColor: biasClr + '30', background: biasClr + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: biasClr }}>الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
