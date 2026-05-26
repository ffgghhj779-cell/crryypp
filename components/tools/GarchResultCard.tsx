'use client';

import type { GarchResult } from '@/lib/algorithms/quant';

// â”€â”€ Number formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmtPrice(n: number): string {
  if (n >= 10_000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (n >= 1)      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return               n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Props {
  data:   GarchResult;
  symbol: string;
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-[#0f0f0f]">
        <div>
          <p className="text-sm text-white/25 uppercase tracking-widest font-mono">GARCH(1,1) آ· Volatility Bands</p>
          <p className="text-white font-bold text-lg font-mono tabular-nums">{symbol}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {/* Regime badge */}
          <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${stateColor}`}>
            {isExpansion ? 'âڑ، ط§ظ†ظپط¬ط§ط±' : 'â—ژ ط§ظ†ط­ط³ط§ط±'}
          </span>
          {/* Annualised vol */}
          <span className="text-sm text-white/30 font-mono tabular-nums">
            Vol {data.annualisedVolPct}%
          </span>
        </div>
      </div>

      {/* â”€â”€ Main Price Bands Box â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="mx-4 my-3 rounded-xl border border-white/[0.07] bg-[#0a0a0a] divide-y divide-white/[0.05]" dir="rtl">

        {/* Top â€” Resistance */}
        <div className="flex items-center justify-between px-3 py-4">
          <span className="text-sm text-white/40 leading-snug text-right">
            ط§ظ„ط­ط¯ ط§ظ„ط¹ظ„ظˆظٹ ط§ظ„ظ…طھظˆظ‚ط¹<br />
            <span className="text-white/20">(ظ…ظ‚ط§ظˆظ…ط©)</span>
          </span>
          <div className="text-left">
            <p className="text-lg font-mono font-bold text-white tabular-nums">${fmtPrice(data.upperBound)}</p>
            <p className="text-sm font-mono font-bold text-orange-400 tabular-nums">
              (+{data.upperPct.toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* Middle â€” Current price (white left-border accent) */}
        <div className="flex items-center justify-between px-3 py-4 relative">
          {/* Left-border stroke (LTR space, but we're RTL, so right-side stroke visually) */}
          <span className="absolute right-0 top-2 bottom-2 w-[3px] bg-white rounded-full" />
          <span className="text-sm text-white/40 text-right pr-4">ط³ط¹ط± ط§ظ„ط¥ط؛ظ„ط§ظ‚ ط§ظ„ط­ط§ظ„ظٹ</span>
          <p className="text-lg font-mono font-bold text-white tabular-nums">${fmtPrice(data.currentPrice)}</p>
        </div>

        {/* Bottom â€” Support */}
        <div className="flex items-center justify-between px-3 py-4">
          <span className="text-sm text-white/40 leading-snug text-right">
            ط§ظ„ط­ط¯ ط§ظ„ط³ظپظ„ظٹ ط§ظ„ظ…طھظˆظ‚ط¹<br />
            <span className="text-white/20">(ط¯ط¹ظ…)</span>
          </span>
          <div className="text-left">
            <p className="text-lg font-mono font-bold text-white tabular-nums">${fmtPrice(data.lowerBound)}</p>
            <p className="text-sm font-mono font-bold text-orange-400 tabular-nums">
              ({data.lowerPct.toFixed(2)}%)
            </p>
          </div>
        </div>
      </div>

      {/* â”€â”€ Volatility Context Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="mx-4 mb-3 grid grid-cols-3 gap-3">
        {[
          { label: 'طھط§ط±ظٹط®ظٹط©',  value: `${data.historicalVolPct}%` },
          { label: 'ط­ط¯ظٹط«ط©',    value: `${data.recentVolPct}%`     },
          { label: 'ظ†ط·ط§ظ‚ ط§ظ„ط­ط±ظƒط©', value: `${data.totalRangePct}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-2 py-4 text-center">
            <p className="text-sm text-white/30 font-medium mb-0.5">{label}</p>
            <p className="text-base font-mono font-bold text-orange-300 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* â”€â”€ Verdict Box (orange right-border for RTL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="mx-4 mb-4" dir="rtl">
        <div className="border-r-2 border-orange-500 pr-3 py-1">
          <p className="text-sm text-white/55 leading-relaxed text-right">
            ط§ظ„ط§ط³طھظ†طھط§ط¬ ط§ظ„ط®ظˆط§ط±ط²ظ…ظٹ: ط±طµط¯{' '}
            <span className="text-orange-400 font-bold">{data.state}</span>
            {' '}ظپظٹ ط§ظ„طھط¨ط§ظٹظ†. ظٹظڈطھظˆظ‚ط¹ ط¥ط­طµط§ط¦ظٹط§ظ‹ ط§ظ†ط­طµط§ط± ط§ظ„ط­ط±ظƒط© ط§ظ„ط³ط¹ط±ظٹط© ط§ظ„ظ‚ط§ط¯ظ…ط© ط¯ط§ط®ظ„ ظ†ط·ط§ظ‚ طھط°ط¨ط°ط¨ ظ‚ط¯ط±ظ‡{' '}
            <span className="text-orange-400 font-bold tabular-nums">({data.totalRangePct}%)</span>
            طŒ ط¨ط­ط¯ ط£ظ‚طµظ‰ ط¹ظ†ط¯ ط§ظ„ط³ط¹ط±{' '}
            <span className="text-orange-400 font-bold tabular-nums">{fmtPrice(data.upperBound)}</span>
            {' '}ظˆط­ط¯ ط£ط¯ظ†ظ‰ ط¹ظ†ط¯ ط§ظ„ط³ط¹ط±{' '}
            <span className="text-orange-400 font-bold tabular-nums">{fmtPrice(data.lowerBound)}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
