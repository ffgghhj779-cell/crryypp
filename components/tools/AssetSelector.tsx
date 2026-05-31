'use client';

/**
 * components/tools/AssetSelector.tsx
 * 
 * A premium dropdown for selecting the analysis asset across all tools.
 * Groups: Crypto | Commodities
 * Integrates with MarketDataContext via setSymbol().
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMarketData } from '@/context/MarketDataContext';

interface Asset {
  symbol:  string;
  labelAr: string;
  labelEn: string;
  icon:    string;
  group:   'crypto' | 'commodity';
}

export const ASSETS: Asset[] = [
  // ── Crypto ──────────────────────────────────────────────────────────────
  { symbol: 'BTCUSDT', labelAr: 'بيتكوين',  labelEn: 'BTC/USDT', icon: '₿',  group: 'crypto' },
  { symbol: 'ETHUSDT', labelAr: 'إيثيريوم', labelEn: 'ETH/USDT', icon: 'Ξ',  group: 'crypto' },
  { symbol: 'BNBUSDT', labelAr: 'بينانس',   labelEn: 'BNB/USDT', icon: '⬡',  group: 'crypto' },
  { symbol: 'SOLUSDT', labelAr: 'سولانا',   labelEn: 'SOL/USDT', icon: '◎',  group: 'crypto' },
  { symbol: 'XRPUSDT', labelAr: 'ريبل',     labelEn: 'XRP/USDT', icon: '◈',  group: 'crypto' },
  // ── Commodities ──────────────────────────────────────────────────────────
  { symbol: 'XAUUSD',  labelAr: 'ذهب عالمي',   labelEn: 'XAU/USD',  icon: '🥇', group: 'commodity' },
  { symbol: 'WTIUSD',  labelAr: 'نفط خام WTI', labelEn: 'WTI/USD',  icon: '🛢️', group: 'commodity' },
  { symbol: 'USDEGP',  labelAr: 'دولار/جنيه',  labelEn: 'USD/EGP',  icon: '💵', group: 'commodity' },
  { symbol: 'EGYXAU',  labelAr: 'ذهب مصري 21', labelEn: 'XAU/EGP',  icon: '🇪🇬', group: 'commodity' },
  { symbol: 'EURUSD',  labelAr: 'EUR/USD',     labelEn: 'EUR/USD',  icon: '💶', group: 'commodity' },
];

export function AssetSelector() {
  const { symbol, setSymbol } = useMarketData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = ASSETS.find(a => a.symbol === symbol) ?? ASSETS[0];
  const cryptoAssets    = ASSETS.filter(a => a.group === 'crypto');
  const commodityAssets = ASSETS.filter(a => a.group === 'commodity');

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(asset: Asset) {
    setSymbol(asset.symbol);
    setOpen(false);
  }

  const isCommodity = current.group === 'commodity';

  return (
    <div ref={ref} className={`relative ${open ? 'z-[9999]' : 'z-10'}`} dir="rtl">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all ${
          isCommodity
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
            : 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
        }`}
      >
        <span className="text-base leading-none">{current.icon}</span>
        <span>{current.labelAr}</span>
        <span className="text-xs font-mono opacity-60">{current.labelEn}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-2 right-0 z-[9999] w-52 rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Crypto group */}
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1.5">كريبتو</p>
            {cryptoAssets.map(asset => (
              <button
                key={asset.symbol}
                onClick={() => select(asset)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all ${
                  symbol === asset.symbol
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-base w-5 text-center">{asset.icon}</span>
                <span className="font-semibold">{asset.labelAr}</span>
                <span className="text-xs font-mono text-white/30 mr-auto">{asset.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10 mx-3 my-1" />

          {/* Commodities group */}
          <div className="px-3 pb-2.5 pt-1">
            <p className="text-xs font-bold text-amber-500/50 uppercase tracking-widest mb-1.5">سلع</p>
            {commodityAssets.map(asset => (
              <button
                key={asset.symbol}
                onClick={() => select(asset)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all ${
                  symbol === asset.symbol
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-base w-5 text-center">{asset.icon}</span>
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
