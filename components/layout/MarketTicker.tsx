'use client';

import { useEffect, useRef, useState } from 'react';

interface TickItem { symbol: string; price: string; change: string; pos: boolean; }

const SYMBOLS = [
  { s: 'BTCUSDT', label: 'BTC' },
  { s: 'ETHUSDT', label: 'ETH' },
  { s: 'SOLUSDT', label: 'SOL' },
  { s: 'BNBUSDT', label: 'BNB' },
  { s: 'XRPUSDT', label: 'XRP' },
  { s: 'ADAUSDT', label: 'ADA' },
  { s: 'DOGEUSDT',label: 'DOGE'},
  { s: 'AVAXUSDT',label: 'AVAX'},
];

export function MarketTicker() {
  const [ticks, setTicks] = useState<TickItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const streams = SYMBOLS.map(s => `${s.s.toLowerCase()}@miniTicker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const d = msg.data ?? msg;
          const sym = SYMBOLS.find(x => x.s === d.s);
          if (!sym) return;
          const price  = parseFloat(d.c);
          const change = parseFloat(d.P);
          setTicks(prev => {
            const filtered = prev.filter(t => t.symbol !== sym.label);
            return [
              ...filtered,
              {
                symbol: sym.label,
                price:  price >= 1
                  ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : price.toFixed(5),
                change: (change >= 0 ? '+' : '') + change.toFixed(2) + '%',
                pos:    change >= 0,
              },
            ].sort((a, b) =>
              SYMBOLS.findIndex(x => x.label === a.symbol) -
              SYMBOLS.findIndex(x => x.label === b.symbol)
            );
          });
        } catch { /* ignore malformed */ }
      };

      ws.onerror = () => ws.close();
      ws.onclose = () => setTimeout(connect, 3000);
    }

    connect();
    return () => { wsRef.current?.close(); };
  }, []);

  // Duplicate list for seamless infinite scroll
  const items = [...ticks, ...ticks];

  return (
    <div className="shrink-0 z-50 border-b border-white/[0.05] bg-black/80 backdrop-blur-sm overflow-hidden" style={{ height: 28 }}>
      <div
        className="flex items-center gap-0 whitespace-nowrap will-change-transform"
        style={{
          animation: ticks.length ? 'ticker-scroll 28s linear infinite' : 'none',
          width: 'max-content',
        }}
      >
        {items.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-4 border-r border-white/[0.04]" style={{ height: 28 }}>
            <span className="text-[9px] font-bold text-white/50 tracking-widest uppercase">{t.symbol}</span>
            <span className="text-[10px] font-mono font-bold text-white tabular-nums">${t.price}</span>
            <span className={`text-[9px] font-mono font-bold tabular-nums ${t.pos ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.change}
            </span>
          </span>
        ))}
        {/* Loading state */}
        {ticks.length === 0 && (
          <span className="inline-flex items-center gap-2 px-4 text-[9px] text-white/25 font-mono tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            جارٍ تحميل بيانات السوق...
          </span>
        )}
      </div>
    </div>
  );
}
