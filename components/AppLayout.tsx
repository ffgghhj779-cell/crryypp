'use client';

import { useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
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

const DISCLAIMER_KEY = 'ct360_disclaimer_v1';

// ─── First-launch Disclaimer Sheet ───────────────────────────────────────────
function DisclaimerSheet({ onAccept }: { onAccept: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', animation: 'fade-in 0.3s ease forwards' }}
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl border border-white/[0.08] overflow-hidden"
        style={{
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(40px)',
          animation: 'slide-up 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Orange glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 bg-orange-500/15 blur-3xl rounded-full" />

        <div className="relative px-6 pb-6 space-y-5">
          {/* Icon + Title */}
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-orange-500" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg tracking-tight">إخلاء مسؤولية هام</h2>
              <p className="text-white/40 text-sm mt-0.5 font-mono tracking-widest uppercase">Important Disclaimer</p>
            </div>
          </div>

          {/* Disclaimer body */}
          <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.04] p-6 space-y-3 text-right" dir="rtl">
            <p className="text-base text-white/70 leading-relaxed">
              جميع التحليلات والمعلومات المقدمة في هذا التطبيق هي{' '}
              <span className="text-orange-400 font-bold">لأغراض تعليمية وإعلامية فقط</span>،
              ولا تُعدّ نصيحةً استثمارية أو توصيةً بالشراء أو البيع.
            </p>
            <p className="text-base text-white/70 leading-relaxed">
              أسواق العملات الرقمية <span className="text-red-400 font-bold">شديدة التقلب</span> وتنطوي
              على مخاطر عالية قد تؤدي إلى خسارة رأس المال. تحمّل مسؤولية قراراتك الاستثمارية بالكامل.
            </p>
            <p className="text-sm text-white/35 leading-relaxed">
              باستخدامك هذا التطبيق، فإنك تقرّ بأنك قرأت هذا الإخلاء وفهمته ووافقت عليه.
            </p>
          </div>

          {/* Accept button */}
          <button
            onClick={onAccept}
            className="w-full flex items-center justify-center gap-3.5 py-4 rounded-2xl font-black text-lg text-white tracking-wide transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              boxShadow: '0 0 32px rgba(249,115,22,0.35)',
            }}
          >
            <ShieldCheck className="w-5 h-5" />
            فهمت وأوافق — ابدأ التحليل
          </button>

          <p className="text-center text-sm text-white/20 font-mono">
            Crypto Terminal 360 · v3.0.0
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── App Layout ───────────────────────────────────────────────────────────────
export default function AppLayout() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean | null>(null);
  const loadFavorites = useAppStore(s => s.loadFavorites);

  useEffect(() => {
    // Check disclaimer on client only (SSR safe)
    const accepted = localStorage.getItem(DISCLAIMER_KEY) === '1';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisclaimerAccepted(accepted);
  }, []);

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
    // Prevents OS swipe-down from closing the Mini App while the user drags
    // our NativeSheet. Without this, the gesture conflicts.
    if (WebApp.isVersionAtLeast('7.7')) {
      WebApp.disableVerticalSwipes?.();
    }

    // ── Closing confirmation — prevents accidental exit (v6.2+) ──────────────
    if (WebApp.isVersionAtLeast('6.2')) {
      WebApp.enableClosingConfirmation?.();
    }

    // ── Stable viewport height (v6.0) ─────────────────────────────────────────
    // viewportHeight jitters on scroll; viewportStableHeight only changes when
    // the on-screen keyboard opens/closes — use it for layout height.
    const setStableHeight = () => {
      const h = WebApp.viewportStableHeight || window.innerHeight;
      document.documentElement.style.setProperty('--app-stable-height', `${h}px`);
    };
    setStableHeight();
    WebApp.onEvent('viewportChanged', setStableHeight);

    // ── Auth: verify initData server-side ─────────────────────────────────────
    // VULN-14: NEVER trust initDataUnsafe.user.id — it can be spoofed in DevTools.
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

  function handleAccept() {
    localStorage.setItem(DISCLAIMER_KEY, '1');
    setDisclaimerAccepted(true);
    // Light haptic on Telegram
    try { WebApp.HapticFeedback?.impactOccurred('light'); } catch {}
  }

  // Prevent flash: render nothing until localStorage is read
  if (disclaimerAccepted === null) {
    return (
      <div className="w-full bg-black flex flex-col" style={{ height: 'var(--app-stable-height, 100dvh)' }}>
        <AntiInspect />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    // ── Flex-column shell: TopBar | scrollable main | BottomNav ─────────────────────
    // Height is driven by --app-stable-height (set from viewportStableHeight in JS)
    // so it does NOT reflow on every scroll tick.
    // BottomNav is the LAST flex child — no position:fixed needed, no jitter.
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

      {/* Disclaimer gates the entire app on first launch */}
      {!disclaimerAccepted && <DisclaimerSheet onAccept={handleAccept} />}
    </div>
  );
}
