/**
 * lib/algorithms/vip1.ts — VIP 1 Consensus Engine (محرك الإجماع الفائق)
 *
 * PHASE 1 FIX: Replaced deterministic hash-seed pseudorandom logic with
 * genuine technical indicator scoring. Bias and consensus are now derived
 * from real OHLCV data (EMA cross, RSI, Bollinger squeeze, volume trend,
 * MACD histogram) to produce a live, accurate signal.
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calculateEMA, calculateSMA, calculateWilderMA } from '@/lib/algorithms/mathUtils';

export type Bias = 'BULL' | 'BEAR';

export interface Vip1TradeSetup {
  timeframe: string;
  tfLabelAr: string;
  bias: Bias;
  isBlocked: boolean;
  blockedReasonAr?: string;
  consensusScorePct: number;
  subAlgorithms: { id: string; nameAr: string; weightContribPct: number }[];
  entryPrice?: string;
  stopLoss?: string;
  tp1?: string;
  tp2?: string;
  tp3?: string;
  profitPct1?: string;
  profitPct2?: string;
  profitPct3?: string;
}

export interface Vip1Result {
  symbol: string;
  currentPrice: number;
  setups: Vip1TradeSetup[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

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

/**
 * Compute real ATR (14-period Average True Range) for dynamic SL/TP sizing.
 */
function computeATR(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return klines[klines.length - 1].close * 0.015;
  const trList: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high;
    const l = klines[i].low;
    const pc = klines[i - 1].close;
    trList.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const wilderATR = calculateWilderMA(trList, period);
  return lastValid(wilderATR) || klines[klines.length - 1].close * 0.015;
}

/**
 * T-1: EMA Cross (9/21) — 20 pts
 * Score based on: alignment of 9-period and 21-period EMA relative to price.
 */
function scoreT1_EMACross(klines: Kline[]): { score: number; detail: string; bullish: boolean } {
  if (klines.length < 25) return { score: 10, detail: 'بيانات غير كافية', bullish: true };
  const closes = klines.map(k => k.close);
  const ema9   = lastValid(calculateEMA(closes, 9));
  const ema21  = lastValid(calculateEMA(closes, 21));
  const price  = closes[closes.length - 1];
  const bullish = ema9 > ema21 && price > ema9;
  const bearish = ema9 < ema21 && price < ema9;
  const score = (bullish || bearish) ? 20 : 8;
  const detail = bullish
    ? `EMA9 (${ema9.toFixed(0)}) فوق EMA21 — تقاطع صاعد`
    : bearish
    ? `EMA9 (${ema9.toFixed(0)}) تحت EMA21 — تقاطع هابط`
    : 'لا يوجد تقاطع واضح';
  return { score, detail, bullish: bullish || !bearish };
}

/**
 * T-2: RSI(14) Momentum — 25 pts
 * Score: RSI > 55 (bull) or < 45 (bear) for directional confirmation.
 */
function scoreT2_RSI(klines: Kline[]): { score: number; detail: string; bullish: boolean } {
  if (klines.length < 16) return { score: 12, detail: 'بيانات غير كافية', bullish: true };
  const closes = klines.map(k => k.close);
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? Math.abs(d) : 0);
  }
  const ag = lastValid(calculateWilderMA(gains, 14));
  const al = lastValid(calculateWilderMA(losses, 14));
  const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  const bullish = rsi > 55;
  const bearish = rsi < 45;
  let score: number;
  if (rsi > 65 || rsi < 35) score = 25;        // Strong signal
  else if (bullish || bearish) score = 18;       // Moderate signal
  else score = 8;                                 // Neutral
  const detail = `RSI(14) = ${rsi.toFixed(1)} — ${rsi > 65 ? 'زخم صاعد قوي' : rsi < 35 ? 'زخم هابط قوي' : rsi > 55 ? 'مائل للصعود' : rsi < 45 ? 'مائل للهبوط' : 'محايد'}`;
  return { score, detail, bullish: bullish || !bearish };
}

/**
 * T-3: Bollinger Band Squeeze — 15 pts
 * Score based on band width and price position within bands.
 */
