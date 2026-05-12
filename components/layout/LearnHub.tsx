'use client';

import { BookOpen, TrendingUp, BarChart2, Layers, Target, Shield, Zap, Clock } from 'lucide-react';

const LESSONS = [
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'النماذج الكلاسيكية الاستمرارية والانعكاسية',
    subtitle: 'الأنماط السعرية · Pattern Recognition',
    color: 'text-violet-400',
    border: 'border-violet-500/20',
    bg:    'bg-violet-500/[0.06]',
    badge: 'أساسي',
    badgeColor: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: 'مفهوم السيولة ومناطق الطلب والعرض',
    subtitle: 'Smart Money Concepts · SMC',
    color: 'text-sky-400',
    border: 'border-sky-500/20',
    bg:    'bg-sky-500/[0.06]',
    badge: 'متوسط',
    badgeColor: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  },
  {
    icon: <BarChart2 className="w-5 h-5" />,
    title: 'قراءة حجم التداول وتفسير دلتا الأوامر',
    subtitle: 'Order Flow Analysis · CVD',
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg:    'bg-emerald-500/[0.06]',
    badge: 'متقدم',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  },
  {
    icon: <Target className="w-5 h-5" />,
    title: 'منهجية وايكوف والمراحل المؤسسية الأربع',
    subtitle: 'Wyckoff Method · ACC / MRK / DST / MDN',
    color: 'text-orange-400',
    border: 'border-orange-500/20',
    bg:    'bg-orange-500/[0.06]',
    badge: 'متقدم',
    badgeColor: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'إدارة المخاطر وحساب حجم الصفقة',
    subtitle: 'Risk Management · Position Sizing',
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg:    'bg-amber-500/[0.06]',
    badge: 'أساسي',
    badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'التحليل الكمي ونماذج مونت كارلو والانحدار',
    subtitle: 'Quantitative Analysis · Monte Carlo / LR',
    color: 'text-pink-400',
    border: 'border-pink-500/20',
    bg:    'bg-pink-500/[0.06]',
    badge: 'خبير',
    badgeColor: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'دورات السوق ونظرية الموجات ومرشح فورييه',
    subtitle: 'Market Cycles · Elliott / Fourier',
    color: 'text-cyan-400',
    border: 'border-cyan-500/20',
    bg:    'bg-cyan-500/[0.06]',
    badge: 'خبير',
    badgeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: 'قراءة مؤشرات الزخم: RSI · MACD · بولينجر',
    subtitle: 'Momentum Indicators · Batch 1',
    color: 'text-rose-400',
    border: 'border-rose-500/20',
    bg:    'bg-rose-500/[0.06]',
    badge: 'متوسط',
    badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  },
];

export function LearnHub() {
  return (
    <section className="w-full" dir="rtl">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-orange-500" />
          <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest">مركز التعلم · Learn Hub 360</h2>
        </div>
        <span className="text-[9px] text-white/20 font-mono">{LESSONS.length} محاضرات</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        {LESSONS.map((l, i) => (
          <button
            key={i}
            className={`group relative text-right p-3.5 rounded-xl border ${l.border} ${l.bg} hover:border-orange-500/30 active:scale-[0.97] transition-all duration-150 overflow-hidden`}
          >
            {/* Hover glow */}
            <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_bottom-left,rgba(249,115,22,0.07),transparent_70%)]" />

            {/* Badge */}
            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${l.badgeColor} mb-2 inline-block`}>
              {l.badge}
            </span>

            {/* Icon */}
            <div className={`${l.color} mb-2 opacity-80`}>{l.icon}</div>

            {/* Title */}
            <p className="text-[11px] font-bold text-white leading-tight text-right mb-1">{l.title}</p>
            <p className="text-[9px] text-white/30 leading-tight font-mono">{l.subtitle}</p>
          </button>
        ))}
      </div>

      {/* Coming soon note */}
      <div className="mt-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 text-center">
        <p className="text-[10px] text-white/30">
          <span className="text-orange-500 font-bold">قريباً · </span>
          فيديوهات تفاعلية ومحاضرات صوتية لكل نموذج تحليلي
        </p>
      </div>
    </section>
  );
}
