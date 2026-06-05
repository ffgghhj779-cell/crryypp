'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hash, ScanSearch, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

interface TDResult { setupCount: number; direction: 'buy' | 'sell' | 'none'; td9reached: boolean; currentPrice: number; priceAtSetup1: number; }

function calcTDSequential(klines: { close: number }[]): TDResult {
  if (klines.length < 10) return { setupCount: 0, direction: 'none', td9reached: false, currentPrice: 0, priceAtSetup1: 0 };
  const prices = klines.map(k => k.close);
  const currentPrice = prices[prices.length - 1];

  let buyCount = 0; let sellCount = 0; let priceAtSetup1 = 0;
  // Count from the most recent bar backwards
  for (let i = prices.length - 1; i >= 4; i--) {
    const isBuy  = prices[i] < prices[i - 4];
    const isSell = prices[i] > prices[i - 4];
    if (i === prices.length - 1) {
      if (isBuy) { buyCount = 1; } else if (isSell) { sellCount = 1; }
      else break;
    } else {
      const wasLastBuy  = prices[i + 1] < prices[i + 1 - 4];
      const wasLastSell = prices[i + 1] > prices[i + 1 - 4];
      if (buyCount > 0 && isBuy && wasLastBuy) { buyCount++; }
      else if (sellCount > 0 && isSell && wasLastSell) { sellCount++; }
      else break;
    }
  }
  const setupCount = Math.max(buyCount, sellCount);
  const direction: 'buy' | 'sell' | 'none' = buyCount > sellCount ? 'buy' : sellCount > buyCount ? 'sell' : 'none';
  if (setupCount >= 1 && prices.length >= 4) priceAtSetup1 = prices[prices.length - setupCount];
  return { setupCount: Math.min(setupCount, 9), direction, td9reached: setupCount >= 9, currentPrice, priceAtSetup1 };
}

export default function DemarkTDPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TDResult | null>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 60);
      if (klines.length < 10) throw new Error('بيانات غير كافية');
      setResult(calcTDSequential(klines));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const fmtP = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 100 ? 1 : 4, maximumFractionDigits: p > 100 ? 1 : 4 });

  const dirColor = result?.direction === 'buy' ? '#10b981' : result?.direction === 'sell' ? '#ef4444' : '#6b7280';
  const verdict = !result ? '' :
    result.td9reached
      ? `تم الوصول إلى العدد 9 (TD9 ${result.direction === 'buy' ? 'شراء' : 'بيع'})! هذا إشارة انعكاس قوية جداً في نظرية ديمارك. ابحث عن تأكيد الانعكاس.`
      : result.setupCount >= 7
      ? `العداد وصل ${result.setupCount}/9 — الانعكاس قريب. ابدأ التحضير لصفقة ${result.direction === 'buy' ? 'شراء' : 'بيع'} عند اكتمال العدد 9.`
      : result.setupCount >= 1
      ? `TD Sequential نشط — العداد عند ${result.setupCount}/9 بإشارة ${result.direction === 'buy' ? 'شراء (Buy Setup)' : 'بيع (Sell Setup)'}. انتظر اكتمال 9 للدخول.`
      : 'لا يوجد TD Sequential نشط حالياً. لا توجد حالة إعداد سعري متسقة في آخر الشموع.';

  const tool = slugToTool('demark-td');
  if (!tool) return notFound();

  return (

    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-violet-500/70 tracking-widest uppercase border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Hash className="w-3 h-3" /> TD Sequential</span>
        <h1 className="text-xl font-black text-white mt-1">مؤشر TD Sequential (ديمارك)</h1>
        <p className="text-sm text-white/40 font-mono">عداد الشموع 1→9 لتحديد نقاط انهاك الاتجاه</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all" style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: !loading ? '0 0 20px rgba(124,58,237,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري العد...' : 'تشغيل TD Sequential'}
          </button>
        </div>
        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              {/* Counter */}
              <div className="rounded-3xl border p-8 flex flex-col items-center gap-4 relative overflow-hidden" style={{ borderColor: dirColor + '40', background: dirColor + '0a' }}>
                {result.td9reached && <div className="absolute inset-0 opacity-10 animate-pulse" style={{ background: dirColor }} />}
                <p className="text-sm font-bold uppercase tracking-widest" style={{ color: dirColor }}>
                  {result.direction === 'buy' ? 'Buy Setup (إعداد شراء)' : result.direction === 'sell' ? 'Sell Setup (إعداد بيع)' : 'لا يوجد Setup'}
                </p>
                {/* Number Track */}
                <div className="flex gap-2 flex-wrap justify-center">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const active = i < result!.setupCount;
                    const isCurrent = i === result!.setupCount - 1;

return (
                      <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.06, type: 'spring' }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black font-mono"
                        style={{ background: active ? dirColor : '#1a1a1a', color: active ? '#000' : '#333', boxShadow: isCurrent ? `0 0 20px ${dirColor}` : 'none', transform: isCurrent ? 'scale(1.2)' : 'scale(1)' }}>
                        {i + 1}
                      </motion.div>
                    );
                  })}
                </div>
                <p className="text-5xl font-black font-mono" style={{ color: dirColor }}>{result.setupCount}<span className="text-2xl text-white/30">/9</span></p>
                {result.td9reached && <span className="px-4 py-1.5 rounded-full text-sm font-black animate-bounce" style={{ background: dirColor, color: '#000' }}>⚡ TD9 مكتمل!</span>}
              </div>
              {/* Price Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4"><p className="text-xs text-white/40 mb-1">السعر الحالي</p><p className="text-base font-black text-white font-mono">{fmtP(result.currentPrice)}</p></div>
                <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4"><p className="text-xs text-white/40 mb-1">بداية الإعداد</p><p className="text-base font-black text-white font-mono">{result.priceAtSetup1 > 0 ? fmtP(result.priceAtSetup1) : '—'}</p></div>
              </div>
              {/* Verdict */}
              <div className="rounded-2xl border p-5" style={{ borderColor: dirColor + '30', background: dirColor + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: dirColor }}>الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
