/**
 * lib/algorithms/matrix4x4.ts
 *
 * 4×4 MTF Matrix Engine
 * ✅ PARITY FIX: Replaced all mock data with real calculations.
 *    - Uses Binance-authentic RSI (Wilder's RMA) matching calcBinanceRSI()
 *    - EMA Cross (9/21), MACD (12/26/9), Price vs EMA50
 *    - Timeframes: 15m, 1h, 4h, 1d (matching source time-frameworks.js)
 *    - Alignment % = max(bull, bear) / total * 100
 *    - Neutral filtering in weighted consensus matches source
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calcBinanceRSI } from './mathUtils';

export type MatrixSignal = 'bullish' | 'bearish' | 'overbought' | 'oversold' | 'neutral';

export interface MTFIndicator {
  signal: MatrixSignal;
  label: string;
  detail: string;
}

export interface MTFRow {
  timeframe: string;   // e.g. '15M'
  ema:       MTFIndicator;
  rsi:       MTFIndicator;
  macd:      MTFIndicator;
  position:  MTFIndicator;
  bullCount: number;
  bearCount: number;
}

export interface Matrix4x4Result {
  symbol: string;
  globalConfluencePct: number;
  overallBias: 'BULL' | 'BEAR' | 'NEUTRAL';
  overallBiasAr: string;
  rows: MTFRow[];
  dominantTfAr: string;
  conclusionAr: string;
}

// ─── EMA array (fast, no NaN padding) ────────────────────────────────────────
function emaFast(closes: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const out: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    out[i] = closes[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

// ─── Analyze a single timeframe (matches source analyzeTF exactly) ────────────
function analyzeTF(candles: { close: number; high: number; low: number; volume: number }[]): Omit<MTFRow, 'timeframe'> {
  const closes = candles.map(c => c.close);
  const n = closes.length;

  // 1. EMA Cross (9/21) — matches source
  const ema9  = emaFast(closes, 9);
  const ema21 = emaFast(closes, 21);
  const cur9  = ema9[n - 1],  cur21 = ema21[n - 1];
  const prv9  = ema9[n - 2],  prv21 = ema21[n - 2];

  let emaSignal: MatrixSignal, emaLabel: string, emaDetail: string;
  if (cur9 > cur21) {
    emaSignal = 'bullish';
    emaLabel  = prv9 <= prv21 ? 'تقاطع صاعد' : 'صاعد';
    emaDetail = 'EMA9 > EMA21';
  } else {
    emaSignal = 'bearish';
    emaLabel  = prv9 >= prv21 ? 'تقاطع هابط' : 'هابط';
    emaDetail = 'EMA9 < EMA21';
  }

  // 2. RSI (14) — Wilder's RMA matching Binance
  const rsiVal = calcBinanceRSI(closes, 14);
  let rsiSignal: MatrixSignal, rsiLabel: string;
  if (rsiVal >= 70) { rsiSignal = 'overbought'; rsiLabel = 'تشبع شرائي'; }
  else if (rsiVal <= 30) { rsiSignal = 'oversold'; rsiLabel = 'تشبع بيعي'; }
  else { rsiSignal = 'neutral'; rsiLabel = 'محايد'; }

  // 3. MACD (12/26/9) — matches source
  const ema12 = emaFast(closes, 12);
  const ema26 = emaFast(closes, 26);
  const macdLine   = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = emaFast(macdLine, 9);
  const curMACD    = macdLine[n - 1];
  const curSig     = signalLine[n - 1];
  const prvMACD    = macdLine[n - 2];
  const prvSig     = signalLine[n - 2];

  let macdSignal: MatrixSignal, macdLabel: string, macdDetail: string;
  if (curMACD > curSig) {
    macdSignal = 'bullish';
    macdLabel  = prvMACD <= prvSig ? 'تقاطع صاعد' : 'صاعد';
    macdDetail = 'MACD > Signal';
  } else {
    macdSignal = 'bearish';
    macdLabel  = prvMACD >= prvSig ? 'تقاطع هابط' : 'هابط';
    macdDetail = 'MACD < Signal';
  }

  // 4. Price vs EMA50 — matches source
  const ema50 = emaFast(closes, 50);
  const curEMA50 = ema50[n - 1];
  const curPrice = closes[n - 1];
  let posSignal: MatrixSignal, posLabel: string, posDetail: string;
  if (curPrice > curEMA50) {
    posSignal = 'bullish'; posLabel = 'فوق'; posDetail = 'Price > EMA50';
  } else {
    posSignal = 'bearish'; posLabel = 'تحت'; posDetail = 'Price < EMA50';
  }

  // Count for this timeframe
  const signals: MatrixSignal[] = [emaSignal, rsiSignal, macdSignal, posSignal];
  let bullCount = 0, bearCount = 0;
  for (const s of signals) {
    if (s === 'bullish' || s === 'oversold')   bullCount++;
    else if (s === 'bearish' || s === 'overbought') bearCount++;
  }

  return {
    ema:      { signal: emaSignal,  label: emaLabel,  detail: emaDetail },
    rsi:      { signal: rsiSignal,  label: rsiLabel,  detail: 'RSI ' + rsiVal.toFixed(1) },
    macd:     { signal: macdSignal, label: macdLabel, detail: macdDetail },
    position: { signal: posSignal,  label: posLabel,  detail: posDetail },
    bullCount,
    bearCount,
  };
}

// ─── Main export (accepts pre-fetched klines for all 4 timeframes) ─────────────
export function analyzeMatrix4x4(
  symbol: string,
  klinesByTf: {
    tf15m: Kline[];
    tf1h:  Kline[];
    tf4h:  Kline[];
    tf1d:  Kline[];
  }
): Matrix4x4Result {
  const tfEntries: [string, Kline[]][] = [
    ['15M', klinesByTf.tf15m],
    ['1H',  klinesByTf.tf1h],
    ['4H',  klinesByTf.tf4h],
    ['1D',  klinesByTf.tf1d],
  ];

  const rows: MTFRow[] = tfEntries.map(([tf, klines]) => {
    if (!klines || klines.length < 50) {
      return {
        timeframe: tf,
        ema:      { signal: 'neutral', label: 'لا بيانات', detail: '' },
        rsi:      { signal: 'neutral', label: 'لا بيانات', detail: '' },
        macd:     { signal: 'neutral', label: 'لا بيانات', detail: '' },
        position: { signal: 'neutral', label: 'لا بيانات', detail: '' },
        bullCount: 0, bearCount: 0,
      };
    }
    const candles = klines.map(k => ({ close: k.close, high: k.high, low: k.low, volume: k.volume }));
    return { timeframe: tf, ...analyzeTF(candles) };
  });

  // Global confluence — matches source renderMTFDashboard
  let bullishTotal = 0, bearishTotal = 0, totalSignals = 0;
  for (const row of rows) {
    bullishTotal += row.bullCount;
    bearishTotal += row.bearCount;
    totalSignals += 4; // 4 indicators per TF
  }

  const alignmentPct = Math.round((Math.max(bullishTotal, bearishTotal) / (totalSignals || 1)) * 100);
  const dominant: 'BULL' | 'BEAR' | 'NEUTRAL' =
    bullishTotal > bearishTotal ? 'BULL' :
    bearishTotal > bullishTotal ? 'BEAR' : 'NEUTRAL';

  const dominantAr = dominant === 'BULL' ? 'صاعد' : dominant === 'BEAR' ? 'هابط' : 'محايد';

  // Find most aligned TF for dominant label
  const dominantRow = rows.reduce((best, r) => {
    const rScore = dominant === 'BULL' ? r.bullCount : r.bearCount;
    const bScore = dominant === 'BULL' ? best.bullCount : best.bearCount;
    return rScore > bScore ? r : best;
  }, rows[0]);

  const tfNameAr: Record<string, string> = {
    '15M': 'ربع الساعة', '1H': 'الساعة', '4H': 'الأربع ساعات', '1D': 'اليومي'
  };

  const dominantTfAr = `الإطار الزمني على فريم (${tfNameAr[dominantRow.timeframe]}) هو الأقوى حالياً ويدعم الاتجاه ${dominantAr}.`;

  let conclusionAr: string;
  if (alignmentPct >= 80) {
    conclusionAr = dominant === 'BULL'
      ? `توافق صعودي قوي (${alignmentPct}%). الأطر الزمنية الأربعة والمؤشرات تدعم الاتجاه الصاعد.`
      : `توافق هبوطي قوي (${alignmentPct}%). الأطر الزمنية والمؤشرات تدعم الاتجاه الهابط.`;
  } else if (alignmentPct >= 60) {
    conclusionAr = `توافق جزئي (${alignmentPct}%). أغلب الأطر الزمنية تميل ${dominant === 'BULL' ? 'للصعود' : 'للهبوط'} لكن بعض المؤشرات تتضارب.`;
  } else {
    conclusionAr = `تضارب واضح بين الأطر الزمنية (${alignmentPct}%). السوق في حالة عدم وضوح اتجاهي. يُنصح بالانتظار.`;
  }

  return {
    symbol,
    globalConfluencePct: alignmentPct,
    overallBias: dominant,
    overallBiasAr: dominantAr,
    rows,
    dominantTfAr,
    conclusionAr,
  };
}

// ─── Backward-compatible single-kline overload for components that pass one TF ─
export function analyzeMatrix4x4Single(symbol: string, klines: Kline[]): Matrix4x4Result {
  return analyzeMatrix4x4(symbol, {
    tf15m: klines, tf1h: klines, tf4h: klines, tf1d: klines,
  });
}
