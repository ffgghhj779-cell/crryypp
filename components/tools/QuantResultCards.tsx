'use client';

import type {
  MonteCarloResult, LinearRegressionResult, MarkovResult, FourierResult,
} from '@/lib/algorithms/advancedQuant';

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

// ═════════════════════════════════════════════════════════════════════════════
// 1. Monte Carlo Card
// ═════════════════════════════════════════════════════════════════════════════

interface MCProps { data: MonteCarloResult; symbol: string; timeframe: string; }

export function MonteCarloCard({ data, symbol, timeframe }: MCProps) {
  return (
    <Shell>
      <Header label="Monte Carlo · المسار السعري المتوقع (30 شمعة)" symbol={symbol} timeframe={timeframe}
        badge="500 PATH" badgeColor="text-violet-400 border-violet-500/30 bg-violet-500/[0.08]" />

      {/* 3-row price grid */}
      <div className="mx-4 my-3 rounded-xl border border-white/[0.07] bg-[#0a0a0a] divide-y divide-white/[0.05]" dir="rtl">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-[10px] text-white/40 leading-snug">السعر الأقصى المتوقع<br /><span className="text-white/20">(95th percentile)</span></span>
          <div className="text-left">
            <p className="text-sm font-mono font-bold text-emerald-300 tabular-nums">${fmtPrice(data.projectedHigh)}</p>
            <p className="text-[10px] font-mono font-bold text-emerald-400 tabular-nums">+{data.upperPct.toFixed(2)}%</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-3 relative">
          <span className="absolute right-0 top-2 bottom-2 w-[3px] bg-white rounded-full" />
          <span className="text-[10px] text-white/40 pr-4">السعر المتوقع (المتوسط)</span>
          <p className="text-base font-mono font-bold text-white tabular-nums">${fmtPrice(data.expectedPrice)}</p>
        </div>
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-[10px] text-white/40 leading-snug">السعر الأدنى المتوقع<br /><span className="text-white/20">(5th percentile)</span></span>
          <div className="text-left">
            <p className="text-sm font-mono font-bold text-red-300 tabular-nums">${fmtPrice(data.projectedLow)}</p>
            <p className="text-[10px] font-mono font-bold text-red-400 tabular-nums">{data.lowerPct.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Current price chip */}
      <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
        <span className="text-[10px] text-white/25 font-mono">السعر الحالي</span>
        <span className="text-sm font-mono font-bold text-orange-300 tabular-nums">${fmtPrice(data.currentPrice)}</span>
      </div>

      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Linear Regression Card
// ═════════════════════════════════════════════════════════════════════════════

interface LRProps { data: LinearRegressionResult; symbol: string; timeframe: string; }

export function LinearRegressionCard({ data, symbol, timeframe }: LRProps) {
  const trendBadge = data.isTrendUp
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-red-400 border-red-500/30 bg-red-500/[0.08]';
  const trendLabel = data.isTrendUp ? '▲ صاعد' : '▼ هابط';

  return (
    <Shell>
      <Header label="Linear Regression · قناة الانحدار الخطي" symbol={symbol} timeframe={timeframe}
        badge={trendLabel} badgeColor={trendBadge} />

      <div className="mx-4 my-3 rounded-xl border border-white/[0.07] bg-[#0a0a0a] divide-y divide-white/[0.05]" dir="rtl">
        {[
          { ar: 'القناة العلوية (+2σ)',  val: `$${fmtPrice(data.upperChannel)}`, color: 'text-red-300'     },
          { ar: 'قيمة الانحدار الحالية', val: `$${fmtPrice(data.currentFit)}`,   color: 'text-orange-300'  },
          { ar: 'القناة السفلية (-2σ)',  val: `$${fmtPrice(data.lowerChannel)}`, color: 'text-emerald-300' },
        ].map(({ ar, val, color }) => (
          <div key={ar} className="flex items-center justify-between px-3 py-2.5">
            <span className={`text-sm font-mono font-bold tabular-nums ${color}`}>{val}</span>
            <span className="text-[10px] text-white/35">{ar}</span>
          </div>
        ))}
      </div>

      {/* Slope chip */}
      <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
        <span className="text-[10px] text-white/25 font-mono">الميل (Slope / شمعة)</span>
        <span className={`text-sm font-mono font-bold tabular-nums ${data.isTrendUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {data.slope > 0 ? '+' : ''}{data.slope}
        </span>
      </div>

      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Markov Regime Card
// ═════════════════════════════════════════════════════════════════════════════

interface MarkovProps { data: MarkovResult; symbol: string; timeframe: string; }

const REGIME_STYLES: Record<string, { glow: string; text: string; badge: string }> = {
  BULL_VOLATILE: { glow: 'shadow-emerald-500/20', text: 'text-emerald-400', badge: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]' },
  BULL_CALM:     { glow: 'shadow-emerald-500/15', text: 'text-emerald-300', badge: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]' },
  BEAR_VOLATILE: { glow: 'shadow-red-500/20',     text: 'text-red-400',     badge: 'text-red-400 border-red-500/30 bg-red-500/[0.08]'             },
  BEAR_CALM:     { glow: 'shadow-red-500/15',     text: 'text-red-300',     badge: 'text-red-400 border-red-500/30 bg-red-500/[0.08]'             },
  CHOPPY:        { glow: 'shadow-amber-500/15',   text: 'text-amber-400',   badge: 'text-amber-400 border-amber-500/30 bg-amber-500/[0.08]'       },
};

export function MarkovCard({ data, symbol, timeframe }: MarkovProps) {
  const style = REGIME_STYLES[data.regime] ?? REGIME_STYLES.CHOPPY;

  return (
    <Shell>
      <Header label="Markov Model · نظام السوق (HMM Proxy)" symbol={symbol} timeframe={timeframe}
        badge={`${data.probability}% CONF.`} badgeColor={style.badge} />

      {/* Large glowing regime label */}
      <div className={`mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-4 py-6 text-center shadow-lg ${style.glow}`} dir="rtl">
        <p className="text-[9px] text-white/25 uppercase tracking-widest font-mono mb-3">النظام الحالي للسوق</p>
        <p className={`text-2xl font-black ${style.text}`}>{data.regimeAr}</p>
        {/* Probability bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[9px] font-mono text-white/25">
            <span>0%</span><span>احتمالية النظام</span><span>100%</span>
          </div>
          <div className="h-[5px] w-full rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${style.text.replace('text-', 'bg-')}`}
              style={{ width: `${data.probability}%` }}
            />
          </div>
          <p className={`text-lg font-black tabular-nums font-mono ${style.text}`}>{data.probability}%</p>
        </div>
      </div>

      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Fourier Cycle Card
// ═════════════════════════════════════════════════════════════════════════════

interface FourierProps { data: FourierResult; symbol: string; timeframe: string; }

export function FourierCard({ data, symbol, timeframe }: FourierProps) {
  return (
    <Shell>
      <Header label="Fourier Cycle · التحليل الدوري" symbol={symbol} timeframe={timeframe}
        badge="CYCLE ANALYSIS" badgeColor="text-sky-400 border-sky-500/30 bg-sky-500/[0.08]" />

      {/* Cycle stats grid */}
      <div className="mx-4 my-3 grid grid-cols-3 gap-2" dir="rtl">
        {[
          { label: 'الدورة السائدة', value: `${data.dominantCycleBars} شمعة`, color: 'text-orange-300' },
          { label: 'عمر القمة الأخيرة', value: `${data.lastPeakAge} شمعة`,   color: 'text-white/60'   },
          { label: 'القمة التالية ≈',  value: `${data.nextPeakEstimate} شمعة`, color: 'text-sky-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-2 py-3 text-center">
            <p className="text-[9px] text-white/30 font-medium mb-1 leading-tight">{label}</p>
            <p className={`text-xs font-mono font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Visual cycle bar */}
      <div className="mx-4 mb-3" dir="rtl">
        <p className="text-[9px] text-white/25 font-mono mb-1.5 text-right">موضع الدورة الحالية</p>
        <div className="h-[6px] w-full rounded-full bg-white/[0.06] relative">
          <div className="h-full rounded-full bg-sky-500/50"
            style={{ width: `${Math.min(100, (data.lastPeakAge / (data.dominantCycleBars || 1)) * 100)}%` }} />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-sky-400" />
        </div>
        <div className="flex justify-between text-[9px] text-white/20 font-mono mt-1">
          <span>القمة التالية</span>
          <span>القمة السابقة</span>
        </div>
      </div>

      <Verdict text={data.verdict} />
    </Shell>
  );
}
