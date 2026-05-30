'use client';

/**
 * app/tools/gann-144-star/page.tsx
 *
 * Gann 144 Star — نجمة جان ١٤٤
 * Master Time & Price Squaring Calculator
 *
 * Architecture:
 *   ToolsLayout (spring animation shell)
 *     ToolPageHeader (back nav)
 *       GannStarPage
 *         <GannStarForm />      — Glassmorphism input form
 *         <GannStarVisual />    — Animated 8-point star SVG
 *         <GannStarResults />   — Squaring node cards
 *         <GannStarGuide />     — Accordion educational panel
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Sparkles, AlertCircle, Star, CalendarDays, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { ToolPageHeader }     from '@/components/tools/ToolPageHeader';
import { slugToTool }         from '@/lib/tools/registry';
import {
  computeGann144,
  formatGannDate,
  formatGannDateShort,
} from '@/lib/algorithms/gann144';
import type {
  Gann144Input,
  Gann144Result,
  Gann144Node,
  AnchorType,
} from '@/lib/algorithms/gann144';
import { notFound } from 'next/navigation';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';


// ─── Polar helpers ─────────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── 8-Pointed Gann Star SVG ──────────────────────────────────────────────────
function GannStarSvg({ result, animated }: { result: Gann144Result; animated: boolean }) {
  const cx = 160, cy = 160;
  const outerR = 128, innerR = 52;
  const nodeR  = 7;

  // Build octagram path: alternating outer/inner points at every 45°
  const starPoints: string[] = [];
  for (let i = 0; i < 8; i++) {
    const outerP = polar(cx, cy, outerR, i * 45);
    const innerP = polar(cx, cy, innerR, i * 45 + 22.5);
    starPoints.push(`${outerP.x.toFixed(2)},${outerP.y.toFixed(2)}`);
    starPoints.push(`${innerP.x.toFixed(2)},${innerP.y.toFixed(2)}`);
  }

  // Primary node positions (8 × 45° on outer ring)
  const primaryNodes = Array.from({ length: 8 }, (_, i) => {
    const p = polar(cx, cy, outerR, i * 45);
    const node = result.nodes.find(n => n.id === `primary-${i + 1}`);
    const isPast = node ? node.targetDate < new Date() : false;
    return { ...p, isPast, n: i + 1 };
  });

  return (
    <svg width="100%" viewBox="0 0 320 320" className="overflow-visible">
      <defs>
        {/* Outer glow filter */}
        <filter id="glow-star" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-node" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Radial gradient fill */}
        <radialGradient id="starGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#f97316" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
        </radialGradient>
        {/* Orange line gradient */}
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#f97316" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Background circles */}
      <circle cx={cx} cy={cy} r={outerR + 16} fill="none" stroke="rgba(249,115,22,0.06)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={outerR}      fill="none" stroke="rgba(249,115,22,0.12)" strokeWidth="1" strokeDasharray="4 6" />
      <circle cx={cx} cy={cy} r={innerR}      fill="none" stroke="rgba(249,115,22,0.08)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={22}          fill="rgba(249,115,22,0.08)" />

      {/* Cross-hair grid lines */}
      {[0, 45, 90, 135].map(angle => {
        const p1 = polar(cx, cy, outerR + 12, angle);
        const p2 = polar(cx, cy, outerR + 12, angle + 180);
        return (
          <line key={angle}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="rgba(249,115,22,0.07)" strokeWidth="1" strokeDasharray="2 4"
          />
        );
      })}

      {/* The 8-pointed star */}
      <motion.polygon
        points={starPoints.join(' ')}
        fill="url(#starGrad)"
        stroke="url(#lineGrad)"
        strokeWidth="1.5"
        filter="url(#glow-star)"
        initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
        animate={animated ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.5, rotate: -45 }}
        transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.1 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Spoke lines from center to outer nodes */}
      {primaryNodes.map(({ x, y, n }) => (
        <motion.line
          key={`spoke-${n}`}
          x1={cx} y1={cy} x2={x} y2={y}
          stroke="rgba(249,115,22,0.2)"
          strokeWidth="1"
          initial={{ opacity: 0 }}
          animate={animated ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.1 + n * 0.06 }}
        />
      ))}

      {/* Outer node dots */}
      {primaryNodes.map(({ x, y, isPast, n }) => (
        <motion.g key={`node-${n}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={animated ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ type: 'spring', delay: 0.15 + n * 0.07, stiffness: 200, damping: 18 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        >
          {/* Pulse ring */}
          {!isPast && (
            <circle cx={x} cy={y} r={nodeR + 4} fill="none"
              stroke="rgba(249,115,22,0.3)" strokeWidth="1"
              className={n === 1 ? 'animate-ping' : ''}
            />
          )}
          <circle cx={x} cy={y} r={nodeR}
            fill={isPast ? 'rgba(255,255,255,0.1)' : '#f97316'}
            stroke={isPast ? 'rgba(255,255,255,0.15)' : '#fb923c'}
            strokeWidth="1.5"
            filter={!isPast ? 'url(#glow-node)' : undefined}
          />
          {/* n label */}
          <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill={isPast ? 'rgba(255,255,255,0.3)' : 'white'}
            fontSize="7" fontFamily="monospace" fontWeight="800"
          >
            {n}
          </text>
        </motion.g>
      ))}

      {/* Center */}
      <motion.circle cx={cx} cy={cy} r={22}
        fill="rgba(249,115,22,0.12)"
        stroke="rgba(249,115,22,0.4)"
        strokeWidth="1.5"
        filter="url(#glow-node)"
        initial={{ scale: 0 }}
        animate={animated ? { scale: 1 } : { scale: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      <motion.text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fill="#f97316" fontSize="11" fontFamily="monospace" fontWeight="900"
        letterSpacing="0.5"
        initial={{ opacity: 0 }}
        animate={animated ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.5 }}
      >
        144
      </motion.text>
    </svg>
  );
}

// ─── Node Result Card ──────────────────────────────────────────────────────────
function NodeCard({ node, index, isBottom }: { node: Gann144Node; index: number; isBottom: boolean }) {
  const isPast    = node.targetDate < new Date();
  const isMaster  = node.strength === 'master';
  const isQuarter = node.strength === 'quarter';

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 180, damping: 22 }}
      className={`relative rounded-xl border p-6 overflow-hidden ${
        isMaster
          ? 'bg-orange-500/10 border-orange-500/30'
          : isQuarter
          ? 'bg-white/[0.02] border-white/[0.06]'
          : 'bg-white/[0.03] border-white/[0.08]'
      } ${isPast ? 'opacity-50' : ''}`}
    >
      {/* Glow bg for master node */}
      {isMaster && (
        <div className="absolute inset-0 bg-orange-500/5 blur-xl" />
      )}

      <div className="relative flex items-start justify-between gap-3">
        {/* Left: date + cycle label */}
        <div className="flex flex-col gap-1 min-w-0" dir="rtl">
          <div className="flex items-center gap-3 flex-wrap">
            {isMaster && (
              <span className="inline-flex items-center gap-1 text-sm font-black text-orange-400 bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 rounded-full uppercase tracking-widest">
                <Star className="w-2.5 h-2.5" />
                النقطة الرئيسية
              </span>
            )}
            {node.isSquaringNode && !isMaster && (
              <span className="text-sm font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full tracking-wide">
                توافق عالي الاحتمال
              </span>
            )}
            {isPast && (
              <span className="text-sm text-white/30 font-mono border border-white/10 px-2 py-0.5 rounded-full">مكتملة</span>
            )}
          </div>

          <h4 className="text-base font-bold text-white/90 mt-1">{node.cycleLabel}</h4>
          <p className="text-sm text-white/40 font-mono">{node.label}</p>

          <div className="flex items-center gap-3 mt-2">
            <CalendarDays className="w-3.5 h-3.5 text-orange-400/60" />
            <span className="text-sm font-mono text-orange-300/80">
              {formatGannDate(node.targetDate)}
            </span>
          </div>
          <p className="text-sm text-white/30 font-mono">
            +{node.daysFromAnchor} يوم من نقطة الارتكاز
          </p>
        </div>

        {/* Right: price target */}
        <div className="shrink-0 flex flex-col items-end gap-1" dir="rtl">
          <div className="flex items-center gap-1">
            {isBottom
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            }
            <span className={`text-sm font-bold ${isBottom ? 'text-emerald-400' : 'text-red-400'}`}>
              {isBottom ? '+' : '-'}{node.priceChangePct}%
            </span>
          </div>
          <span className={`text-lg font-black font-mono tabular-nums ${
            isMaster ? 'text-orange-400' : 'text-white/90'
          }`}>
            {node.targetPrice.toLocaleString('en-US', {
              minimumFractionDigits: node.targetPrice < 10 ? 4 : node.targetPrice < 1000 ? 2 : 0,
              maximumFractionDigits: node.targetPrice < 10 ? 4 : node.targetPrice < 1000 ? 2 : 0,
            })}
          </span>
          <span className="text-sm text-white/30 font-mono">
            {node.angleOnWheel}° على العجلة
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Guide Accordion ───────────────────────────────────────────────────────────
function GannStarGuide() {
  const [open, setOpen] = useState(false);

  const sections = [
    {
      title: 'ما هي نجمة جان ١٤٤؟',
      content: 'نجمة جان ١٤٤ هي إحدى أكثر أدوات غان المالية دقةً. الرقم ١٤٤ هو حاصل ضرب ١٢ × ١٢، وهو ما أسماه غان "عامل الزمن الرئيسي" (Master Time Factor). هذا الرقم يربط بين دورات الزمن ودورات السعر في نظام هندسي موحّد.',
    },
    {
      title: 'مبدأ التربيع (Squaring)',
      content: 'يحدث "تربيع الزمن والسعر" عندما تتساوى وحدة الزمن (بالأيام) مع وحدة تحرك السعر (بالنسبة المئوية الهندسية). عند كل مضاعف من ١٤٤ يوم، يتوقع غان احتمالية عالية جداً لحدوث انعكاس أو تسارع في الاتجاه.',
    },
    {
      title: 'كيف تعمل الحسابات؟',
      content: 'يضيف المحرك مضاعفات ١٤٤ يوم إلى تاريخ الارتكاز (١٤٤، ٢٨٨، ٤٣٢...) مع احتساب أهداف سعرية هندسية بزيادة ١٤.٤٪ لكل دورة. نقطة التوافق هي عندما يلتقي هدف الزمن مع هدف السعر في نفس اللحظة الهندسية.',
    },
    {
      title: 'النقاط الفرعية (الأرباع)',
      content: 'كل دورة ١٤٤ تنقسم إلى أرباع: ٣٦ يوماً، ٧٢ يوماً، ١٠٨ أيام. هذه النقاط الفرعية تمثل توقفات زخم مؤقتة داخل الدورة الكاملة. تُستخدم للدخول في الصفقات باتجاه الدورة الرئيسية.',
    },
    {
      title: 'هذه الأداة تربط بين أين ومتى',
      content: 'كما قال غان: "الوقت هو العامل الأكثر أهمية". هذه الأداة تخبرك باليوم الذي سيصل فيه السعر إلى هدفه الهندسي ليحدث انعكاس عالي الاحتمال — ليس فقط أين، بل متى بالضبط.',
    },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden" dir="rtl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4.5 active:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3.5">
          <Info className="w-6 h-6 text-orange-400/70" />
          <span className="text-base font-bold text-white/70">الدليل الإرشادي لتطبيق ١٤٤</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-6 h-6 text-white/30" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
              {sections.map((s, i) => (
                <div key={i} className="px-5 py-4.5">
                  <p className="text-sm font-bold text-orange-400/80 mb-1.5">{s.title}</p>
                  <p className="text-sm text-white/55 leading-relaxed">{s.content}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Gann144StarPage() {
  // ── All hooks MUST be declared unconditionally at the top ──────────────────
  const [symbol,      setSymbol]      = useState('BTCUSDT');
  const [anchorType,  setAnchorType]  = useState<AnchorType>('bottom');
  const [anchorDate,  setAnchorDate]  = useState('');
  const [anchorPrice, setAnchorPrice] = useState('');
  const [result,      setResult]      = useState<Gann144Result | null>(null);
  const [animated,    setAnimated]    = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  // Guard — after all hooks so React rules are satisfied
  const tool = slugToTool('gann-144-star');
  if (!tool) return notFound();

  function handleCalculate() {
    setError('');

    // Validate
    if (!symbol.trim())    return setError('أدخل اسم العملة أو الرمز.');
    if (!anchorDate)       return setError('اختر تاريخ نقطة الارتكاز.');
    const price = parseFloat(anchorPrice);
    if (isNaN(price) || price <= 0) return setError('أدخل سعر ارتكاز صحيح وموجب.');

    setLoading(true);
    setAnimated(false);

    // Simulate brief computation delay for premium feel
    setTimeout(() => {
      const input: Gann144Input = {
        symbol:      symbol.trim().toUpperCase(),
        anchorType,
        anchorDate:  new Date(anchorDate),
        anchorPrice: price,
      };
      try {
        const res = computeGann144(input);
        setResult(res);
        setTimeout(() => setAnimated(true), 80);
      } catch (e: unknown) {
        setError('خطأ في الحساب. تحقق من المدخلات وأعد المحاولة.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  const isBottom = anchorType === 'bottom';

  return (
    <div className="flex flex-col h-full bg-[#0f172a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Page Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-400/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full">
            Gann · 144
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          نجمة جان ١٤٤
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          حاسبة التوافق الزمني والسعري — عامل الزمن الرئيسي (١٢×١٢)
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">

        {/* ── Glassmorphism Input Form ─────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6">

          {/* Symbol */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white/50 uppercase tracking-widest">
              رمز الأصل / العملة
            </label>
            <SymbolDropdown value={symbol} onChange={setSymbol} />
          </div>

          {/* Anchor Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white/50 uppercase tracking-widest">
              نوع الارتكاز
            </label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'bottom', labelAr: 'قاع رئيسي', icon: <TrendingUp className="w-6 h-6" /> },
                { value: 'top',    labelAr: 'قمة رئيسية', icon: <TrendingDown className="w-6 h-6" /> },
              ] as { value: AnchorType; labelAr: string; icon: React.ReactNode }[]).map(({ value, labelAr, icon }) => (
                <button
                  key={value}
                  onClick={() => setAnchorType(value)}
                  className={`flex items-center justify-center gap-3 py-4 rounded-xl border text-base font-bold transition-all active:scale-95 ${
                    anchorType === value
                      ? value === 'bottom'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-red-500/15 border-red-500/40 text-red-400'
                      : 'bg-white/[0.03] border-white/[0.07] text-white/40'
                  }`}
                >
                  {icon}
                  {labelAr}
                </button>
              ))}
            </div>
          </div>

          {/* Anchor Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white/50 uppercase tracking-widest">
              تاريخ الارتكاز
            </label>
            <input
              type="date"
              value={anchorDate}
              onChange={e => setAnchorDate(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-base px-5 py-4 focus:outline-none focus:border-orange-500/40 transition-colors [color-scheme:dark]"
              dir="ltr"
            />
          </div>

          {/* Anchor Price */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-white/50 uppercase tracking-widest">
              سعر الارتكاز
            </label>
            <input
              type="number"
              value={anchorPrice}
              onChange={e => setAnchorPrice(e.target.value)}
              placeholder="مثال: 60000"
              min="0"
              step="any"
              className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-base px-5 py-4 placeholder:text-white/20 focus:outline-none focus:border-orange-500/40 transition-colors"
              dir="ltr"
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-4.5"
              >
                <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Calculate Button */}
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-base text-black tracking-wide active:scale-[0.98] transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
          >
            {loading
              ? <span className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              : <Sparkles className="w-6 h-6" />
            }
            {loading ? 'جاري الحساب...' : 'احسب نقاط التوافق'}
          </button>
        </div>

        {/* ── Results ───────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="flex flex-col gap-5"
            >
              {/* Summary Banner */}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-orange-400/70 font-mono tracking-widest uppercase mb-0.5">
                      {result.input.symbol} · نجمة جان ١٤٤
                    </p>
                    <h2 className="text-lg font-black text-white">
                      {result.summary.squaringNodeCount} نقاط توافق · {result.summary.direction}
                    </h2>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full border ${
                      isBottom
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      {isBottom ? 'قاع رئيسي' : 'قمة رئيسية'}
                    </span>
                    <span className="text-sm text-white/30 font-mono">
                      {formatGannDateShort(result.input.anchorDate)}
                    </span>
                  </div>
                </div>

                {/* Next node countdown */}
                <div className="rounded-xl bg-black/30 border border-white/[0.05] px-3 py-4.5 flex items-center justify-between">
                  <p className="text-sm text-white/40 font-mono">النقطة القادمة</p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-orange-400">
                      {formatGannDateShort(result.summary.nextNode.targetDate)}
                    </span>
                    <span className="text-sm font-black text-white">
                      {result.summary.nextNodeDaysAway}
                      <span className="text-white/40 font-normal text-sm mr-1">يوم</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Gann Star Visual */}
              <div className="relative rounded-2xl border border-white/[0.06] bg-[#0a0f1e] p-6 flex flex-col items-center gap-3">
                <p className="text-sm font-mono text-white/25 tracking-widest uppercase mb-2">
                  نجمة التوافق — {result.input.symbol}
                </p>
                <div className="w-full max-w-[300px]">
                  <GannStarSvg result={result} animated={animated} />
                </div>
                <p className="text-sm text-white/20 font-mono mt-2 text-center">
                  كل نقطة تمثل دورة ١٤٤ يوماً · الأرقام تمثل رقم الدورة
                </p>
              </div>

              {/* Node Cards */}
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">
                    نقاط التوافق الزمني والسعري
                  </h3>
                  <span className="text-sm text-white/25 font-mono">
                    {result.nodes.length} نقطة
                  </span>
                </div>

                {result.nodes.map((node, i) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    index={i}
                    isBottom={isBottom}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Guide ─────────────────────────────────────────────────────────── */}
        <GannStarGuide />

        {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
        <p className="text-sm text-white/25 text-center font-mono leading-relaxed pb-4 max-w-xs mx-auto" dir="rtl">
          هذه الأداة تستند إلى الدورات الإحصائية التاريخية والهندسة الرياضية لمدرسة غان.
          جميع المخرجات ذات احتمالية عالية جداً وليست ضماناً أو يقيناً.
          للأغراض التعليمية والتحليلية فقط.
        </p>

      </div>
    </div>
  );
}
