/**
 * lib/binance/ewa-fetcher.ts
 *
 * Dedicated Binance SPOT-only OHLCV fetcher for the EWA (Elliott Wave Analysis) engine.
 *
 * SECURITY CONTRACTS:
 *  - SPOT-LOCK: Exclusively uses api.binance.com/api/v3/klines.
 *    This endpoint ONLY serves Spot market data. The Futures endpoint is at
 *    fapi.binance.com (USD-M) and dapi.binance.com (Coin-M). We never call those.
 *  - SYMBOL-GUARD: Rejects any symbol containing "PERP", "USDT_" compound pairs,
 *    or futures suffixes before the network call is even made.
 *  - INPUT-SANITIZE: symbol and interval pass through strict regex validators
 *    before being interpolated into URLs (VULN-08 compliance).
 *  - TIMEOUT: Each fetch is wrapped in a 10-second AbortController timeout.
 *    Binance occasionally stalls — we fail fast rather than hanging the Route Handler.
 *  - LIMIT-CAP: Max 1000 bars per call (Binance hard limit). EWA callers specify
 *    their own limit; we cap and log if they exceed 1000.
 *
 * HALAL SPOT GUARANTEE:
 *  The URL is hardcoded to the Spot v3 endpoint and cannot be overridden by any
 *  caller parameter. There is no dynamic base-URL construction.
 */

import { sanitizeSymbol, sanitizeInterval } from '@/lib/sanitize';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Binance Spot REST base. NEVER change this to fapi/dapi — those are futures.
 * Having this as a named const makes it grep-able in security audits.
 */
const BINANCE_SPOT_BASE = 'https://api.binance.com/api/v3';

/**
 * Validated timeframe aliases accepted by the EWA engine.
 * Only timeframes relevant to Elliott Wave analysis are permitted.
 * Short scalping intervals (1m, 3m, 5m) produce too much noise for EW counting.
 */
const EWA_VALID_TIMEFRAMES = new Set([
  '15m',  // Micro-structure (for very short-term sub-waves)
  '1h',   // Standard micro timeframe
  '4h',   // Mid-range — most EW practitioners' primary timeframe
  '1d',   // Macro timeframe — primary for higher-degree wave counting
  '3d',   // Extended macro
  '1w',   // Grand Supercycle degree
]);

/**
 * Futures/margin symbol suffix patterns — block before any network call.
 * A symbol containing any of these patterns is NOT a Spot pair.
 */
const FUTURES_PATTERNS = [
  /PERP$/i,          // e.g. BTCUSDT_PERP
  /^\d{6}$/,         // Quarterly futures e.g. BTCUSDT_231229
  /USDT_\d+/i,       // Dated futures
  /_USDT$/,          // Non-standard separator
];

/** Maximum bars Binance Spot allows per request */
const BINANCE_MAX_LIMIT = 1000;

/** Network timeout in milliseconds — fail fast if Binance stalls */
const FETCH_TIMEOUT_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Canonical OHLCV bar format used throughout the EWA engine.
 * All prices are plain JavaScript numbers (no string coercion downstream).
 */
export interface OHLCVBar {
  /** Unix timestamp in SECONDS (not ms) — matches Python time.time() convention */
  t: number;
  o: number;   // open
  h: number;   // high
  l: number;   // low
  c: number;   // close
  v: number;   // volume (base asset)
  /** Close time in seconds — useful for determining bar completion */
  tc: number;
  /** Is this bar closed (i.e. not the currently forming candle)? */
  is_closed: boolean;
}

export interface EWAFetcherRequest {
  symbol:     string;   // e.g. "BTCUSDT"
  timeframe:  string;   // e.g. "1d", "1h"
  limit:      number;   // bars to fetch (max 1000)
}

export interface EWAFetcherResult {
  bars:       OHLCVBar[];
  symbol:     string;
  timeframe:  string;
  fetched_at: number;   // Unix seconds
  bar_count:  number;
  /** The most recent CLOSED bar (excludes forming candle) */
  latest_closed_bar: OHLCVBar | null;
}

// ─── Spot-Lock Guard ──────────────────────────────────────────────────────────

/**
 * Validates that a symbol is a plain Spot pair and contains no futures markers.
 * Throws immediately if any futures pattern is detected.
 *
 * This is the primary Halal guard — it runs BEFORE sanitizeSymbol so that
 * even a malformed futures symbol never reaches the network layer.
 */
