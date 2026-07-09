'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, ScanSearch, AlertCircle, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

interface AggTrade {
  a: number; // Aggregate tradeId
  p: string; // Price
  q: string; // Quantity
  f: number; // First tradeId
  l: number; // Last tradeId
  T: number; // Timestamp
  m: boolean; // Was the buyer the maker?
  M: boolean; // Was the trade the best price match?
}

interface FootprintLevel {
  priceStr: string;
  priceNum: number;
  buyVol: number;
  sellVol: number;
  totalVol: number;
  delta: number;
}

interface FootprintResult {
  levels: FootprintLevel[];
  maxVol: number;
  totalBuy: number;
  totalSell: number;
  cumDelta: number;
  timeStart: number;
  timeEnd: number;
  currentPrice: number;
}

function processAggTrades(trades: AggTrade[]): FootprintResult {
  if (trades.length === 0) throw new Error('No trades found');

  let currentPrice = parseFloat(trades[trades.length - 1].p);
  
  // Determine tick size based on price magnitude to group nicely
  let tickSize = 1;
  if (currentPrice > 10000) tickSize = 10;
  else if (currentPrice > 1000) tickSize = 1;
  else if (currentPrice > 100) tickSize = 0.1;
  else if (currentPrice > 10) tickSize = 0.01;
  else tickSize = 0.001;

  const levelMap = new Map<number, FootprintLevel>();
  let totalBuy = 0;
  let totalSell = 0;

  for (const t of trades) {
    const p = parseFloat(t.p);
    const q = parseFloat(t.q);
    const isBuyerMaker = t.m; 
    // If buyer is maker, it means a seller crossed the spread (Taker Sell)
    // If buyer is NOT maker, a buyer crossed the spread (Taker Buy)
    const isBuy = !isBuyerMaker; 

    // Round price to nearest tick
    const roundedPrice = Math.round(p / tickSize) * tickSize;

    if (!levelMap.has(roundedPrice)) {
      levelMap.set(roundedPrice, {
        priceStr: roundedPrice.toFixed(tickSize >= 1 ? 0 : tickSize === 0.1 ? 1 : tickSize === 0.01 ? 2 : 4),
        priceNum: roundedPrice,
        buyVol: 0,
        sellVol: 0,
        totalVol: 0,
        delta: 0
      });
    }

    const lvl = levelMap.get(roundedPrice)!;
    if (isBuy) {
      lvl.buyVol += q;
      totalBuy += q;
    } else {
      lvl.sellVol += q;
      totalSell += q;
    }
    lvl.totalVol += q;
    lvl.delta = lvl.buyVol - lvl.sellVol;
  }

  const levels = Array.from(levelMap.values()).sort((a, b) => b.priceNum - a.priceNum);
  const maxVol = Math.max(...levels.map(l => l.totalVol), 0.0001);
  const cumDelta = totalBuy - totalSell;

  return {
    levels,
    maxVol,
    totalBuy,
    totalSell,
    cumDelta,
    timeStart: trades[0].T,
    timeEnd: trades[trades.length - 1].T,
    currentPrice
  };
}

const fmtV = (v: number) => {
  if (v > 1_000_000) return `${(v/1_000_000).toFixed(2)}M`;
  if (v > 1_000) return `${(v/1_000).toFixed(2)}K`;
  return v.toFixed(2);
};

