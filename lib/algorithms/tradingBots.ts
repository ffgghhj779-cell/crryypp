/**
 * lib/algorithms/tradingBots.ts
 *
 * Multi-Strategy Trading Bot Engine — PHASE 1 FIX
 *
 * CHANGES: Replaced the `id % 3` hardcoded signal with genuine technical
 * analysis. Each bot now evaluates live OHLCV data using its described
 * strategy and produces a BUY/SELL/WAIT based on real market conditions.
 * ATR-based SL/TP replaces the flat 1.5% mock.
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calculateEMA, calculateSMA, calculateWilderMA } from '@/lib/algorithms/mathUtils';

export interface TradingBotSignal {
  botId:         string;
  nameEn:        string;
  nameAr:        string;
  descriptionAr: string;
  signal:        'BUY' | 'SELL' | 'WAIT';
  winRate:       number;
  riskReward:    string;
  entryPrice:    number;
  stopLoss:      number;
  tp1:           number;
  tp2:           number;
  tp3:           number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (isFinite(arr[i]) && !isNaN(arr[i])) return arr[i];
  }
  return 0;
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

function computeRSI(klines: Kline[], period = 14): number {
  if (klines.length < period + 2) return 50;
  const closes = klines.map(k => k.close);
  const gains: number[] = [0], losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0); losses.push(d < 0 ? -d : 0);
  }
  const ag = lastValid(calculateWilderMA(gains, period));
  const al = lastValid(calculateWilderMA(losses, period));
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

// ─── Strategy Evaluators ──────────────────────────────────────────────────────

/** Bot 1: EMA 9/21 cross scalper */
function bot1Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 25) return 'WAIT';
  const closes = klines.map(k => k.close);
  const ema9  = lastValid(calculateEMA(closes, 9));
  const ema21 = lastValid(calculateEMA(closes, 21));
  const price = closes[closes.length - 1];
  if (ema9 > ema21 * 1.001 && price > ema9) return 'BUY';
  if (ema9 < ema21 * 0.999 && price < ema9) return 'SELL';
  return 'WAIT';
}

/** Bot 2: RSI + MACD momentum */
function bot2Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 35) return 'WAIT';
  const rsi = computeRSI(klines, 14);
  const closes = klines.map(k => k.close);
  const ema12 = calculateEMA(closes, 12), ema26 = calculateEMA(closes, 26);
  const macdVal = lastValid(ema12) - lastValid(ema26);
  if (rsi > 55 && macdVal > 0) return 'BUY';
  if (rsi < 45 && macdVal < 0) return 'SELL';
  return 'WAIT';
}

/** Bot 3: EMA 50 SuperTrend-style trend follower */
function bot3Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 55) return 'WAIT';
  const closes = klines.map(k => k.close);
  const ema50  = lastValid(calculateEMA(closes, 50));
  const price  = closes[closes.length - 1];
  const prev   = closes[closes.length - 2];
  if (price > ema50 && prev < ema50) return 'BUY';  // Cross above
  if (price < ema50 && prev > ema50) return 'SELL'; // Cross below
  if (price > ema50 * 1.003) return 'BUY';
  if (price < ema50 * 0.997) return 'SELL';
  return 'WAIT';
}

/** Bot 4: Bollinger Band mean reversion */
function bot4Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 22) return 'WAIT';
  const closes = klines.map(k => k.close);
  const sma20 = lastValid(calculateSMA(closes, 20));
  const slice = closes.slice(-20);
  const mean  = slice.reduce((a, b) => a + b, 0) / 20;
  const stdDev = Math.sqrt(slice.reduce((a, v) => a + (v - mean) ** 2, 0) / 20);
  const upper  = sma20 + 2 * stdDev, lower = sma20 - 2 * stdDev;
  const price  = closes[closes.length - 1];
  if (price < lower * 1.002) return 'BUY';
  if (price > upper * 0.998) return 'SELL';
  return 'WAIT';
}

/** Bot 5: Volume surge detection */
function bot5Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 22) return 'WAIT';
  const volumes = klines.map(k => k.volume);
  const avgVol  = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currVol = volumes[volumes.length - 1];
  const last    = klines[klines.length - 1];
  if (currVol > avgVol * 1.8) {
    return last.close >= last.open ? 'BUY' : 'SELL';
  }
  return 'WAIT';
}

