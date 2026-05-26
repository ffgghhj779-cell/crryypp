'use client';

import { useState } from 'react';
import {
  TrendingUp, BarChart2, Layers, Activity, Shield,
  BookOpen, Zap, Target, GitBranch, Grid3X3,
  AlertTriangle, Link2, Globe, TrendingDown,
  Monitor, Play, AlertCircle, RefreshCw, X, ChevronLeft,
} from 'lucide-react';

// â”€â”€â”€ Topic Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Topic {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}

const TOPICS: Topic[] = [
  { title: 'Chart Patterns',           subtitle: 'ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ظƒظ„ط§ط³ظٹظƒظٹط© ط§ظ„ط§ط³طھظ…ط±ط§ط±ظٹط© ظˆط§ظ„ط§ظ†ط¹ظƒط§ط³ظٹط©',     icon: <TrendingUp  className="w-7 h-7" />, color: 'text-violet-400', bg: 'bg-violet-500/[0.07]',  border: 'border-violet-500/20'  },
  { title: 'Candle Patterns',          subtitle: 'ظ…ظˆط³ظˆط¹ط© ط£ظ†ظ…ط§ط· ط§ظ„ط´ظ…ظˆط¹ ط§ظ„ظٹط§ط¨ط§ظ†ظٹط© (32 ظ†ظ…ط·)',          icon: <BarChart2   className="w-7 h-7" />, color: 'text-orange-400', bg: 'bg-orange-500/[0.07]',  border: 'border-orange-500/20'  },
  { title: 'ط¥ط±ط´ط§ط¯ط§طھ ظ…ظ†ظ‡ط¬ظٹط© ظˆط§ظٹظƒظˆظپ',    subtitle: 'ط§ظ„طھط¬ظ…ظٹط¹ ظˆط§ظ„طھطµط±ظٹظپ ظˆظ‚ط±ط§ط،ط© ط§ظ„ظپظˆظ„ظٹظˆظ…',                icon: <Layers      className="w-7 h-7" />, color: 'text-sky-400',    bg: 'bg-sky-500/[0.07]',     border: 'border-sky-500/20'     },
  { title: 'ط¥ط±ط´ط§ط¯ط§طھ ظ…ظˆط¬ط§طھ ط§ظ„ظٹظˆطھ',      subtitle: 'ط§ظ„ط¯ط§ظپط¹ط© ظˆط§ظ„طھطµط­ظٹط­ظٹط© ظˆط¯ظ„ظٹظ„ ظپظٹط¨ظˆظ†ط§طھط´ظٹ',             icon: <Activity    className="w-7 h-7" />, color: 'text-emerald-400',bg: 'bg-emerald-500/[0.07]', border: 'border-emerald-500/20' },
  { title: 'ICT & SMC',                subtitle: 'ظ…ظپط§ظ‡ظٹظ… ط§ظ„ط£ظ…ظˆط§ظ„ ط§ظ„ط°ظƒظٹط© ظˆط§ظ„طھط¯ط§ظˆظ„ ط§ظ„ظ…ط¤ط³ط³ظٹ',          icon: <Shield      className="w-7 h-7" />, color: 'text-amber-400',  bg: 'bg-amber-500/[0.07]',   border: 'border-amber-500/20'   },
  { title: 'ط¥ط±ط´ط§ط¯ط§طھ ظ†ط¸ط±ظٹط© ط¯ط§ظˆ',        subtitle: 'ط§ظ„ظ…ط¨ط§ط¯ط¦طŒ ظ…ط±ط§ط­ظ„ ط§ظ„ط³ظˆظ‚طŒ ظˆظ‡ظٹظƒظ„ ط§ظ„ط§طھط¬ط§ظ‡',            icon: <BookOpen    className="w-7 h-7" />, color: 'text-pink-400',   bg: 'bg-pink-500/[0.07]',    border: 'border-pink-500/20'    },
  { title: 'ط¥ط±ط´ط§ط¯ط§طھ ظ…ط¤ط´ط±ط§طھ ط§ظ„ط²ط®ظ…',    subtitle: 'RSI, MACD, ط§ظ„ظ…طھظˆط³ط·ط§طھطŒ ظˆط§ظ„ط­ط¬ظ…',                   icon: <Zap         className="w-7 h-7" />, color: 'text-yellow-400', bg: 'bg-yellow-500/[0.07]',  border: 'border-yellow-500/20'  },
  { title: 'ط¥ط±ط´ط§ط¯ط§طھ ط§ظ„ظ‡ط§ط±ظ…ظˆظ†ظٹظƒ',       subtitle: 'ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„طھظˆط§ظپظ‚ظٹط© ظˆظ†ط³ط¨ ظپظٹط¨ظˆظ†ط§طھط´ظٹ ط§ظ„ط¯ظ‚ظٹظ‚ط©',        icon: <Target      className="w-7 h-7" />, color: 'text-cyan-400',   bg: 'bg-cyan-500/[0.07]',    border: 'border-cyan-500/20'    },
  { title: 'ط¥ط±ط´ط§ط¯ط§طھ ظپظٹط¨ظˆظ†ط§طھط´ظٹ',        subtitle: 'ط§ظ„ط§ط±طھط¯ط§ط¯طŒ ط§ظ„ط§ظ…طھط¯ط§ط¯طŒ ط§ظ„ط²ظ…ظ†',                       icon: <GitBranch   className="w-7 h-7" />, color: 'text-teal-400',   bg: 'bg-teal-500/[0.07]',    border: 'border-teal-500/20'    },
  { title: 'ط¥ط±ط´ط§ط¯ط§طھ ظ…ط±ط¨ط¹ 9',           subtitle: 'W.D. GANN // ط§ظ„ط³ط¹ط±طŒ ط§ظ„ط²ظ…ظ†طŒ ظˆط§ظ„ظ‡ظ†ط¯ط³ط©',            icon: <Grid3X3     className="w-7 h-7" />, color: 'text-orange-400', bg: 'bg-orange-500/[0.07]',  border: 'border-orange-500/20'  },
  { title: 'ط¥ط¯ط§ط±ط© ط§ظ„ظ…ط®ط§ط·ط± ظˆط§ظ„ظ†ظپط³ظٹط©',   subtitle: 'ط­ط¬ظ… ط§ظ„طµظپظ‚ط©طŒ ط§ظ„ط§ظ†ط¶ط¨ط§ط·طŒ ظˆط­ظ…ط§ظٹط© ط±ط£ط³ ط§ظ„ظ…ط§ظ„',         icon: <AlertTriangle className="w-7 h-7"/>,color: 'text-red-400',    bg: 'bg-red-500/[0.07]',     border: 'border-red-500/20'     },
  { title: 'ط¥ط±ط´ط§ط¯ط§طھ ط§ظ„طھط±ط§ط¨ط·',          subtitle: 'ط§ظ„ظ…ط§ظƒط±ظˆطŒ ط§ظ„ظƒط±ظٹط¨طھظˆطŒ ظˆط§ظ„ط³ظٹظˆظ„ط©',                    icon: <Link2       className="w-7 h-7" />, color: 'text-indigo-400', bg: 'bg-indigo-500/[0.07]',  border: 'border-indigo-500/20'  },
  { title: 'On-Chain & Tokenomics',    subtitle: 'طھط­ظ„ظٹظ„ ط§ظ„ط¨ظ„ظˆظƒطھط´ظٹظ† ظˆط§ظ‚طھطµط§ط¯ظٹط§طھ ط§ظ„ط¹ظ…ظ„ط©',              icon: <Globe       className="w-7 h-7" />, color: 'text-sky-400',    bg: 'bg-sky-500/[0.07]',     border: 'border-sky-500/20'     },
  { title: 'ط§ظ„ط§ظ‚طھطµط§ط¯ ط§ظ„ظƒظ„ظٹ',           subtitle: 'ط§ظ„طھط¶ط®ظ…طŒ ط§ظ„ظپط§ط¦ط¯ط©طŒ ظˆط§ظ„ط³ظٹظˆظ„ط© ط§ظ„ط¹ط§ظ„ظ…ظٹط©',              icon: <TrendingDown className="w-7 h-7"/>, color: 'text-rose-400',   bg: 'bg-rose-500/[0.07]',    border: 'border-rose-500/20'    },
  { title: 'ط£ط³ط§ط³ظٹط§طھ ط§ظ„ط´ط§ط±طھ ظˆط§ظ„ظ…طµط·ظ„ط­ط§طھ',subtitle: 'ظ†ظ‚ط·ط© ط§ظ„ط¨ط¯ط§ظٹط©طŒ ط§ظ„ط´ظ…ظˆط¹طŒ ظˆط§ظ„ظپط±ظٹظ…ط§طھ',                icon: <Monitor     className="w-7 h-7" />, color: 'text-violet-400', bg: 'bg-violet-500/[0.07]',  border: 'border-violet-500/20'  },
  { title: 'ط§ط³طھط±ط§طھظٹط¬ظٹط§طھ ط§ظ„طھط¯ط§ظˆظ„',      subtitle: '10 ظ†ظ…ط§ط°ط¬ ط¹ظ…ظ„ظٹط© + ط§ظ„طھط­ظ„ظٹظ„ ظ…طھط¹ط¯ط¯ ط§ظ„ظپط±ظٹظ…ط§طھ',         icon: <Play        className="w-7 h-7" />, color: 'text-emerald-400',bg: 'bg-emerald-500/[0.07]', border: 'border-emerald-500/20' },
  { title: 'ط¯ظ„ظٹظ„ ط§ظ„ط±ظƒظˆط¯ ط§ظ„ط´ط§ظ…ظ„',       subtitle: 'ط§ظ„ظپظ‡ظ…طŒ ط§ظ„طھظ†ط¨ط¤طŒ ط§ظ„طھط­ظˆط·طŒ ظˆط§ظ„ط§ط³طھط«ظ…ط§ط±',              icon: <AlertCircle className="w-7 h-7" />, color: 'text-amber-400',  bg: 'bg-amber-500/[0.07]',   border: 'border-amber-500/20'   },
  { title: 'ط§ظ„ط¯ظˆط±ط© ط§ظ„ط§ظ‚طھطµط§ط¯ظٹط© ظˆط§ظ„طھظˆظ‚ط¹',subtitle: 'ط¯ظˆط±ط§طھ ط§ظ„ظ…ط§ظƒط±ظˆطŒ ط§ظ„ط³ظٹظ†ط§ط±ظٹظˆظ‡ط§طھطŒ ظˆط§ظ„طھط·ط¨ظٹظ‚ ط§ظ„ط¹ظ…ظ„ظٹ',   icon: <RefreshCw   className="w-7 h-7" />, color: 'text-cyan-400',   bg: 'bg-cyan-500/[0.07]',    border: 'border-cyan-500/20'    },
];

