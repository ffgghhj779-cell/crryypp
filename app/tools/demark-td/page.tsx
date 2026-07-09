'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hash, ScanSearch, AlertCircle, Activity } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { ToolChart, ChartMarker } from '@/components/tools/ToolChart';
import { notFound } from 'next/navigation';

interface TDResult { 
  setupCount: number; 
  direction: 'buy' | 'sell' | 'none'; 
  td9reached: boolean; 
  currentPrice: number; 
  priceAtSetup1: number;
  klines: Kline[];
  markers: ChartMarker[];
}

function calcTDSequential(klines: Kline[]): TDResult {
  const markers: ChartMarker[] = [];
  let buySetup = 0;
  let sellSetup = 0;
  let priceAtSetup1 = 0;

  for (let i = 4; i < klines.length; i++) {
    const isBuy = klines[i].close < klines[i - 4].close;
    const isSell = klines[i].close > klines[i - 4].close;

    if (isBuy) {
      if (buySetup === 0) priceAtSetup1 = klines[i].close;
      buySetup++;
      sellSetup = 0;
      
      // Only show markers for 1-9
      if (buySetup <= 9) {
        markers.push({
          time: klines[i].time,
          position: 'belowBar',
          shape: 'arrowUp',
          color: buySetup === 9 ? '#10b981' : 'rgba(16, 185, 129, 0.4)',
          text: buySetup.toString(),
          size: buySetup === 9 ? 2 : 1
        });
      }
    } else if (isSell) {
      if (sellSetup === 0) priceAtSetup1 = klines[i].close;
      sellSetup++;
      buySetup = 0;

      if (sellSetup <= 9) {
        markers.push({
          time: klines[i].time,
          position: 'aboveBar',
          shape: 'arrowDown',
          color: sellSetup === 9 ? '#ef4444' : 'rgba(239, 68, 68, 0.4)',
          text: sellSetup.toString(),
          size: sellSetup === 9 ? 2 : 1
        });
      }
    } else {
      buySetup = 0;
      sellSetup = 0;
    }
  }

  const currentPrice = klines[klines.length - 1].close;
  const currentBuyCount = buySetup % 9 === 0 && buySetup > 0 ? 9 : buySetup % 9;
  const currentSellCount = sellSetup % 9 === 0 && sellSetup > 0 ? 9 : sellSetup % 9;
  
  const setupCount = Math.max(currentBuyCount, currentSellCount);
  const direction = buySetup > 0 ? 'buy' : sellSetup > 0 ? 'sell' : 'none';

  return { 
    setupCount, 
    direction, 
    td9reached: setupCount === 9, 
    currentPrice, 
    priceAtSetup1: setupCount > 0 ? priceAtSetup1 : 0,
    klines,
    markers
  };
}

const fmtP = (p: number) => p.toLocaleString('en-US', { minimumFractionDigits: p > 100 ? 1 : 4, maximumFractionDigits: p > 100 ? 1 : 4 });

