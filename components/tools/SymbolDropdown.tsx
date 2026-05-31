'use client';

/**
 * components/tools/SymbolDropdown.tsx
 *
 * Replaces the plain text symbol input in all manual/fetch tools.
 * Shows a premium button that opens a dropdown with Crypto + Commodity assets.
 * Works with any tool that had: <input value={symbol} onChange={...} />
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Asset {
  symbol:  string;
  labelAr: string;
  labelEn: string;
  icon:    string;
  group:   'crypto' | 'commodity';
}

export const ALL_ASSETS: Asset[] = [
  // ── Crypto ──────────────────────────────────────────────────────────────
  { symbol: 'BTCUSDT', labelAr: 'بيتكوين',      labelEn: 'BTC/USDT', icon: '₿',  group: 'crypto' },
  { symbol: 'ETHUSDT', labelAr: 'إيثيريوم',     labelEn: 'ETH/USDT', icon: 'Ξ',  group: 'crypto' },
  { symbol: 'BNBUSDT', labelAr: 'بينانس كوين',  labelEn: 'BNB/USDT', icon: '⬡',  group: 'crypto' },
  { symbol: 'SOLUSDT', labelAr: 'سولانا',        labelEn: 'SOL/USDT', icon: '◎',  group: 'crypto' },
  { symbol: 'XRPUSDT', labelAr: 'ريبل',          labelEn: 'XRP/USDT', icon: '◈',  group: 'crypto' },
  // ── Commodities ──────────────────────────────────────────────────────────
  { symbol: 'XAUUSD',  labelAr: 'ذهب عالمي',    labelEn: 'XAU/USD',  icon: '🥇', group: 'commodity' },
  { symbol: 'WTIUSD',  labelAr: 'نفط خام WTI',  labelEn: 'WTI/USD',  icon: '🛢️', group: 'commodity' },
  { symbol: 'USDEGP',  labelAr: 'دولار / جنيه', labelEn: 'USD/EGP',  icon: '💵', group: 'commodity' },
  { symbol: 'EGYXAU',  labelAr: 'ذهب مصري 21',  labelEn: 'XAU/EGP',  icon: '🇪🇬', group: 'commodity' },
  { symbol: 'EURUSD',  labelAr: 'EUR/USD',      labelEn: 'EUR/USD',  icon: '💶', group: 'commodity' },
];

interface Props {
  value:    string;
  onChange: (symbol: string) => void;
  /** optional className wrapper override */
  className?: string;
}

export function SymbolDropdown({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = ALL_ASSETS.find(a => a.symbol === value.toUpperCase())
    ?? { symbol: value, labelAr: value, labelEn: value, icon: '📊', group: 'crypto' as const };

  const isCommodity = current.group === 'commodity';
  const cryptoList    = ALL_ASSETS.filter(a => a.group === 'crypto');
  const commodityList = ALL_ASSETS.filter(a => a.group === 'commodity');

  // Close on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function pick(asset: Asset) {
    onChange(asset.symbol);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${open ? 'z-[9999]' : 'z-10'} ${className ?? ''}`} dir="rtl">
      {/* ── Trigger ───────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border text-base font-bold transition-all ${
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

      {/* ── Dropdown ──────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute top-full mt-2 right-0 left-0 z-[9999] rounded-2xl border border-white/10 bg-zinc-900/98 backdrop-blur-xl shadow-2xl overflow-hidden">

          {/* Crypto group */}
          <div className="px-3 pt-3 pb-1">
            <p className="text-xs font-bold text-blue-400/60 uppercase tracking-widest mb-1.5">كريبتو</p>
            {cryptoList.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => pick(asset)}
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
            <p className="text-xs font-bold text-amber-400/60 uppercase tracking-widest mb-1.5">سلع</p>
            {commodityList.map(asset => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => pick(asset)}
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
        </div>
      )}
    </div>
  );
}
