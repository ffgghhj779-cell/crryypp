import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/klines?symbol=XAUUSD&interval=1h&limit=100
 *
 * Unified klines proxy:
 *  - Crypto (BTCUSDT …)   → Binance REST API
 *  - Gold   (XAUUSD)      → Stooq: gc.f (daily, free, no-auth)
 *  - Oil    (WTIUSD)      → Stooq: cl.f
 *  - FX     (USDEGP)      → Stooq: usdegp
 *  - EgyGold (EGYXAU)     → Calculated from GC=F × USD/EGP × (21/24)/31.1035
 *  - Brent  (BRENTUSD)    → Stooq: co.f
 */

export const runtime = 'nodejs';

// ── Commodity symbol → Stooq ticker ─────────────────────────────────────────
const STOOQ_MAP: Record<string, string> = {
  XAUUSD:   'gc.f',
  WTIUSD:   'cl.f',
  BRENTUSD: 'co.f',
  USDEGP:   'usdegp',
};
const COMMODITY_SYMBOLS = [...Object.keys(STOOQ_MAP), 'EGYXAU'];

interface KlineBar {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

// ── Parse Stooq CSV ───────────────────────────────────────────────────────────
function parseStooqCSV(csv: string): KlineBar[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  // Header: Date,Open,High,Low,Close,Volume
  const bars: KlineBar[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(',');
    if (cols.length < 5) continue;
    const [dateStr, open, high, low, close, volume] = cols;
    if (!dateStr || dateStr === 'N/D') continue;
    // Parse date: YYYY-MM-DD
    const ts = Math.floor(new Date(dateStr).getTime() / 1000);
    if (isNaN(ts) || ts <= 0) continue;
    const bar: KlineBar = {
      time:   ts,
      open:   parseFloat(open)   || 0,
      high:   parseFloat(high)   || 0,
      low:    parseFloat(low)    || 0,
      close:  parseFloat(close)  || 0,
      volume: parseFloat(volume) || 0,
    };
    if (bar.close > 0) bars.push(bar);
  }
  return bars.sort((a, b) => a.time - b.time);
}

// ── Fetch from Stooq ──────────────────────────────────────────────────────────
async function fetchStooqKlines(stooqSymbol: string, limit: number): Promise<KlineBar[]> {
  // Calculate date range — request 3× limit to ensure we get enough bars
  const days   = Math.max(limit * 2, 400); // request at least 400 days
  const toDate  = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);

  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&d1=${fmt(fromDate)}&d2=${fmt(toDate)}&i=d`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/csv,text/csv,*/*',
      'Referer': 'https://stooq.com',
    },
    next: { revalidate: 3600 }, // cache 1h
  });

  if (!res.ok) throw new Error(`Stooq error ${res.status} for ${stooqSymbol}`);
  const text = await res.text();
  if (text.trim().startsWith('<') || text.includes('No data')) {
    throw new Error(`Stooq returned no data for ${stooqSymbol}`);
  }

  const bars = parseStooqCSV(text);
  if (bars.length === 0) throw new Error(`Empty Stooq data for ${stooqSymbol}`);
  return bars.slice(-limit);
}

// ── Egyptian Gold: Synthetic OHLCV ───────────────────────────────────────────
async function fetchEgyptianGoldKlines(limit: number): Promise<KlineBar[]> {
  const [xauBars, egpBars] = await Promise.all([
    fetchStooqKlines('gc.f',    limit + 20),
    fetchStooqKlines('usdegp',  limit + 20),
  ]);

  // Build EGP rate map (date → rate)
  const egpMap = new Map<string, number>();
  for (const b of egpBars) {
    const key = new Date(b.time * 1000).toISOString().slice(0, 10);
    egpMap.set(key, b.close);
  }

  // Calculate Egyptian gold 21k in EGP per gram
  const bars: KlineBar[] = xauBars
    .map(xauBar => {
      const dateKey = new Date(xauBar.time * 1000).toISOString().slice(0, 10);
      // Find EGP rate for this date (or nearest previous)
      let egpRate = egpMap.get(dateKey);
      if (!egpRate) {
        // Search backwards for nearest available rate
        const sortedDates = [...egpMap.keys()].sort();
        for (let d = sortedDates.length - 1; d >= 0; d--) {
          if (sortedDates[d] <= dateKey) { egpRate = egpMap.get(sortedDates[d]); break; }
        }
        egpRate ??= 50.85; // absolute fallback
      }

      const factor = egpRate / 31.1035 * (21 / 24);
      return {
        time:   xauBar.time,
        open:   Math.round(xauBar.open   * factor),
        high:   Math.round(xauBar.high   * factor),
        low:    Math.round(xauBar.low    * factor),
        close:  Math.round(xauBar.close  * factor),
        volume: xauBar.volume,
      };
    })
    .filter(b => b.close > 0);

  return bars.slice(-limit);
}

// ── Fetch from Binance ────────────────────────────────────────────────────────
async function fetchBinanceKlines(symbol: string, interval: string, limit: number): Promise<KlineBar[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error(`Binance error ${res.status}`);
  const raw: any[][] = await res.json();
  return raw.map(k => ({
    time:   Math.floor(Number(k[0]) / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol   = (searchParams.get('symbol')   ?? 'BTCUSDT').toUpperCase().trim();
  const interval = (searchParams.get('interval') ?? '1d').toLowerCase().trim();
  const limit    = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)), 1000);

  try {
    let bars: KlineBar[];

    if (symbol === 'EGYXAU') {
      bars = await fetchEgyptianGoldKlines(limit);
    } else if (STOOQ_MAP[symbol]) {
      // Commodities via Stooq (daily data — best available free source)
      bars = await fetchStooqKlines(STOOQ_MAP[symbol], limit);
    } else {
      // Crypto → Binance
      bars = await fetchBinanceKlines(symbol, interval, limit);
    }

    return NextResponse.json(bars, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('[/api/klines]', symbol, err.message);
    return NextResponse.json(
      { error: err.message ?? 'Failed to fetch klines' },
      { status: 502 }
    );
  }
}
