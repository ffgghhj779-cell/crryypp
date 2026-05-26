'use client';

import { startTransition } from 'react';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TickItem {
  id:        string;
  symbol:    string;
  label:     string;
  price:     string;
  change:    string;
  changePct: number;
  pos:       boolean;
  icon:      string;
  source:    'binance' | 'commodity';
  unit?:     string;
}

// ─── Crypto symbols via Binance WebSocket ─────────────────────────────────────
const CRYPTO_SYMBOLS = [
  { s: 'BTCUSDT',  label: 'BTC',  icon: '₿' },
  { s: 'ETHUSDT',  label: 'ETH',  icon: 'Ξ' },
  { s: 'SOLUSDT',  label: 'SOL',  icon: '◎' },
  { s: 'BNBUSDT',  label: 'BNB',  icon: '⬡' },
  { s: 'XRPUSDT',  label: 'XRP',  icon: '✕' },
  { s: 'DOGEUSDT', label: 'DOGE', icon: 'Ð' },
];

// ─── Commodity display config ─────────────────────────────────────────────────
const COMMODITY_ORDER = ['XAU/USD', 'XAU/EGP', 'WTI', 'USD/EGP'];

// ─── Price formatters ─────────────────────────────────────────────────────────
function fmtCrypto(p: number)    { return p >= 1 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(5); }
function fmtGold(p: number)      { return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtOil(p: number)       { return p.toFixed(2); }
function fmtEgp(p: number)       { return p.toLocaleString('ar-EG', { maximumFractionDigits: 0 }); }
function fmtRate(p: number)      { return p.toFixed(2); }

// ─── Component ────────────────────────────────────────────────────────────────
export function MarketTicker() {
  const [cryptoTicks, setCryptoTicks] = useState<Map<string, TickItem>>(new Map());
  const [commodityTicks, setCommodityTicks] = useState<TickItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const commodityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch commodities (REST, every 60s) ────────────────────────────────────
  const fetchCommodities = useCallback(async () => {
    try {
      const res = await fetch('/api/commodities', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const items: TickItem[] = [];

      // Gold XAU/USD
      if (data.gold) {
        items.push({
          id:        'XAU/USD',
          symbol:    'XAU',
          label:     'ذهب دولار',
          price:     `$${fmtGold(data.gold.price)}`,
          change:    (data.gold.changePct >= 0 ? '+' : '') + data.gold.changePct.toFixed(2) + '%',
          changePct: data.gold.changePct,
          pos:       data.gold.changePct >= 0,
          icon:      '🥇',
          source:    'commodity',
          unit:      '/oz',
        });
      }

      // Egyptian Gold XAU/EGP
      if (data.egyptianGold) {
        items.push({
          id:        'XAU/EGP',
          symbol:    'ذهب مصري',
          label:     'عيار 21',
          price:     `${fmtEgp(data.egyptianGold.price)} ج`,
          change:    (data.egyptianGold.changePct >= 0 ? '+' : '') + data.egyptianGold.changePct.toFixed(2) + '%',
          changePct: data.egyptianGold.changePct,
          pos:       data.egyptianGold.changePct >= 0,
          icon:      '🇪🇬',
          source:    'commodity',
          unit:      '/جرام',
        });
      }

      // WTI Oil
      if (data.oil) {
        items.push({
          id:        'WTI',
          symbol:    'WTI',
          label:     'نفط خام',
          price:     `$${fmtOil(data.oil.price)}`,
          change:    (data.oil.changePct >= 0 ? '+' : '') + data.oil.changePct.toFixed(2) + '%',
          changePct: data.oil.changePct,
          pos:       data.oil.changePct >= 0,
          icon:      '🛢️',
          source:    'commodity',
          unit:      '/bbl',
        });
      }

      // USD/EGP rate
      if (data.usdEgp) {
        items.push({
          id:        'USD/EGP',
          symbol:    'USD/EGP',
          label:     'سعر الدولار',
          price:     `${fmtRate(data.usdEgp.price)} ج`,
          change:    (data.usdEgp.changePct >= 0 ? '+' : '') + data.usdEgp.changePct.toFixed(2) + '%',
          changePct: data.usdEgp.changePct,
          pos:       data.usdEgp.changePct >= 0,
          icon:      '💵',
          source:    'commodity',
        });
      }

      startTransition(() => setCommodityTicks(items));
    } catch {
      // Silent fail — commodity data is supplementary
    }
  }, []);

  // ─── Binance WebSocket for crypto ───────────────────────────────────────────
  useEffect(() => {
    const streams = CRYPTO_SYMBOLS.map(s => `${s.s.toLowerCase()}@miniTicker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg  = JSON.parse(e.data);
          const d    = msg.data ?? msg;
          const sym  = CRYPTO_SYMBOLS.find(x => x.s === d.s);
          if (!sym) return;
          const price     = parseFloat(d.c);
          const changePct = parseFloat(d.P);

          setCryptoTicks(prev => {
            const next = new Map(prev);
            next.set(sym.label, {
              id:        sym.label,
              symbol:    sym.label,
              label:     sym.label,
              price:     fmtCrypto(price),
              change:    (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
              changePct,
              pos:       changePct >= 0,
              icon:      sym.icon,
              source:    'binance',
            });
            return next;
          });
        } catch { /* ignore */ }
      };

      ws.onerror = () => ws.close();
      ws.onclose = () => setTimeout(connect, 3000);
    }

    connect();
    return () => { wsRef.current?.close(); };
  }, []);

  // ─── Commodity polling ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchCommodities();
    commodityTimerRef.current = setInterval(fetchCommodities, 60_000);
    return () => {
      if (commodityTimerRef.current) clearInterval(commodityTimerRef.current);
    };
  }, [fetchCommodities]);

  // ─── Build final ordered ticker items ───────────────────────────────────────
  const cryptoItems = CRYPTO_SYMBOLS
    .map(s => cryptoTicks.get(s.label))
    .filter(Boolean) as TickItem[];

  // Interleave: commodities first (prominent), then crypto
  const allItems = [...commodityTicks, ...cryptoItems];
  const tickerItems = [...allItems, ...allItems]; // duplicate for infinite scroll

  const hasData = allItems.length > 0;
  const speed   = allItems.length > 6 ? 55 : 35; // slower when more items

  return (
    <div
      className="shrink-0 z-50 border-b border-white/[0.05] overflow-hidden relative"
      style={{
        height: 36,
        background: 'linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(10,10,10,0.95) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.9), transparent)' }} />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(-90deg, rgba(0,0,0,0.9), transparent)' }} />

      <div
        className="flex items-center whitespace-nowrap ticker-animate"
        style={{
          animation: hasData ? `ticker-scroll ${speed}s linear infinite` : 'none',
          width: 'max-content',
          height: 36,
        }}
      >
        {hasData ? tickerItems.map((t, i) => (
          <span
            key={`${t.id}-${i}`}
            className="inline-flex items-center gap-1 px-4 border-r border-white/[0.05]"
            style={{ height: 36 }}
          >
            {/* Icon */}
            <span className="text-sm leading-none">{t.icon}</span>

            {/* Symbol */}
            <span className={`text-sm font-black tracking-wide uppercase ${
              t.source === 'commodity' ? 'text-amber-400/80' : 'text-white/50'
            }`}>
              {t.symbol}
            </span>

            {/* Unit label */}
            {t.unit && (
              <span className="text-xs text-white/25 font-mono">{t.unit}</span>
            )}

            {/* Price */}
            <span className="text-sm font-mono font-bold text-white/95 tabular-nums">
              {t.price}
            </span>

            {/* Change % */}
            <span className={`text-sm font-mono font-bold tabular-nums ${t.pos ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.change}
            </span>
          </span>
        )) : (
          <span className="inline-flex items-center gap-3 px-5 text-sm text-white/25 font-mono tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500/70 animate-pulse shrink-0" />
            جارٍ تحميل بيانات السوق...
          </span>
        )}
      </div>
    </div>
  );
}
