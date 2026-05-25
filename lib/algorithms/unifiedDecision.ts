/**
 * lib/algorithms/unifiedDecision.ts
 *
 * Unified Decision (القرار الموحد / 6-Tools Engine)
 * ✅ PARITY FIX: Real calculations replacing all mock seed logic.
 *    - Tool 1: Trend Engine (VW-MACD + Weis Wave + Vol-Adjusted RSI) — weight 1.5×
 *    - Tool 2: 4×4 MTF Matrix (single-TF simplified) — weight 1.5×
 *    - Tool 3: Divergence Scanner (RSI + MACD + OBV) — weight 1.0×
 *    - Tool 4: CHOP Index — weight 1.0×
 *    - Tool 5: Wyckoff Phase — weight 1.5×
 *    - Tool 6: Markov HMM — weight 1.0×
 *    - Neutral-filtered weighted consensus (matches source exactly)
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calcBinanceRSI, calcBinanceRSIArray, calcMACD, calcOBV, findPeaks, findTroughs } from './mathUtils';

export type SignalState = -1 | 0 | 1;
export type SignalLabelAr = 'سلبي' | 'محايد' | 'إيجابي';

export interface IndicatorSignal {
  id: string;
  nameEn: string;
  nameAr: string;
  score: SignalState;
  label: SignalLabelAr;
  valueText: string;
  weight: number;
}

export interface UnifiedDecisionResult {
  symbol: string;
  sumScore: number;
  weightedConfidencePct: number;  // Neutral-filtered weighted % (matches source)
  confidencePct: number;           // Simple count-based (kept for UI compatibility)
  verdictEn: 'BULL' | 'BEAR' | 'NEUTRAL';
  verdictAr: string;
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  indicators: IndicatorSignal[];
  summaryAr: string;
}

// ─── EMA fast ────────────────────────────────────────────────────────────────
function emaFast(closes: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const out: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) out[i] = closes[i] * k + out[i - 1] * (1 - k);
  return out;
}

// ─── Tool 1: Trend Engine (VW-MACD + Weis Wave + Vol-Adjusted RSI) ───────────
// Matches source calculateTrueVWMACD + calculateRobustWeisWave + calculateVolAdjustedRSI
function runTrendEngine(klines: Kline[]): { signal: SignalState; label: string; detail: string; weight: number } {
  const closes  = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);

  // VW-MACD (12/26 VWMA)
  const calcVWMA = (p: number) => {
    const result: number[] = [];
    for (let i = 0; i < klines.length; i++) {
      if (i < p - 1) { result.push(NaN); continue; }
      let sumPV = 0, sumV = 0;
      for (let j = 0; j < p; j++) {
        sumPV += klines[i - j].close * klines[i - j].volume;
        sumV  += klines[i - j].volume;
      }
      result.push(sumPV / (sumV || 1));
    }
    return result;
  };

  const vwma12 = calcVWMA(12);
  const vwma26 = calcVWMA(26);
  const n = vwma12.length;
  const cur12 = vwma12[n - 1], cur26 = vwma26[n - 1];
  const prv12 = vwma12[n - 2], prv26 = vwma26[n - 2];
  const isBullish    = cur12 > cur26;
  const isCrossingUp = cur12 > cur26 && prv12 <= prv26;
  const isCrossingDn = cur12 < cur26 && prv12 >= prv26;

  let vwPoints = { up: 0, down: 0, side: 0 };
  if (isCrossingUp)     vwPoints = { up: 40, side: 0, down: 0 };
  else if (isCrossingDn) vwPoints = { up: 0, side: 0, down: 40 };
  else if (isBullish)   vwPoints = { up: 25, side: 10, down: 5 };
  else                  vwPoints = { up: 5, side: 10, down: 25 };

  // Weis Wave (triple-bar filter)
  let waveDir = 1, wavePts = { up: 0, down: 0, side: 0 };
  let curVol = 0, prevUpVol = 0, prevDownVol = 0;
  for (let i = 3; i < klines.length; i++) {
    const highest3 = Math.max(klines[i - 1].high, klines[i - 2].high, klines[i - 3].high);
    const lowest3  = Math.min(klines[i - 1].low,  klines[i - 2].low,  klines[i - 3].low);
    if (waveDir === 1 && klines[i].close < lowest3)  { prevUpVol = curVol; waveDir = -1; curVol = klines[i].volume; }
    else if (waveDir === -1 && klines[i].close > highest3) { prevDownVol = curVol; waveDir = 1; curVol = klines[i].volume; }
    else curVol += klines[i].volume;
  }
  if (waveDir === 1) {
    wavePts = curVol < prevUpVol * 0.5
      ? { up: 10, side: 20, down: 10 }
      : { up: 35, side: 5, down: 0 };
  } else {
    wavePts = curVol < prevDownVol * 0.5
      ? { up: 30, side: 10, down: 0 }
      : { up: 0, side: 5, down: 35 };
  }

  // Vol-Adjusted RSI (simple RSI with 14 period)
  const rsiVal = calcBinanceRSI(closes, 14);
  let rsiPts = { up: 0, down: 0, side: 0 };
  if (rsiVal > 75)      rsiPts = { up: 0, side: 5, down: 15 };
  else if (rsiVal < 25) rsiPts = { up: 15, side: 5, down: 0 };
  else                  rsiPts = { up: 10, side: 5, down: 5 };

  // Compile probabilities (matching compileProbabilities)
  const tUp   = vwPoints.up   + wavePts.up   + rsiPts.up;
  const tSide = vwPoints.side + wavePts.side  + rsiPts.side;
  const tDown = vwPoints.down + wavePts.down  + rsiPts.down;
  const total = (tUp + tSide + tDown) || 1;
  const pctUp   = Math.round((tUp   / total) * 100);
  const pctDown = Math.round((tDown / total) * 100);

  let signal: SignalState = 0;
  let label = '';
  if (pctUp >= 60) { signal = 1; label = `صعود ${pctUp}%`; }
  else if (pctDown >= 60) { signal = -1; label = `هبوط ${pctDown}%`; }
  else label = `عرضي`;

  return {
    signal, label,
    detail: `${isBullish ? 'إيجابي' : 'سلبي'} | ${waveDir === 1 ? 'موجة صاعدة' : 'موجة هابطة'}`,
    weight: Math.max(pctUp, pctDown) * 1.5,
  };
}

// ─── Tool 2: Simplified MTF (single TF) ──────────────────────────────────────
function runMTFSimple(klines: Kline[]): { signal: SignalState; label: string; detail: string; weight: number } {
  const closes = klines.map(k => k.close);
  const n = closes.length;

  const ema9  = emaFast(closes, 9);
  const ema21 = emaFast(closes, 21);
  const ema50 = emaFast(closes, 50);
  const ema12 = emaFast(closes, 12);
  const ema26 = emaFast(closes, 26);
  const macdLine   = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = emaFast(macdLine, 9);

  const rsi = calcBinanceRSI(closes, 14);

  let bull = 0, bear = 0;
  if (ema9[n - 1] > ema21[n - 1]) bull++; else bear++;
  if (rsi <= 30) bull++; else if (rsi >= 70) bear++; else if (rsi > 50) bull++; else bear++;
  if (macdLine[n - 1] > signalLine[n - 1]) bull++; else bear++;
  if (closes[n - 1] > ema50[n - 1]) bull++; else bear++;

  const total   = bull + bear;
  const pct     = total > 0 ? Math.round((Math.max(bull, bear) / total) * 100) : 50;
  const dom     = bull > bear ? 1 : bear > bull ? -1 : 0;

  let signal: SignalState = 0;
  if (bull > bear) signal = 1;
  else if (bear > bull) signal = -1;

  return {
    signal: dom as SignalState,
    label: `توافق ${pct}%`,
    detail: `${bull} صعود / ${bear} هبوط`,
    weight: pct * 1.5,
  };
}

// ─── Tool 3: Divergence Scanner (RSI + MACD + OBV) ───────────────────────────
function runDivergence(klines: Kline[]): { signal: SignalState; label: string; detail: string; weight: number } {
  const closes = klines.map(k => k.close);
  const lookback = Math.min(30, closes.length - 5);
  const start    = closes.length - lookback;

  // RSI divergence
  const rsiArr     = calcBinanceRSIArray(closes, 14);
  const priceHighs = findPeaks(closes.map(v => v), start, closes.length);
  const priceLows  = findTroughs(closes.map(v => v), start, closes.length);
  const rsiHighs   = findPeaks(rsiArr.map(v => v), start, rsiArr.length);
  const rsiLows    = findTroughs(rsiArr.map(v => v), start, rsiArr.length);

  let rsiBearish = false, rsiBullish = false;
  if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
    const lPH = priceHighs[priceHighs.length - 1], pPH = priceHighs[priceHighs.length - 2];
    const lRH = rsiHighs[rsiHighs.length - 1],     pRH = rsiHighs[rsiHighs.length - 2];
    if (closes[lPH] > closes[pPH] && (rsiArr[lRH] ?? 0) < (rsiArr[pRH] ?? 0)) rsiBearish = true;
  }
  if (priceLows.length >= 2 && rsiLows.length >= 2) {
    const lPL = priceLows[priceLows.length - 1],   pPL = priceLows[priceLows.length - 2];
    const lRL = rsiLows[rsiLows.length - 1],        pRL = rsiLows[rsiLows.length - 2];
    if (closes[lPL] < closes[pPL] && (rsiArr[lRL] ?? 0) > (rsiArr[pRL] ?? 0)) rsiBullish = true;
  }

  // MACD histogram divergence
  const { hist } = calcMACD(closes);
  const histHighs = findPeaks(hist.map(v => v), start, hist.length);
  const histLows  = findTroughs(hist.map(v => v), start, hist.length);
  let macdBearish = false, macdBullish = false;
  if (priceHighs.length >= 2 && histHighs.length >= 2) {
    const lPH = priceHighs[priceHighs.length - 1], pPH = priceHighs[priceHighs.length - 2];
    const lHH = histHighs[histHighs.length - 1],    pHH = histHighs[histHighs.length - 2];
    if (closes[lPH] > closes[pPH] && (hist[lHH] ?? 0) < (hist[pHH] ?? 0)) macdBearish = true;
  }
  if (priceLows.length >= 2 && histLows.length >= 2) {
    const lPL = priceLows[priceLows.length - 1],   pPL = priceLows[priceLows.length - 2];
    const lHL = histLows[histLows.length - 1],       pHL = histLows[histLows.length - 2];
    if (closes[lPL] < closes[pPL] && (hist[lHL] ?? 0) > (hist[pHL] ?? 0)) macdBullish = true;
  }

  // OBV divergence
  const obv = calcOBV(klines);
  const obvHighs = findPeaks(obv.map(v => v), start, obv.length);
  const obvLows  = findTroughs(obv.map(v => v), start, obv.length);
  let obvBearish = false, obvBullish = false;
  if (priceHighs.length >= 2 && obvHighs.length >= 2) {
    const lPH = priceHighs[priceHighs.length - 1], pPH = priceHighs[priceHighs.length - 2];
    const lOH = obvHighs[obvHighs.length - 1],      pOH = obvHighs[obvHighs.length - 2];
    if (closes[lPH] > closes[pPH] && obv[lOH] < obv[pOH]) obvBearish = true;
  }
  if (priceLows.length >= 2 && obvLows.length >= 2) {
    const lPL = priceLows[priceLows.length - 1],   pPL = priceLows[priceLows.length - 2];
    const lOL = obvLows[obvLows.length - 1],         pOL = obvLows[obvLows.length - 2];
    if (closes[lPL] < closes[pPL] && obv[lOL] > obv[pOL]) obvBullish = true;
  }

  const bearishCount = [rsiBearish, macdBearish, obvBearish].filter(Boolean).length;
  const bullishCount = [rsiBullish, macdBullish, obvBullish].filter(Boolean).length;

  let signal: SignalState = 0;
  let label = '';
  const score = Math.max(bearishCount, bullishCount);

  if (bearishCount >= 2) { signal = -1; label = `سلبي ${bearishCount}/3`; }
  else if (bullishCount >= 2) { signal = 1; label = `إيجابي ${bullishCount}/3`; }
  else if (score === 1) label = 'معزول 1/3';
  else label = 'لا يوجد 0/3';

  return {
    signal,
    label,
    detail: `RSI: ${rsiBearish ? 'دايفرجنس سلبي' : rsiBullish ? 'دايفرجنس إيجابي' : 'لا يوجد'}`,
    weight: (score >= 2 ? 70 : score === 1 ? 40 : 20) * 1.0,
  };
}

// ─── Tool 4: CHOP Index ───────────────────────────────────────────────────────
function runCHOP(klines: Kline[]): { signal: SignalState; label: string; detail: string; weight: number } {
  const recent = klines.slice(-15);
  const trueRanges: number[] = [];
  const highs: number[] = [];
  const lows: number[]  = [];
  const closes = klines.map(k => k.close);

  for (let i = 1; i < recent.length; i++) {
    const h = recent[i].high, l = recent[i].low, pc = recent[i - 1].close;
    trueRanges.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    highs.push(h); lows.push(l);
  }

  const sumTR   = trueRanges.reduce((a, b) => a + b, 0);
  const maxH    = Math.max(...highs);
  const minL    = Math.min(...lows);
  const range   = maxH - minL;
  const chop    = range > 0 ? 100 * Math.log10(sumTR / range) / Math.log10(14) : 61.8;

  const currentPrice = closes[closes.length - 1];
  const sma14 = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;

  let signal: SignalState = 0;
  let label = '';
  let detail = '';

  if (chop < 38.2) {
    if (currentPrice > sma14) { signal = 1; detail = 'اتجاه صاعد وزخم مرتفع'; }
    else                      { signal = -1; detail = 'اتجاه هابط وزخم مرتفع'; }
    label = `قوي ${chop.toFixed(1)}`;
  } else if (chop > 61.8) {
    label = `تذبذب ${chop.toFixed(1)}`; detail = 'عشوائية وانعدام اتجاه';
  } else {
    label = `طبيعي ${chop.toFixed(1)}`; detail = 'توازن في الزخم';
  }

  return {
    signal,
    label,
    detail,
    weight: (chop < 38.2 ? 75 : chop > 61.8 ? 30 : 50) * 1.0,
  };
}

// ─── Tool 5: Wyckoff Phase ────────────────────────────────────────────────────
function runWyckoffSimple(klines: Kline[]): { signal: SignalState; label: string; detail: string; weight: number } {
  if (klines.length < 80) return { signal: 0, label: 'بيانات قليلة', detail: '', weight: 30 };

  // Simple volume effort (80 candles)
  const recent = klines.slice(-80);
  let buyVol = 0, sellVol = 0;
  for (const c of recent) {
    if (c.close > c.open) buyVol += c.volume;
    else if (c.close < c.open) sellVol += c.volume;
    else { buyVol += c.volume / 2; sellVol += c.volume / 2; }
  }
  sellVol = sellVol || 1;
  const ratio = buyVol / sellVol;

  // ATR ratio for rangebound detection
  const atrArr = recent.map((c, i) =>
    i === 0 ? c.high - c.low
            : Math.max(c.high - c.low, Math.abs(c.high - recent[i-1].close), Math.abs(c.low - recent[i-1].close))
  );
  const atrCurrent = atrArr.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const atrAvg = atrArr.reduce((a, b) => a + b, 0) / atrArr.length;
  const atrRatio = atrAvg > 0 ? atrCurrent / atrAvg : 1;
  const isRangebound = atrRatio < 0.85;

  let signal: SignalState = 0;
  let label = '';
  let detail = '';
  let confidence = 50;

  if (isRangebound && ratio > 1.2) {
    signal = 1; label = `تجميع ${Math.min(95, Math.round(50 + ratio * 10))}%`; detail = 'امتصاص شرائي للعرض';
    confidence = Math.min(95, 50 + ratio * 10);
  } else if (isRangebound && ratio < 0.8) {
    signal = -1; label = `توزيع ${Math.min(95, Math.round(50 + (1/ratio) * 10))}%`; detail = 'تفريغ بيعي للطلب';
    confidence = Math.min(95, 50 + (1 / ratio) * 10);
  } else if (!isRangebound && ratio > 1.2) {
    signal = 1; label = 'صعود مؤسسي'; detail = 'اتجاه مؤسسي نشط'; confidence = 65;
  } else if (!isRangebound && ratio < 0.8) {
    signal = -1; label = 'هبوط مؤسسي'; detail = 'ضغط بيعي مسيطر'; confidence = 65;
  } else {
    label = 'إشارات مختلطة'; detail = 'انتظار التأكيد'; confidence = 40;
  }

  return { signal, label, detail, weight: confidence * 1.5 };
}

// ─── Tool 6: Markov HMM ───────────────────────────────────────────────────────
// Matches source runHMM + 6-tools inline HMM block
function runHMM(klines: Kline[]): { signal: SignalState; label: string; detail: string; weight: number } {
  const closes  = klines.map(k => k.close);
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) returns.push(Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]));

  const avgReturn  = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const recentReturns = returns.slice(-5);
  const recentAvg  = recentReturns.reduce((a, b) => a + b, 0) / (recentReturns.length || 1);
  const ratio      = recentAvg / (avgReturn || 0.001);

  let pSideways = 0, pTrend = 0, pVolatile = 0;
  if (ratio > 1.3) {
    pVolatile = Math.min(88, Math.round(50 + ratio * 10));
    pTrend    = Math.round((100 - pVolatile) * 0.6);
    pSideways = 100 - pVolatile - pTrend;
  } else if (ratio < 0.7) {
    pSideways = Math.min(88, Math.round(100 - ratio * 40));
    pTrend    = Math.round((100 - pSideways) * 0.7);
    pVolatile = 100 - pSideways - pTrend;
  } else {
    pTrend    = Math.min(85, Math.round(40 + ratio * 25));
    pSideways = Math.round((100 - pTrend) * 0.65);
    pVolatile = 100 - pTrend - pSideways;
  }

  const sma20   = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const curPrice = closes[closes.length - 1];

  let signal: SignalState = 0;
  let label = '';
  let detail = '';

  if (pTrend > 50) {
    if (curPrice > sma20) { signal = 1; detail = 'نظام اتجاهي صاعد'; }
    else                  { signal = -1; detail = 'نظام اتجاهي هابط'; }
    label = `اتجاهي ${pTrend}%`;
  } else if (pVolatile > 50) {
    label = `تقلبات ${pVolatile}%`; detail = 'خطورة عالية';
  } else {
    label = `عرضي ${pSideways}%`; detail = 'تذبذب عرضي';
  }

  return {
    signal,
    label,
    detail,
    weight: Math.max(pTrend, pSideways, pVolatile) * 1.0,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function calculateUnifiedDecision(symbol: string, klines: Kline[]): UnifiedDecisionResult {
  if (klines.length < 50) {
    // Minimal fallback
    const empty: IndicatorSignal[] = [];
    return {
      symbol, sumScore: 0, weightedConfidencePct: 50, confidencePct: 50,
      verdictEn: 'NEUTRAL', verdictAr: 'عرضي / محايد',
      bullCount: 0, bearCount: 0, neutralCount: 0,
      indicators: empty, summaryAr: 'بيانات غير كافية للتحليل الموحد.'
    };
  }

  // Run all 6 tools
  const results = [
    { id: 'trend_engine', nameEn: 'Trend Engine', nameAr: 'محرك ترجيح الاتجاه', ...runTrendEngine(klines) },
    { id: 'mtf_matrix',   nameEn: 'MTF Matrix',   nameAr: 'مصفوفة الأطر 4×4',  ...runMTFSimple(klines) },
    { id: 'divergence',   nameEn: 'Divergence',    nameAr: 'ماسح الدايفرجنس',   ...runDivergence(klines) },
    { id: 'chop',         nameEn: 'CHOP Index',    nameAr: 'مؤشر التذبذب CHOP', ...runCHOP(klines) },
    { id: 'wyckoff',      nameEn: 'Wyckoff',       nameAr: 'مراحل وايكوف',      ...runWyckoffSimple(klines) },
    { id: 'hmm',          nameEn: 'Markov HMM',    nameAr: 'نموذج ماركوف HMM',  ...runHMM(klines) },
  ];

  const indicators: IndicatorSignal[] = results.map(r => ({
    id:        r.id,
    nameEn:    r.nameEn,
    nameAr:    r.nameAr,
    score:     r.signal as SignalState,
    label:     (r.signal === 1 ? 'إيجابي' : r.signal === -1 ? 'سلبي' : 'محايد') as SignalLabelAr,
    valueText: r.label + (r.detail ? ` — ${r.detail}` : ''),
    weight:    r.weight,
  }));

  let sumScore = 0, bullCount = 0, bearCount = 0, neutralCount = 0;
  let wBull = 0, wBear = 0;

  for (const ind of indicators) {
    sumScore += ind.score;
    if (ind.score === 1)  { bullCount++;  wBull += ind.weight; }
    else if (ind.score === -1) { bearCount++; wBear += ind.weight; }
    else neutralCount++;
  }

  // ─── Weighted confidence (neutral-filtered — matches source exactly) ──────
  const activeWeight = wBull + wBear; // exclude neutral from denominator
  const weightedConfidencePct = activeWeight > 0
    ? Math.round((Math.max(wBull, wBear) / activeWeight) * 100)
    : 50;

  // ─── Simple count-based % for UI gauge ────────────────────────────────────
  const confidencePct = Math.round(((sumScore + 6) / 12) * 100);

  const verdictEn: 'BULL' | 'BEAR' | 'NEUTRAL' =
    bullCount > bearCount ? 'BULL' : bearCount > bullCount ? 'BEAR' : 'NEUTRAL';
  const verdictAr = verdictEn === 'BULL' ? 'صاعد' : verdictEn === 'BEAR' ? 'هابط' : 'عرضي / محايد';

  // Summary
  const domCount  = Math.max(bullCount, bearCount, neutralCount);
  const domDirAr  = bullCount >= bearCount
    ? (bullCount > neutralCount ? 'استمرار الاتجاه الصاعد' : 'التذبذب العرضي')
    : 'الهبوط المحتمل';
  const strongInd = indicators.find(i => i.score === 1)?.nameAr ?? indicators[0].nameAr;
  const weakInd   = indicators.find(i => i.score === -1)?.nameAr ?? indicators[1].nameAr;
  const summaryAr = `تتفق ${domCount} أدوات من أصل 6 على ${domDirAr}، مع تأثير قوي من (${strongInd})، وإشارات متباينة من (${weakInd}). الثقة الموزونة: ${weightedConfidencePct}%.`;

  return {
    symbol,
    sumScore,
    weightedConfidencePct,
    confidencePct,
    verdictEn,
    verdictAr,
    bullCount,
    bearCount,
    neutralCount,
    indicators,
    summaryAr,
  };
}
