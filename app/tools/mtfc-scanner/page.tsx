'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ScanSearch, AlertCircle } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TFResult {
  tf: string;
  tfLabel: string;
  ema20: number;
  ema50: number;
  rsi: number;
  trend: 'bullish' | 'bearish';
}

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function calcEMA(closes: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period: number): number {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period || 0.001;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES: { tf: string; label: string }[] = [
  { tf: '1h',  label: 'ساعة' },
  { tf: '4h',  label: '4 ساعات' },
  { tf: '1d',  label: 'يوم' },
  { tf: '1w',  label: 'أسبوع' },
];

function fmt(n: number): string {
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1)     return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MtfcScannerPage() {
  const [symbol, setSymbol]       = useState('BTCUSDT');
  const [results, setResults]     = useState<TFResult[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [alignment, setAlignment] = useState<number | null>(null);

  const tool = slugToTool('mtfc-scanner');
  if (!tool) return notFound();

  async function handleScan() {
    setLoading(true);
    setError(null);
    setResults([]);
    setAlignment(null);

    const gathered: TFResult[] = [];

    for (const { tf, label } of TIMEFRAMES) {
      try {
        const klines = await fetchKlines(symbol, tf, 100);
        const closes = klines.map(k => k.close);
        const ema20  = calcEMA(closes, 20);
        const ema50  = calcEMA(closes, 50);
        const rsi    = calcRSI(closes, 14);
        const trend  = ema20 > ema50 ? 'bullish' : 'bearish';
        gathered.push({ tf, tfLabel: label, ema20, ema50, rsi, trend });
      } catch {
        gathered.push({ tf, tfLabel: label, ema20: 0, ema50: 0, rsi: 50, trend: 'bearish' });
      }
    }

    const bullCount = gathered.filter(r => r.trend === 'bullish').length;
    setResults(gathered);
    setAlignment(bullCount);
    setLoading(false);
  }

  const bullCount = results.filter(r => r.trend === 'bullish').length;

  function getVerdict(count: number) {
    if (count === 4) return { dot: 'bg-emerald-400', text: 'توافق كامل — فرصة اتجاهية قوية جداً', color: 'emerald' };
    if (count === 3) return { dot: 'bg-green-400',   text: 'توافق عالي — ميل للاتجاه الغالب',      color: 'green'   };
    if (count === 2) return { dot: 'bg-yellow-400',  text: 'تعارض جزئي — انتظار واحتذر',           color: 'yellow'  };
    return           { dot: 'bg-red-500',            text: 'لا توافق — ابتعدِ عن السوق',            color: 'red'     };
  }

  const verdict = alignment !== null ? getVerdict(bullCount) : null;

  return (
    <div className="flex flex-col h-full bg-[#080810] overflow-y-auto pb-12" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Page Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-orange-400/80 tracking-widest uppercase border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Multi-Timeframe
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ماسح التوافق متعدد الأطر (MTFC)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          تحليل EMA20 / EMA50 / RSI عبر 4 أطر زمنية لرصد التوافق الاتجاهي الحقيقي
        </p>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* Controls */}
        <div className="flex flex-col gap-3">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          <button
            id="mtfc-scan-btn"
            onClick={handleScan}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-black text-base tracking-wider bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <ScanSearch className="w-5 h-5 animate-pulse" />
                جاري تحليل الأطر...
              </>
            ) : (
              <>
                <ScanSearch className="w-5 h-5" />
                تحليل الأطر الزمنية
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3 text-sm text-red-400 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              {/* Table */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d18] overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-5 bg-white/[0.03] border-b border-white/[0.06] px-4 py-3">
                  {['الإطار', 'EMA20', 'EMA50', 'RSI', 'الاتجاه'].map(h => (
                    <span key={h} className="text-[10px] font-black text-white/35 uppercase tracking-widest text-center">{h}</span>
                  ))}
                </div>

                {results.map((r, idx) => (
                  <motion.div
                    key={r.tf}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.07 }}
                    className={`grid grid-cols-5 px-4 py-4 items-center border-b border-white/[0.04] last:border-b-0 ${
                      r.trend === 'bullish' ? 'bg-emerald-500/[0.04]' : 'bg-red-500/[0.04]'
                    }`}
                  >
                    {/* Timeframe */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-white font-black text-sm">{r.tf.toUpperCase()}</span>
                      <span className="text-white/30 text-[9px] font-mono">{r.tfLabel}</span>
                    </div>

                    {/* EMA20 */}
                    <span className="text-center text-blue-300 font-mono text-[11px] font-bold">{fmt(r.ema20)}</span>

                    {/* EMA50 */}
                    <span className="text-center text-violet-300 font-mono text-[11px] font-bold">{fmt(r.ema50)}</span>

                    {/* RSI */}
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-mono text-xs font-black ${
                        r.rsi > 70 ? 'text-red-400' : r.rsi < 30 ? 'text-emerald-400' : 'text-white/70'
                      }`}>
                        {r.rsi.toFixed(1)}
                      </span>
                      <div className="w-10 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.rsi > 70 ? 'bg-red-500' : r.rsi < 30 ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${Math.min(r.rsi, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Trend */}
                    <div className="flex items-center justify-center">
                      {r.trend === 'bullish' ? (
                        <span className="text-emerald-400 font-black text-xs bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                          ↑ صاعد
                        </span>
                      ) : (
                        <span className="text-red-400 font-black text-xs bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-lg">
                          ↓ هابط
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Alignment counter */}
              <div className="rounded-xl border border-white/[0.07] bg-[#0d0d18] p-4 flex items-center justify-between">
                <span className="text-white/50 font-bold text-sm">أطر صاعدة</span>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {TIMEFRAMES.map(({ tf }) => {
                      const r = results.find(x => x.tf === tf);
                      return (
                        <div
                          key={tf}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border ${
                            r?.trend === 'bullish'
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-red-500/20 border-red-500/50 text-red-300'
                          }`}
                        >
                          {tf.toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                  <span className={`text-3xl font-black tabular-nums ${
                    bullCount >= 3 ? 'text-emerald-400' : bullCount === 2 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {bullCount}/4
                  </span>
                </div>
              </div>

              {/* Verdict Card */}
              {verdict && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 }}
                  className={`rounded-2xl border p-5 shadow-xl ${
                    verdict.color === 'emerald' || verdict.color === 'green'
                      ? 'bg-emerald-500/10 border-emerald-500/35 shadow-emerald-500/10'
                      : verdict.color === 'yellow'
                      ? 'bg-yellow-500/10 border-yellow-500/35 shadow-yellow-500/10'
                      : 'bg-red-500/10 border-red-500/35 shadow-red-500/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Colored dot */}
                    <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 shadow-lg ${verdict.dot}`} />
                    <div>
                      <p className="text-[10px] font-black text-white/35 uppercase tracking-widest mb-1">الحكم الإرشادي</p>
                      <p className={`text-base font-black leading-snug ${
                        verdict.color === 'emerald' || verdict.color === 'green'
                          ? 'text-emerald-300'
                          : verdict.color === 'yellow'
                          ? 'text-yellow-300'
                          : 'text-red-300'
                      }`}>
                        {verdict.text}
                      </p>
                      <p className="text-xs text-white/35 font-mono mt-1">
                        {bullCount} من 4 أطر زمنية تشير للاتجاه الصاعد
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!loading && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <ScanSearch className="w-7 h-7 text-orange-500/60" />
            </div>
            <p className="text-white/30 text-sm font-bold max-w-xs leading-relaxed">
              اختر الرمز واضغط &quot;تحليل الأطر الزمنية&quot; لرؤية بيانات حقيقية من Binance
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
