'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mountain, ScanSearch, AlertCircle } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, HorizontalLine } from '@/components/tools/ToolChart';
import { detectDoublePattern, DoublePatternResult } from '@/lib/algorithms/classicPatterns';

export default function DoublePatternPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DoublePatternResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '4h', 200);
      if (fetchedKlines.length < 60) throw new Error('بيانات غير كافية للتحليل (نحتاج 60 شمعة على الأقل)');
      
      setKlines(fetchedKlines);
      const res = detectDoublePattern(fetchedKlines);
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const isBullish = result?.type === 'DOUBLE_BOTTOM';
  const isBearish = result?.type === 'DOUBLE_TOP';
  const colorHex = isBullish ? '#10b981' : isBearish ? '#ef4444' : '#6b7280';

  // Generate price lines for the chart
  const priceLines: HorizontalLine[] = [];
  if (result?.detected) {
    priceLines.push({
      price: (result.level1 + result.level2) / 2,
      color: isBullish ? '#ef4444' : '#10b981', // Support if double bottom, resistance if double top
      title: 'القمتين/القاعين',
      lineWidth: 2,
      lineStyle: 0
    });
    priceLines.push({
      price: result.neckline,
      color: '#f59e0b',
      title: 'خط العنق (Neckline)',
      lineWidth: 2,
      lineStyle: 1
    });
    priceLines.push({
      price: result.target,
      color: isBullish ? '#10b981' : '#ef4444',
      title: 'الهدف المتوقع (Target)',
      lineWidth: 2,
      lineStyle: 2
    });
  }

  const tool = slugToTool('double-pattern');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-violet-400/70 tracking-widest uppercase border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Mountain className="w-3 h-3" /> Double Pattern
        </span>
        <h1 className="text-xl font-black text-white mt-1">مكتشف القمتين والقاعين</h1>
        <p className="text-sm text-white/40 font-mono">Double Top / Bottom Detector — نماذج الانعكاس الكلاسيكية</p>
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
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)', boxShadow: !loading ? '0 0 20px rgba(139,92,246,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الفحص (4H)...' : 'بحث عن قمتين / قاعين'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              {!result.detected ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center flex flex-col items-center gap-3">
                  <ScanSearch className="w-12 h-12 text-white/20" />
                  <p className="text-lg font-bold text-white/60">لم يتم رصد نموذج قمتين أو قاعين مكتمل</p>
                  <p className="text-sm text-white/40">السوق لا يشكل حالياً نماذج انعكاس كلاسيكية واضحة في هذا الإطار.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-[#050505] p-4 border border-violet-500/20 shadow-lg shadow-violet-500/5">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
                        <Mountain className="w-4 h-4" /> Pattern View
                      </p>
                      <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 4H</p>
                    </div>
                    <ToolChart 
                      klines={klines}
                      height={300}
                      priceLines={priceLines}
                    />
                  </div>

                  <div className="rounded-2xl border p-6 flex items-center justify-between" style={{ borderColor: colorHex + '40', background: colorHex + '0a' }}>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: colorHex }}>نوع النموذج المكتشف</p>
                      <p className="text-2xl font-black text-white">{isBullish ? 'قاعين مزدوجين (Double Bottom)' : 'قمتين مزدوجتين (Double Top)'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40 mb-1">نسبة الثقة</p>
                      <p className="text-xl font-black font-mono" style={{ color: colorHex }}>{result.confidence}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4">
                      <p className="text-xs text-white/40 mb-1">خط العنق (Neckline)</p>
                      <p className="text-lg font-black text-white font-mono">{result.neckline}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4">
                      <p className="text-xs text-white/40 mb-1">الهدف المتوقع (Target)</p>
                      <p className="text-lg font-black font-mono" style={{ color: colorHex }}>{result.target}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-5" style={{ borderColor: colorHex + '30', background: colorHex + '08' }}>
                    <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: colorHex }}>التحليل والتوقع</p>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {result.verdict} {isBullish ? 'إذا تم اختراق خط العنق لأعلى والاستقرار فوقه، فمن المتوقع صعود السعر نحو الهدف.' : 'إذا تم كسر خط العنق لأسفل والاستقرار تحته، فمن المتوقع هبوط السعر نحو الهدف.'}
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
