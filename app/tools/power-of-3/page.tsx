'use client';

import { useState } from 'react';
import { fetchKlines } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { slugToTool } from '@/lib/tools/registry';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { notFound } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, Zap, AlertCircle, Hand, Scissors, Gem, TrendingUp, TrendingDown } from 'lucide-react';

// ─── AMD Phase types ────────────────────────────────────────────────────────────
type AMDPhase = 'Accumulation' | 'Distribution' | 'Manipulation_Bullish' | 'Manipulation_Bearish' | 'Neutral';

interface CandleData {
  open: number;
  high: number;
  close: number;
  low: number;
  bodySize: number;       // abs body as % of price
  upperWickPct: number;   // upper wick as % of price
  lowerWickPct: number;   // lower wick as % of price
  upperWick: number;      // raw upper wick
  lowerWick: number;      // raw lower wick
  isBullish: boolean;
}

interface AMDAnalysis {
  candle: CandleData;
  phase: AMDPhase;
  confidence: number;
  title: string;
  explanation: string;
  recommendation: string;
  color: string;
}

// ─── AMD Phase Analysis Logic ──────────────────────────────────────────────────
function analyzeAMD(today: { open: number; high: number; low: number; close: number }, prev: { open: number; high: number; low: number; close: number }): AMDAnalysis {
  const { open, high, low, close } = today;
  const isBullish = close > open;

  const bodyTop = Math.max(open, close);
  const bodyBot = Math.min(open, close);
  const upperWick = high - bodyTop;
  const lowerWick = bodyBot - low;
  const bodyRange = bodyTop - bodyBot;

  const range = high - low || 1;
  const upperWickPct = (upperWick / high) * 100;
  const lowerWickPct = (lowerWick / high) * 100;
  const bodySizePct = (bodyRange / open) * 100;

  // ── Detection Logic ──
  const isBullishManipulation =
    low < prev.low * 0.999 && close > prev.low;

  const isBearishManipulation =
    high > prev.high * 1.001 && close < prev.high;

  const isAccumulation = lowerWick > upperWick * 2;
  const isDistribution = upperWick > lowerWick * 2;

  const candle: CandleData = {
    open, high, low, close,
    bodySize: parseFloat(bodySizePct.toFixed(2)),
    upperWickPct: parseFloat(upperWickPct.toFixed(2)),
    lowerWickPct: parseFloat(lowerWickPct.toFixed(2)),
    upperWick, lowerWick,
    isBullish,
  };

  // Priority: Manipulation > Accumulation / Distribution > Neutral
  if (isBullishManipulation) {
    return {
      candle,
      phase: 'Manipulation_Bullish',
      confidence: 80,
      title: 'تلاعب صاعد (Fake Breakdown)',
      explanation: `الشمعة كسرت قاع الأمس (${prev.low.toFixed(2)}) ثم أغلقت فوقه — إشارة على اصطياد الوقف السفلي وخداع البائعين. المؤسسات ضربت السيولة ثم سترتد للأعلى.`,
      recommendation: 'ترقّب إشارة دخول شرائية بعد استعادة قاع الأمس. الكسر الكاذب للقاع فرصة شراء عكسية.',
      color: '#fb923c',
    };
  }

  if (isBearishManipulation) {
    return {
      candle,
      phase: 'Manipulation_Bearish',
      confidence: 80,
      title: 'تلاعب هابط (Fake Breakout)',
      explanation: `الشمعة تجاوزت قمة الأمس (${prev.high.toFixed(2)}) ثم أغلقت دونها — إشارة اصطياد وقف الربح للمشترين. المؤسسات فخّخت القمة وستنزل.`,
      recommendation: 'ترقّب إشارة دخول بيعي بعد فشل الكسر. الكسر الكاذب للقمة فرصة بيع عكسية.',
      color: '#a78bfa',
    };
  }

  if (isAccumulation) {
    return {
      candle,
      phase: 'Accumulation',
      confidence: 72,
      title: 'تجميع في القاع (Accumulation)',
      explanation: `الظل السفلي (${lowerWick.toFixed(2)}) أكبر من الظل العلوي بأكثر من مرتين — السعر اختبر القاع ورُفض بقوة. دلالة على شراء مؤسسي واستيعاب للعرض.`,
      recommendation: 'الشمعة بُلّيش في جوهرها. ابحث عن دخول شرائي عند تأكيد الدعم.',
      color: '#60a5fa',
    };
  }

  if (isDistribution) {
    return {
      candle,
      phase: 'Distribution',
      confidence: 72,
      title: 'توزيع في القمة (Distribution)',
      explanation: `الظل العلوي (${upperWick.toFixed(2)}) أكبر من الظل السفلي بأكثر من مرتين — السعر اختبر القمة ورُفض. دلالة على بيع مؤسسي ومقاومة للصعود.`,
      recommendation: 'الشمعة بيريش في جوهرها. ابحث عن دخول بيعي عند تأكيد المقاومة.',
      color: '#f87171',
    };
  }

  return {
    candle,
    phase: 'Neutral',
    confidence: 45,
    title: 'شمعة متوازنة (Neutral)',
    explanation: 'لا توجد سيطرة واضحة للمشترين أو البائعين. الظلان متقاربان ولا يوجد كسر كاذب مؤكد.',
    recommendation: 'انتظر تطورات إضافية. تجنّب الدخول في غياب إشارة واضحة.',
    color: '#94a3b8',
  };
}