// â”€â”€â”€ Content Placeholder Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            <p className="text-white/40 text-lg leading-relaxed" dir="rtl">{topic.subtitle}</p>
          </div>
          <div className="w-full rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] px-5 py-4 text-center">
            <p className="text-sm text-white/50" dir="rtl">
              <span className="text-orange-400 font-bold">ظ‚ط±ظٹط¨ط§ظ‹ آ· </span>
              ط§ظ„ظ…ط­طھظˆظ‰ ط§ظ„طھظپطµظٹظ„ظٹ ظ„ظ‡ط°ط§ ط§ظ„ظ‚ط³ظ… ط³ظٹظƒظˆظ† ظ…طھط§ط­ط§ظ‹ ظ‚ط±ظٹط¨ط§ظ‹. ظٹطھط¶ظ…ظ† ط´ط±ط­ط§ظ‹ ظ…ط±ط¦ظٹط§ظ‹ ط®ط·ظˆط© ط¨ط®ط·ظˆط©.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Learn Hub Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              aria-label="ط±ط¬ظˆط¹ ظ„ظ„ط±ط¦ظٹط³ظٹط©"
            >
              <ChevronLeft className="w-6 h-6" />
              <span>ط±ط¬ظˆط¹ ظ„ظ„ط±ط¦ظٹط³ظٹط©</span>
            </button>
            <p className="text-sm text-white/20 font-mono uppercase tracking-widest">EDUCATIONAL CENTER</p>
          </div>

          {/* Title block */}
          <div className="px-5 pb-4 text-right" dir="rtl">
            <h1 className="text-2xl font-black text-orange-500 leading-tight">Learn Hub 360</h1>
            <p className="text-sm text-white/40 mt-0.5">ط§ظ„ظ…ط±ظƒط² ط§ظ„طھط¹ظ„ظٹظ…ظٹ ظ„ظ…ط¯ط§ط±ط³ ط§ظ„طھط­ظ„ظٹظ„ ط§ظ„ظپظ†ظٹ ظˆط§ظ„ظƒظ…ظٹ</p>
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
                <span className="absolute top-2.5 left-2.5 text-white/15 text-sm">âک†</span>

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
              <span className="text-orange-500 font-bold">ظ‚ط±ظٹط¨ط§ظ‹ آ· </span>
              ظپظٹط¯ظٹظˆظ‡ط§طھ طھظپط§ط¹ظ„ظٹط© ظˆظ…ط­ط§ط¶ط±ط§طھ طµظˆطھظٹط© ظ„ظƒظ„ ظ‚ط³ظ…
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
