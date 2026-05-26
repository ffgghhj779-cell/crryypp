'use client';

import type {
  DoublePatternResult, CupHandleResult, HSResult,
  TriangleResult, MarketStructureResult,
} from '@/lib/algorithms/classicPatterns';

function fmtPrice(n: number): string {
  if (!n) return '—';
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

function PriceRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5" dir="rtl">
      <span className={`text-sm font-mono font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-white/35">{label}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Double Pattern Card
// ═════════════════════════════════════════════════════════════════════════════

interface DoubleProps { data: DoublePatternResult; symbol: string; timeframe: string; }

export function DoublePatternCard({ data, symbol, timeframe }: DoubleProps) {
  const isTop   = data.type === 'DOUBLE_TOP';
  const badgeColor = !data.detected
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isTop
    ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]';
  const badge = !data.detected ? 'NO PATTERN' : isTop ? '▼ DOUBLE TOP' : '▲ DOUBLE BOTTOM';

  return (
    <Shell>
      <Header label="Double Pattern · القمتان / القاعان" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />
      {!data.detected ? <EmptyState text="لم يُرصد نموذج قمتين أو قاعين." /> : (
        <>
          <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.05]">
            <PriceRow label="النقطة الأولى"  value={`$${fmtPrice(data.level1)}`}   color={isTop ? 'text-red-300' : 'text-emerald-300'} />
            <PriceRow label="النقطة الثانية" value={`$${fmtPrice(data.level2)}`}   color={isTop ? 'text-red-300' : 'text-emerald-300'} />
            <PriceRow label="خط العنق"        value={`$${fmtPrice(data.neckline)}`} color="text-orange-300" />
            <PriceRow label="الهدف المتوقع"   value={`$${fmtPrice(data.target)}`}   color={isTop ? 'text-red-400' : 'text-emerald-400'} />
          </div>
          <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
            <span className="text-[10px] text-white/25">الثقة</span>
            <span className="text-sm font-mono font-bold text-orange-300">{data.confidence}%</span>
          </div>
        </>
      )}
      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Cup & Handle Card
// ═════════════════════════════════════════════════════════════════════════════

interface CupProps { data: CupHandleResult; symbol: string; timeframe: string; }

export function CupHandleCard({ data, symbol, timeframe }: CupProps) {
  const badgeColor = data.detected
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-white/30 border-white/[0.08] bg-white/[0.02]';

  return (
    <Shell>
      <Header label="Cup & Handle · الكوب والمقبض" symbol={symbol} timeframe={timeframe}
        badge={data.detected ? '▲ CUP & HANDLE' : 'NO PATTERN'} badgeColor={badgeColor} />
      {!data.detected ? <EmptyState text="لم يُرصد نموذج الكوب والمقبض." /> : (
        <>
          <div className="mx-4 my-3 grid grid-cols-2 gap-2" dir="rtl">
            {[
              { label: 'عمق الكوب',    value: `${data.cupDepthPct}%`,    color: 'text-sky-300' },
              { label: 'عمق المقبض',   value: `${data.handleDepthPct}%`, color: 'text-violet-300' },
              { label: 'مستوى الحافة', value: `$${fmtPrice(data.rimLevel)}`, color: 'text-orange-300' },
              { label: 'الهدف',        value: `$${fmtPrice(data.target)}`,   color: 'text-emerald-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-3 text-right">
                <p className="text-[9px] text-white/30 mb-1">{label}</p>
                <p className={`text-sm font-mono font-bold tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
            <span className="text-[10px] text-white/25">الثقة</span>
            <span className="text-sm font-mono font-bold text-orange-300">{data.confidence}%</span>
          </div>
        </>
      )}
      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Head & Shoulders Card
// ═════════════════════════════════════════════════════════════════════════════

interface HSProps { data: HSResult; symbol: string; timeframe: string; }

