'use client';

import { useEffect, useRef, useState } from 'react';

interface TickItem { symbol: string; price: string; change: string; pos: boolean; }

const SYMBOLS = [
  { s: 'BTCUSDT',  label: 'BTC'  },
  { s: 'ETHUSDT',  label: 'ETH'  },
  { s: 'SOLUSDT',  label: 'SOL'  },
  { s: 'BNBUSDT',  label: 'BNB'  },
  { s: 'XRPUSDT',  label: 'XRP'  },
  { s: 'ADAUSDT',  label: 'ADA'  },
  { s: 'DOGEUSDT', label: 'DOGE' },
  { s: 'AVAXUSDT', label: 'AVAX' },
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
  const hasData = ticks.length > 0;

  return (
    /* PATCH: overflow:hidden + position:relative form an independent paint
       boundary, preventing the scrolling child from causing repaint on the
       surrounding layout. The fixed height avoids layout-shift on data load. */
    <div
      className="shrink-0 z-50 border-b border-white/[0.05] bg-black/90 backdrop-blur-sm overflow-hidden relative"
      style={{ height: 30 }}
    >
      {/* PATCH: Using translate3d (via ticker-animate class + ticker-scroll
          keyframe) instead of translateX. This forces the browser to allocate
          a dedicated GPU compositing layer, eliminating the horizontal line
          artifacts reported on certain Android WebView versions.
          backface-visibility:hidden (applied via .ticker-animate in CSS)
          prevents the "back face" flicker between animation frames. */}
      <div
        className={`flex items-center whitespace-nowrap ticker-animate${hasData ? '' : ''}`}
        style={{
          animation: hasData ? 'ticker-scroll 30s linear infinite' : 'none',
          width: 'max-content',
          height: 30,
        }}
      >
        {hasData ? items.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-5 border-r border-white/[0.04]"
            style={{ height: 30 }}
          >
            <span className="text-sm font-bold text-white/40 tracking-widest uppercase">
              {t.symbol}
            </span>
            <span className="text-sm font-mono font-bold text-white/90 tabular-nums">
              ${t.price}
            </span>
            <span className={`text-sm font-mono font-bold tabular-nums ${t.pos ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.change}
            </span>
          </span>
        )) : (
          /* Loading state â€” static, not inside the animated div to avoid drift */
          <span className="inline-flex items-center gap-3 px-5 text-sm text-white/25 font-mono tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500/70 animate-pulse shrink-0" />
            ط¬ط§ط±ظچ طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط³ظˆظ‚...
          </span>
        )}
      </div>
    </div>
  );
}
