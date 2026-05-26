'use client';

/**
 * ToolPageHeader — Full-screen tool page navigation header.
 *
 * Back navigation flow:
 *   1. User taps "رجوع" button  OR  Telegram's native BackButton fires
 *   2. useToolExit() → triggerExit() (provided by ToolsLayout)
 *   3. ToolsLayout animates its motion.div down (spring EXIT_SPRING)
 *   4. After animation completes → router.back()
 *
 * This gives a smooth spring-physics exit before the page unmounts.
 */

import { useEffect }     from 'react';
import { ChevronLeft }   from 'lucide-react';
import { useToolExit }   from '@/lib/tools/ExitContext';
import type { ToolDef }  from '@/components/UnifiedScannerModal';

interface ToolPageHeaderProps {
  tool: ToolDef;
}

export function ToolPageHeader({ tool }: ToolPageHeaderProps) {
  const triggerExit = useToolExit();

  // Wrap triggerExit in a void wrapper for event handlers that don't accept
  // Promise-returning callbacks (Telegram SDK, onClick on button)
  function goBack() {
    // HapticFeedback requires Telegram v6.1+
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.isVersionAtLeast?.('6.1')) {
        tg.HapticFeedback?.impactOccurred('light');
      }
    } catch {}
    void triggerExit();
  }

  // ── Telegram native BackButton ─────────────────────────────────────────────
  // BackButton requires Telegram v6.9+. On older clients isVersionAtLeast
  // returns false and we skip registration silently (no warnings, no crash).
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    // BackButton API was introduced in Telegram Mini Apps v6.9
    const supportsBackButton = tg.isVersionAtLeast?.('6.9') ?? false;
    if (!supportsBackButton) return;

    const tgBack = tg.BackButton;
    if (!tgBack) return;

    tgBack.show();
    tgBack.onClick(goBack);

    return () => {
      tgBack.hide();
      tgBack.offClick(goBack);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header
      className="shrink-0 flex items-center justify-between px-5 border-b border-white/[0.06]"
      style={{
        paddingTop:    'max(env(safe-area-inset-top, 0px), 14px)',
        paddingBottom: '14px',
        /* PHASE 2: bumped min-height from 60px to 70px */
        minHeight:     '70px',
        background:    'rgba(0,0,0,0.95)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* ── Back button — 44px touch target ─────────────────────────────────────────────── */}
      <button
        onClick={goBack}
        aria-label="رجوع للرئيسية"
        className="flex items-center gap-2 text-orange-400 hover:text-orange-300 active:scale-95 transition-all shrink-0 min-w-[80px]"
        style={{ touchAction: 'manipulation' }}
      >
        <ChevronLeft className="w-5 h-5" />
        {/* PHASE 2: bumped back button text from text-[12px] to text-sm (14px) + bolder */}
        <span className="text-sm font-bold tracking-wide">رجوع</span>
      </button>

      {/* ── Tool name — centered ─────────────────────────────────────────────────────── */}
      <div className="flex-1 text-center min-w-0 px-2">
        {/* PHASE 2: bumped title from text-[15px] to text-lg (18px) */}
        <h1 className="text-white font-bold text-lg leading-tight truncate">
          {tool.name}
        </h1>
        {/* PHASE 2: bumped subtitle from text-[10px] to text-xs (12px) */}
        <p className="text-xs text-white/40 truncate leading-tight mt-0.5">
          {tool.subtitle}
        </p>
      </div>

      {/* ── Category badge — right side ──────────────────────────────────────────────────── */}
      <div className="shrink-0 min-w-[80px] flex justify-end">
        {/* PHASE 2: bumped badge from text-[9px] to text-[11px] */}
        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${tool.tagColor}`}>
          {tool.tag}
        </span>
      </div>
    </header>
  );
}
