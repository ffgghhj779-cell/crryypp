'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hexagon, ScanSearch, AlertCircle, Calendar, Activity } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { ToolChart, type ChartMarker } from '@/components/tools/ToolChart';
import { notFound } from 'next/navigation';

interface CycleResult {
  avgCycleDays: number;
  lastPeakDate: string;
  lastPeakPrice: number;
  nextDates: { date: string; label: string; daysLeft: number }[];
  currentPrice: number;
  peaks: { idx: number; price: number; time: number }[];
}

function detectCycles(klines: Kline[]): CycleResult {
  const currentPrice = klines[klines.length - 1].close;

  // Find swing highs using 5-candle fractal (local maxima)
  const peaks: { idx: number; price: number; time: number }[] = [];
  for (let i = 2; i < klines.length - 2; i++) {
    const c = klines[i];
    if (c.high > klines[i-1].high && c.high > klines[i-2].high &&
        c.high > klines[i+1].high && c.high > klines[i+2].high) {
      
      // Filter out minor peaks within a 10 candle window
      let isHighestInWindow = true;
      for (let j = Math.max(0, i - 10); j <= Math.min(klines.length - 1, i + 10); j++) {
        if (klines[j].high > c.high) {
          isHighestInWindow = false;
          break;
        }
      }
      if (isHighestInWindow) {
        peaks.push({ idx: i, price: c.high, time: klines[i].time });
      }
    }
  }

  // Avg cycle = average gap between consecutive peaks
  let avgCycleDays = 45;
  if (peaks.length >= 2) {
    const gaps = [];
    for (let i = 1; i < peaks.length; i++) {
      gaps.push((peaks[i].time - peaks[i-1].time) / (1000 * 60 * 60 * 24));
    }
    avgCycleDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  } else if (peaks.length === 1) {
    avgCycleDays = 30;
  }

  const lastPeak = peaks[peaks.length - 1] ?? { time: klines[klines.length - 1].time, price: klines[klines.length - 1].high };
  const lastPeakDate  = new Date(lastPeak.time).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const now = Date.now();

  const nextDates = [1, 2, 3].map(n => {
    const ts   = lastPeak.time + n * avgCycleDays * 24 * 60 * 60 * 1000;
    const daysLeft = Math.round((ts - now) / (1000 * 60 * 60 * 24));
    return {
      date: new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
      label: `دورة ${n} (${n * avgCycleDays} يوم)`,
      daysLeft,
    };
  });

  return { avgCycleDays, lastPeakDate, lastPeakPrice: lastPeak.price, nextDates, currentPrice, peaks };
}

const fmtP = (p: number) => p.toLocaleString(undefined, { maximumFractionDigits: p > 1000 ? 1 : 4 });

export default function CycleConfluencePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [result, setResult] = useState<CycleResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 300);
      if (fetchedKlines.length < 50) throw new Error('بيانات غير كافية (مطلوب 50 شمعة على الأقل)');
      setResult(detectCycles(fetchedKlines));
      setKlines(fetchedKlines);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const verdict = !result ? '' :
    `متوسط الدورة السعرية = ${result.avgCycleDays} يوماً. آخر قمة كانت في ${result.lastPeakDate} عند ${fmtP(result.lastPeakPrice)}. ` +
    (result.nextDates[0].daysLeft > 0
      ? `التاريخ المتوقع للانعكاس (تكوين قمة جديدة) القادم: ${result.nextDates[0].date} (بعد ${result.nextDates[0].daysLeft} يوماً). راقب تصرف السعر عند هذه التواريخ.`
      : `التاريخ المتوقع الأول قد مرّ — تابع الدورة الثانية في ${result.nextDates[1].date}.`);

  
  const chartMarkers: ChartMarker[] = useMemo(() => {
    if (!result || klines.length === 0) return [];
    
    const markers: ChartMarker[] = [];
    
    // Add historical peaks
    result.peaks.forEach((peak, idx) => {
      markers.push({
        time: peak.time,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#f97316',
        text: `قمة ${idx + 1}`,
        size: 1
      });
    });

    return markers;
  }, [result, klines]);

  const tool = slugToTool('cycle-confluence');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Hexagon className="w-3 h-3" /> Cycle Confluence</span>
        <h1 className="text-xl font-black text-white mt-1">تقاطع الدورات الزمنية (القمم)</h1>
        <p className="text-sm text-white/40 font-mono">كشف متوسط الدورة من القمم الحقيقية وإسقاط النوافذ الزمنية المستقبلية بدقة مع التوضيح على الرسم البياني</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: !loading ? '0 0 20px rgba(249,115,22,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الكشف...' : 'كشف الدورات الزمنية (300 شمعة)'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              
              {/* Chart Component */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-orange-500/20 shadow-lg shadow-orange-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> القمم الدورية التاريخية
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 1D</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  markers={chartMarkers}
                />
              </div>

              {/* Cycle Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4">
                  <p className="text-xs text-orange-400/60 mb-1">متوسط طول الدورة</p>
                  <p className="text-2xl font-black text-orange-400">{result.avgCycleDays}<span className="text-sm font-bold text-white/40"> يوم</span></p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/[0.08] p-4">
                  <p className="text-xs text-white/40 mb-1">آخر قمة مؤكدة</p>
                  <p className="text-sm font-black text-white font-mono">{fmtP(result.lastPeakPrice)}</p>
                  <p className="text-xs text-white/30">{result.lastPeakDate}</p>
                </div>
              </div>

              {/* Visual Timeline */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5">
                <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">مخطط الدورات القادمة</p>
                <div className="relative">
                  {/* Line */}
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/10" />
                  <div className="flex justify-between">
                    {/* Last Peak */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center z-10">
                        <span className="text-xs text-white font-black">Q</span>
                      </div>
                      <p className="text-xs text-white/40 text-center max-w-16">آخر قمة</p>
                    </div>
                    {/* Next dates */}
                    {result.nextDates.map((nd, i) => (
                      <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2+i*0.15}}
                        className="flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 ${nd.daysLeft < 0 ? 'bg-white/10 border-white/20' : 'bg-orange-500/20 border-orange-500/60'}`}>
                          <span className="text-xs font-black" style={{ color: nd.daysLeft < 0 ? '#666' : '#f97316' }}>{i+1}</span>
                        </div>
                        <p className="text-xs text-white/40 text-center max-w-16">{nd.daysLeft > 0 ? `${nd.daysLeft}y` : 'مرّ'}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Next Dates List */}
              <div className="flex flex-col gap-3">
                {result.nextDates.map((nd, i) => (
                  <motion.div key={i} initial={{opacity:0,x:-15}} animate={{opacity:1,x:0}} transition={{delay:i*0.1}}
                    className={`rounded-xl border p-4 flex items-center justify-between ${nd.daysLeft > 0 ? 'border-orange-500/20 bg-orange-500/05' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5" style={{ color: nd.daysLeft > 0 ? '#f97316' : '#555' }} />
                      <div>
                        <p className="text-xs text-white/40">{nd.label}</p>
                        <p className="text-sm font-black text-white">{nd.date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-black font-mono ${nd.daysLeft > 0 ? 'text-orange-400' : 'text-white/20'}`}>
                      {nd.daysLeft > 0 ? `+${nd.daysLeft} يوم` : `${nd.daysLeft} يوم`}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/08 p-5">
                <p className="text-sm font-black text-orange-400 uppercase tracking-widest mb-2">الدليل الإرشادي</p>
                <p className="text-sm text-white/70 leading-relaxed">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
