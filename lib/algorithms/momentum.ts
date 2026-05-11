// ─── Momentum & Trend Indicator Analyzers ─────────────────────────────────────
// lib/algorithms/momentum.ts
// Thick-client, 100% browser-side. Expects 100 candles per call.

import type { Kline } from '@/lib/binance/fetcher';
import {
  calculateEMA,
  calculateSMA,
  calculateStandardDeviation,
  calculateWilderMA,
} from '@/lib/algorithms/mathUtils';

// ── Shared helpers ────────────────────────────────────────────────────────────

function lastVal(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return 0;
}

function fmt(n: number, d = 4): number {
  return parseFloat(n.toFixed(d));
}

function fmtPrice(n: number): number {
  if (n >= 10_000) return fmt(n, 1);
  if (n >= 1)      return fmt(n, 4);
  return               fmt(n, 6);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. RSI
// ═════════════════════════════════════════════════════════════════════════════

export interface RSIResult {
  value:   number;
  state:   'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  verdict: string;
}

/**
 * Wilder's RSI (14-period).
 * Uses calculateWilderMA for smoothed average gains/losses.
 */
export function analyzeRSI(klines: Kline[]): RSIResult {
  if (klines.length < 15) throw new Error('RSI requires at least 15 candles.');

  const closes = klines.map(k => k.close);

  // Build gain / loss series
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? Math.abs(d) : 0);
  }

  const avgGains  = calculateWilderMA(gains,  14);
  const avgLosses = calculateWilderMA(losses, 14);

  const ag = lastVal(avgGains);
  const al = lastVal(avgLosses);

  let rsi = 50;
  if (al === 0) rsi = 100;
  else rsi = 100 - 100 / (1 + ag / al);

  const value = fmt(rsi, 2);

  let state: RSIResult['state'];
  let verdict: string;

  if (value >= 70) {
    state   = 'OVERBOUGHT';
    verdict = `RSI عند ${value} — ذروة شراء. احتمالية تراجع أو توقف الاتجاه الصاعد.`;
  } else if (value <= 30) {
    state   = 'OVERSOLD';
    verdict = `RSI عند ${value} — ذروة بيع. احتمالية ارتداد أو نهاية الضغط البيعي.`;
  } else {
    state   = 'NEUTRAL';
    verdict = `RSI عند ${value} — منطقة محايدة. لا إشارة ذروة حالياً.`;
  }

  return { value, state, verdict };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. MACD (12, 26, 9)
// ═════════════════════════════════════════════════════════════════════════════

export interface MACDResult {
  macdLine:   number;
  signalLine: number;
  histogram:  number;
  state:      'BULLISH' | 'BEARISH' | 'NEUTRAL';
  verdict:    string;
}

/**
 * Standard MACD: EMA(12) − EMA(26), Signal = EMA(9) of MACD, Histogram = MACD − Signal.
 */
export function analyzeMACD(klines: Kline[]): MACDResult {
  if (klines.length < 35) throw new Error('MACD requires at least 35 candles.');

  const closes = klines.map(k => k.close);

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  // MACD line: EMA12 - EMA26 (only where both are valid)
  const macdSeries: number[] = ema12.map((v, i) =>
    isNaN(v) || isNaN(ema26[i]) ? NaN : v - ema26[i],
  );

  // Signal = EMA(9) of MACD
  const validMacd   = macdSeries.filter(v => !isNaN(v));
  const signalRaw   = calculateEMA(validMacd, 9);
  const signalLine  = lastVal(signalRaw);
  const macdLine    = lastVal(macdSeries);
  const histogram   = macdLine - signalLine;

  let state: MACDResult['state'];
  let verdict: string;

  if (macdLine > signalLine && histogram > 0) {
    state   = 'BULLISH';
    verdict = `MACD فوق خط الإشارة بهستوغرام موجب — زخم صاعد قوي.`;
  } else if (macdLine < signalLine && histogram < 0) {
    state   = 'BEARISH';
    verdict = `MACD تحت خط الإشارة بهستوغرام سالب — زخم هابط قوي.`;
  } else {
    state   = 'NEUTRAL';
    verdict = `MACD قريب من خط الإشارة — لا اتجاه واضح حالياً.`;
  }

  return {
    macdLine:   fmt(macdLine),
    signalLine: fmt(signalLine),
    histogram:  fmt(histogram),
    state,
    verdict,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Bollinger Bands (20, 2σ)
// ═════════════════════════════════════════════════════════════════════════════

export interface BollingerResult {
  upper:     number;
  middle:    number;
  lower:     number;
  bandwidth: number;  // (upper - lower) / middle × 100
  state:     'SQUEEZE' | 'EXPANSION';
  verdict:   string;
}

/**
 * Bollinger Bands: 20-period SMA ± 2 × rolling standard deviation.
 * Squeeze: current bandwidth < 80th percentile of last 50-bar bandwidths.
 */
export function analyzeBollinger(klines: Kline[]): BollingerResult {
  if (klines.length < 22) throw new Error('Bollinger requires at least 22 candles.');

  const closes = klines.map(k => k.close);
  const sma20  = calculateSMA(closes, 20);
  const middle = lastVal(sma20);

  // Rolling σ over last 20 closes
  const sigma  = calculateStandardDeviation(closes, 20);
  const upper  = middle + 2 * sigma;
  const lower  = middle - 2 * sigma;
  const bandwidth = ((upper - lower) / middle) * 100;

  // Historical bandwidths for squeeze detection (last 50 bars)
  const histBW: number[] = [];
  for (let i = 20; i < closes.length; i++) {
    const m = lastVal(sma20.slice(0, i + 1));
    const s = calculateStandardDeviation(closes.slice(0, i + 1), 20);
    histBW.push(((m + 2*s - (m - 2*s)) / m) * 100);
  }

  const p80 = histBW.length > 0
    ? [...histBW].sort((a, b) => a - b)[Math.floor(histBW.length * 0.8)]
    : Infinity;

  const state: BollingerResult['state'] = bandwidth < p80 ? 'SQUEEZE' : 'EXPANSION';

  const verdict = state === 'SQUEEZE'
    ? `النطاقات في انحسار (Squeeze) — توقع حركة سعرية قوية قريباً في أي اتجاه.`
    : `النطاقات في توسع (Expansion) — السعر يتحرك بزخم خارج نطاق التوازن.`;

  return {
    upper:     fmtPrice(upper),
    middle:    fmtPrice(middle),
    lower:     fmtPrice(lower),
    bandwidth: fmt(bandwidth, 2),
    state,
    verdict,
  };
}
