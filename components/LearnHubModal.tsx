'use client';

import { useState } from 'react';
import {
  TrendingUp, BarChart2, Layers, Activity, Shield,
  BookOpen, Zap, Target, GitBranch, Grid3X3,
  AlertTriangle, Link2, Globe, TrendingDown,
  Monitor, Play, AlertCircle, RefreshCw, X, ChevronLeft,
} from 'lucide-react';

// ─── Topic Data ────────────────────────────────────────────────────────────────
interface Topic {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}

const TOPICS: Topic[] = [
  { title: 'Chart Patterns',           subtitle: 'النماذج الكلاسيكية الاستمرارية والانعكاسية',     icon: <TrendingUp  className="w-7 h-7" />, color: 'text-violet-400', bg: 'bg-violet-500/[0.07]',  border: 'border-violet-500/20'  },
  { title: 'Candle Patterns',          subtitle: 'موسوعة أنماط الشموع اليابانية (32 نمط)',          icon: <BarChart2   className="w-7 h-7" />, color: 'text-orange-400', bg: 'bg-orange-500/[0.07]',  border: 'border-orange-500/20'  },
  { title: 'إرشادات منهجية وايكوف',    subtitle: 'التجميع والتصريف وقراءة الفوليوم',                icon: <Layers      className="w-7 h-7" />, color: 'text-sky-400',    bg: 'bg-sky-500/[0.07]',     border: 'border-sky-500/20'     },
  { title: 'إرشادات موجات اليوت',      subtitle: 'الدافعة والتصحيحية ودليل فيبوناتشي',             icon: <Activity    className="w-7 h-7" />, color: 'text-emerald-400',bg: 'bg-emerald-500/[0.07]', border: 'border-emerald-500/20' },
  { title: 'ICT & SMC',                subtitle: 'مفاهيم الأموال الذكية والتداول المؤسسي',          icon: <Shield      className="w-7 h-7" />, color: 'text-amber-400',  bg: 'bg-amber-500/[0.07]',   border: 'border-amber-500/20'   },
  { title: 'إرشادات نظرية داو',        subtitle: 'المبادئ، مراحل السوق، وهيكل الاتجاه',            icon: <BookOpen    className="w-7 h-7" />, color: 'text-pink-400',   bg: 'bg-pink-500/[0.07]',    border: 'border-pink-500/20'    },
  { title: 'إرشادات مؤشرات الزخم',    subtitle: 'RSI, MACD, المتوسطات، والحجم',                   icon: <Zap         className="w-7 h-7" />, color: 'text-yellow-400', bg: 'bg-yellow-500/[0.07]',  border: 'border-yellow-500/20'  },
  { title: 'إرشادات الهارمونيك',       subtitle: 'النماذج التوافقية ونسب فيبوناتشي الدقيقة',        icon: <Target      className="w-7 h-7" />, color: 'text-cyan-400',   bg: 'bg-cyan-500/[0.07]',    border: 'border-cyan-500/20'    },
  { title: 'إرشادات فيبوناتشي',        subtitle: 'الارتداد، الامتداد، الزمن',                       icon: <GitBranch   className="w-7 h-7" />, color: 'text-teal-400',   bg: 'bg-teal-500/[0.07]',    border: 'border-teal-500/20'    },
  { title: 'إرشادات مربع 9',           subtitle: 'W.D. GANN // السعر، الزمن، والهندسة',            icon: <Grid3X3     className="w-7 h-7" />, color: 'text-orange-400', bg: 'bg-orange-500/[0.07]',  border: 'border-orange-500/20'  },
  { title: 'إدارة المخاطر والنفسية',   subtitle: 'حجم الصفقة، الانضباط، وحماية رأس المال',         icon: <AlertTriangle className="w-7 h-7"/>,color: 'text-red-400',    bg: 'bg-red-500/[0.07]',     border: 'border-red-500/20'     },
  { title: 'إرشادات الترابط',          subtitle: 'الماكرو، الكريبتو، والسيولة',                    icon: <Link2       className="w-7 h-7" />, color: 'text-indigo-400', bg: 'bg-indigo-500/[0.07]',  border: 'border-indigo-500/20'  },
  { title: 'On-Chain & Tokenomics',    subtitle: 'تحليل البلوكتشين واقتصاديات العملة',              icon: <Globe       className="w-7 h-7" />, color: 'text-sky-400',    bg: 'bg-sky-500/[0.07]',     border: 'border-sky-500/20'     },
  { title: 'الاقتصاد الكلي',           subtitle: 'التضخم، الفائدة، والسيولة العالمية',              icon: <TrendingDown className="w-7 h-7"/>, color: 'text-rose-400',   bg: 'bg-rose-500/[0.07]',    border: 'border-rose-500/20'    },
  { title: 'أساسيات الشارت والمصطلحات',subtitle: 'نقطة البداية، الشموع، والفريمات',                icon: <Monitor     className="w-7 h-7" />, color: 'text-violet-400', bg: 'bg-violet-500/[0.07]',  border: 'border-violet-500/20'  },
  { title: 'استراتيجيات التداول',      subtitle: '10 نماذج عملية + التحليل متعدد الفريمات',         icon: <Play        className="w-7 h-7" />, color: 'text-emerald-400',bg: 'bg-emerald-500/[0.07]', border: 'border-emerald-500/20' },
  { title: 'دليل الركود الشامل',       subtitle: 'الفهم، التنبؤ، التحوط، والاستثمار',              icon: <AlertCircle className="w-7 h-7" />, color: 'text-amber-400',  bg: 'bg-amber-500/[0.07]',   border: 'border-amber-500/20'   },
  { title: 'الدورة الاقتصادية والتوقع',subtitle: 'دورات الماكرو، السيناريوهات، والتطبيق العملي',   icon: <RefreshCw   className="w-7 h-7" />, color: 'text-cyan-400',   bg: 'bg-cyan-500/[0.07]',    border: 'border-cyan-500/20'    },
];

