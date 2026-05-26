'use client';

import type { FVGResult, SweepResult, CVDResult } from '@/lib/algorithms/orderflow';

function fmtPrice(n: number): string {
  if (Math.abs(n) >= 10_000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1)      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// â”€â”€ Shared sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#121212] overflow-hidden"
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
    >{children}</div>
  );
}

function Header({ label, symbol, timeframe, badge, badgeColor }: {
  label: string; symbol: string; timeframe: string; badge: string; badgeColor: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-[#0f0f0f]">
      <div>
        <p className="text-sm text-white/25 uppercase tracking-widest font-mono">{label}</p>
        <p className="text-white font-bold text-lg font-mono">{symbol}</p>
        <p className="text-sm text-white/30 font-mono">{timeframe}</p>
      </div>
      <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${badgeColor}`}>
        {badge}
      </span>
    </div>
  );
}

function Verdict({ text }: { text: string }) {
  return (
    <div className="mx-4 mb-4" dir="rtl">
      <div className="rounded-xl border border-white/[0.05] bg-[#0a0a0a] px-3 py-4 border-r-2 border-r-orange-500">
        <p className="text-sm text-white/55 leading-relaxed text-right">{text}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mx-4 my-3 rounded-xl border border-white/[0.05] bg-[#0a0a0a] px-5 py-5 text-center">
      <p className="text-white/50 text-lg">{text}</p>
    </div>
  );
}

// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// 1. FVG Result Card
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

interface FvgProps { data: FVGResult; symbol: string; timeframe: string; }

export function FvgResultCard({ data, symbol, timeframe }: FvgProps) {
  const isBull     = data.type === 'BULLISH';
  const badgeColor = !data.detected
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isBull
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-red-400 border-red-500/30 bg-red-500/[0.08]';
  const badge = !data.detected ? 'NO FVG' : isBull ? 'â–² BULLISH FVG' : 'â–¼ BEARISH FVG';

  return (
    <Shell>
      <Header label="FVG آ· ظپط¬ظˆط© ط§ظ„ظ‚ظٹظ…ط© ط§ظ„ط¹ط§ط¯ظ„ط©" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />

      {!data.detected ? (
        <EmptyState text="ظ„ط§ طھظˆط¬ط¯ ظپط¬ظˆط§طھ ط³ط¹ط±ظٹط© ظ‚ط±ظٹط¨ط©." />
      ) : (
        <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.05]" dir="rtl">
          {[
            { ar: 'ط§ظ„ط­ط¯ ط§ظ„ط¹ظ„ظˆظٹ (Top)',    val: `$${fmtPrice(data.top)}`,      color: isBull ? 'text-emerald-300' : 'text-red-300' },
            { ar: 'ط§ظ„ظ…ظ†طھطµظپ (Midpoint)',   val: `$${fmtPrice(data.midpoint)}`, color: 'text-orange-300' },
            { ar: 'ط§ظ„ط­ط¯ ط§ظ„ط³ظپظ„ظٹ (Bottom)', val: `$${fmtPrice(data.bottom)}`,   color: isBull ? 'text-emerald-300' : 'text-red-300' },
            { ar: 'ط§ظ„ط¹ظ…ط± (Age)',          val: `${data.age} ط´ظ…ط¹ط©`,            color: 'text-white/60' },
          ].map(({ ar, val, color }) => (
            <div key={ar} className="flex items-center justify-between px-3 py-4.5">
              <span className={`text-lg font-mono font-bold tabular-nums ${color}`}>{val}</span>
              <span className="text-sm text-white/35">{ar}</span>
            </div>
          ))}
        </div>
      )}

      <Verdict text={data.verdict} />
    </Shell>
  );
}

// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// 2. Sweep Result Card
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

interface SweepProps { data: SweepResult; symbol: string; timeframe: string; }

export function SweepResultCard({ data, symbol, timeframe }: SweepProps) {
  const isBull     = data.type === 'BULLISH_REJECTION';
  const badgeColor = !data.swept
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isBull
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-red-400 border-red-500/30 bg-red-500/[0.08]';
  const badge = !data.swept ? 'NO SWEEP' : isBull ? 'â–² BULL REJECTION' : 'â–¼ BEAR REJECTION';

  return (
    <Shell>
      <Header label="Liquidity Sweep آ· ظ…ط³ط­ ط§ظ„ط³ظٹظˆظ„ط©" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />

      {!data.swept ? (
        <EmptyState text="ظ„ظ… ظٹطھظ… ط±طµط¯ ظ…ط³ط­ ط³ظٹظˆظ„ط©." />
      ) : (
        <div className="mx-4 my-3 space-y-2">
          {/* Sweep level â€” large prominent price */}
          <div className={`rounded-xl border px-5 py-4 text-center ${isBull ? 'border-emerald-500/25 bg-emerald-500/[0.05]' : 'border-red-500/25 bg-red-500/[0.05]'}`}>
            <p className="text-sm text-white/30 uppercase tracking-widest font-mono mb-1">ظ…ط³طھظˆظ‰ ط§ظ„ظ…ط³ط­ (Sweep Level)</p>
            <p className={`text-2xl font-black font-mono tabular-nums ${isBull ? 'text-emerald-400' : 'text-red-400'}`}>
              ${fmtPrice(data.sweepLevel)}
            </p>
          </div>

          {/* Wick stat */}
          <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-3 py-4.5 flex justify-between items-center" dir="rtl">
            <span className="text-sm text-white/35">ط­ط¬ظ… ط°ظٹظ„ ط§ظ„ط±ظپط¶</span>
            <span className="text-lg font-mono font-bold text-orange-300 tabular-nums">{data.wickPct}% ظ…ظ† ط§ظ„ظ…ط¯ظ‰</span>
          </div>
        </div>
      )}

      <Verdict text={data.verdict} />
    </Shell>
  );
}

// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// 3. CVD Result Card
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

interface CvdProps { data: CVDResult; symbol: string; timeframe: string; }

export function CvdResultCard({ data, symbol, timeframe }: CvdProps) {
  const isAcc  = data.cvdTrend === 'ACCUMULATION';
  const isDist = data.cvdTrend === 'DISTRIBUTION';

  const trendColor = isAcc ? 'text-emerald-400' : isDist ? 'text-red-400' : 'text-white/50';
  const trendBadge = isAcc
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : isDist
    ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-white/40 border-white/[0.08] bg-white/[0.03]';
  const trendLabel = isAcc ? 'â–² ACCUMULATION' : isDist ? 'â–¼ DISTRIBUTION' : 'â—ژ NEUTRAL';
  const trendAr    = isAcc ? 'طھط¬ظ…ظٹط¹ (ACCUMULATION)' : isDist ? 'طھطµط±ظٹظپ (DISTRIBUTION)' : 'ظ…ط­ط§ظٹط¯ (NEUTRAL)';

  const priceColor = data.priceTrend === 'UP' ? 'text-emerald-300' : data.priceTrend === 'DOWN' ? 'text-red-300' : 'text-white/40';

  return (
    <Shell>
      <Header label="CVD Proxy آ· ط¯ظ„طھط§ ط§ظ„ط­ط¬ظ… ط§ظ„طھط±ط§ظƒظ…ظٹ" symbol={symbol} timeframe={timeframe} badge={trendLabel} badgeColor={trendBadge} />

      {/* Trend label prominent */}
      <div className="px-5 py-4 text-center border-b border-white/[0.05]">
        <p className={`text-xl font-black font-mono ${trendColor}`}>{trendAr}</p>
        <p className="text-sm text-white/25 font-mono mt-1 tabular-nums">
          خ£ Delta: {data.rawDelta.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="mx-4 my-3 grid grid-cols-2 gap-3" dir="rtl">
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-3 py-4 text-right">
          <p className="text-sm text-white/25 mb-1">ط§طھط¬ط§ظ‡ ط§ظ„ط³ط¹ط±</p>
          <p className={`text-lg font-bold font-mono ${priceColor}`}>
            {data.priceTrend === 'UP' ? 'â–² طµط§ط¹ط¯' : data.priceTrend === 'DOWN' ? 'â–¼ ظ‡ط§ط¨ط·' : 'â—ژ ظ…ط³طھظ‚ط±'}
          </p>
        </div>
        <div className={`rounded-xl border px-3 py-4 text-right ${data.divergenceDetected ? 'border-amber-500/30 bg-amber-500/[0.07]' : 'border-white/[0.06] bg-[#0a0a0a]'}`}>
          <p className="text-sm text-white/25 mb-1">طھط¨ط§ظٹظ† ط§ظ„ط­ط¬ظ…</p>
          <p className={`text-lg font-bold font-mono ${data.divergenceDetected ? 'text-amber-400' : 'text-white/30'}`}>
            {data.divergenceDetected ? 'âڑ  ظ…ط±طµظˆط¯' : 'â€” ظ„ط§ ظٹظˆط¬ط¯'}
          </p>
        </div>
      </div>

      {/* Divergence alert banner */}
      {data.divergenceDetected && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-4.5" dir="rtl">
          <p className="text-sm text-amber-400 font-bold text-right">âڑ  طھط­ط°ظٹط±: طھط¨ط§ظٹظ† ط¨ظٹظ† ط§ظ„ط³ط¹ط± ظˆط¯ظ„طھط§ ط§ظ„ط­ط¬ظ… â€” ط§ظ†طھط¨ظ‡ ظ„ظ„ط§ظ†ط¹ظƒط§ط³.</p>
        </div>
      )}

      <Verdict text={data.verdict} />
    </Shell>
  );
}
