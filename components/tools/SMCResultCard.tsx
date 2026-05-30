'use client';

import type { SMCResult } from '@/lib/algorithms/smc';
import { formatAssetPrice } from '@/lib/assetInfo';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 10_000)   return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (n >= 1)        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

interface ScoreBarProps {
  label:    string;
  value:    number;
  maxValue: number;
  color:    string;
}

function ScoreBar({ label, value, maxValue, color }: ScoreBarProps) {
  const pct = Math.min(100, Math.round((value / maxValue) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-white/40 uppercase tracking-wider font-mono">{label}</span>
        <span className="text-sm text-white/60 font-mono tabular-nums">{value}/{maxValue}</span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface SetupBoxProps {
  labelEn: string;
  labelAr: string;
  value:   string;
  variant: 'default' | 'tp' | 'sl' | 'entry';
}

function SetupBox({ labelEn, labelAr, value, variant }: SetupBoxProps) {
  const styles: Record<string, string> = {
    entry:   'border-orange-500/30 bg-orange-500/[0.05]',
    tp:      'border-emerald-500/25 bg-emerald-500/[0.04]',
    sl:      'border-red-500/25 bg-red-500/[0.04]',
    default: 'border-white/[0.07] bg-white/[0.02]',
  };
  const labelColors: Record<string, string> = {
    entry: 'text-orange-400',
    tp:    'text-emerald-400',
    sl:    'text-red-400',
    default: 'text-white/40',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${styles[variant]}`}>
      <p className={`text-sm font-bold uppercase tracking-widest mb-0.5 ${labelColors[variant]}`}>{labelEn}</p>
      <p className="text-sm text-white/30 mb-2 font-medium">{labelAr}</p>
      <p className="text-base font-mono font-bold text-white tabular-nums leading-tight">{value}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  data:   SMCResult;
  symbol: string;
}

export function SMCResultCard({ data, symbol }: Props) {
  const isBull    = data.verdict === 'BULLISH';
  const isFresh   = data.status  === 'FRESH';
  const isBroken  = data.status  === 'BROKEN';

  const verdictBg   = isBull ? 'bg-white text-black'           : 'bg-white text-black';
  const statusBg    = isFresh ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : isBroken ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

  const scoreColor  = data.score >= 70 ? 'text-emerald-400'
                    : data.score >= 45 ? 'text-orange-400'
                    : 'text-red-400';

  // Arabic verdict text
  const verdictAr = isBull
    ? `كتلة أوامر شرائية عند ${fmt(data.priceRange.low)}–${fmt(data.priceRange.high)} · ثقة ${data.score}%. ${data.strongMoveDetails}. ${isFresh ? 'المنطقة نظيفة ولم تُمسّ بعد.' : 'المنطقة تعرّضت للاختبار.'}`
    : `كتلة أوامر بيعية عند ${fmt(data.priceRange.low)}–${fmt(data.priceRange.high)} · ثقة ${data.score}%. ${data.strongMoveDetails}. ${isFresh ? 'المنطقة نظيفة ولم تُمسّ بعد.' : 'المنطقة تعرّضت للاختبار.'}`;

  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] overflow-hidden space-y-0"
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-[#111111]">
        <div>
          <p className="text-sm text-white/30 uppercase tracking-widest font-mono">SMC · Order Block</p>
          <p className="text-white font-bold text-lg font-mono tabular-nums leading-tight">{symbol}</p>
          <p className="text-sm text-white/40 font-mono tabular-nums">${fmt(data.lastClose)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${verdictBg}`}>
            {isBull ? '▲ BULLISH' : '▼ BEARISH'}
          </span>
          <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${statusBg}`}>
            {data.status}
          </span>
        </div>
      </div>

      {/* ── Quality Score ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05] space-y-3">
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-black tabular-nums font-mono ${scoreColor}`}>{data.score}</span>
          <span className="text-white/20 text-lg font-mono">/100</span>
          <span className="text-sm text-white/30 uppercase tracking-widest ml-1">جودة الإشارة</span>
        </div>
        <div className="space-y-2">
          <ScoreBar label="Displacement"  value={data.scoreBreakdown.displacement} maxValue={25} color="bg-orange-500" />
          <ScoreBar label="Structure"     value={data.scoreBreakdown.structure}    maxValue={25} color="bg-sky-500"    />
          <ScoreBar label="FVG"           value={data.scoreBreakdown.fvg}          maxValue={20} color="bg-violet-500" />
          <ScoreBar label="Volume"        value={data.scoreBreakdown.volume}       maxValue={15} color="bg-emerald-500"/>
          <ScoreBar label="Cleanliness"   value={data.scoreBreakdown.clean}        maxValue={15} color="bg-amber-500"  />
        </div>
      </div>

      {/* ── Data Grid (Arabic RTL) ─────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05]" dir="rtl">
        <p className="text-sm text-white/25 uppercase tracking-widest mb-2 text-right font-mono">بيانات الكتلة</p>
        <div className="space-y-2">
          {[
            { ar: 'المنطقة',          val: `${fmt(data.priceRange.low)} — ${fmt(data.priceRange.high)}` },
            { ar: 'الجسم',            val: `${fmt(data.bodyRange.low)} — ${fmt(data.bodyRange.high)}`   },
            { ar: 'الحركة القوية',    val: data.strongMoveDetails                                       },
            { ar: 'FVG',              val: data.scoreBreakdown.fvg >= 15 ? 'مكتشف ✓' : 'غير مكتشف'    },
            { ar: 'BOS',              val: fmt(data.bosLevel)                                            },
            { ar: 'اللمسات',          val: String(data.touches)                                         },
          ].map(({ ar, val }) => (
            <div key={ar} className="flex justify-between items-center">
              <span className="text-sm font-mono tabular-nums text-white/70">{val}</span>
              <span className="text-sm text-white/35 font-medium">{ar}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trade Setup (4 Boxes) ─────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <p className="text-sm text-white/25 uppercase tracking-widest mb-2.5 font-mono">إعداد الصفقة</p>
        <div className="grid grid-cols-2 gap-3">
          <SetupBox labelEn="ENTRY"     labelAr="سعر الدخول"   value={formatAssetPrice(data.setup.entry, symbol)}  variant="entry"   />
          <SetupBox labelEn="STOP LOSS" labelAr="وقف الخسارة"  value={formatAssetPrice(data.setup.sl, symbol)}     variant="sl"      />
          <SetupBox labelEn="TP1"       labelAr="الهدف الأول"  value={formatAssetPrice(data.setup.tp1, symbol)}    variant="tp"      />
          <SetupBox labelEn="TP2"       labelAr="الهدف الثاني" value={formatAssetPrice(data.setup.tp2, symbol)}    variant="tp"      />
        </div>
        <div className="mt-2 text-center">
          <span className="text-sm text-white/25 font-mono">نسبة المخاطرة / العائد · </span>
          <span className="text-sm text-orange-400 font-bold font-mono">{data.setup.rr}</span>
        </div>
      </div>

      {/* ── Verdict (Orange left-border) ──────────────────────────────────── */}
      <div className="px-5 py-4" dir="rtl">
        <div className="border-r-2 border-orange-500 pr-3">
          <p className="text-sm text-white/60 leading-relaxed text-right">{verdictAr}</p>
        </div>
      </div>
    </div>
  );
}
