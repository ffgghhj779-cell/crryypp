import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/klines?symbol=XAUUSD&interval=1h&limit=100
 *
 * Data source priority:
 *  1. Twelve Data (real historical OHLCV) — if TWELVEDATA_API_KEY is set
 *  2. GBM synthetic anchored to real spot price — fallback (no API key needed)
 *
 * Crypto → Binance (direct, always free)
 */

export const runtime = 'nodejs';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

interface KlineBar {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

// ── Twelve Data symbol mapping ────────────────────────────────────────────────
const TD_SYMBOL: Record<string, string> = {
  XAUUSD:   'XAU/USD',
  WTIUSD:   'WTI/USD',
  BRENTUSD: 'BRN/USD',
  USDEGP:   'USD/EGP',
  EURUSD:   'EUR/USD',
};

// Twelve Data interval mapping (our format → TD format)
function toTDInterval(interval: string): string {
  const map: Record<string, string> = {
    '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
    '1h': '1h', '2h': '2h', '4h': '4h',
    '1d': '1day', '1w': '1week',
  };
  return map[interval.toLowerCase()] ?? '1day';
}

// ── Twelve Data fetcher ───────────────────────────────────────────────────────
async function fetchTwelveDataOnce(params: URLSearchParams): Promise<Response | null> {
  try {
    return await withTimeout(
      fetch(
        `https://api.twelvedata.com/time_series?${params}`,
        { next: { revalidate: 3600 } },
      ),
      8000
    );
  } catch (err: any) {
    console.error('[Twelve Data] fetch error:', err.message);
    return null;
  }
}

async function fetchTwelveData(
  symbol: string, interval: string, limit: number,
): Promise<KlineBar[] | null> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return null;

  const tdSymbol = TD_SYMBOL[symbol.toUpperCase()];
  if (!tdSymbol) return null;

  const params = new URLSearchParams({
    symbol:     tdSymbol,
    interval:   toTDInterval(interval),
    outputsize: String(Math.min(limit, 5000)),
    apikey:     apiKey,
    format:     'JSON',
    order:      'ASC',
  });

  let res = await fetchTwelveDataOnce(params);

  // 429 Rate limit — wait 2 seconds and retry once
  if (res && res.status === 429) {
    console.warn('[Twelve Data] Rate limited — retrying in 2s...');
    await new Promise(r => setTimeout(r, 2000));
    res = await fetchTwelveDataOnce(params);
  }

  if (!res || !res.ok) {
    console.warn(`[Twelve Data] HTTP ${res?.status ?? 'null'} for ${tdSymbol}`);
    return null;
  }

  try {
    const json = await res.json();
    if (json.status === 'error' || json.code) {
      console.warn(`[Twelve Data] API error: ${json.message}`);
      return null;
    }
    const values: Array<{
      datetime: string;
      open: string; high: string; low: string; close: string; volume?: string;
    }> = json.values ?? [];

    if (!Array.isArray(values) || values.length === 0) return null;

    return values.map(v => ({
      time:   Math.floor(new Date(v.datetime).getTime() / 1000),
      open:   parseFloat(v.open),
      high:   parseFloat(v.high),
      low:    parseFloat(v.low),
      close:  parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : 1000,
    }));
  } catch (err: any) {
    console.error('[Twelve Data] parse error:', err.message);
    return null;
  }
}

// ── Egyptian Gold via Twelve Data ─────────────────────────────────────────────
async function fetchEGYXAUViaTwelveData(
  interval: string, limit: number,
): Promise<KlineBar[] | null> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return null;

  // Fetch Gold + USD/EGP concurrently
  const [goldBars, egpBars] = await Promise.all([
    fetchTwelveData('XAUUSD', interval, limit),
    fetchTwelveData('USDEGP', interval, limit),
  ]);

  if (!goldBars || !egpBars || goldBars.length === 0 || egpBars.length === 0) {
    return null;
  }

  // Align by time — use gold bars as reference
  const egpMap = new Map<number, number>();
  egpBars.forEach(b => egpMap.set(b.time, b.close));

  const result: KlineBar[] = [];
  for (const gold of goldBars) {
    const egpRate = egpMap.get(gold.time);
    if (!egpRate) continue;
    // Gold per gram 21-karat in EGP: (XAU/oz × USD/EGP × 21/24) / 31.1035
    const factor = egpRate * (21 / 24) / 31.1035;
    result.push({
      time:   gold.time,
      open:   +(gold.open  * factor).toFixed(2),
      high:   +(gold.high  * factor).toFixed(2),
      low:    +(gold.low   * factor).toFixed(2),
      close:  +(gold.close * factor).toFixed(2),
      volume: gold.volume,
    });
  }
  return result.length > 0 ? result : null;
}

