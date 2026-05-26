'use client';

import type {
  DoublePatternResult, CupHandleResult, HSResult,
  TriangleResult, MarketStructureResult,
} from '@/lib/algorithms/classicPatterns';

function fmtPrice(n: number): string {
  if (!n) return 'â€”';
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

function PriceRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-4.5" dir="rtl">
      <span className={`text-lg font-mono font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-sm text-white/35">{label}</span>
    </div>
  );
}

// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// 1. Double Pattern Card
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

interface DoubleProps { data: DoublePatternResult; symbol: string; timeframe: string; }

export function DoublePatternCard({ data, symbol, timeframe }: DoubleProps) {
  const isTop   = data.type === 'DOUBLE_TOP';
  const badgeColor = !data.detected
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isTop
    ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]';
  const badge = !data.detected ? 'NO PATTERN' : isTop ? 'â–¼ DOUBLE TOP' : 'â–² DOUBLE BOTTOM';

  return (
    <Shell>
      <Header label="Double Pattern آ· ط§ظ„ظ‚ظ…طھط§ظ† / ط§ظ„ظ‚ط§ط¹ط§ظ†" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />
      {!data.detected ? <EmptyState text="ظ„ظ… ظٹظڈط±طµط¯ ظ†ظ…ظˆط°ط¬ ظ‚ظ…طھظٹظ† ط£ظˆ ظ‚ط§ط¹ظٹظ†." /> : (
        <>
          <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.05]">
            <PriceRow label="ط§ظ„ظ†ظ‚ط·ط© ط§ظ„ط£ظˆظ„ظ‰"  value={`$${fmtPrice(data.level1)}`}   color={isTop ? 'text-red-300' : 'text-emerald-300'} />
            <PriceRow label="ط§ظ„ظ†ظ‚ط·ط© ط§ظ„ط«ط§ظ†ظٹط©" value={`$${fmtPrice(data.level2)}`}   color={isTop ? 'text-red-300' : 'text-emerald-300'} />
            <PriceRow label="ط®ط· ط§ظ„ط¹ظ†ظ‚"        value={`$${fmtPrice(data.neckline)}`} color="text-orange-300" />
            <PriceRow label="ط§ظ„ظ‡ط¯ظپ ط§ظ„ظ…طھظˆظ‚ط¹"   value={`$${fmtPrice(data.target)}`}   color={isTop ? 'text-red-400' : 'text-emerald-400'} />
          </div>
          <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
            <span className="text-sm text-white/25">ط§ظ„ط«ظ‚ط©</span>
            <span className="text-lg font-mono font-bold text-orange-300">{data.confidence}%</span>
          </div>
        </>
      )}
      <Verdict text={data.verdict} />
    </Shell>
  );
}

// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// 2. Cup & Handle Card
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

interface CupProps { data: CupHandleResult; symbol: string; timeframe: string; }

export function CupHandleCard({ data, symbol, timeframe }: CupProps) {
  const badgeColor = data.detected
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-white/30 border-white/[0.08] bg-white/[0.02]';

  return (
    <Shell>
      <Header label="Cup & Handle آ· ط§ظ„ظƒظˆط¨ ظˆط§ظ„ظ…ظ‚ط¨ط¶" symbol={symbol} timeframe={timeframe}
        badge={data.detected ? 'â–² CUP & HANDLE' : 'NO PATTERN'} badgeColor={badgeColor} />
      {!data.detected ? <EmptyState text="ظ„ظ… ظٹظڈط±طµط¯ ظ†ظ…ظˆط°ط¬ ط§ظ„ظƒظˆط¨ ظˆط§ظ„ظ…ظ‚ط¨ط¶." /> : (
        <>
          <div className="mx-4 my-3 grid grid-cols-2 gap-3" dir="rtl">
            {[
              { label: 'ط¹ظ…ظ‚ ط§ظ„ظƒظˆط¨',    value: `${data.cupDepthPct}%`,    color: 'text-sky-300' },
              { label: 'ط¹ظ…ظ‚ ط§ظ„ظ…ظ‚ط¨ط¶',   value: `${data.handleDepthPct}%`, color: 'text-violet-300' },
              { label: 'ظ…ط³طھظˆظ‰ ط§ظ„ط­ط§ظپط©', value: `$${fmtPrice(data.rimLevel)}`, color: 'text-orange-300' },
              { label: 'ط§ظ„ظ‡ط¯ظپ',        value: `$${fmtPrice(data.target)}`,   color: 'text-emerald-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-4 text-right">
                <p className="text-sm text-white/30 mb-1">{label}</p>
                <p className={`text-lg font-mono font-bold tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
            <span className="text-sm text-white/25">ط§ظ„ط«ظ‚ط©</span>
            <span className="text-lg font-mono font-bold text-orange-300">{data.confidence}%</span>
          </div>
        </>
      )}
      <Verdict text={data.verdict} />
    </Shell>
  );
}

// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// 3. Head & Shoulders Card
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

interface HSProps { data: HSResult; symbol: string; timeframe: string; }

export function HeadShouldersCard({ data, symbol, timeframe }: HSProps) {
  const isInverse  = data.type === 'INVERSE';
  const badgeColor = !data.detected
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isInverse
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-red-400 border-red-500/30 bg-red-500/[0.08]';
  const badge = !data.detected ? 'NO PATTERN' : isInverse ? 'â–² INVERSE H&S' : 'â–¼ HEAD & SHOULDERS';

  return (
    <Shell>
      <Header label="Head & Shoulders آ· ط§ظ„ط±ط£ط³ ظˆط§ظ„ظƒطھظپط§ظ†" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />
      {!data.detected ? <EmptyState text="ظ„ظ… ظٹظڈط±طµط¯ ظ†ظ…ظˆط°ط¬ ط§ظ„ط±ط£ط³ ظˆط§ظ„ظƒطھظپظٹظ†." /> : (
        <>
          <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.05]">
            <PriceRow label="ط§ظ„ظƒطھظپ ط§ظ„ط£ظٹط³ط±"  value={`$${fmtPrice(data.leftShoulder)}`}  color="text-white/60" />
            <PriceRow label="ط§ظ„ط±ط£ط³"          value={`$${fmtPrice(data.head)}`}           color={isInverse ? 'text-emerald-300' : 'text-red-300'} />
            <PriceRow label="ط§ظ„ظƒطھظپ ط§ظ„ط£ظٹظ…ظ†"  value={`$${fmtPrice(data.rightShoulder)}`}  color="text-white/60" />
            <PriceRow label="ط®ط· ط§ظ„ط¹ظ†ظ‚"       value={`$${fmtPrice(data.neckline)}`}       color="text-orange-300" />
            <PriceRow label="ط§ظ„ظ‡ط¯ظپ ط§ظ„ظ…طھظˆظ‚ط¹"  value={`$${fmtPrice(data.target)}`}         color={isInverse ? 'text-emerald-400' : 'text-red-400'} />
          </div>
          <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
            <span className="text-sm text-white/25">ط§ظ„ط«ظ‚ط©</span>
            <span className="text-lg font-mono font-bold text-orange-300">{data.confidence}%</span>
          </div>
        </>
      )}
      <Verdict text={data.verdict} />
    </Shell>
  );
}

// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// 4. Triangle Card
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

interface TriangleProps { data: TriangleResult; symbol: string; timeframe: string; }

