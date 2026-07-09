'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Droplets, ScanSearch, AlertCircle, Activity } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, OverlaySeries } from '@/components/tools/ToolChart';

interface FlowResult {
  mfi: number;
  cmf: number;
  klines: Kline[];
  mfiSeries: { time: number; value: number }[];
  cmfSeries: { time: number; value: number }[];
}

function calcMoneyFlow(klines: Kline[], mfiPeriod = 14, cmfPeriod = 20): FlowResult {
  const mfiSeries: { time: number; value: number }[] = [];
  const cmfSeries: { time: number; value: number }[] = [];

  for (let i = Math.max(mfiPeriod, cmfPeriod); i < klines.length; i++) {
    // --- MFI Calculation ---
    const mfiSlice = klines.slice(i - mfiPeriod, i + 1);
    let posFlow = 0, negFlow = 0;
    for (let j = 1; j < mfiSlice.length; j++) {
      const tp = (mfiSlice[j].high + mfiSlice[j].low + mfiSlice[j].close) / 3;
      const prevTp = (mfiSlice[j - 1].high + mfiSlice[j - 1].low + mfiSlice[j - 1].close) / 3;
      const mf = tp * mfiSlice[j].volume;
      if (tp > prevTp) posFlow += mf; 
      else if (tp < prevTp) negFlow += mf;
    }
    const mfiVal = negFlow === 0 ? 100 : posFlow === 0 ? 0 : 100 - 100 / (1 + posFlow / negFlow);
    mfiSeries.push({ time: klines[i].time * 1000, value: +mfiVal.toFixed(2) });

    // --- CMF Calculation ---
    const cmfSlice = klines.slice(i - cmfPeriod + 1, i + 1);
    let sumMFV = 0;
    let sumVol = 0;
    for (const k of cmfSlice) {
      const range = k.high - k.low;
      const mfm = range === 0 ? 0 : ((k.close - k.low) - (k.high - k.close)) / range;
      const mfv = mfm * k.volume;
      sumMFV += mfv;
      sumVol += k.volume;
    }
    const cmfVal = sumVol === 0 ? 0 : sumMFV / sumVol;
    cmfSeries.push({ time: klines[i].time * 1000, value: +cmfVal.toFixed(3) });
  }

  const currentMfi = mfiSeries.length > 0 ? mfiSeries[mfiSeries.length - 1].value : 50;
  const currentCmf = cmfSeries.length > 0 ? cmfSeries[cmfSeries.length - 1].value : 0;

  return { mfi: currentMfi, cmf: currentCmf, klines, mfiSeries, cmfSeries };
}