// ── Seeded GBM fallback ───────────────────────────────────────────────────────
function makePRNG(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function symbolSeed(symbol: string): number {
  const dayKey = Math.floor(Date.now() / 86_400_000);
  return symbol.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), dayKey);
}

const DAILY_VOL: Record<string, number> = {
  XAUUSD: 0.008, WTIUSD: 0.022, BRENTUSD: 0.022, USDEGP: 0.003, EGYXAU: 0.009, EURUSD: 0.005,
};

const TF_SECONDS: Record<string, number> = {
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800,
};

function generateOHLCV(
  currentPrice: number, limit: number, symbol: string, interval: string,
): KlineBar[] {
  const rng      = makePRNG(symbolSeed(symbol));
  const vol      = DAILY_VOL[symbol] ?? 0.01;
  const tfSec    = TF_SECONDS[interval.toLowerCase()] ?? 86400;
  const barVol   = vol * Math.sqrt(tfSec / 86400);

  const closes: number[] = [currentPrice];
  for (let i = 0; i < limit; i++) {
    const u1  = Math.max(1e-10, rng());
    const z   = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
    closes.push(closes[closes.length - 1] * Math.exp(-z * barVol));
  }
  closes.reverse();

  const now  = Math.floor(Date.now() / 1000);
  const bars: KlineBar[] = [];
  for (let i = 0; i < limit; i++) {
    const open  = closes[i];
    const close = closes[i + 1];
    const iv    = barVol * 0.5;
    bars.push({
      time:   now - (limit - 1 - i) * tfSec,
      open:   +open.toFixed(6),
      high:   +(Math.max(open, close) * (1 + Math.abs(rng() - 0.5) * iv * 2)).toFixed(6),
      low:    +(Math.min(open, close) * (1 - Math.abs(rng() - 0.5) * iv * 2)).toFixed(6),
      close:  +close.toFixed(6),
      volume: +(500 + rng() * 9500).toFixed(2),
    });
  }
  return bars;
}

// ── Spot price fetchers (used by GBM fallback) ────────────────────────────────
async function fetchGoldSpot(): Promise<number | null> {
  try {
    const res = await withTimeout(
      fetch('https://api.metals.live/v1/spot', {
        headers: { Accept: 'application/json' }, next: { revalidate: 120 },
      }),
      5000
    );
    if (res.ok) {
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : [data];
      const gold = arr[0]?.gold;
      if (gold && Number(gold) > 100) return Number(gold);
    }
  } catch {}
  return null;
}

async function fetchUsdEgpRate(): Promise<number | null> {
  try {
    const res = await withTimeout(
      fetch(
        'https://query2.finance.yahoo.com/v7/finance/quote?symbols=USDEGP=X',
        { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          next: { revalidate: 120 } },
      ),
      5000
    );
    if (res.ok) {
      const data  = await res.json();
      const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (price && price > 1) return price;
    }
  } catch {}

  try {
    const res = await withTimeout(
      fetch('https://open.er-api.com/v6/latest/USD', {
        headers: { Accept: 'application/json' }, next: { revalidate: 3600 },
      }),
      5000
    );
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.EGP;
      if (rate && Number(rate) > 1) return Number(rate);
    }
  } catch {}
  return null;
}

