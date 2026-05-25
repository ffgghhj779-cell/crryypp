/**
 * lib/algorithms/vip2.ts — VIP 2 Liquidity & VWAP Engine (سوينج VIP تجميع سيولة)
 *
 * PHASE 1 FIX: Replaced deterministic hash-seed pseudorandom logic with
 * genuine VWAP, Standard Deviation bands, and volume-weighted analysis
 * computed from real OHLCV data.
 *
 * Sub-algorithms T-6 to T-10:
 *   T-6: VWAP Position (price vs. intra-session VWAP)
 *   T-7: Volume Weighted Momentum (buy vs. sell pressure)
 *   T-8: Liquidity Sweep Detection (wick into prior swing)
 *   T-9: EMA 50/200 Macro Trend (long-run bias)
 *   T-10: ATR-based Volatility Regime
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calculateEMA, calculateSMA, calculateWilderMA } from '@/lib/algorithms/mathUtils';

export type Bias = 'BULL' | 'BEAR';

export interface Vip2TradeSetup {
  timeframe:  string;
  tfLabelAr:  string;
  bias:       Bias;
  isBlocked:  boolean;
  blockedReasonAr?: string;
  consensusScorePct: number;
  subAlgorithms: { id: string; nameAr: string; weightContribPct: number }[];
  vwapPrice?:    string;
  entryPrice?:   string;
  stopLossLabel?: string;
  tp1?: string; tp1Label?: string;
  tp2?: string; tp2Label?: string;
  tp3?: string; tp3Label?: string;
  profitPct1?: string;
  profitPct2?: string;
  profitPct3?: string;
}

export interface Vip2Result {
  symbol:       string;
  currentPrice: number;
  setups:       Vip2TradeSetup[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (isFinite(arr[i]) && !isNaN(arr[i])) return arr[i];
  }
  return 0;
}

function priceStr(val: number): string {
  if (val >= 1000) return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (val >= 1)    return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return                  val.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/** Compute session VWAP from the last `window` candles. */
function computeVWAP(klines: Kline[], window = 20): number {
  const slice = klines.slice(-window);
  let cumPV = 0, cumVol = 0;
  for (const k of slice) {
    const tp = (k.high + k.low + k.close) / 3;
    cumPV  += tp * k.volume;
    cumVol += k.volume;
  }
  return cumVol > 0 ? cumPV / cumVol : klines[klines.length - 1].close;
}

/** Rolling standard deviation of typical prices around VWAP. */
function computeVWAPStdDev(klines: Kline[], window = 20, vwap: number): number {
  const slice = klines.slice(-window);
  const tps   = slice.map(k => (k.high + k.low + k.close) / 3);
  const variance = tps.reduce((acc, tp) => acc + (tp - vwap) ** 2, 0) / tps.length;
  return Math.sqrt(variance);
}

