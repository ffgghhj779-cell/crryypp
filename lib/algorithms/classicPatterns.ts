// ─── Classical Pattern Detectors (Batch 4) ───────────────────────────────────
// lib/algorithms/classicPatterns.ts
// Thick-client. Double Top/Bottom · Cup & Handle · Head & Shoulders · Triangle
// All use pivot detection on 300-candle 4H feeds.

import type { Kline } from '@/lib/binance/fetcher';

// ── Helpers ───────────────────────────────────────────────────────────────────

function swings(klines: Kline[], win = 5) {
  const highs: { i: number; p: number }[] = [];
  const lows:  { i: number; p: number }[] = [];
  for (let i = win; i < klines.length - win; i++) {
    const h = klines[i].high, l = klines[i].low;
    let isH = true, isL = true;
    for (let j = i - win; j <= i + win; j++) {
      if (j !== i) {
        if (klines[j].high >= h) isH = false;
        if (klines[j].low  <= l) isL = false;
      }
    }
    if (isH) highs.push({ i, p: h });
    if (isL) lows.push({ i, p: l });
  }
  return { highs, lows };
}

function fmtP(n: number, ref: number): number {
  if (ref >= 10_000) return parseFloat(n.toFixed(1));
  if (ref >= 1)      return parseFloat(n.toFixed(4));
  return parseFloat(n.toFixed(6));
}

const SIMILAR = (a: number, b: number, tol = 0.025) =>
  Math.abs(a - b) / ((a + b) / 2) < tol;

// ═════════════════════════════════════════════════════════════════════════════
// 1. Double Top / Double Bottom
// ═════════════════════════════════════════════════════════════════════════════

export interface DoublePatternResult {
  detected: boolean;
  type:     'DOUBLE_TOP' | 'DOUBLE_BOTTOM' | null;
  level1:   number;
  level2:   number;
  neckline: number;
  target:   number;
  confidence: number;
  verdict:  string;
}