function assertSpotSymbol(raw: string): void {
  for (const pattern of FUTURES_PATTERNS) {
    if (pattern.test(raw)) {
      throw new Error(
        `[EWA-SPOT-LOCK] Symbol "${raw}" matches a futures/margin pattern ` +
        `(${pattern}). The EWA engine only supports Halal Spot pairs. ` +
        `Use a plain symbol like BTCUSDT, ETHUSDT.`
      );
    }
  }
}

/**
 * Validates that the requested timeframe is in the EWA-approved set.
 * Rejects short scalping intervals that are inappropriate for Elliott Wave.
 */
function assertEWATimeframe(raw: string): void {
  if (!EWA_VALID_TIMEFRAMES.has(raw)) {
    throw new Error(
      `[EWA-TF-GUARD] Timeframe "${raw}" is not valid for Elliott Wave analysis. ` +
      `Permitted: ${[...EWA_VALID_TIMEFRAMES].join(', ')}. ` +
      `Short intervals (1m/5m) produce excessive noise for wave counting.`
    );
  }
}

// ─── Core Fetcher ─────────────────────────────────────────────────────────────

/**
 * Fetches OHLCV bars from Binance SPOT API for EWA processing.
 *
 * Unlike the general-purpose fetchKlines() in lib/binance.ts, this function:
 *  1. Enforces the Spot-Lock guard (no futures symbols)
 *  2. Validates timeframes against the EWA-approved set
 *  3. Returns richer metadata (is_closed flag, latest_closed_bar)
 *  4. Hard-codes to api.binance.com (cannot be redirected to futures endpoints)
 *  5. Excludes the currently-forming (incomplete) candle from the result
 *     to prevent false pivot detection on partial bars
 */
export async function fetchEWABars(req: EWAFetcherRequest): Promise<EWAFetcherResult> {
  const { symbol, timeframe, limit } = req;

  // ── Step 1: Spot-Lock and EWA timeframe validation (before sanitization) ──
  assertSpotSymbol(symbol);
  assertEWATimeframe(timeframe);

  // ── Step 2: Strict input sanitization (VULN-08 compliance) ───────────────
  const safeSymbol    = sanitizeSymbol(symbol);
  const safeTimeframe = sanitizeInterval(timeframe);

  // Fetch one extra bar so we can always strip the forming candle
  // and still return the requested `limit` of CLOSED bars.
  const fetchLimit = Math.min(Math.max(1, Math.floor(limit)) + 1, BINANCE_MAX_LIMIT);

  if (limit > BINANCE_MAX_LIMIT - 1) {
    console.warn(
      `[EWA-FETCHER] Requested ${limit} bars exceeds max ${BINANCE_MAX_LIMIT - 1}. ` +
      `Capping at ${BINANCE_MAX_LIMIT - 1}.`
    );
  }

  // ── Step 3: Build URL with URLSearchParams (prevents param injection) ─────
  const params = new URLSearchParams({
    symbol:   safeSymbol,
    interval: safeTimeframe,
    limit:    String(fetchLimit),
  });

  // SPOT-LOCK: URL is hardcoded — no dynamic base URL, no environment override
  const url = `${BINANCE_SPOT_BASE}/klines?${params}`;

  // ── Step 4: Fetch with timeout ─────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let raw: unknown[][];
  try {
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: {
        // Identify ourselves — Binance may block anonymous UA in future
        'User-Agent': 'CryptoTerminal360-EWA/1.0',
        'Accept':     'application/json',
      },
      // Next.js: do NOT cache — EWA needs fresh OHLCV on every call
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `[EWA-FETCHER] Binance Spot API error ${res.status}: ${body.slice(0, 200)}`
      );
    }

    raw = (await res.json()) as unknown[][];
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(
        `[EWA-FETCHER] Binance request timed out after ${FETCH_TIMEOUT_MS}ms. ` +
        `Symbol: ${safeSymbol}, TF: ${safeTimeframe}`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      `[EWA-FETCHER] Binance returned empty data for ${safeSymbol} ${safeTimeframe}.`
    );
  }

  // ── Step 5: Parse raw kline arrays into typed OHLCVBar objects ───────────
  // Binance kline format: [openTime, open, high, low, close, volume,
  //   closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]
  const nowMs      = Date.now();
  const allBars: OHLCVBar[] = raw.map((k) => {
    const openTimeMs  = Number(k[0]);
    const closeTimeMs = Number(k[6]);
    return {
      t:         Math.floor(openTimeMs  / 1000),
      o:         parseFloat(k[1] as string),
      h:         parseFloat(k[2] as string),
      l:         parseFloat(k[3] as string),
      c:         parseFloat(k[4] as string),
      v:         parseFloat(k[5] as string),
      tc:        Math.floor(closeTimeMs / 1000),
      // A bar is "closed" when its close time is in the past
      is_closed: closeTimeMs < nowMs,
    };
  });

  // ── Step 6: Strip the forming (incomplete) candle ─────────────────────────
  // The last bar from Binance is the CURRENTLY OPEN candle.
  // Its high/low/close values will change until the bar closes.
  // Pivot detection on a partial bar produces false peaks/valleys.
  const closedBars = allBars.filter((b) => b.is_closed);

  // Return exactly `limit` closed bars (latest first = last in array)
  const bars = closedBars.slice(-Math.min(limit, closedBars.length));

  const fetched_at = Math.floor(nowMs / 1000);

  return {
    bars,
    symbol:            safeSymbol,
    timeframe:         safeTimeframe,
    fetched_at,
    bar_count:         bars.length,
    latest_closed_bar: bars.length > 0 ? bars[bars.length - 1] : null,
  };
}

