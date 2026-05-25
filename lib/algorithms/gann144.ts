/**
 * lib/algorithms/gann144.ts
 *
 * Gann 144 Star — Squaring of Time & Price Engine
 * ================================================
 * Based on W.D. Gann's Master Time Factor: the number 144 (12×12).
 *
 * Core Principle: "Squaring" occurs when the unit of TIME (in days) equals
 * the unit of PRICE movement (in geometric percentage increments). The 144 base
 * connects both dimensions into a unified predictive framework.
 *
 * Mathematical Basis:
 *  - Base unit: 144 days (12 × 12)
 *  - Price increment per cycle: 14.4% of anchor price (1 per 10)
 *  - Sub-unit: 36 days (144 ÷ 4) = quarter cycle
 *  - Sub-price: 3.6% per quarter cycle
 *  - Angular price targets based on Gann degrees: 45°, 90°, 135°, 180°, 225°, 270°, 315°, 360°
 */

export type AnchorType = 'top' | 'bottom';

export interface Gann144Input {
  symbol:      string;
  anchorType:  AnchorType;
  anchorDate:  Date;
  anchorPrice: number;
}

export type NodeStrength = 'master' | 'primary' | 'quarter';

export interface Gann144Node {
  id:                  string;     // unique key
  n:                   number;     // cycle multiplier (e.g. 1, 2, 3...)
  cycleLabel:          string;     // "الدورة الأولى"
  daysFromAnchor:      number;     // n × 144 or n × 36
  targetDate:          Date;
  targetPrice:         number;
  priceChangePct:      number;     // % change from anchor
  angleOnWheel:        number;     // geometric angle: n × 45° (mod 360)
  strength:            NodeStrength;
  isSquaringNode:      boolean;    // true for all primary nodes (time = price in Gann units)
  label:               string;     // "نقطة التوافق ١٤٤"
}

export interface Gann144Result {
  input:      Gann144Input;
  masterNode: Gann144Node;         // The very first 144-day squaring node
  nodes:      Gann144Node[];       // All nodes sorted by date
  summary: {
    totalProjectionDays: number;
    cyclesComputed:      number;
    squaringNodeCount:   number;
    direction:           'صعود' | 'هبوط';
    nextNodeDaysAway:    number;
    nextNode:            Gann144Node;
  };
}

// ─── Arabic ordinal labels ─────────────────────────────────────────────────────
const ARABIC_ORDINALS = [
  'الأولى', 'الثانية', 'الثالثة', 'الرابعة',
  'الخامسة', 'السادسة', 'السابعة', 'الثامنة',
];

const ARABIC_QUARTER_LABELS = [
  'الربع الأول',  'النصف',         'ثلاثة أرباع',   'الدورة الكاملة',
];

// ─── Helper: add days to a Date ───────────────────────────────────────────────
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Helper: format date for display ─────────────────────────────────────────
export function formatGannDate(date: Date): string {
  return date.toLocaleDateString('ar-EG', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  });
}

export function formatGannDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year:  '2-digit',
    month: 'short',
    day:   'numeric',
  });
}

// ─── Core Calculator ──────────────────────────────────────────────────────────

export function computeGann144(input: Gann144Input): Gann144Result {
  const { anchorDate, anchorPrice, anchorType } = input;
  const isBottom = anchorType === 'bottom';
  const sign = isBottom ? 1 : -1;     // bottom → price rises, top → price falls
  const now  = new Date();

  const nodes: Gann144Node[] = [];

  // ── Primary Nodes: n × 144 days, n × 14.4% price ─────────────────────────
  for (let n = 1; n <= 8; n++) {
    const days       = n * 144;
    const targetDate = addDays(anchorDate, days);
    const changePct  = n * 14.4;
    const price      = anchorPrice * (1 + sign * changePct / 100);
    const angle      = (n * 45) % 360;

    nodes.push({
      id:             `primary-${n}`,
      n,
      cycleLabel:     `الدورة ${ARABIC_ORDINALS[n - 1] ?? n} (${days} يوماً)`,
      daysFromAnchor: days,
      targetDate,
      targetPrice:    parseFloat(price.toFixed(2)),
      priceChangePct: parseFloat(changePct.toFixed(1)),
      angleOnWheel:   angle,
      strength:       n === 1 ? 'master' : 'primary',
      isSquaringNode: true,
      label:          `نقطة التوافق ${n === 1 ? '١٤٤' : n === 2 ? '٢٨٨' : n === 3 ? '٤٣٢' : n === 4 ? '٥٧٦' : n === 5 ? '٧٢٠' : n === 6 ? '٨٦٤' : n === 7 ? '١٠٠٨' : '١١٥٢'}`,
    });
  }

  // ── Quarter Sub-Nodes: n × 36 days, n × 3.6% (within first 144-day cycle) ─
  for (let q = 1; q <= 3; q++) {  // quarters 1, 2, 3 (q4 = n=1 primary)
    const days       = q * 36;
    const targetDate = addDays(anchorDate, days);
    const changePct  = q * 3.6;
    const price      = anchorPrice * (1 + sign * changePct / 100);
    const angle      = q * 90;

    nodes.push({
      id:             `quarter-${q}`,
      n:              q * 0.25,
      cycleLabel:     ARABIC_QUARTER_LABELS[q - 1],
      daysFromAnchor: days,
      targetDate,
      targetPrice:    parseFloat(price.toFixed(2)),
      priceChangePct: parseFloat(changePct.toFixed(1)),
      angleOnWheel:   angle,
      strength:       'quarter',
      isSquaringNode: false,
      label:          `نقطة فرعية ${ARABIC_QUARTER_LABELS[q - 1]}`,
    });
  }

  // ── Sort all nodes by date ────────────────────────────────────────────────
  nodes.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());

  const masterNode = nodes.find(n => n.id === 'primary-1')!;

  // ── Find next upcoming node ───────────────────────────────────────────────
  const upcoming = nodes.find(n => n.targetDate > now) ?? nodes[nodes.length - 1];
  const msDay    = 1000 * 60 * 60 * 24;
  const daysAway = Math.max(0, Math.round((upcoming.targetDate.getTime() - now.getTime()) / msDay));

  return {
    input,
    masterNode,
    nodes,
    summary: {
      totalProjectionDays: 8 * 144,
      cyclesComputed:      8,
      squaringNodeCount:   8,
      direction:           isBottom ? 'صعود' : 'هبوط',
      nextNodeDaysAway:    daysAway,
      nextNode:            upcoming,
    },
  };
}
