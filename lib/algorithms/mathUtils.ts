// ─── Core Math Utilities ──────────────────────────────────────────────────────
// All functions operate on plain number arrays for maximum reusability.
// No external dependencies — 100% client-side, zero latency.
// PHASE 2 FIX: All RSI/ATR now use Wilder's RMA (matching Binance exactly).
//              Added fm() price formatter matching competitor source.

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
 * Price formatter — matches competitor fm() function exactly.
 * Handles all price ranges from sub-penny to six-figure assets.
 */
export function fm(p: number): string {
  if (!isValidNumber(p) || p === 0) return '0';
  const abs = Math.abs(p);
  if (abs >= 10000) return p.toFixed(1);
  if (abs >= 1000)  return p.toFixed(2);
  if (abs >= 100)   return p.toFixed(3);
  if (abs >= 10)    return p.toFixed(4);
  if (abs >= 1)     return p.toFixed(5);
  if (abs >= 0.1)   return p.toFixed(6);
  if (abs >= 0.01)  return p.toFixed(7);
  return p.toFixed(8);
}

/**
 * Simple Moving Average.
 * Returns an array of the same length as `data`.
 * The first `period - 1` entries are `NaN` (insufficient data).
 */
export function calculateSMA(data: number[], period: number): number[] {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new RangeError(`SMA period must be a positive integer, got ${period}`);
  }

  const result: number[] = new Array(data.length).fill(NaN);
  if (data.length < period) return result;

  let windowSum = 0;
  let validCount = 0;
  for (let i = 0; i < period; i++) {
    if (isValidNumber(data[i])) { windowSum += data[i]; validCount++; }
  }
  if (validCount === period) result[period - 1] = windowSum / period;

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
 * Uses k = 2 / (period + 1). Seeded from SMA of first `period` values.
 * First `period - 1` entries are `NaN`.
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new RangeError(`EMA period must be a positive integer, got ${period}`);
  }

  const result: number[] = new Array(data.length).fill(NaN);
  if (data.length < period) return result;

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
 * Rolling Standard Deviation (population σ) over trailing `period` window.
 */
export function calculateStandardDeviation(data: number[], period: number): number {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new RangeError(`StdDev period must be a positive integer, got ${period}`);
  }
  if (data.length < period) {
    throw new RangeError(`Not enough data: need ${period} points, got ${data.length}`);
  }

  const slice = data.slice(data.length - period).filter(v => isValidNumber(v));
  if (slice.length < 2) return 0;

  const mean     = slice.reduce((acc, v) => acc + v, 0) / slice.length;
  const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / slice.length;

  return Math.sqrt(variance);
}

/**
 * Wilder's Smoothed Moving Average (RMA) — used by RSI, ATR, ADX.
 * ⚠️ This is the BINANCE-AUTHENTIC implementation. Seeded from SMA.
 */
export function calculateWilderMA(data: number[], period: number): number[] {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new RangeError(`Wilder MA period must be a positive integer, got ${period}`);
  }

  const result: number[] = new Array(data.length).fill(NaN);
  if (data.length < period) return result;

  let seed = 0;
  for (let i = 0; i < period; i++) seed += data[i];
  result[period - 1] = seed / period;

  for (let i = period; i < data.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + data[i]) / period;
  }

  return result;
}

/**
 * Binance-Authentic RSI using Wilder's RMA method.
 * ✅ Matches Binance chart exactly (as verified from competitor source calcBinanceRSI).
 * Returns a single RSI value for the last candle.
 */
export function calcBinanceRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  // Initial SMA seed for first period
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Wilder's RMA smoothing for the rest
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Returns a full RSI array (same length as closes, NaN for initial period).
 * Uses Wilder's RMA — matches Binance.
 */
export function calcBinanceRSIArray(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs0));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = ((avgGain * (period - 1)) + (diff > 0 ? diff : 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + (diff < 0 ? -diff : 0)) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
  }

  return result;
}

/**
 * Finds local peaks in array (index where value > all neighbors within radius).
 */
