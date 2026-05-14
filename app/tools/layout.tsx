'use client';

/**
 * Minimal layout shell for /tools/* routes.
 *
 * This layout intentionally has NO TopBar, NO BottomNav, NO ModalsWrapper.
 * The tool page is a full-screen, standalone experience.
 *
 * Responsibilities:
 *   - Set --app-stable-height CSS variable (same as AppLayout does for dashboard)
 *   - Gate on disclaimer acceptance (redirect to / if not accepted)
 *   - Apply dark background and correct overflow model
 */

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';

const DISCLAIMER_KEY = 'disclaimer_accepted_v1';

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // ── Disclaimer gate ──────────────────────────────────────────────────────
    // If the user somehow lands on a tool URL without accepting the disclaimer,
    // send them back to the root so AppLayout can show the disclaimer sheet.
    const accepted = localStorage.getItem(DISCLAIMER_KEY) === '1';
    if (!accepted) {
      router.replace('/');
      return;
    }

    // ── Stable viewport height (mirrors AppLayout logic) ─────────────────────
    const setH = () => {
      const h = (window.Telegram?.WebApp as any)?.viewportStableHeight || window.innerHeight;
      document.documentElement.style.setProperty('--app-stable-height', `${h}px`);
    };
    setH();
    const tgWebApp = (window as any).Telegram?.WebApp;
    tgWebApp?.onEvent?.('viewportChanged', setH);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    return () => { tgWebApp?.offEvent?.('viewportChanged', setH); };
  }, [router]);

  if (!ready) {
    // Dark splash while checking disclaimer & measuring height
    return (
      <div
        className="flex items-center justify-center bg-black"
        style={{ height: 'var(--app-stable-height, 100dvh)' }}
      >
        <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="bg-black text-white font-sans overflow-hidden"
      style={{ height: 'var(--app-stable-height, 100dvh)' }}
    >
      {children}
    </div>
  );
}
