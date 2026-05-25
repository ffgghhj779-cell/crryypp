/**
 * lib/api/binance.ts
 *
 * Central utility for fetching live market data from Binance API.
 * Replaces mock data across the platform trading engines.
 */

export interface BinanceKline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetches live candlestick data from Binance API.
 * 
 * @param symbol Trading pair symbol (e.g., "BTCUSDT")
 * @param timeframe Interval (e.g., "15m", "1h", "4h", "1d")
 * @param limit Number of candles to fetch (default: 100)
 * @returns Array of parsed Kline objects
 */
export async function fetchLiveCandles(symbol: string, timeframe: string, limit: number = 100): Promise<BinanceKline[]> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${timeframe}&limit=${limit}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Binance API] Error fetching klines for ${symbol}: ${response.statusText}`);
      return [];
    }

    const data: any[][] = await response.json();
    
    // Map the raw array format to our strict object format
    const parsedData: BinanceKline[] = data.map(candle => ({
      time: Number(candle[0]),     // Open time
      open: Number(candle[1]),     // Open
      high: Number(candle[2]),     // High
      low: Number(candle[3]),      // Low
      close: Number(candle[4]),    // Close
      volume: Number(candle[5]),   // Volume
    }));

    return parsedData;
  } catch (error) {
    console.error(`[Binance API] Exception in fetchLiveCandles for ${symbol}:`, error);
    return [];
  }
}

/**
 * Fetches the current live ticker price from Binance API.
 * 
 * @param symbol Trading pair symbol (e.g., "BTCUSDT")
 * @returns Current price as a float, or null if it fails
 */
export async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Binance API] Error fetching price for ${symbol}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data && data.price) {
      return Number(data.price);
    }
    
    return null;
  } catch (error) {
    console.error(`[Binance API] Exception in fetchCurrentPrice for ${symbol}:`, error);
    return null;
  }
}
