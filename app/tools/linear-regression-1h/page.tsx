'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Activity, TrendingUp, TrendingDown, AlignEndHorizontal } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart } from '@/components/tools/ToolChart';
import { analyzeLinearRegression, LinearRegressionResult } from '@/lib/algorithms/advancedQuant';

export default function LinearRegressionPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LinearRegressionResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1h', 150);
      if (fetchedKlines.length < 100) throw new Error('بيانات غير كافية للتحليل (نحتاج 100 شمعة على الأقل)');
      
      setKlines(fetchedKlines);
      const res = analyzeLinearRegression(fetchedKlines);
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const colorHex = result?.isTrendUp ? '#10b981' : '#ef4444';
  const TrendIcon = result?.isTrendUp ? TrendingUp : TrendingDown;

  // Generate an overlay for ToolChart
  const overlays = [];
  if (result && klines.length >= 100) {
    const slice = klines.slice(-100);
    const middleData = [];
    const upperData = [];
    const lowerData = [];

    const stdDev2 = result.upperChannel - result.currentFit;

    for (let i = 0; i < slice.length; i++) {
      const time = slice[i].time;
      const fitValue = result.intercept + result.slope * i;
      
      middleData.push({ time, value: fitValue });
      upperData.push({ time, value: fitValue + stdDev2 });
      lowerData.push({ time, value: fitValue - stdDev2 });
    }

    overlays.push({
      type: 'line' as const,
      data: upperData,
      color: '#ef4444',
      title: 'Upper Band (+2σ)',
      lineWidth: 2 as const
    });
    overlays.push({
      type: 'line' as const,
      data: middleData,
      color: '#f59e0b',
      title: 'Linear Regression Fit',
      lineWidth: 2 as const
    });
    overlays.push({
      type: 'line' as const,
      data: lowerData,
      color: '#10b981',
      title: 'Lower Band (-2σ)',
      lineWidth: 2 as const
    });
  }

  const tool = slugToTool('linear-regression-1h');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-emerald-400/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Activity className="w-3 h-3" /> Math & Quant
        </span>
        <h1 className="text-xl font-black text-white mt-1">الانحدار الخطي (Linear Regression)</h1>
        <p className="text-sm text-white/40 font-mono">OLS Regression Channel & Trend Quantification</p>
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
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#059669,#047857)', boxShadow: !loading ? '0 0 20px rgba(5,150,105,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري رسم قناة الانحدار الخطي...' : 'تحليل الانحدار الخطي'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              <div className="rounded-2xl bg-[#050505] p-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <AlignEndHorizontal className="w-4 h-4" /> Linear Regression Channel
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 1D</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  overlays={overlays}
                />
              </div>

              <div className="rounded-2xl border p-6 flex items-center justify-between" style={{ borderColor: colorHex + '40', background: colorHex + '0a' }}>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: colorHex }}>الاتجاه العام للقناة</p>
                  <p className="text-2xl font-black text-white flex items-center gap-2">
                    {result.isTrendUp ? 'قناة صاعدة' : 'قناة هابطة'}
                    <TrendIcon className="w-6 h-6" style={{ color: colorHex }} />
                  </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-xs text-white/40 mb-1">الميل (Slope)</p>
                  <p className="text-lg font-black font-mono text-white/80">{result.slope > 0 ? '+' : ''}{result.slope}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex flex-col gap-1">
                  <p className="text-xs font-bold text-red-400/60 uppercase tracking-widest">الحد العلوي للقناة (+2σ)</p>
                  <p className="text-xl font-black text-red-400">${result.upperChannel.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">منطقة مقاومة وإفراط شرائي</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-1">
                  <p className="text-xs font-bold text-emerald-400/60 uppercase tracking-widest">الحد السفلي للقناة (-2σ)</p>
                  <p className="text-xl font-black text-emerald-400">${result.lowerChannel.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">منطقة دعم وإفراط بيعي</p>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: colorHex + '30', background: colorHex + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: colorHex }}>التحليل والتوقع</p>
                <p className="text-sm text-white/70 leading-relaxed">
                  {result.verdict} الانحدار الخطي يوفر أفضل خط ملاءمة إحصائية لحركة السعر على مدار آخر 100 شمعة. اختراق الحد العلوي يمثل فجوة شرائية هائلة، بينما كسر الحد السفلي يمثل هلع بيعي شديد.
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
