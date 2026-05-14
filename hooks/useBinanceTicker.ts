import { useState, useEffect, useRef, useCallback } from 'react';

export interface BinanceTickerData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  high: string;
  low: string;
  volume: string;
  timestamp: number;
}

export type WSStatus = 'connecting' | 'connected' | 'disconnected';

const MIN_DELAY_MS  =  1_000;
const MAX_DELAY_MS  = 30_000;
const PING_INTERVAL = 180_000; // 3 minutes — Binance drops silent connections after 10min

export const useBinanceTicker = (symbol: string = 'btcusdt') => {
  const [ticker,           setTicker]           = useState<BinanceTickerData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WSStatus>('connecting');

  const wsRef              = useRef<WebSocket | null>(null);
  const reconnectTimerRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const pingIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef        = useRef(0);
  const isMountedRef       = useRef(true);
  const lastPriceRef       = useRef(0); // VULN-13: track last price for anomaly detection

  // ── Clear helpers ─────────────────────────────────────────────────────────
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    clearPingInterval();
    if (wsRef.current) {
      // Null out all handlers BEFORE closing to prevent onclose
      // from firing a reconnect after an intentional unmount.
      wsRef.current.onopen    = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror   = null;
      wsRef.current.onclose   = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearPingInterval]);

  // ── Exponential backoff calculator ────────────────────────────────────────
  function nextDelay(): number {
    const base  = Math.min(MAX_DELAY_MS, MIN_DELAY_MS * Math.pow(2, attemptsRef.current));
    const jitter = Math.random() * 500; // ±500ms jitter prevents thundering herd
    return base + jitter;
  }

  useEffect(() => {
    isMountedRef.current = true;
    attemptsRef.current  = 0;

    const connect = () => {
      if (!isMountedRef.current) return;

      closeSocket();
      clearReconnectTimer();
      setConnectionStatus('connecting');

      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@ticker`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) { ws.close(); return; }
        attemptsRef.current = 0; // reset backoff on successful connection
        setConnectionStatus('connected');

        // Start keepalive ping — Binance requires a PONG within 10 min
        // The server sends PING frames; we respond automatically via the WS spec.
        // This interval sends a lightweight frame to detect zombie connections.
        clearPingInterval();
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
              // Binance supports JSON ping
              wsRef.current.send(JSON.stringify({ method: 'ping' }));
            } catch {
              // If send throws the connection is already dead — onclose will fire
            }
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        if (typeof event.data === 'string' && event.data.startsWith('{')) {
          try {
            const data = JSON.parse(event.data);
            if (!data.s) return; // pong/result frame

            const newPrice = parseFloat(data.c);

            // VULN-13: Detect potential MitM price injection.
            // A >5% single-tick swing is physically impossible on Binance spot.
            const lastPrice = lastPriceRef.current;
            if (lastPrice > 0) {
              const delta = Math.abs(newPrice - lastPrice) / lastPrice;
              if (delta > 0.05) {
                console.error(
                  `[Security] Price anomaly detected on ${data.s}: ` +
                  `${lastPrice} → ${newPrice} (${(delta * 100).toFixed(1)}% swing). ` +
                  `Possible MitM injection. Disconnecting.`
                );
                ws.close(); // triggers onclose → exponential backoff reconnect
                return;
              }
            }
            lastPriceRef.current = newPrice;

            setTicker({
              symbol:             data.s,
              price:              newPrice.toFixed(2),
              priceChange:        parseFloat(data.p).toFixed(2),
              priceChangePercent: parseFloat(data.P).toFixed(2),
              high:               parseFloat(data.h).toFixed(2),
              low:                parseFloat(data.l).toFixed(2),
              volume:             parseFloat(data.v).toFixed(2),
              timestamp:          data.E,
            });
          } catch {
            // Malformed frame — ignore silently
          }
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose — reconnect logic lives there.
        console.warn('[BinanceTicker] WebSocket error — will reconnect via onclose.');
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        clearPingInterval();
        setConnectionStatus('disconnected');
        // Exponential backoff: 1s → 2s → 4s → 8s → … → 30s max
        const delay = nextDelay();
        attemptsRef.current++;
        console.info(`[BinanceTicker] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${attemptsRef.current})`);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      clearPingInterval();
      closeSocket();
    };
  }, [symbol, closeSocket, clearReconnectTimer, clearPingInterval]);

  return { ticker, connectionStatus };
};
