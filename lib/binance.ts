// Remove the `next: { revalidate }` hint — it's a server-side Next.js hint and is silently
// ignored when called from the browser (client component). Keeping it adds confusion.
// Klines are fetched fresh on every call from the client.

export async function fetchKlines(symbol = 'BTCUSDT', interval = '1h', limit = 100) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines fetch failed: ${res.status}`);
  const raw: any[][] = await res.json();

  return raw.map(k => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    value: parseFloat(k[4]), // alias used by lightweight-charts AreaSeries
  }));
}

/**
 * Wilder's Smoothed RSI (the original standard formula).
 * Requires at least `period + 1` candles to produce a meaningful result.
 * With 50+ candles the result is production-accurate.
 */
export function calculateRSI(klines: { close: number }[], period = 14): number {
  if (klines.length <= period) return 50; // Not enough data — return neutral

  let gains = 0;
  let losses = 0;

  // Seed: simple average of first `period` changes
  for (let i = 1; i <= period; i++) {
    const diff = klines[i].close - klines[i - 1].close;
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Wilder's smoothing for the rest of the data
  for (let i = period + 1; i < klines.length; i++) {
    const diff = klines[i].close - klines[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}
