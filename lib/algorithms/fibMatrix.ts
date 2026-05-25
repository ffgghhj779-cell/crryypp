/**
 * lib/algorithms/fibMatrix.ts
 *
 * Fibonacci Time & Price Matrix (مصفوفة فيبوناتشي الزمنية والسعرية)
 * Calculates Price Retracements and Time Projections to identify Kill Zones (PRZ).
 */

export interface Pivot {
  price: number;
  index: number;
}

export interface FibLevel {
  ratio: number;
  value: number;
}

export interface PRZBox {
  priceLevel: number;
  timeIndex: number;
  label: string;
}

export interface FibMatrixResult {
  priceLevels: FibLevel[];
  timeLevels: FibLevel[];
  killZones: PRZBox[];
  nearestTimeWindow: number;
  nearestPriceTarget: number;
  trend: 'BULLISH' | 'BEARISH';
  baseHigh: Pivot;
  baseLow: Pivot;
}

export function calculateFibMatrix(
  swingHigh: Pivot,
  swingLow: Pivot,
  currentBarIndex: number
): FibMatrixResult {
  const isBullish = swingHigh.index > swingLow.index;
  const priceDiff = Math.abs(swingHigh.price - swingLow.price);
  const timeDiff = Math.abs(swingHigh.index - swingLow.index) || 10;
  const latestPivot = isBullish ? swingHigh : swingLow;

  const priceRatios = [0.382, 0.5, 0.618, 0.786, 1.272, 1.618];
  const timeRatios = [1.0, 1.618, 2.618];

  const priceLevels = priceRatios.map(r => ({
    ratio: r,
    // If latest was high (Bullish impulse), retracement goes down. If latest was low, retracement goes up.
    value: isBullish ? latestPivot.price - (priceDiff * r) : latestPivot.price + (priceDiff * r)
  }));

  const timeLevels = timeRatios.map(r => ({
    ratio: r,
    value: latestPivot.index + Math.round(timeDiff * r)
  }));

  const killZones: PRZBox[] = [];
  
  // Define strong confluence intersections as Kill Zones
  for (const t of timeLevels) {
    for (const p of priceLevels) {
      if ((t.ratio === 1.618 && p.ratio === 0.618) ||
          (t.ratio === 2.618 && p.ratio === 1.618) ||
          (t.ratio === 1.0 && p.ratio === 0.5) ||
          (t.ratio === 1.618 && p.ratio === 0.786)) {
        killZones.push({
          priceLevel: p.value,
          timeIndex: t.value,
          label: `T:${t.ratio} | P:${p.ratio}`
        });
      }
    }
  }

  // Find nearest upcoming time window
  const upcomingTimes = timeLevels.filter(t => t.value >= currentBarIndex);
  const nearestTimeWindow = upcomingTimes.length > 0 ? upcomingTimes[0].value : timeLevels[timeLevels.length - 1].value;

  // Nearest Price Target (Golden Ratio is usually primary target)
  const nearestPriceTarget = priceLevels.find(p => p.ratio === 0.618)?.value || priceLevels[0].value;

  return {
    priceLevels,
    timeLevels,
    killZones,
    nearestTimeWindow,
    nearestPriceTarget,
    trend: isBullish ? 'BULLISH' : 'BEARISH',
    baseHigh: swingHigh,
    baseLow: swingLow
  };
}
