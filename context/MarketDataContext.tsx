'use client';

/**
 * context/MarketDataContext.tsx
 *
 * Global State Provider for Live Binance Market Data.
 * Minimizes API calls, implements background polling for price,
 * and makes data instantly accessible to all trading tools.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchLiveCandles, fetchCurrentPrice, BinanceKline } from '@/lib/api/binance';

interface MarketDataContextType {
  symbol: string;
  timeframe: string;
  candles: BinanceKline[];
  currentPrice: number | null;
  isLoading: boolean;
  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: string) => void;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<string>('1d');
  const [candles, setCandles] = useState<BinanceKline[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Fetch historical candles and initial price whenever symbol or timeframe changes
  useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      if (!symbol.trim() || !timeframe.trim()) return;
      
      setIsLoading(true);
      
      try {
        const [fetchedCandles, fetchedPrice] = await Promise.all([
          fetchLiveCandles(symbol, timeframe, 200),
          fetchCurrentPrice(symbol)
        ]);
        
        if (mounted) {
          setCandles(fetchedCandles);
          setCurrentPrice(fetchedPrice);
        }
      } catch (error) {
        console.error('[MarketData] Initial fetch error:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      mounted = false;
    };
  }, [symbol, timeframe]);

  // 2. Poll the current price every 10 seconds for a "live" feel
  useEffect(() => {
    if (!symbol.trim()) return;
    
    let mounted = true;
    
    const intervalId = setInterval(async () => {
      try {
        const price = await fetchCurrentPrice(symbol);
        if (mounted && price !== null) {
          setCurrentPrice(price);
        }
      } catch (error) {
        // Silently ignore polling errors so as not to spam the console
      }
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [symbol]);

  return (
    <MarketDataContext.Provider value={{
      symbol,
      timeframe,
      candles,
      currentPrice,
      isLoading,
      setSymbol,
      setTimeframe
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
