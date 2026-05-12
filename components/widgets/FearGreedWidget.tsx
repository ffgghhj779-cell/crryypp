'use client';

import { useEffect, useState } from 'react';

// ── Arabic classification map ─────────────────────────────────────────────────
const AR_MAP: Record<string, string> = {
  'Extreme Fear':  'خوف شديد',
  'Fear':          'خوف',
  'Neutral':       'محايد',
  'Greed':         'طمع',
  'Extreme Greed': 'طمع شديد',
};

function arLabel(classification: string): string {
  return AR_MAP[classification] ?? classification;
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function gaugeColor(v: number): string {
  if (v < 25) return '#ef4444';   // red   — extreme fear
  if (v < 45) return '#f97316';   // orange — fear
  if (v < 55) return '#eab308';   // yellow — neutral
  if (v < 75) return '#22c55e';   // green  — greed
  return '#16a34a';               // dark green — extreme greed
}

// ── Compact SVG Gauge (matches the Dashboard compact prop exactly) ─────────────
function CompactGauge({ value }: { value: number }) {
  const r = 42, cx = 60, cy = 60;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const angle = (value / 100) * 180 - 90;
  const nx = cx + r * Math.cos(toRad(angle));
  const ny = cy + r * Math.sin(toRad(angle));
  const color = gaugeColor(value);
  const sw = 10;

  const zones = [
    { c: '#ef4444', s: 180, e: 144 },
    { c: '#f97316', s: 144, e: 108 },
    { c: '#eab308', s: 108, e:  72 },
    { c: '#22c55e', s:  72, e:  36 },
    { c: '#16a34a', s:  36, e:   0 },
  ];

  return (
    <svg viewBox="0 0 120 70" className="w-full overflow-visible">
      {/* Track */}
      <path
        d={`M ${cx - r + 2} ${cy} A ${r} ${r} 0 0 1 ${cx + r - 2} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} strokeLinecap="round"
      />
      {/* Coloured zones */}
      {zones.map(({ c, s, e }, i) => {
        const x1 = cx + r * Math.cos(toRad(s)), y1 = cy + r * Math.sin(toRad(s));
        const x2 = cx + r * Math.cos(toRad(e)), y2 = cy + r * Math.sin(toRad(e));
        return (
          <path key={i}
            d={`M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`}
            fill="none" stroke={c} strokeWidth={sw} strokeLinecap="butt" opacity="0.30"
          />
        );
      })}
      {/* Needle — animated via CSS transition on the SVG line */}
      <line
        x1={cx} y1={cy} x2={nx} y2={ny}
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        style={{ transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <circle cx={cx} cy={cy} r="5" fill={color} />
      <circle cx={cx} cy={cy} r="2.5" fill="#000" />
      {/* Value text */}
      <text x={cx} y={cy - 11} textAnchor="middle"
        fill="white" fontSize="17" fontWeight="800" fontFamily="monospace">
        {value}
      </text>
      <text x={cx} y={cy - 2} textAnchor="middle"
        fill={color} fontSize="6" fontWeight="700" letterSpacing="0.5">
        NEUTRAL
      </text>
    </svg>
  );
}

// ── Public widget ─────────────────────────────────────────────────────────────
export function FearGreedWidget() {
  const [value,          setValue]          = useState<number>(50);
  const [classification, setClassification] = useState<string>('Neutral');
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res  = await fetch('https://api.alternative.me/fng/?limit=1');
        const json = await res.json();
        if (!cancelled && json?.data?.[0]) {
          setValue(parseInt(json.data[0].value, 10));
          setClassification(json.data[0].value_classification);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const color = gaugeColor(value);

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 flex flex-col items-center" dir="rtl">
      {/* Title */}
      <p className="text-[10px] font-bold text-orange-400 mb-1 self-end">الخوف والطمع</p>

      {loading ? (
        <div className="flex items-center justify-center h-16">
          <span className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        </div>
      ) : error ? (
        <div className="text-[10px] text-red-400 text-center py-4">خطأ في التحميل</div>
      ) : (
        <>
          <CompactGauge value={value} />
          {/* Arabic classification label */}
          <p
            className="text-[11px] font-black mt-1 tabular-nums"
            style={{ color }}
          >
            {arLabel(classification)}
          </p>
        </>
      )}
    </div>
  );
}
