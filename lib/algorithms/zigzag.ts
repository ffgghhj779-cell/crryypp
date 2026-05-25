/**
 * lib/algorithms/zigzag.ts
 *
 * ZigZag Pivot Engine (محرك القمم والقيعان)
 * Calculates Pivot Highs and Lows based on a percentage deviation, 
 * then labels Market Structure (HH, HL, LH, LL).
 */

export type PivotType = 'HIGH' | 'LOW';
export type MarketStructure = 'HH' | 'HL' | 'LH' | 'LL' | 'START';

export interface DataPoint {
  index: number;
  price: number;
}

export interface PivotPoint extends DataPoint {
  type: PivotType;
  structure: MarketStructure;
}

export interface ZigZagResult {
  rawData: DataPoint[];
  pivots: PivotPoint[];
  deviationPct: number;
  currentStructure: string;
}

export function generateDeterministicMockData(seed: number = 42): DataPoint[] {
  // Generate 50 points to show a good wave
  const data: DataPoint[] = [];
  let currentPrice = 50000;
  let trend = 1; // 1 for up, -1 for down
  
  // Simple LCG PRNG
  let currentSeed = seed;
  const random = () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
  };

  for (let i = 0; i < 60; i++) {
    // Random noise
    const noise = (random() - 0.5) * 1200;
    // Periodic macro trend shifts
    if (i % 12 === 0) trend = random() > 0.5 ? 1 : -1;
    
    currentPrice = currentPrice + (trend * 800) + noise;
    data.push({ index: i, price: currentPrice });
  }
  return data;
}

export function calculateZigZag(data: DataPoint[], deviationPct: number): ZigZagResult {
  if (data.length === 0) return { rawData: [], pivots: [], deviationPct, currentStructure: '' };

  const pivots: PivotPoint[] = [];
  let currentDirection: 'UP' | 'DOWN' | 'NONE' = 'NONE';
  
  let extremeHigh = data[0].price;
  let extremeHighIndex = data[0].index;
  let extremeLow = data[0].price;
  let extremeLowIndex = data[0].index;

  const deviationRatio = deviationPct / 100;

  for (let i = 1; i < data.length; i++) {
    const pt = data[i];

    if (currentDirection === 'UP' || currentDirection === 'NONE') {
      if (pt.price > extremeHigh) {
        extremeHigh = pt.price;
        extremeHighIndex = pt.index;
      }
      // Check for downward reversal
      if (pt.price < extremeHigh * (1 - deviationRatio)) {
        // Reversal down! The extremeHigh was a Pivot High.
        if (currentDirection === 'UP' || currentDirection === 'NONE') {
          // If NONE, and we reversed down, we just found our first high
          pivots.push({ index: extremeHighIndex, price: extremeHigh, type: 'HIGH', structure: 'START' });
        }
        currentDirection = 'DOWN';
        extremeLow = pt.price;
        extremeLowIndex = pt.index;
      }
    }

    if (currentDirection === 'DOWN' || currentDirection === 'NONE') {
      if (pt.price < extremeLow) {
        extremeLow = pt.price;
        extremeLowIndex = pt.index;
      }
      // Check for upward reversal
      if (pt.price > extremeLow * (1 + deviationRatio)) {
        // Reversal up! The extremeLow was a Pivot Low.
        if (currentDirection === 'DOWN' || currentDirection === 'NONE') {
          pivots.push({ index: extremeLowIndex, price: extremeLow, type: 'LOW', structure: 'START' });
        }
        currentDirection = 'UP';
        extremeHigh = pt.price;
        extremeHighIndex = pt.index;
      }
    }
  }

  // Label Market Structure (HH, HL, LH, LL)
  let lastHighPrice = -1;
  let lastLowPrice = -1;

  for (let i = 0; i < pivots.length; i++) {
    const p = pivots[i];
    if (i === 0) {
      p.structure = 'START';
      if (p.type === 'HIGH') lastHighPrice = p.price;
      else lastLowPrice = p.price;
      continue;
    }

    if (p.type === 'HIGH') {
      if (lastHighPrice === -1) {
        p.structure = 'START';
      } else {
        p.structure = p.price > lastHighPrice ? 'HH' : 'LH';
      }
      lastHighPrice = p.price;
    } else {
      if (lastLowPrice === -1) {
        p.structure = 'START';
      } else {
        p.structure = p.price > lastLowPrice ? 'HL' : 'LL';
      }
      lastLowPrice = p.price;
    }
  }

  // Determine current structure string
  let currentStructure = 'مسار متذبذب (عرضي)';
  if (pivots.length >= 2) {
    const lastP = pivots[pivots.length - 1];
    const prevP = pivots[pivots.length - 2];
    
    // Check recent sequence
    const types = [lastP.structure, prevP.structure];
    if (types.includes('HH') && types.includes('HL')) {
      currentStructure = 'مسار صاعد (HH + HL)';
    } else if (types.includes('LL') && types.includes('LH')) {
      currentStructure = 'مسار هابط (LL + LH)';
    } else if (lastP.structure === 'HH' || lastP.structure === 'HL') {
      currentStructure = 'تغير إيجابي في الهيكل (شراء)';
    } else if (lastP.structure === 'LL' || lastP.structure === 'LH') {
      currentStructure = 'تغير سلبي في الهيكل (بيع)';
    }
  }

  return {
    rawData: data,
    pivots,
    deviationPct,
    currentStructure
  };
}
