// ─── Classical Pattern Detector ───────────────────────────────────────────────
// lib/algorithms/patterns.ts
// Thick-client, 100% browser-side. Expects 200–400 klines.
//
// Algorithm overview (Wedge):
//  1. Identify local swing highs and lows (pivot points) using a 5-bar window.
//  2. Fit linear regression lines through the last N swing highs and swing lows.
//  3. A wedge is detected when both trendlines converge (slopes have the same
//     sign but the high-line slope is less steep than the low-line slope, or
//     vice-versa for the falling variant) within a bounded angle tolerance.
//  4. Classify as RISING or FALLING based on the slope direction.

import type { Kline } from '@/lib/binance/fetcher';

// ── Output type ───────────────────────────────────────────────────────────────

export interface PatternResult {
  detected:         boolean;
  type:             'RISING' | 'FALLING' | null;
  // Only populated when detected === true
  swingHighs?:      Array<{ index: number; price: number }>;
  swingLows?:       Array<{ index: number; price: number }>;
  upperSlope?:      number;   // slope of resistance trendline (per bar)
  lowerSlope?:      number;   // slope of support trendline (per bar)
  apexEstimate?:    number;   // candles until projected convergence
  confidence?:      number;   // 0–100
}

// ── Pivot detection ───────────────────────────────────────────────────────────

const PIVOT_WINDOW = 5; // bars to look left/right for pivot confirmation

function findSwingHighs(
  klines: Kline[],
  window: number = PIVOT_WINDOW,
): Array<{ index: number; price: number }> {
  const pivots: Array<{ index: number; price: number }> = [];
  for (let i = window; i < klines.length - window; i++) {
    const h = klines[i].high;
    let isHigh = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && klines[j].high >= h) { isHigh = false; break; }
    }
    if (isHigh) pivots.push({ index: i, price: h });
  }
  return pivots;
}

function findSwingLows(
  klines: Kline[],
  window: number = PIVOT_WINDOW,
): Array<{ index: number; price: number }> {
  const pivots: Array<{ index: number; price: number }> = [];
  for (let i = window; i < klines.length - window; i++) {
    const l = klines[i].low;
    let isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && klines[j].low <= l) { isLow = false; break; }
    }
    if (isLow) pivots.push({ index: i, price: l });
  }
  return pivots;
}

// ── Linear regression slope through pivot set ─────────────────────────────────

