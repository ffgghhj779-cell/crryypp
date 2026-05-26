'use client';

import { useState } from 'react';
import { BookOpen, ChevronRight, GraduationCap } from 'lucide-react';
import { LearnHubModal } from '@/components/LearnHubModal';

export function LearnHub() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* â”€â”€ Entry Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="w-full" dir="rtl">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <BookOpen className="w-6 h-6 text-orange-500" />
          <h2 className="text-sm font-bold text-white/30 uppercase tracking-widest">
            ظ…ط±ظƒط² ط§ظ„طھط¹ظ„ظ… آ· Learn Hub 360
          </h2>
        </div>

        {/* Prominent card */}
        <button
          onClick={() => {
            try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); } catch {}
            setOpen(true);
          }}
          aria-label="ظپطھط­ ظ…ط±ظƒط² ط§ظ„طھط¹ظ„ظ…"
          className="group relative w-full rounded-2xl overflow-hidden border border-orange-500/25 active:scale-[0.98] transition-all duration-150 text-right"
          style={{ background: 'linear-gradient(135deg, rgba(120,53,15,0.35) 0%, rgba(0,0,0,0.6) 60%)' }}
        >
          {/* Glow blob */}
          <span className="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full bg-orange-500/20 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-orange-500/10 blur-xl" />

          <div className="relative z-10 flex items-center gap-6 px-5 py-5">
            {/* Icon badge */}
            <div className="shrink-0 w-14 h-14 rounded-2xl border border-orange-500/30 bg-orange-500/10 flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-orange-500" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-orange-400/70 font-bold uppercase tracking-widest mb-0.5">
                EDUCATIONAL CENTER
              </p>
              <h3 className="text-white font-black text-lg leading-tight">Learn Hub 360</h3>
              <p className="text-sm text-white/40 mt-0.5 leading-tight">
                ط¥ط±ط´ط§ط¯ط§طھ ظپظ†ظٹط© آ· 18 ظ…ط¯ط±ط³ط© طھط­ظ„ظٹظ„ظٹط©
              </p>
            </div>

            {/* Arrow */}
            <ChevronRight className="shrink-0 w-5 h-5 text-orange-400/60 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all rtl:rotate-180" />
          </div>

          {/* Bottom strip */}
          <div className="relative z-10 flex items-center gap-3 px-5 py-4.5 border-t border-white/[0.05] bg-black/20">
            {['Chart Patterns', 'Wyckoff', 'ICT & SMC', 'Elliott', '+14 more'].map((tag) => (
              <span key={tag} className="text-sm font-bold text-white/25 whitespace-nowrap font-mono">
                {tag}
              </span>
            ))}
          </div>
        </button>
      </section>

      {/* â”€â”€ Full-screen Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {open && <LearnHubModal onClose={() => setOpen(false)} />}
    </>
  );
}
