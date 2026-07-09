'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Calculator, TrendingUp, ScatterChart } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, HorizontalLine } from '@/components/tools/ToolChart';
import { analyzeMonteCarlo, MonteCarloResult } from '@/lib/algorithms/advancedQuant';

export default function MonteCarloPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (fetchedKlines.length < 50) throw new Error('بيانات غير كافية للتحليل (نحتاج 50 شمعة يومية)');
      
      setKlines(fetchedKlines);
      const res = analyzeMonteCarlo(fetchedKlines);
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const colorHex = '#10b981'; // Default theme color for Math & Quant

  // Generate price lines for the chart
  const priceLines: HorizontalLine[] = [];
  if (result) {
    priceLines.push({
      price: result.projectedHigh,
      color: '#ef4444',
      title: 'الحد الأعلى المتوقع (95%)',
      lineWidth: 2,
      lineStyle: 2
    });
    priceLines.push({
      price: result.expectedPrice,
      color: '#f59e0b',
      title: 'السعر المتوقع المتوسط',
      lineWidth: 2,
      lineStyle: 1
    });
    priceLines.push({
      price: result.projectedLow,
      color: '#10b981',
      title: 'الحد الأدنى المتوقع (5%)',
      lineWidth: 2,
      lineStyle: 2
    });
    priceLines.push({
      price: result.currentPrice,
      color: '#3b82f6',
      title: 'السعر الحالي',
      lineWidth: 1,
      lineStyle: 0
    });
  }

  const tool = slugToTool('monte-carlo');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-emerald-400/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Calculator className="w-3 h-3" /> Math & Quant
        </span>
        <h1 className="text-xl font-black text-white mt-1">محاكاة مونت كارلو (Monte Carlo)</h1>
        <p className="text-sm text-white/40 font-mono">1000-iteration random walk price projection (30 Days)</p>
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
            {loading ? 'جاري محاكاة 500 مسار عشوائي...' : 'تشغيل المحاكاة (30 يوماً للأمام)'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              <div className="rounded-2xl bg-[#050505] p-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <ScatterChart className="w-4 h-4" /> Monte Carlo Projection Cone
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 1D</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  priceLines={priceLines}
                />
              </div>

              <div className="rounded-2xl border p-6 flex items-center justify-between" style={{ borderColor: colorHex + '40', background: colorHex + '0a' }}>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: colorHex }}>السعر المتوقع (الوسيط)</p>
                  <p className="text-2xl font-black text-white flex items-center gap-2">
                    ${result.expectedPrice.toLocaleString()}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-xs text-white/40 mb-1">السعر الحالي</p>
                  <p className="text-lg font-black font-mono text-white/80">${result.currentPrice.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex flex-col gap-1">
                  <p className="text-xs font-bold text-red-400/60 uppercase tracking-widest">الحد الأعلى المحتمل</p>
                  <p className="text-xl font-black text-red-400">${result.projectedHigh.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">تغير مقدر: <span className="text-emerald-400">+{result.upperPct}%</span></p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-1">
                  <p className="text-xs font-bold text-emerald-400/60 uppercase tracking-widest">الحد الأدنى المحتمل</p>
                  <p className="text-xl font-black text-emerald-400">${result.projectedLow.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">تغير مقدر: <span className="text-red-400">{result.lowerPct}%</span></p>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: colorHex + '30', background: colorHex + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: colorHex }}>التحليل والتوقع الاحتمالي</p>
                <p className="text-sm text-white/70 leading-relaxed">
                  {result.verdict} بناءً على التقلبات الإحصائية (Variance) ومتوسط العوائد اللوغاريتمية للسعر خلال الـ 100 يوم الماضية.
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
