'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { computeGann, GannResult, GannPointWithMeta } from '@/lib/algorithms/gann';
import { ShieldAlert, AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronRight, ArrowRight } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Asset = 'BTC' | 'GOLD' | 'OIL' | 'USDEGP' | 'EGYXAU';
type ViewMode = 'wheel' | 'month_days';

interface OHLCBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface DayAnalytics {
  date: string;         // e.g. "25 مايو"
  dayIndex: number;     // 0-based index in month
  open: number;
  high: number;
  low: number;
  close: number;
  priceMagnitude: number;  // |High - Low|
  status: 'قمة' | 'قاع' | 'عادي';
  statusColor: string;
}

// ─── Arabic month names ────────────────────────────────────────────────────────

const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Binance-compatible fetch ──────────────────────────────────────────────────

/** Maps internal Asset key to API symbol */
const ASSET_SYMBOL: Record<Asset, string> = {
  BTC:    'BTCUSDT',
  GOLD:   'XAUUSD',
  OIL:    'WTIUSD',
  USDEGP: 'USDEGP',
  EGYXAU: 'EGYXAU',
};

/** Commodity symbols (not on Binance — use /api/klines) */
const COMMODITY_ASSETS = new Set<Asset>(['GOLD', 'OIL', 'USDEGP', 'EGYXAU']);

async function fetchDailyBars(asset: Asset, year: number, month: number): Promise<OHLCBar[]> {
  const symbol = ASSET_SYMBOL[asset];

  // ── Commodity path: use /api/klines (Twelve Data / GBM) ──────────────
  if (COMMODITY_ASSETS.has(asset)) {
    try {
      // Request enough bars to cover the past 2 years
      const params = new URLSearchParams({ symbol, interval: '1d', limit: '730' });
      const res = await fetch(`/api/klines?${params}`, { cache: 'no-store' });
      if (!res.ok) return [];
      const bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = await res.json();
      // Filter to the requested month
      const startTs = new Date(year, month, 1).getTime() / 1000;
      const endTs   = new Date(year, month + 1, 1).getTime() / 1000;
      return bars
        .filter(b => b.time >= startTs && b.time < endTs)
        .map(b => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume }));
    } catch { return []; }
  }

  // ── Binance path (crypto) ──────────────────────────────────────
  const start = new Date(year, month, 1).getTime();
  const end   = new Date(year, month + 1, 1).getTime();
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${start}&endTime=${end}&limit=35`;
  try {
    const res  = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const raw: any[][] = await res.json();
    return raw.map(k => ({ t: k[0] / 1000, o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) }));
  } catch { return []; }
}

// ─── Peak / Trough Detector ────────────────────────────────────────────────────
// Uses ±1 surrounding bar comparison (simple but effective for daily data)

function detectPeakTrough(bars: OHLCBar[], idx: number): 'قمة' | 'قاع' | 'عادي' {
  if (bars.length < 3) return 'عادي';
  const prev = bars[idx - 1];
  const curr = bars[idx];
  const next = bars[idx + 1];
  if (!prev || !next) return 'عادي';

  const isPeak   = curr.h > prev.h && curr.h > next.h;
  const isTrough = curr.l < prev.l && curr.l < next.l;

  if (isPeak && isTrough) return 'عادي'; // ambiguous
  if (isPeak)   return 'قمة';
  if (isTrough) return 'قاع';
  return 'عادي';
}

function buildDayAnalytics(bars: OHLCBar[], year: number, month: number): DayAnalytics[] {
  return bars.map((bar, i) => {
    const date    = new Date(bar.t * 1000);
    const dayNum  = date.getDate();
    const status  = detectPeakTrough(bars, i);
    const statusColor =
      status === 'قمة' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : status === 'قاع' ? 'text-red-400 border-red-500/40 bg-red-500/10'
      : 'text-white/40 border-white/10 bg-white/5';

    return {
      date:          `${dayNum} ${MONTHS_AR[month]}`,
      dayIndex:      i,
      open:          bar.o,
      high:          bar.h,
      low:           bar.l,
      close:         bar.c,
      priceMagnitude: bar.h - bar.l,
      status,
      statusColor,
    };
  });
}

// ─── Asset Toggle ─────────────────────────────────────────────────────────────

/** Price formatter per asset */
function fmtAssetPrice(n: number, asset: Asset): string {
  switch (asset) {
    case 'BTC':    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'GOLD':   return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'OIL':    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'USDEGP': return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} جنيه`;
    case 'EGYXAU': return `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} جنيه/جرام`;
    default:       return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

