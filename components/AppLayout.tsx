'use client';

import { useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { TopBar, BottomNav } from '@/components/NavLayout';
import { Dashboard } from '@/components/Dashboard';
import { ModalsWrapper } from '@/components/Modals';
import { useAppStore } from '@/store/useAppStore';

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export default function AppLayout() {
  const [isTMA, setIsTMA] = useState(false);
  const loadFavorites = useAppStore(s => s.loadFavorites);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#000000');
      WebApp.setBackgroundColor('#000000');
      // Disable closing confirmation for smoother feel
      WebApp.enableClosingConfirmation?.();
      setIsTMA(true);

      const user = WebApp.initDataUnsafe?.user;
      if (user?.id) {
        // Wire up Supabase favorites persistence with the real Telegram user ID
        loadFavorites(user.id);
      }
    }
  }, [loadFavorites]);

  return (
    <div
      className="bg-black text-white font-sans selection:bg-orange-500/30 overflow-x-hidden"
      style={{ height: 'var(--tg-viewport-height, 100dvh)', display: 'flex', flexDirection: 'column' }}
    >
      <TopBar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="flex justify-center w-full">
          <Dashboard />
        </div>
      </main>
      <BottomNav />
      <ModalsWrapper />
    </div>
  );
}
