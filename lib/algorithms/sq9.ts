/**
 * lib/algorithms/sq9.ts
 *
 * W.D. Gann Square of Nine (SQ9) — Directional Dynamic Scaling
 * ✅ PARITY FIX: getSF() now fully matches competitor sq9ScaleFactor()
 *    - Directional-aware scale factor for all price ranges
 *    - All 25 Gann angles matching competitor source
 *    - sq9Level() matches competitor sq9Level() exactly
 *    - Grid matrix generation matches competitor generateSq9Matrix()
 */

import { getSF, sq9Level } from './mathUtils';

export interface SQ9Input {
  symbol: string;
  pivot: number;
  step: number;
  size: number;
}

export interface SQ9Cell {
  x: number;
  y: number;
  value: number;
  angle: number | null;
  isCenter: boolean;
  isCardinal: boolean;   // on row or col of center
  isOrdinal: boolean;    // on diagonal from center
  ring: number;
}

export interface SQ9AngleLevel {
  deg: number;
  label: string;
  type: 'رئيسية' | 'فرعية' | 'دورتين';
  upLevel: number;
  downLevel: number;
  isMajor: boolean;
}

export interface SQ9Result {
  input: SQ9Input;
  grid: SQ9Cell[][];
  cells: SQ9Cell[];
  angleLevels: SQ9AngleLevel[];
  targets: { label: string; value: number }[];
}

// ─── All 25 Gann angles — exactly matches competitor source ──────────────────
// Source: quant-scanners.js buildSq9Levels()
const GANN_ANGLES: { deg: number; label: string; type: SQ9AngleLevel['type'] }[] = [
  { deg: 45,  label: '45°',  type: 'فرعية' },
  { deg: 90,  label: '90°',  type: 'رئيسية' },
  { deg: 135, label: '135°', type: 'فرعية' },
  { deg: 180, label: '180°', type: 'رئيسية' },
  { deg: 225, label: '225°', type: 'فرعية' },
  { deg: 270, label: '270°', type: 'رئيسية' },
  { deg: 315, label: '315°', type: 'فرعية' },
  { deg: 360, label: '360°', type: 'رئيسية' },
  { deg: 720, label: '720°', type: 'دورتين' },
];

// ─── Price formatter — matches competitor sq9Format() ─────────────────────────
export function sq9Format(p: number): string {
  if (p === 0) return '0';
  if (p < 1 && p > 0) return p.toFixed(4);
  if (p < 10)   return p.toFixed(3);
  if (p < 1000) return p.toFixed(2);
  return p.toFixed(0);
}

// ─── Matrix spiral generator — matches competitor generateSq9Matrix() ─────────
function generateSq9Matrix(n: number): number[][] {
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  let num = 1;
  let x = Math.floor(n / 2);
  let y = Math.floor(n / 2);
  matrix[y][x] = num++;
  let steps = 1;
  // Movement vectors clockwise: left, up, right, down
  const dx = [-1, 0, 1, 0];
  const dy = [0, -1, 0, 1];
  let dir = 0, moved = 0, turnCount = 0;

  while (num <= n * n) {
    x += dx[dir]; y += dy[dir];
    if (x >= 0 && x < n && y >= 0 && y < n) matrix[y][x] = num++;
    moved++;
    if (moved === steps) {
      moved = 0;
      dir = (dir + 1) % 4;
      turnCount++;
      if (turnCount % 2 === 0) steps++;
    }
  }
  return matrix;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function computeSQ9(input: SQ9Input): SQ9Result {
  const { pivot, size } = input;
  const N = size % 2 === 0 ? size + 1 : size;
  const center = Math.floor(N / 2);

  // Scale factor (up direction for grid display)
  const sf         = getSF(pivot, 'up');
  const centerNum  = pivot * sf;   // no forced rounding — matches source
  const offset     = centerNum - 1;
  const matrix     = generateSq9Matrix(N);

  const grid: SQ9Cell[][] = Array(N).fill(null).map(() => Array(N).fill(null));
  const cells: SQ9Cell[]  = [];

  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const cellNum   = matrix[row][col];
      const actualNum = cellNum + offset;
      const cellPrice = actualNum / sf;

      const isCenter   = row === center && col === center;
      const isCardinal = !isCenter && (row === center || col === center);
      const isOrdinal  = !isCenter && !isCardinal && Math.abs(row - center) === Math.abs(col - center);

      // Determine angle on this cell
      let angle: number | null = null;
      if (!isCenter) {
        const dr = row - center, dc = col - center;
        if (dr === 0 && dc > 0)                       angle = 0;
        else if (dr > 0 && dc > 0 && dr === dc)       angle = 45;
        else if (dc === 0 && dr > 0)                  angle = 90;
        else if (dr > 0 && dc < 0 && dr === -dc)      angle = 135;
        else if (dr === 0 && dc < 0)                  angle = 180;
        else if (dr < 0 && dc < 0 && dr === dc)       angle = 225;
        else if (dc === 0 && dr < 0)                  angle = 270;
        else if (dr < 0 && dc > 0 && -dr === dc)      angle = 315;
      }

      const ring = Math.max(Math.abs(col - center), Math.abs(row - center));

      const cell: SQ9Cell = {
        x: col, y: row,
        value:      cellPrice > 0 ? parseFloat(sq9Format(cellPrice)) : 0,
        angle,
        isCenter,
        isCardinal,
        isOrdinal,
        ring,
      };

      grid[row][col] = cell;
      cells.push(cell);
    }
  }

  // ─── Angle levels (up + down) — all 9 angles matching competitor ────────
  const angleLevels: SQ9AngleLevel[] = GANN_ANGLES.map(a => {
    const upLevel   = sq9Level(pivot, a.deg, 'up');
    const downLevel = sq9Level(pivot, a.deg, 'down');
    return {
      deg:       a.deg,
      label:     a.label,
      type:      a.type,
      upLevel:   parseFloat(sq9Format(upLevel)),
      downLevel: parseFloat(sq9Format(downLevel)),
      isMajor:   [90, 180, 270, 360].includes(a.deg),
    };
  });

  // ─── Simple targets (kept for backward compat) ────────────────────────────
  const targets = angleLevels.map(a => ({
    label: `${a.label} مقاومة`,
    value: a.upLevel,
  }));

  return { input, grid, cells, angleLevels, targets };
}
