/**
 * lib/algorithms/mtfcScanner.ts
 *
 * MTFC Scanner (التقاء الفريمات المتعددة)
 * Analyzes multiple timeframes for structural conditions:
 * - التباعد التقني (Divergence - DIV)
 * - تمركز السيولة (Order Blocks - OB)
 * - الفجوة العادلة (Fair Value Gap - FVG)
 * - نسبة الارتداد (Fibonacci - FIB)
 */

import type { Kline } from '@/lib/binance/fetcher';
import { calculateWilderMA } from './mathUtils';

export interface MTFChartPoint {
  time: number;
  value: number; // RSI value
}

export interface StructCondition {
  active: boolean;
  text: string;     // e.g. "63%" or "مرصودة ✔️" or "-"
  grade: number;    // 0 or 1 for scoring
}

export interface MTFCResultTF {
  timeframe: string; // '1H', '4H', '1D'
  confluenceCount: number; // e.g. 2
  maxConfluence: number;   // 4
  div: StructCondition;
  ob: StructCondition;
  fvg: StructCondition;
  fib: StructCondition;
  chartData: MTFChartPoint[]; // Last 30 points for the sparkline
}

export interface MTFCResult {
  symbol: string;
  grade: 'A' | 'B' | 'C' | 'D';
  score: number; // 0 - 100
  verdictTitle: string; // e.g. "إشارة مسار صاعد // ضعيف (WEAK)"
  verdictText: string;
  timeframes: MTFCResultTF[];
}

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function calcRSIArray(klines: Kline[], period = 14): number[] {
  const rsiArr = new Array(klines.length).fill(50);
  let gains = 0, losses = 0;
  
  if (klines.length <= period) return rsiArr;

  for (let i = 1; i <= period; i++) {
    const diff = klines[i].close - klines[i - 1].close;
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsiArr[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < klines.length; i++) {
    const diff = klines[i].close - klines[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsiArr[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  return rsiArr;
}

function detectDivergence(klines: Kline[], rsiArr: number[]): StructCondition {
  if (klines.length < 20) return { active: false, text: '-', grade: 0 };
  
  // Simple divergence detection over last 15 candles
  const lookback = 15;
  const recentKlines = klines.slice(-lookback);
  const recentRSI = rsiArr.slice(-lookback);
  
  const currentPrice = recentKlines[recentKlines.length - 1].close;
  const currentRSI = recentRSI[recentRSI.length - 1];
  
  let lowestPrice = Infinity;
  let lowestPriceIdx = -1;
  let highestPrice = -Infinity;
  let highestPriceIdx = -1;
  
  for(let i=0; i<lookback-2; i++) {
      if (recentKlines[i].low < lowestPrice) {
          lowestPrice = recentKlines[i].low;
          lowestPriceIdx = i;
      }
      if (recentKlines[i].high > highestPrice) {
          highestPrice = recentKlines[i].high;
          highestPriceIdx = i;
      }
  }
  
  let divProb = 0;
  
  // Bullish Div: Lower low in price, higher low in RSI
  if (currentPrice < lowestPrice && currentRSI > recentRSI[lowestPriceIdx]) {
      divProb = Math.min(95, 40 + Math.abs(currentRSI - recentRSI[lowestPriceIdx]) * 2);
  }
  // Bearish Div: Higher high in price, lower high in RSI
  else if (currentPrice > highestPrice && currentRSI < recentRSI[highestPriceIdx]) {
      divProb = Math.min(95, 40 + Math.abs(recentRSI[highestPriceIdx] - currentRSI) * 2);
  }

  if (divProb > 30) {
      return { active: true, text: `${Math.round(divProb)}%`, grade: 1 };
  }
  
  return { active: false, text: '-', grade: 0 };
}

function detectFVG(klines: Kline[]): StructCondition {
  if (klines.length < 3) return { active: false, text: '-', grade: 0 };
  // Look for FVG in the last 5 candles
  for (let i = klines.length - 5; i < klines.length - 1; i++) {
      if (i < 1) continue;
      // Bullish FVG
      if (klines[i-1].high < klines[i+1].low) {
          return { active: true, text: 'مرصودة ✔️', grade: 1 };
      }
      // Bearish FVG
      if (klines[i-1].low > klines[i+1].high) {
          return { active: true, text: 'مرصودة ✔️', grade: 1 };
      }
  }
  return { active: false, text: '-', grade: 0 };
}

function detectOB(klines: Kline[]): StructCondition {
  // Simple Order Block detection (last down candle before strong up move, or vice versa)
  if (klines.length < 10) return { active: false, text: '-', grade: 0 };
  
  let hasOB = false;
  // Just a heuristic for the mock
  const recent = klines.slice(-5);
  const upMove = recent[4].close > recent[0].close * 1.01;
  const downMove = recent[4].close < recent[0].close * 0.99;
  
  if (upMove && recent[1].close < recent[1].open) hasOB = true; // Bullish OB
  if (downMove && recent[1].close > recent[1].open) hasOB = true; // Bearish OB
  
  if (hasOB) return { active: true, text: 'مرصودة ✔️', grade: 1 };
  return { active: false, text: '-', grade: 0 };
}

function detectFIB(klines: Kline[]): StructCondition {
  if (klines.length < 50) return { active: false, text: '-', grade: 0 };
  const recent = klines.slice(-50);
  const maxH = Math.max(...recent.map(k => k.high));
  const minL = Math.min(...recent.map(k => k.low));
  const range = maxH - minL;
  const current = klines[klines.length - 1].close;
  
  const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
  for (const lvl of levels) {
      const fibPriceBull = minL + range * lvl;
      const fibPriceBear = maxH - range * lvl;
      // If price is within 0.5% of a fib level
      if (Math.abs(current - fibPriceBull)/current < 0.005 || Math.abs(current - fibPriceBear)/current < 0.005) {
          return { active: true, text: 'مستوى '+lvl, grade: 1 };
      }
  }
  return { active: false, text: '-', grade: 0 };
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

export function calculateMTFCScanner(
  symbol: string,
  klines1H: Kline[],
  klines4H: Kline[],
  klines1D: Kline[]
): MTFCResult {
  
  const resultsTF: MTFCResultTF[] = [];
  let totalGrade = 0;
  
  const tfs = [
      { name: '1H', klines: klines1H },
      { name: '4H', klines: klines4H },
      { name: '1D', klines: klines1D }
  ];
  
  for (const tf of tfs) {
      const rsiArr = calcRSIArray(tf.klines, 14);
      
      const div = detectDivergence(tf.klines, rsiArr);
      const ob = detectOB(tf.klines);
      const fvg = detectFVG(tf.klines);
      const fib = detectFIB(tf.klines);
      
      const confCount = div.grade + ob.grade + fvg.grade + fib.grade;
      totalGrade += confCount;
      
      const chartData: MTFChartPoint[] = [];
      const chartPoints = 30; // Last 30 candles
      const startIdx = Math.max(0, tf.klines.length - chartPoints);
      
      for(let i=startIdx; i<tf.klines.length; i++) {
          chartData.push({
              time: tf.klines[i].time,
              value: rsiArr[i] || 50
          });
      }
      
      resultsTF.push({
          timeframe: tf.name,
          confluenceCount: confCount,
          maxConfluence: 4,
          div,
          ob,
          fvg,
          fib,
          chartData
      });
  }
  
  // Max possible grade is 12 (4 conditions * 3 timeframes)
  // Normalizing to 100
  const score = Math.round((totalGrade / 12) * 100);
  
  let grade: 'A' | 'B' | 'C' | 'D' = 'D';
  if (score >= 80) grade = 'A';
  else if (score >= 60) grade = 'B';
  else if (score >= 40) grade = 'C';
  
  let verdictTitle = '';
  let verdictText = '';
  
  if (grade === 'A' || grade === 'B') {
      verdictTitle = 'إشارة مسار قوي // قوية (STRONG)';
      verdictText = 'التشابك التقني بين الفريمات إيجابي ويدعم اتجاه موحد. توجد إعدادات متكاملة تلبي معايير الالتقاء المؤسسي. المعطيات الحالية تدعو للبحث عن صفقات مع الاتجاه المدعوم بالسيولة.';
  } else {
      verdictTitle = 'إشارة مسار ضعيف // ضعيف (WEAK)';
      verdictText = 'التشابك التقني بين الفريمات منعدم أو متضارب حالياً. لا يوجد إعداد متكامل الأركان يلبي معايير الالتقاء المؤسسي الصارمة. المعطيات الحالية تدعو للالتزام الحياد الكامل لحين اتضاح الرؤية السعرية وبناء مناطق تمركز السيولة.';
  }
  
  return {
      symbol,
      grade,
      score,
      verdictTitle,
      verdictText,
      timeframes: resultsTF
  };
}
