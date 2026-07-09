'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hexagon, ScanSearch, AlertCircle, Calendar, Activity } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, type ChartMarker } from '@/components/tools/ToolChart';

interface CycleDate { date: string; cycleDays: number; daysLeft: number; ts: number; }
interface CalcResult { 
  avgCycleDays: number; 
  lastLowDate: string; 
  lastLowPrice: number; 
  nextDates: CycleDate[]; 
  currentPrice: number; 
  lows: { time: number; price: number }[];
}

function calcCycles(klines: Kline[]): CalcResult {
  const currentPrice = klines[klines.length - 1].close;
  // Find swing lows
  const lows: { time: number; price: number }[] = [];
  for (let i = 2; i < klines.length - 2; i++) {
    const c = klines[i];
    if (c.low < klines[i-1].low && c.low < klines[i-2].low && c.low < klines[i+1].low && c.low < klines[i+2].low) {
      // Local minima
      let isLowestInWindow = true;
      for(let j = Math.max(0, i - 10); j <= Math.min(klines.length - 1, i + 10); j++) {
        if (klines[j].low < c.low) {
          isLowestInWindow = false;
          break;
        }
      }
      if (isLowestInWindow) {
        lows.push({ time: klines[i].time, price: c.low });
      }
    }
  }

  let avgCycleDays = 45;
  if (lows.length >= 2) {
    const gaps = [];
    for (let i = 1; i < lows.length; i++) {
      gaps.push((lows[i].time - lows[i-1].time) / 86400000);
    }
    avgCycleDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  } else if (lows.length === 1) {
    avgCycleDays = 30; // default if only 1 low found
  }

  const lastLow = lows[lows.length - 1] ?? { time: klines[0].time, price: klines[0].low };
  const lastLowDate = new Date(lastLow.time).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const now = Date.now();

  const nextDates: CycleDate[] = [1, 2, 3].map(n => {
    const ts = lastLow.time + n * avgCycleDays * 86400000;
    return {
      ts,
      date: new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
      cycleDays: n * avgCycleDays,
      daysLeft: Math.round((ts - now) / 86400000),
    };
  });

  return { avgCycleDays, lastLowDate, lastLowPrice: lastLow.price, nextDates, currentPrice, lows };
}

const fmtP = (p: number) => p.toLocaleString(undefined, { maximumFractionDigits: p > 1000 ? 1 : 4 });

export default function CycleCalculatorPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [result, setResult] = useState<CalcResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  const handleCalc = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 300);
      if (fetchedKlines.length < 50) throw new Error('بيانات غير كافية');
      const res = calcCycles(fetchedKlines);
      setKlines(fetchedKlines);
      setResult(res);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const verdict = !result ? '' :
    `متوسط الدورة الحالية هو ${result.avgCycleDays} يوماً. ` +
    (result.nextDates[0].daysLeft > 0
      ? `التاريخ المتوقع لتشكيل القاع القادم هو ${result.nextDates[0].date} (بعد ${result.nextDates[0].daysLeft} يوم). توقع زيادة التذبذب وانعكاس الاتجاه حول هذه المنطقة.`
      : `النافذة الزمنية الأولى مرّت بالفعل (${result.nextDates[0].date}). الدورة القادمة المتوقعة في ${result.nextDates[1].date}.`);

  
  const chartMarkers: ChartMarker[] = useMemo(() => {
    if (!result || klines.length === 0) return [];
    
    const markers: ChartMarker[] = [];
    
    // Add historical lows
    result.lows.forEach((low, idx) => {
      markers.push({
        time: low.time,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#f97316',
        text: `قاع ${idx + 1}`,
        size: 1
      });
    });

    return markers;
  }, [result, klines]);

  const tool = slugToTool('cycle-calculator');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Hexagon className="w-3 h-3" /> Cycles</span>
        <h1 className="text-xl font-black text-white mt-1">حاسبة الدورات الزمنية الحقيقية</h1>
        <p className="text-sm text-white/40 font-mono">تحديد القمم والقيعان التاريخية وحساب متوسط الدورة لإسقاط النوافذ الزمنية المستقبلية بدقة</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleCalc} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: !loading ? '0 0 20px rgba(249,115,22,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الحساب...' : 'حساب الدورات (300 شمعة يومية)'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              
              {/* Chart Component */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-orange-500/20 shadow-lg shadow-orange-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> القيعان الدورية التاريخية
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 1D</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  markers={chartMarkers}
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4">
                  <p className="text-xs text-orange-400/60 mb-1">متوسط الدورة</p>
                  <p className="text-2xl font-black text-orange-400">{result.avgCycleDays}<span className="text-sm text-white/30"> يوم</span></p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/[0.08] p-4">
                  <p className="text-xs text-white/40 mb-1">آخر قاع مكتشف</p>
                  <p className="text-sm font-black text-white font-mono">{fmtP(result.lastLowPrice)}</p>
                  <p className="text-xs text-white/30">{result.lastLowDate}</p>
                </div>
              </div>

              {/* Projected dates */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-white/30 uppercase tracking-widest">التواريخ المتوقعة للانعكاس</p>
                {result.nextDates.map((nd, i) => (
                  <motion.div key={i} initial={{opacity:0,x:-15}} animate={{opacity:1,x:0}} transition={{delay:i*0.1}}
                    className={`rounded-xl border p-4 flex items-center justify-between ${nd.daysLeft > 0 ? 'border-orange-500/20 bg-orange-500/05' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${nd.daysLeft > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-white/30'}`}>{i+1}</div>
                      <div>
                        <p className="text-xs text-white/30 font-mono">{nd.cycleDays} يوم من القاع المرجعي</p>
                        <p className="text-sm font-black text-white">{nd.date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-black font-mono ${nd.daysLeft > 0 ? 'text-orange-400' : 'text-white/20'}`}>
                      {nd.daysLeft > 0 ? `باقي ${nd.daysLeft} يوم` : 'مرت'}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/08 p-5 mt-2">
                <p className="text-sm font-black text-orange-400 uppercase tracking-widest mb-2">الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed font-medium">{verdict}</p>
                <p className="text-xs text-white/40 mt-3 pt-3 border-t border-white/10">
                  💡 التحليل الزمني يعتمد على إيجاد الإيقاع المنتظم لتحركات الأسواق. عندما يتزامن السعر مع هذه التواريخ، ترتفع احتمالية تشكيل قاع جديد.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
