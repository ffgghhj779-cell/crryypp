'use client';

/**
 * /tools/[slug] — Full-screen tool page.
 *
 * Architecture:
 *   ToolsLayout (app/tools/layout.tsx)  ← dark shell, stable height, no BottomNav
 *     ToolPage
 *       ToolPageHeader                  ← back nav + Telegram BackButton SDK
 *       UnifiedScannerModal (pageMode)  ← just the body: inputs + scan + results
 */

import { notFound }          from 'next/navigation';
import { use }               from 'react';
import { ErrorBoundary }     from '@/components/ErrorBoundary';
import { ToolPageHeader }    from '@/components/tools/ToolPageHeader';
import { slugToTool }        from '@/lib/tools/registry';
import dynamic               from 'next/dynamic';

// Lazy-load the heavy scanner (same as dashboard does)
const UnifiedScannerModal = dynamic(
  () => import('@/components/UnifiedScannerModal').then(m => ({ default: m.UnifiedScannerModal })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
        <span className="text-white/30 text-sm">جار تحميل الأداة...</span>
      </div>
    ),
  }
);

// ─── Page props ───────────────────────────────────────────────────────────────
interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic_export = 'force-dynamic';

export default function ToolPage({ params }: PageProps) {
  // Next.js 15+ — params is a Promise, unwrap with use()
  const { slug } = use(params);
  const tool = slugToTool(slug);

  if (!tool) notFound();

  return (
    // Full-screen flex column: header (fixed height) + body (scrollable, flex-1)
    <div className="flex flex-col h-full">
      <ToolPageHeader tool={tool} />

      {/* Body — rendered in pageMode: no NativeSheet, no backdrop, no spring */}
      <ErrorBoundary>
        {/* pageMode=true: renders body only — no NativeSheet, no backdrop, no internal header */}
        {/* onClose is unused in pageMode; back nav is handled by ToolPageHeader + Telegram BackButton */}
        <UnifiedScannerModal
          tool={tool}
          pageMode
          onClose={() => {}}
          onScanComplete={() => {}}
        />
      </ErrorBoundary>
    </div>
  );
}
