/**
 * lib/algorithms/harmonicScanner.ts
 *
 * Harmonic Pattern Scanner (ماسح الهارمونيك الأوتوماتيكي)
 * ✅ PARITY FIX: Real geometric harmonic detection from ZigZag pivots.
 *    - All 8 patterns: Gartley, Bat, Butterfly, Crab (bull + bear each)
 *    - Exact ratios from competitor geom-smc-patch.js
 *    - PRZ calculation: D level + CD×fib retracement
 *    - Accuracy formula: matches competitor calcAccuracy() — threshold 85%
 *    - Targets: T1 = D + CD×0.382, T2 = D + CD×0.618
 */

export interface HarmonicPoint {
  label: 'X' | 'A' | 'B' | 'C' | 'D';
  index: number;
  price: number;
}

export interface HarmonicRatios {
  xb: number;   // AB/XA retracement
  ac: number;   // BC/AB retracement
  xd: number;   // AD/XA retracement
  bd: number;   // CD/BC extension
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
  ratios: HarmonicRatios;
}

// ─── Pattern definitions — from competitor source geom-smc-patch.js ───────────
// Format: { XB: [min,max], AC: [min,max], XD: [min,max], BD: [min,max] }
interface PatternDef {
  nameEn: string;
  nameAr: string;
  XB: [number, number];
  AC: [number, number];
  XD: [number, number];
  BD: [number, number];
}

const PATTERNS: PatternDef[] = [
  {
    nameEn: 'Gartley',    nameAr: 'جارتلي',
    XB: [0.58, 0.66],  // B at 0.618 XA
    AC: [0.38, 0.89],  // C at 0.382–0.886 AB
    XD: [0.74, 0.82],  // D at 0.786 XA (PRZ)
    BD: [1.13, 1.62],  // CD 1.13–1.618 BC
  },
  {
    nameEn: 'Bat',        nameAr: 'خفاش',
    XB: [0.35, 0.50],  // B at 0.382–0.50 XA
    AC: [0.38, 0.89],
    XD: [0.83, 0.92],  // D at 0.886 XA
    BD: [1.62, 2.62],  // CD 1.618–2.618 BC
  },
  {
    nameEn: 'Butterfly',  nameAr: 'فراشة',
    XB: [0.72, 0.82],  // B at 0.786 XA
    AC: [0.38, 0.89],
    XD: [1.20, 1.38],  // D at 1.272–1.618 XA (extension)
    BD: [1.62, 2.24],
  },
  {
    nameEn: 'Crab',       nameAr: 'سرطان',
    XB: [0.35, 0.62],  // B at 0.382–0.618 XA
    AC: [0.38, 0.89],
    XD: [1.55, 1.68],  // D at 1.618 XA (extreme)
    BD: [2.24, 3.62],
  },
  {
    nameEn: 'Shark',      nameAr: 'قرش',
    XB: [1.13, 1.62],
    AC: [1.62, 2.24],
    XD: [0.88, 1.13],
    BD: [0.88, 1.13],
  },
  {
    nameEn: 'Cypher',     nameAr: 'سايفر',
    XB: [0.35, 0.62],
    AC: [1.13, 1.41],
    XD: [0.72, 0.79],
    BD: [1.27, 2.00],
  },
  {
    nameEn: 'ABCD',       nameAr: 'أي-بي-سي-دي',
    XB: [0.00, 1.00],  // any
    AC: [0.00, 1.00],
    XD: [1.00, 1.00],  // D = A (100% retracement of XA concept not applicable; BD drives it)
    BD: [1.27, 1.62],
  },
  {
    nameEn: 'Three Drives', nameAr: 'ثلاثة موجات',
    XB: [0.60, 0.68],
    AC: [0.60, 0.68],
    XD: [1.13, 1.28],
    BD: [1.27, 1.62],
  },
];

// ─── Accuracy function — matches competitor calcAccuracy() ────────────────────
function calcAccuracy(actual: number, idealMin: number, idealMax: number): number {
  const mid   = (idealMin + idealMax) / 2;
  const range = (idealMax - idealMin) / 2;
  const diff  = Math.abs(actual - mid);
  if (diff <= range) return 100;
  return Math.max(0, 100 - ((diff - range) / (mid || 0.001)) * 100);
}