export function TriangleCard({ data, symbol, timeframe }: TriangleProps) {
  const isBull = data.bias === 'BULLISH', isBear = data.bias === 'BEARISH';
  const badgeColor = !data.detected
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isBull ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : isBear ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-amber-400 border-amber-500/30 bg-amber-500/[0.08]';
  const badge = !data.detected ? 'NO PATTERN' : `â–³ ${data.type}`;

  return (
    <Shell>
      <Header label="Triangle Predictor آ· ط§ظ„ظ…ط«ظ„ط«ط§طھ" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />
      {!data.detected ? <EmptyState text="ظ„ظ… ظٹظڈط±طµط¯ ظ†ظ…ظˆط°ط¬ ظ…ط«ظ„ط« ظˆط§ط¶ط­." /> : (
        <>
          <div className="mx-4 my-3 grid grid-cols-3 gap-3" dir="rtl">
            {[
              { label: 'ط§ظ„ظ†ظˆط¹',           value: data.typeAr.split(' (')[0], color: 'text-white' },
              { label: 'ط§ظ„ط°ط±ظˆط© (ط´ظ…ط¹ط©)',   value: `${data.apexBars}`,         color: 'text-orange-300' },
              { label: 'ط§ظ„طھط­ظٹظ‘ط²',         value: isBull ? 'طµط¹ظˆط¯ظٹ' : isBear ? 'ظ‡ط¨ظˆط·ظٹ' : 'ظ…ط­ط§ظٹط¯', color: isBull ? 'text-emerald-300' : isBear ? 'text-red-300' : 'text-amber-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-2 py-4 text-center">
                <p className="text-sm text-white/30 mb-1">{label}</p>
                <p className={`text-base font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
            <span className="text-sm text-white/25">ط§ظ„ط«ظ‚ط©</span>
            <span className="text-lg font-mono font-bold text-orange-300">{data.confidence}%</span>
          </div>
        </>
      )}
      <Verdict text={data.verdict} />
    </Shell>
  );
}

// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// 5. Market Structure Card
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

interface MSProps { data: MarketStructureResult; symbol: string; timeframe: string; }

export function MarketStructureCard({ data, symbol, timeframe }: MSProps) {
  const isBull = data.bias === 'BULLISH', isBear = data.bias === 'BEARISH';
  const trendColor = isBull ? 'text-emerald-400' : isBear ? 'text-red-400' : 'text-amber-400';
  const badgeColor = isBull
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : isBear
    ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-amber-400 border-amber-500/30 bg-amber-500/[0.08]';
  const trendAr = data.trend === 'UPTREND' ? 'â–² UPTREND آ· طµط§ط¹ط¯' : data.trend === 'DOWNTREND' ? 'â–¼ DOWNTREND آ· ظ‡ط§ط¨ط·' : 'â—ژ RANGING آ· ط¹ط±ط¶ظٹ';

  return (
    <Shell>
      <Header label="Market Structure آ· BOS & CHoCH" symbol={symbol} timeframe={timeframe} badge={trendAr} badgeColor={badgeColor} />

      {/* Big trend label */}
      <div className="px-5 py-4 text-center border-b border-white/[0.05]">
        <p className={`text-2xl font-black font-mono ${trendColor}`}>
          {data.trend === 'UPTREND' ? 'ط§طھط¬ط§ظ‡ طµط§ط¹ط¯' : data.trend === 'DOWNTREND' ? 'ط§طھط¬ط§ظ‡ ظ‡ط§ط¨ط·' : 'ط³ظˆظ‚ ط¹ط±ط¶ظٹ'}
        </p>
        <p className="text-sm text-orange-400 font-bold mt-1">{data.lastEventAr}</p>
      </div>

      {/* Swing levels */}
      <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.05]">
        <PriceRow label="ظ‚ظ…ط© ط§ظ„ط£ظ…ط¯ ط§ظ„ظ‚ط±ظٹط¨ (Swing High)" value={`$${fmtPrice(data.swingHigh)}`} color="text-red-300" />
        <PriceRow label="ظ‚ط§ط¹ ط§ظ„ط£ظ…ط¯ ط§ظ„ظ‚ط±ظٹط¨ (Swing Low)"  value={`$${fmtPrice(data.swingLow)}`}  color="text-emerald-300" />
      </div>

      <Verdict text={data.verdict} />
    </Shell>
  );
}
