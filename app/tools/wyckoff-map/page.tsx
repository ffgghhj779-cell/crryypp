'use client';

import { useState, useMemo } from 'react';
import { fetchKlines } from '@/lib/binance/fetcher';
import { analyzeWyckoff, WyckoffResult } from '@/lib/algorithms/wyckoff';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { slugToTool } from '@/lib/tools/registry';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { ToolChart, ChartMarker, HorizontalLine } from '@/components/tools/ToolChart';
import { notFound } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Activity,
  BarChart2,
  Zap,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

// ─── Phase metadata ────────────────────────────────────────────────────────────
const PHASE_META = [
  {
    key: 'ACC',
    label: 'تجميع',
    labelEn: 'Accumulation',
    icon: ArrowRightLeft,
    color: '#60a5fa',
    glow: 'rgba(96,165,250,0.35)',
    bg: 'rgba(96,165,250,0.12)',
    border: 'rgba(96,165,250,0.4)',
  },
  {
    key: 'MRK',
    label: 'صعود',
    labelEn: 'Markup',
    icon: TrendingUp,
    color: '#34d399',
    glow: 'rgba(52,211,153,0.35)',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.4)',
  },
  {
    key: 'DST',
    label: 'توزيع',
    labelEn: 'Distribution',
    icon: ArrowRightLeft,
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.35)',
    bg: 'rgba(251,146,60,0.12)',
    border: 'rgba(251,146,60,0.4)',
  },
  {
    key: 'MDN',
    label: 'هبوط',
    labelEn: 'Markdown',
    icon: TrendingDown,
    color: '#f87171',
    glow: 'rgba(248,113,113,0.35)',
    bg: 'rgba(248,113,113,0.12)',
    border: 'rgba(248,113,113,0.4)',
  },
];

// ─── Verdict color helper ──────────────────────────────────────────────────────
function verdictColor(score: number): string {
  if (score > 0) return '#34d399';
  if (score < 0) return '#f87171';
  return '#94a3b8';
}

