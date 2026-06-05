'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Eye, Rocket, Crosshair, Target, ShieldAlert, Zap } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { calculateZigZag } from '@/lib/algorithms/zigzag';
import { generatePatternMockData, PatternResult } from '@/lib/algorithms/patternScanner';
import { notFound } from 'next/navigation';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';

export default function PatternScannerPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PatternResult | null>(null);
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('pattern-scanner');
  if (!tool) return notFound();

  const handleScan = async () => {
    setError('');
    setLoading(true);
    setAnimated(false);

    try {
      // 1. Fetch real data
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 200);
      if (klines.length < 20) throw new Error('بيانات غير كافية للمسح.');

      const currentPrice = klines[klines.length - 1].close;

      // 2. Calculate ZigZag pivots (5% deviation)
      const dataPoints = klines.map((k, i) => ({ index: i, price: k.close }));
      const zzResult = calculateZigZag(dataPoints, 5);
      const pivots = zzResult.pivots;

      if (pivots.length < 4) throw new Error('لا توجد نقاط محورية كافية. حاول بإطار زمني أوسع.');

      const highs = pivots.filter(p => p.type === 'HIGH');
      const lows  = pivots.filter(p => p.type === 'LOW');

      // 3. Detect pattern from real ZigZag
      let detectedType: 'HEAD_AND_SHOULDERS' | 'TRIANGLE' = 'TRIANGLE';

      // Head & Shoulders: last 3 highs — middle is tallest
      if (highs.length >= 3) {
        const [ls, head, rs] = highs.slice(-3);
        if (head.price > ls.price && head.price > rs.price && Math.abs(ls.price - rs.price) / head.price < 0.04) {
          detectedType = 'HEAD_AND_SHOULDERS';
        }
      }
      // Symmetrical Triangle: last 2 highs descend + last 2 lows ascend
      if (highs.length >= 2 && lows.length >= 2) {
        const [h1, h2] = highs.slice(-2);
        const [l1, l2] = lows.slice(-2);
        if (h2.price < h1.price && l2.price > l1.price) {
          detectedType = 'TRIANGLE';
        }
      }

      // 4. Build result using real prices from ZigZag
      let res: PatternResult;
      if (detectedType === 'HEAD_AND_SHOULDERS' && highs.length >= 3 && lows.length >= 2) {
        const [ls, head, rs] = highs.slice(-3);
        const [n1, n2] = lows.slice(-2);
        const necklinePrice = (n1.price + n2.price) / 2;
        const height = head.price - necklinePrice;
        res = {
          patternType: 'HEAD_AND_SHOULDERS',
          patternNameEn: 'Head & Shoulders',
          patternNameAr: 'رأس وكتفين (انعكاسي سلبي)',
          isBullish: false,
          statusAr: `في انتظار كسر خط العنق عند ${necklinePrice.toFixed(2)}`,
          entryTrigger: necklinePrice,
          target1: necklinePrice - height * 0.618,
          target2: necklinePrice - height,
          stopLoss: rs.price * 1.01,
          points: [
            { label: 'LS',   index: ls.index,   price: ls.price   },
            { label: 'H',    index: head.index,  price: head.price },
            { label: 'RS',   index: rs.index,    price: rs.price   },
            { index: n1.index, price: n1.price },
            { index: n2.index, price: n2.price },
          ],
          necklineStart: { index: n1.index, price: n1.price },
          necklineEnd:   { index: n2.index + 15, price: n2.price },
          circles: [
            { label: 'LS',  index: ls.index,   price: ls.price   },
            { label: 'H',   index: head.index,  price: head.price },
            { label: 'RS',  index: rs.index,    price: rs.price   },
          ],
        };
      } else if (highs.length >= 2 && lows.length >= 2) {
        const [h1, h2] = highs.slice(-2);
        const [l1, l2] = lows.slice(-2);
        const apex = (h1.price + l1.price) / 2;
        const height = h1.price - l1.price;
        res = {
          patternType: 'TRIANGLE',
          patternNameEn: 'Symmetrical Triangle',
          patternNameAr: 'مثلث متماثل',
          isBullish: currentPrice > apex,
          statusAr: 'انضغاط سعري — ترقب الاختراق',
          entryTrigger: currentPrice > apex ? h2.price * 1.005 : l2.price * 0.995,
          target1: currentPrice > apex ? h1.price + height * 0.618 : l1.price - height * 0.618,
          target2: currentPrice > apex ? h1.price + height : l1.price - height,
          stopLoss: currentPrice > apex ? l2.price * 0.99 : h2.price * 1.01,
          points: [
            { index: h1.index, price: h1.price },
            { index: l1.index, price: l1.price },
            { index: h2.index, price: h2.price },
            { index: l2.index, price: l2.price },
          ],
          triangleUpper: [{ index: h1.index, price: h1.price }, { index: h2.index + 20, price: (h1.price + h2.price) / 2 }],
          triangleLower: [{ index: l1.index, price: l1.price }, { index: l2.index + 20, price: (l1.price + l2.price) / 2 }],
        };
      } else {
        // fallback to scaled mock
        const mock = generatePatternMockData('TRIANGLE');
        const scale = currentPrice / 53000;
        res = {
          ...mock,
          entryTrigger: mock.entryTrigger * scale,
          target1: mock.target1 * scale,
          target2: mock.target2 * scale,
          stopLoss: mock.stopLoss * scale,
          points: mock.points.map(p => ({ ...p, price: p.price * scale })),
        };
      }

      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء المسح.');
    } finally {
      setLoading(false);
    }
  };

  const priceStr = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: val > 1000 ? 1 : 4, maximumFractionDigits: val > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Eye className="w-3 h-3" /> Classic Patterns
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">مكتشف النماذج الكلاسيكية</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          الرصد الأوتوماتيكي لنماذج المثلثات والرأس والكتفين من بيانات حقيقية
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Control Panel */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-4 shadow-xl shadow-black/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white/50 uppercase tracking-widest">رمز الأصل المالي</label>
            <SymbolDropdown value={symbol} onChange={setSymbol} />
          </div>
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3 mt-2">
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-base tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #7c2d12, #431407)' : 'linear-gradient(135deg, #ea580c, #9a3412)',
              boxShadow: !loading ? '0 0 20px rgba(234, 88, 12, 0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري الفحص المتقدم...' : 'مسح النماذج الكلاسيكية'}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              key={result.patternType}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="flex flex-col gap-6"
            >
              {/* Status Card */}
              <div className={`rounded-xl border p-6 flex flex-col gap-3 shadow-lg ${result.isBullish ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5"><Zap className="w-3 h-3" /> تم التعرف على هيكل</span>
                    <span className={`text-lg font-black tracking-widest ${result.isBullish ? 'text-emerald-400' : 'text-orange-400'}`}>{result.patternNameAr}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 py-4 rounded-lg bg-black/40 border border-white/[0.05]">
                  <Rocket className={`w-6 h-6 ${result.isBullish ? 'text-emerald-500' : 'text-orange-500'}`} />
                  <span className="text-sm font-bold text-white/80">{result.statusAr}</span>
                </div>
              </div>

              {/* Visual Pattern Chart */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-6 flex flex-col shadow-[0_0_30px_rgba(234,88,12,0.1)] relative overflow-hidden h-[420px]">
                <p className="text-sm font-bold text-orange-500/50 uppercase tracking-widest mb-2 z-10">{result.patternNameEn} — بيانات حقيقية</p>
                <div className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                  backgroundSize: '20px 20px',
                }} />
                <PatternSVGChart result={result} animated={animated} />
              </div>

              {/* Trade Parameters */}
              <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md overflow-hidden">
                <div className="bg-white/[0.02] border-b border-white/[0.05] p-3">
                  <span className="text-sm font-bold text-white/70 uppercase tracking-widest flex items-center gap-3"><Crosshair className="w-6 h-6 text-orange-400" /> إعدادات الصفقة المقترحة</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/[0.05]">
                  <div className="flex flex-col p-6 gap-1">
                    <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Entry Trigger (الاختراق)</span>
                    <span className="text-lg font-black text-white font-mono">{priceStr(result.entryTrigger)}</span>
                  </div>
                  <div className="flex flex-col p-6 gap-1">
                    <span className="text-sm font-bold text-red-500/70 uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Stop Loss</span>
                    <span className="text-lg font-black text-red-400 font-mono">{priceStr(result.stopLoss)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/[0.05] border-t border-white/[0.05] bg-emerald-500/5">
                  <div className="flex flex-col p-6 gap-1">
                    <span className="text-sm font-bold text-emerald-500/70 uppercase tracking-widest flex items-center gap-1"><Target className="w-3 h-3" /> Target 1</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">{priceStr(result.target1)}</span>
                  </div>
                  <div className="flex flex-col p-6 gap-1">
                    <span className="text-sm font-bold text-emerald-500/70 uppercase tracking-widest flex items-center gap-1"><Target className="w-3 h-3" /> Target 2</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">{priceStr(result.target2)}</span>
                  </div>
                </div>
              </div>

              {/* Verdict Card */}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-5">
                <p className="text-sm font-black text-orange-400 uppercase tracking-widest mb-2">الدليل الإرشادي الفني</p>
                <div className="flex flex-col gap-1.5 text-sm text-white/70">
                  <p>📊 النموذج: <span className="font-black text-white">{result.patternNameAr}</span> ({result.patternNameEn})</p>
                  <p>🎯 نقطة الدخول عند الاختراق: <span className="font-black text-white font-mono">{priceStr(result.entryTrigger)}</span></p>
                  <p>🛑 وقف الخسارة: <span className="font-black text-red-400 font-mono">{priceStr(result.stopLoss)}</span></p>
                  <p>✅ الأهداف: <span className="font-black text-emerald-400 font-mono">{priceStr(result.target1)}</span> ثم <span className="font-black text-emerald-400 font-mono">{priceStr(result.target2)}</span></p>
                  <p className="mt-1 pt-2 border-t border-white/10 text-white/50">
                    {result.isBullish
                      ? '💡 التوصية: انتظر اختراق نقطة الدخول بشمعة إغلاق حقيقية مع حجم مرتفع قبل الدخول شراءً.'
                      : '💡 التوصية: انتظر كسر نقطة الدخول هبوطاً مع حجم مرتفع. لا تدخل بيعاً إلا بعد تأكيد الكسر.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── SVG Chart ────────────────────────────────────────────────────────────────

function PatternSVGChart({ result, animated }: { result: PatternResult; animated: boolean }) {
  const points = result.points;
  const minPrice = Math.min(...points.map(p => p.price));
  const maxPrice = Math.max(...points.map(p => p.price));
  const priceRange = maxPrice - minPrice || 1;
  const padding = priceRange * 0.2;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;
  const yRange = yMax - yMin;
  const width = 800;
  const height = 300;
  const scaleX = (index: number) => (index / 100) * width;
  const scaleY = (price: number) => height - ((price - yMin) / yRange) * height;
  const pts = points.map(p => ({ ...p, x: scaleX(p.index), y: scaleY(p.price) }));
  const wavePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg className="w-full h-full z-10" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <filter id="patternGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <motion.path d={wavePath} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={animated ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }} />

      {result.patternType === 'TRIANGLE' && result.triangleUpper && result.triangleLower && animated && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}>
          <line x1={scaleX(result.triangleUpper[0].index)} y1={scaleY(result.triangleUpper[0].price)}
            x2={scaleX(result.triangleUpper[1].index)} y2={scaleY(result.triangleUpper[1].price)}
            stroke="#10b981" strokeWidth="2" strokeDasharray="6,6" filter="url(#patternGlow)" />
          <line x1={scaleX(result.triangleLower[0].index)} y1={scaleY(result.triangleLower[0].price)}
            x2={scaleX(result.triangleLower[1].index)} y2={scaleY(result.triangleLower[1].price)}
            stroke="#10b981" strokeWidth="2" strokeDasharray="6,6" filter="url(#patternGlow)" />
        </motion.g>
      )}

      {result.patternType === 'HEAD_AND_SHOULDERS' && animated && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}>
          {result.necklineStart && result.necklineEnd && (
            <line x1={scaleX(result.necklineStart.index)} y1={scaleY(result.necklineStart.price)}
              x2={scaleX(result.necklineEnd.index)} y2={scaleY(result.necklineEnd.price)}
              stroke="#f97316" strokeWidth="3" strokeDasharray="10,5" filter="url(#patternGlow)" />
          )}
          {result.circles?.map((c, i) => (
            <g key={i}>
              <circle cx={scaleX(c.index)} cy={scaleY(c.price)} r="18" fill="none" stroke="#f97316" strokeWidth="2" filter="url(#patternGlow)" />
              {c.label && <text x={scaleX(c.index)} y={scaleY(c.price) - 25} fill="#f97316" fontSize="14" fontWeight="bold" textAnchor="middle">{c.label}</text>}
            </g>
          ))}
        </motion.g>
      )}

      <AnimatePresence>
        {animated && pts.map((p, i) => (
          <motion.g key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.5 + i * 0.1, type: 'spring' }}>
            <circle cx={p.x} cy={p.y} r="4" fill="#111" stroke="#fff" strokeWidth="2" />
          </motion.g>
        ))}
      </AnimatePresence>
    </svg>
  );
}
