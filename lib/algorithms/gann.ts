/**
 * lib/algorithms/gann.ts
 *
 * W.D. Gann Time Wheel — Mathematical Cycle Calculator
 * =====================================================
 * Based on W.D. Gann's observation that financial markets
 * exhibit cyclical behaviour aligned with solar geometry:
 * the 4 solstice/equinox points and the 4 mid-quarter cross-points.
 *
 * These are pure geometric calendar events — no astrology.
 */

export type GannStatus    = 'CRITICAL' | 'WARNING' | 'STABLE';
export type GannPointType = 'major' | 'minor';

export interface GannPoint {
  name:          string;  // "March 21"
  nameAr:        string;  // Arabic name
  month:         number;  // 1–12
  day:           number;  // 1–31
  type:          GannPointType;
  event:         string;  // "Vernal Equinox"
  eventAr:       string;
  degreeOnWheel: number;  // 0–360 geometric degree on Gann Wheel
}

export interface GannPointWithMeta extends GannPoint {
  dayOfYear: number;
  angle:     number;  // 0–360, angle on SVG wheel
  daysAway:  number;  // negative = past, positive = future
}

export interface GannResult {
  status:         GannStatus;
  todayDayOfYear: number;
  todayAngle:     number;   // 0–360 position on wheel
  nextPoint:      GannPointWithMeta;
  nextPointDate:  string;   // "June 21, 2025"
  daysToNext:     number;
  nearestPoint:   GannPointWithMeta;
  proximityDays:  number;   // |days| to nearest point
  points:         GannPointWithMeta[];
  advisoryAr:     string;
  advisoryEn:     string;
}

// ─── The 8 Gann Annual Time Points ────────────────────────────────────────────

