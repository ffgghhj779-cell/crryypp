'use client';

import { useState, useCallback, useMemo } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Search, ScanSearch, AlertCircle, ArrowDown, ArrowUp, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { ToolChart, ChartMarker } from '@/components/tools/ToolChart';

interface Fractal {
  time: number;
  type: 'bullish' | 'bearish';
  price: number;
}

interface FractalResult {
  lastFractal: Fractal | null;
  allFractals: Fractal[];
  currentStructure: 'bullish' | 'bearish' | 'neutral';
  currentPrice: number;
  distancePct: number;
  klines: Kline[];
}

function detectFractals(klines: Kline[]): FractalResult {
  const fractals: Fractal[] = [];
  
  // Standard Williams Fractal: 5 candles where middle is highest high or lowest low
  for (let i = 2; i < klines.length - 2; i++) {
    const c = klines[i];
    const l1 = klines[i - 1]; 
    const l2 = klines[i - 2];
    const r1 = klines[i + 1]; 
    const r2 = klines[i + 2];
    
    const isBearish = c.high > l1.high && c.high > l2.high && c.high > r1.high && c.high > r2.high;
    const isBullish = c.low < l1.low && c.low < l2.low && c.low < r1.low && c.low < r2.low;
    
    if (isBearish) fractals.push({ time: c.time * 1000, type: 'bearish', price: c.high });
    else if (isBullish) fractals.push({ time: c.time * 1000, type: 'bullish', price: c.low });
  }

  const last = fractals[fractals.length - 1] ?? null;
  const cp = klines[klines.length - 1].close;
  const dist = last ? +Math.abs((cp - last.price) / last.price * 100).toFixed(2) : 0;
  
  // If the last fractal is bullish (bottom), the structure is currently bullish (bouncing up)
  // If the last fractal is bearish (top), the structure is currently bearish (bouncing down)
  const struct = last ? last.type : 'neutral';
  
  return { lastFractal: last, allFractals: fractals, currentStructure: struct, currentPrice: cp, distancePct: dist, klines };
}

const fmtPrice = (p: number) =>
  p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default function FractalDetectorPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FractalResult | null>(null);

  
  const handleScan = useCallback(async () => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 150);
      if (klines.length < 5) throw new Error('بيانات غير كافية لحساب الفراكتل');
      const res = detectFractals(klines);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  const verdictText = !result ? '' :
    result.currentStructure === 'bullish'
      ? `تم رصد قاع انعكاسي (Bullish Fractal) عند ${fmtPrice(result.lastFractal!.price)} يبعد بنسبة ${result.distancePct}% عن السعر الحالي. هذا النمط يدعم الصعود وتعتبر النقطة دعماً رئيسياً.`
      : result.currentStructure === 'bearish'
      ? `تم رصد قمة انعكاسية (Bearish Fractal) عند ${fmtPrice(result.lastFractal!.price)} تبعد بنسبة ${result.distancePct}% عن السعر الحالي. هذا النمط يشير إلى ضغط بيعي وتعتبر النقطة مقاومة رئيسية.`
      : 'لا يوجد فراكتل مؤكد مؤخراً. الاتجاه الحالي مستمر دون أي قمم أو قيعان مؤكدة بخمس شموع.';

  const chartMarkers = useMemo(() => {
    if (!result) return [];
    
    return result.allFractals.map((f): ChartMarker => ({
      time: f.time,
      position: f.type === 'bearish' ? 'aboveBar' : 'belowBar',
      shape: f.type === 'bearish' ? 'arrowDown' : 'arrowUp',
      color: f.type === 'bearish' ? '#ef4444' : '#10b981',
      text: f.type === 'bearish' ? '▼' : '▲',
      size: 1
    }));
  }, [result]);

  const tool = slugToTool('fractal-detector');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-fuchsia-400/70 tracking-widest uppercase border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Search className="w-3 h-3" /> Patterns & Structure
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">كاشف فراكتل ويليامز (Fractals)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          Williams 5-Candle Reversal Pattern Scanner
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Input */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <SymbolDropdown value={symbol} onChange={setSymbol} />
            </div>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-fuchsia-500/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
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
              background: loading ? '#1a1a1a' : 'linear-gradient(135deg, #d946ef, #a21caf)',
              boxShadow: !loading ? '0 0 20px rgba(217,70,239,0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الفحص...' : 'فحص القمم والقيعان (Fractals)'}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-5">

              {/* Status Banner */}
              <div className="rounded-2xl border p-5 flex items-center justify-between" 
                style={{ 
                  borderColor: result.currentStructure === 'bullish' ? '#10b98140' : result.currentStructure === 'bearish' ? '#ef444440' : '#6b728040',
                  background: result.currentStructure === 'bullish' ? '#10b98110' : result.currentStructure === 'bearish' ? '#ef444410' : '#6b728010' 
                }}>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold uppercase tracking-widest" 
                     style={{ color: result.currentStructure === 'bullish' ? '#10b981' : result.currentStructure === 'bearish' ? '#ef4444' : '#6b7280' }}>
                    آخر هيكل مؤكد (Last Structure)
                  </p>
                  <p className="text-2xl font-black text-white flex items-center gap-2">
                    {result.currentStructure === 'bullish' ? 'قاع شرائي (Bullish)' : result.currentStructure === 'bearish' ? 'قمة بيعية (Bearish)' : 'محايد'}
                  </p>
                </div>
                {result.currentStructure === 'bullish' && <ArrowUp className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                {result.currentStructure === 'bearish' && <ArrowDown className="w-10 h-10 text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />}
              </div>

              {/* Tool Chart */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-fuchsia-500/20 shadow-lg shadow-fuchsia-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-fuchsia-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> أماكن تمركز الفراكتل (Fractal Pivots)
                  </p>
                  <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-1 rounded">150 Candles</span>
                </div>
                <ToolChart 
                  klines={result.klines}
                  markers={chartMarkers}
                  height={320}
                />
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 bottom-0 w-1 bg-fuchsia-500" />
                <p className="text-sm font-black text-fuchsia-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Search className="w-4 h-4" /> الدليل الإرشادي
                </p>
                <p className="text-sm text-white/80 leading-relaxed font-medium">
                  {verdictText}
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
