// ─── Binance Public Klines Fetcher ────────────────────────────────────────────
// Thick-client engine: runs entirely in the browser, zero server latency.
// Endpoint: GET https://api.binance.com/api/v3/klines
// Commodities: routed via /api/klines proxy (Yahoo Finance)

export interface Kline {
  time:   number; // Unix seconds (open time)
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
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

/** Commodity symbols — routed to /api/klines proxy instead of Binance */
const COMMODITY_SYMBOLS = new Set(['XAUUSD', 'WTIUSD', 'USDEGP', 'EGYXAU', 'BRENTUSD']);

/**
 * Normalises a UI timeframe label (e.g. "1H", "4H", "1D") to the Binance
 * interval string (e.g. "1h", "4h", "1d").
 */
function normaliseInterval(interval: string): string {
  if (/^\d+[mhdwM]$/.test(interval)) return interval;
  return interval.toLowerCase();
}

/**
 * Fetches OHLCV kline data.
 * - Crypto symbols → Binance REST API (direct browser fetch)
 * - Commodity symbols (XAUUSD, WTIUSD, USDEGP, EGYXAU) → /api/klines proxy
 */
export async function fetchKlines(
  symbol:   string,
  interval: string,
  limit:    number = 100,
): Promise<Kline[]> {
  const upperSymbol  = symbol.toUpperCase().trim();
  const clampedLimit = Math.min(Math.max(1, limit), 1000);
  const normInterval = normaliseInterval(interval);

  // ── Commodity path ─────────────────────────────────────────────────────
  if (COMMODITY_SYMBOLS.has(upperSymbol)) {
    const params = new URLSearchParams({
      symbol:   upperSymbol,
      interval: normInterval,
      limit:    String(clampedLimit),
    });
    let res: Response;
    try {
      res = await fetch(`/api/klines?${params}`, { cache: 'no-store' });
    } catch {
      throw new Error('Network error — check your connection and try again.');
    }
    if (!res.ok) throw new Error(`Commodity klines error: HTTP ${res.status}`);
    const bars: Kline[] = await res.json();
    if (!Array.isArray(bars) || bars.length === 0) {
      throw new Error(`No commodity data for "${upperSymbol}".`);
    }
    return bars;
  }

  // ── Crypto path (original Binance logic) ───────────────────────────────
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

  return raw.map((k): Kline => ({
    time:   Math.floor(k[0] / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}
