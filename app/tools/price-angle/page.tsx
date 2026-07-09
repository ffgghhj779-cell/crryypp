'use client';

import { useState, useCallback, useMemo } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Compass, Calculator, ScanSearch, AlertCircle, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { ToolChart, type HorizontalLine, type ChartMarker } from '@/components/tools/ToolChart';

export default function PriceAnglePage() {
  const tool = slugToTool('price-angle');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [klines, setKlines] = useState<Kline[]>([]);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [baseTime, setBaseTime] = useState<number>(0);


  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (fetchedKlines.length < 10) throw new Error('بيانات غير كافية');
      
      // Find the lowest low in the fetched klines as the base for Square of Nine
      let lowestLow = fetchedKlines[0].low;
      let lowestTime = fetchedKlines[0].time;
      for (const k of fetchedKlines) {
        if (k.low < lowestLow) {
          lowestLow = k.low;
          lowestTime = k.time;
        }
      }

      setKlines(fetchedKlines);
      setBasePrice(lowestLow);
      setBaseTime(lowestTime);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const angles = useMemo(() => [
    { angle: 45, label: 'زاوية 45°', desc: 'مستوى فرعي' },
    { angle: 90, label: 'زاوية 90°', desc: 'مستوى قوي' },
    { angle: 180, label: 'زاوية 180°', desc: 'انعكاس رئيسي' },
    { angle: 270, label: 'زاوية 270°', desc: 'مستوى استمراري' },
    { angle: 360, label: 'زاوية 360°', desc: 'دورة كاملة' },
  ], []);

  const calculateTarget = useCallback((angle: number) => {
    if (basePrice <= 0) return 0;
    // Square of nine simplified logic: (sqrt(price) + (angle/180))^2
    const root = Math.sqrt(basePrice);
    return Math.pow(root + (angle / 180), 2);
  }, [basePrice]);

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  const chartLines: HorizontalLine[] = useMemo(() => {
    if (basePrice <= 0) return [];
    return angles.map(a => ({
      price: calculateTarget(a.angle),
      title: `${a.angle}°`,
      color: '#10b981',
      lineStyle: 2
    }));
  }, [basePrice, angles, calculateTarget]);

  const chartMarkers: ChartMarker[] = useMemo(() => {
    if (basePrice <= 0 || baseTime === 0) return [];
    return [{
      time: baseTime,
      position: 'belowBar',
      shape: 'arrowUp',
      color: '#f59e0b',
      text: 'القاع المرجعي',
      size: 1
    }];
  }, [basePrice, baseTime]);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-emerald-500/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Compass className="w-3 h-3" /> Geometry
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">حاسبة الزوايا السعرية (مربع التسعة)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          تحويل قاع السعر الحالي إلى زوايا هندسية لتوقع الأهداف المستقبلية ورسمها على الشارت
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-2">
        
        {/* Input Form */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#10b981,#059669)', boxShadow: !loading ? '0 0 20px rgba(16,185,129,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحليل...' : 'تحديد الزوايا السعرية'}
          </button>
        </div>

        <AnimatePresence>
          {basePrice > 0 && klines.length > 0 && (
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="flex flex-col gap-5">
              
              {/* Chart Component */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Price Angles Projection
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 1D</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  priceLines={chartLines}
                  markers={chartMarkers}
                />
                <p className="text-xs text-white/40 mt-3 text-center">القاع المرجعي: {formatPrice(basePrice)}</p>
              </div>

              {/* Results Grid */}
              <div className="grid grid-cols-1 gap-3">
                {angles.map((item, i) => {
                  const target = calculateTarget(item.angle);
                  return (
                    <div key={i} className="rounded-xl border border-white/[0.05] bg-[#111] p-4 flex items-center justify-between relative overflow-hidden group">
                      <div className="absolute top-0 bottom-0 right-0 w-1 bg-emerald-500/50 group-hover:bg-emerald-400 transition-colors" />
                      
                      <div className="flex flex-col pr-3">
                        <span className="text-base font-bold text-white/90">{item.label}</span>
                        <span className="text-sm text-white/40 mt-1">{item.desc}</span>
                      </div>

                      <div className="flex flex-col items-end pl-2" dir="ltr">
                        <span className="text-xl font-black font-mono text-emerald-400">
                          {formatPrice(target)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-center px-5">
                <p className="text-sm text-white/30 leading-relaxed font-bold">
                  💡 تستخدم هذه الحاسبة قوانين (مربع التسعة) لجان للبحث عن قاع ثم حساب أهداف السعر بالزوايا. عندما يخترق السعر زاوية فرعية، يتجه للزاوية التي تليها، وعند زاوية 360° قد ينتهي الترند ويحدث الانعكاس.
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
