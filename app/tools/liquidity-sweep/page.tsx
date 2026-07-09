'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Waves, Droplets, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, HorizontalLine } from '@/components/tools/ToolChart';
import { analyzeLiquiditySweep, SweepResult } from '@/lib/algorithms/orderflow';

export default function LiquiditySweepPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SweepResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '15m', 150);
      if (fetchedKlines.length < 30) throw new Error('بيانات غير كافية للتحليل (نحتاج 30 شمعة على الأقل)');
      
      setKlines(fetchedKlines);
      const res = analyzeLiquiditySweep(fetchedKlines);
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const isBullish = result?.type === 'BULLISH_REJECTION';
  const isBearish = result?.type === 'BEARISH_REJECTION';
  const colorHex = isBullish ? '#10b981' : isBearish ? '#ef4444' : '#6b7280';

  // Generate price lines for the chart
  const priceLines: HorizontalLine[] = [];
  if (result?.swept) {
    priceLines.push({
      price: result.sweepLevel,
      color: colorHex,
      title: 'مستوى السيولة الممسوح (Liquidity Sweep)',
      lineWidth: 2,
      lineStyle: 0
    });
  }

  const SweepIcon = isBullish ? ArrowDownToLine : ArrowUpToLine;

  const tool = slugToTool('liquidity-sweep');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-cyan-400/70 tracking-widest uppercase border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Droplets className="w-3 h-3" /> Smart Money Concepts
        </span>
        <h1 className="text-xl font-black text-white mt-1">كاشف مسح السيولة (Liquidity Sweep)</h1>
        <p className="text-sm text-white/40 font-mono">Stop-hunt & liquidity grab detector</p>
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
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#06b6d4,#0891b2)', boxShadow: !loading ? '0 0 20px rgba(6,182,212,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الفحص (15m)...' : 'بحث عن مسح سيولة (Stop Hunt)'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              {!result.swept ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center flex flex-col items-center gap-3">
                  <Waves className="w-12 h-12 text-white/20" />
                  <p className="text-lg font-bold text-white/60">لم يتم رصد مسح سيولة حديث</p>
                  <p className="text-sm text-white/40">السوق مستقر ولا توجد ذيول رفض قوية كسرت مستويات السيولة السابقة.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-[#050505] p-4 border border-cyan-500/20 shadow-lg shadow-cyan-500/5">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                        <Droplets className="w-4 h-4" /> Liquidity Sweep
                      </p>
                      <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 15m</p>
                    </div>
                    <ToolChart 
                      klines={klines}
                      height={300}
                      priceLines={priceLines}
                    />
                  </div>

                  <div className="rounded-2xl border p-6 flex items-center justify-between" style={{ borderColor: colorHex + '40', background: colorHex + '0a' }}>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: colorHex }}>نوع الحدث</p>
                      <p className="text-2xl font-black text-white flex items-center gap-2">
                        {isBullish ? 'مسح سيولة شرائي (دعم)' : 'مسح سيولة بيعي (مقاومة)'}
                        <SweepIcon className="w-6 h-6" style={{ color: colorHex }} />
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4">
                      <p className="text-xs text-white/40 mb-1">مستوى السيولة المضروب</p>
                      <p className="text-lg font-black text-white font-mono">{result.sweepLevel}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4">
                      <p className="text-xs text-white/40 mb-1">نسبة الرفض (Wick %)</p>
                      <p className="text-lg font-black font-mono" style={{ color: colorHex }}>{result.wickPct}%</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-5" style={{ borderColor: colorHex + '30', background: colorHex + '08' }}>
                    <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: colorHex }}>التحليل والتوقع</p>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {result.verdict} {isBullish ? 'السوق ضرب وقف خسارة المشترين لجمع السيولة اللازمة للصعود. يعتبر إشارة إيجابية مبكرة للاستمرار بالصعود.' : 'السوق ضرب وقف خسارة البائعين لجمع السيولة اللازمة للهبوط. يعتبر إشارة سلبية مبكرة للاستمرار بالهبوط.'}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