export default function DemarkTDPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TDResult | null>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 150);
      if (klines.length < 20) throw new Error('بيانات غير كافية لحساب متتالية ديمارك');
      setResult(calcTDSequential(klines));
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol, timeframe]);

  const dirColor = result?.direction === 'buy' ? '#10b981' : result?.direction === 'sell' ? '#ef4444' : '#6b7280';
  const verdict = !result ? '' :
    result.td9reached
      ? `تم الوصول إلى العدد 9 (TD9 ${result.direction === 'buy' ? 'شراء' : 'بيع'})! هذه إشارة إنهاك للاتجاه وفرصة لانعكاس سعري محتمل قوي جداً. ابحث عن شموع انعكاسية لتأكيد الدخول.`
      : result.setupCount >= 7
      ? `العداد وصل ${result.setupCount}/9 — الانعكاس أصبح قريباً جداً. ابدأ التحضير لصفقة ${result.direction === 'buy' ? 'شراء' : 'بيع'} عند اكتمال العدد 9 (TD9).`
      : result.setupCount >= 1
      ? `TD Sequential نشط — العداد عند ${result.setupCount}/9 بإشارة ${result.direction === 'buy' ? 'شراء (Buy Setup)' : 'بيع (Sell Setup)'}. الاتجاه ما زال يمتلك بعض الزخم ولم يصل للإرهاق بعد.`
      : 'لا يوجد TD Sequential نشط حالياً. لا توجد حالة إعداد سعري متسقة في آخر الشموع.';

  
  const tool = slugToTool('demark-td');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-violet-400/70 tracking-widest uppercase border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Hash className="w-3 h-3" /> TD Sequential
        </span>
        <h1 className="text-xl font-black text-white mt-1">مؤشر ديمارك (DeMark TD)</h1>
        <p className="text-sm text-white/40 font-mono">عداد الشموع 1→9 لاكتشاف الإرهاق السعري ونهاية الاتجاه</p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <SymbolDropdown value={symbol} onChange={setSymbol} />
            </div>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-violet-500/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
            </select>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all" 
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: !loading ? '0 0 20px rgba(124,58,237,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري قراءة متتالية ديمارك...' : 'اكتشاف إنهاك الاتجاه'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              
              {/* Counter Display */}
              <div className="rounded-3xl border p-8 flex flex-col items-center gap-4 relative overflow-hidden" style={{ borderColor: dirColor + '40', background: dirColor + '0a' }}>
                {result.td9reached && <div className="absolute inset-0 opacity-10 animate-pulse" style={{ background: dirColor }} />}
                <p className="text-sm font-bold uppercase tracking-widest" style={{ color: dirColor }}>
                  {result.direction === 'buy' ? 'Buy Setup (إعداد شراء)' : result.direction === 'sell' ? 'Sell Setup (إعداد بيع)' : 'لا يوجد Setup حالياً'}
                </p>
                
                {/* Number Track */}
                <div className="flex gap-2 flex-wrap justify-center">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const active = i < result.setupCount;
                    const isCurrent = i === result.setupCount - 1;
                    return (
                      <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.06, type: 'spring' }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black font-mono transition-colors"
                        style={{ background: active ? dirColor : '#1a1a1a', color: active ? '#000' : '#333', boxShadow: isCurrent ? `0 0 20px ${dirColor}` : 'none', transform: isCurrent ? 'scale(1.2)' : 'scale(1)' }}>
                        {i + 1}
                      </motion.div>
                    );
                  })}
                </div>
                
                <p className="text-5xl font-black font-mono mt-2" style={{ color: dirColor }}>{result.setupCount}<span className="text-2xl text-white/30">/9</span></p>
                {result.td9reached && <span className="px-5 py-2 rounded-full text-sm font-black animate-bounce mt-2 shadow-lg" style={{ background: dirColor, color: '#000', boxShadow: `0 0 15px ${dirColor}80` }}>⚡ TD9 مكتمل!</span>}
              </div>

              {/* ToolChart visualizing TD Sequential */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-violet-500/20 shadow-lg shadow-violet-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> خريطة العداد الزمني (TD)
                  </p>
                  <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-1 rounded">150 Candles</span>
                </div>
                <ToolChart 
                  klines={result.klines}
                  markers={result.markers}
                  height={320}
                />
              </div>

              {/* Price Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4">
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-1">السعر الحالي</p>
                  <p className="text-lg font-black text-white font-mono">{fmtP(result.currentPrice)}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4">
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-1">بداية التكوين (Setup 1)</p>
                  <p className="text-lg font-black text-white font-mono">{result.priceAtSetup1 > 0 ? fmtP(result.priceAtSetup1) : '—'}</p>
                </div>
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border p-5 relative overflow-hidden" style={{ borderColor: dirColor + '30', background: dirColor + '10' }}>
                <div className="absolute top-0 right-0 bottom-0 w-1" style={{ background: dirColor }} />
                <p className="text-sm font-black uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: dirColor }}>
                  <Hash className="w-4 h-4" /> الدليل الإرشادي التكتيكي
                </p>
                <p className="text-sm text-white/80 leading-relaxed font-medium">{verdict}</p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
