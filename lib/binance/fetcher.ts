// ─── Binance Public Klines Fetcher ────────────────────────────────────────────
// Thick-client engine: runs entirely in the browser, zero server latency.
// Endpoint: GET https://api.binance.com/api/v3/klines

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

/**
 * Normalises a UI timeframe label (e.g. "1H", "4H", "1D") to the Binance
 * interval string (e.g. "1h", "4h", "1d").
 * Binance is case-sensitive — all interval strings must be lowercase except 'M'.
 */
function normaliseInterval(interval: string): string {
  // Already valid Binance format (e.g. "1h", "4h", "1d", "15m")
  if (/^\d+[mhdwM]$/.test(interval)) return interval;
  // UI format: "1H" → "1h", "4H" → "4h", "1D" → "1d", "15m" stays
  return interval.toLowerCase();
}

/**
 * Fetches OHLCV kline data from the public Binance REST API.
 *
 * @param symbol   - Trading pair in UPPERCASE, e.g. "BTCUSDT"
 * @param interval - Binance interval string or UI label, e.g. "1h" | "1H" | "4H" | "1D" | "15m"
 * @param limit    - Number of candles to fetch (max 1000, Binance default 500)
 * @returns        - Strictly typed array of {@link Kline} objects
 * @throws         - `Error` with a user-friendly message on network or API failure
 */
export async function fetchKlines(
  symbol:   string,
  interval: string,
  limit:    number = 100,
): Promise<Kline[]> {
  const normalisedInterval = normaliseInterval(interval);
  const clampedLimit       = Math.min(Math.max(1, limit), 1000);

  const url = [
    'https://api.binance.com/api/v3/klines',
    `?symbol=${encodeURIComponent(symbol.toUpperCase())}`,
    `&interval=${encodeURIComponent(normalisedInterval)}`,
    `&limit=${clampedLimit}`,
  ].join('');

  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }

  if (!res.ok) {
    // Binance returns JSON error bodies like: { "code": -1121, "msg": "Invalid symbol." }
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { msg?: string };
      if (body?.msg) detail = body.msg;
    } catch { /* ignore parse errors */ }
    throw new Error(`Binance API error: ${detail}`);
  }

  const raw: RawKline[] = await res.json();

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`No data returned for symbol "${symbol}". Verify the pair is listed on Binance.`);
  }

  return raw.map((k): Kline => ({
    time:   Math.floor(k[0] / 1000), // ms → s
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}