export default function FlowIndexPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FlowResult | null>(null);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 150);
      if (klines.length < 30) throw new Error('بيانات غير كافية לחساب المؤشرات بدقة');
      setResult(calcMoneyFlow(klines));
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol, timeframe]);

  const mfi = result?.mfi ?? 50;
  const state = result === null ? null 
    : mfi >= 80 ? { label: 'تشبع شراء', color: '#ef4444', bg: '#ef444410', advice: 'MFI يظهر تشبع شرائي زائد. احذر من احتمال حدوث انعكاس هابط أو تصحيح.' }
    : mfi <= 20 ? { label: 'تشبع بيع', color: '#10b981', bg: '#10b98110', advice: 'MFI يظهر تشبع بيعي. قد تكون هناك فرصة لارتداد صاعد مع دخول سيولة جديدة.' }
    : mfi >= 60 ? { label: 'ضغط شراء', color: '#3b82f6', bg: '#3b82f610', advice: 'تدفق الأموال إيجابي والسيولة تدخل السوق بقوة. الاتجاه الصاعد مدعوم.' }
    : mfi <= 40 ? { label: 'ضغط بيع', color: '#f97316', bg: '#f9731610', advice: 'تدفق الأموال سلبي والسيولة تخرج من السوق. احذر من استمرار الهبوط.' }
    : { label: 'محايد', color: '#6b7280', bg: '#6b728010', advice: 'توازن في تدفق الأموال. لا يوجد هيمنة واضحة. يفضل انتظار إشارة خروج من النطاق.' };

  const angle = -90 + (mfi / 100) * 180;

  const chartOverlays = useMemo(() => {
    if (!result) return [];
    const overlays: OverlaySeries[] = [];
    
    // Scale CMF from (-1 to 1) into (0 to 100) so it shares the same left axis reasonably well with MFI
    // CMF scaled = (cmf + 1) * 50
    const scaledCmfSeries = result.cmfSeries.map(c => ({
      time: c.time,
      value: (c.value + 1) * 50
    }));

    overlays.push({
      type: 'line',
      data: result.mfiSeries,
      color: '#0ea5e9', // Sky blue for MFI
      title: 'MFI (14)',
      lineWidth: 2,
      priceScaleId: 'left'
    });

    overlays.push({
      type: 'line',
      data: scaledCmfSeries,
      color: '#f59e0b', // Amber for CMF
      title: 'CMF (Scaled)',
      lineWidth: 2,
      priceScaleId: 'left'
    });

    return overlays;
  }, [result]);

  
  const tool = slugToTool('flow-index');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-sky-400/70 tracking-widest uppercase border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Droplets className="w-3 h-3" /> Volume & Flow
        </span>
        <h1 className="text-xl font-black text-white mt-1">مؤشرات تدفق السيولة (MFI & CMF)</h1>
        <p className="text-sm text-white/40 font-mono">Chaikin Money Flow & Money Flow Index Dashboard</p>
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
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-sky-500/50"
            >
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
              <option value="1w">1W</option>
            </select>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: !loading ? '0 0 20px rgba(14,165,233,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الحساب والتحليل...' : 'تحليل تدفق السيولة'}
          </button>
        </div>

        <AnimatePresence>
          {result && state && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              
              {/* Dual Indicators Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 flex flex-col items-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-sky-400/60 mb-1">MFI (14)</p>
                  <p className="text-3xl font-black text-sky-400 font-mono">{result.mfi.toFixed(1)}</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col items-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400/60 mb-1">CMF (20)</p>
                  <p className="text-3xl font-black text-amber-400 font-mono">{result.cmf > 0 ? '+' : ''}{result.cmf.toFixed(3)}</p>
                </div>
              </div>

              {/* MFI Gauge */}
              <div className="rounded-3xl border border-white/[0.08] bg-[#0d0d0d] p-8 flex flex-col items-center gap-4 relative overflow-hidden">
                <p className="text-xs font-bold text-white/30 uppercase tracking-widest">مقياس تشبع السيولة (MFI)</p>
                <div className="relative w-56 h-28 overflow-hidden">
                  <svg viewBox="0 0 200 100" className="w-full h-full">
                    <defs>
                      <linearGradient id="mfiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%"   stopColor="#10b981" />
                        <stop offset="30%"  stopColor="#f59e0b" />
                        <stop offset="70%"  stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#222" strokeWidth="18" strokeLinecap="round" />
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#mfiGrad)" strokeWidth="18" strokeLinecap="round" />
                    
                    <text x="12"  y="95" fill="#10b981" fontSize="9" fontFamily="monospace">0</text>
                    <text x="88"  y="22" fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="middle">50</text>
                    <text x="182" y="95" fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="end">100</text>
                    
                    <motion.g initial={{ rotate: -90 }} animate={{ rotate: angle }} transition={{ type: 'spring', stiffness: 50, damping: 14 }} style={{ originX: '100px', originY: '100px' }}>
                      <line x1="100" y1="100" x2="100" y2="28" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="100" cy="100" r="5" fill="#fff" />
                    </motion.g>
                  </svg>
                  <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
                    <span className="text-4xl font-black font-mono text-white" style={{ color: state.color }}>{result.mfi.toFixed(0)}</span>
                  </div>
                </div>
                
                <div className="flex w-full justify-between text-xs font-bold uppercase tracking-widest mt-2 px-2">
                  <span className="text-emerald-400">تشبع بيع</span>
                  <span className="text-white/30">محايد</span>
                  <span className="text-red-400">تشبع شراء</span>
                </div>
              </div>

              {/* ToolChart */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-white/10 shadow-lg mt-2">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> حركة السيولة تاريخياً
                  </p>
                </div>
                <ToolChart 
                  klines={result.klines}
                  overlays={chartOverlays}
                  height={300}
                />
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border p-5 mt-2" style={{ borderColor: state.color + '40', background: state.color + '10' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: state.color }}>الدليل الإرشادي التكتيكي</p>
                <p className="text-sm text-white/80 leading-relaxed font-medium">{state.advice}</p>
                
                <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-1.5">
                  <p className="text-xs text-white/60">
                    <span className="text-sky-400 font-bold">MFI (أزرق):</span> يعكس السيولة بناءً على تسارع الأسعار (Momentum).
                  </p>
                  <p className="text-xs text-white/60">
                    <span className="text-amber-400 font-bold">CMF (أصفر):</span> يعكس قوة الإغلاق مقارنة بالمدى السعري لتحديد التجميع/التصريف.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
