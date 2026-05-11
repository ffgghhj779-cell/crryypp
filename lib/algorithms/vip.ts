// ─── Trading VIP — Multi-Timeframe Consensus & Risk Engine ────────────────────
// lib/algorithms/vip.ts
// Thick-client, 100% browser-side.
// Consumes concurrent 1H / 4H / 1D kline feeds and produces a fully typed
// trade setup with position-size risk management.

import type { Kline } from '@/lib/binance/fetcher';
import { calculateEMA, calculateSMA } from '@/lib/algorithms/mathUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VIPFactor {
  label:  string;  // e.g. "أداة 1"
  score:  number;  // 0–20 each (5 factors × 20 = 100 max)
  detail: string;  // human-readable reason
}

export interface VIPSetup {
  entry:        number;
  sl:           number;
  tp1:          number;
  tp2:          number;
  tp3:          number;
  slDropPct:    number;  // e.g. 2.4
  tp1Pct:       number;
  tp2Pct:       number;
  tp3Pct:       number;
  positionSizePct:  number;  // capped at 20%
  actualRiskPct:    number;  // how much of portfolio is at risk
  positionUSDT:     number;  // portfolioSize × positionSizePct / 100
}

export type VIPResult =
  | { rejected: true;  score: number; factors: VIPFactor[] }
  | { rejected: false; score: number; factors: VIPFactor[]; setup: VIPSetup };

// ── Internal helpers ──────────────────────────────────────────────────────────

function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return 0;
}

function fmt(n: number, decimals = 2): number {
  return parseFloat(n.toFixed(decimals));
}

/** Swing low of the last `lookback` candles */
function swingLow(klines: Kline[], lookback: number): number {
  const slice = klines.slice(-lookback);
  return Math.min(...slice.map(k => k.low));
}

/** Swing high of the last `lookback` candles */
function swingHigh(klines: Kline[], lookback: number): number {
  const slice = klines.slice(-lookback);
  return Math.max(...slice.map(k => k.high));
}

// ── Factor scoring ────────────────────────────────────────────────────────────
// Each factor is worth 0–20 points. Total max = 100.

/**
 * Factor 1 — Trend Alignment (20pts)
 * Price above / below EMA-50 on 1H, 4H, 1D — 3 checks × ≈6.67 pts each.
 */
function scoreTrend(k1h: Kline[], k4h: Kline[], k1d: Kline[]): VIPFactor {
  const closes1h = k1h.map(k => k.close);
  const closes4h = k4h.map(k => k.close);
  const closes1d = k1d.map(k => k.close);

  const ema1h = lastValid(calculateEMA(closes1h, 50));
  const ema4h = lastValid(calculateEMA(closes4h, 50));
  const ema1d = lastValid(calculateEMA(closes1d, 50));

  const price = closes1h[closes1h.length - 1];

  let score = 0;
  const votes: string[] = [];
  if (price > ema1h) { score += 6.67; votes.push('1H ↑'); }
  if (closes4h[closes4h.length-1] > ema4h) { score += 6.67; votes.push('4H ↑'); }
  if (closes1d[closes1d.length-1] > ema1d) { score += 6.67; votes.push('1D ↑'); }

  return {
    label:  'أداة 1',
    score:  fmt(Math.min(20, score)),
    detail: votes.length > 0 ? `Aligned: ${votes.join(', ')}` : 'No trend alignment',
  };
}

/**
 * Factor 2 — Momentum (EMA-9 / EMA-21 crossover) (20pts)
 * Checks on 1H (10pts) + 4H (10pts).
 */
function scoreMomentum(k1h: Kline[], k4h: Kline[]): VIPFactor {
  const c1h = k1h.map(k => k.close);
  const c4h = k4h.map(k => k.close);

  const e9_1h  = lastValid(calculateEMA(c1h, 9));
  const e21_1h = lastValid(calculateEMA(c1h, 21));
  const e9_4h  = lastValid(calculateEMA(c4h, 9));
  const e21_4h = lastValid(calculateEMA(c4h, 21));

  let score = 0;
  if (e9_1h > e21_1h) score += 10;
  if (e9_4h > e21_4h) score += 10;

  return {
    label:  'أداة 2',
    score:  fmt(score),
    detail: `EMA9/21 — 1H: ${e9_1h > e21_1h ? 'bull' : 'bear'} · 4H: ${e9_4h > e21_4h ? 'bull' : 'bear'}`,
  };
}

/**
 * Factor 3 — Structure (SMA-200 deviation) (20pts)
 * How far price is from its long-run fair value.
 */
function scoreStructure(k1d: Kline[]): VIPFactor {
  const closes = k1d.map(k => k.close);
  const sma200 = lastValid(calculateSMA(closes, Math.min(200, closes.length)));
  const price  = closes[closes.length - 1];
  const devPct = ((price - sma200) / sma200) * 100;

  // Near SMA-200 (within 5%) = highest confluence; far away = lower
  const proximity = Math.max(0, 1 - Math.abs(devPct) / 20);
  const score = fmt(proximity * 20);

  return {
    label:  'أداة 3',
    score,
    detail: `SMA-200 dev: ${devPct.toFixed(2)}%`,
  };
}