export function findPeaks(data: (number | null)[], start: number, end: number, radius = 2): number[] {
  const peaks: number[] = [];
  for (let i = start + radius; i < end - radius; i++) {
    const v = data[i];
    if (v === null || v === undefined || isNaN(v as number)) continue;
    let isPeak = true;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j === i) continue;
      const vj = data[j];
      if (vj !== null && vj !== undefined && !isNaN(vj as number) && (vj as number) >= (v as number)) {
        isPeak = false; break;
      }
    }
    if (isPeak) peaks.push(i);
  }
  return peaks;
}

/**
 * Finds local troughs in array.
 */
export function findTroughs(data: (number | null)[], start: number, end: number, radius = 2): number[] {
  const troughs: number[] = [];
  for (let i = start + radius; i < end - radius; i++) {
    const v = data[i];
    if (v === null || v === undefined || isNaN(v as number)) continue;
    let isTrough = true;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j === i) continue;
      const vj = data[j];
      if (vj !== null && vj !== undefined && !isNaN(vj as number) && (vj as number) <= (v as number)) {
        isTrough = false; break;
      }
    }
    if (isTrough) troughs.push(i);
  }
  return troughs;
}

/**
 * Calculates MACD line, signal line, and histogram.
 * Standard: EMA(12) - EMA(26), Signal = EMA(9) of MACD line.
 */
export function calcMACD(closes: number[]): { macd: number[]; signal: number[]; hist: number[] } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd  = closes.map((_, i) => (isNaN(ema12[i]) || isNaN(ema26[i])) ? NaN : ema12[i] - ema26[i]);
  const validMacd = macd.filter(v => !isNaN(v));
  const signalRaw = calculateEMA(validMacd, 9);

  // Re-align signal to full length
  const signal: number[] = new Array(closes.length).fill(NaN);
  let si = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macd[i])) {
      signal[i] = signalRaw[si++] ?? NaN;
    }
  }

  const hist = macd.map((v, i) => (isNaN(v) || isNaN(signal[i])) ? NaN : v - signal[i]);
  return { macd, signal, hist };
}

/**
 * Calculates On-Balance Volume (OBV) array.
 */
export function calcOBV(klines: { close: number; volume: number }[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < klines.length; i++) {
    const prev = obv[i - 1];
    if (klines[i].close > klines[i - 1].close)      obv.push(prev + klines[i].volume);
    else if (klines[i].close < klines[i - 1].close) obv.push(prev - klines[i].volume);
    else                                              obv.push(prev);
  }
  return obv;
}

/**
 * Gann Square of Nine — directional scale factor.
 * ✅ EXACT copy of competitor getSF() from sources/calculations.js line 19.
 * function getSF(p,d){if(p>=10000)return d==='up'?0.0001:(p>=40000?0.0001:0.001);
 *   if(p>=1000)return 0.01;if(p>=100)return 0.1;
 *   if(p>=5)return d==='down'?100:1;
 *   if(p>=1)return d==='down'?100:1;
 *   return 100}
 */
export function getSF(p: number, direction: 'up' | 'down' = 'up'): number {
  if (p >= 10000) return direction === 'up' ? 0.0001 : (p >= 40000 ? 0.0001 : 0.001);
  if (p >= 1000)  return 0.01;
  if (p >= 100)   return 0.1;
  if (p >= 5)     return direction === 'down' ? 100 : 1;
  if (p >= 1)     return direction === 'down' ? 100 : 1;
  return 100; // sub-$1 assets (e.g. DOGE, XRP, SHIB)
}

/**
 * Gann Square of Nine — compute a single level.
 * ✅ EXACT copy of competitor sc() from sources/calculations.js line 20.
 * function sc(p,deg,d){let m=getSF(p,d),r=Math.sqrt(p*m),f=deg/180,
 *   nr=d==='up'?r+f:r-f;return nr<0?0:(nr*nr)/m}
 */
export function sq9Level(price: number, angleDeg: number, direction: 'up' | 'down'): number {
  const m  = getSF(price, direction);
  const r  = Math.sqrt(price * m);
  const f  = angleDeg / 180;
  const nr = direction === 'up' ? r + f : r - f;
  return nr < 0 ? 0 : (nr * nr) / m;
}