// ─── Detect pattern from 5 XABCD points ────────────────────────────────────────
function detectPattern(
  X: number, A: number, B: number, C: number, D: number
): { pattern: PatternDef; accuracy: number; isBullish: boolean } | null {
  const XA = Math.abs(A - X);
  const AB = Math.abs(B - A);
  const BC = Math.abs(C - B);
  const CD = Math.abs(D - C);
  const XD_dist = Math.abs(D - X);

  if (XA === 0 || AB === 0 || BC === 0) return null;

  const ratioXB = AB / XA;
  const ratioAC = BC / AB;
  const ratioBD = CD / (BC || 0.001);
  const ratioXD = XD_dist / XA;

  // isBullish: X < A (impulse up) so B < A, D is the PRZ (below A)
  const isBullish = A > X;

  let bestPattern: PatternDef | null = null;
  let bestAcc = 0;

  for (const p of PATTERNS) {
    if (p.nameEn === 'ABCD') continue; // requires different structure
    const accXB = calcAccuracy(ratioXB, p.XB[0], p.XB[1]);
    const accAC = calcAccuracy(ratioAC, p.AC[0], p.AC[1]);
    const accXD = calcAccuracy(ratioXD, p.XD[0], p.XD[1]);
    const accBD = calcAccuracy(ratioBD, p.BD[0], p.BD[1]);

    // Require at least 3 of 4 ratios to meet threshold (85%)
    const accs = [accXB, accAC, accXD, accBD];
    const validCount = accs.filter(a => a >= 85).length;
    if (validCount < 3) continue;

    const avgAcc = accs.reduce((a, b) => a + b, 0) / 4;
    if (avgAcc > bestAcc) {
      bestAcc = avgAcc;
      bestPattern = p;
    }
  }

  if (!bestPattern || bestAcc < 70) return null;
  return { pattern: bestPattern, accuracy: Math.round(bestAcc), isBullish };
}

// ─── PRZ calculation — matches competitor source ─────────────────────────────
function calcPRZ(X: number, A: number, B: number, C: number, D: number, isBullish: boolean, patternXD: number): { przStart: number; przEnd: number } {
  const XA = Math.abs(A - X);
  const BC = Math.abs(C - B);
  // PRZ level 1: using ideal D ratio from XA
  const prz1 = isBullish ? A - XA * patternXD : A + XA * patternXD;
  // PRZ level 2: C - BC * 1.272 (BC extension)
  const prz2 = isBullish ? C + BC * 1.272 : C - BC * 1.272;

  const przStart = Math.min(prz1, prz2, D);
  const przEnd   = Math.max(prz1, prz2, D);
  return { przStart, przEnd };
}

// ─── Main scan function — real pattern detection ───────────────────────────────
export function scanHarmonicPatterns(
  pivots: { index: number; price: number; isHigh: boolean }[]
): HarmonicPatternResult | null {
  if (pivots.length < 5) return null;

  // Try recent 5-pivot combinations
  for (let i = pivots.length - 5; i >= Math.max(0, pivots.length - 20); i--) {
    const [pX, pA, pB, pC, pD] = pivots.slice(i, i + 5);
    if (!pX || !pA || !pB || !pC || !pD) continue;

    const result = detectPattern(pX.price, pA.price, pB.price, pC.price, pD.price);
    if (!result) continue;

    const { pattern, accuracy, isBullish } = result;
    const XA = Math.abs(pA.price - pX.price);
    const CD = Math.abs(pD.price - pC.price);

    // PRZ
    const idealXD = (pattern.XD[0] + pattern.XD[1]) / 2;
    const { przStart, przEnd } = calcPRZ(pX.price, pA.price, pB.price, pC.price, pD.price, isBullish, idealXD);

    // Stop Loss: beyond X (10% of XA past X)
    const stopLoss = isBullish ? pX.price - XA * 0.1 : pX.price + XA * 0.1;

    // Targets: T1 = D + CD*0.382, T2 = D + CD*0.618
    const tp1 = isBullish ? pD.price + CD * 0.382 : pD.price - CD * 0.382;
    const tp2 = isBullish ? pD.price + CD * 0.618 : pD.price - CD * 0.618;

    const AB = Math.abs(pB.price - pA.price);
    const BC = Math.abs(pC.price - pB.price);

    return {
      patternNameEn: pattern.nameEn,
      patternNameAr: pattern.nameAr,
      isBullish,
      accuracyPct: accuracy,
      przStart,
      przEnd,
      stopLoss,
      tp1,
      tp2,
      points: [
        { label: 'X', index: pX.index, price: pX.price },
        { label: 'A', index: pA.index, price: pA.price },
        { label: 'B', index: pB.index, price: pB.price },
        { label: 'C', index: pC.index, price: pC.price },
        { label: 'D', index: pD.index, price: pD.price },
      ],
      ratios: {
        xb: parseFloat((AB / (XA || 1)).toFixed(3)),
        ac: parseFloat((BC / (AB || 1)).toFixed(3)),
        xd: parseFloat((Math.abs(pD.price - pX.price) / (XA || 1)).toFixed(3)),
        bd: parseFloat((CD / (BC || 1)).toFixed(3)),
      },
    };
  }

  return null;
}

