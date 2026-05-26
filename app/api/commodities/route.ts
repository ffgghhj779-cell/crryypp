import { NextResponse } from 'next/server';

/**
 * GET /api/commodities
 * Multi-source commodities fetcher with fallback chain:
 *  Gold:    metals.live → Yahoo Finance → fallback
 *  Oil:     EIA / Yahoo Finance → fallback
 *  USD/EGP: exchangerate-api → Yahoo Finance → fallback
 */

export const runtime = 'nodejs';

const TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// ─── Source 1: metals.live (free, no auth, works on Vercel) ──────────────────
async function fetchGoldFromMetalsLive(): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await withTimeout(
      fetch('https://api.metals.live/v1/spot', {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 },
      }),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    // returns array of { gold, silver, ... } or object
    const arr = Array.isArray(data) ? data : [data];
    const gold = arr[0]?.gold;
    if (!gold) return null;
    return { price: Number(gold), changePct: 0 };
  } catch {
    return null;
  }
}

// ─── Source 2: Yahoo Finance v8 ───────────────────────────────────────────────
async function fetchYahoo(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const res = await withTimeout(
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com',
        },
        next: { revalidate: 60 },
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

// ─── Source 3: Yahoo Finance v7 (alternative endpoint) ───────────────────────
async function fetchYahooV7(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const res = await withTimeout(
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'Accept': 'application/json',
        },
        next: { revalidate: 60 },
      }),
      TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json();
    const quote = data?.quoteResponse?.result?.[0];
    if (!quote) return null;
    return {
      price:     quote.regularMarketPrice  ?? 0,
      changePct: quote.regularMarketChangePercent ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Source 4: exchangerate.host for USD/EGP ─────────────────────────────────
async function fetchUsdEgp(): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await withTimeout(
      fetch('https://api.exchangerate.host/latest?base=USD&symbols=EGP', {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 },
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

// ─── Source 5: Open Exchange Rates (free tier) for USD/EGP ───────────────────
async function fetchUsdEgpFallback(): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await withTimeout(
      fetch('https://open.er-api.com/v6/latest/USD', {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 },
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

// ─── Scrape Egyptian gold price ───────────────────────────────────────────────
async function scrapeEgyptianGold(): Promise<number | null> {
  const sources = [
    {
      url: 'https://egygold.com.eg/',
      patterns: [/عيار\s*21[^0-9]*?([\d,]+)/, /21\s*عيار[^0-9]*?([\d,]+)/],
    },
    {
      url: 'https://gold-api.com/prices/EGP',
      patterns: [/"karat21"[^0-9]*?([\d,.]+)/, /"21k"[^0-9]*?([\d,.]+)/],
    },
  ];

  for (const source of sources) {
    try {
      const res = await withTimeout(
        fetch(source.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          next: { revalidate: 120 },
        }),
        TIMEOUT_MS
      );
      if (!res.ok) continue;
      const text = await res.text();
      for (const pat of source.patterns) {
        const m = text.match(pat);
        if (m) {
          const price = parseFloat(m[1].replace(/,/g, ''));
          if (price > 1000 && price < 200000) return price;
        }
      }
    } catch { /* try next */ }
  }
  return null;
}

function calcEgyptianGold(xauUsd: number, usdEgp: number): number {
  // 1 oz = 31.1035g, 21-karat = 21/24 purity
  return Math.round((xauUsd / 31.1035) * usdEgp * (21 / 24));
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  // Run all fetches in parallel
  const [
    goldMetals,
    goldYahoo,
    goldYahooV7,
    oilYahoo,
    oilYahooV7,
    egpYahoo,
    egpYahooV7,
    egpOpen,
    scrapedGold,
  ] = await Promise.all([
    fetchGoldFromMetalsLive(),
    fetchYahoo('GC=F'),
    fetchYahooV7('GC=F'),
    fetchYahoo('CL=F'),
    fetchYahooV7('CL=F'),
    fetchYahoo('USDEGP=X'),
    fetchYahooV7('USDEGP=X'),
    fetchUsdEgpFallback(),
    scrapeEgyptianGold(),
  ]);

  // Pick best available gold price
  const gold = goldMetals ?? goldYahoo ?? goldYahooV7 ?? { price: 3345, changePct: 0 };
  const oil  = oilYahoo  ?? oilYahooV7               ?? { price: 79.50, changePct: 0 };
  const usdEgp = egpYahoo ?? egpYahooV7 ?? egpOpen   ?? { price: 50.85, changePct: 0 };

  // Egyptian gold
  let egyptianGoldPrice  = scrapedGold;
  let egyptianGoldSource = 'scrape';
  if (!egyptianGoldPrice) {
    egyptianGoldPrice  = calcEgyptianGold(gold.price, usdEgp.price);
    egyptianGoldSource = 'calculated';
  }
  const egyptianGoldChangePct = (gold.changePct ?? 0) + (usdEgp.changePct ?? 0);

  const body = {
    gold: {
      symbol:    'XAU/USD',
      label:     'ذهب',
      price:     gold.price,
      changePct: gold.changePct,
      unit:      'USD/oz',
    },
    oil: {
      symbol:    'WTI',
      label:     'نفط',
      price:     oil.price,
      changePct: oil.changePct,
      unit:      'USD/bbl',
    },
    usdEgp: {
      symbol:    'USD/EGP',
      label:     'دولار/جنيه',
      price:     usdEgp.price,
      changePct: usdEgp.changePct,
    },
    egyptianGold: {
      symbol:    'XAU/EGP',
      label:     'ذهب مصري',
      price:     egyptianGoldPrice,
      changePct: egyptianGoldChangePct,
      karat:     21,
      unit:      'جنيه/جرام',
      source:    egyptianGoldSource,
    },
    timestamp: Date.now(),
    sources: {
      gold:   goldMetals ? 'metals.live' : goldYahoo ? 'yahoo-v8' : goldYahooV7 ? 'yahoo-v7' : 'fallback',
      oil:    oilYahoo ? 'yahoo-v8' : oilYahooV7 ? 'yahoo-v7' : 'fallback',
      usdEgp: egpYahoo ? 'yahoo-v8' : egpYahooV7 ? 'yahoo-v7' : egpOpen ? 'open-er' : 'fallback',
      egyptianGold: egyptianGoldSource,
    },
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    },
  });
}