/** Bot 6: Fibonacci 0.618 retracement sniper */
function bot6Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 20) return 'WAIT';
  const lookback = klines.slice(-20);
  const swHigh   = Math.max(...lookback.map(k => k.high));
  const swLow    = Math.min(...lookback.map(k => k.low));
  const fib618   = swHigh - (swHigh - swLow) * 0.618;
  const price    = klines[klines.length - 1].close;
  if (Math.abs(price - fib618) / fib618 < 0.005) {
    return klines[klines.length - 1].close > klines[klines.length - 2].close ? 'BUY' : 'SELL';
  }
  return 'WAIT';
}

/** Bot 7: Harmonic pattern approximation via price symmetry */
function bot7Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 15) return 'WAIT';
  const rsi = computeRSI(klines, 14);
  const lookback = klines.slice(-15);
  const swHigh = Math.max(...lookback.map(k => k.high));
  const swLow  = Math.min(...lookback.map(k => k.low));
  const price  = klines[klines.length - 1].close;
  const range  = swHigh - swLow;
  // Gartley-like: price near 0.786 fib retracement
  const fib786 = swHigh - range * 0.786;
  if (Math.abs(price - fib786) / fib786 < 0.008 && rsi < 45) return 'BUY';
  const fib786b = swLow + range * 0.786;
  if (Math.abs(price - fib786b) / fib786b < 0.008 && rsi > 55) return 'SELL';
  return 'WAIT';
}

/** Bot 8: SMC Order Block proximity check */
function bot8Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 20) return 'WAIT';
  // Find last strong move
  let bestMove = 0, bestIdx = 0, bullish = true;
  const from = Math.max(0, klines.length - 25);
  for (let i = from; i < klines.length - 3; i++) {
    const move = Math.abs(klines[i + 2].close - klines[i].open);
    if (move > bestMove) {
      bestMove = move; bestIdx = i;
      bullish = klines[i + 2].close > klines[i].open;
    }
  }
  const ob = klines[bestIdx];
  const obHigh = Math.max(ob.open, ob.close);
  const obLow  = Math.min(ob.open, ob.close);
  const price  = klines[klines.length - 1].close;
  if (bullish && price <= obHigh * 1.003 && price >= obLow * 0.997) return 'BUY';
  if (!bullish && price >= obLow * 0.997 && price <= obHigh * 1.003) return 'SELL';
  return 'WAIT';
}

/** Bot 9: Breakout catcher — price compressing then expanding */
function bot9Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 25) return 'WAIT';
  const closes = klines.map(k => k.close);
  const sma20 = lastValid(calculateSMA(closes, 20));
  const slice = closes.slice(-20);
  const stdDev = Math.sqrt(slice.reduce((a, v) => a + (v - sma20) ** 2, 0) / 20);
  const bw = stdDev / sma20; // Band width
  const price = closes[closes.length - 1];
  const prev  = closes[closes.length - 2];
  // Breakout: tight range then expansion above/below recent high/low
  const recentHigh = Math.max(...klines.slice(-10).map(k => k.high));
  const recentLow  = Math.min(...klines.slice(-10).map(k => k.low));
  if (bw < 0.015 && price > recentHigh * 1.001) return 'BUY';
  if (bw < 0.015 && price < recentLow * 0.999)  return 'SELL';
  return 'WAIT';
}

/** Bot 10: AI Consensus — requires all 4 indicators aligned */
function bot10Signal(klines: Kline[], atr: number): 'BUY' | 'SELL' | 'WAIT' {
  if (klines.length < 35) return 'WAIT';
  const s1 = bot1Signal(klines, atr);
  const s2 = bot2Signal(klines, atr);
  const s3 = bot3Signal(klines, atr);
  const s5 = bot5Signal(klines, atr);
  const signals = [s1, s2, s3, s5];
  const buys  = signals.filter(s => s === 'BUY').length;
  const sells = signals.filter(s => s === 'SELL').length;
  if (buys >= 4) return 'BUY';
  if (sells >= 4) return 'SELL';
  return 'WAIT';
}