/** Asset label in Arabic */
const ASSET_LABEL: Record<Asset, string> = {
  BTC:    'بيتكوين BTC',
  GOLD:   'ذهب XAU',
  OIL:    'نفط WTI',
  USDEGP: 'دولار/جنيه',
  EGYXAU: 'ذهب مصري',
};

/** Color theme per asset */
const ASSET_COLOR: Record<Asset, { active: string; text: string }> = {
  BTC:    { active: 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]',  text: 'text-orange-400' },
  GOLD:   { active: 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)]',   text: 'text-yellow-400' },
  OIL:    { active: 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]',    text: 'text-blue-400' },
  USDEGP: { active: 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]', text: 'text-emerald-400' },
  EGYXAU: { active: 'bg-amber-600 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]',   text: 'text-amber-400' },
};

function AssetToggle({ asset, onChange }: { asset: Asset; onChange: (a: Asset) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {(['BTC', 'GOLD', 'OIL', 'USDEGP', 'EGYXAU'] as Asset[]).map(a => (
        <button
          key={a}
          onClick={() => onChange(a)}
          className={`px-4 py-2 rounded-xl text-sm font-black tracking-wide transition-all duration-200 border ${
            asset === a
              ? ASSET_COLOR[a].active + ' border-transparent'
              : 'text-white/40 border-white/10 hover:text-white/70 hover:border-white/20'
          }`}
        >
          {ASSET_LABEL[a]}
        </button>
      ))}
    </div>
  );
}

// ─── Gann Wheel SVG ───────────────────────────────────────────────────────────

