'use client';

import { useState, useCallback, useMemo } from 'react';

import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { TrendingUp, TrendingDown, RefreshCcw, Rocket, Activity, ScanSearch } from 'lucide-react';

import { motion } from 'motion/react';

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
  const [klines, setKlines] = useState<Kline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sym: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchKlines(sym, '1d', 50);
      setKlines(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطأ في جلب البيانات');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const PERIOD = 20;

  // Build LSMA series
  const lsmaData: LSMAPoint[] = useMemo(() => {
    if (klines.length < PERIOD) return [];
    const closes = klines.map(k => k.close);
    return klines.map((k, i) => {
      const lsma = calcLSMA(closes, i, PERIOD);
      return { time: k.time, close: k.close, lsma, aboveLsma: k.close >= lsma };
    }).slice(PERIOD - 1); // only show full-period bars
  }, [klines]);

  const currentPrice = klines.length > 0 ? klines[klines.length - 1].close : 0;
  const currentLSMA  = lsmaData.length > 0 ? lsmaData[lsmaData.length - 1].lsma : 0;
  const isBullish    = currentPrice >= currentLSMA;

  // Slope: compare last 2 LSMA values
  const lsmaSlope = lsmaData.length >= 2
    ? lsmaData[lsmaData.length - 1].lsma - lsmaData[lsmaData.length - 2].lsma
    : 0;

  const deviation = currentLSMA > 0 ? ((currentPrice - currentLSMA) / currentLSMA * 100) : 0;

  const formatPrice = (p: number) =>
    p.toLocaleString(undefined, {
      minimumFractionDigits: p > 1000 ? 1 : 4,
      maximumFractionDigits: p > 1000 ? 1 : 4,
    });

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  // Verdict
  const verdictText = () => {
    if (!currentLSMA) return 'لا توجد بيانات كافية';
    if (isBullish && lsmaSlope > 0) {
      return `السعر فوق LSMA-${PERIOD} بفارق ${deviation.toFixed(2)}% والمنحدر صاعد — إشارة صعودية قوية. ابحث عن فرص شراء عند التراجع لـ LSMA.`;
    } else if (isBullish && lsmaSlope <= 0) {
      return `السعر فوق LSMA-${PERIOD} لكن المنحدر يتراجع — حذر من ضعف الزخم. انتظر تأكيداً.`;
    } else if (!isBullish && lsmaSlope < 0) {
      return `السعر تحت LSMA-${PERIOD} بفارق ${Math.abs(deviation).toFixed(2)}% والمنحدر هابط — إشارة هبوطية قوية. تجنّب الشراء.`;
    } else {
      return `السعر تحت LSMA-${PERIOD} لكن المنحدر يعتدل — احتمال تعافٍ. انتظر تجاوز LSMA ${formatPrice(currentLSMA)}.`;
    }
  };

  // Price chart range for mini visualization
  const chartData = lsmaData.slice(-20);
  const allPrices = chartData.flatMap(d => [d.close, d.lsma]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const rangeP = maxP - minP || 1;
  const pct = (v: number) => ((v - minP) / rangeP * 100).toFixed(1);

  const tool = slugToTool('lsm-strategy');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-yellow-500/70 tracking-widest uppercase border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Rocket className="w-3 h-3" /> LSM Strategy
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">استراتيجية LSMA (Least Squares)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          50 شمعة يومية — LSMA-{PERIOD} بالانحدار الخطي الحقيقي
        </p>
      </div>

      {/* Symbol Selector + Scan Button */}
      <div className="px-5 mb-4 flex flex-col gap-3">
        <SymbolDropdown value={symbol} onChange={setSymbol} />
        <button
          onClick={() => load(symbol)}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
          style={{ background: isLoading ? '#1a1a1a' : 'linear-gradient(135deg,#eab308,#a16207)', boxShadow: !isLoading ? '0 0 20px rgba(234,179,8,0.25)' : 'none' }}
        >
          {isLoading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
          {isLoading ? 'جاري الحساب...' : 'تحليل LSMA (50 شمعة)'}
        </button>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-yellow-500 animate-spin" />
            <p className="text-yellow-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري حساب LSMA...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-400 font-bold">{error}</div>
        ) : lsmaData.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/40 font-bold">بيانات غير كافية (يلزم {PERIOD}+ شمعة)</div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-5"
          >
            {/* Signal Banner */}
            <div className={`rounded-2xl border p-6 flex flex-col items-center gap-3 shadow-2xl ${isBullish
              ? 'border-emerald-500/40 bg-emerald-500/10 shadow-emerald-500/10'
              : 'border-red-500/40 bg-red-500/10 shadow-red-500/10'}`}
            >
              <div className={`p-4 rounded-full ${isBullish ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {isBullish
                  ? <TrendingUp className="w-10 h-10 text-emerald-400" />
                  : <TrendingDown className="w-10 h-10 text-red-400" />}
              </div>
              <h2 className={`text-2xl font-black ${isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                {isBullish ? 'إشارة صعودية' : 'إشارة هبوطية'}
              </h2>
              <p className="text-sm text-white/50 font-bold">
                السعر {isBullish ? 'فوق' : 'تحت'} LSMA-{PERIOD}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4 text-center">
                <p className="text-xs text-white/40 mb-1">السعر الحالي</p>
                <p className="text-lg font-black font-mono text-white">{formatPrice(currentPrice)}</p>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
                <p className="text-xs text-white/40 mb-1">LSMA-{PERIOD}</p>
                <p className="text-lg font-black font-mono text-yellow-400">{formatPrice(currentLSMA)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4 text-center">
                <p className="text-xs text-white/40 mb-1">الانحراف عن LSMA</p>
                <p className={`text-lg font-black font-mono ${deviation >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}%
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4 text-center">
                <p className="text-xs text-white/40 mb-1">اتجاه المنحدر</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {lsmaSlope > 0
                    ? <><TrendingUp className="w-5 h-5 text-emerald-400" /><span className="text-emerald-400 font-black text-sm">صاعد</span></>
                    : lsmaSlope < 0
                      ? <><TrendingDown className="w-5 h-5 text-red-400" /><span className="text-red-400 font-black text-sm">هابط</span></>
                      : <span className="text-white/40 font-bold text-sm">محايد</span>
                  }
                </div>
              </div>
            </div>

            {/* Price vs LSMA Chart (bar-style visualization) */}
            <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/[0.05]">
                <Activity className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-black text-white/60 uppercase tracking-widest">السعر vs LSMA-{PERIOD} (آخر 20 يوم)</span>
              </div>

              {/* Mini visualization */}
              <div className="flex items-end gap-[3px] h-28 relative">
                {chartData.map((d, i) => {
                  const closeH  = parseFloat(pct(d.close));
                  const lsmaH   = parseFloat(pct(d.lsma));
                  const above   = d.aboveLsma;

return (
                    <div key={i} className="flex-1 relative h-full flex flex-col justify-end">
                      {/* LSMA dot */}
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-yellow-400/60 rounded-full"
                        style={{ bottom: `${lsmaH}%` }}
                      />
                      {/* Price bar */}
                      <div
                        className={`w-full rounded-sm ${above ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
                        style={{ height: `${Math.max(closeH, 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Date range labels */}
              <div className="flex justify-between text-xs text-white/20 font-mono mt-1">
                <span>{chartData.length > 0 ? formatDate(chartData[0].time) : ''}</span>
                <span className="text-yellow-400/60">─── LSMA</span>
                <span>{chartData.length > 0 ? formatDate(chartData[chartData.length - 1].time) : ''}</span>
              </div>
            </div>

            {/* Verdict Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 shadow-xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="w-5 h-5 text-yellow-400" />
                <span className="text-sm font-black text-yellow-400 uppercase tracking-widest">دليل إرشادي</span>
              </div>
              <p className="text-base font-bold text-white/80 leading-relaxed">{verdictText()}</p>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
