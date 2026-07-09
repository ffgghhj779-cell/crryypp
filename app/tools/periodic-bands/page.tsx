'use client';

import { useState, useCallback, useMemo } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Waves, RefreshCcw, TrendingUp, TrendingDown, ScanSearch, AlertCircle, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { ToolChart, OverlaySeries } from '@/components/tools/ToolChart';
import { calculateEMA } from '@/lib/algorithms/mathUtils';

function calcTRList(klines: Kline[]): number[] {
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high, l = klines[i].low, pc = klines[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs;
}

function calcATR(klines: Kline[], period: number): number[] {
  const trs = calcTRList(klines);
  const out: number[] = new Array(klines.length).fill(NaN);
  if (trs.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += trs[i];
  out[period] = sum / period;
  for (let i = period + 1; i < trs.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + trs[i - 1]) / period;
  }
  return out;
}

export default function PeriodicBandsPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const data = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 150);
      if (data.length < 20) throw new Error('بيانات غير كافية لحساب النطاقات.');
      setKlines(data);
    } catch (e: any) {
      setError(e.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  const bands = useMemo(() => {
    if (klines.length === 0) return null;
    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);

    const PERIOD = 20;

    // Donchian Channels (20)
    const donchianUpper = new Array(klines.length).fill(NaN);
    const donchianLower = new Array(klines.length).fill(NaN);
    for (let i = PERIOD - 1; i < klines.length; i++) {
      donchianUpper[i] = Math.max(...highs.slice(i - PERIOD + 1, i + 1));
      donchianLower[i] = Math.min(...lows.slice(i - PERIOD + 1, i + 1));
    }

    // Keltner Channels (EMA 20, ATR 10, Mult 1.5)
    const KC_PERIOD = 20;
    const ATR_PERIOD = 10;
    const KC_MULT = 1.5;
    const emaArr = calculateEMA(closes, KC_PERIOD);
    const atrArr = calcATR(klines, ATR_PERIOD);
    const keltnerUpper = new Array(klines.length).fill(NaN);
    const keltnerLower = new Array(klines.length).fill(NaN);

    for (let i = 0; i < klines.length; i++) {
      if (!isNaN(emaArr[i]) && !isNaN(atrArr[i])) {
        keltnerUpper[i] = emaArr[i] + KC_MULT * atrArr[i];
        keltnerLower[i] = emaArr[i] - KC_MULT * atrArr[i];
      }
    }

    const lastIdx = klines.length - 1;
    const currentPrice = closes[lastIdx];

    return {
      donchianUpper, donchianLower,
      keltnerUpper, keltnerLower, emaArr,
      currentPrice,
      currentDcU: donchianUpper[lastIdx],
      currentDcL: donchianLower[lastIdx],
      currentKcU: keltnerUpper[lastIdx],
      currentKcL: keltnerLower[lastIdx],
    };
  }, [klines]);

  const chartOverlays: OverlaySeries[] = useMemo(() => {
    if (!bands || klines.length === 0) return [];
    const timeMapped = klines.map(k => k.time);
    const overlays: OverlaySeries[] = [];

    // Donchian
    overlays.push({ type: 'line', title: 'Donchian Top', color: '#60a5fa', lineWidth: 1, data: bands.donchianUpper.map((v, i) => ({ time: timeMapped[i], value: v })) });
    overlays.push({ type: 'line', title: 'Donchian Bot', color: '#60a5fa', lineWidth: 1, data: bands.donchianLower.map((v, i) => ({ time: timeMapped[i], value: v })) });

    // Keltner
    overlays.push({ type: 'line', title: 'Keltner Top', color: '#c084fc', lineWidth: 1, data: bands.keltnerUpper.map((v, i) => ({ time: timeMapped[i], value: v })) });
    overlays.push({ type: 'line', title: 'Keltner Bot', color: '#c084fc', lineWidth: 1, data: bands.keltnerLower.map((v, i) => ({ time: timeMapped[i], value: v })) });
    overlays.push({ type: 'line', title: 'EMA (20)', color: '#a78bfa', lineWidth: 2, data: bands.emaArr.map((v, i) => ({ time: timeMapped[i], value: v })) });

    return overlays;
  }, [bands, klines]);

  const formatPrice = (p: number) => p ? p.toLocaleString('en-US', { minimumFractionDigits: p > 100 ? 2 : 4, maximumFractionDigits: p > 100 ? 2 : 4 }) : '0.00';

  const tool = slugToTool('periodic-bands');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Waves className="w-3 h-3" /> Periodic Bands
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">حاسبة النطاقات الدورية (Bands)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          قنوات Donchian و Keltner معاً لقياس التقلبات والحدود السعرية
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {/* Input */}
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
              <option value="1d">1D</option>
            </select>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#f97316,#c2410c)', boxShadow: !loading ? '0 0 20px rgba(249,115,22,0.25)' : 'none' }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحليل...' : 'تشغيل محلل النطاقات'}
          </button>
        </div>

        {/* Results */}
        {bands && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
            
            {/* Chart */}
            <div className="rounded-2xl bg-[#050505] p-4 border border-orange-500/20 shadow-lg shadow-orange-500/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Keltner & Donchian Channels
                </p>
                <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-1 rounded">20-Period</span>
              </div>
              <ToolChart klines={klines} overlays={chartOverlays} height={320} />
            </div>

            {/* Target Boxes */}
            <div className="grid grid-cols-2 gap-4">
              {/* Donchian */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Donchian Channel</p>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Upper (Breakout)</span>
                    <span className="font-mono font-bold text-blue-300">{formatPrice(bands.currentDcU)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Lower (Breakdown)</span>
                    <span className="font-mono font-bold text-blue-300">{formatPrice(bands.currentDcL)}</span>
                  </div>
                </div>
              </div>

              {/* Keltner */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">Keltner Channel</p>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Upper (Overbought)</span>
                    <span className="font-mono font-bold text-purple-300">{formatPrice(bands.currentKcU)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Lower (Oversold)</span>
                    <span className="font-mono font-bold text-purple-300">{formatPrice(bands.currentKcL)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 text-center">
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                تُستخدم قنوات <span className="text-blue-400">Donchian</span> لاكتشاف الاختراقات السعرية العنيفة للقمم أو القيعان، 
                بينما تُستخدم قنوات <span className="text-purple-400">Keltner</span> لتحديد مناطق التشبع الشرائي والبيعي المتوقعة للعودة إلى المتوسط (EMA).
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
