import { applyCORS, handlePreflight } from '@/lib/cors';

export const revalidate = 300;

export async function OPTIONS(req: Request) {
  return handlePreflight(req) ?? new Response(null, { status: 204 });
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin');
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?' + new URLSearchParams({
      vs_currency: 'usd', order: 'market_cap_desc',
      per_page: '10', page: '1', sparkline: 'false',
      price_change_percentage: '24h',
    });
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return applyCORS(
      Response.json({ error: `CoinGecko: ${res.status}` }, { status: res.status }),
      origin
    );
    const data  = await res.json();
    const coins = data.map((c: any, i: number) => ({
      rank: i + 1, id: c.id, symbol: c.symbol.toUpperCase(), name: c.name,
      image: c.image, price: c.current_price,
      change24h: c.price_change_percentage_24h?.toFixed(2) ?? '0',
      marketCap: c.market_cap, volume24h: c.total_volume,
    }));
    return applyCORS(Response.json(coins), origin);
  } catch (err: any) {
    return applyCORS(Response.json({ error: err.message }, { status: 500 }), origin);
  }
}
