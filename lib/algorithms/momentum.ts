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

export function calculateMomentumIntelligence(symbol: string): MomentumIntelligenceResult {
  // Deterministic Mock based on symbol and time
  const now = new Date();
  const timeMod = now.getMinutes() + now.getHours();
  
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = symbol.charCodeAt(i) + ((seed << 5) - seed);
  }
  seed = Math.abs(seed + timeMod);

  // --- RSI (14) ---
  const rsiVal = 20 + (seed % 65); // 20 to 85
  let rsiStatus = 'Neutral';
  let rsiStatusAr = 'محايد';
  if (rsiVal >= 70) { rsiStatus = 'Overbought'; rsiStatusAr = 'تشبع شرائي'; }
  else if (rsiVal <= 30) { rsiStatus = 'Oversold'; rsiStatusAr = 'تشبع بيعي'; }
  else if (rsiVal > 50) { rsiStatus = 'Bullish'; rsiStatusAr = 'زخم إيجابي'; }
  else { rsiStatus = 'Bearish'; rsiStatusAr = 'زخم سلبي'; }

  // --- MACD (12, 26, 9) ---
  const histBase = (seed % 100) - 50; 
  const hist = histBase * 2; // -100 to 100
  let macdStatus = 'Neutral';
  let macdStatusAr = 'محايد';
  if (hist > 20) { macdStatus = 'Expanding Bullish'; macdStatusAr = 'تسارع صعودي'; }
  else if (hist > 0) { macdStatus = 'Weak Bullish'; macdStatusAr = 'ضعف إيجابي'; }
  else if (hist < -20) { macdStatus = 'Expanding Bearish'; macdStatusAr = 'تسارع هبوطي'; }
  else { macdStatus = 'Weak Bearish'; macdStatusAr = 'ضعف سلبي'; }

  // --- Stochastic (14, 3, 3) ---
  const stochK = 10 + ((seed * 13) % 85); // 10 to 95
  const stochD = stochK - 5 + ((seed * 7) % 10);
  let stochStatus = 'Neutral';
  let stochStatusAr = 'محايد';
  if (stochK > 80) { stochStatus = 'Overbought'; stochStatusAr = 'تشبع شرائي'; }
  else if (stochK < 20) { stochStatus = 'Oversold'; stochStatusAr = 'تشبع بيعي'; }
  else if (stochK > stochD) { stochStatus = 'Bullish Cross'; stochStatusAr = 'تقاطع صاعد'; }
  else { stochStatus = 'Bearish Cross'; stochStatusAr = 'تقاطع هابط'; }

  // --- Global Momentum Score (0 to 100) ---
  const rsiEnergy = Math.abs(rsiVal - 50) * 2; 
  const macdEnergy = Math.min(Math.abs(hist), 100);
  const stochEnergy = Math.abs(stochK - 50) * 2; 

  const globalScore = Math.round((rsiEnergy + macdEnergy + stochEnergy) / 3);

  let stateAr = '';
  let insightAr = '';

  const isBullishDir = rsiVal > 50 && hist > 0;

  if (globalScore > 75) {
    if (rsiVal >= 75 || stochK >= 85) {
      stateAr = 'تشبع شرائي ينذر بانعكاس';
      insightAr = 'الزخم الحالي قوي جداً ولكنه بلغ مستويات تشبع شرائي حادة. يُنصح بالحذر من جني أرباح مفاجئ أو ارتداد هبوطي عنيف.';
    } else if (rsiVal <= 25 || stochK <= 15) {
      stateAr = 'تشبع بيعي ينذر بارتداد';
      insightAr = 'ضغط بيعي مفرط وضع الأصل في مناطق تشبع بيعي عميقة. احتمالية ارتداد سعري للأعلى لامتصاص هذا الزخم واردة جداً.';
    } else {
      stateAr = isBullishDir ? 'تسارع صعودي قوي (Trend)' : 'تسارع هبوطي قوي (Trend)';
      insightAr = `الزخم الحالي يدعم الاستمرار في الاتجاه ${isBullishDir ? 'الصاعد' : 'الهابط'}، مع طاقة حركية عالية وعدم وجود إشارات تشبع قريبة.`;
    }
  } else if (globalScore > 40) {
    stateAr = isBullishDir ? 'زخم إيجابي مستقر' : 'زخم سلبي مستقر';
    insightAr = `طاقة السوق جيدة والزخم ${isBullishDir ? 'الشرائي' : 'البيعي'} يسيطر على الحركة. يمكن بناء تمركزات مع الاتجاه الحالي.`;
  } else {
    stateAr = 'انعدام الزخم (حركة عرضية)';
    insightAr = 'السوق يفتقر إلى السيولة والزخم حالياً. من المتوقع استمرار الحركة العرضية البطيئة حتى دخول سيولة جديدة.';
  }

  return {
    symbol,
    globalScore,
    momentumStateAr: stateAr,
    insightAr,
    indicators: {
      rsi: { value: Math.round(rsiVal), status: rsiStatus, statusAr: rsiStatusAr },
      macd: { hist: Math.round(hist), macd: Number((hist * 1.5).toFixed(2)), signal: Number((hist * 0.5).toFixed(2)), status: macdStatus, statusAr: macdStatusAr },
      stoch: { k: Math.round(stochK), d: Math.round(stochD), status: stochStatus, statusAr: stochStatusAr }
    }
  };
}
