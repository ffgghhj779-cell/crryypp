'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, BarChart3, Activity, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart } from '@/components/tools/ToolChart';
import { analyzeCVDProxy, CVDResult } from '@/lib/algorithms/orderflow';

export default function OrderFlowCDDPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CVDResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '4h', 150);
      if (fetchedKlines.length < 50) throw new Error('بيانات غير كافية للتحليل (نحتاج 50 شمعة على الأقل)');
      
      setKlines(fetchedKlines);
      const res = analyzeCVDProxy(fetchedKlines);
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const isAccumulation = result?.cvdTrend === 'ACCUMULATION';
  const isDistribution = result?.cvdTrend === 'DISTRIBUTION';
  const colorHex = isAccumulation ? '#10b981' : isDistribution ? '#ef4444' : '#6b7280';
  
  const TrendIcon = result?.priceTrend === 'UP' ? TrendingUp : result?.priceTrend === 'DOWN' ? TrendingDown : ArrowRightLeft;

  const tool = slugToTool('order-flow-cdd');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-sky-400/70 tracking-widest uppercase border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <BarChart3 className="w-3 h-3" /> Smart Money Concepts
        </span>
        <h1 className="text-xl font-black text-white mt-1">تراكم دلتا الحجم (CVD Proxy)</h1>
        <p className="text-sm text-white/40 font-mono">Cumulative Volume Delta & Divergence Detector</p>
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
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#0284c7,#0369a1)', boxShadow: !loading ? '0 0 20px rgba(2,132,199,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري فحص الحجم (4H)...' : 'تحليل تدفق الأوامر (Order Flow)'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              <div className="rounded-2xl bg-[#050505] p-4 border border-sky-500/20 shadow-lg shadow-sky-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Price & Volume Action
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 4H</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                />
              </div>

              <div className="rounded-2xl border p-6 flex items-center justify-between" style={{ borderColor: colorHex + '40', background: colorHex + '0a' }}>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: colorHex }}>مؤشر دلتا التراكمي (CVD)</p>
                  <p className="text-2xl font-black text-white flex items-center gap-2">
                    {isAccumulation ? 'تجميع (Accumulation)' : isDistribution ? 'تصريف (Distribution)' : 'محايد (Neutral)'}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-xs text-white/40 mb-1">صافي الدلتا التقريبي</p>
                  <p className="text-lg font-black font-mono" style={{ color: colorHex }}>{result.rawDelta > 0 ? '+' : ''}{result.rawDelta.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl border p-4 flex flex-col items-center justify-center gap-2 ${result.divergenceDetected ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/[0.06]'}`}>
                  <p className={`text-xs font-bold uppercase tracking-widest ${result.divergenceDetected ? 'text-orange-400' : 'text-white/40'}`}>انفراج الحجم والسعر (Divergence)</p>
                  <p className={`text-xl font-black ${result.divergenceDetected ? 'text-orange-400' : 'text-white'}`}>
                    {result.divergenceDetected ? 'مُكتشف! ⚠️' : 'غير مكتشف'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4 flex flex-col items-center justify-center gap-2">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">الاتجاه السعري</p>
                  <p className="text-xl font-black text-white flex items-center gap-2">
                    {result.priceTrend === 'UP' ? 'صاعد' : result.priceTrend === 'DOWN' ? 'هابط' : 'عرضي'}
                    <TrendIcon className="w-5 h-5 text-white/60" />
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: colorHex + '30', background: colorHex + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: colorHex }}>التحليل والتوقع</p>
                <p className="text-sm text-white/70 leading-relaxed">
                  {result.verdict}
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
