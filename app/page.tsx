import AppLayout from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Page() {
  return (
    <ErrorBoundary>
      <AppLayout />
    </ErrorBoundary>
  );
}
