'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Waves, Cpu, Clock, Focus } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, OverlaySeries } from '@/components/tools/ToolChart';
import { EWAResultCard } from '@/components/tools/EWAResultCard';
import type { EWAResult } from '@/lib/types/ewa';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';

export default function ElliottWavePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<EWAResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      // Fetch klines for visual chart background
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 200);
      setKlines(fetchedKlines);

      // Call Python Microservice
      const initData = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData;
      const res = await fetch('/api/ewa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.toUpperCase().trim(),
          macro_tf: '1d',
          micro_tf: timeframe,
          init_data: initData || 'mock_init_data_for_dev'
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || json.detail || `فشل التحليل (خطأ ${res.status})`);
      }
      
      setResult(json as EWAResult);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol, timeframe]);

  const colorHex = '#f97316'; // Orange for EWA

  // Generate an overlay for ToolChart
  const overlays: OverlaySeries[] = [];
  if (result && result.pivots && result.pivots.length > 0) {
    const waveLineData = result.pivots.map(p => ({
      time: p.timestamp * 1000,
      value: p.price
    }));

    overlays.push({
      type: 'line',
      data: waveLineData,
      color: '#f97316',
      title: 'Elliott Wave Structure',
      lineWidth: 2
    });
  }

  const tool = slugToTool('elliott-wave-ewa');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-orange-400/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Cpu className="w-3 h-3" /> Python Engine AI
        </span>
        <h1 className="text-xl font-black text-white mt-1">موجات إليوت (EWA Engine)</h1>
        <p className="text-sm text-white/40 font-mono">Quantitative 5-wave MTF engine (Bybit Data)</p>
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
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-orange-500/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
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
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#c2410c,#9a3412)', boxShadow: !loading ? '0 0 20px rgba(194,65,12,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري فحص النماذج بالذكاء الاصطناعي...' : 'تحليل موجات إليوت'}
          </button>
        </div>

        <AnimatePresence>
          {result && !result.error && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              <div className="rounded-2xl bg-[#050505] p-4 border border-orange-500/20 shadow-lg shadow-orange-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2">
                    <Waves className="w-4 h-4" /> EWA Wave Structure
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • {timeframe.toUpperCase()}</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  overlays={overlays}
                />
              </div>

              {/* Integrating the standardized EWAResultCard */}
              <EWAResultCard data={result} symbol={symbol} />

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
