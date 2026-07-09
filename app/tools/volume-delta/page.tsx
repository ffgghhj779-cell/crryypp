'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ScanSearch, AlertCircle, TrendingUp, TrendingDown, Minus, Layers } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, OverlaySeries } from '@/components/tools/ToolChart';

interface DeltaCandle { time: number; close: number; volume: number; buyVol: number; sellVol: number; delta: number; }
interface DeltaResult { candles: DeltaCandle[]; cumDelta: number; avgDelta: number; dominance: 'buy' | 'sell' | 'neutral'; currentPrice: number; }

function calcDelta(klines: Kline[]): DeltaResult {
  const candles: DeltaCandle[] = klines.map(k => {
    let buyVol = 0;
    let sellVol = 0;
    
    // Exact delta if takerBuyVol is available (Binance Crypto), else fallback approximation (Commodities)
    if (typeof k.takerBuyVol === 'number' && !isNaN(k.takerBuyVol)) {
      buyVol = k.takerBuyVol;
      sellVol = Math.max(0, k.volume - buyVol);
    } else {
      const range = k.high - k.low || 0.0001;
      buyVol = k.volume * Math.max(0, Math.min(1, (k.close - k.low) / range));
      sellVol = Math.max(0, k.volume - buyVol);
    }

    return { 
      time: k.time * 1000,
      close: k.close,
      volume: k.volume, 
      buyVol: +buyVol.toFixed(2), 
      sellVol: +sellVol.toFixed(2), 
      delta: +(buyVol - sellVol).toFixed(2) 
    };
  });

  const slice = candles.slice(-50); // Analyze last 50 for the stats
  const cumDelta = slice.reduce((s, c) => s + c.delta, 0);
  const avgDelta = cumDelta / slice.length;
  const dominance: 'buy' | 'sell' | 'neutral' = cumDelta > (avgDelta * 10) ? 'buy' : cumDelta < (-avgDelta * 10) ? 'sell' : 'neutral';
  const currentPrice = klines[klines.length - 1].close;

  return { candles, cumDelta: +cumDelta.toFixed(0), avgDelta: +avgDelta.toFixed(0), dominance, currentPrice };
}

const fmtVol = (v: number) => {
  const abs = Math.abs(v);
  if (abs > 1_000_000_000) return `${(v/1_000_000_000).toFixed(2)}B`;
  if (abs > 1_000_000) return `${(v/1_000_000).toFixed(2)}M`;
  if (abs > 1000) return `${(v/1000).toFixed(1)}K`;
  return v.toFixed(0);
};

export default function VolumeDeltaPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DeltaResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 150);
      if (fetchedKlines.length < 50) throw new Error('بيانات غير كافية (نحتاج 50 شمعة على الأقل)');
      
      setKlines(fetchedKlines);
      setResult(calcDelta(fetchedKlines));
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol, timeframe]);

  const domColor = result?.dominance === 'buy' ? '#10b981' : result?.dominance === 'sell' ? '#ef4444' : '#6b7280';
  const DomIcon = result?.dominance === 'buy' ? TrendingUp : result?.dominance === 'sell' ? TrendingDown : Minus;

  let verdict = '';
  if (result) {
    if (result.dominance === 'buy') {
      verdict = `دلتا الحجم التراكمي إيجابي بقوة (+${fmtVol(result.cumDelta)}) — المشترون يمتصون العروض البيعية (Absorption) ويسيطرون على حركة السعر. الضغط الشرائي يدعم استمرار الصعود.`;
    } else if (result.dominance === 'sell') {
      verdict = `دلتا الحجم التراكمي سلبي بقوة (${fmtVol(result.cumDelta)}) — البائعون يسيطرون بوضوح على السوق (Distribution). العروض البيعية تفوق الطلب مما يدعم الهبوط.`;
    } else {
      verdict = `توازن في دلتا الحجم (${fmtVol(result.cumDelta)}) — لا يوجد هيمنة واضحة للمشترين أو البائعين في الفترة الأخيرة. السوق في حالة تماسك وترقب لسيولة جديدة.`;
    }
  }

  // Generate an overlay for ToolChart
  const overlays: OverlaySeries[] = [];
  if (result && klines.length > 0) {
    const deltaBarData = result.candles.map(c => ({
      time: c.time,
      value: c.delta
    }));

    let runningCumDelta = 0;
    const cumDeltaData = result.candles.map(c => {
      runningCumDelta += c.delta;
      return { time: c.time, value: runningCumDelta };
    });

    overlays.push({
      type: 'histogram',
      data: deltaBarData,
      color: '#06b6d4',
      title: 'Delta Volume'
    });

    overlays.push({
      type: 'line',
      data: cumDeltaData,
      color: '#f59e0b',
      title: 'Cumulative Volume Delta (CVD)',
      lineWidth: 2
    });
  }

  
  const tool = slugToTool('volume-delta');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-cyan-400/70 tracking-widest uppercase border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Activity className="w-3 h-3" /> Volume & Order Flow
        </span>
        <h1 className="text-xl font-black text-white mt-1">فارق أحجام التداول (Volume Delta)</h1>
        <p className="text-sm text-white/40 font-mono">Real-time Buy vs Sell Aggressor Volume</p>
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
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-cyan-500/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
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
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#06b6d4,#0e7490)', boxShadow: !loading ? '0 0 20px rgba(6,182,212,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري قراءة السيولة...' : 'تحليل Volume Delta'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              <div className="rounded-2xl bg-[#050505] p-4 border border-cyan-500/20 shadow-lg shadow-cyan-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Cumulative Volume Delta (CVD)
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • {timeframe.toUpperCase()}</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  overlays={overlays}
                />
              </div>

              {/* Dominance Card */}
              <div className="rounded-2xl border p-6 flex items-center justify-between" style={{ borderColor: domColor + '40', background: domColor + '08' }}>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: domColor }}>الهيمنة الحالية للسيولة</p>
                  <p className="text-2xl font-black text-white flex items-center gap-2">
                    {result.dominance === 'buy' ? 'المشترون' : result.dominance === 'sell' ? 'البائعون' : 'توازن'}
                    <DomIcon className="w-6 h-6" style={{ color: domColor }} />
                  </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-xs text-white/40 mb-1">الدلتا التراكمي (CVD)</p>
                  <p className="text-lg font-black font-mono" style={{ color: domColor }}>
                    {result.cumDelta > 0 ? '+' : ''}{fmtVol(result.cumDelta)}
                  </p>
                </div>
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                <p className="text-sm font-black text-white/80 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> الدليل الإرشادي (Order Flow)
                </p>
                <p className="text-sm text-white/60 leading-relaxed font-medium">
                  {verdict}
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
