// ─── Core Math Utilities ──────────────────────────────────────────────────────
// All functions operate on plain number arrays for maximum reusability.
// No external dependencies — 100% client-side, zero latency.
// PHASE 1 FIX: Added NaN/Infinity guards and floating-point precision utilities.

/**
 * Clamp a value between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Returns true if a value is a finite, non-NaN number.
 */
export function isValidNumber(n: number): boolean {
  return typeof n === 'number' && isFinite(n) && !isNaN(n);
}

/**
 * Simple Moving Average.
 *
 * Returns an array of the same length as `data`.
 * The first `period - 1` entries are `NaN` (insufficient data).
 *
 * @param data   - Raw price series (e.g. close prices)
 * @param period - Lookback window
 */
export function calculateSMA(data: number[], period: number): number[] {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new RangeError(`SMA period must be a positive integer, got ${period}`);
  }

  // FIX: filter out non-finite input values to prevent NaN propagation
  const result: number[] = new Array(data.length).fill(NaN);

  if (data.length < period) return result;

  // Seed: sum of the first window (guard against NaN inputs)
  let windowSum = 0;
  let validCount = 0;
  for (let i = 0; i < period; i++) {
    if (isValidNumber(data[i])) { windowSum += data[i]; validCount++; }
  }
  if (validCount === period) result[period - 1] = windowSum / period;

  // Slide the window
  for (let i = period; i < data.length; i++) {
    const entering = isValidNumber(data[i])          ? data[i]          : 0;
    const leaving  = isValidNumber(data[i - period]) ? data[i - period] : 0;
    windowSum += entering - leaving;
    result[i] = windowSum / period;
  }

  return result;
}

/**
 * Exponential Moving Average.
 *
 * Uses the standard EMA multiplier: k = 2 / (period + 1).
 * Seeded from the SMA of the first `period` values.
 * The first `period - 1` entries are `NaN`.
 *
 * @param data   - Raw price series
 * @param period - Lookback window (span)
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new RangeError(`EMA period must be a positive integer, got ${period}`);
  }

  const result: number[] = new Array(data.length).fill(NaN);

  if (data.length < period) return result;

  // Seed from SMA of first window
  let seed = 0;
  for (let i = 0; i < period; i++) seed += data[i];
  result[period - 1] = seed / period;

  const k = 2 / (period + 1);

  for (let i = period; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }

  return result;
}

/**
 * Rolling Standard Deviation (population σ) over a trailing `period` window.
 *
 * Returns a single number — the σ of the **last** `period` values in `data`.
 * Useful for Bollinger Bands, GARCH seeding, and volatility estimates.
 *
 * @param data   - Raw price series (must have at least `period` elements)
 * @param period - Lookback window
 */
export function calculateStandardDeviation(data: number[], period: number): number {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new RangeError(`StdDev period must be a positive integer, got ${period}`);
  }
  if (data.length < period) {
    throw new RangeError(
      `Not enough data: need ${period} points, got ${data.length}`,
    );
  }

  // FIX: filter out non-finite values before computing σ to prevent NaN
  const slice = data
    .slice(data.length - period)
    .filter(v => isValidNumber(v));

  if (slice.length < 2) return 0; // Not enough valid points — return 0 not NaN

  const mean     = slice.reduce((acc, v) => acc + v, 0) / slice.length;
  const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / slice.length;

  return Math.sqrt(variance);
}

/**
 * Wilder's Smoothed Moving Average — used internally by RSI, ATR, ADX.
 * Seeded from SMA of the first `period` values.
 *
 * @param data   - Raw series
 * @param period - Wilder period
 */
export function calculateWilderMA(data: number[], period: number): number[] {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new RangeError(`Wilder MA period must be a positive integer, got ${period}`);
  }

  const result: number[] = new Array(data.length).fill(NaN);
  if (data.length < period) return result;

  // Seed
  let seed = 0;
  for (let i = 0; i < period; i++) seed += data[i];
  result[period - 1] = seed / period;

  for (let i = period; i < data.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + data[i]) / period;
  }

  return result;
}
