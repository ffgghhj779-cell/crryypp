// ─── Binance Public Klines Fetcher ────────────────────────────────────────────
// Thick-client engine: runs entirely in the browser, zero server latency.
// Endpoint: GET https://api.binance.com/api/v3/klines
// Commodities: routed via /api/klines proxy (Twelve Data / GBM fallback)

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  color?: string;
  wickColor?: string;
  borderColor?: string;
  takerBuyVol?: number;
}

/** Raw tuple returned by Binance klines endpoint */
type RawKline = [
  number,  // 0  open time (ms)
  string,  // 1  open
  string,  // 2  high
  string,  // 3  low
  string,  // 4  close
  string,  // 5  volume
  number,  // 6  close time
  string,  // 7  quote asset volume
  number,  // 8  number of trades
  string,  // 9  taker buy base asset volume
  string,  // 10 taker buy quote asset volume
  string,  // 11 ignore
];

// ─── In-Memory Candle Cache ────────────────────────────────────────────────────
// Prevents hammering Twelve Data (800 req/day, 8 req/min) when multiple tools
// open the same asset. Lives for the lifetime of the browser tab.

interface CacheEntry { bars: Kline[]; expiresAt: number }
const _cache = new Map<string, CacheEntry>();

/** Cache TTL per interval (ms). Shorter intervals = fresher data needed. */
const INTERVAL_TTL_MS: Record<string, number> = {
  '1m':  60_000,         // 1 minute
  '5m':  2 * 60_000,     // 2 minutes
  '15m': 5 * 60_000,     // 5 minutes
  '30m': 10 * 60_000,    // 10 minutes
  '1h':  20 * 60_000,    // 20 minutes
  '2h':  30 * 60_000,    // 30 minutes
  '4h':  60 * 60_000,    // 1 hour
  '1d':  4 * 60 * 60_000, // 4 hours
  '1w':  24 * 60 * 60_000, // 24 hours
};

function cacheKey(symbol: string, interval: string, limit: number): string {
  return `${symbol}|${interval}|${limit}`;
}

function fromCache(key: string): Kline[] | null {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { _cache.delete(key); return null; }
  return e.bars;
}

function toCache(key: string, bars: Kline[], interval: string): void {
  const ttl = INTERVAL_TTL_MS[interval.toLowerCase()] ?? 20 * 60_000;
  _cache.set(key, { bars, expiresAt: Date.now() + ttl });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Commodity symbols — routed to /api/klines proxy instead of Binance */
const COMMODITY_SYMBOLS = new Set(['XAUUSD', 'WTIUSD', 'USDEGP', 'EGYXAU', 'BRENTUSD', 'EURUSD']);

/**
 * Normalises a UI timeframe label (e.g. "1H", "4H", "1D") to the Binance
 * interval string (e.g. "1h", "4h", "1d").
 */
function normaliseInterval(interval: string): string {
  if (/^\d+[mhdwM]$/.test(interval)) return interval;
  return interval.toLowerCase();
}

// ─── Main Fetch Function ───────────────────────────────────────────────────────

/**
 * Fetches OHLCV kline data with in-memory caching.
 * - Crypto symbols → Binance REST API (direct browser fetch)
 * - Commodity symbols (XAUUSD, WTIUSD, USDEGP, EGYXAU) → /api/klines proxy
 *   (Twelve Data real data → GBM fallback)
 *
 * Results are cached per (symbol, interval, limit) to avoid hitting
 * Twelve Data rate limits (800 req/day, 8 req/min) across multiple tools.
 */
export async function fetchKlines(
  symbol:   string,
  interval: string,
  limit:    number = 100,
): Promise<Kline[]> {
  const upperSymbol  = symbol.toUpperCase().trim();
  const clampedLimit = Math.min(Math.max(1, limit), 1000);
  const normInterval = normaliseInterval(interval);

  // ── Cache lookup ──────────────────────────────────────────────────────────
  const key    = cacheKey(upperSymbol, normInterval, clampedLimit);
  const cached = fromCache(key);
  if (cached) return cached;

  // ── Commodity path ─────────────────────────────────────────────────────────
  if (COMMODITY_SYMBOLS.has(upperSymbol)) {
    const params = new URLSearchParams({
      symbol:   upperSymbol,
      interval: normInterval,
      limit:    String(clampedLimit),
    });
    let res: Response;
    try {
      // Use default caching so Vercel edge cache serves repeated requests
      res = await fetch(`/api/klines?${params}`);
    } catch {
      throw new Error('Network error — check your connection and try again.');
    }
    if (!res.ok) throw new Error(`Commodity klines error: HTTP ${res.status}`);
    const bars: Kline[] = await res.json();
    if (!Array.isArray(bars) || bars.length === 0) {
      throw new Error(`No commodity data for "${upperSymbol}".`);
    }

    // Forex & Commodities often have 0 volume. We synthesize "Tick Volume"
    // proxy based on price volatility (High - Low) to prevent algorithms from crashing.
    bars.forEach(b => {
      if (!b.volume || b.volume === 0) {
        const range = b.high - b.low;
        // Scale factor: typical forex range is small (e.g., 0.0050 EURUSD)
        b.volume = Math.max(1, range * 10000); 
      }
    });

    toCache(key, bars, normInterval);
    return bars;
  }

  // ── Crypto path (original Binance logic) ───────────────────────────────────
  const url = [
    'https://api.binance.com/api/v3/klines',
    `?symbol=${encodeURIComponent(upperSymbol)}`,
    `&interval=${encodeURIComponent(normInterval)}`,
    `&limit=${clampedLimit}`,
  ].join('');

  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { msg?: string };
      if (body?.msg) detail = body.msg;
    } catch { /* ignore */ }
    throw new Error(`Binance API error: ${detail}`);
  }

  const raw: RawKline[] = await res.json();

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`No data returned for symbol "${symbol}". Verify the pair is listed on Binance.`);
  }

  const bars = raw.map((k): Kline => ({
    time:   Math.floor(k[0] / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
    takerBuyVol: parseFloat(k[9]),
  }));

  toCache(key, bars, normInterval);
  return bars;
}

/**
 * Invalidates cache for a specific symbol (all intervals/limits).
 * Call when the user forces a refresh.
 */
export function invalidateCache(symbol: string): void {
  const prefix = symbol.toUpperCase().trim() + '|';
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
}
