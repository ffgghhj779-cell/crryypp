// ─── SMC Order Blocks Algorithm ───────────────────────────────────────────────
// Thick-client, 100% browser-side. Expects 300 raw Kline candles.
// Identifies the most recent significant Order Block (OB) using a 5-factor
// heuristic scoring model (displacement, structure, FVG, volume, cleanliness).

import type { Kline } from '@/lib/binance/fetcher';

// ── Output types ──────────────────────────────────────────────────────────────

export interface SMCScoreBreakdown {
  displacement: number; // /25 — size & speed of the impulse move
  structure:    number; // /25 — BOS or CHoCH confirmation
  fvg:          number; // /20 — Fair Value Gap left behind
  volume:       number; // /15 — above-average volume on base candle
  clean:        number; // /15 — untouched / minimal wicks into OB zone
}

export interface SMCResult {
  verdict:          'BULLISH' | 'BEARISH';
  status:           'FRESH' | 'MITIGATED' | 'BROKEN';
  priceRange:       { high: number; low: number };   // full candle range of OB
  bodyRange:        { high: number; low: number };   // body (open–close) of OB
  score:            number;                          // 0–100
  scoreBreakdown:   SMCScoreBreakdown;
  setup:            { entry: number; sl: number; tp1: number; tp2: number; rr: string };
  strongMoveDetails: string;                         // e.g. "1.24% in 6 candles"
  bosLevel:         number;
  touches:          number;
  lastClose:        number;
  symbol:           string;
  obIndex:          number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function candleSize(k: Kline): number {
  return Math.abs(k.close - k.open);
}

function isBullish(k: Kline): boolean {
  return k.close >= k.open;
}

/** Returns true if candle b's low dips into candle a's range */
function touchesZone(k: Kline, zoneHigh: number, zoneLow: number): boolean {
  return k.low <= zoneHigh && k.high >= zoneLow;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Analyses raw klines and returns the most recent significant Order Block.
 *
 * @param klines - OHLCV array (recommend 200–300 candles for accuracy)
 * @param symbol - Trading pair label for display (e.g. "BTCUSDT")
 */
export function calculateSMC(klines: Kline[], symbol = 'BTCUSDT'): SMCResult {
  if (klines.length < 50) {
    throw new Error('SMC requires at least 50 candles. Fetch more data.');
  }

  const closes  = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);
  const avgVol  = avg(volumes);
  const lastClose = closes[closes.length - 1];

  // ── Step 1: Find the strongest displacement move ───────────────────────────
  // A displacement is a sequence of same-direction candles whose aggregate
  // move (% from start to end) is maximised within a 3–12 candle window.

  let bestImpulseStart  = 0;
  let bestImpulseEnd    = 0;
  let bestImpulsePct    = 0;
  let bestImpulseCandles = 0;
  let bestIsBullish     = true;

  const SEARCH_FROM = Math.max(0, klines.length - 150); // look in last 150 bars
  const SEARCH_TO   = klines.length - 5;

  for (let i = SEARCH_FROM; i < SEARCH_TO; i++) {
    for (let len = 3; len <= 12; len++) {
      const end = i + len;
      if (end >= klines.length) break;

      const startPrice = klines[i].open;
      const endPrice   = klines[end].close;
      const pctMove    = Math.abs((endPrice - startPrice) / startPrice) * 100;

      // Require majority of candles to agree on direction
      const bull = endPrice > startPrice;
      const sameDir = klines
        .slice(i, end + 1)
        .filter(k => isBullish(k) === bull).length;

      if (sameDir < Math.ceil(len * 0.6)) continue;
      if (pctMove > bestImpulsePct) {
        bestImpulsePct    = pctMove;
        bestImpulseStart  = i;
        bestImpulseEnd    = end;
        bestImpulseCandles = len;
        bestIsBullish     = bull;
      }
    }
  }

  // ── Step 2: The Order Block = the last opposing candle before the impulse ──
  // Bullish OB → last BEARISH candle just before the bullish impulse
  // Bearish OB → last BULLISH candle just before the bearish impulse

  let obIndex = bestImpulseStart;
  for (let i = bestImpulseStart; i >= Math.max(0, bestImpulseStart - 5); i--) {
    if (isBullish(klines[i]) !== bestIsBullish) {
      obIndex = i;
      break;
    }
  }

  const ob       = klines[obIndex];
  const obHigh   = ob.high;
  const obLow    = ob.low;
  const obBodyHigh = Math.max(ob.open, ob.close);
  const obBodyLow  = Math.min(ob.open, ob.close);

  // ── Step 3: BOS level ─────────────────────────────────────────────────────
  // Bullish BOS = highest high in the impulse sequence
  // Bearish BOS = lowest low in the impulse sequence
  const impulseSlice = klines.slice(bestImpulseStart, bestImpulseEnd + 1);
  const bosLevel = bestIsBullish
    ? Math.max(...impulseSlice.map(k => k.high))
    : Math.min(...impulseSlice.map(k => k.low));

  // ── Step 4: Status — fresh / mitigated / broken ───────────────────────────
  const candlesAfterOB = klines.slice(obIndex + 1);
  let touchCount = 0;
  let deepestPenetration = 0;

  for (const k of candlesAfterOB) {
    if (touchesZone(k, obHigh, obLow)) {
      touchCount++;
      const penetration = bestIsBullish
        ? (obHigh - k.low) / (obHigh - obLow)
        : (k.high - obLow) / (obHigh - obLow);
      deepestPenetration = Math.max(deepestPenetration, penetration);
    }
  }

  let status: SMCResult['status'];
  if (deepestPenetration > 0.8) {
    status = 'BROKEN';
  } else if (touchCount >= 1) {
    status = 'MITIGATED';
  } else {
    status = 'FRESH';
  }

  // ── Step 5: FVG detection ─────────────────────────────────────────────────
  // FVG exists when there is a gap between candle[i].high and candle[i+2].low
  // (bullish) or candle[i].low and candle[i+2].high (bearish) in the impulse.
  let hasFVG = false;
  for (let i = bestImpulseStart; i < bestImpulseEnd - 1; i++) {
    if (bestIsBullish) {
      if (klines[i + 2].low > klines[i].high) { hasFVG = true; break; }
    } else {
      if (klines[i + 2].high < klines[i].low) { hasFVG = true; break; }
    }
  }

  // ── Step 6: Score Breakdown ───────────────────────────────────────────────

  // Displacement /25 — based on % move size relative to typical 14-bar ATR
  const recentCloses = closes.slice(-15);
  const typicalRange = avg(klines.slice(-14).map(k => k.high - k.low));
  const displacementRaw = Math.min(25, Math.round((bestImpulsePct / (typicalRange / lastClose * 100)) * 8));

  // Structure /25 — BOS present (the impulse broke a prior swing)
  const priorSwingHigh = Math.max(...klines.slice(Math.max(0, obIndex - 20), obIndex).map(k => k.high));
  const priorSwingLow  = Math.min(...klines.slice(Math.max(0, obIndex - 20), obIndex).map(k => k.low));
  const hasBOS = bestIsBullish
    ? bosLevel > priorSwingHigh
    : bosLevel < priorSwingLow;
  const structureScore = hasBOS
    ? 25
    : Math.round(12 + Math.min(12, bestImpulsePct * 2));

  // FVG /20
  const fvgScore = hasFVG ? 20 : Math.round(bestImpulsePct > 0.5 ? 10 : 5);

  // Volume /15 — OB candle volume vs average
  const obVolRatio = ob.volume / avgVol;
  const volumeScore = Math.min(15, Math.round(obVolRatio * 7));

  // Cleanliness /15 — fewer touches = cleaner
  const cleanScore = status === 'FRESH'
    ? 15
    : status === 'MITIGATED'
      ? Math.max(0, 15 - touchCount * 4)
      : 0;

  const scoreBreakdown: SMCScoreBreakdown = {
    displacement: Math.max(0, Math.min(25, displacementRaw)),
    structure:    Math.max(0, Math.min(25, structureScore)),
    fvg:          Math.max(0, Math.min(20, fvgScore)),
    volume:       Math.max(0, Math.min(15, volumeScore)),
    clean:        Math.max(0, Math.min(15, cleanScore)),
  };

  const score = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

  // ── Step 7: Trade Setup ───────────────────────────────────────────────────
  const precision = lastClose > 1000 ? 1 : lastClose > 1 ? 4 : 6;
  const fmt = (n: number) => parseFloat(n.toFixed(precision));

  let entry: number, sl: number, tp1: number, tp2: number;

  if (bestIsBullish) {
    entry = fmt(obBodyHigh);                        // top of OB body = entry
    sl    = fmt(obLow * 0.9985);                   // just below full wick
    const risk = entry - sl;
    tp1   = fmt(entry + risk * 1.5);
    tp2   = fmt(entry + risk * 3.0);
  } else {
    entry = fmt(obBodyLow);
    sl    = fmt(obHigh * 1.0015);
    const risk = sl - entry;
    tp1   = fmt(entry - risk * 1.5);
    tp2   = fmt(entry - risk * 3.0);
  }

  const riskAmt = Math.abs(entry - sl);
  const rewardAmt = Math.abs(tp2 - entry);
  const rrRatio = riskAmt > 0 ? (rewardAmt / riskAmt).toFixed(1) : '3.0';

  // ── Step 8: Strong Move Details string ───────────────────────────────────
  const strongMoveDetails = `${bestImpulsePct.toFixed(2)}% في ${bestImpulseCandles} شمعة`;

  // ── Check if OB is still relevant (not too far in the past) ──────────────
  // If current price is far beyond TP2, the OB is likely stale — flip verdict
  // to align with price reality.
  const verdict: SMCResult['verdict'] = bestIsBullish ? 'BULLISH' : 'BEARISH';

  return {
    verdict,
    status,
    priceRange:        { high: fmt(obHigh),     low: fmt(obLow) },
    bodyRange:         { high: fmt(obBodyHigh), low: fmt(obBodyLow) },
    score,
    scoreBreakdown,
    setup:             { entry, sl, tp1, tp2, rr: `1:${rrRatio}` },
    strongMoveDetails,
    bosLevel:          fmt(bosLevel),
    touches:           touchCount,
    lastClose:         fmt(lastClose),
    symbol,
    obIndex
  };
}
