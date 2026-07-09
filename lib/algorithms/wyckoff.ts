// lib/algorithms/wyckoff.ts — Wyckoff Phase Analyzer
// ✅ PARITY FIX: Added detectSpringUTAD(), fixed volume effort formula,
//    fixed ATR ratio threshold (0.85), fixed confidence scoring to match source.
import type { Kline } from '@/lib/binance/fetcher';

export type WyckoffPhase = 'ACC' | 'MRK' | 'DST' | 'MDN';

export interface WyckoffSpringUTAD {
  detected: boolean;
  type: 'Spring' | 'UTAD' | '';
  score: number;
  desc: string;
}

export interface WyckoffEffort {
  buyPct: number;
  sellPct: number;
  ratio: number;
  verdict: string;
  score: number;
}

export interface WyckoffVolatility {
  atrCurrent: number;
  atrAvg: number;
  atrRatio: number;
  verdict: string;
  score: number;
}

export interface WyckoffStructure {
  trend: 'صاعد' | 'هابط' | 'عرضي' | 'عرضي مائل للصعود' | 'عرضي مائل للهبوط' | 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  higherHighs: boolean;
  higherLows: boolean;
  rangeWidthPct: number;
  score: number;
}

export interface WyckoffResult {
  phase: WyckoffPhase;
  phaseAr: string;
  nextPhase: string;
  confidence: number;
  effort: WyckoffEffort;
  volatility: WyckoffVolatility;
  structure: WyckoffStructure;
  springUtad: WyckoffSpringUTAD;
  conclusion: string;
  klines: Kline[];
}

// ─── ATR helper ───────────────────────────────────────────────────────────────
function calcATRArr(k: Kline[], p: number): number[] {
  const tr = k.map((c, i) =>
    i === 0
      ? c.high - c.low
      : Math.max(c.high - c.low, Math.abs(c.high - k[i - 1].close), Math.abs(c.low - k[i - 1].close))
  );
  const out: number[] = new Array(k.length).fill(NaN);
  let sum = tr.slice(0, p).reduce((a, b) => a + b, 0);
  out[p - 1] = sum / p;
  for (let i = p; i < tr.length; i++) {
    sum = (out[i - 1] * (p - 1)) + tr[i];  // Wilder's smoothing
    out[i] = sum / p;
  }
  return out;
}

// ─── Volume Effort (matches source analyzeVolumeEffort exactly) ───────────────
function analyzeVolumeEffort(candles: Kline[]): WyckoffEffort {
  let buyVol = 0, sellVol = 0;

  for (const c of candles) {
    if (c.close > c.open) buyVol += c.volume;
    else if (c.close < c.open) sellVol += c.volume;
    else { buyVol += c.volume / 2; sellVol += c.volume / 2; }
  }

  sellVol = sellVol === 0 ? 1 : sellVol;
  const totalVol = buyVol + sellVol;
  const pctBuy = Math.round((buyVol / totalVol) * 100);
  const pctSell = Math.round((sellVol / totalVol) * 100);
  const ratio = parseFloat((buyVol / sellVol).toFixed(2));

  let verdict = '';
  let score = 0;

  if (ratio > 1.5) {
    verdict = 'سيطرة شرائية قوية — امتصاص مستمر للعرض (علامة تجميع)';
    score = 2;
  } else if (ratio > 1.2) {
    verdict = 'ميل شرائي — جهد إيجابي يميل للتجميع';
    score = 1;
  } else if (ratio < 0.67) {
    verdict = 'سيطرة بيعية واضحة — ضغط تفريغ (علامة توزيع)';
    score = -2;
  } else if (ratio < 0.83) {
    verdict = 'ميل بيعي — ضغط سلبي يميل للتوزيع';
    score = -1;
  } else {
    verdict = 'توازن بين قوى الشراء والبيع — صراع داخل النطاق';
    score = 0;
  }

  return { buyPct: pctBuy, sellPct: pctSell, ratio, verdict, score };
}

