'use client';

/**
 * context/MarketDataContext.tsx
 *
 * Global State Provider for Live Binance Market Data.
 * Minimizes API calls, implements background polling for price,
 * and makes data instantly accessible to all trading tools.
 *
 * PHASE 1 FIX:
 * - Exposed `error` state so tools can show graceful fallback UI
 * - Added automatic retry (3 attempts, exponential back-off)
 * - Added `isStale` flag (data > 60s old) so tools can warn users
 * - Guarded against empty/missing candles to prevent tool crashes
 */

import React, {
  createContext, useContext, useState,
  useEffect, useRef, useCallback, ReactNode,
} from 'react';
import { fetchLiveCandles, fetchCurrentPrice, BinanceKline } from '@/lib/api/binance';

interface MarketDataContextType {
  symbol:       string;
  timeframe:    string;
  candles:      BinanceKline[];
  currentPrice: number | null;
  isLoading:    boolean;
  error:        string | null;      // NEW: expose errors to tools
  isStale:      boolean;            // NEW: true when last update > 60s ago
  setSymbol:    (symbol: string) => void;
  setTimeframe: (tf: string)     => void;
  refetch:      () => void;         // NEW: manual refetch trigger
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

// ─── Exponential back-off retry ──────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const [symbol,       setSymbolState] = useState<string>('BTCUSDT');
  const [timeframe,    setTimeframeState] = useState<string>('1d');
  const [candles,      setCandles]      = useState<BinanceKline[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading,    setIsLoading]    = useState<boolean>(true);
  const [error,        setError]        = useState<string | null>(null);
  const [isStale,      setIsStale]      = useState<boolean>(false);
  const [refetchKey,   setRefetchKey]   = useState<number>(0);

  const lastUpdateRef = useRef<number>(Date.now());
  const mountedRef    = useRef<boolean>(true);

  // Public setters that clear stale error state on change
  const setSymbol    = useCallback((s: string) => { setError(null); setIsStale(false); setSymbolState(s); }, []);
  const setTimeframe = useCallback((tf: string) => { setError(null); setIsStale(false); setTimeframeState(tf); }, []);
  const refetch      = useCallback(() => setRefetchKey(k => k + 1), []);

  // 1. Fetch historical candles + initial price when symbol/timeframe/refetchKey changes
  useEffect(() => {
    mountedRef.current = true;

    const fetchInitialData = async () => {
      if (!symbol.trim() || !timeframe.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        const [fetchedCandles, fetchedPrice] = await withRetry(() =>
          Promise.all([
            fetchLiveCandles(symbol, timeframe, 200),
            fetchCurrentPrice(symbol),
          ])
        );

        if (!mountedRef.current) return;

        // Guard: only update if we got valid data
        if (fetchedCandles.length > 0) {
          setCandles(fetchedCandles);
        } else {
          // Keep prior candles if new fetch returns nothing (API transient error)
          setError('البيانات مؤقتاً غير متاحة — يتم إعادة المحاولة...');
        }

        if (fetchedPrice !== null) {
          setCurrentPrice(fetchedPrice);
          lastUpdateRef.current = Date.now();
          setIsStale(false);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
        setError(`تعذّر تحميل البيانات: ${msg}`);
        console.error('[MarketData] Initial fetch failed after retries:', err);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    fetchInitialData();

    return () => {
      mountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, refetchKey]);

  // 2. Poll the current price every 10 seconds for live feel
  useEffect(() => {
    if (!symbol.trim()) return;

    mountedRef.current = true;

    const intervalId = setInterval(async () => {
      try {
        const price = await fetchCurrentPrice(symbol);
        if (mountedRef.current && price !== null) {
          setCurrentPrice(price);
          lastUpdateRef.current = Date.now();
          setIsStale(false);
          // Clear error if polling recovers
          setError(null);
        }
      } catch {
        // Silently ignore polling errors — stale flag will warn users
      }
    }, 10_000);

    // Stale checker: mark data as stale if no update for > 60 seconds
    const staleCheckId = setInterval(() => {
      if (Date.now() - lastUpdateRef.current > 60_000) {
        setIsStale(true);
      }
    }, 15_000);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      clearInterval(staleCheckId);
    };
  }, [symbol]);

  return (
    <MarketDataContext.Provider value={{
      symbol, timeframe, candles, currentPrice,
      isLoading, error, isStale,
      setSymbol, setTimeframe, refetch,
    }}>
      {children}
    </MarketDataContext.Provider>
  );
}

/**
 * Custom hook to instantly access global live market data.
 * Must be used within a <MarketDataProvider>.
 */
export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (context === undefined) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
}
