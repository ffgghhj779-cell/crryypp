'use client';

import type { PatternResult } from '@/lib/algorithms/patterns';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  data:   PatternResult;
  symbol: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WedgeResultCard({ data, symbol }: Props) {
  const isBullish  = data.type === 'FALLING'; // falling wedge = bullish reversal
  const accentText = isBullish ? 'text-emerald-400' : data.type === 'RISING' ? 'text-red-400' : 'text-white/50';
  const accentBorder = isBullish ? 'border-emerald-500/30' : data.type === 'RISING' ? 'border-red-500/30' : 'border-white/[0.06]';

  const typeLabel = data.type === 'RISING'
    ? 'وتد صاعد (Rising Wedge) — انعكاسي هبوطي ↓'
    : data.type === 'FALLING'
    ? 'وتد هابط (Falling Wedge) — انعكاسي صعودي ↑'
    : null;

  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#121212] overflow-hidden space-y-0"
      style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-[#0f0f0f]">
        <div>
          <p className="text-sm text-white/25 uppercase tracking-widest font-mono">Wedge Scanner · النماذج الكلاسيكية</p>
          <p className="text-white font-bold text-lg font-mono">{symbol}</p>
          <p className="text-sm text-white/30 font-mono mt-0.5">4H · 400 شمعة</p>
        </div>
        <div className="text-right">
          {data.detected ? (
            <span className={`text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${accentBorder} ${accentText}`}>
              {data.type === 'RISING' ? '▽ RISING WEDGE' : '△ FALLING WEDGE'}
            </span>
          ) : (
            <span className="text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-white/[0.08] text-white/30">
              NO PATTERN
            </span>
          )}
        </div>
      </div>

      {/* ── Main Box ────────────────────────────────────────────────────────── */}
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
                <p className="text-base font-mono font-bold text-orange-400 tabular-nums">{data.confidence}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-white/25 font-mono uppercase tracking-wider mb-1">Apex (bars)</p>
                <p className="text-base font-mono font-bold text-white tabular-nums">{data.apexEstimate}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-white/25 font-mono uppercase tracking-wider mb-1">Pivots</p>
                <p className="text-base font-mono font-bold text-white tabular-nums">
                  {(data.swingHighs?.length ?? 0) + (data.swingLows?.length ?? 0)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/70 text-lg font-medium">لم يرصد وتد.</p>
        )}
      </div>

      {/* ── Verdict Box ─────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-5 py-4" dir="rtl">
        <p className="text-sm text-orange-500 font-bold uppercase tracking-widest text-right mb-2">
          WEDGE VERDICT
        </p>
        {data.detected ? (
          <p className={`text-base font-bold text-center ${accentText}`}>{typeLabel}</p>
        ) : (
          <p className="text-white/60 text-base text-center">لم يرصد وتد.</p>
        )}
      </div>

      {/* ── Reading Guide ────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-4" dir="rtl">
        <div className="rounded-xl border border-white/[0.05] bg-[#0a0a0a] px-3 py-4 border-r-2 border-r-orange-500">
          <p className="text-sm leading-relaxed text-right text-white/45">
            <span className="text-orange-500 font-bold">دليل القراءة: </span>
            الوتد الصاعد (Rising Wedge) = انعكاسي هبوطي.{' '}
            الوتد الهابط (Falling Wedge) = انعكاسي صعودي.{' '}
            <span className="text-white/60">U = نقاط ارتكاز علوية.</span>{' '}
            <span className="text-white/60">L = سفلية.</span>{' '}
            الحجم المتناقص = تأكيد كلاسيكي.{' '}
            <span className="text-white/60">CONFIRM = سعر تفعيل النموذج.</span>{' '}
            هذا تحليل فني موضوعي، ولا يُعتبر توصية شراء أو بيع.
          </p>
        </div>
      </div>
    </div>
  );
}
