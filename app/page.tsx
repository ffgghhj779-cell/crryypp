import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ClientRoot }    from '@/components/ClientRoot';

// Telegram Mini App — no meaningful static output to prerender.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ErrorBoundary>
      <ClientRoot />
    </ErrorBoundary>
  );
}