function linearSlope(
  points: Array<{ index: number; price: number }>,
): number {
  const n = points.length;
  if (n < 2) return 0;
  const sumX  = points.reduce((a, p) => a + p.index, 0);
  const sumY  = points.reduce((a, p) => a + p.price, 0);
  const sumXY = points.reduce((a, p) => a + p.index * p.price, 0);
  const sumX2 = points.reduce((a, p) => a + p.index * p.index, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

// ── Apex (convergence) estimator ──────────────────────────────────────────────

function estimateApex(
  highs: Array<{ index: number; price: number }>,
  lows:  Array<{ index: number; price: number }>,
  upperSlope: number,
  lowerSlope: number,
): number | null {
  // Intercepts at last pivot
  const lastHighIdx = highs[highs.length - 1].index;
  const lastLowIdx  = lows[lows.length - 1].index;
  const lastHighPrice = highs[highs.length - 1].price;
  const lastLowPrice  = lows[lows.length - 1].price;

  // Lines: price = startPrice + slope * (i - startIndex)
  // Find i where upper = lower
  // lastHighPrice + upperSlope*(i - lastHighIdx) = lastLowPrice + lowerSlope*(i - lastLowIdx)
  const dSlope = upperSlope - lowerSlope;
  if (Math.abs(dSlope) < 1e-12) return null;

  const apex = (lastLowPrice - lastHighPrice + upperSlope * lastHighIdx - lowerSlope * lastLowIdx) / dSlope;
  const barsAhead = apex - Math.max(lastHighIdx, lastLowIdx);
  return barsAhead > 0 ? Math.round(barsAhead) : null;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Detect a Rising or Falling Wedge pattern in the provided klines.
 *
 * Returns `{ detected: false }` when the pattern is not clearly present —
 * this is the statistically normal outcome for random market conditions.
 *
 * @param klines - OHLCV array (200–400 candles recommended; 4H is ideal)
 */
export function detectWedge(klines: Kline[]): PatternResult {
  if (klines.length < 60) {
    throw new Error('Wedge detection requires at least 60 candles.');
  }

  // Work on the last 300 bars to keep computation focused
  const slice = klines.slice(-300);

  const highs = findSwingHighs(slice);
  const lows  = findSwingLows(slice);

  // Need at least 3 pivots on each side for a reliable regression
  if (highs.length < 3 || lows.length < 3) {
    return { detected: false, type: null };
  }

  // Use only the most recent 5 pivots to focus on current structure
  const recentHighs = highs.slice(-5);
  const recentLows  = lows.slice(-5);

  const upperSlope = linearSlope(recentHighs);
  const lowerSlope = linearSlope(recentLows);

  // ── Wedge classification rules ─────────────────────────────────────────────
  //
  // RISING WEDGE:
  //   Both slopes positive, but upper slope < lower slope (narrowing from below).
  //   Bearish reversal signal.
  //
  // FALLING WEDGE:
  //   Both slopes negative, but upper slope > lower slope (narrowing from above).
  //   Bullish reversal signal.
  //
  // Tolerance: slopes must be "reasonably convergent" —
  //   |upperSlope - lowerSlope| > small threshold (not parallel),
  //   and the wedge must not already be fully closed (apex in the past).

  const MIN_SLOPE_DIFF = 0.00001; // minimum convergence in price/bar units
  const slopeDiff      = Math.abs(upperSlope - lowerSlope);

  if (slopeDiff < MIN_SLOPE_DIFF) {
    return { detected: false, type: null }; // parallel — channel, not wedge
  }

  let wedgeType: 'RISING' | 'FALLING' | null = null;

  const bothPositive = upperSlope > 0 && lowerSlope > 0;
  const bothNegative = upperSlope < 0 && lowerSlope < 0;

  if (bothPositive && upperSlope < lowerSlope) {
    wedgeType = 'RISING';
  } else if (bothNegative && upperSlope > lowerSlope) {
    wedgeType = 'FALLING';
  }

  if (!wedgeType) {
    return { detected: false, type: null };
  }

  // ── Additional quality checks ──────────────────────────────────────────────

  // 1. Price must currently be inside the wedge zone
  const lastPrice  = slice[slice.length - 1].close;
  const lastIdx    = slice.length - 1;
  const upperAtNow = recentHighs[recentHighs.length - 1].price +
                     upperSlope * (lastIdx - recentHighs[recentHighs.length - 1].index);
  const lowerAtNow = recentLows[recentLows.length - 1].price +
                     lowerSlope * (lastIdx - recentLows[recentLows.length - 1].index);

  if (lastPrice < Math.min(upperAtNow, lowerAtNow) || lastPrice > Math.max(upperAtNow, lowerAtNow)) {
    return { detected: false, type: null }; // price has already broken out
  }

  // 2. Apex must still be in the future (not already passed)
  const apexEstimate = estimateApex(recentHighs, recentLows, upperSlope, lowerSlope);
  if (!apexEstimate || apexEstimate <= 0) {
    return { detected: false, type: null };
  }

  // 3. Minimum pattern width — pivots should span at least 20 bars
  const highSpan = recentHighs[recentHighs.length - 1].index - recentHighs[0].index;
  const lowSpan  = recentLows[recentLows.length - 1].index  - recentLows[0].index;
  if (highSpan < 20 || lowSpan < 20) {
    return { detected: false, type: null };
  }

  // ── Confidence scoring ────────────────────────────────────────────────────
  // Based on: pivot count quality, apex proximity, convergence rate
  const pivotScore      = Math.min(1, (recentHighs.length + recentLows.length) / 10);
  const apexScore       = Math.max(0, 1 - apexEstimate / 100); // closer apex = higher score
  const convergenceScore = Math.min(1, slopeDiff / 0.001);
  const confidence      = Math.round((pivotScore * 0.4 + apexScore * 0.3 + convergenceScore * 0.3) * 100);

  return {
    detected:      true,
    type:          wedgeType,
    swingHighs:    recentHighs,
    swingLows:     recentLows,
    upperSlope:    parseFloat(upperSlope.toFixed(6)),
    lowerSlope:    parseFloat(lowerSlope.toFixed(6)),
    apexEstimate,
    confidence:    Math.min(99, Math.max(10, confidence)),
  };
}
