/**
 * lib/algorithms/emaRibbon.ts
 *
 * EMA Ribbon (شريط المتوسطات) Engine
 * ✅ PARITY FIX: Real EMA calculations replacing all mock logic.
 *    - Periods: [8, 13, 21, 34, 55, 89, 100, 200] matching competitor source
 *    - Colors matching competitor: orange for fast → dark for slow
 *    - Order logic: all pairs bullish/bearish/mostly_bullish/mostly_bearish
 *    - Spread: |EMA8 - EMA200| / EMA200 * 100 with category thresholds
 */

import type { Kline } from '@/lib/binance/fetcher';

export interface EmaValue {
  length: number;
  value: number;
  color: string;          // Competitor's color scheme
  spacingFactor: number;  // Normalized for SVG rendering
}

export type RibbonOrder = 'bullish' | 'bearish' | 'mostly_bullish' | 'mostly_bearish' | 'mixed';
export type RibbonStatus = 'Expanding Bullish' | 'Expanding Bearish' | 'Contracting';
export type RibbonStatusAr = 'توسع إيجابي (صاعد)' | 'توسع سلبي (هابط)' | 'انكماش / تداخل';

export interface EmaRibbonResult {
  symbol: string;
  currentPrice: number;
  emas: EmaValue[];
  order: RibbonOrder;
  status: RibbonStatus;
  statusAr: RibbonStatusAr;
  spreadPct: number;        // |fast - slow| / slow * 100
  spreadLabel: string;      // واسع جداً / واسع / معتدل / ضيق
  trendStrengthPct: number; // 0 to 100
  trendStrengthLabelAr: string;
}

// ─── Competitor color scheme for 8 EMA periods ─────────────────────────────
// Source: astro-lenses.js lines 41-60
const EMA_COLORS = [
  '#ff6a00',  // EMA 8   — orange (var(--o))
  '#ff8533',  // EMA 13  — light orange
  '#ffaa66',  // EMA 21  — pale orange
  '#ffffff',  // EMA 34  — white
  '#cccccc',  // EMA 55  — light grey
  '#888888',  // EMA 89  — medium grey
  '#666666',  // EMA 100 — dark grey
  '#444444',  // EMA 200 — very dark grey
];

// ─── EMA calculation (fast, matches competitor calcEMAArray) ──────────────────
function emaFast(closes: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const out: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    out[i] = closes[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function analyzeEmaRibbon(symbol: string, klines: Kline[]): EmaRibbonResult {
  const closes      = klines.map(k => k.close);
  const currentPrice = closes[closes.length - 1];

  // Competitor periods: [8, 13, 21, 34, 55, 89, 100, 200]
  const lengths = [8, 13, 21, 34, 55, 89, 100, 200];
  const emaValues: number[] = lengths.map(p => {
    const arr = emaFast(closes, p);
    return arr[arr.length - 1];
  });

  // ─── Order detection (matches source bullishOrder / bearishOrder) ──────────
  // "bullish order" = each EMA is below the one before it (fast > slow)
  // Count consecutive pairs in order
  const totalPairs = lengths.length - 1; // 7 pairs
  let bullishPairs = 0, bearishPairs = 0;
  for (let i = 0; i < totalPairs; i++) {
    if (emaValues[i] > emaValues[i + 1]) bullishPairs++;
    else if (emaValues[i] < emaValues[i + 1]) bearishPairs++;
  }

  let order: RibbonOrder;
  if (bullishPairs === totalPairs)         order = 'bullish';
  else if (bearishPairs === totalPairs)    order = 'bearish';
  else if (bullishPairs >= totalPairs - 1) order = 'mostly_bullish';
  else if (bearishPairs >= totalPairs - 1) order = 'mostly_bearish';
  else                                     order = 'mixed';

  // ─── Spread (fast - slow) / slow * 100 ───────────────────────────────────
  const fastEMA = emaValues[0];       // EMA 8
  const slowEMA = emaValues[lengths.length - 1]; // EMA 200
  const spreadPct = slowEMA !== 0
    ? Math.abs((fastEMA - slowEMA) / slowEMA) * 100
    : 0;

  let spreadLabel: string;
  if (spreadPct > 10)      spreadLabel = 'واسع جداً';
  else if (spreadPct > 5)  spreadLabel = 'واسع';
  else if (spreadPct > 2)  spreadLabel = 'معتدل';
  else                     spreadLabel = 'ضيق';

  // ─── Status & trend strength ───────────────────────────────────────────────
  let status: RibbonStatus;
  let statusAr: RibbonStatusAr;
  let trendStrengthPct: number;

  if (order === 'bullish' || order === 'mostly_bullish') {
    status = 'Expanding Bullish';
    statusAr = 'توسع إيجابي (صاعد)';
    trendStrengthPct = order === 'bullish'
      ? Math.min(100, 60 + spreadPct * 2)
      : Math.min(90, 50 + spreadPct * 2);
  } else if (order === 'bearish' || order === 'mostly_bearish') {
    status = 'Expanding Bearish';
    statusAr = 'توسع سلبي (هابط)';
    trendStrengthPct = order === 'bearish'
      ? Math.min(100, 60 + spreadPct * 2)
      : Math.min(90, 50 + spreadPct * 2);
  } else {
    status = 'Contracting';
    statusAr = 'انكماش / تداخل';
    trendStrengthPct = Math.min(50, 20 + spreadPct);
  }

  trendStrengthPct = Math.round(Math.min(100, Math.max(5, trendStrengthPct)));

  // ─── Trend strength label ──────────────────────────────────────────────────
  let trendStrengthLabelAr: string;
  if (trendStrengthPct >= 80)      trendStrengthLabelAr = 'اتجاه قوي جداً';
  else if (trendStrengthPct >= 60) trendStrengthLabelAr = 'اتجاه قوي';
  else if (trendStrengthPct >= 40) trendStrengthLabelAr = 'اتجاه ضعيف / متذبذب';
  else                             trendStrengthLabelAr = 'ضعيف جداً / عرضي';

  // ─── Build EmaValue array with competitor colors ───────────────────────────
  const maxSpread = Math.max(...emaValues.map((v, i) => Math.abs(v - currentPrice)));
  const emas: EmaValue[] = lengths.map((len, i) => {
    const val = emaValues[i];
    const dist = Math.abs(val - currentPrice);
    return {
      length:        len,
      value:         parseFloat(val.toFixed(val >= 100 ? 2 : 4)),
      color:         EMA_COLORS[i],
      spacingFactor: maxSpread > 0 ? Math.min(1, dist / maxSpread) : 0.1,
    };
  });

  return {
    symbol,
    currentPrice,
    emas,
    order,
    status,
    statusAr,
    spreadPct:             parseFloat(spreadPct.toFixed(2)),
    spreadLabel,
    trendStrengthPct,
    trendStrengthLabelAr,
  };
}