export const GANN_POINTS: GannPoint[] = [
  {
    name: 'February 4',   nameAr: '٤ فبراير',
    month: 2,  day: 4,   type: 'minor',
    event:   'Winter Cross-Quarter (45°)',
    eventAr: 'نقطة التقاطع الشتوي — ٤٥ درجة',
    degreeOnWheel: 315,
  },
  {
    name: 'March 21',     nameAr: '٢١ مارس',
    month: 3,  day: 21,  type: 'major',
    event:   'Vernal Equinox (0°)',
    eventAr: 'الاعتدال الربيعي — ٠ درجة',
    degreeOnWheel: 0,
  },
  {
    name: 'May 6',        nameAr: '٦ مايو',
    month: 5,  day: 6,   type: 'minor',
    event:   'Spring Cross-Quarter (45°)',
    eventAr: 'نقطة التقاطع الربيعي — ٤٥ درجة',
    degreeOnWheel: 45,
  },
  {
    name: 'June 21',      nameAr: '٢١ يونيو',
    month: 6,  day: 21,  type: 'major',
    event:   'Summer Solstice (90°)',
    eventAr: 'الانقلاب الصيفي — ٩٠ درجة',
    degreeOnWheel: 90,
  },
  {
    name: 'August 8',     nameAr: '٨ أغسطس',
    month: 8,  day: 8,   type: 'minor',
    event:   'Summer Cross-Quarter (135°)',
    eventAr: 'نقطة التقاطع الصيفي — ١٣٥ درجة',
    degreeOnWheel: 135,
  },
  {
    name: 'September 21', nameAr: '٢١ سبتمبر',
    month: 9,  day: 21,  type: 'major',
    event:   'Autumnal Equinox (180°)',
    eventAr: 'الاعتدال الخريفي — ١٨٠ درجة',
    degreeOnWheel: 180,
  },
  {
    name: 'November 8',   nameAr: '٨ نوفمبر',
    month: 11, day: 8,   type: 'minor',
    event:   'Autumn Cross-Quarter (225°)',
    eventAr: 'نقطة التقاطع الخريفي — ٢٢٥ درجة',
    degreeOnWheel: 225,
  },
  {
    name: 'December 21',  nameAr: '٢١ ديسمبر',
    month: 12, day: 21,  type: 'major',
    event:   'Winter Solstice (270°)',
    eventAr: 'الانقلاب الشتوي — ٢٧٠ درجة',
    degreeOnWheel: 270,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

function daysInYear(year: number): number {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
}

function getPointDOY(p: GannPoint, year: number): number {
  return dayOfYear(new Date(year, p.month - 1, p.day));
}

// ─── Main Calculator ──────────────────────────────────────────────────────────

export function computeGann(now: Date = new Date()): GannResult {
  const year      = now.getFullYear();
  const totalDays = daysInYear(year);
  const todayDOY  = dayOfYear(now);
  const todayAngle = (todayDOY / totalDays) * 360;

  // Annotate each point with calendar metadata for this year
  const points: GannPointWithMeta[] = GANN_POINTS.map(p => {
    const doy   = getPointDOY(p, year);
    const angle = (doy / totalDays) * 360;
    return { ...p, dayOfYear: doy, angle, daysAway: doy - todayDOY };
  });

  // Nearest point (could be slightly in the past)
  const nearest = points.reduce((best, p) =>
    Math.abs(p.daysAway) < Math.abs(best.daysAway) ? p : best
  );

  // Next future point (wrap to next year if needed)
  const futurePoints = points
    .map(p => ({
      ...p,
      daysAway: p.daysAway >= 0 ? p.daysAway
                : getPointDOY(p, year + 1) - todayDOY + totalDays,
    }))
    .sort((a, b) => a.daysAway - b.daysAway);
  const nextPoint = futurePoints[0];

  // Status logic (per spec)
  const absProx = Math.abs(nearest.daysAway);
  let status: GannStatus = 'STABLE';
  if (nearest.type === 'major' && absProx <= 1) status = 'CRITICAL';
  else if (absProx <= 3)                        status = 'WARNING';

  // Format next point date
  const nextDate = new Date(year, nextPoint.month - 1, nextPoint.day);
  if (nextDate < now) nextDate.setFullYear(year + 1);
  const nextPointDate = nextDate.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  // Advisory text
  const advisoryEn = buildAdvisoryEn(status, nearest, nextPoint);
  const advisoryAr = buildAdvisoryAr(status, nearest, nextPoint);

  return {
    status, todayDayOfYear: todayDOY, todayAngle,
    nextPoint, nextPointDate, daysToNext: nextPoint.daysAway,
    nearestPoint: nearest, proximityDays: absProx,
    points, advisoryAr, advisoryEn,
  };
}

// ─── Advisory Builders ────────────────────────────────────────────────────────

function buildAdvisoryEn(
  status:    GannStatus,
  nearest:   GannPointWithMeta,
  next:      GannPointWithMeta,
): string {
  if (status === 'CRITICAL') {
    return `We are precisely at the ${nearest.event}. W.D. Gann identified this as a high-probability market reversal window. Exercise extreme caution with open positions.`;
  }
  if (status === 'WARNING') {
    const dir = nearest.daysAway < 0 ? 'passed' : 'approaching';
    return `The ${nearest.event} has ${dir} within ${Math.abs(nearest.daysAway)} day(s). Historical cycles suggest elevated volatility. Monitor price action closely.`;
  }
  return `Markets are in a stable geometric window. The next time cycle inflection is ${next.event} on ${next.name} — ${next.daysAway} day(s) away. No elevated cycle risk detected.`;
}

function buildAdvisoryAr(
  status:    GannStatus,
  nearest:   GannPointWithMeta,
  next:      GannPointWithMeta,
): string {
  if (status === 'CRITICAL') {
    return `نحن بالضبط عند ${nearest.eventAr}. حدّد غان هذه اللحظة كنافذة احتمال عالية لانعكاس السوق. توخَّ الحذر الشديد مع المراكز المفتوحة.`;
  }
  if (status === 'WARNING') {
    const dir = nearest.daysAway < 0 ? 'مرّت قبل' : 'على بُعد';
    return `${nearest.eventAr} — ${dir} ${Math.abs(nearest.daysAway)} يوم/أيام. تشير الدورات التاريخية إلى تقلب متصاعد. راقب حركة السعر بعناية.`;
  }
  return `الأسواق في نافذة هندسية مستقرة. نقطة الانقلاب الدورية القادمة هي ${next.eventAr} بعد ${next.daysAway} يوم. لا يوجد خطر دوري مرتفع حالياً.`;
}