// ─── Dual-Timeframe Fetcher (for MTF State Machine) ──────────────────────────

export interface DualTFRequest {
  symbol:     string;
  macro_tf:   string;   // Higher timeframe (e.g. "1d")
  micro_tf:   string;   // Lower timeframe  (e.g. "1h")
  macro_limit: number;  // Bars for macro analysis (e.g. 500)
  micro_limit: number;  // Bars for micro analysis (e.g. 300)
}

export interface DualTFResult {
  macro: EWAFetcherResult;
  micro: EWAFetcherResult;
  symbol: string;
  fetched_at: number;
}

/**
 * Fetches OHLCV for two timeframes concurrently for MTF Elliott Wave analysis.
 * Both fetches run in parallel (Promise.all) to minimize latency.
 * Both are independently Spot-locked and validated.
 *
 * If either fetch fails, the error propagates immediately — we never
 * return partial MTF data to the Elliott engine (it would produce
 * an invalid wave count with missing context).
 */
export async function fetchDualTFBars(req: DualTFRequest): Promise<DualTFResult> {
  const { symbol, macro_tf, micro_tf, macro_limit, micro_limit } = req;

  // Validate that macro TF > micro TF (basic sanity check)
  const TF_ORDER = ['15m', '1h', '4h', '1d', '3d', '1w'];
  const macroIdx = TF_ORDER.indexOf(macro_tf);
  const microIdx = TF_ORDER.indexOf(micro_tf);

  if (macroIdx !== -1 && microIdx !== -1 && macroIdx <= microIdx) {
    throw new Error(
      `[EWA-FETCHER] macro_tf "${macro_tf}" must be higher than micro_tf "${micro_tf}". ` +
      `Example: macro_tf="1d", micro_tf="1h".`
    );
  }

  // Concurrent fetch — both calls are fully independent and Spot-locked
  const [macro, micro] = await Promise.all([
    fetchEWABars({ symbol, timeframe: macro_tf, limit: macro_limit }),
    fetchEWABars({ symbol, timeframe: micro_tf, limit: micro_limit }),
  ]);

  return {
    macro,
    micro,
    symbol: macro.symbol,
    fetched_at: Math.floor(Date.now() / 1000),
  };
}

// ─── Validation helper (for unit tests and API input pre-check) ───────────────

/**
 * Pre-validates an EWA fetch request without making any network calls.
 * Use this in the API route to return fast 400 errors before touching Binance.
 */
export function validateEWARequest(
  symbol: string,
  macro_tf: string,
  micro_tf: string,
): { valid: boolean; error?: string } {
  try {
    assertSpotSymbol(symbol);
    assertEWATimeframe(macro_tf);
    assertEWATimeframe(micro_tf);
    sanitizeSymbol(symbol);
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: (err as Error).message };
  }
}
