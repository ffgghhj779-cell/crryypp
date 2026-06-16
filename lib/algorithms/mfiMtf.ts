/**
 * lib/algorithms/mfiMtf.ts
 *
 * Money Flow Index (MFI) on Multiple Timeframes
 * Analyzes buying vs selling pressure using volume and price.
 */

import type { Kline } from '@/lib/binance/fetcher';

export interface MFIChartPoint {
  time: number;
  value: number;
}

export interface MFITimeframeResult {
  timeframe: string;
  currentValue: number;
  status: 'Overbought' | 'Oversold' | 'Neutral';
  chartData: MFIChartPoint[];
}

export interface MFIResult {
  symbol: string;
  timeframes: MFITimeframeResult[];
  verdict: string;
}

function calculateMFI(klines: Kline[], period: number = 14): number[] {
  const mfiArr = new Array(klines.length).fill(50);
  if (klines.length <= period) return mfiArr;

  const typicalPrices = klines.map(k => (k.high + k.low + k.close) / 3);
  const rawMoneyFlow = typicalPrices.map((tp, i) => tp * klines[i].volume);

  for (let i = period; i < klines.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = 0; j < period; j++) {
      const currentIdx = i - j;
      const prevIdx = currentIdx - 1;
      
      if (typicalPrices[currentIdx] > typicalPrices[prevIdx]) {
        positiveFlow += rawMoneyFlow[currentIdx];
      } else if (typicalPrices[currentIdx] < typicalPrices[prevIdx]) {
        negativeFlow += rawMoneyFlow[currentIdx];
      }
    }

    if (negativeFlow === 0) {
      mfiArr[i] = 100;
    } else {
      const moneyRatio = positiveFlow / negativeFlow;
      mfiArr[i] = 100 - (100 / (1 + moneyRatio));
    }
  }

  return mfiArr;
}

export function analyzeMFIMTF(symbol: string, klines1H: Kline[], klines4H: Kline[], klines1D: Kline[]): MFIResult {
  const tfs = [
    { name: '1H', data: klines1H },
    { name: '4H', data: klines4H },
    { name: '1D', data: klines1D }
  ];

  const results: MFITimeframeResult[] = [];
  let overboughtCount = 0;
  let oversoldCount = 0;

  for (const tf of tfs) {
    const mfiVals = calculateMFI(tf.data, 14);
    const currentMFI = mfiVals[mfiVals.length - 1] || 50;
    
    let status: 'Overbought' | 'Oversold' | 'Neutral' = 'Neutral';
    if (currentMFI > 80) {
      status = 'Overbought';
      overboughtCount++;
    } else if (currentMFI < 20) {
      status = 'Oversold';
      oversoldCount++;
    }

    const chartPoints = 50; // Last 50 candles for the chart
    const startIdx = Math.max(0, tf.data.length - chartPoints);
    const chartData: MFIChartPoint[] = [];

    for (let i = startIdx; i < tf.data.length; i++) {
      chartData.push({
        time: tf.data[i].time,
        value: mfiVals[i] || 50
      });
    }

    results.push({
      timeframe: tf.name,
      currentValue: Math.round(currentMFI * 10) / 10,
      status,
      chartData
    });
  }

  let verdict = 'السيولة تتدفق بشكل متوازن (حياد). لا يوجد تشبع واضح في الوقت الحالي.';
  if (overboughtCount >= 2) {
    verdict = 'تشبع شرائي قوي (Overbought) على أكثر من فريم زمني! السيولة الشرائية قد تكون استُنزفت، توقع انعكاس هبوطي قريباً.';
  } else if (oversoldCount >= 2) {
    verdict = 'تشبع بيعي قوي (Oversold) على أكثر من فريم زمني! السيولة البيعية ضعفت، توقع ارتداد صعودي (موجة شراء) قريباً.';
  } else if (overboughtCount === 1) {
    verdict = 'بداية علامات تشبع شرائي على أحد الفريمات. يرجى الحذر وتجنب الشراء من القمم.';
  } else if (oversoldCount === 1) {
    verdict = 'بداية علامات تشبع بيعي على أحد الفريمات. راقب الفرص الشرائية المحتملة.';
  }

  return {
    symbol,
    timeframes: results,
    verdict
  };
}