async function fetchOilSpot(): Promise<number | null> {
  try {
    const res = await withTimeout(
      fetch(
        'https://query2.finance.yahoo.com/v7/finance/quote?symbols=CL=F',
        { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          next: { revalidate: 120 } },
      ),
      5000
    );
    if (res.ok) {
      const data  = await res.json();
      const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (price && price > 10) return price;
    }
  } catch {}
  return null;
}

async function fetchEurUsdRate(): Promise<number | null> {
  try {
    const res = await withTimeout(
      fetch(
        'https://query2.finance.yahoo.com/v7/finance/quote?symbols=EURUSD=X',
        { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          next: { revalidate: 120 } },
      ),
      5000
    );
    if (res.ok) {
      const data  = await res.json();
      const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (price && price > 0.5) return price;
    }
  } catch {}

  try {
    const res = await withTimeout(
      fetch('https://open.er-api.com/v6/latest/EUR', {
        headers: { Accept: 'application/json' }, next: { revalidate: 3600 },
      }),
      5000
    );
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.USD;
      if (rate && Number(rate) > 0.5) return Number(rate);
    }
  } catch {}
  return null;
}

async function fetchCommoditySpot(symbol: string): Promise<number> {
  switch (symbol) {
    case 'XAUUSD':   return (await fetchGoldSpot())   ?? 3340;
    case 'WTIUSD':   return (await fetchOilSpot())    ?? 79.5;
    case 'BRENTUSD': return (await fetchOilSpot())    ?? 82.0;
    case 'USDEGP':   return (await fetchUsdEgpRate()) ?? 50.85;
    case 'EURUSD':   return (await fetchEurUsdRate()) ?? 1.08;
    case 'EGYXAU': {
      const [g, e] = await Promise.all([fetchGoldSpot(), fetchUsdEgpRate()]);
      return +((g ?? 3340) / 31.1035 * (e ?? 50.85) * (21 / 24)).toFixed(2);
    }
    default: throw new Error(`Unknown commodity: ${symbol}`);
  }
}

// ── Binance (crypto) ──────────────────────────────────────────────────────────
async function fetchBinanceKlines(
  symbol: string, interval: string, limit: number,
): Promise<KlineBar[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await withTimeout(fetch(url, { next: { revalidate: 10 } }), 5000);
  if (!res.ok) throw new Error(`Binance error ${res.status}`);
  const raw: any[][] = await res.json();
  return raw.map(k => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: parseFloat(k[1]), high: parseFloat(k[2]),
    low:  parseFloat(k[3]), close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// ── Commodity symbols set ─────────────────────────────────────────────────────
const COMMODITY_SYMBOLS = new Set(['XAUUSD', 'WTIUSD', 'BRENTUSD', 'USDEGP', 'EGYXAU', 'EURUSD']);

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol   = (searchParams.get('symbol')   ?? 'BTCUSDT').toUpperCase().trim();
  const interval = (searchParams.get('interval') ?? '1d').toLowerCase().trim();
  const limit    = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)), 5000);

  try {
    let bars: KlineBar[];
    let source: string;

    if (COMMODITY_SYMBOLS.has(symbol)) {
      // ── Try Twelve Data first (real historical data) ──────────────────────
      const tdBars = symbol === 'EGYXAU'
        ? await fetchEGYXAUViaTwelveData(interval, limit)
        : await fetchTwelveData(symbol, interval, limit);

      if (tdBars && tdBars.length > 0) {
        bars   = tdBars;
        source = 'twelve-data';
      } else {
        // ── Fallback: GBM with real spot price ────────────────────────────
        const spotPrice = await fetchCommoditySpot(symbol);
        bars   = generateOHLCV(spotPrice, limit, symbol, interval);
        source = 'gbm-fallback';
      }
    } else {
      // ── Crypto: Binance ───────────────────────────────────────────────────
      bars   = await fetchBinanceKlines(symbol, interval, limit);
      source = 'binance';
    }

    return NextResponse.json(bars, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
        'X-Data-Source': source,
      },
    });
  } catch (err: any) {
    console.error('[/api/klines]', symbol, err.message);
    return NextResponse.json(
      { error: err.message ?? 'Failed to fetch klines' },
      { status: 502 },
    );
  }
}
