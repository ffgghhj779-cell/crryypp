import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/klines?symbol=XAUUSD&interval=1h&limit=100
 *
 * Unified klines proxy:
 *  - Crypto (BTCUSDT, ETHUSDT …) → Binance REST API
 *  - Gold   (XAUUSD)             → Yahoo Finance GC=F
 *  - Oil    (WTIUSD)             → Yahoo Finance CL=F
 *  - FX     (USDEGP)             → Yahoo Finance USDEGP=X
 *  - Egy.Gold (EGYXAU)           → Calculated from GC=F × USDEGP=X × (21/24) / 31.1035
 */

export const runtime = 'nodejs';

// ── Commodity symbol → Yahoo Finance ticker ────────────────────────────────
const YAHOO_MAP: Record<string, string> = {
  XAUUSD: 'GC=F',
  WTIUSD: 'CL=F',
  USDEGP: 'USDEGP=X',
  BRENTUSD: 'BZ=F',
};
const COMMODITY_SYMBOLS = [...Object.keys(YAHOO_MAP), 'EGYXAU'];

// ── Interval mapping: client → Yahoo Finance ───────────────────────────────
const YAHOO_INTERVAL: Record<string, string> = {
  '1m': '1m', '3m': '2m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '1h', '4h': '1h', '6h': '1h', '8h': '1h',
  '12h': '1h', '1d': '1d', '3d': '1d', '1w': '1wk', '1M': '1mo',
};

// ── Range based on interval ────────────────────────────────────────────────
function yahooRange(interval: string, limit: number): string {
  const mins: Record<string, number> = {
    '1m': 1, '2m': 2, '5m': 5, '15m': 15, '30m': 30,
    '1h': 60, '1d': 1440, '1wk': 10080, '1mo': 43200,
  };
  const intervalMins = mins[interval] ?? 60;
  const totalMins    = intervalMins * limit * 1.5; // 1.5× buffer
  if (totalMins <= 60 * 24 * 7)   return '7d';
  if (totalMins <= 60 * 24 * 30)  return '1mo';
  if (totalMins <= 60 * 24 * 90)  return '3mo';
  if (totalMins <= 60 * 24 * 180) return '6mo';
  if (totalMins <= 60 * 24 * 365) return '1y';
  return '2y';
}

interface KlineBar {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

// ── Fetch from Yahoo Finance ───────────────────────────────────────────────
async function fetchYahooKlines(yahooSymbol: string, interval: string, limit: number): Promise<KlineBar[]> {
  const range = yahooRange(interval, limit);
  const url   = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept':     'application/json',
      'Referer':    'https://finance.yahoo.com',
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`Yahoo Finance error ${res.status} for ${yahooSymbol}`);

  const data   = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${yahooSymbol}`);

  const timestamps = result.timestamp as number[];
  const ohlcv      = result.indicators?.quote?.[0];
  if (!timestamps || !ohlcv) throw new Error(`Empty OHLCV for ${yahooSymbol}`);

  const bars: KlineBar[] = timestamps
    .map((t, i) => ({
      time:   t,
      open:   ohlcv.open[i]   ?? ohlcv.close[i] ?? 0,
      high:   ohlcv.high[i]   ?? ohlcv.close[i] ?? 0,
      low:    ohlcv.low[i]    ?? ohlcv.close[i] ?? 0,
      close:  ohlcv.close[i]  ?? 0,
      volume: ohlcv.volume[i] ?? 0,
    }))
    .filter(b => b.close > 0);

  // Downsample 4H: take every 4th bar when client asks for 4h but Yahoo returns 1h
  return bars.slice(-limit);
}

// ── Fetch from Binance ─────────────────────────────────────────────────────
async function fetchBinanceKlines(symbol: string, interval: string, limit: number): Promise<KlineBar[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(String(limit))}`;
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

// ── Egyptian Gold: Calculate synthetic OHLCV ──────────────────────────────
async function fetchEgyptianGoldKlines(interval: string, limit: number): Promise<KlineBar[]> {
  const yahooInterval = YAHOO_INTERVAL[interval] ?? '1h';
  const [xauBars, egpBars] = await Promise.all([
    fetchYahooKlines('GC=F',      yahooInterval, limit + 50),
    fetchYahooKlines('USDEGP=X',  yahooInterval, limit + 50),
  ]);

  // Align by timestamp (nearest)
  const egpMap = new Map(egpBars.map(b => [b.time, b.close]));

  const bars: KlineBar[] = xauBars
    .map(xauBar => {
      // Find nearest EGP rate (within ±1 bar)
      const egpRate = egpMap.get(xauBar.time)
        ?? egpMap.get(xauBar.time - 3600)
        ?? egpMap.get(xauBar.time + 3600)
        ?? 50.85; // fallback

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

// ── Main handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol   = (searchParams.get('symbol')   ?? 'BTCUSDT').toUpperCase().trim();
  const interval = (searchParams.get('interval') ?? '1h').toLowerCase().trim();
  const limit    = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)), 1000);

  try {
    let bars: KlineBar[];

    if (symbol === 'EGYXAU') {
      bars = await fetchEgyptianGoldKlines(interval, limit);
    } else if (YAHOO_MAP[symbol]) {
      const yahooInterval = YAHOO_INTERVAL[interval] ?? '1h';
      bars = await fetchYahooKlines(YAHOO_MAP[symbol], yahooInterval, limit);
    } else {
      // Crypto → Binance
      bars = await fetchBinanceKlines(symbol, interval, limit);
    }

    return NextResponse.json(bars, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to fetch klines' },
      { status: 502 }
    );
  }
}
