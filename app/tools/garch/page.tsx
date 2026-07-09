'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Activity, Waves, MoveVertical, Gauge } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, HorizontalLine } from '@/components/tools/ToolChart';
import { calculateGARCH, GarchResult } from '@/lib/algorithms/quant';

export default function GARCHPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GarchResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (fetchedKlines.length < 30) throw new Error('بيانات غير كافية للتحليل (نحتاج 30 شمعة يومية على الأقل)');
      
      setKlines(fetchedKlines);
      const res = calculateGARCH(fetchedKlines, 365); // 365 for daily
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const isExpanding = result?.state === 'انفجار';
  const colorHex = isExpanding ? '#ef4444' : '#10b981';

  // Generate price lines for the chart
  const priceLines: HorizontalLine[] = [];
  if (result) {
    priceLines.push({
      price: result.upperBound,
      color: '#ef4444',
      title: '+1σ Upper Band',
      lineWidth: 2,
      lineStyle: 2
    });
    priceLines.push({
      price: result.lowerBound,
      color: '#10b981',
      title: '-1σ Lower Band',
      lineWidth: 2,
      lineStyle: 2
    });
    priceLines.push({
      price: result.currentPrice,
      color: '#3b82f6',
      title: 'Current Price',
      lineWidth: 1,
      lineStyle: 0
    });
  }

  const tool = slugToTool('garch');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-emerald-400/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Activity className="w-3 h-3" /> Math & Quant
        </span>
        <h1 className="text-xl font-black text-white mt-1">توقع التقلبات (GARCH 1,1)</h1>
        <p className="text-sm text-white/40 font-mono">Volatility forecasting & 1-period ahead bands</p>
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
            {loading ? 'جاري حساب GARCH...' : 'تحليل تقلبات السعر'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              <div className="rounded-2xl bg-[#050505] p-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Waves className="w-4 h-4" /> 1-Period Ahead Forecast Bands
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
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: colorHex }}>حالة التقلب (Volatility Regime)</p>
                  <p className="text-2xl font-black text-white flex items-center gap-2">
                    {result.state}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-xs text-white/40 mb-1">نسبة التقلب السنوية (المتوقعة)</p>
                  <p className="text-lg font-black font-mono text-white/80">{result.annualisedVolPct}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/5 p-4 flex flex-col gap-1">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">التقلب التاريخي (Historical)</p>
                  <p className="text-xl font-black text-white">{result.historicalVolPct}%</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/5 p-4 flex flex-col gap-1">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">التقلب الحالي (Recent)</p>
                  <p className="text-xl font-black text-white">{result.recentVolPct}%</p>
                </div>
              </div>

              {/* Band Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex flex-col gap-1">
                  <p className="text-xs font-bold text-red-400/60 uppercase tracking-widest flex items-center gap-1.5"><MoveVertical className="w-3 h-3" /> مقاومة قادمة (+1σ)</p>
                  <p className="text-xl font-black text-red-400 font-mono">${result.upperBound.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">المسافة: <span className="text-emerald-400">+{result.upperPct}%</span></p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-1">
                  <p className="text-xs font-bold text-emerald-400/60 uppercase tracking-widest flex items-center gap-1.5"><MoveVertical className="w-3 h-3" /> دعم قادم (-1σ)</p>
                  <p className="text-xl font-black text-emerald-400 font-mono">${result.lowerBound.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1">المسافة: <span className="text-red-400">{result.lowerPct}%</span></p>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: colorHex + '30', background: colorHex + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: colorHex }}>التحليل والتوقع الاحتمالي</p>
                <p className="text-sm text-white/70 leading-relaxed">
                  توقع التقلبات للشمعة القادمة. بناءً على نموذج GARCH(1,1)، نطاق حركة السعر المتوقع (بثقة 68%) هو بين <span className="text-emerald-400 font-black">${result.lowerBound.toLocaleString()}</span> كدعم محتمل، و <span className="text-red-400 font-black">${result.upperBound.toLocaleString()}</span> كمقاومة محتملة. 
                  التقلب الحالي يشير إلى <span className="font-bold text-white">{result.state}</span> في السيولة.
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
