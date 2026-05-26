'use client';

/**
 * components/tools/EWAResultCard.tsx
 *
 * Elliott Wave Analysis Result Card
 * ==================================
 * Renders the full EWAResult JSON from the Python engine as a premium
 * dark-mode card with:
 *  - Wave pivot SVG diagram (proportional price chart with labeled waves)
 *  - 5-component scoring matrix with animated bars
 *  - Elliott Rules pass/fail indicators
 *  - Fibonacci Relation table
 *  - MTF Alignment state badge
 *  - Price targets (Invalidation / Primary / Extended)
 *  - Arabic algorithmic verdict (with orange left-border)
 *  - Meta strip (bottom row matching UI images)
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import type {
  EWAResult, EWAPivot, EWADirection,
  EWAScoringMatrix, EWAElliottRules, EWAFibonacci, EWAMTFAlignment,
  EWATargets,
} from '@/lib/types/ewa';
import { getConfidenceColor } from '@/lib/types/ewa';

// ─── Utility helpers ──────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 10_000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1)      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// ─── Sub-components ────────────────────────────────────────────────────────────

// ── Animated Score Bar ─────────────────────────────────────────────────────────
function ScoreBar({
  label, value, maxValue, color, delay = 0,
}: {
  label: string; value: number; maxValue: number; color: string; delay?: number;
}) {
  const pct = Math.min(100, Math.round((value / maxValue) * 100));
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 120 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-white/40 uppercase tracking-wider font-mono">{label}</span>
        <span className="text-sm text-white/60 font-mono tabular-nums">{value}/{maxValue}</span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${width}%`, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </div>
    </div>
  );
}

// ── Rule Badge ────────────────────────────────────────────────────────────────
function RuleBadge({ id, passed, detail }: { id: string; passed: boolean; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className={`text-left rounded-xl border p-2.5 w-full transition-all duration-200 ${
        passed
          ? 'border-emerald-500/30 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]'
          : 'border-red-500/30 bg-red-500/[0.05] hover:bg-red-500/[0.08]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-lg ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
          {passed ? '✓' : '✗'}
        </span>
        <span className={`text-sm font-bold font-mono uppercase tracking-wider ${
          passed ? 'text-emerald-400' : 'text-red-400'
        }`}>{id}</span>
        <span className="text-sm text-white/30 font-mono ml-auto">
          {open ? '▲' : '▼'}
        </span>
      </div>
      {open && (
        <p className="mt-1.5 text-sm text-white/50 leading-relaxed font-mono">
          {detail}
        </p>
      )}
    </button>
  );
}

// ── MTF Badge ─────────────────────────────────────────────────────────────────
function MTFBadge({ alignment, score }: { alignment: string; score: number }) {
  const config: Record<string, { bg: string; label: string; dot: string }> = {
    full:          { bg: 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400', label: 'متوافق تماماً',    dot: 'bg-emerald-400' },
    partial:       { bg: 'border-amber-500/30 bg-amber-500/[0.08] text-amber-400',       label: 'توافق جزئي',       dot: 'bg-amber-400'   },
    weak:          { bg: 'border-orange-500/30 bg-orange-500/[0.08] text-orange-400',    label: 'توافق ضعيف',       dot: 'bg-orange-400'  },
    contradiction: { bg: 'border-red-500/30 bg-red-500/[0.08] text-red-400',             label: 'تعارض بين الفريمات', dot: 'bg-red-500' },
  };
  const c = config[alignment] ?? config.weak;
  return (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-4 ${c.bg}`}>
      <div className="flex items-center gap-3">
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
        <span className="text-sm font-bold">{c.label}</span>
      </div>
      <span className="text-sm font-mono font-bold">{score}/10</span>
    </div>
  );
}

// ── Setup Box ─────────────────────────────────────────────────────────────────
function SetupBox({
  labelEn, labelAr, value, variant,
}: {
  labelEn: string; labelAr: string; value: string;
  variant: 'default' | 'tp' | 'sl' | 'entry' | 'ext';
}) {
  const styles: Record<string, string> = {
    entry:   'border-orange-500/30 bg-orange-500/[0.05]',
    tp:      'border-emerald-500/25 bg-emerald-500/[0.04]',
    ext:     'border-sky-500/25 bg-sky-500/[0.04]',
    sl:      'border-red-500/25 bg-red-500/[0.04]',
    default: 'border-white/[0.07] bg-white/[0.02]',
  };
  const lc: Record<string, string> = {
    entry: 'text-orange-400', tp: 'text-emerald-400',
    ext: 'text-sky-400', sl: 'text-red-400', default: 'text-white/40',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${styles[variant]}`}>
      <p className={`text-sm font-bold uppercase tracking-widest mb-0.5 ${lc[variant]}`}>{labelEn}</p>
      <p className="text-sm text-white/30 mb-1.5 font-medium">{labelAr}</p>
      <p className="text-base font-mono font-bold text-white tabular-nums leading-tight">{value}</p>
    </div>
  );
}

// ── Wave SVG Diagram ──────────────────────────────────────────────────────────

function WaveSVG({ pivots, direction }: { pivots: EWAPivot[]; direction: EWADirection }) {
  const W = 320;
  const H = 110;
  const PAD = { t: 18, b: 24, l: 14, r: 14 };

  const prices = pivots.map(p => p.price);
  const minP   = Math.min(...prices);
  const maxP   = Math.max(...prices);
  const range  = maxP - minP || 1;

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const pts = pivots.map((p, i) => {
    const x = PAD.l + (i / (pivots.length - 1 || 1)) * innerW;
    const y = PAD.t + (1 - (p.price - minP) / range) * innerH;
    return { x, y, label: p.label, price: p.price, type: p.pivot_type };
  });

  const pathD = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

  const isBull = direction === 'bullish';
  const lineColor  = isBull ? '#10b981' : '#ef4444';
  const dotPeakColor   = '#f97316';
  const dotValleyColor = '#60a5fa';

  // Wave-number label positioning: alternate above/below to avoid overlapping the line
  const LABEL_OFFSET = 11;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ overflow: 'visible' }}
    >
      {/* Subtle grid */}
      {[0.25, 0.5, 0.75].map(f => (
        <line
          key={f}
          x1={PAD.l} y1={PAD.t + f * innerH}
          x2={W - PAD.r} y2={PAD.t + f * innerH}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1"
        />
      ))}

      {/* Wave path — glowing line */}
      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="1.5"
            filter="url(#glow)" strokeLinejoin="round" />
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="0.75"
            strokeLinejoin="round" opacity="0.6" />

      {/* Pivot dots + labels */}
      {pts.map((pt, i) => {
        const isPeak   = pt.type === 'peak';
        const dotColor = isPeak ? dotPeakColor : dotValleyColor;
        // Peaks → label above; Valleys → label below
        const ly = isPeak ? pt.y - LABEL_OFFSET : pt.y + LABEL_OFFSET;
        return (
          <g key={i}>
            {/* Outer glow ring */}
            <circle cx={pt.x} cy={pt.y} r={5.5} fill={dotColor} opacity={0.15} />
            {/* Dot */}
            <circle cx={pt.x} cy={pt.y} r={3} fill={dotColor} />
            {/* Wave label */}
            <text
              x={pt.x} y={ly}
              textAnchor="middle"
              fill={dotColor}
              fontSize="9"
              fontFamily="'Courier New', monospace"
              fontWeight="700"
            >
              {pt.label}
            </text>
          </g>
        );
      })}

      {/* Price axis labels (min/max) */}
      <text x={PAD.l} y={H - 4} fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">
        ${fmtPrice(minP)}
      </text>
      <text x={W - PAD.r} y={H - 4} fill="rgba(255,255,255,0.2)" fontSize="7.5"
            fontFamily="monospace" textAnchor="end">
        ${fmtPrice(maxP)}
      </text>
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export interface EWAResultCardProps {
  data:   EWAResult;
  symbol: string;
}

