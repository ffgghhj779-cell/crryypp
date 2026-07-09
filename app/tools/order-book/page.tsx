'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, ScanSearch, AlertCircle, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

interface OrderLevel { price: number; size: number; side: 'bid' | 'ask'; pct: number; }
interface BookResult {
  bids: OrderLevel[];
  asks: OrderLevel[];
  currentPrice: number;
  spread: number;
  bidWall: number;
  askWall: number;
  imbalance: number; // -100 to 100
}

function processDepthData(rawBids: string[][], rawAsks: string[][], limit: number = 20): BookResult {
  let bids: OrderLevel[] = rawBids.slice(0, limit).map(b => ({
    price: parseFloat(b[0]), size: parseFloat(b[1]), side: 'bid', pct: 0
  }));
  let asks: OrderLevel[] = rawAsks.slice(0, limit).map(a => ({
    price: parseFloat(a[0]), size: parseFloat(a[1]), side: 'ask', pct: 0
  }));

  const maxSize = Math.max(...[...bids, ...asks].map(l => l.size), 0.0001);
  
  bids.forEach(b => b.pct = Math.round((b.size / maxSize) * 100));
  asks.forEach(a => a.pct = Math.round((a.size / maxSize) * 100));

  const bidWall = bids.reduce((sum, b) => sum + b.size * b.price, 0);
  const askWall = asks.reduce((sum, a) => sum + a.size * a.price, 0);
  
  const totalWall = bidWall + askWall || 1;
  const imbalance = ((bidWall - askWall) / totalWall) * 100; // Positive = Bid heavy (Bullish), Negative = Ask heavy (Bearish)

  const spread = asks.length && bids.length ? +(asks[0].price - bids[0].price).toFixed(4) : 0;
  const currentPrice = asks.length && bids.length ? (asks[0].price + bids[0].price) / 2 : 0;

  return { bids, asks, currentPrice, spread, bidWall, askWall, imbalance };
}

