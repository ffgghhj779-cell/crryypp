'use client';

import { useEffect, useState } from 'react';
import { X, BarChart2 } from 'lucide-react';

// ── UTC countdown helpers ─────────────────────────────────────────────────────
function secsUntilMidnightUTC(): number {
  const now = Date.now();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);   // next 00:00 UTC
  return Math.max(0, Math.floor((midnight.getTime() - now) / 1000));
}

function fmt(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ── Arabic day name ───────────────────────────────────────────────────────────
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function dayLabel(unixMs: number): string {
  const d = new Date(unixMs);
  const day = AR_DAYS[d.getUTCDay()];
  const mm  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd  = String(d.getUTCDate()).padStart(2, '0');
  return `${day} (${dd}/${mm})`;
}

// ── Daily close modal ─────────────────────────────────────────────────────────
function DailyCloseModal({ onClose }: { onClose: () => void }) {
  const [rows,    setRows]    = useState<{ label: string; price: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=8')
      .then(r => r.json())
      .then((data: unknown[][]) => {
        if (!cancelled) {
          // data[i] = [openTime, open, high, low, close, ...] — skip the LAST bar (current open candle)
          const closed = data.slice(0, -1).reverse();
          setRows(closed.map(k => ({
            label: dayLabel(Number(k[0])),
            price: '$' + parseFloat(String(k[4])).toLocaleString('en-US', { minimumFractionDigits: 2 }),
          })));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ animation: 'fade-in 0.2s ease forwards' }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative w-full max-w-md rounded-t-3xl border border-white/[0.08] flex flex-col overflow-hidden"
        style={{
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(40px)',
          maxHeight: '88dvh',
          animation: 'slide-up 0.32s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="overflow-y-auto px-5 pt-4 pb-8 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">إحصاءات الإغلاق اليومي</h2>
              <p className="text-[11px] text-white/40 mt-0.5">
                سجل الإغلاقات التاريخية لآخر 7 أيام (توقيت UTC)
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/[0.06] text-white/40 hover:text-white active:scale-95">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <p className="text-[10px] font-bold text-white/40 tracking-wider text-right">اليوم والتاريخ</p>
              <p className="text-[10px] font-bold text-white/40 tracking-wider text-left">سعر الإغلاق</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <span className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              rows.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-2 px-4 py-3.5 ${i < rows.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                >
                  <p className="text-[13px] font-semibold text-white/70 text-right">{row.label}</p>
                  <p className="text-[13px] font-mono font-black tabular-nums text-white text-left">{row.price}</p>
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="flex items-center gap-2 px-1">
            <BarChart2 className="w-3.5 h-3.5 text-white/20" />
            <p className="text-[9px] text-white/25 font-mono">بيانات من Binance · BTCUSDT · Daily (1D)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Public Widget ─────────────────────────────────────────────────────────────
export function DailyCloseWidget() {
  const [secs,      setSecs]      = useState<number>(secsUntilMidnightUTC);
  const [modalOpen, setModalOpen] = useState(false);

  // Sync to top-of-second for perfect accuracy
  useEffect(() => {
    const msToNext = 1000 - (Date.now() % 1000);
    let interval: ReturnType<typeof setInterval>;

    const timeout = setTimeout(() => {
      setSecs(secsUntilMidnightUTC());
      interval = setInterval(() => setSecs(secsUntilMidnightUTC()), 1000);
    }, msToNext);

    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, []);

  const display = fmt(secs);
  const [hh, mm, ss] = display.split(':');

  return (
    <>
      {/* Card */}
      <button
        onClick={() => setModalOpen(true)}
        className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 flex flex-col w-full text-right active:scale-[0.97] transition-transform hover:border-orange-500/20"
        dir="rtl"
        aria-label="الإغلاق اليومي للبيتكوين — اضغط للتفاصيل"
      >
        <p className="text-[10px] font-bold text-orange-400 mb-2">الإغلاق اليومي للبيتكوين</p>

        <div className="flex-1 flex items-center justify-center py-1">
          <span className="font-mono font-black tabular-nums text-white tracking-tight"
            style={{ fontSize: 'clamp(1.4rem, 5.5vw, 1.75rem)' }}>
            {hh}
            <span className="text-white/35">:</span>
            {mm}
            <span className="text-white/35">:</span>
            <span key={ss} className="text-orange-400"
              style={{ animation: 'fade-in 0.15s ease forwards' }}>{ss}</span>
          </span>
        </div>

        <p className="text-[9px] text-white/30 mt-2">متبقي على إغلاق شمعة اليوم</p>
      </button>

      {/* Modal */}
      {modalOpen && <DailyCloseModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
