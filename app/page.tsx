import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// AppLayout imports @twa-dev/sdk which accesses `window` at module init.
// dynamic({ ssr: false }) prevents Next.js from executing it server-side,
// eliminating the "window is not defined" prerender error.
const AppLayout = dynamic(() => import('@/components/AppLayout'), { ssr: false });

// Also disable static prerendering for the whole page — this is a Telegram
// Mini App (client-only), so there is nothing meaningful to prerender.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ErrorBoundary>
      <AppLayout />
    </ErrorBoundary>
  );
}
