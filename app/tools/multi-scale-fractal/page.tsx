'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Network, AlertCircle, TriangleAlert, Activity } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { analyzeMultiFractal, FractalResult } from '@/lib/algorithms/multiFractal';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { ToolChart, HorizontalLine } from '@/components/tools/ToolChart';
import { notFound } from 'next/navigation';

export default function MultiScaleFractalPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [result, setResult] = useState<FractalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  async function handleScan() {
    if (!symbol.trim()) {
      setError('أدخل اسم الأصل.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formattedSymbol = symbol.toUpperCase().trim();
      const klines = await fetchKlines(formattedSymbol, timeframe, 150);

      if (klines.length < 50) {
        throw new Error('بيانات غير كافية لتحليل الفركتلات المتعددة.');
      }

      const res = analyzeMultiFractal(formattedSymbol, klines);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب البيانات أو تحليلها.');
    } finally {
      setLoading(false);
    }
  }

  const chartLines = useMemo(() => {
    if (!result) return [];
    
    const lines: HorizontalLine[] = [];
    result.scales.forEach(scale => {
      // Determine line style based on scale period (longer period = thicker/solid)
      let lineWidth: 1 | 2 | 3 | 4 = 1;
      let lineStyle = 1; // dashed by default
      if (scale.period >= 10) { lineWidth = 2; lineStyle = 0; } // solid
      else if (scale.period >= 5) { lineWidth = 1; lineStyle = 0; } // solid thin

      scale.levels.forEach(level => {
        lines.push({
          price: level.price,
          color: level.type === 'Resistance' ? '#ef4444' : '#10b981',
          title: `${scale.scaleName} ${level.type === 'Resistance' ? 'Res' : 'Sup'}`,
          lineWidth,
          lineStyle
        });
      });
    });

    return lines;
  }, [result]);

  const tool = slugToTool('multi-scale-fractal');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-[#c084fc]/70 tracking-widest uppercase border border-[#c084fc]/20 bg-[#c084fc]/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Network className="w-3 h-3" /> Advanced Structure
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">الفركتلات متعددة النطاقات</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          Multi-Scale Fractal Support & Resistance Engine
        </p>
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
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-[#c084fc]/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
              <option value="1w">1W</option>
            </select>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white transition-all disabled:opacity-50"
            style={{
              background: loading ? '#1a1a1a' : 'linear-gradient(135deg, #c084fc, #9333ea)',
              boxShadow: !loading ? '0 0 20px rgba(192,132,252,0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Network className="w-6 h-6" />}
            {loading ? 'جاري التحليل المتعدد...' : 'DETECT MULTI-SCALE FRACTALS'}
          </button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 mt-2">
            
            {/* Verdict Card */}
            <div className="rounded-2xl border border-[#c084fc]/30 bg-[#c084fc]/10 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-[#c084fc]" />
              <p className="text-sm font-black text-[#c084fc] uppercase tracking-widest flex items-center gap-2 mb-2">
                <TriangleAlert className="w-4 h-4" /> التحليل الهيكلي التراكمي
              </p>
              <p className="text-sm text-white/80 font-medium leading-relaxed">
                {result.verdict}
              </p>
            </div>

            {/* Tool Chart */}
            <div className="rounded-2xl bg-[#050505] p-4 border border-[#c084fc]/20 shadow-lg shadow-[#c084fc]/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-bold text-[#c084fc] uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4" /> خريطة المستويات الفراكتلية
                </p>
              </div>
              <ToolChart 
                klines={result.klines}
                priceLines={chartLines}
                height={350}
              />
            </div>

            {/* Scale Tables */}
            <div className="flex flex-col gap-4">
              {result.scales.map((scale, i) => (
                <div key={scale.scaleName} className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 flex flex-col">
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-black text-[#c084fc] uppercase">{scale.scaleName}</p>
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">فترة القياس: {scale.period} شموع</p>
                    </div>
                  </div>
                  
                  {scale.levels.length === 0 ? (
                    <p className="text-center text-white/30 text-xs py-4 font-mono">لا توجد مستويات مؤكدة</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {scale.levels.map((level, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full shadow-sm ${level.type === 'Resistance' ? 'bg-red-500 shadow-red-500/50' : 'bg-emerald-500 shadow-emerald-500/50'}`} />
                            <p className="text-white font-mono font-bold text-sm">
                              {level.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className={`text-xs font-black uppercase tracking-widest ${level.type === 'Resistance' ? 'text-red-400' : 'text-emerald-400'}`}>
                              {level.type === 'Resistance' ? 'مقاومة' : 'دعم'}
                            </p>
                            <p className="text-[10px] text-white/40 font-mono">منذ {level.age} شمعة</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