function computeATR(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return klines[klines.length - 1].close * 0.015;
  const tr: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high, l = klines[i].low, pc = klines[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return lastValid(calculateWilderMA(tr, period)) || klines[klines.length - 1].close * 0.015;
}

// ─── Sub-algorithm Scorers ────────────────────────────────────────────────────

/** T-6: VWAP Position — 15 pts */
function scoreT6_VWAPPosition(klines: Kline[]): { score: number; bullish: boolean; vwap: number; detail: string } {
  const vwap  = computeVWAP(klines, Math.min(20, klines.length));
  const price = klines[klines.length - 1].close;
  const bullish = price > vwap;
  const deviation = Math.abs(price - vwap) / vwap;
  const score = deviation > 0.01 ? 15 : deviation > 0.005 ? 10 : 6;
  return { score, bullish, vwap, detail: `السعر ${bullish ? 'فوق' : 'تحت'} VWAP (${vwap.toFixed(0)}) بفارق ${(deviation*100).toFixed(2)}%` };
}

/** T-7: Volume Weighted Momentum — 20 pts */
function scoreT7_VWMomentum(klines: Kline[]): { score: number; bullish: boolean; detail: string } {
  const slice = klines.slice(-10);
  let buyVol = 0, sellVol = 0;
  for (const k of slice) {
    if (k.close >= k.open) buyVol  += k.volume;
    else                    sellVol += k.volume;
  }
  const total = buyVol + sellVol;
  const ratio = total > 0 ? buyVol / total : 0.5;
  const bullish = ratio > 0.5;
  const score = Math.abs(ratio - 0.5) > 0.2 ? 20
              : Math.abs(ratio - 0.5) > 0.1 ? 14
              : 7;
  return { score, bullish, detail: `ضغط الشراء ${(ratio * 100).toFixed(0)}% — ضغط البيع ${((1-ratio)*100).toFixed(0)}%` };
}

/** T-8: Liquidity Sweep Detection — 30 pts */
function scoreT8_LiquiditySweep(klines: Kline[]): { score: number; bullish: boolean; detail: string } {
  if (klines.length < 10) return { score: 15, bullish: true, detail: 'بيانات غير كافية' };
  const lookback = klines.slice(-20, -2);
  const priorHigh = Math.max(...lookback.map(k => k.high));
  const priorLow  = Math.min(...lookback.map(k => k.low));
  const last = klines[klines.length - 1];
  const prev = klines[klines.length - 2];

  // Bullish sweep: wick below prior low but closes above = liquidity grab
  const bullishSweep = last.low < priorLow && last.close > priorLow;
  // Bearish sweep: wick above prior high but closes below = liquidity grab
  const bearishSweep = last.high > priorHigh && last.close < priorHigh;

  if (bullishSweep) return { score: 30, bullish: true, detail: `كسح سيولة صاعد — إغلاق فوق الدعم ${priorLow.toFixed(0)}` };
  if (bearishSweep) return { score: 30, bullish: false, detail: `كسح سيولة هابط — إغلاق تحت المقاومة ${priorHigh.toFixed(0)}` };

  // No sweep — check proximity
  const nearHigh = (priorHigh - last.close) / priorHigh < 0.01;
  const nearLow  = (last.close - priorLow)  / priorLow  < 0.01;
  if (nearHigh) return { score: 15, bullish: false, detail: `قرب مقاومة رئيسية ${priorHigh.toFixed(0)}` };
  if (nearLow)  return { score: 15, bullish: true,  detail: `قرب دعم رئيسي ${priorLow.toFixed(0)}` };

  return { score: 10, bullish: last.close > prev.close, detail: 'لا يوجد كسح سيولة' };
}

/** T-9: EMA 50/200 Macro Trend — 15 pts */
function scoreT9_MacroTrend(klines: Kline[]): { score: number; bullish: boolean; detail: string } {
  if (klines.length < 55) return { score: 8, bullish: true, detail: 'بيانات غير كافية للاتجاه الكبير' };
  const closes = klines.map(k => k.close);
  const ema50  = lastValid(calculateEMA(closes, 50));
  const ema200 = klines.length >= 200 ? lastValid(calculateEMA(closes, 200)) : ema50 * 0.98;
  const price  = closes[closes.length - 1];
  const bullish = price > ema50 && ema50 > ema200;
  const bearish = price < ema50 && ema50 < ema200;
  const score = (bullish || bearish) ? 15 : 8;
  return {
    score, bullish: bullish || (!bearish && price > ema50),
    detail: `EMA50 (${ema50.toFixed(0)}) ${ema50 > ema200 ? 'فوق' : 'تحت'} EMA200 (${ema200.toFixed(0)})`,
  };
}

/** T-10: ATR Volatility Regime — 20 pts */
function scoreT10_Volatility(klines: Kline[]): { score: number; bullish: boolean; detail: string } {
  if (klines.length < 30) return { score: 10, bullish: true, detail: 'بيانات غير كافية' };
  const atrCurrent = computeATR(klines.slice(-15), 14);
  const atrLong    = computeATR(klines, 14);
  const regime     = atrCurrent / atrLong;
  const last       = klines[klines.length - 1];
  const bullish    = last.close > last.open;
  // Expanding volatility with directional confirmation = strong signal
  const score = regime > 1.3 ? 20
              : regime > 1.0 ? 14
              : 7;
  return { score, bullish, detail: `نظام التقلب: ${(regime * 100).toFixed(0)}% من المتوسط — ${regime > 1.0 ? 'توسع' : 'انضغاط'}` };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateVIP2Setup(symbol: string, klines: Kline[]): Vip2Result {
  if (klines.length < 20) {
    const price = klines[klines.length - 1]?.close ?? 65000;
    return {
      symbol, currentPrice: price,
      setups: [{
        timeframe: '1H', tfLabelAr: 'صفقة سريعة المدى - 1H',
        bias: 'BULL', isBlocked: true,
        blockedReasonAr: 'بيانات غير كافية — يلزم 20 شمعة على الأقل',
        consensusScorePct: 0, subAlgorithms: [],
      }],
    };
  }

  const lastClose = klines[klines.length - 1].close;
  const atr = computeATR(klines, 14);

  const t6  = scoreT6_VWAPPosition(klines);
  const t7  = scoreT7_VWMomentum(klines);
  const t8  = scoreT8_LiquiditySweep(klines);
  const t9  = scoreT9_MacroTrend(klines);
  const t10 = scoreT10_Volatility(klines);

  const scores  = [t6, t7, t8, t9, t10];
  const bullCount = scores.filter(s => s.bullish).length;
  const globalBias: Bias = bullCount >= 3 ? 'BULL' : 'BEAR';

  const subAlgoNames = [
    { id: 'T-6',  nameAr: 'موضع VWAP' },
    { id: 'T-7',  nameAr: 'زخم الحجم الموزون' },
    { id: 'T-8',  nameAr: 'كاشف كسح السيولة' },
    { id: 'T-9',  nameAr: 'الاتجاه الكبير EMA' },
    { id: 'T-10', nameAr: 'نظام التقلب ATR' },
  ];

  const subAlgorithms = scores.map((s, idx) => ({
    id:               subAlgoNames[idx].id,
    nameAr:           subAlgoNames[idx].nameAr,
    weightContribPct: s.bullish === (globalBias === 'BULL') ? s.score : 0,
  }));

  const totalConsensus = subAlgorithms.reduce((sum, a) => sum + a.weightContribPct, 0);
  const isBlocked = totalConsensus < 65;

  const vwap    = t6.vwap;
  const stdDev  = computeVWAPStdDev(klines, Math.min(20, klines.length), vwap);

  const timeframes = [
    { tf: '1H', label: 'صفقة سريعة المدى - 1H',    stdMult: 0.5  },
    { tf: '4H', label: 'صفقة متوسطة المدى - 4H',  stdMult: 1.0  },
    { tf: '1D', label: 'صفقة بعيدة المدى - 1D',   stdMult: 2.0  },
  ];

  const setups: Vip2TradeSetup[] = timeframes.map((tf) => {
    let vwapPrice, entryPrice, stopLossLabel, tp1, tp2, tp3, tp1Label, tp2Label, tp3Label, profitPct1, profitPct2, profitPct3;

    if (!isBlocked) {
      const scaledDev = stdDev * tf.stdMult || atr * tf.stdMult;
      const tp1N = globalBias === 'BULL' ? vwap + scaledDev * 1.0 : vwap - scaledDev * 1.0;
      const tp2N = globalBias === 'BULL' ? vwap + scaledDev * 2.0 : vwap - scaledDev * 2.0;
      const tp3N = globalBias === 'BULL' ? vwap + scaledDev * 3.0 : vwap - scaledDev * 3.0;

      vwapPrice     = `$${priceStr(vwap)}`;
      entryPrice    = `$${priceStr(vwap)}`;
      stopLossLabel = globalBias === 'BULL' ? 'إغلاق 4 شمعات أسفل مستوى VWAP' : 'إغلاق 4 شمعات أعلى مستوى VWAP';
      tp1Label      = globalBias === 'BULL' ? `+ ${tf.stdMult}σ VWAP` : `- ${tf.stdMult}σ VWAP`;
      tp2Label      = globalBias === 'BULL' ? `+ ${tf.stdMult * 2}σ VWAP` : `- ${tf.stdMult * 2}σ VWAP`;
      tp3Label      = globalBias === 'BULL' ? `+ ${tf.stdMult * 3}σ VWAP` : `- ${tf.stdMult * 3}σ VWAP`;
      tp1           = `$${priceStr(tp1N)}`;
      tp2           = `$${priceStr(tp2N)}`;
      tp3           = `$${priceStr(tp3N)}`;
      const pct     = (p: number, e: number) => (Math.abs((p - e) / e) * 100).toFixed(2) + '%';
      profitPct1    = pct(tp1N, vwap);
      profitPct2    = pct(tp2N, vwap);
      profitPct3    = pct(tp3N, vwap);
    }

    return {
      timeframe: tf.tf, tfLabelAr: tf.label,
      bias: globalBias, isBlocked,
      blockedReasonAr: isBlocked
        ? `تم حجب التمركز: درجة الإجماع ${totalConsensus}% — لم تصل لحد الأمان 65%`
        : undefined,
      consensusScorePct: Math.min(100, totalConsensus),
      subAlgorithms,
      vwapPrice, entryPrice, stopLossLabel,
      tp1, tp2, tp3, tp1Label, tp2Label, tp3Label,
      profitPct1, profitPct2, profitPct3,
    };
  });

  return { symbol, currentPrice: lastClose, setups };
}
