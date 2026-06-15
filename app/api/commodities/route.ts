import { NextResponse } from 'next/server';

/**
 * GET /api/commodities
 * Multi-source fetcher with robust fallback chain:
 *  Gold:    metals.live → Yahoo v8 → Yahoo v7 → hardcoded fallback
 *  Oil:     Yahoo v8 → Yahoo v7 → EIA → hardcoded fallback
 *  USD/EGP: open.er-api → exchangerate-api → Yahoo → fallback
 *  EUR/USD: exchangerate-api → open.er-api → Yahoo → fallback
 */

export const runtime = 'nodejs';

const TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// ─── Gold via metals.live ─────────────────────────────────────────────────────
async function fetchGoldFromMetalsLive(): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await withTimeout(
      fetch('https://api.metals.live/v1/spot', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [data];
    const gold = arr[0]?.gold;
    if (!gold) return null;
    return { price: Number(gold), changePct: 0 };
  } catch {
    return null;
  }
}

// ─── Gold via gold-api.com (free, has changePct) ─────────────────────────────
async function fetchGoldFromGoldApi(): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await withTimeout(
      fetch('https://api.gold-api.com/price/XAU', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = Number(data?.price ?? data?.Price);
    const chp   = Number(data?.chp ?? data?.change_pct ?? 0);
    if (!price || price < 100) return null;
    return { price, changePct: chp };
  } catch {
    return null;
  }
}

// ─── Yahoo Finance v8 ─────────────────────────────────────────────────────────
async function fetchYahooV8(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const res = await withTimeout(
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://finance.yahoo.com',
        },
        cache: 'no-store',
      }),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price     = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    const prevClose = meta.chartPreviousClose  ?? meta.previousClose ?? price;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, changePct };
  } catch {
    return null;
  }
}

// ─── Yahoo Finance v7 ─────────────────────────────────────────────────────────
async function fetchYahooV7(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const res = await withTimeout(
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          Accept: 'application/json',
        },
        cache: 'no-store',
      }),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const quote = data?.quoteResponse?.result?.[0];
    if (!quote) return null;
    return {
      price:     quote.regularMarketPrice          ?? 0,
      changePct: quote.regularMarketChangePercent  ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── USD/EGP from open.er-api.com ────────────────────────────────────────────
async function fetchUsdEgpFromOpenEr(): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await withTimeout(
      fetch('https://open.er-api.com/v6/latest/USD', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.EGP;
    if (!rate) return null;
    return { price: Number(rate), changePct: 0 };
  } catch {
    return null;
  }
}

// ─── EUR/USD from open.er-api.com ─────────────────────────────────────────────
async function fetchEurUsdFromOpenEr(): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await withTimeout(
      fetch('https://open.er-api.com/v6/latest/EUR', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.USD;
    if (!rate) return null;
    return { price: Number(rate), changePct: 0 };
  } catch {
    return null;
  }
}

function calcEgyptianGold(xauUsd: number, usdEgp: number): number {
  return Math.round((xauUsd / 31.1035) * usdEgp * (21 / 24));
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const [
    goldGoldApi,
    goldMetals,
    goldYahooV8,
    goldYahooV7,
    oilYahooV8,
    oilYahooV7,
    egpOpenEr,
    egpYahooV8,
    egpYahooV7,
    eurOpenEr,
    eurYahooV8,
    eurYahooV7,
  ] = await Promise.all([
    fetchGoldFromGoldApi(),
    fetchGoldFromMetalsLive(),
    fetchYahooV8('GC=F'),
    fetchYahooV7('GC=F'),
    fetchYahooV8('CL=F'),
    fetchYahooV7('CL=F'),
    fetchUsdEgpFromOpenEr(),
    fetchYahooV8('USDEGP=X'),
    fetchYahooV7('USDEGP=X'),
    fetchEurUsdFromOpenEr(),
    fetchYahooV8('EURUSD=X'),
    fetchYahooV7('EURUSD=X'),
  ]);

  // Pick best gold — gold-api has changePct, prefer it
  const gold   = goldGoldApi  ?? goldMetals  ?? goldYahooV8 ?? goldYahooV7 ?? { price: 3345, changePct: 0 };
  const oil    = oilYahooV8   ?? oilYahooV7  ?? { price: 79.50, changePct: 0 };
  const usdEgp = egpOpenEr    ?? egpYahooV8  ?? egpYahooV7  ?? { price: 50.85, changePct: 0 };
  const eurUsd = eurOpenEr    ?? eurYahooV8  ?? eurYahooV7  ?? { price: 1.0850, changePct: 0 };

  // Egyptian gold = XAU/USD × USD/EGP rate × 21k factor
  const egyptianGoldPrice   = calcEgyptianGold(gold.price, usdEgp.price);
  const egyptianGoldChangePct = (gold.changePct ?? 0) + (usdEgp.changePct ?? 0);

  const body = {
    gold: {
      symbol:    'XAU/USD',
      price:     gold.price,
      changePct: gold.changePct,
      unit:      'USD/oz',
    },
    oil: {
      symbol:    'WTI',
      price:     oil.price,
      changePct: oil.changePct,
      unit:      'USD/bbl',
    },
    usdEgp: {
      symbol:    'USD/EGP',
      price:     usdEgp.price,
      changePct: usdEgp.changePct,
    },
    eurUsd: {
      symbol:    'EUR/USD',
      price:     eurUsd.price,
      changePct: eurUsd.changePct,
    },
    egyptianGold: {
      symbol:    'XAU/EGP',
      price:     egyptianGoldPrice,
      changePct: egyptianGoldChangePct,
      karat:     21,
      unit:      'جنيه/جرام',
      source:    'calculated',
    },
    timestamp: Date.now(),
    sources: {
      gold:   goldGoldApi ? 'gold-api.com' : goldMetals ? 'metals.live' : goldYahooV8 ? 'yahoo-v8' : goldYahooV7 ? 'yahoo-v7' : 'fallback',
      oil:    oilYahooV8 ? 'yahoo-v8' : oilYahooV7 ? 'yahoo-v7' : 'fallback',
      usdEgp: egpOpenEr ? 'open.er-api' : egpYahooV8 ? 'yahoo-v8' : egpYahooV7 ? 'yahoo-v7' : 'fallback',
      eurUsd: eurOpenEr ? 'open.er-api' : eurYahooV8 ? 'yahoo-v8' : eurYahooV7 ? 'yahoo-v7' : 'fallback',
    },
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    },
  });
}