export function EWAResultCard({ data, symbol }: EWAResultCardProps) {
  const isBull      = data.direction === 'bullish';
  const isBear      = data.direction === 'bearish';
  const confidence  = data.scoring_matrix.confidence_pct;
  const confColor   = getConfidenceColor(confidence);
  const sm          = data.scoring_matrix;
  const tgt         = data.targets;

  const confidenceLabel = useMemo(() => {
    if (confidence >= 80) return 'عالية جداً';
    if (confidence >= 65) return 'عالية';
    if (confidence >= 50) return 'متوسطة';
    if (confidence >= 35) return 'منخفضة';
    return 'ضعيفة';
  }, [confidence]);

  const isContradiction = data.mtf_alignment.alignment === 'contradiction';

  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] overflow-hidden"
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-[#111111]">
        <div>
          <p className="text-sm text-white/30 uppercase tracking-widest font-mono">
            EWA · Elliott Wave Analysis
          </p>
          <p className="text-white font-bold text-lg font-mono tabular-nums leading-tight">{symbol}</p>
          <p className="text-sm text-white/40 font-mono">
            {data.macro_timeframe} → {data.micro_timeframe}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {/* Direction badge */}
          <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
            isBull ? 'bg-emerald-400 text-black' : 'bg-red-400 text-black'
          }`}>
            {isBull ? '▲ BULLISH' : '▼ BEARISH'}
          </span>
          {/* Pattern badge */}
          <span className="text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-white/[0.10] text-white/60">
            {data.pattern_label}
          </span>
        </div>
      </div>

      {/* ── Arabic Pattern Name + Confidence ──────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-baseline gap-3 mb-1">
          <span
            className="text-3xl font-black tabular-nums font-mono"
            style={{ color: confColor }}
          >
            {confidence}
          </span>
          <span className="text-white/20 text-lg font-mono">/100</span>
          <span className="text-sm text-white/30 uppercase tracking-widest ml-1">
            ثقة · {confidenceLabel}
          </span>
        </div>
        <p className="text-sm text-white/70 font-medium" dir="rtl">{data.pattern_name_ar}</p>
      </div>

      {/* ── Wave SVG Diagram ──────────────────────────────────────────────── */}
      {data.pivots.length >= 2 && (
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <p className="text-sm text-white/25 uppercase tracking-widest mb-2 font-mono">
            هيكل الموجات
          </p>
          <WaveSVG pivots={data.pivots} direction={data.direction} />
        </div>
      )}

      {/* ── Scoring Matrix ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05] space-y-2.5">
        <p className="text-sm text-white/25 uppercase tracking-widest font-mono">مصفوفة التقييم</p>
        <ScoreBar label="Elliott Rules 40%"  value={sm.elliott_rules.score}  maxValue={40} color="bg-orange-500"  delay={0}   />
        <ScoreBar label="Fibonacci 25%"      value={sm.fibonacci.score}      maxValue={25} color="bg-violet-500" delay={80}  />
        <ScoreBar label="Structure 20%"      value={sm.structure.score}      maxValue={20} color="bg-sky-500"    delay={160} />
        <ScoreBar label="MTF Alignment 10%"  value={sm.mtf_alignment.score}  maxValue={10} color="bg-emerald-500" delay={240} />
        <ScoreBar label="Macro Momentum 5%"  value={sm.macro_momentum.score} maxValue={5}  color="bg-amber-500"  delay={320} />
      </div>

      {/* ── Elliott Rules ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm text-white/25 uppercase tracking-widest font-mono">
            القواعد الإلزامية
          </p>
          <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded-full ${
            data.elliott_rules.all_pass
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-red-400 bg-red-500/10'
          }`}>
            {data.elliott_rules.all_pass ? 'PASS ✓' : 'FAIL ✗'}
          </span>
        </div>
        <div className="space-y-1.5">
          {data.elliott_rules.rules.map(r => (
            <RuleBadge key={r.id} id={r.id} passed={r.passed} detail={r.detail} />
          ))}
        </div>
        {data.elliott_rules.is_diagonal && (
          <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-1.5">
            <p className="text-sm text-amber-400 font-mono">
              ⚠ مثلث قُطري — تداخل الموجة 4/1 مقبول مع خصم في التقييم
            </p>
          </div>
        )}
      </div>

      {/* ── Fibonacci Relations ────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05]" dir="rtl">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm text-white/25 uppercase tracking-widest font-mono text-right">
            علاقات فيبوناتشي
          </p>
          <span className="text-sm text-white/40 font-mono">{data.fibonacci.fib_score}/25</span>
        </div>
        <div className="space-y-2">
          {data.fibonacci.relations.map(rel => (
            <div key={rel.waves} className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  rel.passes ? 'bg-emerald-400' : 'bg-red-400'
                }`} />
                <span className="text-sm font-mono tabular-nums text-white/70">
                  {rel.actual_ratio.toFixed(3)}
                  <span className="text-white/30 text-sm ml-1">
                    ≈ {rel.near_level.toFixed(3)}
                  </span>
                </span>
              </div>
              <span className="text-sm text-white/35 font-medium">{rel.waves}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MTF Alignment ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <p className="text-sm text-white/25 uppercase tracking-widest mb-2 font-mono">
          التوافق متعدد الأطر
        </p>
        <MTFBadge alignment={data.mtf_alignment.alignment} score={data.mtf_alignment.mtf_score} />
        <p className="mt-2 text-sm text-white/40 leading-relaxed" dir="rtl">
          {data.mtf_alignment.bias_description_ar}
        </p>
        {isContradiction && data.mtf_alignment.contradiction_reason && (
          <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-4">
            <p className="text-sm text-red-400 font-mono leading-relaxed">
              ⚠ لا توجد إشارة تداول — يجب انتظار وضوح الاتجاه
            </p>
          </div>
        )}
      </div>

      {/* ── Price Targets ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <p className="text-sm text-white/25 uppercase tracking-widest mb-2.5 font-mono">
          مستويات التداول
        </p>
        <div className={`grid gap-3 ${tgt.extended_target ? 'grid-cols-2' : 'grid-cols-2'}`}>
          <SetupBox
            labelEn="TARGET"
            labelAr="الهدف الأساسي"
            value={tgt.target_label}
            variant="tp"
          />
          <SetupBox
            labelEn="STOP LOSS"
            labelAr="الإلغاء الصارم"
            value={tgt.invalidation_label}
            variant="sl"
          />
          {tgt.extended_target && (
            <SetupBox
              labelEn="EXT TARGET"
              labelAr="الهدف الموسع"
              value={tgt.extended_label ?? '—'}
              variant="ext"
            />
          )}
          <SetupBox
            labelEn="R/R RATIO"
            labelAr="نسبة المخاطرة"
            value={`${tgt.risk_reward_ratio.toFixed(2)}×`}
            variant="default"
          />
        </div>
        {/* Move percentage */}
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-sm text-white/25 font-mono">الحركة المتوقعة ·</span>
          <span className={`text-sm font-bold font-mono tabular-nums ${
            isBull ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {tgt.target_pct_move}
          </span>
        </div>
      </div>

      {/* ── Algorithmic Verdict ────────────────────────────────────────────── */}
      <div className="px-5 py-4" dir="rtl">
        <div className="border-r-2 border-orange-500 pr-3">
          <p className="text-sm text-white/60 leading-relaxed text-right">
            {data.verdict_ar}
          </p>
        </div>
      </div>

      {/* ── Meta Strip ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 bg-[#0a0a0a] border-t border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/20 font-mono">INV</span>
            <span className="text-sm text-red-400/70 font-mono tabular-nums">{data.meta.inv}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold font-mono px-1.5 py-0.5 rounded ${
              isBull ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
            }`}>
              {data.meta.dir}
            </span>
            <span className="text-sm text-white/20 font-mono">{data.meta.pattern}</span>
            <span className="text-sm text-white/30 font-mono tabular-nums">{data.meta.price}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
