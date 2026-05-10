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

export const useBinanceTicker = (symbol: string = 'btcusdt') => {
  const [ticker, setTicker] = useState<BinanceTickerData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Use refs to avoid stale closures and prevent leaks
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const clearReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      // Null out handlers BEFORE closing to prevent onclose from firing
      // and scheduling a new reconnect after unmount
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const connect = () => {
      if (!isMountedRef.current) return;

      closeSocket();
      clearReconnect();

      setConnectionStatus('connecting');
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@ticker`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) { ws.close(); return; }
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setTicker({
            symbol: data.s,
            price: parseFloat(data.c).toFixed(2),
            priceChange: parseFloat(data.p).toFixed(2),
            priceChangePercent: parseFloat(data.P).toFixed(2),
            high: parseFloat(data.h).toFixed(2),
            low: parseFloat(data.l).toFixed(2),
            volume: parseFloat(data.v).toFixed(2),
            timestamp: data.E,
          });
        } catch (e) {
          console.error('Error parsing ticker data', e);
        }
      };

      ws.onerror = () => {
        // Don't call ws.close() here — onerror is always followed by onclose automatically
        console.warn('[BinanceTicker] WebSocket error, will reconnect via onclose.');
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus('disconnected');
        // Schedule reconnect only if still mounted
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      isMountedRef.current = false;
      clearReconnect();
      closeSocket();
    };
  }, [symbol, closeSocket, clearReconnect]);

  return { ticker, connectionStatus };
};
