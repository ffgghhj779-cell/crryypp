'use client';

import type { PatternResult } from '@/lib/algorithms/patterns';

// â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Props {
  data:   PatternResult;
  symbol: string;
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function WedgeResultCard({ data, symbol }: Props) {
  const isBullish  = data.type === 'FALLING'; // falling wedge = bullish reversal
  const accentText = isBullish ? 'text-emerald-400' : data.type === 'RISING' ? 'text-red-400' : 'text-white/50';
  const accentBorder = isBullish ? 'border-emerald-500/30' : data.type === 'RISING' ? 'border-red-500/30' : 'border-white/[0.06]';

  const typeLabel = data.type === 'RISING'
    ? 'ظˆطھط¯ طµط§ط¹ط¯ (Rising Wedge) â€” ط§ظ†ط¹ظƒط§ط³ظٹ ظ‡ط¨ظˆط·ظٹ â†“'
    : data.type === 'FALLING'
    ? 'ظˆطھط¯ ظ‡ط§ط¨ط· (Falling Wedge) â€” ط§ظ†ط¹ظƒط§ط³ظٹ طµط¹ظˆط¯ظٹ â†‘'
    : null;

  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#121212] overflow-hidden space-y-0"
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
    >
      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-[#0f0f0f]">
        <div>
          <p className="text-sm text-white/25 uppercase tracking-widest font-mono">Wedge Scanner آ· ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ظƒظ„ط§ط³ظٹظƒظٹط©</p>
          <p className="text-white font-bold text-lg font-mono">{symbol}</p>
          <p className="text-sm text-white/30 font-mono mt-0.5">4H آ· 400 ط´ظ…ط¹ط©</p>
        </div>
        <div className="text-right">
          {data.detected ? (
            <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${accentBorder} ${accentText}`}>
              {data.type === 'RISING' ? 'â–½ RISING WEDGE' : 'â–³ FALLING WEDGE'}
            </span>
          ) : (
            <span className="text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-white/[0.08] text-white/30">
              NO PATTERN
            </span>
          )}
        </div>
      </div>

      {/* â”€â”€ Main Box â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-5 py-6 text-center"
        dir="rtl"
      >
        {data.detected ? (
          <div className="space-y-2">
            <p className={`text-lg font-bold ${accentText}`}>{typeLabel}</p>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.05]">
              <div className="text-center">
                <p className="text-sm text-white/25 font-mono uppercase tracking-wider mb-1">Confidence</p>
                <p className="text-lg font-mono font-bold text-orange-400 tabular-nums">{data.confidence}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-white/25 font-mono uppercase tracking-wider mb-1">Apex (bars)</p>
                <p className="text-lg font-mono font-bold text-white tabular-nums">{data.apexEstimate}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-white/25 font-mono uppercase tracking-wider mb-1">Pivots</p>
                <p className="text-lg font-mono font-bold text-white tabular-nums">
                  {(data.swingHighs?.length ?? 0) + (data.swingLows?.length ?? 0)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/70 text-lg font-medium">ظ„ظ… ظٹط±طµط¯ ظˆطھط¯.</p>
        )}
      </div>

      {/* â”€â”€ Verdict Box â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="mx-4 mb-3 rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-5 py-4" dir="rtl">
        <p className="text-sm text-orange-500 font-bold uppercase tracking-widest text-right mb-2">
          WEDGE VERDICT
        </p>
        {data.detected ? (
          <p className={`text-lg font-bold text-center ${accentText}`}>{typeLabel}</p>
        ) : (
          <p className="text-white/60 text-lg text-center">ظ„ظ… ظٹط±طµط¯ ظˆطھط¯.</p>
        )}
      </div>

      {/* â”€â”€ Reading Guide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="mx-4 mb-4" dir="rtl">
        <div className="rounded-xl border border-white/[0.05] bg-[#0a0a0a] px-3 py-4 border-r-2 border-r-orange-500">
          <p className="text-sm leading-relaxed text-right text-white/45">
            <span className="text-orange-500 font-bold">ط¯ظ„ظٹظ„ ط§ظ„ظ‚ط±ط§ط،ط©: </span>
            ط§ظ„ظˆطھط¯ ط§ظ„طµط§ط¹ط¯ (Rising Wedge) = ط§ظ†ط¹ظƒط§ط³ظٹ ظ‡ط¨ظˆط·ظٹ.{' '}
            ط§ظ„ظˆطھط¯ ط§ظ„ظ‡ط§ط¨ط· (Falling Wedge) = ط§ظ†ط¹ظƒط§ط³ظٹ طµط¹ظˆط¯ظٹ.{' '}
            <span className="text-white/60">U = ظ†ظ‚ط§ط· ط§ط±طھظƒط§ط² ط¹ظ„ظˆظٹط©.</span>{' '}
            <span className="text-white/60">L = ط³ظپظ„ظٹط©.</span>{' '}
            ط§ظ„ط­ط¬ظ… ط§ظ„ظ…طھظ†ط§ظ‚طµ = طھط£ظƒظٹط¯ ظƒظ„ط§ط³ظٹظƒظٹ.{' '}
            <span className="text-white/60">CONFIRM = ط³ط¹ط± طھظپط¹ظٹظ„ ط§ظ„ظ†ظ…ظˆط°ط¬.</span>{' '}
            ظ‡ط°ط§ طھط­ظ„ظٹظ„ ظپظ†ظٹ ظ…ظˆط¶ظˆط¹ظٹطŒ ظˆظ„ط§ ظٹظڈط¹طھط¨ط± طھظˆطµظٹط© ط´ط±ط§ط، ط£ظˆ ط¨ظٹط¹.
          </p>
        </div>
      </div>
    </div>
  );
}