/**
 * Factor 4 — Volume confirmation (20pts)
 * Recent 5-bar average volume vs 50-bar average on 4H.
 */
function scoreVolume(k4h: Kline[]): VIPFactor {
  const vols   = k4h.map(k => k.volume);
  const avg50  = vols.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const avg5   = vols.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ratio  = avg5 / avg50;

  // ratio ≥ 1.5 = full score; ratio < 0.5 = zero
  const score  = fmt(Math.min(20, Math.max(0, (ratio - 0.5) / 1.0 * 20)));

  return {
    label:  'أداة 4',
    score,
    detail: `Vol ratio 5/50: ${ratio.toFixed(2)}x`,
  };
}

/**
 * Factor 5 — Candle Quality (20pts)
 * Ratio of body size to wick on the last 1H candle.
 */
function scoreCandleQuality(k1h: Kline[]): VIPFactor {
  const last    = k1h[k1h.length - 1];
  const body    = Math.abs(last.close - last.open);
  const range   = last.high - last.low || 1;
  const ratio   = body / range;           // 1.0 = pure body, 0 = pure wick
  const score   = fmt(ratio * 20);

  return {
    label:  'أداة 5',
    score,
    detail: `Body/Range: ${(ratio * 100).toFixed(0)}%`,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

const RISK_PER_TRADE_PCT = 1.4;  // max portfolio loss if SL hit (%)
const MAX_POSITION_PCT   = 20;   // hard cap on position size

export function calculateVIP(
  portfolioSize: number,
  klines1H:      Kline[],
  klines4H:      Kline[],
  klines1D:      Kline[],
): VIPResult {
  if (klines1H.length < 50 || klines4H.length < 50 || klines1D.length < 50) {
    throw new Error('VIP requires at least 50 candles per timeframe.');
  }

  // ── Score all 5 factors ──────────────────────────────────────────────────
  const factors: VIPFactor[] = [
    scoreTrend(klines1H, klines4H, klines1D),
    scoreMomentum(klines1H, klines4H),
    scoreStructure(klines1D),
    scoreVolume(klines4H),
    scoreCandleQuality(klines1H),
  ];

  const totalScore = fmt(factors.reduce((a, f) => a + f.score, 0));

  // ── Rejection gate ───────────────────────────────────────────────────────
  if (totalScore < 65) {
    return { rejected: true, score: totalScore, factors };
  }

  // ── Trade setup ──────────────────────────────────────────────────────────
  const entry    = klines1H[klines1H.length - 1].close;
  const isBull   = klines1H[klines1H.length - 1].close > lastValid(calculateEMA(klines1H.map(k => k.close), 50));

  // SL = recent 4H swing low/high (20-bar lookback)
  const slRaw    = isBull ? swingLow(klines4H, 20) : swingHigh(klines4H, 20);
  const slDropPct = Math.abs((entry - slRaw) / entry) * 100;

  // Targets: 1.5R, 2.5R, 4R (classic swing risk-reward)
  const riskDist = Math.abs(entry - slRaw);
  const tp1 = isBull ? entry + riskDist * 1.5 : entry - riskDist * 1.5;
  const tp2 = isBull ? entry + riskDist * 2.5 : entry - riskDist * 2.5;
  const tp3 = isBull ? entry + riskDist * 4.0 : entry - riskDist * 4.0;

  // Risk management: positionSizePct so that loss at SL = RISK_PER_TRADE_PCT of portfolio
  // loss at SL = positionSizePct × slDropPct / 100 = RISK_PER_TRADE_PCT / 100
  // → positionSizePct = (RISK_PER_TRADE_PCT / slDropPct) × 100
  const rawPositionPct  = (RISK_PER_TRADE_PCT / slDropPct) * 100;
  const positionSizePct = fmt(Math.min(MAX_POSITION_PCT, rawPositionPct));
  const actualRiskPct   = fmt(positionSizePct * slDropPct / 100);
  const positionUSDT    = fmt(portfolioSize * positionSizePct / 100);

  const prec = (n: number) => parseFloat(n.toFixed(entry > 1000 ? 1 : entry > 1 ? 4 : 6));
  const pct  = (target: number) => fmt(((target - entry) / entry) * 100);

  const setup: VIPSetup = {
    entry:           prec(entry),
    sl:              prec(slRaw),
    tp1:             prec(tp1),
    tp2:             prec(tp2),
    tp3:             prec(tp3),
    slDropPct:       fmt(slDropPct),
    tp1Pct:          pct(tp1),
    tp2Pct:          pct(tp2),
    tp3Pct:          pct(tp3),
    positionSizePct,
    actualRiskPct,
    positionUSDT,
  };

  return { rejected: false, score: totalScore, factors, setup };
}
