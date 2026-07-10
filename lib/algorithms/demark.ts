
import { Kline } from '../binance/fetcher';
export interface ChartMarker { time: number; position: string; shape: string; color: string; text: string; size: number; }
export interface TDResult { setupCount: number; direction: 'buy' | 'sell' | 'none'; td9reached: boolean; currentPrice: number; priceAtSetup1: number; klines: Kline[]; markers: ChartMarker[]; }

export function calcTDSequential(klines: Kline[]): TDResult {
  const markers: ChartMarker[] = [];
  let buySetup = 0; let sellSetup = 0; let priceAtSetup1 = 0;

  for (let i = 4; i < klines.length; i++) {
    const isBuy = klines[i].close < klines[i - 4].close;
    const isSell = klines[i].close > klines[i - 4].close;

    if (isBuy) {
      if (buySetup === 0) priceAtSetup1 = klines[i].close;
      buySetup++; sellSetup = 0;
      if (buySetup <= 9) markers.push({ time: klines[i].time, position: 'belowBar', shape: 'arrowUp', color: buySetup === 9 ? '#10b981' : 'rgba(16, 185, 129, 0.4)', text: buySetup.toString(), size: buySetup === 9 ? 2 : 1 });
    } else if (isSell) {
      if (sellSetup === 0) priceAtSetup1 = klines[i].close;
      sellSetup++; buySetup = 0;
      if (sellSetup <= 9) markers.push({ time: klines[i].time, position: 'aboveBar', shape: 'arrowDown', color: sellSetup === 9 ? '#ef4444' : 'rgba(239, 68, 68, 0.4)', text: sellSetup.toString(), size: sellSetup === 9 ? 2 : 1 });
    } else {
      buySetup = 0; sellSetup = 0;
    }
  }

  const currentPrice = klines[klines.length - 1].close;
  const currentBuyCount = buySetup % 9 === 0 && buySetup > 0 ? 9 : buySetup % 9;
  const currentSellCount = sellSetup % 9 === 0 && sellSetup > 0 ? 9 : sellSetup % 9;
  const setupCount = Math.max(currentBuyCount, currentSellCount);
  const direction = buySetup > 0 ? 'buy' : sellSetup > 0 ? 'sell' : 'none';

  return { setupCount, direction, td9reached: setupCount === 9, currentPrice, priceAtSetup1: setupCount > 0 ? priceAtSetup1 : 0, klines, markers };
}
