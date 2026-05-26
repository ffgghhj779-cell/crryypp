'use client';

import type { SMCResult } from '@/lib/algorithms/smc';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      <p className="text-lg font-mono font-bold text-white tabular-nums leading-tight">{value}</p>
    </div>
  );
}

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    ? `ظƒطھظ„ط© ط£ظˆط§ظ…ط± ط´ط±ط§ط¦ظٹط© ط¹ظ†ط¯ ${fmt(data.priceRange.low)}â€“${fmt(data.priceRange.high)} آ· ط«ظ‚ط© ${data.score}%. ${data.strongMoveDetails}. ${isFresh ? 'ط§ظ„ظ…ظ†ط·ظ‚ط© ظ†ط¸ظٹظپط© ظˆظ„ظ… طھظڈظ…ط³ظ‘ ط¨ط¹ط¯.' : 'ط§ظ„ظ…ظ†ط·ظ‚ط© طھط¹ط±ظ‘ط¶طھ ظ„ظ„ط§ط®طھط¨ط§ط±.'}`
    : `ظƒطھظ„ط© ط£ظˆط§ظ…ط± ط¨ظٹط¹ظٹط© ط¹ظ†ط¯ ${fmt(data.priceRange.low)}â€“${fmt(data.priceRange.high)} آ· ط«ظ‚ط© ${data.score}%. ${data.strongMoveDetails}. ${isFresh ? 'ط§ظ„ظ…ظ†ط·ظ‚ط© ظ†ط¸ظٹظپط© ظˆظ„ظ… طھظڈظ…ط³ظ‘ ط¨ط¹ط¯.' : 'ط§ظ„ظ…ظ†ط·ظ‚ط© طھط¹ط±ظ‘ط¶طھ ظ„ظ„ط§ط®طھط¨ط§ط±.'}`;

  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] overflow-hidden space-y-0"
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
    >
      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-[#111111]">
        <div>
          <p className="text-sm text-white/30 uppercase tracking-widest font-mono">SMC آ· Order Block</p>
          <p className="text-white font-bold text-lg font-mono tabular-nums leading-tight">{symbol}</p>
          <p className="text-sm text-white/40 font-mono tabular-nums">${fmt(data.lastClose)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${verdictBg}`}>
            {isBull ? 'â–² BULLISH' : 'â–¼ BEARISH'}
          </span>
          <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${statusBg}`}>
            {data.status}
          </span>
        </div>
      </div>

      {/* â”€â”€ Quality Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="px-5 py-4 border-b border-white/[0.05] space-y-3">
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-black tabular-nums font-mono ${scoreColor}`}>{data.score}</span>
          <span className="text-white/20 text-lg font-mono">/100</span>
          <span className="text-sm text-white/30 uppercase tracking-widest ml-1">ط¬ظˆط¯ط© ط§ظ„ط¥ط´ط§ط±ط©</span>
        </div>
        <div className="space-y-2">
          <ScoreBar label="Displacement"  value={data.scoreBreakdown.displacement} maxValue={25} color="bg-orange-500" />
          <ScoreBar label="Structure"     value={data.scoreBreakdown.structure}    maxValue={25} color="bg-sky-500"    />
          <ScoreBar label="FVG"           value={data.scoreBreakdown.fvg}          maxValue={20} color="bg-violet-500" />
          <ScoreBar label="Volume"        value={data.scoreBreakdown.volume}       maxValue={15} color="bg-emerald-500"/>
          <ScoreBar label="Cleanliness"   value={data.scoreBreakdown.clean}        maxValue={15} color="bg-amber-500"  />
        </div>
      </div>

      {/* â”€â”€ Data Grid (Arabic RTL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="px-5 py-4 border-b border-white/[0.05]" dir="rtl">
        <p className="text-sm text-white/25 uppercase tracking-widest mb-2 text-right font-mono">ط¨ظٹط§ظ†ط§طھ ط§ظ„ظƒطھظ„ط©</p>
        <div className="space-y-2">
          {[
            { ar: 'ط§ظ„ظ…ظ†ط·ظ‚ط©',          val: `${fmt(data.priceRange.low)} â€” ${fmt(data.priceRange.high)}` },
            { ar: 'ط§ظ„ط¬ط³ظ…',            val: `${fmt(data.bodyRange.low)} â€” ${fmt(data.bodyRange.high)}`   },
            { ar: 'ط§ظ„ط­ط±ظƒط© ط§ظ„ظ‚ظˆظٹط©',    val: data.strongMoveDetails                                       },
            { ar: 'FVG',              val: data.scoreBreakdown.fvg >= 15 ? 'ظ…ظƒطھط´ظپ âœ“' : 'ط؛ظٹط± ظ…ظƒطھط´ظپ'    },
            { ar: 'BOS',              val: fmt(data.bosLevel)                                            },
            { ar: 'ط§ظ„ظ„ظ…ط³ط§طھ',          val: String(data.touches)                                         },
          ].map(({ ar, val }) => (
            <div key={ar} className="flex justify-between items-center">
              <span className="text-sm font-mono tabular-nums text-white/70">{val}</span>
              <span className="text-sm text-white/35 font-medium">{ar}</span>
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ Trade Setup (4 Boxes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <p className="text-sm text-white/25 uppercase tracking-widest mb-2.5 font-mono">ط¥ط¹ط¯ط§ط¯ ط§ظ„طµظپظ‚ط©</p>
        <div className="grid grid-cols-2 gap-3">
          <SetupBox labelEn="ENTRY"     labelAr="ط³ط¹ط± ط§ظ„ط¯ط®ظˆظ„"   value={`$${fmt(data.setup.entry)}`}  variant="entry"   />
          <SetupBox labelEn="STOP LOSS" labelAr="ظˆظ‚ظپ ط§ظ„ط®ط³ط§ط±ط©"  value={`$${fmt(data.setup.sl)}`}     variant="sl"      />
          <SetupBox labelEn="TP1"       labelAr="ط§ظ„ظ‡ط¯ظپ ط§ظ„ط£ظˆظ„"  value={`$${fmt(data.setup.tp1)}`}    variant="tp"      />
          <SetupBox labelEn="TP2"       labelAr="ط§ظ„ظ‡ط¯ظپ ط§ظ„ط«ط§ظ†ظٹ" value={`$${fmt(data.setup.tp2)}`}    variant="tp"      />
        </div>
        <div className="mt-2 text-center">
          <span className="text-sm text-white/25 font-mono">ظ†ط³ط¨ط© ط§ظ„ظ…ط®ط§ط·ط±ط© / ط§ظ„ط¹ط§ط¦ط¯ آ· </span>
          <span className="text-sm text-orange-400 font-bold font-mono">{data.setup.rr}</span>
        </div>
      </div>

      {/* â”€â”€ Verdict (Orange left-border) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="px-5 py-4" dir="rtl">
        <div className="border-r-2 border-orange-500 pr-3">
          <p className="text-sm text-white/60 leading-relaxed text-right">{verdictAr}</p>
        </div>
      </div>
    </div>
  );
}
