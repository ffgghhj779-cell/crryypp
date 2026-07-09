'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Activity, Vibrate, Radar, Clock } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart } from '@/components/tools/ToolChart';
import { analyzeFourier, FourierResult } from '@/lib/algorithms/advancedQuant';

export default function FourierTransformPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FourierResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 200);
      if (fetchedKlines.length < 50) throw new Error('بيانات غير كافية للتحليل (نحتاج 50 شمعة يومية على الأقل)');
      
      setKlines(fetchedKlines);
      const res = analyzeFourier(fetchedKlines);
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const colorHex = '#10b981';

  // Generate an overlay for ToolChart to simulate the cyclical wave
  const overlays = [];
  if (result && klines.length > 0) {
    // Generate a simple sine wave that peaks according to the Fourier cycle
    const cycleData = [];
    const cycleBars = result.dominantCycleBars;
    // Align wave so that it peaked `lastPeakAge` bars ago
    const phaseShift = Math.PI / 2 - (result.lastPeakAge / cycleBars) * 2 * Math.PI;

    for (let i = 0; i < klines.length; i++) {
      // Calculate a normalized sine wave value mapped vaguely to the price range
      const k = klines[i];
      const val = Math.sin((i / cycleBars) * 2 * Math.PI + phaseShift);
      cycleData.push({ time: k.time, value: val });
    }

    // Add future projections (10 bars)
    let lastTime = klines[klines.length - 1].time;
    for (let i = 1; i <= 20; i++) {
      lastTime += 86400000; // +1 day
      const val = Math.sin(((klines.length - 1 + i) / cycleBars) * 2 * Math.PI + phaseShift);
      cycleData.push({ time: lastTime, value: val });
    }

    overlays.push({
      type: 'line' as const,
      data: cycleData,
      color: '#10b981',
      title: 'Fourier Cycle Component',
      lineWidth: 2 as const,
      priceScaleId: 'left' // Put oscillator on left scale
    });
  }

  const tool = slugToTool('fourier-transform');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-emerald-400/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Activity className="w-3 h-3" /> Math & Quant
        </span>
        <h1 className="text-xl font-black text-white mt-1">تحويل فورييه (Fourier Transform)</h1>
        <p className="text-sm text-white/40 font-mono">Dominant Market Cycle Extraction</p>
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
            {loading ? 'جاري استخراج الدورات الزمنية...' : 'تحليل الدورات الزمنية (فورييه)'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              <div className="rounded-2xl bg-[#050505] p-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Vibrate className="w-4 h-4" /> Extracted Price Wave (Cycle)
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
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: colorHex }}>طول الدورة المهيمنة</p>
                  <p className="text-2xl font-black text-white flex items-center gap-2">
                    {result.dominantCycleBars} شمعة (يوم)
                  </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-xs text-white/40 mb-1">القمة المتوقعة القادمة</p>
                  <p className="text-lg font-black font-mono text-emerald-400">بعد {result.nextPeakEstimate} شمعة</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/5 p-4 flex items-center gap-3">
                  <Radar className="w-8 h-8 text-white/20 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">الدقة</p>
                    <p className="text-base font-black text-white">تقدير رياضي</p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/5 p-4 flex items-center gap-3">
                  <Clock className="w-8 h-8 text-emerald-500/30 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">القمة السابقة</p>
                    <p className="text-base font-black text-white">منذ {result.lastPeakAge} شمعة</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: colorHex + '30', background: colorHex + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: colorHex }}>تفسير الدورات الزمنية (Cyclical Interpretation)</p>
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
