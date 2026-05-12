'use client';

import type { WyckoffResult, WyckoffPhase } from '@/lib/algorithms/wyckoff';

// ── Phase config ──────────────────────────────────────────────────────────────
const PHASE_CFG: Record<WyckoffPhase, { ar: string; short: string; glow: string; ring: string; text: string; bg: string }> = {
  ACC: { ar: 'تجميع مؤسسي', short: 'ACC',  glow: 'shadow-emerald-500/25', ring: 'stroke-emerald-500',    text: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-400' },
  MRK: { ar: 'صعود ماركب',  short: 'MRK',  glow: 'shadow-sky-500/25',     ring: 'stroke-sky-500',        text: 'text-sky-400',     bg: 'bg-sky-500/20 border-sky-400'         },
  DST: { ar: 'توزيع مؤسسي', short: 'DST',  glow: 'shadow-amber-500/25',   ring: 'stroke-amber-500',      text: 'text-amber-400',   bg: 'bg-amber-500/20 border-amber-400'     },
  MDN: { ar: 'هبوط ماركداون',short: 'MDN', glow: 'shadow-red-500/25',     ring: 'stroke-red-500',        text: 'text-red-400',     bg: 'bg-red-500/20 border-red-400'         },
};

const ALL_PHASES: WyckoffPhase[] = ['MDN','DST','MRK','ACC'];

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { data: WyckoffResult; symbol: string; timeframe: string; }

export function WyckoffCard({ data, symbol, timeframe }: Props) {
  const cfg   = PHASE_CFG[data.phase];
  const R     = 48, cx = 64, cy = 64, sw = 8;
  const circ  = 2 * Math.PI * R;
  const dash  = (data.confidence / 100) * circ;

  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#121212] overflow-hidden space-y-0"
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
    >
      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-[#0f0f0f]">
        <div>
          <p className="text-[9px] text-white/25 uppercase tracking-widest font-mono">Wyckoff · تحليل وايكوف</p>
          <p className="text-white font-bold text-base font-mono">{symbol}</p>
          <p className="text-[10px] text-white/30 font-mono">{timeframe} · 500 شمعة</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.text}`}>
          {cfg.short} · {cfg.ar}
        </span>
      </div>

      {/* ── Circular gauge + Phase tabs ────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-4">
          {/* SVG gauge */}
          <div className={`relative shrink-0 shadow-lg ${cfg.glow}`}>
            <svg width={128} height={128} viewBox="0 0 128 128">
              {/* Background track */}
              <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
              {/* Progress arc */}
              <circle
                cx={cx} cy={cy} r={R} fill="none"
                className={cfg.ring}
                strokeWidth={sw}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(-90 64 64)"
              />
            </svg>
            {/* Inner text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
              <p className={`text-[11px] font-black leading-tight ${cfg.text}`}>{cfg.ar}</p>
              <p className="text-[10px] text-white font-mono font-bold mt-0.5">{data.confidence}%</p>
              <p className="text-[8px] text-white/30 font-mono">CONFIDENCE</p>
            </div>
          </div>

          {/* Phase tabs */}
          <div className="flex-1 grid grid-cols-2 gap-1.5" dir="rtl">
            {ALL_PHASES.map(p => {
              const c = PHASE_CFG[p];
              const isActive = p === data.phase;
              return (
                <div
                  key={p}
                  className={`rounded-xl border px-2 py-2 text-center transition-all ${isActive ? `border-white bg-white/[0.06]` : 'border-white/[0.07] bg-white/[0.02]'}`}
                >
                  <p className={`text-[10px] font-mono font-bold ${isActive ? 'text-white' : 'text-white/30'}`}>{p}</p>
                  <p className={`text-[9px] leading-tight mt-0.5 ${isActive ? c.text : 'text-white/20'}`}>{c.ar}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Effort Analysis ────────────────────────────────────────────────── */}
      <div className="mx-4 mt-3 mb-0" dir="rtl">
        <p className="text-[9px] text-white/25 uppercase tracking-widest font-mono mb-2 text-right">
          تحليل الحجم المتقدم · جهد التداول
        </p>

        {/* Buy bar */}
        <div className="space-y-1.5 mb-2">
          <div className="flex justify-between text-[10px] font-mono font-bold">
            <span className="text-emerald-400 tabular-nums">{data.effort.buyPct}%</span>
            <span className="text-white/30">جهد الشراء (Buy Effort)</span>
          </div>
          <div className="h-[6px] w-full rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${data.effort.buyPct}%` }} />
          </div>
        </div>

        {/* Sell bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono font-bold">
            <span className="text-orange-400 tabular-nums">{data.effort.sellPct}%</span>
            <span className="text-white/30">جهد البيع (Sell Effort)</span>
          </div>
          <div className="h-[6px] w-full rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-orange-500 transition-all duration-700"
              style={{ width: `${data.effort.sellPct}%` }} />
          </div>
        </div>

        {/* Ratio chip + verdict */}
        <div className="flex items-center justify-between mt-2.5 mb-3">
          <p className="text-[11px] text-white/40 text-right leading-snug max-w-[60%]">{data.effort.verdict}</p>
          <div className="text-right">
            <p className="text-[9px] text-white/25 font-mono">النسبة</p>
            <p className={`text-lg font-black tabular-nums font-mono ${data.effort.ratio >= 1.2 ? 'text-emerald-400' : data.effort.ratio <= 0.85 ? 'text-red-400' : 'text-white/60'}`}>
              {data.effort.ratio}x
            </p>
          </div>
        </div>
      </div>

      {/* ── Structure + Volatility grid ────────────────────────────────────── */}
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        {/* Structure */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-3 py-3" dir="rtl">
          <p className="text-[9px] text-orange-500 font-bold uppercase tracking-widest mb-2">STRUCTURE</p>
          {[
            { label: 'الاتجاه',    val: data.structure.trend === 'UPTREND' ? 'صاعد ▲' : data.structure.trend === 'DOWNTREND' ? 'هابط ▼' : 'عرضي ↔', color: data.structure.trend === 'UPTREND' ? 'text-emerald-400' : data.structure.trend === 'DOWNTREND' ? 'text-red-400' : 'text-amber-400' },
            { label: 'قمم أعلى',  val: data.structure.higherHighs ? 'نعم ✓' : 'لا ✗', color: data.structure.higherHighs ? 'text-emerald-300' : 'text-red-300' },
            { label: 'قيعان أعلى',val: data.structure.higherLows  ? 'نعم ✓' : 'لا ✗', color: data.structure.higherLows  ? 'text-emerald-300' : 'text-red-300' },
            { label: 'عرض النطاق', val: `${data.structure.rangeWidthPct}%`, color: 'text-white/60' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex justify-between items-center py-0.5">
              <span className={`text-[10px] font-mono font-bold tabular-nums ${color}`}>{val}</span>
              <span className="text-[9px] text-white/30">{label}</span>
            </div>
          ))}
        </div>

        {/* Volatility */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-3 py-3" dir="rtl">
          <p className="text-[9px] text-orange-500 font-bold uppercase tracking-widest mb-2">VOLATILITY</p>
          {[
            { label: 'ATR الحالي', val: String(data.volatility.atrCurrent), color: 'text-white' },
            { label: 'ATR المتوسط',val: String(data.volatility.atrAvg),     color: 'text-white/60' },
            { label: 'النسبة',     val: `${data.volatility.atrRatio}x`,    color: data.volatility.atrRatio >= 1.3 ? 'text-red-400' : data.volatility.atrRatio <= 0.75 ? 'text-sky-400' : 'text-white/60' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex justify-between items-center py-0.5">
              <span className={`text-[10px] font-mono font-bold tabular-nums ${color}`}>{val}</span>
              <span className="text-[9px] text-white/30">{label}</span>
            </div>
          ))}
          <p className="text-[9px] text-white/35 leading-tight mt-1.5 text-right">{data.volatility.verdict}</p>
        </div>
      </div>

      {/* ── Conclusion ────────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3" dir="rtl">
        <div className={`rounded-xl border-r-2 border px-3 py-3 ${cfg.bg.replace('bg-','border-').replace('/20','')}`}
          style={{ borderColor: undefined, borderRightColor: undefined }}>
          <div className={`rounded-xl border-r-2 border-white/[0.05] bg-[#0a0a0a] px-3 py-3`}
            style={{ borderRightColor: cfg.text.replace('text-','').includes('emerald') ? '#10b981' : cfg.text.includes('sky') ? '#0ea5e9' : cfg.text.includes('amber') ? '#f59e0b' : '#ef4444', borderRightWidth: 2 }}>
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${cfg.text}`}>CONCLUSION · الاستنتاج</p>
            <p className="text-[11px] text-white/55 leading-relaxed text-right">{data.conclusion}</p>
          </div>
        </div>
      </div>

      {/* ── Reading Guide ─────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-4" dir="rtl">
        <div className="rounded-xl border border-white/[0.05] bg-[#0a0a0a] px-3 py-3 border-r-2 border-r-orange-500">
          <p className="text-[10px] leading-relaxed text-right text-white/40">
            <span className="text-orange-500 font-bold">دليل القراءة: </span>
            <span className="text-white/60 font-bold">ACC (تجميع)</span> = المؤسسات تشتري بهدوء.{' '}
            <span className="text-white/60 font-bold">MRK (صعود)</span> = موجة ترقي مؤسسية.{' '}
            <span className="text-white/60 font-bold">DST (توزيع)</span> = المؤسسات تبيع على الجمهور.{' '}
            <span className="text-white/60 font-bold">MDN (هبوط)</span> = موجة تصفية حادة.
            الثقة (Confidence) تعكس قوة الإشارة المركّبة من الجهد والتذبذب والهيكل.
          </p>
        </div>
      </div>
    </div>
  );
}