// ─── Price Structure (matches source analyzePriceStructure) ───────────────────
function analyzePriceStructure(candles: Kline[]): WyckoffStructure {
  const n = candles.length;
  const peakIdxs: number[] = [];
  const troughIdxs: number[] = [];

  for (let i = 3; i < n - 3; i++) {
    if (
      candles[i].high > candles[i - 1].high && candles[i].high > candles[i - 2].high &&
      candles[i].high > candles[i + 1].high && candles[i].high > candles[i + 2].high
    ) peakIdxs.push(i);

    if (
      candles[i].low < candles[i - 1].low && candles[i].low < candles[i - 2].low &&
      candles[i].low < candles[i + 1].low && candles[i].low < candles[i + 2].low
    ) troughIdxs.push(i);
  }

  let higherHighs = false, higherLows = false;
  if (peakIdxs.length >= 2)
    higherHighs = candles[peakIdxs[peakIdxs.length - 1]].high > candles[peakIdxs[peakIdxs.length - 2]].high;
  if (troughIdxs.length >= 2)
    higherLows = candles[troughIdxs[troughIdxs.length - 1]].low > candles[troughIdxs[troughIdxs.length - 2]].low;

  const rangeHigh = Math.max(...candles.map(c => c.high));
  const rangeLow  = Math.min(...candles.map(c => c.low));
  const rangeWidthPct = rangeLow > 0 ? parseFloat(((rangeHigh - rangeLow) / rangeLow * 100).toFixed(1)) : 0;

  let trend: WyckoffStructure['trend'] = 'عرضي';
  let score = 0;

  if (higherHighs && higherLows)   { trend = 'صاعد'; score = 3; }
  else if (!higherHighs && !higherLows && peakIdxs.length > 1) { trend = 'هابط'; score = -3; }
  else if (higherLows && !higherHighs)  { trend = 'عرضي مائل للصعود'; score = 1; }
  else if (!higherLows && higherHighs)  { trend = 'عرضي مائل للهبوط'; score = -1; }

  return { trend, higherHighs, higherLows, rangeWidthPct, score };
}

// ─── Volatility (matches source analyzeVolatility) ────────────────────────────
function analyzeVolatilityFull(klines: Kline[]): WyckoffVolatility {
  const atrArr = calcATRArr(klines, 14);
  const validATR = atrArr.filter(v => !isNaN(v));
  const atrCurrent = validATR[validATR.length - 1] ?? 1;

  // 60-bar average ATR
  const atr60 = atrArr.slice(-60).filter(v => !isNaN(v));
  const atrAvg = atr60.length > 0 ? atr60.reduce((a, b) => a + b, 0) / atr60.length : 1;
  const safeAvg = atrAvg === 0 ? 1 : atrAvg;
  const atrRatio = parseFloat((atrCurrent / safeAvg).toFixed(2));

  let verdict = '';
  let score = 0;
  if (atrRatio < 0.6)      { verdict = 'تقلص حاد في التقلب — ضغط سعري انفجاري قادم'; score = 2; }
  else if (atrRatio < 0.8) { verdict = 'هدوء سعري وانحسار في السيولة'; score = 1; }
  else if (atrRatio > 1.5) { verdict = 'توسع حاد في التقلب — حركة اتجاهية قائمة'; score = -1; }
  else                     { verdict = 'تقلب طبيعي ضمن المعدل'; score = 0; }

  return {
    atrCurrent: parseFloat(atrCurrent.toFixed(4)),
    atrAvg:     parseFloat(atrAvg.toFixed(4)),
    atrRatio,
    verdict,
    score
  };
}

// ─── Spring / UTAD Detector (matches source detectSpringUTAD exactly) ─────────
function detectSpringUTAD(candles: Kline[]): WyckoffSpringUTAD {
  // Range measured from all except last 5 candles
  const rangeCandles = candles.slice(0, -5);
  if (rangeCandles.length < 10) return { detected: false, type: '', score: 0, desc: '' };

  const rangeHigh = Math.max(...rangeCandles.map(c => c.high));
  const rangeLow  = Math.min(...rangeCandles.map(c => c.low));
  const rangeSize = rangeHigh - rangeLow;

  const last5  = candles.slice(-5);
  const avgVol = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;

  for (const c of last5) {
    // Spring: wick below range low, closes back above it
    if (c.low < rangeLow - (rangeSize * 0.005) && c.close > rangeLow) {
      const highVol = c.volume > avgVol * 1.5;
      return {
        detected: true,
        type: 'Spring',
        score: 3,
        desc: 'كسر كاذب للقاع (Spring) مع إغلاق إيجابي — تأكيد مؤسسي لامتصاص البيع.' +
              (highVol ? ' الحجم الضخم يؤكد مصداقية الإشارة.' : '')
      };
    }
    // UTAD: wick above range high, closes back below it
    if (c.high > rangeHigh + (rangeSize * 0.005) && c.close < rangeHigh) {
      const highVol = c.volume > avgVol * 1.5;
      return {
        detected: true,
        type: 'UTAD',
        score: -3,
        desc: 'كسر كاذب للقمة (UTAD) مع إغلاق سلبي — تأكيد مؤسسي لبدء التصريف.' +
              (highVol ? ' الحجم الضخم يؤكد مصداقية الإشارة.' : '')
      };
    }
  }

  return { detected: false, type: '', score: 0, desc: '' };
}

