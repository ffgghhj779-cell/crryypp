import { applyCORS, handlePreflight } from '@/lib/cors';

// force-dynamic: NEVER statically cache this route at build time.
// revalidate=300 caused Vercel to pre-render the route during build,
// cache a CoinGecko HTML-error page, and serve that to all clients.
export const dynamic = 'force-dynamic';

// Static fallback used when CoinGecko is rate-limited or unreachable
const FALLBACK_COINS = [
  { rank: 1,  id: 'bitcoin',   symbol: 'BTC',  name: 'Bitcoin',   price: 0, change24h: '0.00', marketCap: 0, volume24h: 0 },
  { rank: 2,  id: 'ethereum',  symbol: 'ETH',  name: 'Ethereum',  price: 0, change24h: '0.00', marketCap: 0, volume24h: 0 },
  { rank: 3,  id: 'tether',    symbol: 'USDT', name: 'Tether',    price: 0, change24h: '0.00', marketCap: 0, volume24h: 0 },
  { rank: 4,  id: 'bnb',       symbol: 'BNB',  name: 'BNB',       price: 0, change24h: '0.00', marketCap: 0, volume24h: 0 },
  { rank: 5,  id: 'solana',    symbol: 'SOL',  name: 'Solana',    price: 0, change24h: '0.00', marketCap: 0, volume24h: 0 },
];

export async function OPTIONS(req: Request) {
  return handlePreflight(req) ?? new Response(null, { status: 204 });
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin');
  try {
    const params = new URLSearchParams({
      vs_currency: 'usd', order: 'market_cap_desc',
      per_page: '10', page: '1', sparkline: 'false',
      price_change_percentage: '24h',
    });

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'CryptoTerminal/1.0',
    };
    // Use Pro API key if available, otherwise use free tier
    if (process.env.COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
    }

    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?${params}`,
      { headers, cache: 'no-store' }
    );

    // Rate-limited or server error — return fallback, NOT an error
    if (!res.ok) {
      console.warn(`[/api/markets] CoinGecko returned ${res.status} — serving fallback`);
      return applyCORS(
        Response.json({ coins: FALLBACK_COINS, stale: true, status: res.status }),
        origin
      );
    }

    // Defensive parse: CoinGecko occasionally returns HTML on CDN errors
    const text = await res.text();
    if (text.trim().startsWith('<')) {
      console.warn('[/api/markets] CoinGecko returned HTML instead of JSON — serving fallback');
      return applyCORS(
        Response.json({ coins: FALLBACK_COINS, stale: true }),
        origin
      );
    }

    const data  = JSON.parse(text);
    const coins = (data as any[]).map((c, i) => ({
      rank: i + 1, id: c.id, symbol: c.symbol.toUpperCase(), name: c.name,
      price: c.current_price,
      change24h: c.price_change_percentage_24h?.toFixed(2) ?? '0.00',
      marketCap: c.market_cap, volume24h: c.total_volume,
    }));

    return applyCORS(Response.json({ coins, stale: false }), origin);
  } catch (err: any) {
    console.error('[/api/markets] Unexpected error:', err.message);
    return applyCORS(
      Response.json({ coins: FALLBACK_COINS, stale: true }),
      origin
    );
  }
}
