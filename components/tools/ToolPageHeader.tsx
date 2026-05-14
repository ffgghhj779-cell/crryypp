'use client';

/**
 * ToolPageHeader — Full-screen tool page navigation header.
 *
 * Features:
 *   1. "← رجوع" back button using router.back()
 *   2. Telegram WebApp.BackButton SDK — native back button in the TMA header bar
 *   3. Tool name centered, subtitle below
 *   4. Category badge on the right
 */

import { useRouter } from 'next/navigation';
import { useEffect }  from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ToolDef } from '@/components/UnifiedScannerModal';


interface ToolPageHeaderProps {
  tool: ToolDef;
}

export function ToolPageHeader({ tool }: ToolPageHeaderProps) {
  const router = useRouter();

  function goBack() {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch {}
    router.back();
  }

  // ── Telegram native BackButton ──────────────────────────────────────────────
  useEffect(() => {
    const tgBack = (window as any).Telegram?.WebApp?.BackButton;
    if (!tgBack) return;

    tgBack.show();
    tgBack.onClick(goBack);

    return () => {
      tgBack.hide();
      tgBack.offClick(goBack);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header
      className="shrink-0 flex items-center justify-between px-4 border-b border-white/[0.06]"
      style={{
        paddingTop:    'max(env(safe-area-inset-top, 0px), 12px)',
        paddingBottom: '12px',
        minHeight:     '60px',
        background:    'rgba(0,0,0,0.95)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* ── Back button — 44px touch target ────────────────────────────────── */}
      <button
        onClick={goBack}
        aria-label="رجوع للرئيسية"
        className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 active:scale-95 transition-all shrink-0 min-w-[80px]"
        style={{ touchAction: 'manipulation' }}
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-[12px] font-bold tracking-wide">رجوع</span>
      </button>

      {/* ── Tool name — centered ────────────────────────────────────────────── */}
      <div className="flex-1 text-center min-w-0 px-2">
        <h1 className="text-white font-bold text-[15px] leading-tight truncate">
          {tool.name}
        </h1>
        <p className="text-[10px] text-white/35 truncate leading-tight mt-0.5">
          {tool.subtitle}
        </p>
      </div>

      {/* ── Category badge — right side ────────────────────────────────────── */}
      <div className="shrink-0 min-w-[80px] flex justify-end">
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${tool.tagColor}`}>
          {tool.tag}
        </span>
      </div>
    </header>
  );
}