// ─── Content Placeholder Modal ─────────────────────────────────────────────────
function LearnContentModal({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" style={{ animation: 'fade-in 0.2s ease forwards' }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full rounded-t-3xl border border-white/[0.08] shadow-2xl flex flex-col"
        style={{
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          maxHeight: 'calc(88dvh - env(safe-area-inset-bottom, 0px))',
          animation: 'slide-up 0.28s cubic-bezier(0.16,1,0.3,1) forwards',
          willChange: 'transform',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-0 shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <button onClick={onClose} aria-label="Back" className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white bg-white/[0.05] hover:bg-white/10 rounded-full transition-all active:scale-95">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 text-right flex-1 mx-3">
            <h2 className="text-white font-bold text-lg truncate" dir="rtl">{topic.title}</h2>
            <p className="text-sm text-white/35 truncate" dir="rtl">{topic.subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white bg-white/[0.05] hover:bg-white/10 rounded-full transition-all active:scale-95">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col items-center justify-center px-6 py-12 gap-6" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 1rem))' }}>
          <div className={`w-20 h-20 rounded-2xl border ${topic.border} ${topic.bg} flex items-center justify-center ${topic.color}`}>
            {topic.icon}
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-white font-black text-xl" dir="rtl">{topic.title}</h3>
            <p className="text-white/40 text-base leading-relaxed" dir="rtl">{topic.subtitle}</p>
          </div>
          <div className="w-full rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] px-5 py-4 text-center">
            <p className="text-sm text-white/50" dir="rtl">
              <span className="text-orange-400 font-bold">قريباً · </span>
              المحتوى التفصيلي لهذا القسم سيكون متاحاً قريباً. يتضمن شرحاً مرئياً خطوة بخطوة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Learn Hub Modal ───────────────────────────────────────────────────────────
interface LearnHubModalProps {
  onClose: () => void;
}

export function LearnHubModal({ onClose }: LearnHubModalProps) {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  function handleCardClick(topic: Topic) {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch {}
    setSelectedTopic(topic);
  }

  return (
    <>
      {/* Main Learn Hub overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black flex flex-col"
        style={{ animation: 'fade-in 0.2s ease forwards', height: 'var(--app-stable-height, 100dvh)' }}
      >
        {/* Header */}
        <div
          className="shrink-0 border-b border-white/[0.06]"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {/* Back button row */}
          <div className="flex items-center justify-between px-5 py-4">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 active:scale-95 transition-all text-sm font-bold tracking-wide"
              aria-label="رجوع للرئيسية"
            >
              <ChevronLeft className="w-6 h-6" />
              <span>رجوع للرئيسية</span>
            </button>
            <p className="text-sm text-white/20 font-mono uppercase tracking-widest">EDUCATIONAL CENTER</p>
          </div>

          {/* Title block */}
          <div className="px-5 pb-4 text-right" dir="rtl">
            <h1 className="text-2xl font-black text-orange-500 leading-tight">Learn Hub 360</h1>
            <p className="text-sm text-white/40 mt-0.5">المركز التعليمي لمدارس التحليل الفني والكمي</p>
          </div>
        </div>

        {/* Scrollable Grid */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 min-h-0"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0.5rem))' }}
        >
          <div className="grid grid-cols-2 gap-3 pb-4">
            {TOPICS.map((topic, i) => (
              <button
                key={i}
                onClick={() => handleCardClick(topic)}
                className={`group relative flex flex-col items-center text-center p-6 rounded-2xl border ${topic.border} ${topic.bg} hover:border-orange-500/30 active:scale-[0.97] transition-all duration-150 overflow-hidden gap-3`}
                dir="rtl"
              >
                {/* Hover glow */}
                <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.06),transparent_70%)]" />

                {/* Favourite star placeholder */}
                <span className="absolute top-2.5 left-2.5 text-white/15 text-sm">☆</span>

                {/* Icon */}
                <div className={`${topic.color} opacity-90`}>{topic.icon}</div>

                {/* Text */}
                <div className="space-y-1 min-w-0 w-full">
                  <p className="text-sm font-bold text-white leading-tight">{topic.title}</p>
                  <p className="text-sm text-white/35 leading-tight">{topic.subtitle}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Coming soon footer */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-5 py-4 text-center mb-2">
            <p className="text-sm text-white/30" dir="rtl">
              <span className="text-orange-500 font-bold">قريباً · </span>
              فيديوهات تفاعلية ومحاضرات صوتية لكل قسم
            </p>
          </div>
        </div>
      </div>

      {/* Drill-down content placeholder */}
      {selectedTopic && (
        <LearnContentModal
          topic={selectedTopic}
          onClose={() => setSelectedTopic(null)}
        />
      )}
    </>
  );
}
