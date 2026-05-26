'use client';

import type { RSIResult, MACDResult, BollingerResult } from '@/lib/algorithms/momentum';

// ── Price formatter ───────────────────────────────────────────────────────────
function fmtP(n: number): string {
  if (Math.abs(n) >= 10_000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1)      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function CardShell({ children, animate = true }: { children: React.ReactNode; animate?: boolean }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#121212] overflow-hidden"
      style={animate ? { animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' } : undefined}
    >
      {children}
    </div>
  );
}

function CardHeader({ label, symbol, timeframe, badge, badgeColor }: {
  label: string; symbol: string; timeframe: string;
  badge: string; badgeColor: string;
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

function VerdictBox({ text }: { text: string }) {
  return (
    <div className="mx-4 mb-4" dir="rtl">
      <div className="rounded-xl border border-white/[0.05] bg-[#0a0a0a] px-3 py-4 border-r-2 border-r-orange-500">
        <p className="text-sm text-white/55 leading-relaxed text-right">{text}</p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. RSI Result Card
// ═════════════════════════════════════════════════════════════════════════════

interface RsiProps { data: RSIResult; symbol: string; timeframe: string; }

export function RsiResultCard({ data, symbol, timeframe }: RsiProps) {
  const isOB  = data.state === 'OVERBOUGHT';
  const isOS  = data.state === 'OVERSOLD';
  const valColor   = isOB ? 'text-red-400' : isOS ? 'text-emerald-400' : 'text-white';
  const badgeColor = isOB
    ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : isOS
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-white/50 border-white/[0.08] bg-white/[0.03]';
  const badgeLabel = isOB ? '▲ OVERBOUGHT' : isOS ? '▼ OVERSOLD' : '◎ NEUTRAL';

  // Gauge bar (0-100 mapped to left position)
  const gaugeLeft = Math.min(98, Math.max(2, data.value));

  return (
    <CardShell>
      <CardHeader label="RSI · مؤشر القوة النسبية" symbol={symbol} timeframe={timeframe} badge={badgeLabel} badgeColor={badgeColor} />

      {/* Big RSI number */}
      <div className="px-5 py-5 text-center border-b border-white/[0.05]">
        <p className={`text-6xl font-black tabular-nums font-mono leading-none ${valColor}`}>{data.value}</p>
        <p className="text-sm text-white/25 uppercase tracking-widest mt-2 font-mono">RSI (14)</p>
      </div>

      {/* Visual gauge */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <div className="relative h-[6px] w-full rounded-full bg-white/[0.06] overflow-hidden">
          {/* Zone fills */}
          <div className="absolute left-0 top-0 h-full bg-emerald-500/30 rounded-l-full" style={{ width: '30%' }} />
          <div className="absolute right-0 top-0 h-full bg-red-500/30 rounded-r-full" style={{ width: '30%' }} />
          {/* Indicator dot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#121212] ${valColor.replace('text-', 'bg-')}`}
            style={{ left: `calc(${gaugeLeft}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-sm text-emerald-400/60 font-mono">30 · ذروة بيع</span>
          <span className="text-sm text-white/20 font-mono">50</span>
          <span className="text-sm text-red-400/60 font-mono">70 · ذروة شراء</span>
        </div>
      </div>

      <div className="pt-3">
        <VerdictBox text={data.verdict} />
      </div>
    </CardShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. MACD Result Card
// ═════════════════════════════════════════════════════════════════════════════

interface MacdProps { data: MACDResult; symbol: string; timeframe: string; }

export function MacdResultCard({ data, symbol, timeframe }: MacdProps) {
  const isBull = data.state === 'BULLISH';
  const isBear = data.state === 'BEARISH';
  const badgeColor = isBull
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : isBear
    ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-white/50 border-white/[0.08] bg-white/[0.03]';
  const badgeLabel = isBull ? '▲ BULLISH' : isBear ? '▼ BEARISH' : '◎ NEUTRAL';
  const histColor  = data.histogram >= 0 ? 'text-emerald-400' : 'text-red-400';
  const histBg     = data.histogram >= 0 ? 'bg-emerald-500' : 'bg-red-500';

  // Histogram bar (normalised width)
  const maxHist   = Math.max(Math.abs(data.histogram) * 1.5, 0.0001);
  const histWidth = Math.min(100, (Math.abs(data.histogram) / maxHist) * 100);

  return (
    <CardShell>
      <CardHeader label="MACD (12, 26, 9) · زخم الاتجاه" symbol={symbol} timeframe={timeframe} badge={badgeLabel} badgeColor={badgeColor} />

      {/* Data grid */}
      <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.04]" dir="rtl">
        {[
          { ar: 'خط MACD',    val: fmtP(data.macdLine),   color: isBull ? 'text-emerald-300' : 'text-red-300' },
          { ar: 'خط الإشارة', val: fmtP(data.signalLine), color: 'text-orange-300' },
        ].map(({ ar, val, color }) => (
          <div key={ar} className="flex items-center justify-between px-3 py-4.5">
            <span className={`text-base font-mono font-bold tabular-nums ${color}`}>{val}</span>
            <span className="text-sm text-white/35">{ar}</span>
          </div>
        ))}
        {/* Histogram with visual bar */}
        <div className="px-3 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-base font-mono font-bold tabular-nums ${histColor}`}>{fmtP(data.histogram)}</span>
            <span className="text-sm text-white/35">الهستوغرام</span>
          </div>
          <div className="h-[4px] w-full rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${histBg} transition-all duration-700`}
              style={{ width: `${histWidth}%`, marginLeft: data.histogram >= 0 ? 0 : `${100 - histWidth}%` }}
            />
          </div>
        </div>
      </div>

      <VerdictBox text={data.verdict} />
    </CardShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Bollinger Bands Result Card
// ═════════════════════════════════════════════════════════════════════════════

interface BollingerProps { data: BollingerResult; symbol: string; timeframe: string; }

export function BollingerResultCard({ data, symbol, timeframe }: BollingerProps) {
  const isSqueeze  = data.state === 'SQUEEZE';
  const stateBadge = isSqueeze
    ? 'text-amber-400 border-amber-500/30 bg-amber-500/[0.08]'
    : 'text-sky-400 border-sky-500/30 bg-sky-500/[0.08]';
  const stateLabel = isSqueeze ? '◎ SQUEEZE' : '⚡ EXPANSION';
  const stateAr    = isSqueeze ? 'انحسار السعر (SQUEEZE)' : 'توسع السعر (EXPANSION)';

  return (
    <CardShell>
      <CardHeader label="Bollinger Bands (20, 2σ) · نطاقات بولنجر" symbol={symbol} timeframe={timeframe} badge={stateLabel} badgeColor={stateBadge} />

      {/* 3-row price box — mirrors GARCH layout */}
      <div className="mx-4 my-3 rounded-xl border border-white/[0.07] bg-[#0a0a0a] divide-y divide-white/[0.05]" dir="rtl">

        {/* Upper band */}
        <div className="flex items-center justify-between px-3 py-4">
          <span className="text-sm text-white/40 text-right">الحد العلوي<br /><span className="text-white/20">(Upper Band)</span></span>
          <p className="text-base font-mono font-bold text-red-300 tabular-nums">${fmtP(data.upper)}</p>
        </div>

        {/* Middle — SMA with white right-border accent */}
        <div className="flex items-center justify-between px-3 py-4 relative">
          <span className="absolute right-0 top-2 bottom-2 w-[3px] bg-white rounded-full" />
          <span className="text-sm text-white/40 pr-4 text-right">المتوسط المتحرك (SMA-20)</span>
          <p className="text-lg font-mono font-bold text-white tabular-nums">${fmtP(data.middle)}</p>
        </div>

        {/* Lower band */}
        <div className="flex items-center justify-between px-3 py-4">
          <span className="text-sm text-white/40 text-right">الحد السفلي<br /><span className="text-white/20">(Lower Band)</span></span>
          <p className="text-base font-mono font-bold text-emerald-300 tabular-nums">${fmtP(data.lower)}</p>
        </div>
      </div>

      {/* Bandwidth + state badge */}
      <div className="mx-4 mb-3 flex items-center justify-between" dir="rtl">
        <span className={`text-sm font-bold px-2.5 py-1.5 rounded-lg border ${stateBadge}`}>{stateAr}</span>
        <div className="text-right">
          <p className="text-sm text-white/25 font-mono">عرض النطاق</p>
          <p className="text-base font-mono font-bold text-orange-300 tabular-nums">{data.bandwidth}%</p>
        </div>
      </div>

      <VerdictBox text={data.verdict} />
    </CardShell>
  );
}