function GannWheelSvg({
  result,
  selectedMonth,
  onMonthClick,
}: {
  result: GannResult;
  selectedMonth: number | null;
  onMonthClick: (m: number) => void;
}) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 130;
  const monthR = 105;
  const innerR = 75;
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Rings */}
      <circle cx={cx} cy={cy} r={outerR} fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={monthR} fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 5" />
      <circle cx={cx} cy={cy} r={innerR} fill="#0a0a0a" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* Month segments — clickable */}
      {MONTHS_SHORT.map((m, i) => {
        const startDeg = (i / 12) * 360;
        const endDeg   = ((i + 1) / 12) * 360;
        const midDeg   = startDeg + 15;
        const isSelected = selectedMonth === i;

        // Segment arc path
        const r1 = innerR + 2;
        const r2 = monthR - 2;
        const startRad = toRad(startDeg);
        const endRad   = toRad(endDeg);
        const x1 = cx + r2 * Math.cos(startRad);
        const y1 = cy + r2 * Math.sin(startRad);
        const x2 = cx + r2 * Math.cos(endRad);
        const y2 = cy + r2 * Math.sin(endRad);
        const x3 = cx + r1 * Math.cos(endRad);
        const y3 = cy + r1 * Math.sin(endRad);
        const x4 = cx + r1 * Math.cos(startRad);
        const y4 = cy + r1 * Math.sin(startRad);

        // Label
        const lRad = toRad(midDeg);
        const lr   = (r1 + r2) / 2;
        const lx   = cx + lr * Math.cos(lRad);
        const ly   = cy + lr * Math.sin(lRad);

        const isCurrentMonth = new Date().getMonth() === i;

        return (
          <g
            key={m}
            onClick={() => onMonthClick(i)}
            className="cursor-pointer"
            role="button"
            aria-label={`${MONTHS_AR[i]} — انقر للتفاصيل`}
          >
            <path
              d={`M ${x1} ${y1} A ${r2} ${r2} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 0 0 ${x4} ${y4} Z`}
              fill={
                isSelected
                  ? 'rgba(249,115,22,0.25)'
                  : isCurrentMonth
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(255,255,255,0.01)'
              }
              stroke={
                isSelected
                  ? 'rgba(249,115,22,0.7)'
                  : isCurrentMonth
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(255,255,255,0.04)'
              }
              strokeWidth={isSelected ? '1.5' : '0.5'}
              className="transition-all duration-200 hover:fill-[rgba(255,255,255,0.07)]"
            />
            <text
              x={lx}
              y={ly}
              fill={
                isSelected
                  ? '#f97316'
                  : isCurrentMonth
                  ? 'rgba(255,255,255,0.7)'
                  : 'rgba(255,255,255,0.25)'
              }
              fontSize={isSelected ? '8.5' : '7.5'}
              fontFamily="monospace"
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight={isSelected ? 'bold' : 'normal'}
            >
              {m}
            </text>
          </g>
        );
      })}

      {/* Outer Gann Points */}
      {result.points.map((p, i) => {
        const rad   = toRad(p.angle);
        const x     = cx + outerR * Math.cos(rad);
        const y     = cy + outerR * Math.sin(rad);
        const isMaj = p.type === 'major';
        const color = isMaj ? '#f97316' : '#a8a29e';

        return (
          <g key={i}>
            <line
              x1={cx + monthR * Math.cos(rad)}
              y1={cy + monthR * Math.sin(rad)}
              x2={x} y2={y}
              stroke={color}
              strokeWidth="1"
              opacity={isMaj ? 0.5 : 0.2}
            />
            <circle cx={x} cy={y} r={isMaj ? 5 : 3} fill={color} />
            {isMaj && (
              <circle cx={x} cy={y} r={10} fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
            )}
          </g>
        );
      })}

      {/* Today's Needle */}
      <motion.g
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: result.todayAngle, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 40, delay: 0.5 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <line
          x1={cx} y1={cy - innerR + 8}
          x2={cx} y2={cy - outerR - 5}
          stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"
        />
        <circle cx={cx} cy={cy - outerR - 5} r="4" fill="#38bdf8" />
        <path
          d={`M ${cx - 4} ${cy - innerR + 8} L ${cx + 4} ${cy - innerR + 8} L ${cx} ${cy - innerR + 18} Z`}
          fill="#38bdf8"
        />
      </motion.g>

      {/* Center */}
      <circle cx={cx} cy={cy} r={24} fill="rgba(56,189,248,0.05)" />
      <text x={cx} y={cy - 5} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace" textAnchor="middle">اليوم</text>
      <text x={cx} y={cy + 7} fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
        {new Date().getDate()}/{new Date().getMonth() + 1}
      </text>
    </svg>
  );
}

// ─── Day Analytics Card ────────────────────────────────────────────────────────

