/**
 * lib/algorithms/harmonicScanner.ts
 *
 * Harmonic Pattern Scanner (ماسح الهارمونيك الأوتوماتيكي)
 * Consumes ZigZag Pivot data to detect geometric harmonic patterns (Gartley, Bat, etc.)
 */

export interface HarmonicPoint {
  label: 'X' | 'A' | 'B' | 'C' | 'D';
  index: number;
  price: number;
}

export interface HarmonicPatternResult {
  patternNameEn: string;
  patternNameAr: string;
  isBullish: boolean;
  accuracyPct: number;
  przStart: number;
  przEnd: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  points: HarmonicPoint[];
  ratios: {
    xb: number;
    ac: number;
    bd: number;
    xd: number;
  };
}

export function generateHarmonicMockData(patternType: 'GARTLEY' | 'BAT', isBullish: boolean, startPrice: number = 60000): HarmonicPatternResult {
  const x = { label: 'X', index: 0, price: startPrice } as HarmonicPoint;
  
  // XA Leg (Impulse)
  const xaDist = startPrice * 0.1; // 10% move
  const a = { label: 'A', index: 15, price: isBullish ? startPrice + xaDist : startPrice - xaDist } as HarmonicPoint;

  // AB Leg (Retracement of XA)
  const xbRatio = patternType === 'GARTLEY' ? 0.618 : 0.382;
  const bDist = xaDist * xbRatio;
  const b = { label: 'B', index: 30, price: isBullish ? a.price - bDist : a.price + bDist } as HarmonicPoint;

  // BC Leg (Retracement of AB)
  const acRatio = 0.886; // Usually between 0.382 and 0.886
  const abDist = Math.abs(a.price - b.price);
  const cDist = abDist * acRatio;
  const c = { label: 'C', index: 45, price: isBullish ? b.price + cDist : b.price - cDist } as HarmonicPoint;

  // CD Leg (Retracement of XA)
  const xdRatio = patternType === 'GARTLEY' ? 0.786 : 0.886;
  const dDist = xaDist * xdRatio;
  const d = { label: 'D', index: 60, price: isBullish ? a.price - dDist : a.price + dDist } as HarmonicPoint;

  const accuracy = patternType === 'GARTLEY' ? 94 : 91;

  // PRZ (Potential Reversal Zone)
  const przZone = xaDist * 0.05; 
  const przStart = d.price + (isBullish ? przZone : -przZone);
  const przEnd = d.price - (isBullish ? przZone : -przZone);

  // Stop Loss (Beyond X)
  const slDist = xaDist * 0.1;
  const stopLoss = isBullish ? x.price - slDist : x.price + slDist;

  // Targets (Fib retracement of AD leg)
  const adDist = Math.abs(a.price - d.price);
  const tp1 = isBullish ? d.price + (adDist * 0.382) : d.price - (adDist * 0.382);
  const tp2 = isBullish ? d.price + (adDist * 0.618) : d.price - (adDist * 0.618);

  const bdRatio = Math.abs(d.price - b.price) / Math.abs(c.price - b.price);

  return {
    patternNameEn: patternType,
    patternNameAr: patternType === 'GARTLEY' ? 'جارتلي Gartley' : 'خفاش Bat',
    isBullish,
    accuracyPct: accuracy,
    przStart,
    przEnd,
    stopLoss,
    tp1,
    tp2,
    points: [x, a, b, c, d],
    ratios: {
      xb: xbRatio,
      ac: acRatio,
      bd: Number(bdRatio.toFixed(3)),
      xd: xdRatio
    }
  };
}

export function scanHarmonicPatterns(pivots: any[]): HarmonicPatternResult | null {
  // Simulates scanning an array of ZigZag pivots to find a geometric harmonic setup.
  // For UI/Testing purposes, returns a perfect deterministic mock setup based on current time.
  const isBull = new Date().getMinutes() % 2 === 0;
  return generateHarmonicMockData('GARTLEY', isBull, 65000);
}
