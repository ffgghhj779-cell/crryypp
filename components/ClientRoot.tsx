'use client';

import nextDynamic from 'next/dynamic';

// @twa-dev/sdk accesses `window` at module init — must be excluded from SSR.
// This Client Component wrapper is the correct place for ssr:false per
// Next.js App Router rules.
const AppLayout = nextDynamic(() => import('@/components/AppLayout'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
    </div>
  ),
});

export function ClientRoot() {
  return <AppLayout />;
}