export function detectDoublePattern(klines: Kline[]): DoublePatternResult {
  const price = klines[klines.length - 1].close;
  const { highs, lows } = swings(klines.slice(-150));
  const NULL: DoublePatternResult = { detected: false, type: null, level1: 0, level2: 0, neckline: 0, target: 0, confidence: 0, verdict: 'لم يُرصد نموذج قمتين أو قاعين مكتمل.' };

  // Double Top: last 2 swing highs similar, neckline = min between them
  if (highs.length >= 2) {
    const h1 = highs[highs.length - 2], h2 = highs[highs.length - 1];
    if (SIMILAR(h1.p, h2.p)) {
      const between = klines.slice(h1.i, h2.i + 1);
      const neckline = Math.min(...between.map(k => k.low));
      const height = ((h1.p + h2.p) / 2) - neckline;
      const target = fmtP(neckline - height, price);
      const conf   = Math.round(70 + Math.min(15, (1 - Math.abs(h1.p - h2.p) / h1.p * 100) * 10));
      return { detected: true, type: 'DOUBLE_TOP', level1: fmtP(h1.p, price), level2: fmtP(h2.p, price), neckline: fmtP(neckline, price), target, confidence: conf, verdict: `قمتان متشابهتان عند ${fmtP(h1.p, price)} و${fmtP(h2.p, price)}. خط العنق: ${fmtP(neckline, price)}. الهدف: ${target}.` };
    }
  }

  // Double Bottom: last 2 swing lows similar
  if (lows.length >= 2) {
    const l1 = lows[lows.length - 2], l2 = lows[lows.length - 1];
    if (SIMILAR(l1.p, l2.p)) {
      const between = klines.slice(l1.i, l2.i + 1);
      const neckline = Math.max(...between.map(k => k.high));
      const height = neckline - ((l1.p + l2.p) / 2);
      const target = fmtP(neckline + height, price);
      const conf   = Math.round(70 + Math.min(15, (1 - Math.abs(l1.p - l2.p) / l1.p * 100) * 10));
      return { detected: true, type: 'DOUBLE_BOTTOM', level1: fmtP(l1.p, price), level2: fmtP(l2.p, price), neckline: fmtP(neckline, price), target, confidence: conf, verdict: `قاعان متشابهان عند ${fmtP(l1.p, price)} و${fmtP(l2.p, price)}. خط العنق: ${fmtP(neckline, price)}. الهدف: ${target}.` };
    }
  }

  return NULL;
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Cup & Handle
// ═════════════════════════════════════════════════════════════════════════════

export interface CupHandleResult {
  detected:    boolean;
  cupDepthPct: number;
  handleDepthPct: number;
  rimLevel:    number;
  target:      number;
  confidence:  number;
  verdict:     string;
}

export function detectCupHandle(klines: Kline[]): CupHandleResult {
  const price = klines[klines.length - 1].close;
  const NULL: CupHandleResult = { detected: false, cupDepthPct: 0, handleDepthPct: 0, rimLevel: 0, target: 0, confidence: 0, verdict: 'لم يُرصد نموذج الكوب والمقبض.' };

  if (klines.length < 100) return NULL;

  // Cup: left rim = high in first 40%, low in middle 20%, right rim ≈ left rim
  const slice    = klines.slice(-100);
  const leftWin  = slice.slice(0, 30);
  const midWin   = slice.slice(30, 70);
  const rightWin = slice.slice(70, 90);
  const handleWin= slice.slice(85);

  const leftRim  = Math.max(...leftWin.map(k  => k.high));
  const cupLow   = Math.min(...midWin.map(k   => k.low));
  const rightRim = Math.max(...rightWin.map(k => k.high));
  const handleLow= Math.min(...handleWin.map(k=> k.low));

  if (!SIMILAR(leftRim, rightRim, 0.04)) return NULL;

  const cupDepth    = ((leftRim - cupLow)  / leftRim) * 100;
  const handleDepth = ((rightRim - handleLow) / rightRim) * 100;

  // Classic rules: cup depth 12–35%, handle retraces 10–50% of cup
  if (cupDepth < 8 || cupDepth > 45) return NULL;
  if (handleDepth < 5 || handleDepth > 55) return NULL;

  const rim    = (leftRim + rightRim) / 2;
  const target = fmtP(rim + (rim - cupLow), price);
  const conf   = Math.round(65 + Math.min(20, (35 - Math.abs(cupDepth - 22)) / 1.5));

  return {
    detected: true,
    cupDepthPct:    parseFloat(cupDepth.toFixed(1)),
    handleDepthPct: parseFloat(handleDepth.toFixed(1)),
    rimLevel:  fmtP(rim, price),
    target,
    confidence: conf,
    verdict: `كوب ومقبض: عمق الكوب ${cupDepth.toFixed(1)}%، عمق المقبض ${handleDepth.toFixed(1)}%. الاختراق فوق ${fmtP(rim, price)} يستهدف ${target}.`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Head & Shoulders
// ═════════════════════════════════════════════════════════════════════════════

export interface HSResult {
  detected:  boolean;
  type:      'REGULAR' | 'INVERSE' | null;
  leftShoulder:  number;
  head:          number;
  rightShoulder: number;
  neckline:      number;
  target:        number;
  confidence:    number;
  verdict:       string;
}

export function detectHeadShoulders(klines: Kline[]): HSResult {
  const price = klines[klines.length - 1].close;
  const NULL: HSResult = { detected: false, type: null, leftShoulder: 0, head: 0, rightShoulder: 0, neckline: 0, target: 0, confidence: 0, verdict: 'لم يُرصد نموذج الرأس والكتفين.' };

  const { highs, lows } = swings(klines.slice(-200));

  // Regular H&S (top): need 3 highs where middle is highest
  if (highs.length >= 3) {
    const ls = highs[highs.length - 3], h = highs[highs.length - 2], rs = highs[highs.length - 1];
    if (h.p > ls.p && h.p > rs.p && SIMILAR(ls.p, rs.p, 0.05)) {
      const neckline = fmtP((ls.p + rs.p) / 2 * 0.97, price); // approximate
      const target   = fmtP(neckline - (h.p - neckline), price);
      const conf     = Math.round(70 + Math.min(15, (1 - Math.abs(ls.p - rs.p) / ls.p * 100) * 8));
      return { detected: true, type: 'REGULAR', leftShoulder: fmtP(ls.p, price), head: fmtP(h.p, price), rightShoulder: fmtP(rs.p, price), neckline, target, confidence: conf, verdict: `رأس وكتفان هابط: الرأس ${fmtP(h.p, price)}، الكتفان ${fmtP(ls.p, price)} / ${fmtP(rs.p, price)}. الهدف: ${target}.` };
    }
  }

  // Inverse H&S (bottom): need 3 lows where middle is lowest
  if (lows.length >= 3) {
    const ls = lows[lows.length - 3], h = lows[lows.length - 2], rs = lows[lows.length - 1];
    if (h.p < ls.p && h.p < rs.p && SIMILAR(ls.p, rs.p, 0.05)) {
      const neckline = fmtP((ls.p + rs.p) / 2 * 1.03, price);
      const target   = fmtP(neckline + (neckline - h.p), price);
      const conf     = Math.round(70 + Math.min(15, (1 - Math.abs(ls.p - rs.p) / ls.p * 100) * 8));
      return { detected: true, type: 'INVERSE', leftShoulder: fmtP(ls.p, price), head: fmtP(h.p, price), rightShoulder: fmtP(rs.p, price), neckline, target, confidence: conf, verdict: `رأس وكتفان صاعد (معكوس): الرأس ${fmtP(h.p, price)}. الهدف: ${target}.` };
    }
  }

  return NULL;
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Triangle Predictor
// ═════════════════════════════════════════════════════════════════════════════

export type TriangleType = 'SYMMETRICAL' | 'ASCENDING' | 'DESCENDING' | null;

export interface TriangleResult {
  detected: boolean;
  type:     TriangleType;
  typeAr:   string;
  upperSlope: number;
  lowerSlope: number;
  apexBars:   number;
  bias:       'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
  confidence: number;
  verdict:    string;
  startPointTop?: {index: number, price: number};
  startPointBottom?: {index: number, price: number};
}

export function detectTriangle(klines: Kline[]): TriangleResult {
  const NULL: TriangleResult = { detected: false, type: null, typeAr: '', upperSlope: 0, lowerSlope: 0, apexBars: 0, bias: null, confidence: 0, verdict: 'لم يُرصد نموذج مثلث واضح.' };

  const { highs, lows } = swings(klines.slice(-150));
  if (highs.length < 3 || lows.length < 3) return NULL;

  const rh = highs.slice(-4);
  const rl = lows.slice(-4);

  function slope(pts: {i:number;p:number}[]): number {
    const n = pts.length;
    const sx = pts.reduce((a,p)=>a+p.i,0), sy = pts.reduce((a,p)=>a+p.p,0);
    const sxy= pts.reduce((a,p)=>a+p.i*p.p,0), sx2=pts.reduce((a,p)=>a+p.i*p.i,0);
    return (n*sxy - sx*sy)/(n*sx2 - sx*sx);
  }

  const us = slope(rh), ls = slope(rl);
  const converging = us < 0 && ls > 0; // classic convergence
  const MIN = 0.0001;

  if (!converging && Math.abs(us) < MIN && Math.abs(ls) < MIN) return NULL;

  let type: TriangleType, typeAr: string, bias: TriangleResult['bias'];

  const flatTol = 0.0005;
  if (Math.abs(us) < flatTol && ls > MIN) {
    type = 'ASCENDING'; typeAr = 'مثلث صاعد (Ascending)'; bias = 'BULLISH';
  } else if (Math.abs(ls) < flatTol && us < -MIN) {
    type = 'DESCENDING'; typeAr = 'مثلث هابط (Descending)'; bias = 'BEARISH';
  } else if (us < -MIN && ls > MIN) {
    type = 'SYMMETRICAL'; typeAr = 'مثلث متماثل (Symmetrical)'; bias = 'NEUTRAL';
  } else {
    return NULL;
  }

  // Apex estimate
  const lastHigh = rh[rh.length-1], lastLow = rl[rl.length-1];
  const apexBars = Math.max(1, Math.round(
    (lastLow.p - lastHigh.p + us*lastHigh.i - ls*lastLow.i) / (us - ls) -
    Math.max(lastHigh.i, lastLow.i)
  ));

  if (apexBars < 0) return NULL;

  const conf = Math.round(60 + Math.min(30, (30 / apexBars) * 15));

  return {
    detected: true, type, typeAr, upperSlope: parseFloat(us.toFixed(6)),
    lowerSlope: parseFloat(ls.toFixed(6)), apexBars: Math.min(apexBars, 100),
    bias, confidence: Math.min(90, conf),
    verdict: `تم رصد ${typeAr}. السعر ينحسر وتقاطع الخطوط خلال ${Math.min(apexBars,100)} شمعة. الاتجاه المحتمل: ${bias === 'BULLISH' ? 'صاعد' : bias === 'BEARISH' ? 'هابط' : 'محايد، انتظر الكسر'}.`,
    startPointTop: {index: rh[0].i, price: rh[0].p},
    startPointBottom: {index: rl[0].i, price: rl[0].p}
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Market Structure (BOS / CHoCH)
// ═════════════════════════════════════════════════════════════════════════════

export type StructureEvent = 'BOS_BULL' | 'BOS_BEAR' | 'CHOCH_BULL' | 'CHOCH_BEAR' | null;

export interface MarketStructureResult {
  trend:       'UPTREND' | 'DOWNTREND' | 'RANGING';
  lastEvent:   StructureEvent;
  lastEventAr: string;
  swingHigh:   number;
  swingLow:    number;
  bias:        'BULLISH' | 'BEARISH' | 'NEUTRAL';
  verdict:     string;
}

export function analyzeMarketStructure(klines: Kline[]): MarketStructureResult {
  const price   = klines[klines.length - 1].close;
  const { highs, lows } = swings(klines.slice(-100));

  const swingHigh = highs.length ? fmtP(highs[highs.length - 1].p, price) : fmtP(Math.max(...klines.slice(-20).map(k=>k.high)), price);
  const swingLow  = lows.length  ? fmtP(lows[lows.length - 1].p,   price) : fmtP(Math.min(...klines.slice(-20).map(k=>k.low)),  price);

  // Higher Highs / Higher Lows detection
  const recentHighs = highs.slice(-4).map(h => h.p);
  const recentLows  = lows.slice(-4).map(l => l.p);

  const hhCount = recentHighs.filter((h,i) => i>0 && h > recentHighs[i-1]).length;
  const hlCount = recentLows.filter((l,i)  => i>0 && l > recentLows[i-1]).length;
  const lhCount = recentHighs.filter((h,i) => i>0 && h < recentHighs[i-1]).length;
  const llCount = recentLows.filter((l,i)  => i>0 && l < recentLows[i-1]).length;

  let trend: MarketStructureResult['trend'], bias: MarketStructureResult['bias'];
  let lastEvent: StructureEvent, lastEventAr: string;

  if (hhCount >= 2 && hlCount >= 1) {
    trend = 'UPTREND'; bias = 'BULLISH';
    lastEvent = 'BOS_BULL'; lastEventAr = 'كسر هيكل صعودي (BOS ↑)';
  } else if (lhCount >= 2 && llCount >= 1) {
    trend = 'DOWNTREND'; bias = 'BEARISH';
    lastEvent = 'BOS_BEAR'; lastEventAr = 'كسر هيكل هبوطي (BOS ↓)';
  } else if (hhCount >= 1 && llCount >= 1) {
    trend = 'RANGING'; bias = 'NEUTRAL';
    // CHoCH: recent shift against prior trend
    lastEvent = price > (swingHigh + swingLow) / 2 ? 'CHOCH_BULL' : 'CHOCH_BEAR';
    lastEventAr = lastEvent === 'CHOCH_BULL' ? 'تغيّر طابع السوق صعوداً (CHoCH ↑)' : 'تغيّر طابع السوق هبوطاً (CHoCH ↓)';
  } else {
    trend = 'RANGING'; bias = 'NEUTRAL'; lastEvent = null; lastEventAr = 'لا حدث هيكلي واضح';
  }

  return {
    trend, lastEvent, lastEventAr, swingHigh, swingLow, bias,
    verdict: `الاتجاه: ${trend === 'UPTREND' ? 'صاعد' : trend === 'DOWNTREND' ? 'هابط' : 'عرضي'}. آخر حدث هيكلي: ${lastEventAr}. القمة: ${swingHigh}، القاع: ${swingLow}.`,
  };
}
