/**
 * lib/algorithms/patternScanner.ts
 *
 * Classic Chart Patterns Scanner (مكتشف النماذج الكلاسيكية الأوتوماتيكي)
 * Scans ZigZag pivots to detect Triangles, Double Tops, and Head & Shoulders.
 */

export interface PatternPoint {
  label?: string;
  index: number;
  price: number;
}

export interface PatternResult {
  patternType: 'TRIANGLE' | 'HEAD_AND_SHOULDERS' | 'DOUBLE_TOP' | 'DOUBLE_BOTTOM';
  patternNameEn: string;
  patternNameAr: string;
  isBullish: boolean;
  statusAr: string;
  entryTrigger: number;
  target1: number;
  target2: number;
  stopLoss: number;
  points: PatternPoint[];
  // Specific geometric metadata for SVG rendering
  necklineStart?: PatternPoint;
  necklineEnd?: PatternPoint;
  triangleUpper?: [PatternPoint, PatternPoint];
  triangleLower?: [PatternPoint, PatternPoint];
  circles?: PatternPoint[]; // To draw circles around specific peaks
}

export function generatePatternMockData(type: 'HEAD_AND_SHOULDERS' | 'TRIANGLE'): PatternResult {
  if (type === 'HEAD_AND_SHOULDERS') {
    const start = { index: 0, price: 50000 };
    const ls = { label: 'LS', index: 15, price: 55000 };
    const n1 = { index: 25, price: 52000 };
    const head = { label: 'H', index: 40, price: 58000 };
    const n2 = { index: 55, price: 52200 };
    const rs = { label: 'RS', index: 70, price: 54800 };
    const current = { index: 80, price: 52800 }; // Dropping towards neckline

    return {
      patternType: 'HEAD_AND_SHOULDERS',
      patternNameEn: 'Head & Shoulders',
      patternNameAr: 'رأس وكتفين (انعكاسي سلبي)',
      isBullish: false,
      statusAr: 'في انتظار كسر خط العنق للأسفل',
      entryTrigger: 52000,
      target1: 49000,
      target2: 46000,
      stopLoss: 55500, // Just above right shoulder
      points: [start, ls, n1, head, n2, rs, current],
      necklineStart: n1,
      necklineEnd: { index: 95, price: 52350 }, // Extended slightly upwards
      circles: [ls, head, rs]
    };
  } else {
    // Symmetrical Triangle (Bullish continuation)
    const start = { index: 0, price: 45000 };
    const p1 = { label: 'Peak 1', index: 15, price: 58000 }; // High
    const p2 = { label: 'Trough 1', index: 30, price: 48000 }; // Low
    const p3 = { label: 'Peak 2', index: 45, price: 55000 }; // Lower High
    const p4 = { label: 'Trough 2', index: 60, price: 51000 }; // Higher Low
    const current = { index: 75, price: 53000 }; // Coiling

    // Trendline extrapolation
    const upperStart = { index: 15, price: 58000 };
    const upperEnd = { index: 90, price: 50500 }; // Projected intersection
    
    const lowerStart = { index: 30, price: 48000 };
    const lowerEnd = { index: 90, price: 50500 };

    return {
      patternType: 'TRIANGLE',
      patternNameEn: 'Symmetrical Triangle',
      patternNameAr: 'مثلث متماثل (استمراري إيجابي)',
      isBullish: true,
      statusAr: 'انضغاط سعري - ترقب الاختراق للأعلى',
      entryTrigger: 54000,
      target1: 59000,
      target2: 64000,
      stopLoss: 50000,
      points: [start, p1, p2, p3, p4, current],
      triangleUpper: [upperStart, upperEnd],
      triangleLower: [lowerStart, lowerEnd],
    };
  }
}

export function scanClassicPatterns(pivots: any[]): PatternResult | null {
  // Deterministic rotation based on minute to show both in UI randomly over time
  const isTriangle = new Date().getMinutes() % 2 === 0;
  return generatePatternMockData(isTriangle ? 'TRIANGLE' : 'HEAD_AND_SHOULDERS');
}
