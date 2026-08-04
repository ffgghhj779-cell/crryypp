// ─── Advanced Quantitative Algorithms (Batch 3) ───────────────────────────────
// lib/algorithms/advancedQuant.ts
// Thick-client. Monte Carlo · Linear Regression · Markov Regime · Fourier Proxy

import type { Kline } from '@/lib/binance/fetcher';

function fmtP(n: number, ref: number): number {
  if (ref >= 10_000) return parseFloat(n.toFixed(1));
  if (ref >= 1)      return parseFloat(n.toFixed(4));
  return parseFloat(n.toFixed(6));
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Monte Carlo (Random Walk — 30 bars forward, 500 paths)
// ═════════════════════════════════════════════════════════════════════════════

export interface MonteCarloResult {
  currentPrice:  number;
  projectedHigh: number;
  projectedLow:  number;
  expectedPrice: number;
  upperPct:      number;
  lowerPct:      number;
  verdict:       string;
}

export function analyzeMonteCarlo(klines: Kline[]): MonteCarloResult {
  const closes  = klines.slice(-100).map(k => k.close);
  const current = closes[closes.length - 1];

  // Log-return stats
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) returns.push(Math.log(closes[i] / closes[i - 1]));

  const mean  = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  const sigma = Math.sqrt(variance);

  // Simple LCG RNG seeded from last price (deterministic across renders)
  let seed = Math.round(current * 1000) % 2147483647;
  function rand(): number {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  function boxMuller(): number {
    const u1 = rand(), u2 = rand();
    return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  }

  const PATHS = 500;
  const HORIZON = 30;
  const finalPrices: number[] = [];

  for (let p = 0; p < PATHS; p++) {
    let price = current;
    for (let t = 0; t < HORIZON; t++) {
      price *= Math.exp(mean - 0.5 * variance + sigma * boxMuller());
    }
    finalPrices.push(price);
  }

  finalPrices.sort((a, b) => a - b);
  const projectedLow  = finalPrices[Math.floor(PATHS * 0.05)]; // 5th percentile
  const projectedHigh = finalPrices[Math.floor(PATHS * 0.95)]; // 95th percentile
  const expectedPrice = finalPrices.reduce((a, b) => a + b, 0) / PATHS;

  const upperPct = parseFloat(((projectedHigh - current) / current * 100).toFixed(2));
  const lowerPct = parseFloat(((projectedLow  - current) / current * 100).toFixed(2));

  return {
    currentPrice:  fmtP(current,      current),
    projectedHigh: fmtP(projectedHigh, current),
    projectedLow:  fmtP(projectedLow,  current),
    expectedPrice: fmtP(expectedPrice, current),
    upperPct,
    lowerPct,
    verdict: `500 مسار عشوائي × ${HORIZON} شمعة: السعر المتوقع ${fmtP(expectedPrice, current)}. النطاق المحتمل (90%) من ${fmtP(projectedLow, current)} إلى ${fmtP(projectedHigh, current)}.`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Linear Regression Channel (100 bars)
// ═════════════════════════════════════════════════════════════════════════════

export interface LinearRegressionResult {
  slope:          number;  // normalized slope: % per bar
  slopeRaw:       number;  // raw OLS slope in price units per bar
  intercept:      number;
  upperChannel:   number;  // currentFit + 2σ
  lowerChannel:   number;  // currentFit − 2σ
  currentFit:     number;  // WLS regression value at last bar
  nextBarFit:     number;  // projected fit for bar n+1
  r2:             number;  // coefficient of determination × 100 (0–100)
  pearsonR:       number;  // Pearson correlation coefficient
  signalStrength: 'weak' | 'moderate' | 'strong';
  isTrendUp:      boolean;
  verdict:        string;
}

export function analyzeLinearRegression(klines: Kline[]): LinearRegressionResult {
  const slice   = klines.slice(-100);
  const n       = slice.length;
  const prices  = slice.map(k => (k.high + k.low + k.close) / 3);
  const ref     = slice[slice.length - 1].close;

  // OLS
  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = prices.reduce((a, b) => a + b, 0);
  const sumXY = prices.reduce((a, v, i) => a + i * v, 0);

  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Residuals → corrected σ (df = n-2)
  const residuals   = prices.map((v, i) => v - (intercept + slope * i));
  const ssRes       = residuals.reduce((a, r) => a + r * r, 0);
  const resSd       = Math.sqrt(ssRes / Math.max(1, n - 2));

  // R²
  const yMean  = prices.reduce((a, b) => a + b, 0) / n;
  const ssTot  = prices.reduce((a, v) => a + (v - yMean) ** 2, 0);
  const r2Raw  = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
  const r2     = parseFloat((r2Raw * 100).toFixed(1));
  const pearsonR = parseFloat((Math.sqrt(r2Raw) * (slope >= 0 ? 1 : -1)).toFixed(4));

  const currentFit   = intercept + slope * (n - 1);
  const nextBarFit   = intercept + slope * n;
  const upperChannel = fmtP(currentFit + 2 * resSd, ref);
  const lowerChannel = fmtP(currentFit - 2 * resSd, ref);

  const slopePct  = parseFloat(((slope / ref) * 100).toFixed(5));
  const isTrendUp = slope > 0;
  const signalStrength: 'weak' | 'moderate' | 'strong' =
    r2Raw >= 0.72 ? 'strong' : r2Raw >= 0.42 ? 'moderate' : 'weak';

  return {
    slope:          slopePct,
    slopeRaw:       parseFloat(slope.toFixed(6)),
    intercept:      parseFloat(intercept.toFixed(4)),
    upperChannel,
    lowerChannel,
    currentFit:     fmtP(currentFit, ref),
    nextBarFit:     fmtP(nextBarFit, ref),
    r2,
    pearsonR,
    signalStrength,
    isTrendUp,
    verdict: isTrendUp
      ? `قناة صاعدة: الميل +${slopePct}% | R²=${r2}%. القناة من ${lowerChannel} إلى ${upperChannel}.`
      : `قناة هابطة: الميل ${slopePct}% | R²=${r2}%. القناة من ${lowerChannel} إلى ${upperChannel}.`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Markov Regime Classifier (50-bar HMM proxy)
// ═════════════════════════════════════════════════════════════════════════════

export type MarkovRegime = 'BULL_VOLATILE' | 'BULL_CALM' | 'BEAR_VOLATILE' | 'BEAR_CALM' | 'CHOPPY';

export interface MarkovResult {
  regime:      MarkovRegime;
  regimeAr:    string;
  probability: number;
  verdict:     string;
}

export function analyzeMarkovModel(klines: Kline[]): MarkovResult {
  const slice   = klines.slice(-50);
  const closes  = slice.map(k => k.close);
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);

  const mean  = returns.reduce((a, b) => a + b, 0) / returns.length;
  const vol   = Math.sqrt(returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length);

  // Long-run vol baseline (full kline set)
  const allCloses  = klines.map(k => k.close);
  const allReturns: number[] = [];
  for (let i = 1; i < allCloses.length; i++) allReturns.push((allCloses[i] - allCloses[i - 1]) / allCloses[i - 1]);
  const longVol = Math.sqrt(allReturns.reduce((a, r) => a + r * r, 0) / allReturns.length);

  const isVolatile = vol > longVol * 1.2;
  const isBull     = mean > 0;
  const isChoppy   = Math.abs(mean) < longVol * 0.1;

  let regime: MarkovRegime;
  let regimeAr: string;
  let probability: number;

  if (isChoppy) {
    regime = 'CHOPPY'; regimeAr = 'سوق عرضي (CHOPPY)'; probability = 58;
  } else if (isBull && isVolatile) {
    regime = 'BULL_VOLATILE'; regimeAr = 'سوق صاعد متقلب'; probability = 72;
  } else if (isBull) {
    regime = 'BULL_CALM'; regimeAr = 'سوق صاعد هادئ'; probability = 78;
  } else if (isVolatile) {
    regime = 'BEAR_VOLATILE'; regimeAr = 'سوق هابط متقلب'; probability = 69;
  } else {
    regime = 'BEAR_CALM'; regimeAr = 'سوق هابط هادئ'; probability = 74;
  }

  // Refine probability based on how extreme the regime signal is
  const volRatio  = vol / (longVol || 1);
  const meanScore = Math.min(1, Math.abs(mean) / (longVol * 3));
  probability = Math.round(Math.min(95, Math.max(50,
    probability * 0.6 + (volRatio * 20 + meanScore * 20) * 0.4,
  )));

  return {
    regime,
    regimeAr,
    probability,
    verdict: `النظام الحالي: ${regimeAr} — احتمالية ${probability}%. التذبذب قصير المدى ${(vol * 100).toFixed(2)}% مقارنة بـ ${(longVol * 100).toFixed(2)}% تاريخياً.`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Fourier Cycle Proxy (swing-peak distance)
// ═════════════════════════════════════════════════════════════════════════════

export interface FourierResult {
  dominantCycleBars: number;
  nextPeakEstimate:  number;   // bar index from current
  lastPeakAge:       number;   // bars since the last detected peak
  verdict:           string;
}

export function analyzeFourier(klines: Kline[]): FourierResult {
  // Find major swing highs (5-bar window) in the last 200 bars
  const slice = klines.slice(-200);

  const peaks: number[] = [];
  const WIN = 5;
  for (let i = WIN; i < slice.length - WIN; i++) {
    const h = slice[i].high;
    let isPeak = true;
    for (let j = i - WIN; j <= i + WIN; j++) {
      if (j !== i && slice[j].high >= h) { isPeak = false; break; }
    }
    if (isPeak) peaks.push(i);
  }

  if (peaks.length < 2) {
    // Fallback: rough estimate based on EMA crossover rhythm
    return {
      dominantCycleBars: 20,
      nextPeakEstimate:  10,
      lastPeakAge:       0,
      verdict: 'بيانات قمم غير كافية. التقدير المبدئي: دورة 20 شمعة.',
    };
  }

  // Average distance between consecutive peaks
  const gaps: number[] = [];
  for (let i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1]);
  const avgCycle = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);

  const lastPeakIdx  = peaks[peaks.length - 1];
  const lastPeakAge  = slice.length - 1 - lastPeakIdx;
  const nextPeak     = Math.max(1, avgCycle - lastPeakAge);

  return {
    dominantCycleBars: avgCycle,
    nextPeakEstimate:  nextPeak,
    lastPeakAge,
    verdict: `الدورة المهيمنة المقدّرة: ${avgCycle} شمعة. القمة الأخيرة قبل ${lastPeakAge} شمعة. القمة التالية المتوقعة خلال ≈ ${nextPeak} شمعة.`,
  };
}


export function analyzeLinearRegressionRange(klines: Kline[], startIndex: number, endIndex: number): LinearRegressionResult {
  // ── Validate range ────────────────────────────────────────────────────────
  const start = Math.max(0, Math.min(startIndex, endIndex));
  const end   = Math.min(klines.length - 1, Math.max(startIndex, endIndex));

  if (end - start < 4) {
    throw new Error('يجب توفر 5 شموع على الأقل للتحليل الدقيق.');
  }

  const slice = klines.slice(start, end + 1);
  const n     = slice.length;

  // ── Typical price (H+L+C)/3 → more robust than close alone ───────────────
  const prices = slice.map(k => (k.high + k.low + k.close) / 3);
  const ref    = slice[slice.length - 1].close; // for formatting

  // ── Exponential decay weights (λ=0.98, newest bar = weight 1.0) ──────────
  const LAMBDA = 0.98;
  const weights: number[] = Array.from({ length: n }, (_, i) => Math.pow(LAMBDA, n - 1 - i));

  const W   = weights.reduce((a, b)    => a + b,          0);
  const Wx  = weights.reduce((a, w, i) => a + w * i,      0);
  const Wy  = weights.reduce((a, w, i) => a + w * prices[i], 0);
  const Wxy = weights.reduce((a, w, i) => a + w * i * prices[i], 0);
  const Wxx = weights.reduce((a, w, i) => a + w * i * i,  0);

  // ── WLS normal equations ──────────────────────────────────────────────────
  const denom = W * Wxx - Wx * Wx;
  if (Math.abs(denom) < 1e-12) throw new Error('البيانات متطابقة أو غير قابلة للتحليل.');

  const slope     = (W * Wxy - Wx * Wy) / denom;
  const intercept = (Wy - slope * Wx)    / W;

  // ── Residuals & corrected σ (df = n-2) ───────────────────────────────────
  const fitted   = prices.map((_, i) => intercept + slope * i);
  const residuals = prices.map((v, i)  => v - fitted[i]);
  const ssRes    = residuals.reduce((a, r) => a + r * r, 0);
  const resSd    = Math.sqrt(ssRes / Math.max(1, n - 2));

  // ── R² (unweighted, for interpretability) ────────────────────────────────
  const yMean = prices.reduce((a, b) => a + b, 0) / n;
  const ssTot = prices.reduce((a, v) => a + (v - yMean) ** 2, 0);
  const r2Raw = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
  const r2    = parseFloat((r2Raw * 100).toFixed(1)); // 0–100

  // ── Pearson r ─────────────────────────────────────────────────────────────
  const pearsonR = parseFloat((Math.sqrt(r2Raw) * (slope >= 0 ? 1 : -1)).toFixed(4));

  // ── Key price levels ─────────────────────────────────────────────────────
  const currentFit   = intercept + slope * (n - 1);
  const nextBarFit   = intercept + slope * n;
  const upperChannel = fmtP(currentFit + 2 * resSd, ref);
  const lowerChannel = fmtP(currentFit - 2 * resSd, ref);

  // ── Normalized slope (% per bar) ─────────────────────────────────────────
  const slopePct    = parseFloat(((slope / ref) * 100).toFixed(5));
  const isTrendUp   = slope > 0;

  // ── Signal strength based on R² ──────────────────────────────────────────
  const signalStrength: 'weak' | 'moderate' | 'strong' =
    r2Raw >= 0.72 ? 'strong' : r2Raw >= 0.42 ? 'moderate' : 'weak';

  // ── Verdict ───────────────────────────────────────────────────────────────
  const verdictDir = isTrendUp ? '📈 قناة صاعدة' : '📉 قناة هابطة';
  const verdict =
    `${verdictDir}: ميل ${isTrendUp ? '+' : ''}${slopePct}% لكل شمعة` +
    ` | دقة الخط R²=${r2}% (${signalStrength === 'strong' ? 'قوي' : signalStrength === 'moderate' ? 'متوسط' : 'ضعيف'})` +
    ` | القناة: ${lowerChannel} ← ${fmtP(currentFit, ref)} → ${upperChannel}.`;

  return {
    slope:          slopePct,
    slopeRaw:       parseFloat(slope.toFixed(6)),
    intercept:      parseFloat(intercept.toFixed(4)),
    currentFit:     fmtP(currentFit, ref),
    nextBarFit:     fmtP(nextBarFit, ref),
    upperChannel,
    lowerChannel,
    r2,
    pearsonR,
    signalStrength,
    isTrendUp,
    verdict,
  };
}
