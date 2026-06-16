'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, AlertCircle, Droplets } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { analyzeMFIMTF, MFIResult } from '@/lib/algorithms/mfiMtf';
import { notFound } from 'next/navigation';

export default function MfiMtfPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [result, setResult] = useState<MFIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('mfi-mtf');
  if (!tool) return notFound();

  async function handleScan() {
    if (!symbol.trim()) {
      setError('أدخل اسم الأصل.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    setAnimated(false);

    try {
      const formattedSymbol = symbol.toUpperCase().trim();
      const [klines1H, klines4H, klines1D] = await Promise.all([
        fetchKlines(formattedSymbol, '1h', 100),
        fetchKlines(formattedSymbol, '4h', 100),
        fetchKlines(formattedSymbol, '1d', 100),
      ]);

      if (klines1H.length < 20 || klines4H.length < 20 || klines1D.length < 20) {
        throw new Error('بيانات غير كافية للتحليل.');
      }

      const res = analyzeMFIMTF(formattedSymbol, klines1H, klines4H, klines1D);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
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
          <p className="text-xs font-black text-[#00bfff] uppercase tracking-widest flex items-center justify-center">
            تدفق السيولة متعدد الفريمات
          </p>
          <p className="text-[10px] text-center font-black text-[#00bfff]/70 uppercase tracking-[0.2em]">
            MONEY FLOW INDEX (MFI) MTF
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="BTCUSDT"
            className="w-full bg-[#111] border border-[#00bfff]/20 rounded-lg px-4 py-3 text-center text-white font-bold tracking-widest uppercase focus:outline-none focus:border-[#00bfff] transition-colors"
          />
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full bg-[#00bfff] hover:bg-[#33ccff] disabled:opacity-50 text-black font-black uppercase tracking-widest py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Activity className="animate-spin w-5 h-5" /> : 'ANALYZE FLOW'}
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
            className="border border-[#00bfff] rounded-xl bg-black p-5 flex flex-col items-center relative overflow-hidden"
          >
            <Droplets className="w-8 h-8 text-[#00bfff] mb-2 opacity-50 absolute top-4 left-4" />
            <p className="text-xs text-[#00bfff] font-mono mb-2">خلاصة السيولة // LIQUIDITY VERDICT</p>
            <p className="text-lg font-bold text-white text-center leading-relaxed mt-2 z-10">
              {result.verdict}
            </p>
          </motion.div>

          {/* Charts */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-4"
          >
            {result.timeframes.map((tf, i) => {
              const isOverbought = tf.status === 'Overbought';
              const isOversold = tf.status === 'Oversold';
              const color = isOverbought ? '#ef4444' : isOversold ? '#10b981' : '#00bfff';

              return (
                <div key={tf.timeframe} className="border border-white/10 rounded-xl bg-black p-4 flex flex-col gap-3 relative">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <p className="text-xs font-mono text-white/60">{tf.status}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-black text-white">{tf.currentValue}</p>
                      <p className="text-sm font-black" style={{ color }}>{tf.timeframe}</p>
                    </div>
                  </div>

                  <div className="h-24 relative bg-[#111] border border-white/5 rounded-sm overflow-hidden mt-2">
                    {/* Zones (20 - 80) */}
                    <div className="absolute top-[20%] left-0 right-0 border-t border-red-500/30 border-dashed" />
                    <div className="absolute bottom-[20%] left-0 right-0 border-t border-green-500/30 border-dashed" />
                    <div className="absolute top-[20%] bottom-[20%] left-0 right-0 bg-[#00bfff]/5" />
                    
                    {/* Line Chart */}
                    <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {tf.chartData.length > 0 && (
                        <motion.path 
                          d={`M ${tf.chartData.map((p, idx) => `${(idx / (tf.chartData.length - 1)) * 100} ${100 - p.value}`).join(' L ')}`}
                          fill="none" 
                          stroke={color} 
                          strokeWidth="2" 
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: animated ? 1 : 0 }}
                          transition={{ duration: 1.5, delay: 0.2 + i * 0.1 }}
                        />
                      )}
                    </svg>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
}
