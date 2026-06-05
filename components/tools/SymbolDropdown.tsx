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

export function SymbolDropdown({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = ALL_ASSETS.find(a => a.symbol === value.toUpperCase())
    ?? { symbol: value, labelAr: value, labelEn: value, icon: '📊', group: 'crypto' as const };

  const isCommodity   = current.group === 'commodity';
  const cryptoList    = ALL_ASSETS.filter(a => a.group === 'crypto');
  const commodityList = ALL_ASSETS.filter(a => a.group === 'commodity');

  // Measure trigger position when opening
  const openDropdown = useCallback(() => {
    if (triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
    setOpen(v => !v);
  }, []);

  // Re-measure on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Close on outside click / touch
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

  // Dropdown renders as a fixed portal so overflow:hidden on parents can't clip it
  // 'use client' guarantees document exists — no mounted guard needed
  const dropdown = typeof document !== 'undefined' && open && rect ? createPortal(
    <div
      dir="rtl"
      style={{
        position:  'fixed',
        top:       rect.bottom + 6,
        right:     window.innerWidth - rect.right,
        left:      rect.left,
        zIndex:    999999,
        maxHeight: '320px',
      }}
      className="rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-y-auto"
    >
      {/* Crypto group */}
      <div className="px-3 pt-3 pb-1">
        <p className="text-xs font-bold text-blue-400/60 uppercase tracking-widest mb-1.5">كريبتو</p>
        {cryptoList.map(asset => (
          <button
            key={asset.symbol}
            type="button"
            onMouseDown={e => { e.preventDefault(); pick(asset); }}
            onTouchEnd={e => { e.preventDefault(); pick(asset); }}
            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm transition-all ${
              value.toUpperCase() === asset.symbol
                ? 'bg-blue-500/20 text-blue-300 font-bold'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-lg w-6 text-center">{asset.icon}</span>
            <span className="font-semibold">{asset.labelAr}</span>
            <span className="text-xs font-mono text-white/30 mr-auto">{asset.labelEn}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 mx-3 my-1" />

      {/* Commodity group */}
      <div className="px-3 pb-3 pt-1">
        <p className="text-xs font-bold text-amber-400/60 uppercase tracking-widest mb-1.5">سلع وعملات</p>
        {commodityList.map(asset => (
          <button
            key={asset.symbol}
            type="button"
            onMouseDown={e => { e.preventDefault(); pick(asset); }}
            onTouchEnd={e => { e.preventDefault(); pick(asset); }}
            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm transition-all ${
              value.toUpperCase() === asset.symbol
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-lg w-6 text-center">{asset.icon}</span>
            <span className="font-semibold">{asset.labelAr}</span>
            <span className="text-xs font-mono text-white/30 mr-auto">{asset.labelEn}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className ?? ''}`} dir="rtl">
      {/* ── Trigger ───────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border text-base font-bold transition-all select-none ${
          isCommodity
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
            : 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15'
        }`}
      >
        <span className="text-xl leading-none">{current.icon}</span>
        <span className="flex-1 text-right">{current.labelAr}</span>
        <span className="text-xs font-mono text-white/40">{current.labelEn}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform text-white/40 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Fixed Portal Dropdown ─────────────────────────────────────────── */}
      {dropdown}
    </div>
  );
}
