/**
 * lib/algorithms/volatility.ts
 *
 * ATR Volatility Engine (محرك التقلبات) — Squeeze Detector
 * ✅ PARITY FIX: Added Bollinger + Keltner squeeze detection.
 *    - Squeeze condition: BB inside KC (matching competitor calculations.js)
 *    - KC multiplier = 1.5 (competitor standard)
 *    - BB: period=20, mult=2
 *    - ATR targets: t1=1.5×, t2=2.5×, t3=4× (from competitor source)
 *    - Squeeze intensity: (1 - bbW/kcW) * 100
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calculateEMA, calculateSMA, calculateStandardDeviation } from './mathUtils';

export type VolatilityState = 'Contracting' | 'Expanding';

export interface VolatilityResult {
  symbol: string;
  currentPrice: number;
  atrValue: number;
  smaAtrValue: number;
  state: VolatilityState;
  stateAr: string;
  safeStopLossDist: number;
  volatilityPct: number;          // 0 to 100 for gauge

  // Squeeze detector (Bollinger + Keltner)
  inSqueeze: boolean;
  squeezeIntensityPct: number;    // 0–100
  squeezeStateAr: string;

  // ATR price targets (matches competitor source)
  targetUp1: number;   // price + ATR × 1.5
  targetUp2: number;   // price + ATR × 2.5
  targetUp3: number;   // price + ATR × 4.0
  targetDn1: number;   // price - ATR × 1.5
  targetDn2: number;   // price - ATR × 2.5
  targetDn3: number;   // price - ATR × 4.0

  // Chart Overlays Data
  bbUpperArr: number[];
  bbLowerArr: number[];
  sma20Arr: number[];
  kcUpperArr: number[];
  kcLowerArr: number[];
  atrArr: number[];
}

// ─── True Range list ──────────────────────────────────────────────────────────
function calcTRList(klines: Kline[]): number[] {
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high, l = klines[i].low, pc = klines[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs;
}

// ─── ATR using Wilder's RMA ───────────────────────────────────────────────────
function calcATRWilder(klines: Kline[], p = 14): number[] {
  const trs = calcTRList(klines);
  const out: number[] = new Array(klines.length).fill(NaN);
  if (trs.length < p) return out;

  // Initial SMA seed
  let seed = trs.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out[p] = seed; // index p (because tr starts at index 1 of klines)
  for (let i = p; i < trs.length; i++) {
    seed = (seed * (p - 1) + trs[i]) / p;
    out[i + 1] = seed;
  }
  return out;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function calculateVolatility(symbol: string, klines: Kline[]): VolatilityResult {
  const lastClose  = klines.length > 0 ? klines[klines.length - 1].close : 65000;
  const closes     = klines.map(k => k.close);

  // ─── ATR(14) ─────────────────────────────────────────────────────────────
  const atrArr     = calcATRWilder(klines, 14);
  const validATR   = atrArr.filter(v => !isNaN(v));
  const atrValue   = validATR.length > 0 ? validATR[validATR.length - 1] : lastClose * 0.02;

  // 20-period SMA of ATR
  const validSlice = validATR.slice(-20);
  const smaAtrValue = validSlice.length > 0
    ? validSlice.reduce((a, b) => a + b, 0) / validSlice.length
    : atrValue;

  const state: VolatilityState = atrValue > smaAtrValue ? 'Expanding' : 'Contracting';
  const stateAr = state === 'Expanding' ? 'انفجار سعري — تقلب عالٍ' : 'انضغاط سعري — هدوء';

  const safeStopLossDist = atrValue * 1.5;

  // Volatility gauge (ATR / SMA_ATR, capped at 100%)
  let volatilityPct = (smaAtrValue > 0) ? (atrValue / smaAtrValue) * 50 : 0;
  volatilityPct = Math.min(100, Math.max(0, isNaN(volatilityPct) ? 0 : volatilityPct));

  // ─── Bollinger Bands (20, 2σ) ─────────────────────────────────────────────
  let inSqueeze = false;
  let squeezeIntensityPct = 0;
  let squeezeStateAr = 'لا ضغط';

  const bbUpperArr: number[] = new Array(klines.length).fill(NaN);
  const bbLowerArr: number[] = new Array(klines.length).fill(NaN);
  const kcUpperArr: number[] = new Array(klines.length).fill(NaN);
  const kcLowerArr: number[] = new Array(klines.length).fill(NaN);
  const sma20Arr = calculateSMA(closes, 20);

  if (closes.length >= 20) {
    // Keltner Channel (EMA20, ATR14, mult=1.5)
    const ema20Arr = calculateEMA(closes, 20);
    const kcMult = 1.5;

    for (let i = 19; i < closes.length; i++) {
      const slice = closes.slice(i - 19, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / 20;
      const sigma = Math.sqrt(slice.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / 20);
      
      bbUpperArr[i] = sma20Arr[i] + 2 * sigma;
      bbLowerArr[i] = sma20Arr[i] - 2 * sigma;
      
      kcUpperArr[i] = ema20Arr[i] + kcMult * (atrArr[i] || atrValue);
      kcLowerArr[i] = ema20Arr[i] - kcMult * (atrArr[i] || atrValue);
    }

    const bbUpper = bbUpperArr[bbUpperArr.length - 1];
    const bbLower = bbLowerArr[bbLowerArr.length - 1];
    const kcUpper = kcUpperArr[kcUpperArr.length - 1];
    const kcLower = kcLowerArr[kcLowerArr.length - 1];
    
    const bbW = bbUpper - bbLower;
    const kcW = kcUpper - kcLower;

    // Squeeze = BB inside KC
    inSqueeze = (bbUpper < kcUpper) && (bbLower > kcLower);
    squeezeIntensityPct = kcW > 0
      ? Math.max(0, Math.min(100, Math.round((1 - (bbW / kcW)) * 100)))
      : 0;
    squeezeStateAr = inSqueeze
      ? `ضغط نشط (${squeezeIntensityPct}%) — انفجار سعري وشيك`
      : 'لا ضغط — السوق في حالة عادية';
  }

  // ─── ATR Price Targets (matches competitor source) ────────────────────────
  const targetUp1 = lastClose + atrValue * 1.5;
  const targetUp2 = lastClose + atrValue * 2.5;
  const targetUp3 = lastClose + atrValue * 4.0;
  const targetDn1 = lastClose - atrValue * 1.5;
  const targetDn2 = lastClose - atrValue * 2.5;
  const targetDn3 = lastClose - atrValue * 4.0;

  return {
    symbol,
    currentPrice:        lastClose,
    atrValue:            parseFloat(atrValue.toFixed(lastClose >= 1000 ? 1 : 4)),
    smaAtrValue:         parseFloat(smaAtrValue.toFixed(lastClose >= 1000 ? 1 : 4)),
    state,
    stateAr,
    safeStopLossDist:    parseFloat(safeStopLossDist.toFixed(lastClose >= 1000 ? 1 : 4)),
    volatilityPct:       Math.round(volatilityPct),
    inSqueeze,
    squeezeIntensityPct,
    squeezeStateAr,
    targetUp1: parseFloat(targetUp1.toFixed(lastClose >= 1000 ? 1 : 4)),
    targetUp2: parseFloat(targetUp2.toFixed(lastClose >= 1000 ? 1 : 4)),
    targetUp3: parseFloat(targetUp3.toFixed(lastClose >= 1000 ? 1 : 4)),
    targetDn1: parseFloat(targetDn1.toFixed(lastClose >= 1000 ? 1 : 4)),
    targetDn2: parseFloat(targetDn2.toFixed(lastClose >= 1000 ? 1 : 4)),
    targetDn3: parseFloat(targetDn3.toFixed(lastClose >= 1000 ? 1 : 4)),
    bbUpperArr,
    bbLowerArr,
    sma20Arr,
    kcUpperArr,
    kcLowerArr,
    atrArr
  };
}
