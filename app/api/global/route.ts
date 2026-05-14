// app/api/global/route.ts
import { applyCORS, handlePreflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handlePreflight(req) ?? new Response(null, { status: 204 });
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin');
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CryptoTerminal/1.0' },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[/api/global] CoinGecko ${res.status} — returning fallback`);
      return applyCORS(Response.json({
        totalMarketCap: '---', btcDominance: '---',
        ethDominance: '---', activeCrypto: '---', marketCapChange24h: '0',
      }), origin);
    }

    // Guard against HTML CDN error pages
    const text = await res.text();
    if (text.trim().startsWith('<')) {
      return applyCORS(Response.json({
        totalMarketCap: '---', btcDominance: '---',
        ethDominance: '---', activeCrypto: '---', marketCapChange24h: '0',
      }), origin);
    }

    const json = JSON.parse(text);
    const d    = json.data;

    return applyCORS(Response.json({
      totalMarketCap:    (d.total_market_cap.usd / 1e12).toFixed(2) + 'T',
      btcDominance:      d.market_cap_percentage.btc.toFixed(1) + '%',
      ethDominance:      d.market_cap_percentage.eth?.toFixed(1) + '%',
      activeCrypto:      d.active_cryptocurrencies?.toLocaleString() ?? '---',
      marketCapChange24h: d.market_cap_change_percentage_24h_usd?.toFixed(2) ?? '0',
    }), origin);
  } catch (err: any) {
    return applyCORS(Response.json({ error: err.message }, { status: 500 }), origin);
  }
}
