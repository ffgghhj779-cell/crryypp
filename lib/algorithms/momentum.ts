// ─── Momentum & Trend Indicator Analyzers ─────────────────────────────────────
// lib/algorithms/momentum.ts
// Thick-client, 100% browser-side. Expects 100 candles per call.
// ✅ PARITY FIX: RSI now uses calcBinanceRSI (Wilder's RMA).
//                calculateMomentumIntelligence now uses real klines data.

import type { Kline } from '@/lib/binance/fetcher';
import {
  calculateEMA,
  calculateSMA,
  calculateStandardDeviation,
  calculateWilderMA,
  calcBinanceRSI,
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
 * Binance-authentic RSI (14-period) using Wilder's RMA.
 * ✅ Matches Binance chart exactly.
 */
export function analyzeRSI(klines: Kline[]): RSIResult {
  if (klines.length < 15) throw new Error('RSI requires at least 15 candles.');

  const closes = klines.map(k => k.close);
  const rsi    = calcBinanceRSI(closes, 14);
  const value  = fmt(rsi, 2);

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

// ═════════════════════════════════════════════════════════════════════════════
// 4. Momentum Intelligence (ذكاء الزخم)
// ═════════════════════════════════════════════════════════════════════════════

export interface MomentumIntelligenceResult {
  symbol: string;
  globalScore: number;
  momentumStateAr: string;
  insightAr: string;
  indicators: {
    rsi: { value: number; status: string; statusAr: string };
    macd: { hist: number; macd: number; signal: number; status: string; statusAr: string };
    stoch: { k: number; d: number; status: string; statusAr: string };
  };
}

// ✅ PARITY FIX: Real calculations using live klines
export function calculateMomentumIntelligence(symbol: string, klines?: Kline[]): MomentumIntelligenceResult {
  // If klines provided, use real data; otherwise minimal fallback
  if (!klines || klines.length < 30) {
    return {
      symbol, globalScore: 50,
      momentumStateAr: 'بيانات غير كافية',
      insightAr: 'يحتاج التحليل إلى بيانات شمعة كافية.',
      indicators: {
        rsi:   { value: 50, status: 'Neutral', statusAr: 'محايد' },
        macd:  { hist: 0,   macd: 0, signal: 0, status: 'Neutral', statusAr: 'محايد' },
        stoch: { k: 50, d: 50, status: 'Neutral', statusAr: 'محايد' },
      }
    };
  }

  const closes = klines.map(k => k.close);

  // ── RSI (14) — Wilder's RMA ────────────────────────────────────────────────
  const rsiVal = calcBinanceRSI(closes, 14);
  let rsiStatus = 'Neutral', rsiStatusAr = 'محايد';
  if (rsiVal >= 70)      { rsiStatus = 'Overbought'; rsiStatusAr = 'تشبع شرائي'; }
  else if (rsiVal <= 30) { rsiStatus = 'Oversold';   rsiStatusAr = 'تشبع بيعي'; }
  else if (rsiVal > 55)  { rsiStatus = 'Bullish';    rsiStatusAr = 'زخم إيجابي'; }
  else if (rsiVal < 45)  { rsiStatus = 'Bearish';    rsiStatusAr = 'زخم سلبي'; }

  // ── MACD (12, 26, 9) — EMA ────────────────────────────────────────────────
  const ema12Arr = calculateEMA(closes, 12);
  const ema26Arr = calculateEMA(closes, 26);
  const macdLine = closes.map((_, i) => (isNaN(ema12Arr[i]) || isNaN(ema26Arr[i])) ? NaN : ema12Arr[i] - ema26Arr[i]);
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalRaw = calculateEMA(validMacd, 9);
  const macdVal   = lastVal(macdLine);
  const signalVal = lastVal(signalRaw);
  const hist      = parseFloat((macdVal - signalVal).toFixed(4));

  let macdStatus = 'Neutral', macdStatusAr = 'محايد';
  if (hist > 0 && macdVal > 0)  { macdStatus = 'Expanding Bullish'; macdStatusAr = 'تسارع صعودي'; }
  else if (hist > 0)             { macdStatus = 'Weak Bullish';      macdStatusAr = 'ضعف إيجابي'; }
  else if (hist < 0 && macdVal < 0) { macdStatus = 'Expanding Bearish'; macdStatusAr = 'تسارع هبوطي'; }
  else if (hist < 0)             { macdStatus = 'Weak Bearish';      macdStatusAr = 'ضعف سلبي'; }

  // ── Stochastic (14, 3, 3) ─────────────────────────────────────────────────
  const p = 14;
  const hl: { h: number; l: number }[] = klines.map((_, i) => ({
    h: Math.max(...klines.slice(Math.max(0, i - p + 1), i + 1).map(k => k.high)),
    l: Math.min(...klines.slice(Math.max(0, i - p + 1), i + 1).map(k => k.low)),
  }));
  const kRaw = klines.map((k, i) => {
    const range = hl[i].h - hl[i].l;
    return range > 0 ? ((k.close - hl[i].l) / range) * 100 : 50;
  });
  const kSmooth = calculateSMA(kRaw, 3);
  const dSmooth = calculateSMA(kSmooth, 3);
  const stochK  = Math.round(lastVal(kSmooth));
  const stochD  = Math.round(lastVal(dSmooth));

  let stochStatus = 'Neutral', stochStatusAr = 'محايد';
  if (stochK > 80)         { stochStatus = 'Overbought';   stochStatusAr = 'تشبع شرائي'; }
  else if (stochK < 20)    { stochStatus = 'Oversold';     stochStatusAr = 'تشبع بيعي'; }
  else if (stochK > stochD) { stochStatus = 'Bullish Cross'; stochStatusAr = 'تقاطع صاعد'; }
  else                     { stochStatus = 'Bearish Cross'; stochStatusAr = 'تقاطع هابط'; }

  // ── Global Momentum Score ──────────────────────────────────────────────────
  const rsiEnergy   = Math.abs(rsiVal - 50) * 2;
  const histNorm    = Math.min(100, Math.abs(hist / (closes[closes.length - 1] || 1)) * 10000);
  const stochEnergy = Math.abs(stochK - 50) * 2;
  const globalScore = Math.round((rsiEnergy + histNorm + stochEnergy) / 3);

  const isBullishDir = rsiVal > 50 && hist > 0;

  let stateAr = '', insightAr = '';
  if (globalScore > 75) {
    if (rsiVal >= 75 || stochK >= 85) {
      stateAr = 'تشبع شرائي ينذر بانعكاس';
      insightAr = 'الزخم بلغ مستويات تشبع شرائي حادة. يُنصح بالحذر من جني أرباح مفاجئ.';
    } else if (rsiVal <= 25 || stochK <= 15) {
      stateAr = 'تشبع بيعي ينذر بارتداد';
      insightAr = 'ضغط بيعي مفرط وضع الأصل في منطقة تشبع عميقة. احتمالية ارتداد واردة.';
    } else {
      stateAr   = isBullishDir ? 'تسارع صعودي قوي' : 'تسارع هبوطي قوي';
      insightAr = `الزخم يدعم الاتجاه ${isBullishDir ? 'الصاعد' : 'الهابط'} بطاقة حركية عالية.`;
    }
  } else if (globalScore > 40) {
    stateAr   = isBullishDir ? 'زخم إيجابي مستقر' : 'زخم سلبي مستقر';
    insightAr = `الزخم ${isBullishDir ? 'الشرائي' : 'البيعي'} يسيطر. يمكن بناء تمركزات مع الاتجاه الحالي.`;
  } else {
    stateAr   = 'انعدام الزخم (حركة عرضية)';
    insightAr = 'السوق يفتقر إلى السيولة. من المتوقع استمرار الحركة العرضية حتى دخول سيولة جديدة.';
  }

  return {
    symbol,
    globalScore: Math.min(100, globalScore),
    momentumStateAr: stateAr,
    insightAr,
    indicators: {
      rsi:   { value: Math.round(rsiVal), status: rsiStatus, statusAr: rsiStatusAr },
      macd:  { hist: parseFloat(hist.toFixed(4)), macd: parseFloat(macdVal.toFixed(4)), signal: parseFloat(signalVal.toFixed(4)), status: macdStatus, statusAr: macdStatusAr },
      stoch: { k: stochK, d: stochD, status: stochStatus, statusAr: stochStatusAr },
    }
  };
}
