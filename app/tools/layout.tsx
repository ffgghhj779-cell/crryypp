'use client';

/**
 * app/tools/layout.tsx — Minimal shell for all /tools/* routes.
 *
 * Animations (spring physics, not CSS easing):
 *   ENTER: slides up from 100% → 0  (stiffness 380, damping 36)
 *   EXIT:  slides down 0 → 100%    (stiffness 400, damping 42, faster)
 *
 * The exit is triggered by ToolPageHeader via ToolExitContext.
 * useAnimationControls drives both animations imperatively.
 */

import { useEffect, useCallback }       from 'react';
import { useRouter }                    from 'next/navigation';
import { motion, useAnimationControls } from 'motion/react';
import { ToolExitContext }              from '@/lib/tools/ExitContext';

// Must match the key used in AppLayout.tsx — one source of truth


// Spring presets
const ENTER_SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 0.8 } as const;
const EXIT_SPRING  = { type: 'spring', stiffness: 480, damping: 42, mass: 0.7 } as const;

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const controls = useAnimationControls();

  // ── Entry animation on mount ────────────────────────────────────────────────
  useEffect(() => {
    controls.start({ y: '0%', opacity: 1, transition: ENTER_SPRING });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Exit animation provider ──────────────────────────────────────────────────
  // Called by ToolPageHeader's back button AND Telegram BackButton.
  // Animates out → then navigates (avoids instant unmount jank).
  const triggerExit = useCallback(async () => {
    await controls.start({ y: '100%', opacity: 0, transition: EXIT_SPRING });
    router.back();
  }, [controls, router]);

  // ── Side effects (non-blocking) ─────────────────────────────────────────────
  useEffect(() => {

    // Stable viewport height — already set by AppLayout for in-app navigation.
    // Re-synced here to handle direct deep-link entries.
    const setH = () => {
      const h = (window as any).Telegram?.WebApp?.viewportStableHeight || window.innerHeight;
      document.documentElement.style.setProperty('--app-stable-height', `${h}px`);
    };
    setH();
    const tg = (window as any).Telegram?.WebApp;
    tg?.onEvent?.('viewportChanged', setH);
    return () => { tg?.offEvent?.('viewportChanged', setH); };
  }, [router]);

  return (
    <ToolExitContext.Provider value={triggerExit}>
      <motion.div
        className="bg-black text-white font-sans overflow-visible"
        style={{
          height:      'var(--app-stable-height, 100dvh)',
          willChange:  'transform, opacity',  // GPU layer for 120fps spring
        }}
        // Start off-screen — entry animation begins in useEffect above
        initial={{ y: '100%', opacity: 0 }}
        animate={controls}
      >
        {children}
      </motion.div>
    </ToolExitContext.Provider>
  );
}