const fmtP = (p: number) => p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtV = (v: number) => {
  if (v > 1_000_000_000) return `$${(v/1_000_000_000).toFixed(2)}B`;
  if (v > 1_000_000) return `$${(v/1_000_000).toFixed(2)}M`;
  if (v > 1_000) return `$${(v/1_000).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
};

export default function OrderBookPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [book, setBook] = useState<BookResult | null>(null);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setBook(null);
    try {
      const isCommodity = ['XAUUSD', 'WTIUSD', 'USDEGP', 'EGYXAU', 'BRENTUSD', 'EURUSD'].includes(symbol.toUpperCase().trim());
      if (isCommodity) {
        throw new Error('دفتر الأوامر غير متاح للسلع والعملات الورقية. الرجاء اختيار عملة رقمية.');
      }

      const res = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol.toUpperCase().trim()}&limit=100`);
      if (!res.ok) throw new Error('فشل جلب دفتر الأوامر من خوادم باينانس');
      
      const data = await res.json();
      if (!data.bids || !data.asks || data.bids.length === 0) throw new Error('لا توجد سيولة كافية في دفتر الأوامر');

      setBook(processDepthData(data.bids, data.asks, 20));
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const isBullish = book ? book.imbalance > 10 : false;
  const isBearish = book ? book.imbalance < -10 : false;
  const biasClr = isBullish ? '#10b981' : isBearish ? '#ef4444' : '#f59e0b';
  const Icon = isBullish ? TrendingUp : isBearish ? TrendingDown : Layers;

  let verdict = '';
  if (book) {
    if (isBullish) {
      verdict = `جدار الشراء (${fmtV(book.bidWall)}) يفوق جدار البيع (${fmtV(book.askWall)}) بشكل ملحوظ. اختلال السيولة بنسبة +${book.imbalance.toFixed(1)}% لصالح المشترين. هذا يدعم اتجاه صاعد قصير الأمد.`;
    } else if (isBearish) {
      verdict = `جدار البيع (${fmtV(book.askWall)}) يفوق جدار الشراء (${fmtV(book.bidWall)}) بشكل ملحوظ. اختلال السيولة بنسبة ${book.imbalance.toFixed(1)}% لصالح البائعين. هذا يشير إلى ضغط بيعي محتمل.`;
    } else {
      verdict = `توازن في السيولة بين الشراء (${fmtV(book.bidWall)}) والبيع (${fmtV(book.askWall)}). اختلال السيولة الطفيف (${book.imbalance.toFixed(1)}%) لا يدعم اتجاه واضح حالياً.`;
    }
  }

  const tool = slugToTool('order-book');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-indigo-400/70 tracking-widest uppercase border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <BookOpen className="w-3 h-3" /> Volume & Depth
        </span>
        <h1 className="text-xl font-black text-white mt-1">دفتر الأوامر (Order Book)</h1>
        <p className="text-sm text-white/40 font-mono">Real-time Binance Order Book Depth & Heatmap</p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#4f46e5,#3730a3)', boxShadow: !loading ? '0 0 20px rgba(79,70,229,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري قراءة السيولة الحية...' : 'فحص دفتر الأوامر'}
          </button>
        </div>

        <AnimatePresence>
          {book && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              
              {/* Verdict */}
              <div className="rounded-2xl border p-5" style={{ borderColor: biasClr + '30', background: biasClr + '08' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-black uppercase tracking-widest" style={{ color: biasClr }}>تحليل تدفق السيولة</p>
                  <Icon className="w-5 h-5" style={{ color: biasClr }} />
                </div>
                <p className="text-sm text-white/70 leading-relaxed font-medium">{verdict}</p>
              </div>

              {/* Wall Comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 relative overflow-hidden">
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500" />
                  <p className="text-xs font-bold text-emerald-400/60 uppercase tracking-widest mb-1">السيولة الشرائية (Bids)</p>
                  <p className="text-xl font-black text-emerald-400 font-mono">{fmtV(book.bidWall)}</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 relative overflow-hidden">
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500" />
                  <p className="text-xs font-bold text-red-400/60 uppercase tracking-widest mb-1">السيولة البيعية (Asks)</p>
                  <p className="text-xl font-black text-red-400 font-mono">{fmtV(book.askWall)}</p>
                </div>
              </div>

              {/* Book Table */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#050505] overflow-hidden" dir="ltr">
                {/* ASK header */}
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/10 flex justify-between">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Asks (Sell)</p>
                  <p className="text-xs font-bold text-red-400/60 uppercase tracking-widest">Size</p>
                </div>
                
                {/* ASKs — reversed so lowest ask is closest to mid */}
                <div className="flex flex-col-reverse">
                  {book.asks.map((a, i) => (
                    <motion.div key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}}
                      className="relative flex items-center justify-between px-4 py-1.5 border-b border-white/[0.02] overflow-hidden hover:bg-white/[0.02] transition-colors group">
                      <div className="absolute inset-0 left-auto transition-all duration-300" style={{ width: `${a.pct}%`, background: '#ef444415' }} />
                      <span className="text-sm font-black text-red-400 font-mono z-10">{fmtP(a.price)}</span>
                      <span className="text-xs text-white/50 font-mono z-10 group-hover:text-white/90 transition-colors">{a.size.toLocaleString(undefined, {maximumFractionDigits: 4})}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Current Price (Mid) */}
                <div className="px-4 py-4 bg-white/[0.04] border-y border-white/10 flex items-center justify-between relative overflow-hidden">
                  <div className="absolute left-0 w-1 top-0 bottom-0 bg-white/20" />
                  <span className="text-xs text-white/40 font-bold uppercase tracking-widest">Spread: {fmtP(book.spread)}</span>
                  <span className="text-lg font-black text-white font-mono">{fmtP(book.currentPrice)}</span>
                </div>

                {/* BIDs */}
                <div className="flex flex-col">
                  {book.bids.map((b, i) => (
                    <motion.div key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}}
                      className="relative flex items-center justify-between px-4 py-1.5 border-b border-white/[0.02] overflow-hidden hover:bg-white/[0.02] transition-colors group">
                      <div className="absolute inset-0 right-auto transition-all duration-300" style={{ width: `${b.pct}%`, background: '#10b98115' }} />
                      <span className="text-sm font-black text-emerald-400 font-mono z-10">{fmtP(b.price)}</span>
                      <span className="text-xs text-white/50 font-mono z-10 group-hover:text-white/90 transition-colors">{b.size.toLocaleString(undefined, {maximumFractionDigits: 4})}</span>
                    </motion.div>
                  ))}
                </div>

                {/* BID header */}
                <div className="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/10 flex justify-between">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Bids (Buy)</p>
                  <p className="text-xs font-bold text-emerald-400/60 uppercase tracking-widest">Size</p>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