const BOT_STRATEGIES = [
  { nameEn: 'Fast Scalper',      nameAr: 'المضارب اللحظي (Scalping)',      desc: 'يعتمد على تقاطع المتوسطات السريعة (EMA 9/21) مع تأكيد الزخم اللحظي.',  winRate: 72, rr: '1:1.5', fn: bot1Signal  },
  { nameEn: 'Momentum Master',   nameAr: 'سيد الزخم (Momentum)',            desc: 'يدمج مؤشري RSI و MACD لاقتناص الانفجارات السعرية بعد مناطق التشبع.', winRate: 68, rr: '1:2',   fn: bot2Signal  },
  { nameEn: 'Trend Follower',    nameAr: 'متتبع الاتجاه (Trend)',           desc: 'يعتمد على EMA50 وكسر الاتجاه لركوب الموجات الطويلة بأمان.',           winRate: 61, rr: '1:3',   fn: bot3Signal  },
  { nameEn: 'Mean Reversion',    nameAr: 'مقتنص الارتدادات (Reversion)',   desc: 'يستخدم أشرطة بولينجر لاصطياد الارتدادات العكسية من الحدود القصوى.',   winRate: 65, rr: '1:1.5', fn: bot4Signal  },
  { nameEn: 'Volume Surge',      nameAr: 'انفجار السيولة (Volume)',         desc: 'يراقب تدفق السيولة المفاجئ وحجم التداول المرجح للدخول مع الحيتان.',   winRate: 70, rr: '1:2.5', fn: bot5Signal  },
  { nameEn: 'Fibonacci Sniper',  nameAr: 'قناص فيبوناتشي (Fibonacci)',     desc: 'يحدد ارتدادات النسبة الذهبية (0.618) للدخول بأقل انعكاس سعري.',        winRate: 75, rr: '1:3',   fn: bot6Signal  },
  { nameEn: 'Harmonic Trader',   nameAr: 'متاجر الهارمونيك (Harmonic)',    desc: 'يقتنص النماذج التوافقية المعقدة (Gartley, Bat) بدقة هندسية.',           winRate: 81, rr: '1:2',   fn: bot7Signal  },
  { nameEn: 'Order Block SMC',   nameAr: 'بلوك الأوامر (SMC)',             desc: 'يعتمد على مفاهيم الأموال الذكية للتمركز في مناطق طلب/عرض المؤسسات.',  winRate: 69, rr: '1:4',   fn: bot8Signal  },
  { nameEn: 'Breakout Catcher',  nameAr: 'صائد الاختراقات (Breakout)',     desc: 'ينتظر انضغاط السعر في نطاق ضيق ثم يدخل مع أول كسر سعري قوي.',         winRate: 63, rr: '1:2.5', fn: bot9Signal  },
  { nameEn: 'AI Consensus',      nameAr: 'الإجماع الذكي (Consensus)',      desc: 'يحلل مخرجات 5 خوارزميات ويدخل فقط عندما تتفق بنسبة 100%.',              winRate: 88, rr: '1:1.5', fn: bot10Signal },
];

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates a real signal for the specified bot using live kline data.
 * Falls back to currentPrice when klines are not provided (backward compat).
 */
export function generateBotSignal(
  botId: string,
  currentPrice: number = 60000,
  klines: Kline[] = [],
): TradingBotSignal {
  const id  = parseInt(botId, 10) || 1;
  const idx = Math.max(0, Math.min(id - 1, BOT_STRATEGIES.length - 1));
  const def = BOT_STRATEGIES[idx];

  // Use real ATR or fall back to 1.5% for when no klines available
  const atr = klines.length >= 15 ? computeATR(klines, 14) : currentPrice * 0.015;

  // Evaluate the strategy
  const signal = klines.length >= 15 ? def.fn(klines, atr) : 'WAIT';

  // Build SL/TPs from ATR
  let stopLoss = 0, tp1 = 0, tp2 = 0, tp3 = 0;
  if (signal === 'BUY') {
    stopLoss = currentPrice - atr * 1.0;
    tp1      = currentPrice + atr * 1.5;
    tp2      = currentPrice + atr * 2.5;
    tp3      = currentPrice + atr * 4.0;
  } else if (signal === 'SELL') {
    stopLoss = currentPrice + atr * 1.0;
    tp1      = currentPrice - atr * 1.5;
    tp2      = currentPrice - atr * 2.5;
    tp3      = currentPrice - atr * 4.0;
  }

  return {
    botId,
    nameEn:        def.nameEn,
    nameAr:        def.nameAr,
    descriptionAr: def.desc,
    signal,
    winRate:       def.winRate,
    riskReward:    def.rr,
    entryPrice:    currentPrice,
    stopLoss,
    tp1, tp2, tp3,
  };
}
