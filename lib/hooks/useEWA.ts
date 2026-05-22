/**
 * lib/hooks/useEWA.ts
 *
 * React hook for calling the EWA analysis API (/api/ewa).
 * Manages loading, error, and result state.
 * Reads Telegram initData from window.Telegram.WebApp automatically.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import type { EWAResult, EWAAPIRequest } from '@/lib/types/ewa';

export interface EWAState {
  loading:  boolean;
  result:   EWAResult | null;
  error:    string | null;
}

export interface UseEWAOptions {
  symbol:     string;
  macro_tf?:  string;
  micro_tf?:  string;
}

export function useEWA({ symbol, macro_tf = '1d', micro_tf = '1h' }: UseEWAOptions) {
  const [state, setState] = useState<EWAState>({
    loading: false,
    result:  null,
    error:   null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState({ loading: true, result: null, error: null });

    try {
      // Get Telegram initData — required for server-side auth
      const initData = (window as any)?.Telegram?.WebApp?.initData ?? '';
      if (!initData) {
        setState({
          loading: false,
          result:  null,
          error:   'Telegram WebApp initData غير متاح. افتح التطبيق داخل تيليغرام.',
        });
        return;
      }

      const body: EWAAPIRequest = {
        init_data:   initData,
        symbol:      symbol.toUpperCase(),
        macro_tf,
        micro_tf,
        macro_limit: 500,
        micro_limit: 300,
      };

      const res = await fetch('/api/ewa', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  abortRef.current.signal,
      });

      const json = (await res.json()) as EWAResult;

      if (!res.ok || json.error) {
        setState({
          loading: false,
          result:  null,
          error:   json.error ?? `خطأ ${res.status}: فشل تحليل إليوت.`,
        });
        return;
      }

      setState({ loading: false, result: json, error: null });
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setState({
        loading: false,
        result:  null,
        error:   `خطأ في الشبكة: ${(err as Error).message}`,
      });
    }
  }, [symbol, macro_tf, micro_tf]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ loading: false, result: null, error: null });
  }, []);

  return { ...state, run, reset };
}
