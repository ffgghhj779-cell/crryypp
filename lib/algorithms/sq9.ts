/**
 * lib/algorithms/sq9.ts
 *
 * W.D. Gann Square of Nine (SQ9) Matrix Generator
 * Generates an outward clockwise spiral starting from a center pivot.
 */

export interface SQ9Input {
  symbol: string;
  pivot: number;
  step: number;
  size: number; // Must be an odd number (e.g., 9, 11, 13)
}

export interface SQ9Cell {
  x: number;
  y: number;
  value: number;
  angle: number | null; // 0, 45, 90, 135, 180, 225, 270, 315 or null
  isCenter: boolean;
  ring: number; // distance from center (0 = center)
}

export interface SQ9Result {
  input: SQ9Input;
  grid: SQ9Cell[][]; // 2D array [y][x]
  cells: SQ9Cell[];  // flat array ordered by generation (spiral outward)
  targets: { label: string; value: number }[];
}

export function computeSQ9(input: SQ9Input): SQ9Result {
  const { pivot, step, size } = input;
  const N = size % 2 === 0 ? size + 1 : size; // ensure odd
  const center = Math.floor(N / 2);
  
  // Initialize empty grid
  const grid: SQ9Cell[][] = Array(N).fill(null).map(() => Array(N).fill(null));
  const cells: SQ9Cell[] = [];
  
  let x = center;
  let y = center;
  
  // Directions: Right(1,0), Down(0,1), Left(-1,0), Up(0,-1)
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];
  
  let dir = 0; // start moving right
  let segmentLength = 1;
  let segmentPassed = 0;
  
  let currentValue = pivot;
  const totalCells = N * N;
  
  for (let i = 0; i < totalCells; i++) {
    const isCenter = (x === center && y === center);
    
    // Determine angle based on geometric cross/diagonals
    let angle: number | null = null;
    if (!isCenter) {
      if (y === center && x > center) angle = 0;
      else if (x > center && y > center && (x - center) === (y - center)) angle = 45;
      else if (x === center && y > center) angle = 90;
      else if (x < center && y > center && (center - x) === (y - center)) angle = 135;
      else if (y === center && x < center) angle = 180;
      else if (x < center && y < center && (center - x) === (center - y)) angle = 225;
      else if (x === center && y < center) angle = 270;
      else if (x > center && y < center && (x - center) === (center - y)) angle = 315;
    }
    
    const ring = Math.max(Math.abs(x - center), Math.abs(y - center));
    
    const cell: SQ9Cell = {
      x, y,
      value: parseFloat(currentValue.toFixed(4)),
      angle,
      isCenter,
      ring
    };
    
    grid[y][x] = cell;
    cells.push(cell);
    
    // Move to next cell
    x += dx[dir];
    y += dy[dir];
    segmentPassed++;
    
    if (segmentPassed === segmentLength) {
      segmentPassed = 0;
      dir = (dir + 1) % 4; // Turn right
      // Increase segment length every 2 turns (Right-Down is 1-1, Left-Up is 2-2, etc)
      if (dir === 0 || dir === 2) {
        segmentLength++;
      }
    }
    
    currentValue += step;
  }
  
  // Mathematical arithmetic targets typically associated with Gann calculations
  // Square root price logic: Target = (sqrt(pivot) + factor)^2
  const sqrtPivot = Math.sqrt(pivot);
  const t1 = Math.pow(sqrtPivot + 1, 2);
  const t2 = Math.pow(sqrtPivot + 2, 2);
  const t3 = Math.pow(sqrtPivot + 3, 2);
  
  const targets = [
    { label: 'Target 1 (+1 Factor)', value: parseFloat(t1.toFixed(4)) },
    { label: 'Target 2 (+2 Factor)', value: parseFloat(t2.toFixed(4)) },
    { label: 'Target 3 (+3 Factor)', value: parseFloat(t3.toFixed(4)) },
  ];
  
  return {
    input,
    grid,
    cells,
    targets
  };
}
