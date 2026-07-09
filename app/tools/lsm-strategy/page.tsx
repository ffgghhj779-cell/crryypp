'use client';

import { useState, useCallback, useMemo } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { TrendingUp, TrendingDown, RefreshCcw, Rocket, Activity, ScanSearch, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToolChart, OverlaySeries } from '@/components/tools/ToolChart';

interface LSMAPoint {
  time: number;
  close: number;
  lsma: number;
  aboveLsma: boolean;
}

/**
 * Calculate Least Squares Moving Average (LSMA / Linear Regression Line)
 * for a given window of closing prices ending at index `end`.
 */
function calcLSMA(closes: number[], end: number, period: number): number {
  if (end < period - 1) return closes[end];
  const slice = closes.slice(end - period + 1, end + 1);
  const n     = slice.length;

  // Linear regression y = a + b*x, b = slope, a = intercept
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += slice[i];
    sumXY += i * slice[i];
    sumX2 += i * i;
  }
  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // LSMA = value at the last point of the regression line
  return intercept + slope * (n - 1);
}

export default function LsmStrategyPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [klines, setKlines] = useState<Kline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PERIOD = 20;

  const load = useCallback(async (sym: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchKlines(sym.toUpperCase().trim(), timeframe, 150);
      if (data.length < PERIOD) throw new Error('بيانات غير كافية لحساب LSMA.');
      setKlines(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطأ في جلب البيانات');
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  // Build LSMA series
  const lsmaData: LSMAPoint[] = useMemo(() => {
    if (klines.length < PERIOD) return [];
    const closes = klines.map(k => k.close);
    return klines.map((k, i) => {
      const lsma = i >= PERIOD - 1 ? calcLSMA(closes, i, PERIOD) : NaN;
      return { time: k.time, close: k.close, lsma, aboveLsma: k.close >= lsma };
    });
  }, [klines]);

  const validLsmaData = useMemo(() => lsmaData.filter(d => !isNaN(d.lsma)), [lsmaData]);
  const currentPrice = klines.length > 0 ? klines[klines.length - 1].close : 0;
  const currentLSMA  = validLsmaData.length > 0 ? validLsmaData[validLsmaData.length - 1].lsma : 0;
  const isBullish    = currentPrice >= currentLSMA;

  // Slope: compare last 2 LSMA values
  const lsmaSlope = validLsmaData.length >= 2
    ? validLsmaData[validLsmaData.length - 1].lsma - validLsmaData[validLsmaData.length - 2].lsma
    : 0;

  const deviation = currentLSMA > 0 ? ((currentPrice - currentLSMA) / currentLSMA * 100) : 0;

  const formatPrice = (p: number) =>
    p.toLocaleString('en-US', {
      minimumFractionDigits: p > 100 ? 2 : 4,
      maximumFractionDigits: p > 100 ? 2 : 4,
    });

  // Verdict
  const verdictText = () => {
    if (!currentLSMA) return 'لا توجد بيانات كافية';
    if (isBullish && lsmaSlope > 0) {
      return `السعر فوق خط LSMA بفارق ${deviation.toFixed(2)}% والمؤشر صاعد (Trend UP) — إشارة صعودية قوية جداً. ابحث عن فرص شراء عند الارتداد من خط LSMA.`;
    } else if (isBullish && lsmaSlope <= 0) {
      return `السعر فوق خط LSMA لكن المؤشر يميل للهبوط أو الثبات — حذر من ضعف الزخم الشرائي واحتمالية كسر الدعم.`;
    } else if (!isBullish && lsmaSlope < 0) {
      return `السعر تحت خط LSMA بفارق ${Math.abs(deviation).toFixed(2)}% والمؤشر هابط (Trend DOWN) — إشارة هبوطية قوية. تجنّب الشراء، المقاومة المتحركة تقترب من السعر.`;
    } else {
      return `السعر تحت خط LSMA لكن المؤشر يميل للصعود أو الثبات — احتمال تعافي قريب. انتظر اختراق وإغلاق فوق LSMA ${formatPrice(currentLSMA)} للتأكيد.`;
    }
  };

  const chartOverlays: OverlaySeries[] = useMemo(() => {
    if (validLsmaData.length === 0) return [];
    return [{
      type: 'line',
      title: `LSMA (${PERIOD})`,
      color: '#eab308', // yellow-500
      lineWidth: 2,
      data: validLsmaData.map(d => ({
        time: d.time,
        value: d.lsma
      }))
    }];
  }, [validLsmaData]);

  
  const tool = slugToTool('lsm-strategy');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Rocket className="w-3 h-3" /> LSMA Engine
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">استراتيجية المربعات الصغرى (LSMA)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          Least Squares Moving Average للتعرف على الاتجاه الحقيقي
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
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-yellow-500/50"
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
            onClick={() => load(symbol)}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: isLoading ? '#1a1a1a' : 'linear-gradient(135deg,#eab308,#a16207)', boxShadow: !isLoading ? '0 0 20px rgba(234,179,8,0.25)' : 'none' }}
          >
            {isLoading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {isLoading ? 'جاري التحليل...' : 'تشغيل محرك LSMA'}
          </button>
        </div>

        {/* Results */}
        {validLsmaData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 mt-2">
            
            {/* Status Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border p-4 flex flex-col gap-1" style={{ borderColor: isBullish ? '#10b98140' : '#ef444440', background: isBullish ? '#10b98110' : '#ef444410' }}>
                <p className="text-xs font-black uppercase tracking-widest text-white/50">اتجاه LSMA</p>
                <p className="text-xl font-black font-mono flex items-center gap-2" style={{ color: isBullish ? '#10b981' : '#ef4444' }}>
                  {isBullish ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  {isBullish ? 'صاعد' : 'هابط'}
                </p>
              </div>
              
              <div className="rounded-2xl border p-4 flex flex-col gap-1 border-yellow-500/30 bg-yellow-500/10">
                <p className="text-xs font-black uppercase tracking-widest text-yellow-500/70">قيمة LSMA الحالية</p>
                <p className="text-xl font-black font-mono text-yellow-500">{formatPrice(currentLSMA)}</p>
              </div>
            </div>

            {/* Tool Chart */}
            <div className="rounded-2xl bg-[#050505] p-4 border border-yellow-500/20 shadow-lg shadow-yellow-500/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4" /> انحدار المربعات الصغرى (LSMA)
                </p>
                <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-1 rounded">Period: {PERIOD}</span>
              </div>
              <ToolChart 
                klines={klines}
                overlays={chartOverlays}
                height={320}
              />
            </div>

            {/* Verdict */}
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-yellow-500" />
              <p className="text-sm font-black text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Rocket className="w-4 h-4" /> الدليل الإرشادي التكتيكي
              </p>
              <p className="text-sm text-white/80 leading-relaxed font-medium">
                {verdictText()}
              </p>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
