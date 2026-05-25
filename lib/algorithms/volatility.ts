/**
 * lib/algorithms/volatility.ts
 *
 * ATR Volatility Engine (محرك التقلبات)
 * Calculates Average True Range (ATR) and SMA of ATR to determine volatility state.
 */

import type { Kline } from '@/lib/binance/fetcher';

export type VolatilityState = 'Contracting' | 'Expanding';

export interface VolatilityResult {
  symbol: string;
  currentPrice: number;
  atrValue: number;
  smaAtrValue: number;
  state: VolatilityState;
  stateAr: string;
  safeStopLossDist: number;
  volatilityPct: number; // 0 to 100 for gauge
}

export function calculateVolatility(symbol: string, klines: Kline[]): VolatilityResult {
  const lastClose = klines.length > 0 ? klines[klines.length - 1].close : 65000;
  
  const trList: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    const prevClose = klines[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trList.push(tr);
  }

  const atrList: number[] = [];
  for (let i = 13; i < trList.length; i++) {
    const sum = trList.slice(i - 13, i + 1).reduce((a, b) => a + b, 0);
    atrList.push(sum / 14);
  }

  let atrValue = 0;
  let smaAtrValue = 0;

  if (atrList.length >= 20) {
    atrValue = atrList[atrList.length - 1];
    const sumAtr = atrList.slice(atrList.length - 20).reduce((a, b) => a + b, 0);
    smaAtrValue = sumAtr / 20;
  } else if (atrList.length > 0) {
    atrValue = atrList[atrList.length - 1];
    smaAtrValue = atrList.reduce((a, b) => a + b, 0) / atrList.length;
  } else {
    // Deterministic Mock
    const seedStr = symbol + (lastClose).toString();
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = seedStr.charCodeAt(i) + ((seed << 5) - seed);
    }
    seed = Math.abs(seed);
    
    atrValue = lastClose * 0.02 * (1 + (seed % 50) / 100);
    smaAtrValue = lastClose * 0.025;
  }

  const state: VolatilityState = atrValue > smaAtrValue ? 'Expanding' : 'Contracting';
  const stateAr = state === 'Expanding' ? 'انفجار سعري - تقلب عالي' : 'انضغاط السعر - هدوء';
  
  const safeStopLossDist = atrValue * 1.5;
  
  // Volatility Percentage for Speedometer Gauge
  // If ATR = SMA, pct = 50%
  // If ATR >= 2x SMA, pct = 100%
  // If ATR = 0, pct = 0%
  let volatilityPct = (atrValue / smaAtrValue) * 50;
  if (volatilityPct > 100) volatilityPct = 100;
  if (volatilityPct < 0 || isNaN(volatilityPct)) volatilityPct = 0;

  return {
    symbol,
    currentPrice: lastClose,
    atrValue,
    smaAtrValue,
    state,
    stateAr,
    safeStopLossDist,
    volatilityPct: Math.round(volatilityPct)
  };
}