// ─── Phase Classifier (matches source classifyPhase exactly) ──────────────────
function classifyPhase(
  vol: WyckoffEffort,
  structure: WyckoffStructure,
  volatility: WyckoffVolatility,
  spring: WyckoffSpringUTAD
): { phase: WyckoffPhase; phaseAr: string; nextPhase: string; confidence: number; conclusion: string } {
  const totalScore = vol.score + structure.score + volatility.score + spring.score;

  // isRangebound = ATR ratio < 0.85 OR structure score ambiguous
  const isRangebound = volatility.atrRatio < 0.85 || Math.abs(structure.score) <= 1;

  let phase: WyckoffPhase = 'ACC';
  let phaseAr = '';
  let nextPhase = '';
  let confidence = 40;
  let conclusion = '';

  if (isRangebound && totalScore >= 2) {
    phase = 'ACC'; phaseAr = 'تجميع مؤسسي'; nextPhase = 'Markup (صعود)';
    confidence = Math.min(95, 50 + totalScore * 8);
    conclusion = 'السوق في مرحلة تجميع. المؤسسات تبني مراكز شرائية داخل النطاق.';
    if (vol.ratio > 1.2) conclusion += ' السيطرة الشرائية تدعم امتصاص العرض.';
    if (spring.type === 'Spring') conclusion += ' الكسر الكاذب (Spring) يمثل تأكيداً نهائياً.';

  } else if (isRangebound && totalScore <= -2) {
    phase = 'DST'; phaseAr = 'توزيع مؤسسي'; nextPhase = 'Markdown (هبوط)';
    confidence = Math.min(95, 50 + Math.abs(totalScore) * 8);
    conclusion = 'السوق في مرحلة توزيع. المؤسسات تُصرف الكميات داخل النطاق.';
    if (vol.ratio < 0.8) conclusion += ' الضغط البيعي مستمر لتفريغ الطلب.';
    if (spring.type === 'UTAD') conclusion += ' الكسر الكاذب (UTAD) يمثل إشارة قوية للهبوط.';

  } else if (structure.score >= 2) {
    phase = 'MRK'; phaseAr = 'صعود اتجاهي'; nextPhase = 'Distribution (توزيع)';
    confidence = Math.min(95, 55 + structure.score * 7);
    conclusion = 'السوق في مرحلة صعود. القمم والقيعان تتصاعد بشكل صحي.';

  } else if (structure.score <= -2) {
    phase = 'MDN'; phaseAr = 'هبوط اتجاهي'; nextPhase = 'Accumulation (تجميع)';
    confidence = Math.min(95, 55 + Math.abs(structure.score) * 7);
    conclusion = 'السوق في مرحلة هبوط. المسار العام يسيطر عليه الدببة.';

  } else {
    phase = totalScore >= 0 ? 'ACC' : 'DST';
    phaseAr = 'إشارات مختلطة'; nextPhase = 'انتظار التأكيد';
    confidence = Math.min(60, 35 + Math.abs(totalScore) * 5);
    conclusion = 'لا توجد سيطرة مؤسسية واضحة حالياً. يُنصح بالانتظار وتجنب المخاطرة.';
  }

  return { phase, phaseAr, nextPhase, conclusion, confidence: Math.max(20, confidence) };
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function analyzeWyckoff(klines: Kline[]): WyckoffResult {
  if (klines.length < 80) {
    throw new Error('Wyckoff requires at least 80 candles.');
  }

  // Use last 80 candles (matching competitor)
  const recent = klines.slice(-80);

  const effort     = analyzeVolumeEffort(recent);
  const structure  = analyzePriceStructure(recent);
  const volatility = analyzeVolatilityFull(klines);     // full series for stable ATR
  const springUtad = detectSpringUTAD(recent);
  const classified = classifyPhase(effort, structure, volatility, springUtad);

  return {
    phase:      classified.phase,
    phaseAr:    classified.phaseAr,
    nextPhase:  classified.nextPhase,
    confidence: classified.confidence,
    effort,
    volatility,
    structure,
    springUtad,
    conclusion: classified.conclusion,
    klines: recent
  };
}