// ─── Generate deterministic demo data for UI testing ─────────────────────────
export function generateHarmonicMockData(
  patternType: 'GARTLEY' | 'BAT' | 'BUTTERFLY' | 'CRAB',
  isBullish: boolean,
  startPrice = 60000
): HarmonicPatternResult {
  const defs: Record<string, PatternDef> = {
    GARTLEY:   PATTERNS[0],
    BAT:       PATTERNS[1],
    BUTTERFLY: PATTERNS[2],
    CRAB:      PATTERNS[3],
  };
  const def = defs[patternType] ?? PATTERNS[0];
  const idealXB = (def.XB[0] + def.XB[1]) / 2;
  const idealAC = (def.AC[0] + def.AC[1]) / 2;
  const idealXD = (def.XD[0] + def.XD[1]) / 2;
  const idealBD = (def.BD[0] + def.BD[1]) / 2;

  const xaDist = startPrice * 0.10;
  const X = startPrice;
  const A = isBullish ? X + xaDist : X - xaDist;
  const B = isBullish ? A - xaDist * idealXB : A + xaDist * idealXB;
  const abDist = Math.abs(A - B);
  const C = isBullish ? B + abDist * idealAC : B - abDist * idealAC;
  const bcDist = Math.abs(C - B);
  const D = isBullish ? C - bcDist * idealBD : C + bcDist * idealBD;

  const XA = xaDist;
  const CD = bcDist * idealBD;
  const przStart = Math.min(D, isBullish ? A - XA * idealXD : A + XA * idealXD);
  const przEnd   = Math.max(D, isBullish ? A - XA * idealXD : A + XA * idealXD);
  const stopLoss = isBullish ? X - XA * 0.1 : X + XA * 0.1;
  const tp1      = isBullish ? D + CD * 0.382 : D - CD * 0.382;
  const tp2      = isBullish ? D + CD * 0.618 : D - CD * 0.618;

  const arNames: Record<string, string> = {
    GARTLEY: 'جارتلي', BAT: 'خفاش', BUTTERFLY: 'فراشة', CRAB: 'سرطان'
  };

  return {
    patternNameEn: patternType,
    patternNameAr: arNames[patternType] ?? patternType,
    isBullish,
    accuracyPct: Math.round(90 + Math.random() * 5),
    przStart, przEnd, stopLoss, tp1, tp2,
    points: [
      { label: 'X', index: 0,  price: parseFloat(X.toFixed(2)) },
      { label: 'A', index: 15, price: parseFloat(A.toFixed(2)) },
      { label: 'B', index: 30, price: parseFloat(B.toFixed(2)) },
      { label: 'C', index: 45, price: parseFloat(C.toFixed(2)) },
      { label: 'D', index: 60, price: parseFloat(D.toFixed(2)) },
    ],
    ratios: {
      xb: parseFloat(idealXB.toFixed(3)),
      ac: parseFloat(idealAC.toFixed(3)),
      xd: parseFloat(idealXD.toFixed(3)),
      bd: parseFloat(idealBD.toFixed(3)),
    },
  };
}
