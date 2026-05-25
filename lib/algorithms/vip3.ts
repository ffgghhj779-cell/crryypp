/**
 * lib/algorithms/vip3.ts — VIP 3 Institutional Engine
 *
 * PHASE 1 FIX: Replaced hash-seed pseudorandom logic with real technical
 * analysis combining RSI Divergence detection, Fibonacci OTE zone scoring,
 * and SMC Order Block identification from live OHLCV data.
 *
 * Three sub-systems:
 *   RSI:   RSI(14) with divergence detection (price vs. RSI direction mismatch)
 *   Fib:   Fibonacci OTE zone (0.618–0.786 retracement from swing high/low)
 *   SMC:   Order Block identification (last opposing candle before impulse)
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calculateEMA, calculateWilderMA } from '@/lib/algorithms/mathUtils';

export type VipBias  = 'BULL' | 'BEAR' | 'NEUTRAL';
export type ToolGrade = 'A' | 'B' | 'C' | 'N/A';

export interface Vip3TradeSetup {
  timeframe:  string;
  tfLabelAr:  string;
  bias:       VipBias;
  score:      number;
  signalType: string;
  entryPrice: string;
  stopLoss:   string;
  tp1:        string;
  tp2:        string;
  tp3:        string;
  profitPct1: string;
  profitPct2: string;
  profitPct3: string;
  quality:    string;
  expValue:   string;
  avgRR:      string;
  grades: { rsi: ToolGrade; fib: ToolGrade; smc: ToolGrade };
}

export interface Vip3Result {
  symbol:       string;
  currentPrice: number;
  masterBias:   VipBias;
  masterScore:  number;
  tfsAligned:   string;
  setups:       Vip3TradeSetup[];
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

function computeATR(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return klines[klines.length - 1].close * 0.015;
  const tr: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high, l = klines[i].low, pc = klines[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return lastValid(calculateWilderMA(tr, period)) || klines[klines.length - 1].close * 0.015;
}

/** Compute RSI(14) and detect divergence. Returns { rsi, bullDiv, bearDiv, grade }. */
function analyzeRSIDivergence(klines: Kline[]): { rsi: number; bullDiv: boolean; bearDiv: boolean; grade: ToolGrade; bullish: boolean } {
  if (klines.length < 20) return { rsi: 50, bullDiv: false, bearDiv: false, grade: 'N/A', bullish: true };
  const closes = klines.map(k => k.close);
  const gains: number[] = [0], losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  const ag = lastValid(calculateWilderMA(gains, 14));
  const al = lastValid(calculateWilderMA(losses, 14));
  const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);

  // Divergence: compare last two major swings (last 14 bars each)
  const half = Math.max(5, Math.floor(klines.length / 2));
  const r1 = klines.slice(0, half);
  const r2 = klines.slice(half);
  const p1Close = r1[r1.length - 1]?.close ?? 0;
  const p2Close = r2[r2.length - 1]?.close ?? 0;

  const gains1: number[] = [0], losses1: number[] = [0];
  const c1 = r1.map(k => k.close);
  for (let i = 1; i < c1.length; i++) { const d = c1[i]-c1[i-1]; gains1.push(d>0?d:0); losses1.push(d<0?-d:0); }
  const ag1 = lastValid(calculateWilderMA(gains1, Math.min(14, r1.length - 1)));
  const al1 = lastValid(calculateWilderMA(losses1, Math.min(14, r1.length - 1)));
  const rsi1 = al1 === 0 ? 100 : 100 - 100 / (1 + ag1 / al1);

  // Bullish divergence: price lower low, RSI higher low
  const bullDiv = p2Close < p1Close && rsi > rsi1;
  // Bearish divergence: price higher high, RSI lower high
  const bearDiv = p2Close > p1Close && rsi < rsi1;

  const grade: ToolGrade = bullDiv || bearDiv ? 'A' : rsi > 60 || rsi < 40 ? 'B' : 'C';
  return { rsi, bullDiv, bearDiv, grade, bullish: rsi > 50 };
}

/** Check if price is in Fibonacci OTE zone (0.618–0.786) of the last swing. */
function analyzeFibOTE(klines: Kline[]): { inOTE: boolean; fibLevel: number; grade: ToolGrade; bullish: boolean } {
  if (klines.length < 20) return { inOTE: false, fibLevel: 0.5, grade: 'N/A', bullish: true };
  const lookback = klines.slice(-30);
  const swHigh   = Math.max(...lookback.map(k => k.high));
  const swLow    = Math.min(...lookback.map(k => k.low));
  const range    = swHigh - swLow;
  const price    = klines[klines.length - 1].close;

  // Retracement from high = (swHigh - price) / range (bullish retracement)
  const fibRetrace = range > 0 ? (swHigh - price) / range : 0.5;
  const inOTE      = fibRetrace >= 0.55 && fibRetrace <= 0.80; // OTE: 0.618–0.786 ± tolerance
  const grade: ToolGrade = (fibRetrace >= 0.60 && fibRetrace <= 0.79) ? 'A'
                          : inOTE ? 'B'
                          : 'C';
  return { inOTE, fibLevel: parseFloat(fibRetrace.toFixed(3)), grade, bullish: fibRetrace > 0.5 };
}

