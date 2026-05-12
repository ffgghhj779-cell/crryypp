'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FngEntry { value: string; value_classification: string; timestamp: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const AR_MAP: Record<string, string> = {
  'Extreme Fear':  'خوف شديد',
  'Fear':          'خوف',
  'Neutral':       'محايد',
  'Greed':         'طمع',
  'Extreme Greed': 'طمع شديد',
};
function arLabel(c: string) { return AR_MAP[c] ?? c; }

function gaugeColor(v: number) {
  if (v < 25) return '#ef4444';
  if (v < 45) return '#f97316';
  if (v < 55) return '#eab308';
  if (v < 75) return '#22c55e';
  return '#16a34a';
}

const ZONES = [
  { c: '#ef4444', s: 180, e: 144 },
  { c: '#f97316', s: 144, e: 108 },
  { c: '#eab308', s: 108, e:  72 },
  { c: '#22c55e', s:  72, e:  36 },
  { c: '#16a34a', s:  36, e:   0 },
];

// ── SVG Gauge (size prop: 'compact' | 'full') ──────────────────────────────
function Gauge({ value, label, size = 'compact' }: { value: number; label: string; size?: 'compact' | 'full' }) {
  const color = gaugeColor(value);
  const r  = size === 'full' ? 68 : 42;
  const cx = size === 'full' ? 90 : 60;
  const cy = size === 'full' ? 90 : 60;
  const vw = size === 'full' ? 180 : 120;
  const vh = size === 'full' ? 105 : 70;
  const sw = size === 'full' ? 14  : 10;
  const valFS  = size === 'full' ? 26 : 16;
  const labFS  = size === 'full' ? 9  : 6;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const angle = (value / 100) * 180 - 90;
  const nx = cx + r * Math.cos(toRad(angle));
  const ny = cy + r * Math.sin(toRad(angle));

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full overflow-visible" aria-label={`Fear & Greed: ${value} ${label}`}>
      {/* Track */}
      <path
        d={`M ${cx - r + 2} ${cy} A ${r} ${r} 0 0 1 ${cx + r - 2} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} strokeLinecap="round"
      />
      {/* Coloured zones */}
      {ZONES.map(({ c, s, e }, i) => {
        const x1 = cx + r * Math.cos(toRad(s)), y1 = cy + r * Math.sin(toRad(s));
        const x2 = cx + r * Math.cos(toRad(e)), y2 = cy + r * Math.sin(toRad(e));
        return (
          <path key={i}
            d={`M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`}
            fill="none" stroke={c} strokeWidth={sw} strokeLinecap="butt" opacity="0.35"
          />
        );
      })}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
        stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={color} />
      <circle cx={cx} cy={cy} r="2.5" fill="#0a0a0a" />
      {/* Value */}
      <text x={cx} y={cy - (size === 'full' ? 16 : 10)}
        textAnchor="middle" fill="white"
        fontSize={valFS} fontWeight="800" fontFamily="monospace">
        {value}
      </text>
      {/* Label */}
      <text x={cx} y={cy - (size === 'full' ? 4 : 1)}
        textAnchor="middle" fill={color}
        fontSize={labFS} fontWeight="700" letterSpacing="0.8">
        {label.toUpperCase()}
      </text>
    </svg>
  );
}

// ── Arabic period name ─────────────────────────────────────────────────────────
const PERIOD_LABELS = ['اليوم', 'أمس', 'الأسبوع الماضي'];

// ── Modal ─────────────────────────────────────────────────────────────────────
function FearGreedModal({
  value, classification, history, globalData, onClose,
}: {
  value: number;
  classification: string;
  history: FngEntry[];
  globalData: { totalMarketCap: string; btcDominance: string };
  onClose: () => void;
}) {
  const color = gaugeColor(value);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ animation: 'fade-in 0.2s ease forwards' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md rounded-t-3xl border border-white/[0.08] flex flex-col overflow-hidden"
        style={{
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(40px)',
          maxHeight: '92dvh',
          animation: 'slide-up 0.32s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 pt-4 pb-8 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-orange-400">نبض السوق والمشاعر</h2>
              <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
                تحليل شامل يربط بين سيكولوجية المتداولين والمعطيات الفنية
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/[0.06] text-white/40 hover:text-white active:scale-95">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Large gauge */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col items-center">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">
              مؤشر الخوف والطمع الحالي
            </p>
            <div className="w-56">
              <Gauge value={value} label={classification} size="full" />
            </div>
            <p className="text-base font-black mt-1" style={{ color }}>
              {arLabel(classification)}
            </p>
          </div>

          {/* Market stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[9px] text-white/30 font-mono tracking-widest mb-1">حجم التداول (24h)</p>
              <p className="text-lg font-mono font-black tabular-nums text-white">
                ${globalData.totalMarketCap}
              </p>
              <p className="text-[9px] text-white/30 mt-1">إجمالي تداولات السوق</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[9px] text-white/30 font-mono tracking-widest mb-1">القيمة السوقية الكلية</p>
              <p className="text-lg font-mono font-black tabular-nums text-orange-400">
                {globalData.btcDominance}
              </p>
            </div>
          </div>

          {/* Historical table */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <p className="text-[11px] font-bold text-orange-400">السجل التاريخي للمشاعر</p>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-3 px-4 py-2 border-b border-white/[0.04]">
              {['الفترة', 'القراءة', 'الحالة'].map(h => (
                <p key={h} className="text-[9px] font-bold text-white/30 uppercase tracking-wider text-center">{h}</p>
              ))}
            </div>

            {/* Rows */}
            {history.slice(0, 3).map((e, i) => {
              const v = parseInt(e.value, 10);
              const c = gaugeColor(v);
              return (
                <div key={i} className={`grid grid-cols-3 px-4 py-3 ${i < 2 ? 'border-b border-white/[0.04]' : ''}`}>
                  <p className="text-[11px] text-white/70 text-center">{PERIOD_LABELS[i]}</p>
                  <p className="text-[11px] font-mono font-black tabular-nums text-center" style={{ color: c }}>{v}</p>
                  <p className="text-[10px] text-white/60 text-center">{e.value_classification}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Public Widget ─────────────────────────────────────────────────────────────
export function FearGreedWidget({
  globalData = { totalMarketCap: '---', btcDominance: '---' },
}: {
  globalData?: { totalMarketCap: string; btcDominance: string };
}) {
  const [value,          setValue]          = useState<number>(50);
  const [classification, setClassification] = useState<string>('Neutral');
  const [history,        setHistory]        = useState<FngEntry[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [modalOpen,      setModalOpen]      = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('https://api.alternative.me/fng/?limit=7')
      .then(r => r.json())
      .then(json => {
        if (!cancelled && json?.data?.length) {
          setValue(parseInt(json.data[0].value, 10));
          setClassification(json.data[0].value_classification);
          setHistory(json.data);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const color = gaugeColor(value);

  return (
    <>
      {/* Card */}
      <button
        onClick={() => setModalOpen(true)}
        className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 flex flex-col items-center w-full text-right active:scale-[0.97] transition-transform hover:border-orange-500/20"
        dir="rtl"
        aria-label="الخوف والطمع — اضغط للتفاصيل"
      >
        <p className="text-[10px] font-bold text-orange-400 mb-1 self-end">الخوف والطمع</p>

        {loading ? (
          <div className="flex items-center justify-center h-16">
            <span className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <div className="w-full">
              <Gauge value={value} label={classification} size="compact" />
            </div>
            <p className="text-[11px] font-black mt-0.5 tabular-nums" style={{ color }}>
              {arLabel(classification)}
            </p>
          </>
        )}
      </button>

      {/* Modal */}
      {modalOpen && (
        <FearGreedModal
          value={value}
          classification={classification}
          history={history}
          globalData={globalData}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