export function HeadShouldersCard({ data, symbol, timeframe }: HSProps) {
  const isInverse  = data.type === 'INVERSE';
  const badgeColor = !data.detected
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isInverse
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : 'text-red-400 border-red-500/30 bg-red-500/[0.08]';
  const badge = !data.detected ? 'NO PATTERN' : isInverse ? '▲ INVERSE H&S' : '▼ HEAD & SHOULDERS';

  return (
    <Shell>
      <Header label="Head & Shoulders · الرأس والكتفان" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />
      {!data.detected ? <EmptyState text="لم يُرصد نموذج الرأس والكتفين." /> : (
        <>
          <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.05]">
            <PriceRow label="الكتف الأيسر"  value={`$${fmtPrice(data.leftShoulder)}`}  color="text-white/60" />
            <PriceRow label="الرأس"          value={`$${fmtPrice(data.head)}`}           color={isInverse ? 'text-emerald-300' : 'text-red-300'} />
            <PriceRow label="الكتف الأيمن"  value={`$${fmtPrice(data.rightShoulder)}`}  color="text-white/60" />
            <PriceRow label="خط العنق"       value={`$${fmtPrice(data.neckline)}`}       color="text-orange-300" />
            <PriceRow label="الهدف المتوقع"  value={`$${fmtPrice(data.target)}`}         color={isInverse ? 'text-emerald-400' : 'text-red-400'} />
          </div>
          <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
            <span className="text-[10px] text-white/25">الثقة</span>
            <span className="text-sm font-mono font-bold text-orange-300">{data.confidence}%</span>
          </div>
        </>
      )}
      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Triangle Card
// ═════════════════════════════════════════════════════════════════════════════

interface TriangleProps { data: TriangleResult; symbol: string; timeframe: string; }

export function TriangleCard({ data, symbol, timeframe }: TriangleProps) {
  const isBull = data.bias === 'BULLISH', isBear = data.bias === 'BEARISH';
  const badgeColor = !data.detected
    ? 'text-white/30 border-white/[0.08] bg-white/[0.02]'
    : isBull ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : isBear ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-amber-400 border-amber-500/30 bg-amber-500/[0.08]';
  const badge = !data.detected ? 'NO PATTERN' : `△ ${data.type}`;

  return (
    <Shell>
      <Header label="Triangle Predictor · المثلثات" symbol={symbol} timeframe={timeframe} badge={badge} badgeColor={badgeColor} />
      {!data.detected ? <EmptyState text="لم يُرصد نموذج مثلث واضح." /> : (
        <>
          <div className="mx-4 my-3 grid grid-cols-3 gap-2" dir="rtl">
            {[
              { label: 'النوع',           value: data.typeAr.split(' (')[0], color: 'text-white' },
              { label: 'الذروة (شمعة)',   value: `${data.apexBars}`,         color: 'text-orange-300' },
              { label: 'التحيّز',         value: isBull ? 'صعودي' : isBear ? 'هبوطي' : 'محايد', color: isBull ? 'text-emerald-300' : isBear ? 'text-red-300' : 'text-amber-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-2 py-3 text-center">
                <p className="text-[9px] text-white/30 mb-1">{label}</p>
                <p className={`text-xs font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mx-4 mb-3 flex justify-between items-center" dir="rtl">
            <span className="text-[10px] text-white/25">الثقة</span>
            <span className="text-sm font-mono font-bold text-orange-300">{data.confidence}%</span>
          </div>
        </>
      )}
      <Verdict text={data.verdict} />
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Market Structure Card
// ═════════════════════════════════════════════════════════════════════════════

interface MSProps { data: MarketStructureResult; symbol: string; timeframe: string; }

export function MarketStructureCard({ data, symbol, timeframe }: MSProps) {
  const isBull = data.bias === 'BULLISH', isBear = data.bias === 'BEARISH';
  const trendColor = isBull ? 'text-emerald-400' : isBear ? 'text-red-400' : 'text-amber-400';
  const badgeColor = isBull
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08]'
    : isBear
    ? 'text-red-400 border-red-500/30 bg-red-500/[0.08]'
    : 'text-amber-400 border-amber-500/30 bg-amber-500/[0.08]';
  const trendAr = data.trend === 'UPTREND' ? '▲ UPTREND · صاعد' : data.trend === 'DOWNTREND' ? '▼ DOWNTREND · هابط' : '◎ RANGING · عرضي';

  return (
    <Shell>
      <Header label="Market Structure · BOS & CHoCH" symbol={symbol} timeframe={timeframe} badge={trendAr} badgeColor={badgeColor} />

      {/* Big trend label */}
      <div className="px-4 py-4 text-center border-b border-white/[0.05]">
        <p className={`text-2xl font-black font-mono ${trendColor}`}>
          {data.trend === 'UPTREND' ? 'اتجاه صاعد' : data.trend === 'DOWNTREND' ? 'اتجاه هابط' : 'سوق عرضي'}
        </p>
        <p className="text-[10px] text-orange-400 font-bold mt-1">{data.lastEventAr}</p>
      </div>

      {/* Swing levels */}
      <div className="mx-4 my-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] divide-y divide-white/[0.05]">
        <PriceRow label="قمة الأمد القريب (Swing High)" value={`$${fmtPrice(data.swingHigh)}`} color="text-red-300" />
        <PriceRow label="قاع الأمد القريب (Swing Low)"  value={`$${fmtPrice(data.swingLow)}`}  color="text-emerald-300" />
      </div>

      <Verdict text={data.verdict} />
    </Shell>
  );
}
