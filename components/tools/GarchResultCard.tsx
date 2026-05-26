'use client';

import type { GarchResult } from '@/lib/algorithms/quant';

// ── Number formatter ──────────────────────────────────────────────────────────
function fmtPrice(n: number): string {
  if (n >= 10_000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (n >= 1)      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return               n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  data:   GarchResult;
  symbol: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GarchResultCard({ data, symbol }: Props) {
  const isExpansion = data.state === 'انفجار';

  const stateColor  = isExpansion
    ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]';

  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#121212] overflow-hidden"
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-[#0f0f0f]">
        <div>
          <p className="text-sm text-white/25 uppercase tracking-widest font-mono">GARCH(1,1) · Volatility Bands</p>
          <p className="text-white font-bold text-lg font-mono tabular-nums">{symbol}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {/* Regime badge */}
          <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${stateColor}`}>
            {isExpansion ? '⚡ انفجار' : '◎ انحسار'}
          </span>
          {/* Annualised vol */}
          <span className="text-sm text-white/30 font-mono tabular-nums">
            Vol {data.annualisedVolPct}%
          </span>
        </div>
      </div>

      {/* ── Main Price Bands Box ─────────────────────────────────────────────── */}
      <div className="mx-4 my-3 rounded-xl border border-white/[0.07] bg-[#0a0a0a] divide-y divide-white/[0.05]" dir="rtl">

        {/* Top — Resistance */}
        <div className="flex items-center justify-between px-3 py-4">
          <span className="text-sm text-white/40 leading-snug text-right">
            الحد العلوي المتوقع<br />
            <span className="text-white/20">(مقاومة)</span>
          </span>
          <div className="text-left">
            <p className="text-base font-mono font-bold text-white tabular-nums">${fmtPrice(data.upperBound)}</p>
            <p className="text-sm font-mono font-bold text-orange-400 tabular-nums">
              (+{data.upperPct.toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* Middle — Current price (white left-border accent) */}
        <div className="flex items-center justify-between px-3 py-4 relative">
          {/* Left-border stroke (LTR space, but we're RTL, so right-side stroke visually) */}
          <span className="absolute right-0 top-2 bottom-2 w-[3px] bg-white rounded-full" />
          <span className="text-sm text-white/40 text-right pr-4">سعر الإغلاق الحالي</span>
          <p className="text-lg font-mono font-bold text-white tabular-nums">${fmtPrice(data.currentPrice)}</p>
        </div>

        {/* Bottom — Support */}
        <div className="flex items-center justify-between px-3 py-4">
          <span className="text-sm text-white/40 leading-snug text-right">
            الحد السفلي المتوقع<br />
            <span className="text-white/20">(دعم)</span>
          </span>
          <div className="text-left">
            <p className="text-base font-mono font-bold text-white tabular-nums">${fmtPrice(data.lowerBound)}</p>
            <p className="text-sm font-mono font-bold text-orange-400 tabular-nums">
              ({data.lowerPct.toFixed(2)}%)
            </p>
          </div>
        </div>
      </div>

      {/* ── Volatility Context Row ─────────────────────────────────────────── */}
      <div className="mx-4 mb-3 grid grid-cols-3 gap-3">
        {[
          { label: 'تاريخية',  value: `${data.historicalVolPct}%` },
          { label: 'حديثة',    value: `${data.recentVolPct}%`     },
          { label: 'نطاق الحركة', value: `${data.totalRangePct}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-2 py-4 text-center">
            <p className="text-sm text-white/30 font-medium mb-0.5">{label}</p>
            <p className="text-sm font-mono font-bold text-orange-300 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Verdict Box (orange right-border for RTL) ─────────────────────── */}
      <div className="mx-4 mb-4" dir="rtl">
        <div className="border-r-2 border-orange-500 pr-3 py-1">
          <p className="text-sm text-white/55 leading-relaxed text-right">
            الاستنتاج الخوارزمي: رصد{' '}
            <span className="text-orange-400 font-bold">{data.state}</span>
            {' '}في التباين. يُتوقع إحصائياً انحصار الحركة السعرية القادمة داخل نطاق تذبذب قدره{' '}
            <span className="text-orange-400 font-bold tabular-nums">({data.totalRangePct}%)</span>
            ، بحد أقصى عند السعر{' '}
            <span className="text-orange-400 font-bold tabular-nums">{fmtPrice(data.upperBound)}</span>
            {' '}وحد أدنى عند السعر{' '}
            <span className="text-orange-400 font-bold tabular-nums">{fmtPrice(data.lowerBound)}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