// ─── SVG Candle Visual ─────────────────────────────────────────────────────────
function CandleSVG({ candle, phase }: { candle: CandleData; phase: AMDPhase }) {
  const W = 280;
  const H = 360;
  const candleX = W / 2;
  const bodyW = 56;

  const { open, high, low, close } = candle;
  const range = high - low || 1;
  const pad = H * 0.1;
  const drawH = H - pad * 2;

  function toY(price: number) {
    return pad + (1 - (price - low) / range) * drawH;
  }

  const bodyTop = toY(Math.max(open, close));
  const bodyBot = toY(Math.min(open, close));
  const bodyHeight = Math.max(bodyBot - bodyTop, 4);
  const wickTop = toY(high);
  const wickBot = toY(low);

  const bodyColor = candle.isBullish ? '#34d399' : '#f87171';
  const glowColor = candle.isBullish ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)';

  // Label positions
  const upperMidY = (wickTop + bodyTop) / 2;
  const lowerMidY = (bodyBot + wickBot) / 2;
  const bodyMidY = (bodyTop + bodyBot) / 2;

  const hasUpperWick = candle.upperWick > 0.01;
  const hasLowerWick = candle.lowerWick > 0.01;

  const showAccLabel = phase === 'Accumulation' || phase === 'Manipulation_Bullish';
  const showDistLabel = phase === 'Distribution' || phase === 'Manipulation_Bearish';
  const showManipLabel = phase === 'Manipulation_Bullish' || phase === 'Manipulation_Bearish';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mx-auto">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bodyColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Glow backdrop for candle */}
      <rect
        x={candleX - bodyW / 2 - 6}
        y={bodyTop - 6}
        width={bodyW + 12}
        height={bodyHeight + 12}
        rx="6"
        fill={glowColor}
        opacity="0.3"
        filter="url(#glow)"
      />

      {/* Upper Wick */}
      {hasUpperWick && (
        <line
          x1={candleX}
          y1={wickTop}
          x2={candleX}
          y2={bodyTop}
          stroke={bodyColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}

      {/* Lower Wick */}
      {hasLowerWick && (
        <line
          x1={candleX}
          y1={bodyBot}
          x2={candleX}
          y2={wickBot}
          stroke={bodyColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}

      {/* Body */}
      <rect
        x={candleX - bodyW / 2}
        y={bodyTop}
        width={bodyW}
        height={bodyHeight}
        rx="5"
        fill="url(#bodyGrad)"
        filter="url(#glow)"
      />

      {/* ── AMD Label — Upper Wick (Distribution) ── */}
      {hasUpperWick && showDistLabel && (
        <>
          <line
            x1={candleX + bodyW / 2 + 4}
            y1={upperMidY}
            x2={candleX + bodyW / 2 + 20}
            y2={upperMidY}
            stroke={phase === 'Manipulation_Bearish' ? '#a78bfa' : '#f87171'}
            strokeWidth={1.5}
            strokeDasharray="3,2"
          />
          <text
            x={candleX + bodyW / 2 + 24}
            y={upperMidY + 4}
            fill={phase === 'Manipulation_Bearish' ? '#a78bfa' : '#f87171'}
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {phase === 'Manipulation_Bearish' ? '⚡ Manip' : '📤 Dist'}
          </text>
        </>
      )}

      {/* ── AMD Label — Lower Wick (Accumulation) ── */}
      {hasLowerWick && showAccLabel && (
        <>
          <line
            x1={candleX + bodyW / 2 + 4}
            y1={lowerMidY}
            x2={candleX + bodyW / 2 + 20}
            y2={lowerMidY}
            stroke={phase === 'Manipulation_Bullish' ? '#fb923c' : '#60a5fa'}
            strokeWidth={1.5}
            strokeDasharray="3,2"
          />
          <text
            x={candleX + bodyW / 2 + 24}
            y={lowerMidY + 4}
            fill={phase === 'Manipulation_Bullish' ? '#fb923c' : '#60a5fa'}
            fontSize="11"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {phase === 'Manipulation_Bullish' ? '⚡ Manip' : '📥 Acc'}
          </text>
        </>
      )}

      {/* ── Body Direction Label ── */}
      <line
        x1={candleX - bodyW / 2 - 4}
        y1={bodyMidY}
        x2={candleX - bodyW / 2 - 22}
        y2={bodyMidY}
        stroke={bodyColor}
        strokeWidth={1.5}
        strokeDasharray="3,2"
      />
      <text
        x={candleX - bodyW / 2 - 26}
        y={bodyMidY + 4}
        fill={bodyColor}
        fontSize="11"
        fontWeight="bold"
        fontFamily="monospace"
        textAnchor="end"
      >
        {candle.isBullish ? '🟢 صاعد' : '🔴 هابط'}
      </text>

      {/* Price labels */}
      <text x={candleX + bodyW / 2 + 4} y={wickTop + 4} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">H</text>
      <text x={candleX + bodyW / 2 + 4} y={wickBot + 4} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">L</text>
    </svg>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────────
export default function PowerOf3Page() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [analysis, setAnalysis] = useState<AMDAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tool = slugToTool('power-of-3');
  if (!tool) return notFound();

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const klines = await fetchKlines(symbol, '1d', 2);
      if (klines.length < 2) throw new Error('بيانات غير كافية — تحتاج شمعتين على الأقل.');
      const prev  = klines[klines.length - 2];
      const today = klines[klines.length - 1];
      const result = analyzeAMD(today, prev);
      setAnalysis(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }

  // Phase metadata for display
  const PHASE_DISPLAY: Record<AMDPhase, { icon: React.ElementType; color: string; bg: string; border: string }> = {
    Accumulation:         { icon: Hand,       color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.35)' },
    Distribution:         { icon: Gem,        color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.35)' },
    Manipulation_Bullish: { icon: Scissors,   color: '#fb923c', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.35)' },
    Manipulation_Bearish: { icon: Scissors,   color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.35)' },
    Neutral:              { icon: RefreshCcw, color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.25)' },
  };

  const phaseMeta = analysis ? PHASE_DISPLAY[analysis.phase] : null;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto pb-14"
      dir="rtl"
      style={{ background: '#080b10' }}
    >
      <ToolPageHeader tool={tool} />

      {/* ── Controls ── */}
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
              <Zap className="w-4 h-4" />
              تحليل Power of 3
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
            style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.3)' }}
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 font-bold leading-relaxed">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ── */}
      <AnimatePresence>
        {analysis && phaseMeta && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="px-4 flex flex-col gap-4"
          >
            {/* ── Phase badge ── */}
            <div
              className="rounded-2xl p-5 flex items-center justify-between"
              style={{
                background: phaseMeta.bg,
                border: `1px solid ${phaseMeta.border}`,
                boxShadow: `0 0 30px ${phaseMeta.bg}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: `${phaseMeta.color}22` }}
                >
                  <phaseMeta.icon className="w-5 h-5" style={{ color: phaseMeta.color }} />
                </div>
                <div>
                  <p className="text-xs text-white/40 font-mono uppercase tracking-widest">مرحلة AMD</p>
                  <p className="text-lg font-black" style={{ color: phaseMeta.color }}>
                    {analysis.title}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-3xl font-black" style={{ color: phaseMeta.color }}>
                  {analysis.confidence}%
                </p>
                <p className="text-xs text-white/40 font-mono">ثقة</p>
              </div>
            </div>

            {/* ── Candle Numbers ── */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-1">بيانات شمعة اليوم</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Open', value: analysis.candle.open.toFixed(2), color: '#f59e0b' },
                  { label: 'Close', value: analysis.candle.close.toFixed(2), color: analysis.candle.isBullish ? '#34d399' : '#f87171' },
                  { label: 'High', value: analysis.candle.high.toFixed(2), color: '#34d399' },
                  { label: 'Low', value: analysis.candle.low.toFixed(2), color: '#f87171' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl px-3 py-2 flex items-center justify-between"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span className="text-xs text-white/40 font-mono">{label}</span>
                    <span className="text-sm font-black" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Percentages */}
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { label: 'Body', value: `${analysis.candle.bodySize}%`, color: analysis.candle.isBullish ? '#34d399' : '#f87171' },
                  { label: 'Upper Wick', value: `${analysis.candle.upperWickPct}%`, color: '#f87171' },
                  { label: 'Lower Wick', value: `${analysis.candle.lowerWickPct}%`, color: '#60a5fa' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl px-2 py-2 flex flex-col items-center gap-0.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span className="text-[10px] text-white/30 font-mono">{label}</span>
                    <span className="text-sm font-black" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── SVG Candle ── */}
            <div
              className="rounded-2xl py-6 px-3"
              style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4 text-center">
                رسم بصري للشمعة مع مراحل AMD
              </p>
              <CandleSVG candle={analysis.candle} phase={analysis.phase} />
            </div>

            {/* ── Explanation ── */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: `${phaseMeta.bg}`, border: `1px solid ${phaseMeta.border}` }}
            >
              <p className="text-sm font-black" style={{ color: phaseMeta.color }}>
                التفسير
              </p>
              <p className="text-sm text-white/80 font-bold leading-relaxed">
                {analysis.explanation}
              </p>
            </div>

            {/* ── Recommendation ── */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-2 mb-2"
              style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)' }}
            >
              <div className="flex items-center gap-2">
                {analysis.candle.isBullish
                  ? <TrendingUp className="w-4 h-4 text-yellow-400" />
                  : <TrendingDown className="w-4 h-4 text-yellow-400" />}
                <p className="text-sm font-black text-yellow-400">التوصية</p>
              </div>
              <p className="text-sm text-white/80 font-bold leading-relaxed">
                {analysis.recommendation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ── */}
      {!analysis && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 px-6 gap-4 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}
          >
            <Zap className="w-7 h-7 text-yellow-400" />
          </div>
          <p className="text-white/50 font-bold text-sm leading-relaxed max-w-xs">
            اختر الأداة ثم اضغط «تحليل Power of 3» لتحليل شمعة اليوم وتحديد مرحلة AMD الفعلية
          </p>
        </div>
      )}
    </div>
  );
}
