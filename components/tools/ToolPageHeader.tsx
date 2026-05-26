'use client';

/**
 * ToolPageHeader — Full-screen tool page navigation header.
 * PHASE 3: Massively upscaled — bigger title, taller header, larger back button
 */

import { useEffect }     from 'react';
import { ChevronLeft }   from 'lucide-react';
import { useToolExit }   from '@/lib/tools/ExitContext';
import type { ToolDef }  from '@/components/UnifiedScannerModal';
import { AssetSelector } from '@/components/tools/AssetSelector';

interface ToolPageHeaderProps {
  tool: ToolDef;
}

export function ToolPageHeader({ tool }: ToolPageHeaderProps) {
  const triggerExit = useToolExit();

  function goBack() {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.isVersionAtLeast?.('6.1')) {
        tg.HapticFeedback?.impactOccurred('light');
      }
    } catch {}
    void triggerExit();
  }

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;
    const supportsBackButton = tg.isVersionAtLeast?.('6.9') ?? false;
    if (!supportsBackButton) return;
    const tgBack = tg.BackButton;
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
      className="shrink-0 flex flex-col border-b border-white/[0.06]"
      style={{
        paddingTop:    'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: '10px',
        background:    'rgba(0,0,0,0.95)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Row 1: back + title + badge */}
      <div className="flex items-center justify-between px-5" style={{ minHeight: '52px' }}>
        {/* Back button */}
        <button
          onClick={goBack}
          aria-label="رجوع للرئيسية"
          className="flex items-center gap-2 text-orange-400 hover:text-orange-300 active:scale-95 transition-all shrink-0 min-w-[80px]"
          style={{ touchAction: 'manipulation' }}
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="text-xl font-bold tracking-wide">رجوع</span>
        </button>

        {/* Tool name — centered */}
        <div className="flex-1 text-center min-w-0 px-3">
          <h1 className="text-white font-black text-xl leading-tight truncate">
            {tool.name}
          </h1>
          <p className="text-sm text-white/50 truncate leading-tight mt-0.5 font-medium">
            {tool.subtitle}
          </p>
        </div>

        {/* Category badge */}
        <div className="shrink-0 min-w-[80px] flex justify-end">
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${tool.tagColor}`}>
            {tool.tag}
          </span>
        </div>
      </div>

      {/* Row 2: Asset selector strip */}
      <div className="flex items-center justify-end px-5 pt-2 pb-1">
        <AssetSelector />
      </div>
    </header>
  );
}