function scoreT3_Bollinger(klines: Kline[]): { score: number; detail: string; bullish: boolean } {
  if (klines.length < 22) return { score: 7, detail: 'بيانات غير كافية', bullish: true };
  const closes = klines.map(k => k.close);
  const sma20 = lastValid(calculateSMA(closes, 20));
  const slice = closes.slice(-20);
  const mean  = slice.reduce((a, b) => a + b, 0) / 20;
  const stdDev = Math.sqrt(slice.reduce((a, v) => a + (v - mean) ** 2, 0) / 20);
  const upper  = sma20 + 2 * stdDev;
  const lower  = sma20 - 2 * stdDev;
  const price  = closes[closes.length - 1];
  const bandWidth = (upper - lower) / sma20;
  const bullish = price > sma20;
  // Squeeze = tight bands (bandWidth < 0.04); expansion = wide bands (> 0.08)
  const isExpanding = bandWidth > 0.06;
  const score = (isExpanding && (price > upper * 0.995 || price < lower * 1.005)) ? 15
              : isExpanding ? 12
              : 6;
  const detail = `باند ببولنجر: العرض ${(bandWidth * 100).toFixed(2)}% — السعر ${price > upper * 0.995 ? 'فوق الحد العلوي' : price < lower * 1.005 ? 'تحت الحد السفلي' : 'داخل النطاق'}`;
  return { score, detail, bullish };
}

/**
 * T-4: Volume Trend — 20 pts
 * Score based on: current volume vs 20-period SMA of volume.
 */
function scoreT4_Volume(klines: Kline[]): { score: number; detail: string; bullish: boolean } {
  if (klines.length < 22) return { score: 10, detail: 'بيانات غير كافية', bullish: true };
  const volumes  = klines.map(k => k.volume);
  const avgVol   = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currVol  = volumes[volumes.length - 1];
  const prevVol  = volumes[volumes.length - 2] ?? currVol;
  const volRatio = currVol / (avgVol || 1);
  const bullish  = klines[klines.length - 1].close > klines[klines.length - 1].open;
  const score = volRatio > 1.5 ? 20
              : volRatio > 1.2 ? 16
              : volRatio > 0.8 ? 10
              : 5;
  const detail = `حجم التداول: ${(volRatio * 100).toFixed(0)}% من المتوسط — ${volRatio > 1.2 ? 'حجم مرتفع قوي' : volRatio > 0.8 ? 'حجم طبيعي' : 'حجم منخفض'}`;
  return { score, detail, bullish };
}

/**
 * T-5: MACD Histogram Direction — 20 pts
 * Score: histogram increasing = bullish momentum, decreasing = bearish.
 */
