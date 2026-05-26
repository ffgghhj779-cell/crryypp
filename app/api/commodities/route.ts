import { NextResponse } from 'next/server';

/**
 * GET /api/commodities
 * Returns live prices for: XAU/USD, WTI Oil, USD/EGP
 * + calculates Egyptian Gold price (per gram in EGP)
 * 
 * Data sources:
 *  - Yahoo Finance (free, no key) for XAU=F, CL=F, USDEGP=X
 *  - Scrapes egygold.com.eg for real local Egyptian gold price
 *  - Falls back to calculation if scrape fails
 * 
 * Cache: 60 seconds (prices update every minute)
 */

export const runtime = 'nodejs';

// ─── Yahoo Finance quote fetcher ──────────────────────────────────────────────
async function yahooQuote(symbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price     = meta.regularMarketPrice ?? meta.previousClose;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose;
    const change    = price - prevClose;
    const changePct = (change / prevClose) * 100;
    return { price, change, changePct };
  } catch {
    return null;
  }
}

// ─── Scrape real Egyptian gold price from egygold.com.eg ─────────────────────
async function scrapeEgyptianGold(): Promise<number | null> {
  try {
    // Try primary source: egygold.com.eg
    const res = await fetch('https://egygold.com.eg/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      next: { revalidate: 120 },
    });
    if (!res.ok) throw new Error('primary failed');
    const html = await res.text();

    // Look for 21-karat gold price per gram (الأكثر شيوعاً في مصر)
    // Pattern: numbers like 4,850 or 4850 near "عيار 21" or "21 عيار"
    const patterns = [
      /عيار\s*21[^0-9]*?([\d,]+)/,
      /21\s*عيار[^0-9]*?([\d,]+)/,
      /gram.*?([\d,]+)/i,
    ];
    for (const pat of patterns) {
      const m = html.match(pat);
      if (m) {
        const price = parseFloat(m[1].replace(/,/g, ''));
        if (price > 1000 && price < 50000) return price; // sanity check EGP per gram
      }
    }
    return null;
  } catch {
    // Try secondary source: aiswaq.com
    try {
      const res2 = await fetch('https://www.aiswaq.com/ar/gold-egypt', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 120 },
      });
      if (!res2.ok) return null;
      const html2 = await res2.text();
      const m = html2.match(/عيار\s*21[^0-9]*?([\d,]+)/);
      if (m) {
        const price = parseFloat(m[1].replace(/,/g, ''));
        if (price > 1000 && price < 50000) return price;
      }
      return null;
    } catch {
      return null;
    }
  }
}

// ─── Calculate Egyptian gold from XAU + USD/EGP rate ─────────────────────────
function calcEgyptianGold(xauUsd: number, usdEgp: number): number {
  // 1 troy oz = 31.1035 grams
  // 21-karat = 21/24 purity
  const pricePerGramUSD = xauUsd / 31.1035;
  const pricePerGramEGP = pricePerGramUSD * usdEgp;
  const karat21         = pricePerGramEGP * (21 / 24);
  return Math.round(karat21);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    // Fetch all data in parallel
    const [xau, oil, egp, scrapedGold] = await Promise.all([
      yahooQuote('GC=F'),      // Gold Futures (XAU/USD)
      yahooQuote('CL=F'),      // WTI Crude Oil Futures
      yahooQuote('USDEGP=X'),  // USD/EGP exchange rate
      scrapeEgyptianGold(),    // Real local Egyptian gold price
    ]);

    // Fallback values if APIs fail
    const goldPrice   = xau?.price ?? 3350;
    const oilPrice    = oil?.price ?? 79;
    const usdEgpRate  = egp?.price ?? 50.5;

    // Egyptian gold: real scrape first, fallback to calculation
    let egyptianGoldPrice    = scrapedGold;
    let egyptianGoldSource   = 'scrape';
    if (!egyptianGoldPrice) {
      egyptianGoldPrice  = calcEgyptianGold(goldPrice, usdEgpRate);
      egyptianGoldSource = 'calculated';
    }

    // Estimate Egyptian gold daily change (approximate based on XAU move)
    const goldChangePct  = xau?.changePct ?? 0;
    const egyptianGoldChangePct = goldChangePct + (egp?.changePct ?? 0);

    return NextResponse.json({
      gold: {
        symbol:    'XAU/USD',
        label:     'ذهب',
        labelEn:   'Gold',
        price:     goldPrice,
        change:    xau?.change    ?? 0,
        changePct: xau?.changePct ?? 0,
        unit:      'USD/oz',
      },
      oil: {
        symbol:    'WTI',
        label:     'نفط',
        labelEn:   'WTI Oil',
        price:     oilPrice,
        change:    oil?.change    ?? 0,
        changePct: oil?.changePct ?? 0,
        unit:      'USD/bbl',
      },
      usdEgp: {
        symbol:    'USD/EGP',
        label:     'دولار/جنيه',
        price:     usdEgpRate,
        change:    egp?.change    ?? 0,
        changePct: egp?.changePct ?? 0,
      },
      egyptianGold: {
        symbol:    'XAU/EGP',
        label:     'ذهب مصري',
        labelEn:   'Gold (EGP)',
        price:     egyptianGoldPrice,
        changePct: egyptianGoldChangePct,
        karat:     21,
        unit:      'جنيه/جرام',
        source:    egyptianGoldSource,
      },
      timestamp: Date.now(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });

  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch commodities' }, { status: 500 });
  }
}