export default function FootprintProPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FootprintResult | null>(null);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const isCommodity = ['XAUUSD', 'WTIUSD', 'USDEGP', 'EGYXAU', 'BRENTUSD', 'EURUSD'].includes(symbol.toUpperCase().trim());
      if (isCommodity) {
        throw new Error('Footprint Pro غير متاح للسلع. يتطلب بيانات Ticker Tick-by-Tick من باينانس.');
      }

      const res = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol.toUpperCase().trim()}&limit=1000`);
      if (!res.ok) throw new Error('فشل جلب بيانات الصفقات (AggTrades) من باينانس');
      
      const trades: AggTrade[] = await res.json();
      setResult(processAggTrades(trades));
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const domColor = result ? (result.cumDelta > 0 ? '#10b981' : result.cumDelta < 0 ? '#ef4444' : '#6b7280') : '#6b7280';
  const durationSecs = result ? Math.max(1, (result.timeEnd - result.timeStart) / 1000) : 1;

  let verdict = '';
  if (result) {
    if (result.cumDelta > 0) {
      verdict = `سيطرة شرائية قوية في آخر ${durationSecs.toFixed(0)} ثانية (الدلتا: +${fmtV(result.cumDelta)}). المشتريون يمتصون العروض عند مستويات المقاومة اللحظية.`;
    } else if (result.cumDelta < 0) {
      verdict = `ضغط بيعي حاد في آخر ${durationSecs.toFixed(0)} ثانية (الدلتا: ${fmtV(result.cumDelta)}). البائعون يدفعون السعر للأسفل بقوة وبدون مقاومة تذكر من المشترين.`;
    } else {
      verdict = `توازن لحظي في السيولة في آخر ${durationSecs.toFixed(0)} ثانية.`;
    }
  }

  const tool = slugToTool('footprint-pro');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-teal-400/70 tracking-widest uppercase border border-teal-500/20 bg-teal-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Layers className="w-3 h-3" /> Microstructure
        </span>
        <h1 className="text-xl font-black text-white mt-1">بصمة السعر (Footprint Pro)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">Real-time Order Flow Microstructure from AggTrades</p>
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
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#0d9488,#0f766e)', boxShadow: !loading ? '0 0 20px rgba(13,148,136,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري تجميع الصفقات اللحظية...' : 'قراءة بصمة الصفقات اللحظية'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 flex flex-col items-center text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-teal-400/60 mb-1">المدة الزمنية للرصد</p>
                  <p className="text-xl font-black text-white font-mono">{durationSecs.toFixed(0)} <span className="text-sm text-white/50 font-sans font-normal">ثانية</span></p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col items-center text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">حجم التداول الفعلي</p>
                  <p className="text-xl font-black text-white font-mono">{fmtV(result.totalBuy + result.totalSell)}</p>
                </div>
              </div>

              {/* Dominance Card */}
              <div className="rounded-2xl border p-5 flex items-center justify-between" style={{ borderColor: domColor + '40', background: domColor + '0a' }}>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: domColor }}>الدلتا اللحظي (CVD)</p>
                  <p className="text-2xl font-black font-mono" style={{ color: domColor }}>
                    {result.cumDelta > 0 ? '+' : ''}{fmtV(result.cumDelta)}
                  </p>
                </div>
                <div className="text-left flex flex-col items-end">
                  <p className="text-xs font-bold text-emerald-400 mb-0.5">شراء: {fmtV(result.totalBuy)}</p>
                  <p className="text-xs font-bold text-red-400">بيع: {fmtV(result.totalSell)}</p>
                </div>
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-teal-500/20 bg-teal-500/10 p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 bottom-0 w-1 bg-teal-500" />
                <p className="text-sm font-black text-teal-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> تحليل الصفقات اللحظي
                </p>
                <p className="text-sm text-white/80 leading-relaxed font-medium">
                  {verdict}
                </p>
              </div>

              {/* Footprint Visual Chart */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#050505] p-5 overflow-x-auto">
                <div className="min-w-[400px]">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1"><ChevronLeft className="w-3 h-3" /> Sell Volume</p>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Price Level</p>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">Buy Volume <ChevronRight className="w-3 h-3" /></p>
                  </div>

                  <div className="flex flex-col gap-1">
                    {result.levels.map((lvl, i) => {
                      const isCurrentPrice = Math.abs(lvl.priceNum - result.currentPrice) < 0.00001; // roughly equals
                      const buyPct = (lvl.buyVol / result.maxVol) * 100;
                      const sellPct = (lvl.sellVol / result.maxVol) * 100;
                      
                      return (
                        <div key={i} className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-white/[0.05] transition-colors ${isCurrentPrice ? 'bg-white/[0.08] border border-white/10' : ''}`}>
                          {/* Sell Bar (Right aligned inside its container) */}
                          <div className="flex-1 flex justify-end">
                            <div className="h-6 bg-red-500/30 border-r-2 border-red-500 flex items-center justify-start overflow-visible min-w-[2px] transition-all" style={{ width: `${sellPct}%` }}>
                              <span className="text-[10px] font-mono text-red-300 ml-1 whitespace-nowrap pl-2 opacity-80">{lvl.sellVol > 0 ? fmtV(lvl.sellVol) : ''}</span>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="w-24 text-center">
                            <span className={`text-sm font-black font-mono ${isCurrentPrice ? 'text-white' : 'text-white/60'}`}>{lvl.priceStr}</span>
                          </div>

                          {/* Buy Bar (Left aligned inside its container) */}
                          <div className="flex-1 flex justify-start">
                            <div className="h-6 bg-emerald-500/30 border-l-2 border-emerald-500 flex items-center justify-end overflow-visible min-w-[2px] transition-all" style={{ width: `${buyPct}%` }}>
                              <span className="text-[10px] font-mono text-emerald-300 mr-1 whitespace-nowrap pr-2 opacity-80">{lvl.buyVol > 0 ? fmtV(lvl.buyVol) : ''}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
