'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FngEntry { value: string; value_classification: string; timestamp: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const AR_MAP: Record<string, string> = {
  'Extreme Fear': 'خوف شديد', 'Fear': 'خوف',
  'Neutral': 'محايد', 'Greed': 'طمع', 'Extreme Greed': 'طمع شديد',
};
function arLabel(c: string) { return AR_MAP[c] ?? c; }

function gaugeColor(v: number) {
  if (v < 25) return '#ef4444';
  if (v < 45) return '#f97316';
  if (v < 55) return '#eab308';
  if (v < 75) return '#22c55e';
  return '#16a34a';
}

// ── SVG Gauge — TOP semicircle, correct math ────────────────────────────────
// Angles go from -180° (left/9 o'clock) → -90° (top/12 o'clock) → 0° (right/3 o'clock)
// needle formula:  angleRad = ((value/100) - 1) * Math.PI
// zone points:     screenAngle = (-180 + zoneIndex*36) degrees  (−180 → −144 → … → 0)
// arc direction:   sweep-flag = 1 (clockwise in SVG = through the TOP)
function Gauge({ value, label, size = 'compact' }: {
  value: number; label: string; size?: 'compact' | 'full';
}) {
  const color = gaugeColor(value);
  const r  = size === 'full' ? 64 : 38;
  const cx = size === 'full' ? 84 : 50;
  const cy = size === 'full' ? 84 : 50;
  const vw = size === 'full' ? 168 : 100;
  const vh = size === 'full' ?  94 :  58;
  const sw = size === 'full' ? 13  :   9;
  const valFS = size === 'full' ? 24 : 14;
  const labFS = size === 'full' ?  8 :  5;

  // Correct angle: -π (left) → 0 (right), -π/2 = top
  const angleRad = ((value / 100) - 1) * Math.PI;
  const nx = cx + r * Math.cos(angleRad);
  const ny = cy + r * Math.sin(angleRad);

  // 5 zone segments, each 36° wide, from -180° to 0°
  const ZONE_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#16a34a'];
  const toRad = (deg: number) => deg * Math.PI / 180;

  const zonePaths = ZONE_COLORS.map((c, i) => {
    const a1 = -180 + i * 36;       // start deg  (e.g. -180, -144, …)
    const a2 = a1 + 36;             // end deg
    const x1 = cx + r * Math.cos(toRad(a1));
    const y1 = cy + r * Math.sin(toRad(a1));
    const x2 = cx + r * Math.cos(toRad(a2));
    const y2 = cy + r * Math.sin(toRad(a2));
    // small clockwise arc (sweep=1) → traces through TOP
    return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
      fill="none" stroke={c} strokeWidth={sw} strokeLinecap="butt" opacity="0.38" />;
  });

  const svgClass = size === 'compact'
    ? 'w-[100px] overflow-visible mx-auto block'
    : 'w-full overflow-visible';

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className={svgClass}
      aria-label={`Fear & Greed ${value}`}>
      {/* Track */}
      <path
        d={`M ${cx - r + 1} ${cy} A ${r} ${r} 0 0 1 ${cx + r - 1} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.07)"
        strokeWidth={sw} strokeLinecap="round"
      />
      {/* Coloured zones */}
      {zonePaths}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
        stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill={color} />
      <circle cx={cx} cy={cy} r="2" fill="#0a0a0a" />
      {/* Value */}
      <text x={cx} y={cy - (size === 'full' ? 12 : 7)}
        textAnchor="middle" fill="white"
        fontSize={valFS} fontWeight="800" fontFamily="monospace">{value}</text>
      {/* Classification */}
      <text x={cx} y={cy - (size === 'full' ? 2 : 0)}
        textAnchor="middle" fill={color}
        fontSize={labFS} fontWeight="700" letterSpacing="0.5">
        {label.toUpperCase()}
      </text>
    </svg>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
const PERIOD_AR = ['اليوم', 'أمس', 'الأسبوع الماضي'];

function FearGreedModal({ value, classification, history, globalData, onClose }: {
  value: number; classification: string; history: FngEntry[];
  globalData: { totalMarketCap: string; btcDominance: string }; onClose: () => void;
}) {
  const color = gaugeColor(value);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ animation: 'fade-in 0.2s ease forwards' }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl border border-white/[0.08] flex flex-col overflow-hidden"
        style={{ background: 'rgba(8,8,8,0.97)', backdropFilter: 'blur(40px)', maxHeight: '92dvh', animation: 'slide-up 0.32s cubic-bezier(0.16,1,0.3,1) forwards' }}
        dir="rtl">
        <div className="flex justify-center pt-3 shrink-0"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
        <div className="overflow-y-auto px-5 pt-4 pb-8 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-orange-400">نبض السوق والمشاعر</h2>
              <p className="text-sm text-white/40 mt-0.5 leading-relaxed">تحليل شامل يربط بين سيكولوجية المتداولين والمعطيات الفنية</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/[0.06] text-white/40 hover:text-white shrink-0"><X className="w-6 h-6" /></button>
          </div>
          {/* Full gauge */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col items-center">
            <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-3">مؤشر الخوف والطمع الحالي</p>
            <div className="w-52"><Gauge value={value} label={classification} size="full" /></div>
            <p className="text-base font-black mt-2" style={{ color }}>{arLabel(classification)}</p>
          </div>
          {/* Market stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-sm text-white/30 font-mono mb-1">حجم التداول (24h)</p>
              <p className="text-lg font-mono font-black tabular-nums text-white">${globalData.totalMarketCap}</p>
              <p className="text-sm text-white/25 mt-1">إجمالي تداولات السوق</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-sm text-white/30 font-mono mb-1">القيمة السوقية الكلية</p>
              <p className="text-lg font-mono font-black tabular-nums text-orange-400">{globalData.btcDominance}</p>
            </div>
          </div>
          {/* Historical table */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              <TrendingUp className="w-6 h-6 text-orange-500" />
              <p className="text-sm font-bold text-orange-400">السجل التاريخي للمشاعر</p>
            </div>
            <div className="grid grid-cols-3 px-5 py-4 border-b border-white/[0.04]">
              {['الفترة','القراءة','الحالة'].map(h => (
                <p key={h} className="text-sm font-bold text-white/30 text-center">{h}</p>
              ))}
            </div>
            {history.slice(0,3).map((e,i) => {
              const v = parseInt(e.value,10);
              return (
                <div key={i} className={`grid grid-cols-3 px-5 py-4 ${i<2?'border-b border-white/[0.04]':''}`}>
                  <p className="text-sm text-white/70 text-center">{PERIOD_AR[i]}</p>
                  <p className="text-sm font-mono font-black tabular-nums text-center" style={{color:gaugeColor(v)}}>{v}</p>
                  <p className="text-sm text-white/60 text-center">{e.value_classification}</p>
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
export function FearGreedWidget({ globalData = { totalMarketCap:'---', btcDominance:'---' } }:
  { globalData?: { totalMarketCap: string; btcDominance: string } }) {
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
      <button
        onClick={() => setModalOpen(true)}
        className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 flex flex-col items-center w-full active:scale-[0.97] transition-transform hover:border-orange-500/20 h-[148px]"
        dir="rtl"
      >
        <p className="text-sm font-bold text-orange-400 mb-1 self-end">الخوف والطمع</p>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <Gauge value={value} label={classification} size="compact" />
            <p className="text-sm font-black mt-0.5" style={{ color }}>{arLabel(classification)}</p>
          </div>
        )}
      </button>
      {modalOpen && (
        <FearGreedModal value={value} classification={classification}
          history={history} globalData={globalData} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
