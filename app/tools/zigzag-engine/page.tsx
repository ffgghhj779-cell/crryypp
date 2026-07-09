'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, SlidersHorizontal, Settings2, Info, ScanSearch, AlertCircle } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateZigZag, ZigZagResult, DataPoint, PivotPoint } from '@/lib/algorithms/zigzag';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';

export default function ZigZagPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [deviationPct, setDeviationPct] = useState<number>(5);
  const [result, setResult] = useState<ZigZagResult | null>(null);
  const [rawKlines, setRawKlines] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDeviationChange = useCallback((pct: number) => {
    setDeviationPct(pct);
    if (rawKlines.length > 0) {
      const res = calculateZigZag(rawKlines, pct);
      setResult(res);
    }
  }, [rawKlines]);

  const handleFetch = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (klines.length < 10) throw new Error('بيانات غير كافية');
      const pts: DataPoint[] = klines.map((k, i) => ({ index: i, price: k.close }));
      setRawKlines(pts);
      const res = calculateZigZag(pts, deviationPct);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [symbol, deviationPct]);

  
  const structureColor =
    result?.currentStructure?.includes('صاعد') ? 'text-emerald-400' :
    result?.currentStructure?.includes('هابط') ? 'text-red-400' : 'text-blue-400';

  const verdictText =
    result?.currentStructure?.includes('صاعد')
      ? 'الهيكل صاعد (HH+HL) — التوصية: ابحث عن فرص شراء عند كل HL جديد مع وقف خسارة تحت آخر LL.'
      : result?.currentStructure?.includes('هابط')
      ? 'الهيكل هابط (LL+LH) — التوصية: ابحث عن فرص بيع عند كل LH جديد مع وقف خسارة فوق آخر HH.'
      : 'الهيكل عرضي — التوصية: انتظر كسر النطاق قبل الدخول. لا تتداول في نطاق المقاومة والدعم.';

  const tool = slugToTool('zigzag-engine');
  if (!tool) return notFound();
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-blue-500/70 tracking-widest uppercase border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Activity className="w-3 h-3" /> Market Structure
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">محرك القمم والقيعان (ZigZag)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          رسم هيكل السوق الحقيقي من بيانات فعلية مع تحديد HH/HL/LH/LL
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Control Panel */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-5 shadow-xl shadow-black/50">
          <SymbolDropdown value={symbol} onChange={setSymbol} />

          {/* Deviation Slider */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end">
              <label className="text-sm font-bold text-white/70 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-400" /> عمق الانحراف
              </label>
              <span className="text-lg font-black text-blue-400 font-mono">{deviationPct}%</span>
            </div>
            <input
              type="range"
              min="1" max="10" step="0.5"
              value={deviationPct}
              onChange={e => handleDeviationChange(parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-2 bg-black/40 rounded-lg appearance-none cursor-pointer border border-white/[0.05]"
            />
            <div className="flex justify-between text-xs font-mono text-white/30 uppercase px-1">
              <span>حساسية عالية (1%)</span>
              <span>ترند كبير (10%)</span>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleFetch}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white transition-all disabled:opacity-50"
            style={{
              background: loading ? '#1a1a1a' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              boxShadow: !loading ? '0 0 20px rgba(59,130,246,0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري جلب البيانات...' : 'تحميل البيانات الحقيقية'}
          </button>
        </div>

        {/* Chart */}
        {result && rawKlines.length > 0 && (
          <div className="rounded-2xl border border-blue-500/20 bg-[#111] p-5 flex flex-col shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden h-96">
            <p className="text-sm font-bold text-blue-400/50 uppercase tracking-widest mb-3 flex items-center gap-1.5 z-10">
              <Settings2 className="w-3 h-3" /> ZigZag — بيانات حقيقية ({symbol})
            </p>
            <div className="w-full h-full relative z-10">
              <ZigZagChart rawData={result.rawData} pivots={result.pivots} />
            </div>
          </div>
        )}

        {/* Stats Row */}
        {result && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4 flex flex-col gap-1">
              <p className="text-xs text-white/40 uppercase tracking-widest">نقاط محورية</p>
              <p className="text-xl font-black text-white">{result.pivots.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4 flex flex-col gap-1">
              <p className="text-xs text-emerald-400/60 uppercase tracking-widest">HH+HL</p>
              <p className="text-xl font-black text-emerald-400">
                {result.pivots.filter(p => p.structure === 'HH' || p.structure === 'HL').length}
              </p>
            </div>
            <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4 flex flex-col gap-1">
              <p className="text-xs text-red-400/60 uppercase tracking-widest">LL+LH</p>
              <p className="text-xl font-black text-red-400">
                {result.pivots.filter(p => p.structure === 'LL' || p.structure === 'LH').length}
              </p>
            </div>
          </div>
        )}

        {/* Status */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={result.currentStructure}
            className="rounded-xl border border-white/[0.05] bg-black/40 p-5 flex flex-col gap-2 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-1 h-full bg-blue-500/50" />
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-bold text-blue-400 uppercase tracking-widest">الهيكل الحالي</span>
            </div>
            <p className="text-base text-white/80 font-medium leading-relaxed">
              <strong className={`drop-shadow-[0_0_5px_rgba(59,130,246,0.5)] ${structureColor}`}>{result.currentStructure}</strong>
              {' '}<span className="text-white/40">— انحراف {result.deviationPct}%</span>
            </p>
          </motion.div>
        )}

        {/* Verdict Card */}
        {result && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
            <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-2">الدليل الإرشادي الفني</p>
            <p className="text-sm text-white/70 leading-relaxed">{verdictText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SVG Chart ────────────────────────────────────────────────────────────────

function ZigZagChart({ rawData, pivots }: { rawData: DataPoint[]; pivots: PivotPoint[] }) {
  if (rawData.length === 0) return null;

  const minPrice = Math.min(...rawData.map(d => d.price));
  const maxPrice = Math.max(...rawData.map(d => d.price));
  const priceRange = maxPrice - minPrice || 1;
  const padding = priceRange * 0.1;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;
  const yRange = yMax - yMin;
  const width = 800;
  const height = 300;

  const scaleX = (index: number) => (index / (rawData.length - 1)) * width;
  const scaleY = (price: number) => height - ((price - yMin) / yRange) * height;

  const rawPath = rawData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.index)} ${scaleY(d.price)}`).join(' ');
  const zzPath  = pivots.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.index)} ${scaleY(p.price)}`).join(' ');

  return (
    <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <filter id="neonGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={rawPath} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinejoin="round" />
      {zzPath && (
        <motion.path
          d={zzPath} fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinejoin="round"
          filter="url(#neonGlow)"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />
      )}
      <AnimatePresence>
        {pivots.map((p, i) => {
          const x = scaleX(p.index);
          const y = scaleY(p.price);
          const isHigh = p.type === 'HIGH';
          let badgeColor = '#6b7280';
          if (p.structure === 'HH' || p.structure === 'HL') badgeColor = '#10b981';
          if (p.structure === 'LL' || p.structure === 'LH') badgeColor = '#ef4444';

  return (
            <motion.g key={`${p.index}-${i}`}
              initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.5 + i * 0.08, type: 'spring', stiffness: 200 }}>
              <circle cx={x} cy={y} r="5" fill="#fff" stroke={badgeColor} strokeWidth="3" filter="url(#neonGlow)" />
              <g transform={`translate(${x - 15}, ${isHigh ? y - 26 : y + 10})`}>
                <rect width="30" height="16" rx="4" fill="#111" stroke={badgeColor} strokeWidth="1" />
                <text x="15" y="11" fontSize="10" fontWeight="bold" fill={badgeColor} textAnchor="middle" fontFamily="monospace">
                  {p.structure !== 'START' ? p.structure : 'P'}
                </text>
              </g>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
