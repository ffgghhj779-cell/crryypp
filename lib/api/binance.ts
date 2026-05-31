/**
 * lib/api/binance.ts
 *
 * Central utility for fetching live market data.
 * - Crypto symbols → Binance API
 * - Commodity symbols (XAUUSD, WTIUSD, USDEGP, EGYXAU) → /api/klines proxy
 */

export interface BinanceKline {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

/** Commodity symbols routed to /api/klines proxy */
const COMMODITY_SYMBOLS = new Set(['XAUUSD', 'WTIUSD', 'USDEGP', 'EGYXAU', 'BRENTUSD', 'EURUSD']);

/**
 * Fetches live candlestick data.
 * Automatically routes commodities to /api/klines proxy.
 */
export async function fetchLiveCandles(
  symbol:    string,
  timeframe: string,
  limit:     number = 100,
): Promise<BinanceKline[]> {
  const upperSymbol = symbol.toUpperCase().trim();

  // ── Commodity: use proxy ─────────────────────────────────────────────────
  if (COMMODITY_SYMBOLS.has(upperSymbol)) {
    try {
      const params = new URLSearchParams({
        symbol:   upperSymbol,
        interval: timeframe,
        limit:    String(Math.min(Math.max(1, limit), 1000)),
      });
      const res = await fetch(`/api/klines?${params}`);
      if (!res.ok) {
        console.error(`[Commodities API] Error fetching candles for ${upperSymbol}: ${res.status}`);
        return [];
      }
      const bars: BinanceKline[] = await res.json();
      return Array.isArray(bars) ? bars : [];
    } catch (err) {
      console.error(`[Commodities API] Exception in fetchLiveCandles for ${upperSymbol}:`, err);
      return [];
    }
  }

  // ── Crypto: original Binance path ────────────────────────────────────────
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${upperSymbol}&interval=${timeframe}&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Binance API] Error fetching klines for ${upperSymbol}: ${response.statusText}`);
      return [];
    }

    const data: any[][] = await response.json();

    return data.map(candle => ({
      time:   Number(candle[0]),
      open:   Number(candle[1]),
      high:   Number(candle[2]),
      low:    Number(candle[3]),
      close:  Number(candle[4]),
      volume: Number(candle[5]),
    }));
  } catch (error) {
    console.error(`[Binance API] Exception in fetchLiveCandles for ${upperSymbol}:`, error);
    return [];
  }
}

/**
 * Fetches the current live price.
 * - Commodities: calls /api/commodities (metals.live real-time — always fresh)
 * - Crypto: Binance ticker
 */
export async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  const upperSymbol = symbol.toUpperCase().trim();

  // ── Commodity: real-time spot from /api/commodities ────────────────────
  if (COMMODITY_SYMBOLS.has(upperSymbol)) {
    try {
      const res = await fetch('/api/commodities');
      if (res.ok) {
        const data = await res.json();
        const priceMap: Record<string, number | undefined> = {
          XAUUSD:   data.gold?.price,
          WTIUSD:   data.oil?.price,
          BRENTUSD: data.oil?.price,
          USDEGP:   data.usdEgp?.price,
          EGYXAU:   data.egyptianGold?.price,
        };
        const price = priceMap[upperSymbol];
        if (price && price > 0) return price;
      }
    } catch {}
    return null;
  }

  // ── Crypto: original Binance ticker ──────────────────────────────────────
  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${upperSymbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Binance API] Error fetching price for ${upperSymbol}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data?.price ? Number(data.price) : null;
  } catch (error) {
    console.error(`[Binance API] Exception in fetchCurrentPrice for ${upperSymbol}:`, error);
    return null;
  }
}