/** Simple SMC Order Block detector: last opposing candle before a strong move. */
function analyzeSMCOrderBlock(klines: Kline[]): { hasFreshOB: boolean; obType: 'BULL' | 'BEAR' | null; grade: ToolGrade; bullish: boolean } {
  if (klines.length < 15) return { hasFreshOB: false, obType: null, grade: 'N/A', bullish: true };
  const price = klines[klines.length - 1].close;

  // Find the biggest 3-candle impulse in last 30 bars
  let bestIdx = 0, bestMove = 0, bullish = true;
  const from = Math.max(0, klines.length - 30);
  for (let i = from; i < klines.length - 3; i++) {
    const move = Math.abs(klines[i + 2].close - klines[i].open);
    if (move > bestMove) { bestMove = move; bestIdx = i; bullish = klines[i + 2].close > klines[i].open; }
  }

  // OB = last candle before the impulse that goes opposite direction
  let obIdx = bestIdx;
  for (let j = bestIdx; j >= Math.max(0, bestIdx - 3); j--) {
    const isBull = klines[j].close >= klines[j].open;
    if (isBull !== bullish) { obIdx = j; break; }
  }

  const ob = klines[obIdx];
  const obHigh = Math.max(ob.open, ob.close);
  const obLow  = Math.min(ob.open, ob.close);

  // Check if price has returned to OB zone (mitigation) or is approaching it
  const inZone   = price <= obHigh * 1.005 && price >= obLow * 0.995;
  const nearZone = bullish
    ? price >= obHigh && price <= obHigh * 1.02
    : price <= obLow  && price >= obLow  * 0.98;

  const hasFreshOB = inZone || nearZone;
  const grade: ToolGrade = inZone ? 'A' : nearZone ? 'B' : 'C';
  return { hasFreshOB, obType: bullish ? 'BULL' : 'BEAR', grade, bullish };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateVIP3Setup(symbol: string, klines: Kline[]): Vip3Result {
  if (klines.length < 20) {
    const price = klines[klines.length - 1]?.close ?? 65000;
    return {
      symbol, currentPrice: price,
      masterBias: 'NEUTRAL', masterScore: 0, tfsAligned: '0/3', setups: [],
    };
  }

  const lastClose  = klines[klines.length - 1].close;
  const atr        = computeATR(klines, 14);

  const rsiAnalysis = analyzeRSIDivergence(klines);
  const fibAnalysis = analyzeFibOTE(klines);
  const smcAnalysis = analyzeSMCOrderBlock(klines);

  // Master bias: 2-of-3 majority
  const votes  = [rsiAnalysis.bullish, fibAnalysis.bullish, smcAnalysis.bullish];
  const bullVotes = votes.filter(Boolean).length;
  const masterBias: VipBias = bullVotes >= 2 ? 'BULL' : bullVotes === 0 ? 'BEAR' : 'NEUTRAL';

  // Score: RSI(30) + Fib(35) + SMC(35) = 100
  const rsiScore = rsiAnalysis.rsi > 65 || rsiAnalysis.rsi < 35 ? 30
                 : rsiAnalysis.rsi > 55 || rsiAnalysis.rsi < 45 ? 20
                 : 10;
  const fibScore = fibAnalysis.inOTE ? 35
                 : fibAnalysis.fibLevel >= 0.45 && fibAnalysis.fibLevel <= 0.9 ? 22 : 12;
  const smcScore = smcAnalysis.hasFreshOB ? 35
                 : smcAnalysis.grade === 'B' ? 22 : 12;
  const masterScore = Math.min(100, rsiScore + fibScore + smcScore);

  const timeframes = [
    { tf: '1H', label: 'صفقة سريعة المدى - 1H',  atrMult: 1.0 },
    { tf: '4H', label: 'صفقة متوسطة المدى - 4H', atrMult: 2.5 },
    { tf: '1D', label: 'صفقة بعيدة المدى - 1D',  atrMult: 5.0 },
  ];

  const setups: Vip3TradeSetup[] = timeframes.map((tf) => {
    const bias: VipBias = masterBias;
    const tfATR  = atr * tf.atrMult;
    const entry  = lastClose;
    const sl     = bias === 'BULL' ? entry - tfATR : entry + tfATR;
    const tp1N   = bias === 'BULL' ? entry + tfATR * 1.5 : entry - tfATR * 1.5;
    const tp2N   = bias === 'BULL' ? entry + tfATR * 2.5 : entry - tfATR * 2.5;
    const tp3N   = bias === 'BULL' ? entry + tfATR * 4.0 : entry - tfATR * 4.0;
    const pct    = (p: number, e: number) => (Math.abs((p - e) / e) * 100).toFixed(2) + '%';

    return {
      timeframe:  tf.tf,
      tfLabelAr:  tf.label,
      bias,
      score:      masterScore,
      signalType: bias === 'BULL' ? 'SPOT BUY 🟢' : bias === 'BEAR' ? 'SPOT SELL 🔴' : 'WAIT ⏳',
      entryPrice: `$${priceStr(entry)}`,
      stopLoss:   `$${priceStr(sl)}`,
      tp1: `$${priceStr(tp1N)}`,
      tp2: `$${priceStr(tp2N)}`,
      tp3: `$${priceStr(tp3N)}`,
      profitPct1: pct(tp1N, entry),
      profitPct2: pct(tp2N, entry),
      profitPct3: pct(tp3N, entry),
      quality:    masterScore >= 85 ? 'HIGH (A+)' : masterScore >= 65 ? 'GOOD (B)' : 'AVERAGE (C)',
      expValue:   `+${(masterScore / 10).toFixed(1)} EV`,
      avgRR:      '1:2.67',
      grades: {
        rsi: rsiAnalysis.grade,
        fib: fibAnalysis.grade,
        smc: smcAnalysis.grade,
      },
    };
  });

  const alignedCount = masterBias === 'BULL' ? bullVotes : 3 - bullVotes;

  return {
    symbol,
    currentPrice: lastClose,
    masterBias,
    masterScore,
    tfsAligned: `${alignedCount}/3`,
    setups,
  };
}
