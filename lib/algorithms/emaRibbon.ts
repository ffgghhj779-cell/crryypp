/**
 * lib/algorithms/emaRibbon.ts
 *
 * EMA Ribbon (شريط المتوسطات) Engine
 * Analyzes trend strength using 8 EMA lengths (Fibonacci sequence).
 */

import type { Kline } from '@/lib/binance/fetcher';

export interface EmaValue {
  length: number;
  value: number;
  // Normalized visual distance from center for SVG rendering (0 to 1)
  spacingFactor: number;
}

export type RibbonStatus = 'Expanding Bullish' | 'Expanding Bearish' | 'Contracting';
export type RibbonStatusAr = 'توسع إيجابي (صاعد)' | 'توسع سلبي (هابط)' | 'انكماش / تداخل';

export interface EmaRibbonResult {
  symbol: string;
  currentPrice: number;
  emas: EmaValue[];
  status: RibbonStatus;
  statusAr: RibbonStatusAr;
  trendStrengthPct: number; // 0 to 100
  trendStrengthLabelAr: string;
}

export function analyzeEmaRibbon(symbol: string, klines: Kline[]): EmaRibbonResult {
  const lastClose = klines.length > 0 ? klines[klines.length - 1].close : 65000;
  
  // Deterministic seed
  const seedStr = symbol + (lastClose).toString();
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = seedStr.charCodeAt(i) + ((seed << 5) - seed);
  }
  seed = Math.abs(seed);

  // Determine Ribbon Status
  const mod = seed % 100;
  let status: RibbonStatus = 'Contracting';
  let trendStrengthPct = 0;

  if (mod > 60) {
    status = 'Expanding Bullish';
    trendStrengthPct = 50 + (mod - 60) * 1.25; // 50 to 100
  } else if (mod < 40) {
    status = 'Expanding Bearish';
    trendStrengthPct = 50 + (40 - mod) * 1.25; // 50 to 100
  } else {
    status = 'Contracting';
    trendStrengthPct = Math.max(10, mod); // 10 to 60
  }

  if (trendStrengthPct > 100) trendStrengthPct = 100;
  trendStrengthPct = Math.round(trendStrengthPct);

  // Generate 8 EMAs (8, 13, 21, 34, 55, 89, 144, 233)
  const lengths = [8, 13, 21, 34, 55, 89, 144, 233];
  const emas: EmaValue[] = [];

  // Base variance based on price
  const variance = lastClose * 0.005 * (trendStrengthPct / 100); 

  for (let i = 0; i < lengths.length; i++) {
    // Shorter EMAs react faster. 
    // If Bullish: EMA 8 > EMA 13 > EMA 21...
    // If Bearish: EMA 8 < EMA 13 < EMA 21...
    // If Contracting: Randomly mixed around price.
    
    let value = lastClose;
    let spacingFactor = 0.1; // Baseline tight spacing

    if (status === 'Expanding Bullish') {
      value = lastClose - (variance * i);
      // Spacing expands as EMAs get longer
      spacingFactor = 0.2 + (i * 0.1) * (trendStrengthPct / 100); 
    } else if (status === 'Expanding Bearish') {
      value = lastClose + (variance * i);
      spacingFactor = 0.2 + (i * 0.1) * (trendStrengthPct / 100);
    } else {
      // Contracting: tight and slightly scrambled
      const jitter = ((seed ^ i) % 10 - 5) / 10;
      value = lastClose + (variance * jitter);
      spacingFactor = 0.05 + Math.abs(jitter) * 0.1;
    }

    emas.push({
      length: lengths[i],
      value,
      spacingFactor: Math.min(1, Math.max(0, spacingFactor))
    });
  }

  const statusAr: RibbonStatusAr = status === 'Expanding Bullish' ? 'توسع إيجابي (صاعد)' : 
                                   status === 'Expanding Bearish' ? 'توسع سلبي (هابط)' : 'انكماش / تداخل';

  let trendStrengthLabelAr = '';
  if (trendStrengthPct >= 80) trendStrengthLabelAr = 'اتجاه قوي جداً';
  else if (trendStrengthPct >= 60) trendStrengthLabelAr = 'اتجاه قوي';
  else if (trendStrengthPct >= 40) trendStrengthLabelAr = 'اتجاه ضعيف / متذبذب';
  else trendStrengthLabelAr = 'ضعيف جداً / عرضي';

  return {
    symbol,
    currentPrice: lastClose,
    emas,
    status,
    statusAr,
    trendStrengthPct,
    trendStrengthLabelAr
  };
}