function DayCard({ day, asset }: { day: DayAnalytics; asset: Asset }) {
  const fmt = (n: number) => fmtAssetPrice(n, asset);

  const isUp = day.close >= day.open;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 flex flex-col gap-3"
      dir="rtl"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white/80">{day.date}</span>
        <div className="flex items-center gap-1.5">
          {/* Status badge */}
          {day.status !== 'عادي' && (
            <span className={`text-sm font-black px-2 py-0.5 rounded-full border ${day.statusColor}`}>
              {day.status === 'قمة' ? '▲ قمة' : '▼ قاع'}
            </span>
          )}
          {/* Direction */}
          {isUp
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          }
        </div>
      </div>

      {/* Price magnitude */}
      <div className="bg-white/[0.04] rounded-lg px-3 py-4 text-center">
        <p className="text-sm text-white/40 uppercase tracking-widest mb-0.5">حركة السعر</p>
        <p className={`text-base font-black ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {fmt(day.priceMagnitude)} دولار
        </p>
      </div>

      {/* OHLC mini row */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'فتح', value: fmt(day.open), color: 'text-white/60' },
          { label: 'أعلى', value: fmt(day.high), color: 'text-emerald-400' },
          { label: 'أدنى', value: fmt(day.low),  color: 'text-red-400' },
          { label: 'إغلاق', value: fmt(day.close), color: isUp ? 'text-emerald-400' : 'text-red-400' },
        ].map(item => (
          <div key={item.label} className="flex flex-col">
            <span className="text-sm text-white/30 uppercase">{item.label}</span>
            <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Month Drilldown View ─────────────────────────────────────────────────────

function MonthDrilldown({
  monthIndex,
  year,
  asset,
  onBack,
}: {
  monthIndex: number;
  year: number;
  asset: Asset;
  onBack: () => void;
}) {
  const symbol = ASSET_SYMBOL[asset];
  const [bars, setBars]     = useState<OHLCBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setBars([]);
      const data = await fetchDailyBars(asset, year, monthIndex);
      if (!cancelled) {
        setBars(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [symbol, year, monthIndex]);

  const days = useMemo(() => buildDayAnalytics(bars, year, monthIndex), [bars, year, monthIndex]);
  const peakCount   = days.filter(d => d.status === 'قمة').length;
  const troughCount = days.filter(d => d.status === 'قاع').length;
  const avgMove     = days.length ? days.reduce((s, d) => s + d.priceMagnitude, 0) / days.length : 0;
  const fmtAvg = fmtAssetPrice(avgMove, asset);

  return (
    <div className="flex flex-col gap-6 w-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <div>
          <h3 className="text-lg font-black text-white">{MONTHS_AR[monthIndex]} {year}</h3>
          <p className="text-sm text-white/40 font-mono">التحليل اليومي — {ASSET_LABEL[asset]}</p>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && days.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl p-3 text-center">
            <p className="text-sm font-black text-emerald-400">{peakCount}</p>
            <p className="text-sm text-white/40 mt-0.5">قمم</p>
          </div>
          <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl p-3 text-center">
            <p className="text-sm font-black text-red-400">{troughCount}</p>
            <p className="text-sm text-white/40 mt-0.5">قيعان</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 text-center">
            <p className="text-sm font-black text-white/80 truncate">{fmtAvg}</p>
            <p className="text-sm text-white/40 mt-0.5">متوسط الحركة</p>
          </div>
        </div>
      )}

      {/* Days list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-white/40 text-sm mr-3">جاري التحميل...</span>
        </div>
      ) : days.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-base">لا توجد بيانات لهذا الشهر</div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto overscroll-contain pb-4 pr-1">
          {days.map((day, i) => (
            <DayCard key={i} day={day} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GannWheelPage() {
  const tool = slugToTool('gann-time-wheel');

  const [result,        setResult]        = useState<GannResult | null>(null);
  const [asset,         setAsset]         = useState<Asset>('BTC');
  const [viewMode,      setViewMode]      = useState<ViewMode>('wheel');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Gann wheel is date-only, not asset-dependent
  useEffect(() => {
    const run = () => setResult(computeGann(new Date()));
    const t = setTimeout(run, 0);
    const iv = setInterval(run, 3_600_000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  const handleMonthClick = useCallback((monthIdx: number) => {
    setSelectedMonth(monthIdx);
    setViewMode('month_days');
  }, []);

  const handleBack = useCallback(() => {
    setViewMode('wheel');
    setSelectedMonth(null);
  }, []);

  if (!tool) return notFound();

  const accentColor = ASSET_COLOR[asset].text.replace('text-', '');
  const accentClass  = ASSET_COLOR[asset].text;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-8">
      <ToolPageHeader tool={tool} />

      <div className="flex-1 px-5 pt-4 flex flex-col items-center max-w-lg mx-auto w-full gap-5">

        {/* Asset Toggle */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <AssetToggle asset={asset} onChange={a => { setAsset(a); setViewMode('wheel'); setSelectedMonth(null); }} />
        </motion.div>

        {/* Status Banner */}
        {result && viewMode === 'wheel' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full rounded-2xl border p-6 flex items-center gap-6 shadow-lg ${
              result.status === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 shadow-red-500/10'
              : result.status === 'WARNING' ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/10'
              : 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10'
            }`}
            dir="rtl"
          >
            <div className={`p-3 rounded-full ${
              result.status === 'CRITICAL' ? 'bg-red-500/20 text-red-400'
              : result.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400'
              : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {result.status === 'CRITICAL' ? <ShieldAlert className="w-5 h-5" />
              : result.status === 'WARNING'  ? <AlertTriangle className="w-5 h-5" />
              : <Minus className="w-5 h-5" />}
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-mono text-white/40 uppercase tracking-widest">حالة الدورة الحالية</p>
              <h2 className={`text-lg font-black ${
                result.status === 'CRITICAL' ? 'text-red-400'
                : result.status === 'WARNING' ? 'text-amber-400'
                : 'text-emerald-400'
              }`}>
                {result.status === 'CRITICAL' ? 'تحذير حرج'
                : result.status === 'WARNING'  ? 'تنبيه'
                : 'مستقر'}
              </h2>
              <p className="text-sm text-white/50 mt-0.5">{result.advisoryAr.slice(0, 80)}...</p>
            </div>
          </motion.div>
        )}

        {/* Instruction hint for wheel */}
        {viewMode === 'wheel' && result && (
          <p className="text-sm text-white/30 text-center font-mono flex items-center gap-1">
            <ArrowRight className="w-3 h-3 inline" />
            انقر على أي شهر في العجلة لعرض التحليل اليومي
          </p>
        )}

        {/* Main content: Wheel OR Month Drilldown */}
        <AnimatePresence mode="wait">
          {viewMode === 'wheel' && result ? (
            <motion.div
              key="wheel"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ type: 'spring', damping: 22, stiffness: 180 }}
              className="relative w-full max-w-[320px] aspect-square"
            >
              <div className="absolute inset-0 bg-orange-500/[0.04] rounded-full blur-3xl pointer-events-none" />
              <GannWheelSvg
                result={result}
                selectedMonth={selectedMonth}
                onMonthClick={handleMonthClick}
              />
            </motion.div>
          ) : viewMode === 'month_days' && selectedMonth !== null ? (
            <motion.div
              key="drilldown"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200 }}
              className="w-full"
            >
              <MonthDrilldown
                monthIndex={selectedMonth}
                year={new Date().getFullYear()}
                asset={asset}
                onBack={handleBack}
              />
            </motion.div>
          ) : (
            <div className="flex items-center justify-center py-16" key="loading">
              <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
            </div>
          )}
        </AnimatePresence>

        {/* Next Gann Point Countdown — only in wheel view */}
        {viewMode === 'wheel' && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full rounded-2xl bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 p-6"
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-mono text-orange-400/80 uppercase tracking-widest">النقطة الدورية القادمة</p>
                <p className="text-sm font-bold text-white/80 mt-0.5">{result.nextPoint.eventAr}</p>
              </div>
              <span className="text-sm text-white/60 font-mono">{result.nextPointDate}</span>
            </div>
            <div className="flex items-baseline gap-3 justify-center py-1">
              <span className="text-4xl font-black font-mono text-white tracking-tighter">
                {result.daysToNext}
              </span>
              <span className="text-white/40 font-mono text-base">يوم</span>
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <p className="text-sm text-white/20 text-center font-mono leading-relaxed max-w-xs mx-auto">
          هذه الأداة مبنية على دورات رياضية وتاريخية. للأغراض التعليمية فقط.
        </p>
      </div>
    </div>
  );
}
