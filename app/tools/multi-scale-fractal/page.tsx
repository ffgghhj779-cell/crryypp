'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Network, AlertCircle, TriangleAlert } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { analyzeMultiFractal, FractalResult } from '@/lib/algorithms/multiFractal';
import { notFound } from 'next/navigation';

export default function MultiScaleFractalPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [result, setResult] = useState<FractalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tool = slugToTool('multi-scale-fractal');
  if (!tool) return notFound();

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
      const klines = await fetchKlines(formattedSymbol, '1d', 100);

      if (klines.length < 30) {
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

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-black text-[#c084fc] uppercase tracking-widest flex items-center justify-center">
            الفركتلات متعددة النطاقات
          </p>
          <p className="text-[10px] text-center font-black text-[#c084fc]/70 uppercase tracking-[0.2em]">
            MULTI-SCALE FRACTAL ENGINE
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="BTCUSDT"
            className="w-full bg-[#111] border border-[#c084fc]/20 rounded-lg px-4 py-3 text-center text-white font-bold tracking-widest uppercase focus:outline-none focus:border-[#c084fc] transition-colors"
          />
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full bg-[#c084fc] hover:bg-[#d8b4fe] disabled:opacity-50 text-black font-black uppercase tracking-widest py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Network className="animate-spin w-5 h-5" /> : 'DETECT FRACTALS'}
          </button>
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
      </div>

      {result && (
        <div className="px-5 flex flex-col gap-6 mt-4">
          
          {/* Verdict Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-[#c084fc] rounded-xl bg-black p-5 flex flex-col items-center relative overflow-hidden"
          >
            <TriangleAlert className="w-8 h-8 text-[#c084fc] mb-2 opacity-50 absolute top-4 left-4" />
            <p className="text-xs text-[#c084fc] font-mono mb-2">التحليل الهيكلي // STRUCTURAL VERDICT</p>
            <p className="text-sm font-bold text-white text-center leading-relaxed mt-2 z-10">
              {result.verdict}
            </p>
          </motion.div>

          {/* Scale Tables */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-4"
          >
            {result.scales.map((scale, i) => (
              <div key={scale.scaleName} className="border border-white/10 rounded-xl bg-[#111] p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                  <p className="text-xs font-mono text-white/60">Period: {scale.period} Candles</p>
                  <p className="text-sm font-black text-[#c084fc] uppercase">{scale.scaleName}</p>
                </div>
                
                {scale.levels.length === 0 ? (
                  <p className="text-center text-white/30 text-xs py-4">لم يتم رصد فركتلات واضحة</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {scale.levels.map((level, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-black rounded-lg p-3 border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${level.type === 'Resistance' ? 'bg-red-500' : 'bg-green-500'}`} />
                          <p className="text-white font-bold text-sm">${level.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className={`text-xs font-bold ${level.type === 'Resistance' ? 'text-red-400' : 'text-green-400'}`}>
                            {level.type === 'Resistance' ? 'مقاومة' : 'دعم'}
                          </p>
                          <p className="text-[10px] text-white/40 font-mono">{level.age} bars ago</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </motion.div>

        </div>
      )}
    </div>
  );
}
