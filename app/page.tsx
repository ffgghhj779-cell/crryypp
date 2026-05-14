import nextDynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// AppLayout imports @twa-dev/sdk which accesses `window` at module init.
// nextDynamic({ ssr: false }) prevents Next.js from executing it server-side.
const AppLayout = nextDynamic(() => import('@/components/AppLayout'), { ssr: false });

// Disable static prerendering — this is a Telegram Mini App (client-only).
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ErrorBoundary>
      <AppLayout />
    </ErrorBoundary>
  );
}
