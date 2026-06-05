'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Asset {
  symbol:  string;
  labelAr: string;
  labelEn: string;
  icon:    string;
  group:   'crypto' | 'commodity';
}

export const ALL_ASSETS: Asset[] = [
  // ── Crypto ──────────────────────────────────────────────────────────────
  { symbol: 'BTCUSDT', labelAr: 'بيتكوين',       labelEn: 'BTC/USDT', icon: '₿',  group: 'crypto' },
  { symbol: 'ETHUSDT', labelAr: 'إيثيريوم',      labelEn: 'ETH/USDT', icon: 'Ξ',  group: 'crypto' },
  { symbol: 'BNBUSDT', labelAr: 'بينانس كوين',   labelEn: 'BNB/USDT', icon: '⬡',  group: 'crypto' },
  { symbol: 'SOLUSDT', labelAr: 'سولانا',         labelEn: 'SOL/USDT', icon: '◎',  group: 'crypto' },
  { symbol: 'XRPUSDT', labelAr: 'ريبل',           labelEn: 'XRP/USDT', icon: '◈',  group: 'crypto' },
  // ── Commodities ──────────────────────────────────────────────────────────
  { symbol: 'XAUUSD',  labelAr: 'ذهب عالمي',     labelEn: 'XAU/USD',  icon: '🥇', group: 'commodity' },
  { symbol: 'WTIUSD',  labelAr: 'نفط خام WTI',   labelEn: 'WTI/USD',  icon: '🛢️', group: 'commodity' },
  { symbol: 'EURUSDT', labelAr: 'يورو / دولار',  labelEn: 'EUR/USD',  icon: '💶', group: 'commodity' },
  { symbol: 'USDEGP',  labelAr: 'دولار / جنيه',  labelEn: 'USD/EGP',  icon: '💵', group: 'commodity' },
  { symbol: 'EGYXAU',  labelAr: 'ذهب مصري 21',   labelEn: 'XAU/EGP',  icon: '🇪🇬', group: 'commodity' },
];

interface Props {
  value:     string;
  onChange:  (symbol: string) => void;
  className?: string;
}

interface DropdownStyle {
  position:    'fixed';
  left:        number;
  right:       number;
  zIndex:      number;
  maxHeight:   string;
  overflowY:   'auto';
  top?:        number;
  bottom?:     number;
}

export function SymbolDropdown({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<DropdownStyle | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = ALL_ASSETS.find(a => a.symbol === value.toUpperCase())
    ?? { symbol: value, labelAr: value, labelEn: value, icon: '📊', group: 'crypto' as const };

  const isCommodity   = current.group === 'commodity';
  const cryptoList    = ALL_ASSETS.filter(a => a.group === 'crypto');
  const commodityList = ALL_ASSETS.filter(a => a.group === 'commodity');

  /** Calculate the best position for the dropdown based on available viewport space */
  const calcStyle = useCallback((): DropdownStyle | null => {
    if (!triggerRef.current) return null;
    const r          = triggerRef.current.getBoundingClientRect();
    const GAP        = 6;
    const PADDING    = 16;
    const spaceBelow = window.innerHeight - r.bottom - PADDING;
    const spaceAbove = r.top - PADDING;
    const openUp     = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxHeight  = Math.max(openUp ? spaceAbove : spaceBelow, 120);

    return {
      position:  'fixed',
      left:      r.left,
      right:     window.innerWidth - r.right,
      zIndex:    999999,
      maxHeight: `${Math.min(maxHeight, 380)}px`,
      overflowY: 'auto',
      ...(openUp
        ? { bottom: window.innerHeight - r.top + GAP }
        : { top:    r.bottom + GAP }),
    };
  }, []);

  const openDropdown = useCallback(() => {
    if (!open) {
      const s = calcStyle();
      setStyle(s);
    }
    setOpen(v => !v);
  }, [open, calcStyle]);

  // Re-calculate on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => setStyle(calcStyle());
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, calcStyle]);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent | TouchEvent) {
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', h, true);
    document.addEventListener('touchstart', h, true);
    return () => {
      document.removeEventListener('mousedown', h, true);
      document.removeEventListener('touchstart', h, true);
    };
  }, [open]);

  function pick(asset: Asset) {
    onChange(asset.symbol);
    setOpen(false);
  }

  // Portal: renders directly on <body> — immune to any overflow/z-index parent issues
  const portal = typeof document !== 'undefined' && open && style
    ? createPortal(
        <div
          dir="rtl"
          style={{
            ...style,
            // Mobile Safari touch-scroll
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          } as React.CSSProperties}
          className="rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
          // Prevent touch events from reaching the outside-click handler
          onTouchMove={e => e.stopPropagation()}
        >
          {/* ── Crypto ───────────────────────────────────────────────── */}
          <div className="px-3 pt-3 pb-1">
            <p className="text-xs font-bold text-blue-400/60 uppercase tracking-widest mb-1.5">كريبتو</p>
            {cryptoList.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onMouseDown={e => { e.preventDefault(); pick(asset); }}
                onTouchEnd={e  => { e.preventDefault(); pick(asset); }}
                className={`w-full flex items-center gap-3 px-2.5 py-3 rounded-xl text-sm transition-all ${
                  value.toUpperCase() === asset.symbol
                    ? 'bg-blue-500/20 text-blue-300 font-bold'
                    : 'text-white/70 active:bg-white/10'
                }`}
              >
                <span className="text-lg w-6 text-center shrink-0">{asset.icon}</span>
                <span className="font-semibold flex-1 text-right">{asset.labelAr}</span>
                <span className="text-xs font-mono text-white/30">{asset.labelEn}</span>
              </button>
            ))}
          </div>

          {/* ── Divider ──────────────────────────────────────────────── */}
          <div className="h-px bg-white/10 mx-3" />

          {/* ── Commodities ──────────────────────────────────────────── */}
          <div className="px-3 pb-3 pt-1">
            <p className="text-xs font-bold text-amber-400/60 uppercase tracking-widest mb-1.5 mt-1">سلع وعملات</p>
            {commodityList.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onMouseDown={e => { e.preventDefault(); pick(asset); }}
                onTouchEnd={e  => { e.preventDefault(); pick(asset); }}
                className={`w-full flex items-center gap-3 px-2.5 py-3 rounded-xl text-sm transition-all ${
                  value.toUpperCase() === asset.symbol
                    ? 'bg-amber-500/20 text-amber-300 font-bold'
                    : 'text-white/70 active:bg-white/10'
                }`}
              >
                <span className="text-lg w-6 text-center shrink-0">{asset.icon}</span>
                <span className="font-semibold flex-1 text-right">{asset.labelAr}</span>
                <span className="text-xs font-mono text-white/30">{asset.labelEn}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={`relative ${className ?? ''}`} dir="rtl">
      {/* ── Trigger button ────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border text-base font-bold transition-all select-none ${
          isCommodity
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            : 'border-blue-500/40 bg-blue-500/10 text-blue-300'
        }`}
      >
        <span className="text-xl leading-none">{current.icon}</span>
        <span className="flex-1 text-right">{current.labelAr}</span>
        <span className="text-xs font-mono text-white/40">{current.labelEn}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform text-white/40 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Portal dropdown ───────────────────────────────────────────── */}
      {portal}
    </div>
  );
}
