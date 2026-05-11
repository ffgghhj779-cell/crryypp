// ─── Order Flow & Smart Money Algorithms ──────────────────────────────────────
// lib/algorithms/orderflow.ts

import type { Kline } from '@/lib/binance/fetcher';

function fmtP(n: number, price: number): number {
  if (price >= 10_000) return parseFloat(n.toFixed(1));
  if (price >= 1)      return parseFloat(n.toFixed(4));
  return parseFloat(n.toFixed(6));
}

// ── 1. FVG ────────────────────────────────────────────────────────────────────

export interface FVGResult {
  detected: boolean;
  type:     'BULLISH' | 'BEARISH' | null;
  top:      number;
  bottom:   number;
  age:      number;
  midpoint: number;
  verdict:  string;
}

export function analyzeFVG(klines: Kline[]): FVGResult {
  const scan  = klines.slice(-50);
  const price = klines[klines.length - 1].close;

  const NULL_RESULT: FVGResult = {
    detected: false, type: null, top: 0, bottom: 0, age: 0, midpoint: 0,
    verdict: 'لا توجد فجوات سعرية قريبة غير مُرادة.',
  };

  for (let i = scan.length - 1; i >= 2; i--) {
    const c0 = scan[i - 2];
    const c2 = scan[i];

    if (c0.high < c2.low) {
      const top = c2.low, bottom = c0.high;
      const age = scan.length - 1 - i;
      const mitigated = scan.slice(i + 1).some(k => k.low <= top && k.high >= bottom);
      if (mitigated) continue;
      return {
        detected: true, type: 'BULLISH',
        top: fmtP(top, price), bottom: fmtP(bottom, price),
        midpoint: fmtP((top + bottom) / 2, price), age,
        verdict: `فجوة سعرية صعودية (FVG) بين ${fmtP(bottom, price)} و ${fmtP(top, price)}. تشكّلت قبل ${age} شمعة. منطقة طلب محتملة.`,
      };
    }

    if (c0.low > c2.high) {
      const top = c0.low, bottom = c2.high;
      const age = scan.length - 1 - i;
      const mitigated = scan.slice(i + 1).some(k => k.low <= top && k.high >= bottom);
      if (mitigated) continue;
      return {
        detected: true, type: 'BEARISH',
        top: fmtP(top, price), bottom: fmtP(bottom, price),
        midpoint: fmtP((top + bottom) / 2, price), age,
        verdict: `فجوة سعرية هبوطية (FVG) بين ${fmtP(bottom, price)} و ${fmtP(top, price)}. تشكّلت قبل ${age} شمعة. منطقة عرض محتملة.`,
      };
    }
  }
  return NULL_RESULT;
}

// ── 2. Liquidity Sweep ────────────────────────────────────────────────────────

export interface SweepResult {
  swept:      boolean;
  type:       'BULLISH_REJECTION' | 'BEARISH_REJECTION' | null;
  sweepLevel: number;
  wickPct:    number;
  verdict:    string;
}

export function analyzeLiquiditySweep(klines: Kline[]): SweepResult {
  const NULL: SweepResult = {
    swept: false, type: null, sweepLevel: 0, wickPct: 0,
    verdict: 'لم يتم رصد مسح سيولة في الأشواط الأخيرة.',
  };
  if (klines.length < 25) return NULL;

  const recent  = klines.slice(-10);
  const context = klines.slice(-30, -10);
  const price   = klines[klines.length - 1].close;

  const swingLow  = Math.min(...context.map(k => k.low));
  const swingHigh = Math.max(...context.map(k => k.high));

  for (let i = recent.length - 1; i >= 0; i--) {
    const c = recent[i];
    const rng = c.high - c.low || 1;

    if (c.low < swingLow && c.close > swingLow) {
      const wickPct = ((swingLow - c.low) / rng) * 100;
      if (wickPct < 20) continue;
      return {
        swept: true, type: 'BULLISH_REJECTION',
        sweepLevel: fmtP(swingLow, price),
        wickPct: parseFloat(wickPct.toFixed(1)),
        verdict: `مسح سيولة صعودي: انتهاك ${fmtP(swingLow, price)} ثم إغلاق فوقه. ذيل رفض ${wickPct.toFixed(0)}%.`,
      };
    }

    if (c.high > swingHigh && c.close < swingHigh) {
      const wickPct = ((c.high - swingHigh) / rng) * 100;
      if (wickPct < 20) continue;
      return {
        swept: true, type: 'BEARISH_REJECTION',
        sweepLevel: fmtP(swingHigh, price),
        wickPct: parseFloat(wickPct.toFixed(1)),
        verdict: `مسح سيولة هبوطي: انتهاك ${fmtP(swingHigh, price)} ثم إغلاق تحته. ذيل رفض ${wickPct.toFixed(0)}%.`,
      };
    }
  }
  return NULL;
}

// ── 3. CVD Proxy ──────────────────────────────────────────────────────────────

export interface CVDResult {
  cvdTrend:           'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  divergenceDetected: boolean;
  rawDelta:           number;
  priceTrend:         'UP' | 'DOWN' | 'FLAT';
  verdict:            string;
}

export function analyzeCVDProxy(klines: Kline[]): CVDResult {
  const slice = klines.slice(-50);
  let cumulativeDelta = 0;
  const deltas: number[] = [];

  for (const k of slice) {
    const range = k.high - k.low || 1;
    const delta = k.volume * ((k.close - k.low) / range) - k.volume * ((k.high - k.close) / range);
    cumulativeDelta += delta;
    deltas.push(delta);
  }

  const earlyDelta = deltas.slice(0, 10).reduce((a, b) => a + b, 0);
  const lateDelta  = deltas.slice(-10).reduce((a, b) => a + b, 0);
  const cvdSlope   = lateDelta - earlyDelta;

  const priceStart = slice[0].close;
  const priceEnd   = slice[slice.length - 1].close;
  const priceDiff  = priceEnd - priceStart;
  const threshold  = priceStart * 0.002;

  const priceTrend: CVDResult['priceTrend'] =
    priceDiff > threshold ? 'UP' : priceDiff < -threshold ? 'DOWN' : 'FLAT';

  const divergenceDetected =
    (priceTrend === 'UP' && cvdSlope < 0) ||
    (priceTrend === 'DOWN' && cvdSlope > 0);

  const cvdTrend: CVDResult['cvdTrend'] =
    Math.abs(cvdSlope) < Math.abs(earlyDelta) * 0.1 ? 'NEUTRAL'
    : cvdSlope > 0 ? 'ACCUMULATION' : 'DISTRIBUTION';

  const verdict =
    divergenceDetected && priceTrend === 'UP'
      ? 'تحذير: السعر صاعد لكن دلتا الحجم متراجعة — تصريف خفي محتمل.'
    : divergenceDetected && priceTrend === 'DOWN'
      ? 'إشارة: السعر هابط لكن دلتا الحجم إيجابية — تجميع خفي محتمل.'
    : cvdTrend === 'ACCUMULATION'
      ? 'تجميع متواصل: تدفق الحجم الصافي إيجابي — ضغط شرائي مسيطر.'
    : cvdTrend === 'DISTRIBUTION'
      ? 'تصريف متواصل: تدفق الحجم الصافي سلبي — ضغط بيعي مسيطر.'
    : 'دلتا الحجم محايدة — لا هيمنة واضحة بين المشترين والبائعين.';

  return { cvdTrend, divergenceDetected, rawDelta: parseFloat(cumulativeDelta.toFixed(2)), priceTrend, verdict };
}
