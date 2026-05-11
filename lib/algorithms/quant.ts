// ─── Quantitative Volatility Models ───────────────────────────────────────────
// lib/algorithms/quant.ts
// Thick-client, 100% browser-side. Requires 100+ candles for accuracy.

import type { Kline } from '@/lib/binance/fetcher';
import { calculateStandardDeviation } from '@/lib/algorithms/mathUtils';

// ── Output type ───────────────────────────────────────────────────────────────

export interface GarchResult {
  currentPrice:  number;
  upperBound:    number;   // 1-period ahead resistance estimate
  lowerBound:    number;   // 1-period ahead support estimate
  upperPct:      number;   // positive, e.g. 0.93
  lowerPct:      number;   // negative, e.g. -0.93
  totalRangePct: number;   // upperPct + |lowerPct|, e.g. 1.87
  state:         'انحسار' | 'انفجار'; // Contraction | Expansion
  // extra diagnostics surfaced in the UI
  historicalVolPct: number; // σ over full window, annualised as %
  recentVolPct:     number; // σ over short window, annualised as %
  annualisedVolPct: number; // long-run GARCH(1,1) vol estimate, annualised as %
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Log-return: ln(close[i] / close[i-1]) */
function logReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    r.push(Math.log(closes[i] / closes[i - 1]));
  }
  return r;
}

function annualise(dailySigma: number, barsPerYear: number): number {
  return dailySigma * Math.sqrt(barsPerYear) * 100;
}

// ── GARCH(1,1) variance estimator ────────────────────────────────────────────
// Uses simplified Engle (1982) / Bollerslev (1986) recursion with fixed
// parameters that are typical for crypto time-series:
//   ω = 1e-6  (baseline variance floor)
//   α = 0.10  (shock weight — recent-return² impact)
//   β = 0.85  (persistence — weight on prior variance)
// These satisfy α + β < 1 (covariance-stationary).

const OMEGA = 1e-6;
const ALPHA = 0.10;
const BETA  = 0.85;
const UNCONDITIONAL_VAR = OMEGA / (1 - ALPHA - BETA); // long-run variance

function garchVariance(returns: number[]): number {
  let variance = UNCONDITIONAL_VAR; // seed from long-run
  for (const r of returns) {
    variance = OMEGA + ALPHA * r * r + BETA * variance;
  }
  return variance; // one-step-ahead forecast
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Estimates GARCH(1,1) 1-period-ahead volatility bands.
 *
 * @param klines        - OHLCV array (100–300 candles recommended)
 * @param barsPerYear   - Trading bars in a year for annualisation
 *                        (365 × 24 for hourly crypto, 365 for daily)
 */
export function calculateGARCH(
  klines:      Kline[],
  barsPerYear: number = 365 * 24, // default: hourly crypto
): GarchResult {
  if (klines.length < 30) {
    throw new Error('GARCH requires at least 30 candles.');
  }

  const closes = klines.map(k => k.close);
  const currentPrice = closes[closes.length - 1];

  // Log-returns for the full window
  const returns = logReturns(closes);

  // ── GARCH(1,1) one-step-ahead variance ──────────────────────────────────
  const garchVar    = garchVariance(returns);
  const garchSigma  = Math.sqrt(garchVar);           // per-bar σ

  // ── Historical σ (full window, last 100 bars) using our utility ─────────
  const longWindow  = Math.min(100, closes.length);
  const shortWindow = Math.min(14,  closes.length);

  const longSdReturns  = calculateStandardDeviation(returns, Math.min(longWindow,  returns.length));
  const shortSdReturns = calculateStandardDeviation(returns, Math.min(shortWindow, returns.length));

  // ── Annualised vols ──────────────────────────────────────────────────────
  const historicalVolPct  = annualise(longSdReturns,  barsPerYear);
  const recentVolPct      = annualise(shortSdReturns, barsPerYear);
  const annualisedVolPct  = annualise(garchSigma,     barsPerYear);

  // ── Expansion / Contraction regime ──────────────────────────────────────
  // Recent σ > historical σ → volatility is EXPANDING
  const state: GarchResult['state'] = shortSdReturns > longSdReturns ? 'انفجار' : 'انحسار';

  // ── 1-bar price bands ────────────────────────────────────────────────────
  // Band = currentPrice × (1 ± garchSigma)
  // We use a ±1σ symmetric band — matches the Bollinger-like display spec.
  const upperBound = parseFloat((currentPrice * (1 + garchSigma)).toFixed(
    currentPrice > 1000 ? 1 : currentPrice > 1 ? 4 : 6,
  ));
  const lowerBound = parseFloat((currentPrice * (1 - garchSigma)).toFixed(
    currentPrice > 1000 ? 1 : currentPrice > 1 ? 4 : 6,
  ));

  const upperPct      = parseFloat(( (upperBound - currentPrice) / currentPrice * 100).toFixed(2));
  const lowerPct      = parseFloat((-(currentPrice - lowerBound) / currentPrice * 100).toFixed(2));
  const totalRangePct = parseFloat((upperPct + Math.abs(lowerPct)).toFixed(2));

  return {
    currentPrice:     parseFloat(currentPrice.toFixed(currentPrice > 1000 ? 1 : 4)),
    upperBound,
    lowerBound,
    upperPct,
    lowerPct,
    totalRangePct,
    state,
    historicalVolPct: parseFloat(historicalVolPct.toFixed(2)),
    recentVolPct:     parseFloat(recentVolPct.toFixed(2)),
    annualisedVolPct: parseFloat(annualisedVolPct.toFixed(2)),
  };
}
