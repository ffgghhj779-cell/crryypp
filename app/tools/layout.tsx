'use client';

/**
 * Minimal layout shell for /tools/* routes.
 *
 * IMPORTANT — no `ready` gate here.
 * The `--app-stable-height` CSS variable is already set on
 * `document.documentElement` by AppLayout (dashboard). It persists
 * across client-side navigations because it's set on the root element,
 * not inside a React component tree. Re-setting it happens silently in
 * a useEffect without blocking the first render.
 *
 * A `ready` gate (show spinner → check localStorage → render) was the
 * main cause of the "full reload" feel — the spinner matched the
 * ClientRoot loading spinner, making it look like the whole app reloaded.
 */

import { useEffect }  from 'react';
import { useRouter }  from 'next/navigation';

const DISCLAIMER_KEY = 'disclaimer_accepted_v1';

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // ── Disclaimer gate (non-blocking) ────────────────────────────────────────
    // Redirect is rare (only if user deep-links without accepting disclaimer).
    // We do NOT block the initial render for this check — the page renders
    // immediately and redirects silently if needed.
    const accepted = localStorage.getItem(DISCLAIMER_KEY) === '1';
    if (!accepted) {
      router.replace('/');
      return;
    }

    // ── Stable viewport height ────────────────────────────────────────────────
    // Already set by AppLayout for normal in-app navigation. Re-sync here
    // to handle deep-link entries (user opens /tools/slug directly).
    const setH = () => {
      const h = (window as any).Telegram?.WebApp?.viewportStableHeight || window.innerHeight;
      document.documentElement.style.setProperty('--app-stable-height', `${h}px`);
    };
    setH();
    const tgWebApp = (window as any).Telegram?.WebApp;
    tgWebApp?.onEvent?.('viewportChanged', setH);
    return () => { tgWebApp?.offEvent?.('viewportChanged', setH); };
  }, [router]);

  // Render immediately — no loading gate.
  // The CSS variable fallback (100dvh) is used until the effect runs.
  return (
    <div
      className="bg-black text-white font-sans overflow-hidden"
      style={{ height: 'var(--app-stable-height, 100dvh)' }}
    >
      {children}
    </div>
  );
}
