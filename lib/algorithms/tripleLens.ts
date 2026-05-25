/**
 * lib/algorithms/tripleLens.ts
 *
 * Triple Lens (العدسة الثلاثية) Engine
 * ✅ PARITY FIX: Real calculations replacing all seed-based mock logic.
 *    - Ichimoku Cloud (9/26/52/26): real Tenkan, Kijun, Chikou, Senkou
 *    - Bollinger Bands (20, 2σ): real pctB, bandwidth, squeeze
 *    - Volume Profile (VWAP POC approximation): real POC from volume data
 *    - Confidence: totalScore/maxScore * 100 (matches competitor source)
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calculateEMA, calculateSMA } from './mathUtils';

export type LensBias = 'BULL' | 'BEAR' | 'NEUTRAL';

export interface IchimokuData {
  score: number;
  maxScore: number;
  bias: LensBias;
  priceVsCloud: string;
  tenkanKijun: string;
  chikouSpan: string;
  futureCloud: string;
  cloudDistancePct: string;
  tenkanSen: number;
  kijunSen: number;
  senkouA: number;
  senkouB: number;
}

export interface BollingerData {
  score: number;
  maxScore: number;
  bias: LensBias;
  pctB: string;
  bandwidth: string;
  priceVsSMA: string;
  squeezeStatus: string;
  upper: number;
  middle: number;
  lower: number;
}

export interface VolumeProfileData {
  score: number;
  maxScore: number;
  bias: LensBias;
  poc: string;
  priceVsPocPct: string;
  valueArea: string;
  pocPrice: number;
  vaHigh: number;
  vaLow: number;
}

export interface TripleLensResult {
  symbol: string;
  consensusScorePct: number;
  overallBias: LensBias;
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  lenses: {
    ichimoku: IchimokuData;
    bollinger: BollingerData;
    volumeProfile: VolumeProfileData;
  };
  verdictTextAr: string;
}

// ─── Price formatter ───────────────────────────────────────────────────────────
function fmtVal(val: number): string {
  if (val >= 10000) return val.toLocaleString('en', { maximumFractionDigits: 1 });
  if (val >= 1)     return val.toLocaleString('en', { maximumFractionDigits: 3 });
  return val.toLocaleString('en', { maximumFractionDigits: 6 });
}

// ─── Ichimoku helper: highest high / lowest low over period ───────────────────
function donchian(klines: Kline[], period: number, endIdx: number): { high: number; low: number } {
  const start = Math.max(0, endIdx - period + 1);
  const slice = klines.slice(start, endIdx + 1);
  return {
    high: Math.max(...slice.map(k => k.high)),
    low:  Math.min(...slice.map(k => k.low)),
  };
}

// ─── Ichimoku Cloud Lens (Trend) ─────────────────────────────────────────────
function calcIchimoku(klines: Kline[]): IchimokuData {
  const n          = klines.length;
  const lastClose  = klines[n - 1].close;
  const maxScore   = 5;

  // Standard Ichimoku periods: Tenkan=9, Kijun=26, Senkou B=52, Chikou lag=26
  if (n < 52) {
    return {
      score: 2, maxScore, bias: 'NEUTRAL',
      priceVsCloud: 'بيانات غير كافية', tenkanKijun: 'بيانات غير كافية',
      chikouSpan: 'بيانات غير كافية', futureCloud: 'بيانات غير كافية',
      cloudDistancePct: '0%', tenkanSen: lastClose, kijunSen: lastClose,
      senkouA: lastClose, senkouB: lastClose,
    };
  }

  const d9  = donchian(klines, 9,  n - 1);
  const d26 = donchian(klines, 26, n - 1);
  const d52 = donchian(klines, 52, n - 1);

  const tenkanSen = (d9.high  + d9.low)  / 2;
  const kijunSen  = (d26.high + d26.low) / 2;
  const senkouA   = (tenkanSen + kijunSen) / 2;
  const senkouB   = (d52.high + d52.low)  / 2;

  // Chikou Span = close shifted 26 bars back (we check 26 bars ago)
  const chikouClose = n >= 27 ? klines[n - 27].close : lastClose;

  // Cloud bounds at current bar (26-bar forward senkou, but we use current values)
  const cloudTop    = Math.max(senkouA, senkouB);
  const cloudBottom = Math.min(senkouA, senkouB);
  const cloudDist   = ((lastClose - cloudTop) / cloudTop * 100).toFixed(2);

  let score = 0;
  let priceVsCloud: string, tenkanKijunStr: string, chikouStr: string, futureCloudStr: string;

  // 1. Price vs Cloud
  if (lastClose > cloudTop) {
    score += 2; priceVsCloud = `فوق السحابة (+${cloudDist}%)`;
  } else if (lastClose < cloudBottom) {
    priceVsCloud = `تحت السحابة (${cloudDist}%)`;
  } else {
    score += 1; priceVsCloud = `داخل السحابة (${cloudDist}%)`;
  }

  // 2. Tenkan vs Kijun
  if (tenkanSen > kijunSen) {
    score += 1; tenkanKijunStr = 'Tenkan فوق Kijun — إيجابي';
  } else if (tenkanSen < kijunSen) {
    tenkanKijunStr = 'Tenkan تحت Kijun — سلبي';
  } else {
    score += 0.5; tenkanKijunStr = 'Tenkan = Kijun — محايد';
  }

  // 3. Chikou Span vs Price 26 bars ago
  if (lastClose > chikouClose) {
    score += 1; chikouStr = `Chikou فوق السعر السابق — تأكيد إيجابي`;
  } else if (lastClose < chikouClose) {
    chikouStr = `Chikou تحت السعر السابق — تأكيد سلبي`;
  } else {
    chikouStr = `Chikou عند مستوى السعر — محايد`;
  }

  // 4. Future Cloud direction (Senkou A vs B)
  if (senkouA > senkouB) {
    score += 1; futureCloudStr = `سحابة صاعدة (Senkou A > B)`;
  } else if (senkouA < senkouB) {
    futureCloudStr = `سحابة هابطة (Senkou A < B)`;
  } else {
    futureCloudStr = 'سحابة محايدة';
  }

  score = Math.min(maxScore, Math.max(0, Math.round(score)));
  const bias: LensBias = score >= 4 ? 'BULL' : score <= 1 ? 'BEAR' : 'NEUTRAL';

  return {
    score, maxScore, bias,
    priceVsCloud, tenkanKijun: tenkanKijunStr,
    chikouSpan: chikouStr, futureCloud: futureCloudStr,
    cloudDistancePct: `${cloudDist}%`,
    tenkanSen: parseFloat(tenkanSen.toFixed(2)),
    kijunSen:  parseFloat(kijunSen.toFixed(2)),
    senkouA:   parseFloat(senkouA.toFixed(2)),
    senkouB:   parseFloat(senkouB.toFixed(2)),
  };
}

// ─── Bollinger Bands Lens (Volatility) ───────────────────────────────────────
function calcBollinger(klines: Kline[]): BollingerData {
  const closes    = klines.map(k => k.close);
  const lastClose = closes[closes.length - 1];
  const maxScore  = 4;

  if (closes.length < 20) {
    return {
      score: 2, maxScore, bias: 'NEUTRAL', pctB: '0.5', bandwidth: '0%',
      priceVsSMA: 'بيانات غير كافية', squeezeStatus: 'غير معروف',
      upper: lastClose, middle: lastClose, lower: lastClose,
    };
  }

  const slice20 = closes.slice(-20);
  const sma20   = slice20.reduce((a, b) => a + b, 0) / 20;
  const mean    = sma20;
  const sigma   = Math.sqrt(slice20.reduce((a, v) => a + (v - mean) ** 2, 0) / 20);

  const upper = sma20 + 2 * sigma;
  const lower = sma20 - 2 * sigma;
  const bw    = upper - lower;

  // %B = (price - lower) / (upper - lower)
  const pctBNum = bw > 0 ? (lastClose - lower) / bw : 0.5;

  // Squeeze check using EMA Keltner (ATR-based)
  const atrArr = klines.slice(-20).map((k, i, arr) =>
    i === 0 ? k.high - k.low : Math.max(k.high - k.low, Math.abs(k.high - arr[i-1].close), Math.abs(k.low - arr[i-1].close))
  );
  const atr14 = atrArr.reduce((a, b) => a + b, 0) / atrArr.length;
  const ema20Arr = calculateEMA(closes, 20);
  const ema20    = ema20Arr[ema20Arr.length - 1];
  const kcUpper  = ema20 + 1.5 * atr14;
  const kcLower  = ema20 - 1.5 * atr14;
  const inSqueeze = upper < kcUpper && lower > kcLower;

  let score = 0;
  let priceVsSMAStr: string, squeezeStr: string;

  if (pctBNum > 0.8) {
    score += 2; priceVsSMAStr = `أعلى بكثير من SMA20 — (%B = ${pctBNum.toFixed(2)})`;
  } else if (pctBNum > 0.5) {
    score += 1; priceVsSMAStr = `فوق SMA20 — (%B = ${pctBNum.toFixed(2)})`;
  } else if (pctBNum < 0.2) {
    priceVsSMAStr = `قريب من الحد السفلي — (%B = ${pctBNum.toFixed(2)})`;
  } else {
    priceVsSMAStr = `تحت SMA20 — (%B = ${pctBNum.toFixed(2)})`;
  }

  if (inSqueeze) {
    score += 2; squeezeStr = 'ضغط نشط (Squeeze) — انفجار سعري وشيك';
  } else {
    squeezeStr = 'لا ضغط — توسع طبيعي';
  }

  const bwPct = (bw / sma20 * 100).toFixed(1);
  score = Math.min(maxScore, Math.max(0, score));
  const bias: LensBias = score >= 3 ? 'BULL' : score <= 1 ? 'BEAR' : 'NEUTRAL';

  return {
    score, maxScore, bias,
    pctB: pctBNum.toFixed(3),
    bandwidth: `${bwPct}%`,
    priceVsSMA: priceVsSMAStr,
    squeezeStatus: squeezeStr,
    upper: parseFloat(upper.toFixed(2)),
    middle: parseFloat(sma20.toFixed(2)),
    lower: parseFloat(lower.toFixed(2)),
  };
}

// ─── Volume Profile Lens (Liquidity / POC) ───────────────────────────────────
function calcVolumeProfile(klines: Kline[]): VolumeProfileData {
  const recent    = klines.slice(-100);
  const lastClose = recent[recent.length - 1].close;
  const maxScore  = 4;

  // Find price range
  const allHigh = Math.max(...recent.map(k => k.high));
  const allLow  = Math.min(...recent.map(k => k.low));
  const range   = allHigh - allLow;

  if (range === 0) {
    return {
      score: 2, maxScore, bias: 'NEUTRAL',
      poc: `$${fmtVal(lastClose)}`, priceVsPocPct: '0.00%',
      valueArea: `$${fmtVal(allLow)} - $${fmtVal(allHigh)}`,
      pocPrice: lastClose, vaHigh: allHigh, vaLow: allLow,
    };
  }

  // Distribute volume into 20 price buckets
  const BUCKETS = 20;
  const bucketSize = range / BUCKETS;
  const vols: number[] = new Array(BUCKETS).fill(0);

  for (const k of recent) {
    const mid     = (k.high + k.low) / 2;
    const idx     = Math.min(BUCKETS - 1, Math.floor((mid - allLow) / bucketSize));
    vols[idx]    += k.volume;
  }

  // POC = bucket with highest volume
  const pocIdx   = vols.indexOf(Math.max(...vols));
  const pocPrice = allLow + (pocIdx + 0.5) * bucketSize;

  // Value Area = 70% of total volume around POC
  const totalVol = vols.reduce((a, b) => a + b, 0);
  const vaTarget = totalVol * 0.70;
  let   vaVol    = vols[pocIdx];
  let   vaLow    = pocIdx;
  let   vaHigh   = pocIdx;

  while (vaVol < vaTarget) {
    const addLow  = vaLow > 0           ? vols[vaLow - 1]  : -1;
    const addHigh = vaHigh < BUCKETS - 1 ? vols[vaHigh + 1] : -1;
    if (addLow >= addHigh && addLow >= 0) { vaVol += addLow;  vaLow--; }
    else if (addHigh > addLow && addHigh >= 0) { vaVol += addHigh; vaHigh++; }
    else break;
  }

  const vaLowPrice  = allLow + vaLow  * bucketSize;
  const vaHighPrice = allLow + (vaHigh + 1) * bucketSize;

  const pocDiff = ((lastClose - pocPrice) / pocPrice) * 100;

  let score = 0;
  if (pocDiff > 1)       score += 2;
  else if (pocDiff > 0)  score += 1;

  if (lastClose > vaHighPrice) score += 2;
  else if (lastClose > vaLowPrice) score += 1;

  score = Math.min(maxScore, Math.max(0, score));
  const bias: LensBias = score >= 3 ? 'BULL' : score <= 1 ? 'BEAR' : 'NEUTRAL';

  return {
    score, maxScore, bias,
    poc:          `$${fmtVal(pocPrice)}`,
    priceVsPocPct: `${pocDiff > 0 ? '+' : ''}${pocDiff.toFixed(2)}%`,
    valueArea:    `$${fmtVal(vaLowPrice)} - $${fmtVal(vaHighPrice)}`,
    pocPrice: parseFloat(pocPrice.toFixed(2)),
    vaHigh:   parseFloat(vaHighPrice.toFixed(2)),
    vaLow:    parseFloat(vaLowPrice.toFixed(2)),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function analyzeTripleLens(symbol: string, klines: Kline[]): TripleLensResult {
  if (klines.length < 30) {
    const fallback = { score: 2, maxScore: 5, bias: 'NEUTRAL' as LensBias };
    return {
      symbol, consensusScorePct: 50, overallBias: 'NEUTRAL',
      bullCount: 0, bearCount: 0, neutralCount: 3,
      lenses: {
        ichimoku: { ...fallback, maxScore: 5, priceVsCloud: '—', tenkanKijun: '—', chikouSpan: '—', futureCloud: '—', cloudDistancePct: '0%', tenkanSen: 0, kijunSen: 0, senkouA: 0, senkouB: 0 },
        bollinger: { ...fallback, maxScore: 4, pctB: '0.5', bandwidth: '0%', priceVsSMA: '—', squeezeStatus: '—', upper: 0, middle: 0, lower: 0 },
        volumeProfile: { ...fallback, maxScore: 4, poc: '—', priceVsPocPct: '0%', valueArea: '—', pocPrice: 0, vaHigh: 0, vaLow: 0 },
      },
      verdictTextAr: 'بيانات غير كافية للتحليل.'
    };
  }

  const ichimoku     = calcIchimoku(klines);
  const bollinger    = calcBollinger(klines);
  const volumeProfile = calcVolumeProfile(klines);

  // Aggregate score
  const totalScore = ichimoku.score + bollinger.score + volumeProfile.score;
  const maxPossible = ichimoku.maxScore + bollinger.maxScore + volumeProfile.maxScore; // 13
  const consensusScorePct = Math.round((totalScore / maxPossible) * 100);

  const biases   = [ichimoku.bias, bollinger.bias, volumeProfile.bias];
  const bullCount  = biases.filter(b => b === 'BULL').length;
  const bearCount  = biases.filter(b => b === 'BEAR').length;
  const neutralCount = biases.filter(b => b === 'NEUTRAL').length;

  let overallBias: LensBias;
  if (bullCount > bearCount)        overallBias = 'BULL';
  else if (bearCount > bullCount)   overallBias = 'BEAR';
  else if (consensusScorePct >= 60) overallBias = 'BULL';
  else if (consensusScorePct <= 40) overallBias = 'BEAR';
  else                              overallBias = 'NEUTRAL';

  const biasAr = { BULL: 'صعود', BEAR: 'هبوط', NEUTRAL: 'اتجاه عرضي' };
  const v1 = biasAr[overallBias];
  const v2 = biasAr[ichimoku.bias];
  const v3 = biasAr[bollinger.bias];
  const v4 = biasAr[volumeProfile.bias];

  const verdictTextAr = `العدسة الثلاثية تشير نحو ${v1} بثقة ${consensusScorePct}%. Ichimoku: ${v2}. Bollinger: ${v3}. Volume Profile: ${v4}.`;

  return {
    symbol, consensusScorePct, overallBias,
    bullCount, bearCount, neutralCount,
    lenses: { ichimoku, bollinger, volumeProfile },
    verdictTextAr,
  };
}