function scoreT5_MACD(klines: Kline[]): { score: number; detail: string; bullish: boolean } {
  if (klines.length < 35) return { score: 10, detail: 'بيانات غير كافية', bullish: true };
  const closes  = klines.map(k => k.close);
  const ema12   = calculateEMA(closes, 12);
  const ema26   = calculateEMA(closes, 26);
  const macdRaw = ema12.map((v, i) => (isNaN(v) || isNaN(ema26[i])) ? NaN : v - ema26[i]);
  const validMACD = macdRaw.filter(v => !isNaN(v));
  if (validMACD.length < 11) return { score: 10, detail: 'بيانات غير كافية', bullish: true };
  const signal9 = calculateEMA(validMACD, 9);
  const sigVal  = lastValid(signal9);
  const macdVal = validMACD[validMACD.length - 1];
  const hist    = macdVal - sigVal;
  const prevHist = (validMACD[validMACD.length - 2] ?? macdVal) - (signal9[signal9.length - 2] ?? sigVal);
  const bullish = hist > 0;
  const increasing = hist > prevHist;
  const score = (bullish && increasing) ? 20
              : (bullish && !increasing) ? 14
              : (!bullish && !increasing) ? 20
              : 14;
  const detail = `MACD Histogram: ${hist.toFixed(4)} — ${bullish ? 'إيجابي' : 'سلبي'} ${increasing ? '(متزايد ↑)' : '(متناقص ↓)'}`;
  return { score, detail, bullish };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateVIP1Setup(symbol: string, klines: Kline[]): Vip1Result {
  // Guard: need at minimum 35 candles for MACD
  if (klines.length < 35) {
    const price = klines[klines.length - 1]?.close ?? 65000;
    return {
      symbol,
      currentPrice: price,
      setups: [{
        timeframe: '1H', tfLabelAr: 'صفقة سريعة المدى - 1H',
        bias: 'BULL', isBlocked: true,
        blockedReasonAr: 'بيانات غير كافية — يلزم 35 شمعة على الأقل',
        consensusScorePct: 0, subAlgorithms: [],
      }],
    };
  }

  const lastClose = klines[klines.length - 1].close;
  const atr = computeATR(klines, 14);

  // Run all 5 scoring functions against the primary kline feed
  const t1 = scoreT1_EMACross(klines);
  const t2 = scoreT2_RSI(klines);
  const t3 = scoreT3_Bollinger(klines);
  const t4 = scoreT4_Volume(klines);
  const t5 = scoreT5_MACD(klines);

  const scores = [t1, t2, t3, t4, t5];
  const subAlgoDefs = [
    { id: 'T-1', nameAr: 'تقاطع المتوسطات' },
    { id: 'T-2', nameAr: 'مؤشر RSI الزخم' },
    { id: 'T-3', nameAr: 'نطاق بولينجر' },
    { id: 'T-4', nameAr: 'حجم التداول' },
    { id: 'T-5', nameAr: 'MACD المحور' },
  ];

  // Consensus bias: majority vote from the 5 indicators
  const bullCount = scores.filter(s => s.bullish).length;
  const globalBias: Bias = bullCount >= 3 ? 'BULL' : 'BEAR';

  // Re-score each indicator contribution relative to the consensus bias
  // If indicator agrees with consensus, it contributes its full score
  // If it disagrees, it contributes 0 (contradictory signal filters itself)
  const subAlgorithms = scores.map((s, idx) => ({
    id: subAlgoDefs[idx].id,
    nameAr: subAlgoDefs[idx].nameAr,
    weightContribPct: s.bullish === (globalBias === 'BULL') ? s.score : 0,
  }));

  const totalConsensus = subAlgorithms.reduce((sum, a) => sum + a.weightContribPct, 0);

  const timeframes = [
    { tf: '1H', label: 'صفقة سريعة المدى - 1H', atrMult: 1.0 },
    { tf: '4H', label: 'صفقة متوسطة المدى - 4H', atrMult: 2.5 },
    { tf: '1D', label: 'صفقة بعيدة المدى - 1D',  atrMult: 5.0 },
  ];

  const setups: Vip1TradeSetup[] = timeframes.map((tf) => {
    const isBlocked = totalConsensus < 65;
    const tfATR = atr * tf.atrMult;

    let entryPrice, stopLoss, tp1, tp2, tp3, profitPct1, profitPct2, profitPct3;

    if (!isBlocked) {
      const entry = lastClose;
      const sl    = globalBias === 'BULL' ? entry - tfATR * 1.0 : entry + tfATR * 1.0;
      const tp1N  = globalBias === 'BULL' ? entry + tfATR * 1.5 : entry - tfATR * 1.5;
      const tp2N  = globalBias === 'BULL' ? entry + tfATR * 2.5 : entry - tfATR * 2.5;
      const tp3N  = globalBias === 'BULL' ? entry + tfATR * 4.0 : entry - tfATR * 4.0;
      const pct   = (p: number, e: number) => (Math.abs((p - e) / e) * 100).toFixed(2) + '%';

      entryPrice  = `$${priceStr(entry)}`;
      stopLoss    = `$${priceStr(sl)}`;
      tp1         = `$${priceStr(tp1N)}`;
      tp2         = `$${priceStr(tp2N)}`;
      tp3         = `$${priceStr(tp3N)}`;
      profitPct1  = pct(tp1N, entry);
      profitPct2  = pct(tp2N, entry);
      profitPct3  = pct(tp3N, entry);
    }

    return {
      timeframe: tf.tf,
      tfLabelAr: tf.label,
      bias: globalBias,
      isBlocked,
      blockedReasonAr: isBlocked
        ? `تم حجب التمركز: درجة الإجماع ${totalConsensus}% — لم تصل لحد الأمان 65%`
        : undefined,
      consensusScorePct: Math.min(100, totalConsensus),
      subAlgorithms,
      entryPrice, stopLoss, tp1, tp2, tp3,
      profitPct1, profitPct2, profitPct3,
    };
  });

  return { symbol, currentPrice: lastClose, setups };
}
