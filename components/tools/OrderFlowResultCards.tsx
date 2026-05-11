'use client';

import type { FVGResult, SweepResult, CVDResult } from '@/lib/algorithms/orderflow';

function fmtPrice(n: number): string {
  if (Math.abs(n) >= 10_000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1)      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// ── Shared sub-components ─────────────────────────────────────────────────────

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
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-[#0f0f0f]">
      <div>
        <p className="text-[9px] text-white/25 uppercase tracking-widest font-mono">{label}</p>
        <p className="text-white font-bold text-base font-mono">{symbol}</p>
        <p className="text-[10px] text-white/30 font-mono">{timeframe}</p>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${badgeColor}`}>
        {badge}
      </span>
    </div>
  );
}

function Verdict({ text }: { text: string }) {
  return (
    <div className="mx-4 mb-4" dir="rtl">
      <div className="rounded-xl border border-white/[0.05] bg-[#0a0a0a] px-3 py-3 border-r-2 border-r-orange-500">
        <p className="text-[11px] text-white/55 leading-relaxed text-right">{text}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mx-4 my-3 rounded-xl border border-white/[0.05] bg-[#0a0a0a] px-4 py-5 text-center">
      <p className="text-white/50 text-sm">{text}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. FVG Result Card
// ═════════════════════════════════════════════════════════════════════════════

interface FvgProps { data: FVGResult; symbol: string; timeframe: string; }

export function FvgResultCard({ data, symbol, timeframe }: FvgProps) {
  const isBull     = data.type === 'BULLISH';
  const badgeColor = !data.detected
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isBull
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-red-400 border-red-500/30 bg-red-500/[0.08]';
  const badge = !data.detected ? 'NO FVG' : isBull ? '▲ BULLISH FVG' : '▼ BEARISH FVG';

  return (
    <Shell>
      <Header label="FVG · فجوة القيمة العادلة" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />

      {!data.detected ? (
        <EmptyState text="لا توجد فجوات سعرية قريبة." />
      ) : (
        <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.05]" dir="rtl">
          {[
            { ar: 'الحد العلوي (Top)',    val: `$${fmtPrice(data.top)}`,      color: isBull ? 'text-emerald-300' : 'text-red-300' },
            { ar: 'المنتصف (Midpoint)',   val: `$${fmtPrice(data.midpoint)}`, color: 'text-orange-300' },
            { ar: 'الحد السفلي (Bottom)', val: `$${fmtPrice(data.bottom)}`,   color: isBull ? 'text-emerald-300' : 'text-red-300' },
            { ar: 'العمر (Age)',          val: `${data.age} شمعة`,            color: 'text-white/60' },
          ].map(({ ar, val, color }) => (
            <div key={ar} className="flex items-center justify-between px-3 py-2.5">
              <span className={`text-sm font-mono font-bold tabular-nums ${color}`}>{val}</span>
              <span className="text-[10px] text-white/35">{ar}</span>
            </div>
          ))}
        </div>
      )}

      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Sweep Result Card
// ═════════════════════════════════════════════════════════════════════════════

interface SweepProps { data: SweepResult; symbol: string; timeframe: string; }

export function SweepResultCard({ data, symbol, timeframe }: SweepProps) {
  const isBull     = data.type === 'BULLISH_REJECTION';
  const badgeColor = !data.swept
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isBull
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-red-400 border-red-500/30 bg-red-500/[0.08]';
  const badge = !data.swept ? 'NO SWEEP' : isBull ? '▲ BULL REJECTION' : '▼ BEAR REJECTION';

  return (
    <Shell>
      <Header label="Liquidity Sweep · مسح السيولة" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />

      {!data.swept ? (
        <EmptyState text="لم يتم رصد مسح سيولة." />
      ) : (
        <div className="mx-4 my-3 space-y-2">
          {/* Sweep level — large prominent price */}
          <div className={`rounded-xl border px-4 py-4 text-center ${isBull ? 'border-emerald-500/25 bg-emerald-500/[0.05]' : 'border-red-500/25 bg-red-500/[0.05]'}`}>
            <p className="text-[9px] text-white/30 uppercase tracking-widest font-mono mb-1">مستوى المسح (Sweep Level)</p>
            <p className={`text-2xl font-black font-mono tabular-nums ${isBull ? 'text-emerald-400' : 'text-red-400'}`}>
              ${fmtPrice(data.sweepLevel)}
            </p>
          </div>

          {/* Wick stat */}
          <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-3 py-2.5 flex justify-between items-center" dir="rtl">
            <span className="text-[10px] text-white/35">حجم ذيل الرفض</span>
            <span className="text-sm font-mono font-bold text-orange-300 tabular-nums">{data.wickPct}% من المدى</span>
          </div>
        </div>
      )}

      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. CVD Result Card
// ═════════════════════════════════════════════════════════════════════════════

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
  const trendLabel = isAcc ? '▲ ACCUMULATION' : isDist ? '▼ DISTRIBUTION' : '◎ NEUTRAL';
  const trendAr    = isAcc ? 'تجميع (ACCUMULATION)' : isDist ? 'تصريف (DISTRIBUTION)' : 'محايد (NEUTRAL)';

  const priceColor = data.priceTrend === 'UP' ? 'text-emerald-300' : data.priceTrend === 'DOWN' ? 'text-red-300' : 'text-white/40';

  return (
    <Shell>
      <Header label="CVD Proxy · دلتا الحجم التراكمي" symbol={symbol} timeframe={timeframe} badge={trendLabel} badgeColor={trendBadge} />

      {/* Trend label prominent */}
      <div className="px-4 py-4 text-center border-b border-white/[0.05]">
        <p className={`text-xl font-black font-mono ${trendColor}`}>{trendAr}</p>
        <p className="text-[10px] text-white/25 font-mono mt-1 tabular-nums">
          Σ Delta: {data.rawDelta.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="mx-4 my-3 grid grid-cols-2 gap-2" dir="rtl">
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-3 py-3 text-right">
          <p className="text-[9px] text-white/25 mb-1">اتجاه السعر</p>
          <p className={`text-base font-bold font-mono ${priceColor}`}>
            {data.priceTrend === 'UP' ? '▲ صاعد' : data.priceTrend === 'DOWN' ? '▼ هابط' : '◎ مستقر'}
          </p>
        </div>
        <div className={`rounded-xl border px-3 py-3 text-right ${data.divergenceDetected ? 'border-amber-500/30 bg-amber-500/[0.07]' : 'border-white/[0.06] bg-[#0a0a0a]'}`}>
          <p className="text-[9px] text-white/25 mb-1">تباين الحجم</p>
          <p className={`text-base font-bold font-mono ${data.divergenceDetected ? 'text-amber-400' : 'text-white/30'}`}>
            {data.divergenceDetected ? '⚠ مرصود' : '— لا يوجد'}
          </p>
        </div>
      </div>

      {/* Divergence alert banner */}
      {data.divergenceDetected && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5" dir="rtl">
          <p className="text-[10px] text-amber-400 font-bold text-right">⚠ تحذير: تباين بين السعر ودلتا الحجم — انتبه للانعكاس.</p>
        </div>
      )}

      <Verdict text={data.verdict} />
    </Shell>
  );
}
