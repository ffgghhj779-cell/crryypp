'use client';

import { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { TopBar, BottomNav } from '@/components/NavLayout';
import { Dashboard } from '@/components/Dashboard';
import { ModalsWrapper } from '@/components/Modals';
import { useAppStore } from '@/store/useAppStore';
import { AntiInspect } from '@/components/AntiInspect';

declare global {
  interface Window {
    Telegram?: { WebApp: any };
  }
}

// ─── App Layout ───────────────────────────────────────────────────────────────
export default function AppLayout() {
  const loadFavorites = useAppStore(s => s.loadFavorites);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;

    // ── Core: ready + full-expand (available since v6.0) ─────────────────────
    WebApp.ready();
    WebApp.expand();

    // ── Theme: dark shell — prevents white flash on open (v6.1+) ─────────────
    if (WebApp.isVersionAtLeast('6.1')) {
      WebApp.setHeaderColor('#000000');
      WebApp.setBackgroundColor('#000000');
    }

    // ── Bottom bar color (v7.10+) ─────────────────────────────────────────────
    if (WebApp.isVersionAtLeast('7.10')) {
      WebApp.setBottomBarColor?.('#000000');
    }

    // ── Disable OS vertical-swipe-to-close (v7.7+) ───────────────────────────
    if (WebApp.isVersionAtLeast('7.7')) {
      WebApp.disableVerticalSwipes?.();
    }

    // ── Closing confirmation — prevents accidental exit (v6.2+) ──────────────
    if (WebApp.isVersionAtLeast('6.2')) {
      WebApp.enableClosingConfirmation?.();
    }

    // ── Stable viewport height (v6.0) ─────────────────────────────────────────
    const setStableHeight = () => {
      const h = WebApp.viewportStableHeight || window.innerHeight;
      document.documentElement.style.setProperty('--app-stable-height', `${h}px`);
    };
    setStableHeight();
    WebApp.onEvent('viewportChanged', setStableHeight);

    // ── Auth: verify initData server-side ─────────────────────────────────────
    const rawInitData = WebApp.initData;
    if (rawInitData) {
      fetch('/api/auth/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ initData: rawInitData }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.userId) {
            loadFavorites(data.userId);
          } else {
            console.warn('[Auth] Server rejected initData:', data.error);
          }
        })
        .catch(err => console.error('[Auth] Verification request failed:', err));
    }

    return () => { WebApp.offEvent?.('viewportChanged', setStableHeight); };
  }, [loadFavorites]);

  return (
    // ── Flex-column shell: TopBar | scrollable main | BottomNav ─────────────────────
    <div
      className="bg-black text-white font-sans selection:bg-orange-500/30 flex flex-col overflow-hidden"
      style={{ height: 'var(--app-stable-height, 100dvh)' }}
    >
      <AntiInspect />
      <TopBar />

      {/* Scrollable area — overflow-y:auto here, NOT on html/body */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0">
        <div className="flex justify-center w-full">
          <Dashboard />
        </div>
      </main>

      {/* BottomNav stays in flex flow — no position:fixed, no jitter */}
      <BottomNav />

      {/* ModalsWrapper — position:fixed z-[100], always above BottomNav's z-40 */}
      <ModalsWrapper />
    </div>
  );
}
