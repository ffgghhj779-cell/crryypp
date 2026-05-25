/**
 * lib/algorithms/trendCompass.ts
 *
 * Trend Compass (بوصلة الاتجاه) Engine
 * ✅ PARITY FIX: Replaced deterministic mock with real calculations.
 *    - EMA200: Price vs EMA200
 *    - ADX(14): DI+ vs DI- with strength check
 *    - SuperTrend(10, 3): ATR-based band
 *    - Market Structure: HH/HL or LH/LL from pivots
 *    - EMA Cross 8/21
 *    - Confidence formula now matches source: bullCount-based + ADX adjustment
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calculateEMA, calculateWilderMA } from './mathUtils';

export type CompassBias = 'BULL' | 'BEAR' | 'NEUTRAL';

export interface CompassMetric {
  id: string;
  nameEn: string;
  nameAr: string;
  bias: CompassBias;
  statusTextAr: string;
  value?: number;
}

export interface TrendCompassResult {
  symbol: string;
  timeframe: string;
  confidencePct: number;
  mainDirectionEn: CompassBias;
  mainDirectionAr: string;
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  adxValue: number;
  metrics: CompassMetric[];
  conclusionAr: string;
}

// ─── EMA array ────────────────────────────────────────────────────────────────
function emaArr(closes: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const out: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    out[i] = closes[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

// ─── ADX (14) — returns { adx, diPlus, diMinus } ────────────────────────────
function calcADX(klines: Kline[], period = 14): { adx: number; diPlus: number; diMinus: number } {
  if (klines.length < period * 2) return { adx: 20, diPlus: 20, diMinus: 20 };

  const trArr: number[]  = [];
  const dmPlus: number[] = [];
  const dmMinus: number[] = [];

  for (let i = 1; i < klines.length; i++) {
    const h  = klines[i].high, l = klines[i].low, pc = klines[i - 1].close;
    const ph = klines[i - 1].high, pl = klines[i - 1].low;
    trArr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const upMove   = h - ph;
    const downMove = pl - l;
    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const atrWMA   = calculateWilderMA(trArr,   period);
  const diPlusWMA  = calculateWilderMA(dmPlus,  period);
  const diMinusWMA = calculateWilderMA(dmMinus, period);

  const diPlus  = (diPlusWMA[diPlusWMA.length - 1]   / (atrWMA[atrWMA.length - 1] || 1)) * 100;
  const diMinus = (diMinusWMA[diMinusWMA.length - 1] / (atrWMA[atrWMA.length - 1] || 1)) * 100;

  // DX series → ADX via Wilder MA
  const dxArr: number[] = [];
  for (let i = 0; i < atrWMA.length; i++) {
    if (isNaN(atrWMA[i]) || isNaN(diPlusWMA[i]) || isNaN(diMinusWMA[i])) continue;
    const dip = (diPlusWMA[i]  / atrWMA[i]) * 100;
    const dim = (diMinusWMA[i] / atrWMA[i]) * 100;
    const sum = dip + dim;
    dxArr.push(sum === 0 ? 0 : Math.abs(dip - dim) / sum * 100);
  }

  const adxWMA = calculateWilderMA(dxArr, period);
  const adx    = adxWMA[adxWMA.length - 1] ?? 20;

  return { adx, diPlus, diMinus };
}

// ─── SuperTrend (10, 3) ───────────────────────────────────────────────────────
function calcSuperTrend(klines: Kline[], period = 10, mult = 3): 'BULL' | 'BEAR' {
  if (klines.length < period + 2) return 'BULL';

  // ATR via simple average (fast, matches most SuperTrend implementations)
  const trs = klines.map((c, i) =>
    i === 0 ? c.high - c.low
            : Math.max(c.high - c.low, Math.abs(c.high - klines[i - 1].close), Math.abs(c.low - klines[i - 1].close))
  );

  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let direction: 'BULL' | 'BEAR' = 'BULL';
  let upperBand = 0, lowerBand = 0;
  let prevClose = klines[period - 1].close;

  for (let i = period; i < klines.length; i++) {
    // Wilder ATR
    atr = (atr * (period - 1) + trs[i]) / period;
    const hl2 = (klines[i].high + klines[i].low) / 2;
    const newUpper = hl2 + mult * atr;
    const newLower = hl2 - mult * atr;

    upperBand = newUpper < upperBand || prevClose > upperBand ? newUpper : upperBand;
    lowerBand = newLower > lowerBand || prevClose < lowerBand ? newLower : lowerBand;

    if (klines[i].close > upperBand)  direction = 'BULL';
    else if (klines[i].close < lowerBand) direction = 'BEAR';

    prevClose = klines[i].close;
  }

  return direction;
}

// ─── Market Structure: HH/HL = BULL, LH/LL = BEAR ───────────────────────────
function calcMarketStructure(klines: Kline[]): { bias: CompassBias; label: string } {
  const recent = klines.slice(-50);
  const highs  = recent.map(c => c.high);
  const lows   = recent.map(c => c.low);

  const peaks: number[]   = [];
  const troughs: number[] = [];

  for (let i = 3; i < recent.length - 3; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
        highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) peaks.push(i);
    if (lows[i]  < lows[i - 1]  && lows[i]  < lows[i - 2] &&
        lows[i]  < lows[i + 1]  && lows[i]  < lows[i + 2]) troughs.push(i);
  }

  const hh = peaks.length >= 2   && highs[peaks[peaks.length - 1]]     > highs[peaks[peaks.length - 2]];
  const hl  = troughs.length >= 2 && lows[troughs[troughs.length - 1]]  > lows[troughs[troughs.length - 2]];
  const lh  = peaks.length >= 2   && highs[peaks[peaks.length - 1]]     < highs[peaks[peaks.length - 2]];
  const ll  = troughs.length >= 2 && lows[troughs[troughs.length - 1]]  < lows[troughs[troughs.length - 2]];

  if (hh && hl)  return { bias: 'BULL', label: 'قمم وقيعان صاعدة HH+HL' };
  if (lh && ll)  return { bias: 'BEAR', label: 'قنوات سعرية هابطة LH+LL' };
  return { bias: 'NEUTRAL', label: 'نطاق تجميعي / عدم وضوح الهيكل' };
}

// ─── Main Calculator ──────────────────────────────────────────────────────────
export function calculateTrendCompass(
  symbol: string,
  timeframe: string,
  klines: Kline[]
): TrendCompassResult {
  if (klines.length < 50) {
    // Minimal fallback if not enough data
    return {
      symbol, timeframe, confidencePct: 50,
      mainDirectionEn: 'NEUTRAL', mainDirectionAr: 'مـحـايـد',
      bullCount: 0, bearCount: 0, neutralCount: 5, adxValue: 20,
      metrics: [], conclusionAr: 'بيانات غير كافية للتحليل.'
    };
  }

  const closes = klines.map(k => k.close);
  const currentPrice = closes[closes.length - 1];

  // ─── 1. EMA 200 ────────────────────────────────────────────────────────────
  const ema200Arr = emaArr(closes, 200);
  const ema200    = ema200Arr[ema200Arr.length - 1];
  const ema200Bias: CompassBias = klines.length >= 200
    ? (currentPrice > ema200 ? 'BULL' : 'BEAR')
    : 'NEUTRAL';
  const ema200Label = ema200Bias === 'BULL'
    ? `السعر يتداول أعلى المتوسط 200 (${ema200.toFixed(2)})`
    : ema200Bias === 'BEAR'
    ? `السعر يتداول أسفل المتوسط 200 (${ema200.toFixed(2)})`
    : 'السعر يختبر منطقة المتوسط 200';

  // ─── 2. ADX ────────────────────────────────────────────────────────────────
  const { adx, diPlus, diMinus } = calcADX(klines, 14);
  let adxBias: CompassBias;
  let adxLabel: string;
  if (adx > 25) {
    adxBias  = diPlus > diMinus ? 'BULL' : 'BEAR';
    adxLabel = `ADX ${adx.toFixed(1)} > 25 — ${diPlus > diMinus ? 'زخم شرائي قوي' : 'زخم بيعي قوي'}`;
  } else {
    adxBias  = 'NEUTRAL';
    adxLabel = `ADX ${adx.toFixed(1)} < 20 — السوق عرضي وتذبذب`;
  }

  // ─── 3. SuperTrend (10, 3) ─────────────────────────────────────────────────
  const stDir = calcSuperTrend(klines, 10, 3);
  const stBias: CompassBias = stDir === 'BULL' ? 'BULL' : 'BEAR';
  const stLabel = stBias === 'BULL' ? 'اتجاه صاعد — السعر فوق SuperTrend' : 'اتجاه هابط — السعر تحت SuperTrend';

  // ─── 4. Market Structure ───────────────────────────────────────────────────
  const ms = calcMarketStructure(klines);

  // ─── 5. EMA Cross 8/21 ─────────────────────────────────────────────────────
  const ema8Arr  = emaArr(closes, 8);
  const ema21Arr = emaArr(closes, 21);
  const ema8  = ema8Arr[ema8Arr.length - 1];
  const ema21 = ema21Arr[ema21Arr.length - 1];
  const ema8prev  = ema8Arr[ema8Arr.length - 2];
  const ema21prev = ema21Arr[ema21Arr.length - 2];

  let emaCrossBias: CompassBias;
  let emaCrossLabel: string;
  if (ema8 > ema21) {
    emaCrossBias  = 'BULL';
    emaCrossLabel = ema8prev <= ema21prev ? 'تقاطع ذهبي حديث (EMA 8 أعلى من 21)' : 'EMA 8 أعلى من EMA 21 (صاعد)';
  } else {
    emaCrossBias  = 'BEAR';
    emaCrossLabel = ema8prev >= ema21prev ? 'تقاطع موت حديث (EMA 8 أسفل 21)' : 'EMA 8 أسفل EMA 21 (هابط)';
  }

  // ─── Build metrics array ───────────────────────────────────────────────────
  const metrics: CompassMetric[] = [
    { id: 'ema200',           nameEn: 'EMA 200',          nameAr: 'المتوسط 200 (EMA)',    bias: ema200Bias, statusTextAr: ema200Label, value: ema200 },
    { id: 'adx',              nameEn: 'ADX Trend Strength', nameAr: 'قوة الاتجاه (ADX)',  bias: adxBias,   statusTextAr: adxLabel,   value: adx },
    { id: 'supertrend',       nameEn: 'SuperTrend',        nameAr: 'سوبر تريند',          bias: stBias,    statusTextAr: stLabel },
    { id: 'market_structure', nameEn: 'Market Structure',  nameAr: 'هيكل السوق',         bias: ms.bias,   statusTextAr: ms.label },
    { id: 'ema_cross',        nameEn: 'EMA 8/21 Cross',    nameAr: 'تقاطع EMA 8/21',     bias: emaCrossBias, statusTextAr: emaCrossLabel },
  ];

  // ─── Count signals ─────────────────────────────────────────────────────────
  let bullCount = 0, bearCount = 0, neutralCount = 0;
  for (const m of metrics) {
    if (m.bias === 'BULL') bullCount++;
    else if (m.bias === 'BEAR') bearCount++;
    else neutralCount++;
  }

  // ─── Confidence formula — matches competitor source exactly ───────────────
  // Source: if (bullCount >= 4) confidence = 80 + (bullCount === 5 ? 15 : 0)
  //         elif (bullCount === 3) confidence = 65
  //         elif (bearCount >= 4) confidence = 80 + (bearCount === 5 ? 15 : 0)
  //         ...plus ADX adjustment
  let confidence: number;
  const dominantBias: CompassBias = bullCount > bearCount ? 'BULL' : bearCount > bullCount ? 'BEAR' : 'NEUTRAL';

  if (bullCount >= 4)      confidence = 80 + (bullCount === 5 ? 15 : 0);
  else if (bullCount === 3) confidence = 65;
  else if (bearCount >= 4)  confidence = 80 + (bearCount === 5 ? 15 : 0);
  else if (bearCount === 3) confidence = 65;
  else                      confidence = 40;

  // ADX adjustment
  if (adx > 30)       confidence = Math.min(95, confidence + 5);
  else if (adx < 20)  confidence = Math.max(20, confidence - 10);

  // Direction label
  let mainDirectionAr = 'مـحـايـد';
  if (dominantBias === 'BULL')   mainDirectionAr = 'صـــاعـــد';
  else if (dominantBias === 'BEAR') mainDirectionAr = 'هـــابـــط';

  // ─── Conclusion ────────────────────────────────────────────────────────────
  let conclusionAr: string;
  if (confidence >= 80) {
    conclusionAr = dominantBias === 'BULL'
      ? `توافق صعودي قوي (${confidence}%). المؤشرات الخمسة تدعم الاتجاه الصاعد. البيئة مواتية مع إدارة مخاطر محكمة.`
      : `توافق هبوطي قوي (${confidence}%). المؤشرات تدعم الاتجاه الهابط. يُنصح بالحذر من المراكز الشرائية.`;
  } else if (confidence >= 65) {
    conclusionAr = `توافق جزئي (${confidence}%). أغلب المؤشرات تميل ${dominantBias === 'BULL' ? 'للصعود' : 'للهبوط'} لكن بعضها يتضارب. يُنصح بانتظار تأكيد إضافي.`;
  } else {
    conclusionAr = `تضارب في المؤشرات (${confidence}%). السوق في حالة عدم وضوح اتجاهي. يُنصح بالانتظار.`;
  }

  return {
    symbol,
    timeframe,
    confidencePct: confidence,
    mainDirectionEn: dominantBias,
    mainDirectionAr,
    bullCount,
    bearCount,
    neutralCount,
    adxValue: parseFloat(adx.toFixed(1)),
    metrics,
    conclusionAr,
  };
}