export default function WyckoffMapPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [result, setResult] = useState<WyckoffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const klines = await fetchKlines(symbol, '1d', 150);
      const res = analyzeWyckoff(klines);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }

  const activePhaseIdx = result
    ? PHASE_META.findIndex((p) => p.key === result.phase)
    : -1;

  const activeMeta = activePhaseIdx >= 0 ? PHASE_META[activePhaseIdx] : null;

  const chartProps = useMemo(() => {
    if (!result || !result.klines || result.klines.length === 0) return { markers: [], priceLines: [] };
    
    // Calculate Volume Anomaly Markers
    const markers: ChartMarker[] = [];
    const vols = result.klines.map(k => k.volume);
    const avgVol = vols.reduce((a,b) => a+b, 0) / vols.length;
    
    result.klines.forEach(k => {
      if (k.volume > avgVol * 2.5) {
        markers.push({
          time: k.time,
          position: k.close > k.open ? 'belowBar' : 'aboveBar',
          shape: 'circle',
          color: k.close > k.open ? '#34d399' : '#f87171',
          text: 'Vol anomaly',
          size: 1
        });
      }
    });

    // Calculate Trading Range
    const highs = result.klines.map(k => k.high);
    const lows = result.klines.map(k => k.low);
    const rangeHigh = Math.max(...highs);
    const rangeLow = Math.min(...lows);

    const priceLines: HorizontalLine[] = [
      { price: rangeHigh, color: '#f87171', title: 'Resistance (AR)', lineWidth: 2, lineStyle: 0 },
      { price: rangeLow, color: '#34d399', title: 'Support (SC)', lineWidth: 2, lineStyle: 0 }
    ];

    return { markers, priceLines };
  }, [result]);

  const tool = slugToTool('wyckoff-map');
  if (!tool) return notFound();
  return (
    <div
      className="flex flex-col h-full overflow-y-auto pb-14"
      dir="rtl"
      style={{ background: '#080b10' }}
    >
      <ToolPageHeader tool={tool} />

      {/* ── Symbol picker + Analyze button ── */}
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
        <SymbolDropdown value={symbol} onChange={setSymbol} />

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-black text-base tracking-wide flex items-center justify-center gap-2.5 transition-all active:scale-95"
          style={{
            background: loading
              ? 'rgba(234,179,8,0.15)'
              : 'linear-gradient(135deg,#f59e0b,#d97706)',
            color: loading ? '#f59e0b' : '#000',
            border: '1px solid rgba(234,179,8,0.3)',
            boxShadow: loading ? 'none' : '0 4px 24px rgba(234,179,8,0.3)',
          }}
        >
          {loading ? (
            <>
              <RefreshCcw className="w-4 h-4 animate-spin" />
              جاري التحليل…
            </>
          ) : (
            <>
              <Activity className="w-4 h-4" />
              تحليل وايكوف (150 شمعة يومية)
            </>
          )}
        </button>
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mb-3 flex items-start gap-3 rounded-xl p-4"
            style={{
              background: 'rgba(248,113,113,0.10)',
              border: '1px solid rgba(248,113,113,0.3)',
            }}
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 font-bold leading-relaxed">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ── */}
      <AnimatePresence>
        {result && activeMeta && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="px-4 flex flex-col gap-4"
          >
            {/* ── 1. Main phase card ── */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{
                background: activeMeta.bg,
                border: `1px solid ${activeMeta.border}`,
                boxShadow: `0 0 40px ${activeMeta.glow}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center"
                    style={{ background: `${activeMeta.color}22` }}
                  >
                    <activeMeta.icon
                      className="w-5 h-5"
                      style={{ color: activeMeta.color }}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-white/40 font-mono uppercase tracking-widest">
                      المرحلة الحالية
                    </p>
                    <p className="text-lg font-black" style={{ color: activeMeta.color }}>
                      {result.phaseAr}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p
                    className="text-3xl font-black"
                    style={{ color: activeMeta.color }}
                  >
                    {result.confidence}%
                  </p>
                  <p className="text-xs text-white/40 font-mono">ثقة</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex flex-col gap-1.5">
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 8, background: 'rgba(255,255,255,0.07)' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${activeMeta.color}88, ${activeMeta.color})`,
                      boxShadow: `0 0 10px ${activeMeta.glow}`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-white/30 font-mono">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* ── 2. Wyckoff Cycle Visual (4 phases horizontal) ── */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4 text-center">
                دورة وايكوف الكاملة
              </p>
              <div className="relative flex items-center justify-between">
                {/* Connector line */}
                <div
                  className="absolute left-0 right-0 top-[22px]"
                  style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}
                />

                {PHASE_META.map((ph, idx) => {
                  const isActive = idx === activePhaseIdx;
                  const isPast = idx < activePhaseIdx;
                  const Icon = ph.icon;


  return (
                    <div
                      key={ph.key}
                      className="relative z-10 flex flex-col items-center gap-2"
                    >
                      {/* Node */}
                      <motion.div
                        animate={
                          isActive
                            ? { scale: [1, 1.12, 1], boxShadow: [`0 0 0px ${ph.glow}`, `0 0 22px ${ph.glow}`, `0 0 0px ${ph.glow}`] }
                            : {}
                        }
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-11 h-11 rounded-full flex items-center justify-center"
                        style={{
                          background: isActive
                            ? ph.bg
                            : isPast
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(255,255,255,0.03)',
                          border: isActive
                            ? `2px solid ${ph.border}`
                            : isPast
                            ? '2px solid rgba(255,255,255,0.15)'
                            : '2px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <Icon
                          className="w-5 h-5"
                          style={{
                            color: isActive
                              ? ph.color
                              : isPast
                              ? 'rgba(255,255,255,0.4)'
                              : 'rgba(255,255,255,0.15)',
                          }}
                        />
                      </motion.div>

                      {/* Label */}
                      <span
                        className="text-xs font-black"
                        style={{
                          color: isActive
                            ? ph.color
                            : isPast
                            ? 'rgba(255,255,255,0.35)'
                            : 'rgba(255,255,255,0.2)',
                        }}
                      >
                        {ph.label}
                      </span>

                      {/* Active indicator */}
                      {isActive && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: ph.color, color: '#000' }}
                        >
                          الآن
                        </motion.span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 2.5 ToolChart Visualizer ── */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: '#050505',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-bold text-white/70 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" /> خريطة السعر وحجم التداول (150 شمعة)
                </p>
              </div>
              <ToolChart 
                klines={result.klines}
                markers={chartProps.markers}
                priceLines={chartProps.priceLines}
                height={350}
              />
            </div>

            {/* ── 3. Analysis table ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-black text-white/80 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-yellow-400" />
                  تفاصيل التحليل
                </p>
              </div>

              {/* Row 1 — Volume Effort */}
              <div
                className="px-5 py-4 border-b flex flex-col gap-2"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-white/70">جهد الحجم</p>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${verdictColor(result.effort.score)}22`,
                      color: verdictColor(result.effort.score),
                    }}
                  >
                    نسبة {result.effort.ratio}
                  </span>
                </div>
                {/* Buy/Sell bar */}
                <div
                  className="w-full rounded-full overflow-hidden flex"
                  style={{ height: 6 }}
                >
                  <div
                    className="rounded-l-full transition-all"
                    style={{
                      width: `${result.effort.buyPct}%`,
                      background: '#34d399',
                    }}
                  />
                  <div
                    className="rounded-r-full transition-all"
                    style={{
                      width: `${result.effort.sellPct}%`,
                      background: '#f87171',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-white/40">
                  <span className="text-emerald-400">شراء {result.effort.buyPct}%</span>
                  <span className="text-red-400">بيع {result.effort.sellPct}%</span>
                </div>
                <p
                  className="text-xs font-bold leading-relaxed mt-0.5"
                  style={{ color: verdictColor(result.effort.score) }}
                >
                  {result.effort.verdict}
                </p>
              </div>

              {/* Row 2 — Price Structure */}
              <div
                className="px-5 py-4 border-b flex flex-col gap-1.5"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-white/70">بنية السعر</p>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${verdictColor(result.structure.score)}22`,
                      color: verdictColor(result.structure.score),
                    }}
                  >
                    {result.structure.trend}
                  </span>
                </div>
                <div className="flex gap-4 text-xs font-mono text-white/50">
                  <span>
                    قمم عالية:{' '}
                    <span className={result.structure.higherHighs ? 'text-emerald-400' : 'text-red-400'}>
                      {result.structure.higherHighs ? '✓' : '✗'}
                    </span>
                  </span>
                  <span>
                    قيعان عالية:{' '}
                    <span className={result.structure.higherLows ? 'text-emerald-400' : 'text-red-400'}>
                      {result.structure.higherLows ? '✓' : '✗'}
                    </span>
                  </span>
                  <span>عرض النطاق: {result.structure.rangeWidthPct}%</span>
                </div>
              </div>

              {/* Row 3 — Volatility */}
              <div
                className="px-5 py-4 border-b flex flex-col gap-1.5"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-white/70">التقلب (ATR)</p>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${verdictColor(result.volatility.score)}22`,
                      color: verdictColor(result.volatility.score),
                    }}
                  >
                    نسبة {result.volatility.atrRatio}
                  </span>
                </div>
                <div className="flex gap-4 text-xs font-mono text-white/50">
                  <span>
                    ATR الحالي:{' '}
                    <span className="text-white/80">{result.volatility.atrCurrent}</span>
                  </span>
                  <span>
                    المتوسط:{' '}
                    <span className="text-white/80">{result.volatility.atrAvg}</span>
                  </span>
                </div>
                <p
                  className="text-xs font-bold leading-relaxed mt-0.5"
                  style={{ color: verdictColor(result.volatility.score) }}
                >
                  {result.volatility.verdict}
                </p>
              </div>

              {/* Row 4 — Spring / UTAD */}
              <div className="px-5 py-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-white/70">Spring / UTAD</p>
                  {result.springUtad.detected ? (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background:
                          result.springUtad.type === 'Spring'
                            ? 'rgba(251,146,60,0.2)'
                            : 'rgba(167,139,250,0.2)',
                        color:
                          result.springUtad.type === 'Spring' ? '#fb923c' : '#a78bfa',
                      }}
                    >
                      {result.springUtad.type === 'Spring' ? '🌱 Spring' : '⚡ UTAD'}
                    </span>
                  ) : (
                    <span className="text-xs text-white/30 font-mono">لم يُرصد</span>
                  )}
                </div>
                {result.springUtad.detected && result.springUtad.desc && (
                  <p
                    className="text-xs font-bold leading-relaxed mt-0.5"
                    style={{
                      color:
                        result.springUtad.type === 'Spring' ? '#fb923c' : '#a78bfa',
                    }}
                  >
                    {result.springUtad.desc}
                  </p>
                )}
                {!result.springUtad.detected && (
                  <p className="text-xs text-white/30 font-mono">
                    لا يوجد كسر كاذب ملحوظ في آخر 5 شمعات.
                  </p>
                )}
              </div>
            </div>

            {/* ── 4. Conclusion card ── */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{
                background: 'rgba(234,179,8,0.07)',
                border: '1px solid rgba(234,179,8,0.25)',
              }}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <p className="text-sm font-black text-yellow-400">الاستنتاج</p>
              </div>
              <p className="text-sm text-white/80 font-bold leading-relaxed">
                {result.conclusion}
              </p>
              <div
                className="flex items-center gap-2 pt-2 border-t"
                style={{ borderColor: 'rgba(234,179,8,0.15)' }}
              >
                <ChevronRight className="w-4 h-4 text-yellow-400/60" />
                <p className="text-xs text-white/50 font-mono">
                  المرحلة المتوقعة التالية:{' '}
                  <span className="text-yellow-400 font-bold">{result.nextPhase}</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ── */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 px-6 gap-4 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}
          >
            <Activity className="w-7 h-7 text-yellow-400" />
          </div>
          <p className="text-white/50 font-bold text-sm leading-relaxed max-w-xs">
            اختر الأداة ثم اضغط «تحليل وايكوف» لجلب آخر 150 شمعة يومية وتحليل المرحلة
          </p>
        </div>
      )}
    </div>
  );
}
