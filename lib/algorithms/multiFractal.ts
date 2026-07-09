/**
 * lib/algorithms/multiFractal.ts
 *
 * Multi-Scale Fractal (Williams Fractal)
 * Analyzes structural highs and lows across 3 different scales.
 */

import type { Kline } from '@/lib/binance/fetcher';

export interface FractalLevel {
  price: number;
  type: 'Resistance' | 'Support';
  strength: 'Strong' | 'Medium' | 'Weak';
  age: number; // Candles since formation
}

export interface FractalScaleResult {
  scaleName: string; // "Short-Term", "Mid-Term", "Long-Term"
  period: number; // 2, 5, 10
  levels: FractalLevel[];
}

export interface FractalResult {
  symbol: string;
  scales: FractalScaleResult[];
  verdict: string;
  klines: Kline[];
}

function detectFractals(klines: Kline[], period: number): FractalLevel[] {
  const levels: FractalLevel[] = [];
  if (klines.length < period * 2 + 1) return levels;

  for (let i = period; i < klines.length - period; i++) {
    let isHigh = true;
    let isLow = true;
    const currentHigh = klines[i].high;
    const currentLow = klines[i].low;

    for (let j = 1; j <= period; j++) {
      if (klines[i - j].high >= currentHigh || klines[i + j].high >= currentHigh) {
        isHigh = false;
      }
      if (klines[i - j].low <= currentLow || klines[i + j].low <= currentLow) {
        isLow = false;
      }
    }

    const age = klines.length - 1 - i;
    const strength = period >= 10 ? 'Strong' : period >= 5 ? 'Medium' : 'Weak';

    if (isHigh) {
      levels.push({ price: currentHigh, type: 'Resistance', strength, age });
    }
    if (isLow) {
      levels.push({ price: currentLow, type: 'Support', strength, age });
    }
  }

  return levels.slice(-5); // Return the 5 most recent fractals for this scale
}

export function analyzeMultiFractal(symbol: string, klines: Kline[]): FractalResult {
  const scales = [
    { name: 'Short-Term (Micro)', period: 2 },
    { name: 'Mid-Term (Swing)', period: 5 },
    { name: 'Long-Term (Macro)', period: 10 }
  ];

  const results: FractalScaleResult[] = [];
  let supportCount = 0;
  let resistanceCount = 0;
  const currentPrice = klines[klines.length - 1].close;

  for (const scale of scales) {
    const levels = detectFractals(klines, scale.period);
    // Sort by most recent
    levels.sort((a, b) => a.age - b.age);
    
    levels.forEach(l => {
      if (l.type === 'Support') supportCount++;
      else resistanceCount++;
    });

    results.push({
      scaleName: scale.name,
      period: scale.period,
      levels
    });
  }

  // Generate verdict
  let verdict = '';
  const closestSupport = Math.max(...results.flatMap(r => r.levels.filter(l => l.type === 'Support').map(l => l.price)));
  const closestResistance = Math.min(...results.flatMap(r => r.levels.filter(l => l.type === 'Resistance').map(l => l.price)));

  if (closestSupport === -Infinity && closestResistance === Infinity) {
    verdict = 'تتداول العملة في نطاق بلا معالم هيكلية واضحة (سوق عشوائي).';
  } else if (currentPrice > closestSupport && currentPrice < closestResistance) {
    verdict = 'السعر محصور بين مستويات هيكلية قوية. يُنصح بانتظار اختراق المقاومة أو الارتداد من الدعم.';
  } else if (currentPrice >= closestResistance) {
    verdict = 'السعر يخترق أقرب مقاومة هيكلية. إشارة إيجابية لاحتمال تكوين قمة جديدة.';
  } else {
    verdict = 'السعر يكسر أقرب دعم هيكلي. إشارة سلبية تتطلب الحذر من استمرار الهبوط.';
  }

  return {
    symbol,
    scales: results,
    verdict,
    klines
  };
}
