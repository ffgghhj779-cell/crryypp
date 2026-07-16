'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, TrendingDown, TrendingUp, ChevronDown } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { analyzeLinearRegressionRange, LinearRegressionResult } from '@/lib/algorithms/advancedQuant';

export default function LinearRegressionCustomPage() {
  const [symbol, setSymbol] = useState('EGYXAU');
  const [startIdx, setStartIdx] = useState<number>(100);
  const [endIdx, setEndIdx] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LinearRegressionResult | null>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1h', 1000);
      if (fetchedKlines.length < 5) throw new Error('بيانات غير كافية');
      
      const len = fetchedKlines.length;
      let s = Number(startIdx);
      let e = Number(endIdx);
      if (isNaN(s) || s < 0) s = 100;
      if (isNaN(e) || e < 0) e = 0;
      if (s <= e) s = e + 10;
      
      const actualStart = Math.max(0, len - 1 - s);
      const actualEnd = Math.max(actualStart + 1, len - 1 - e);

      const res = analyzeLinearRegressionRange(fetchedKlines, actualStart, actualEnd);
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol, startIdx, endIdx]);

  const tool = slugToTool('linear-regression-1h-custom');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 flex flex-col gap-5 mt-5">
        <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 font-black text-lg text-white disabled:opacity-50 transition-all" 
          style={{ background: loading ? '#1a1a1a' : '#f97316' }}>
          {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
          {loading ? 'جاري التحليل...' : 'تشغيل التحليل'}
        </button>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-white/50">رقم البداية (شموع للخلف)</label>
              <input type="number" value={startIdx} onChange={(e) => setStartIdx(e.target.value as any)} 
                className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-orange-500/50 w-full" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-white/50">رقم النهاية (شموع للخلف)</label>
              <input type="number" value={endIdx} onChange={(e) => setEndIdx(e.target.value as any)} 
                className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-orange-500/50 w-full" />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0, y: 20}} animate={{opacity:1, y: 0}} exit={{opacity:0}} className="flex flex-col gap-0 rounded-3xl bg-[#111] border border-[#222] overflow-hidden shadow-2xl mx-1">
              
              <div className="flex items-start justify-between p-6 pb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 font-mono tracking-[0.2em] uppercase">قناة</span>
                    <span className="text-[10px] text-white/30 font-mono tracking-[0.2em] uppercase">LINEAR REGRESSION</span>
                  </div>
                  <h3 className="text-white/60 font-medium text-sm mt-1 text-left" dir="ltr">الانحدار الخطي</h3>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-2xl font-black text-white">{symbol.toUpperCase()}</span>
                    <span className="text-sm font-bold text-white/40 mb-1">1H</span>
                  </div>
                </div>
                
                <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border ${result.isTrendUp ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                  {result.isTrendUp ? <TrendingUp className="w-6 h-6 mb-1" /> : <TrendingDown className="w-6 h-6 mb-1" />}
                  <span className="text-[11px] font-bold">{result.isTrendUp ? 'صاعد' : 'هابط'}</span>
                </div>
              </div>

              <div className="bg-[#161616] m-4 rounded-2xl p-5 flex flex-col gap-5 border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white/50">القناة العلوية (+2σ)</span>
                  <span className="text-lg font-bold text-red-400 font-mono" dir="ltr">{result.upperChannel}</span>
                </div>
                
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white/50">قيمة الانحدار الحالية</span>
                  <span className="text-lg font-bold text-orange-400 font-mono" dir="ltr">{result.currentFit}</span>
                </div>

                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white/50">القناة السفلية (-2σ)</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono" dir="ltr">{result.lowerChannel}</span>
                </div>
              </div>

              <div className="px-6 flex justify-between items-center mb-6">
                <span className="text-sm font-medium text-white/50">الميل (Slope / شمعة)</span>
                <span className={`text-lg font-bold font-mono ${result.slope > 0 ? 'text-emerald-500' : 'text-red-500'}`} dir="ltr">
                  {result.slope > 0 ? '+' : ''}{result.slope}
                </span>
              </div>

              <div className="mx-4 mb-4 rounded-xl bg-[#161616] border-r-4 border-r-orange-500 p-4">
                <p className="text-sm font-medium text-white/70 leading-relaxed text-right">
                  قناة {result.isTrendUp ? 'صاعدة' : 'هابطة'}: الميل <span dir="ltr" className="inline-block mx-1">{result.slope}</span>.
                  القناة من <span dir="ltr" className="inline-block mx-1">{result.lowerChannel}</span> إلى <span dir="ltr" className="inline-block mx-1">{result.upperChannel}</span>.
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
