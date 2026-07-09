'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, AlertCircle, Droplets, Target } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { analyzeMFIMTF, MFIResult } from '@/lib/algorithms/mfiMtf';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { ToolChart } from '@/components/tools/ToolChart';
import { notFound } from 'next/navigation';

export default function MfiMtfPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [result, setResult] = useState<MFIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب البيانات أو تحليلها.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-[#00bfff]/70 tracking-widest uppercase border border-[#00bfff]/20 bg-[#00bfff]/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Droplets className="w-3 h-3" /> Volume & Flow
        </span>
        <h1 className="text-xl font-black text-white mt-1">MFI متعدد الأطر (MTF)</h1>
        <p className="text-sm text-white/40 font-mono">تدفق السيولة على مدار الساعة، 4 ساعات، ويومي</p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          
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
            className="w-full bg-[#00bfff] hover:bg-[#33ccff] disabled:opacity-50 text-black font-black uppercase tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,191,255,0.25)]"
          >
            {loading ? <span className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Activity className="w-6 h-6" />}
            {loading ? 'جاري تحليل السيولة...' : 'ANALYZE FLOW MTF'}
          </button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 mt-2">
            
            {/* Verdict Card */}
            <div className="rounded-2xl border border-[#00bfff]/30 bg-[#00bfff]/10 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-[#00bfff]" />
              <p className="text-sm font-black text-[#00bfff] uppercase tracking-widest flex items-center gap-2 mb-2">
                <Target className="w-4 h-4" /> خلاصة السيولة (Liquidity Verdict)
              </p>
              <p className="text-sm text-white/80 font-medium leading-relaxed">
                {result.verdict}
              </p>
            </div>

            {/* Charts List */}
            <div className="flex flex-col gap-6 mt-2">
              {result.timeframes.map((tf, i) => {
                const isOverbought = tf.status === 'Overbought';
                const isOversold = tf.status === 'Oversold';
                const color = isOverbought ? '#ef4444' : isOversold ? '#10b981' : '#00bfff';

                // Map chart data to overlays
                const overlays = [{
                  type: 'line' as const,
                  data: tf.chartData.map(p => ({
                    time: p.time * 1000, // ToolChart expects ms if it's timestamps
                    value: p.value
                  })),
                  color: color,
                  lineWidth: 2 as const,
                  title: `MFI (${tf.timeframe})`,
                  priceScaleId: 'left'
                }];

                return (
                  <div key={tf.timeframe} className="rounded-2xl bg-[#050505] p-4 border border-white/10 shadow-lg relative">
                    <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black" style={{ color }}>{tf.timeframe}</span>
                        <span className="text-xs font-mono font-bold uppercase px-2 py-1 rounded" style={{ background: color + '20', color }}>{tf.status}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-0.5">Current MFI</p>
                        <p className="text-2xl font-black font-mono" style={{ color }}>{tf.currentValue}</p>
                      </div>
                    </div>

                    {/* ToolChart */}
                    <div className="h-[250px]">
                      <ToolChart 
                        klines={tf.klines}
                        overlays={overlays}
                        height={250}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
