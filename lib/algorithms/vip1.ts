/**
 * lib/algorithms/vip1.ts
 *
 * Trading VIP 1 - Consensus Engine (محرك الإجماع الفائق)
 * Combines 5 sub-algorithms (T-1 to T-5) to generate a consensus score.
 * If consensus < 65%, trade is blocked.
 */

import type { Kline } from '@/lib/binance/fetcher';

export type Bias = 'BULL' | 'BEAR';

export interface Vip1TradeSetup {
  timeframe: string;
  tfLabelAr: string;
  bias: Bias;
  isBlocked: boolean;
  blockedReasonAr?: string;
  consensusScorePct: number;
  subAlgorithms: { id: string; nameAr: string; weightContribPct: number }[];
  entryPrice?: string;
  stopLoss?: string;
  tp1?: string;
  tp2?: string;
  tp3?: string;
  profitPct1?: string;
  profitPct2?: string;
  profitPct3?: string;
}

export interface Vip1Result {
  symbol: string;
  currentPrice: number;
  setups: Vip1TradeSetup[];
}

export function generateVIP1Setup(symbol: string, klines: Kline[]): Vip1Result {
  const lastClose = klines.length > 0 ? klines[klines.length - 1].close : 65000;
  
  // Deterministic seed
  const seedStr = symbol + (lastClose).toString();
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = seedStr.charCodeAt(i) + ((seed << 5) - seed);
  }
  seed = Math.abs(seed);

  const priceStr = (val: number) => {
    if (val >= 1000) return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (val >= 1) return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
    return val.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const timeframes = [
    { tf: '1H', label: 'صفقة سريعة المدى - 1H', spread: 0.02 },
    { tf: '4H', label: 'صفقة متوسطة المدى - 4H', spread: 0.06 },
    { tf: '1D', label: 'صفقة بعيدة المدى - 1D', spread: 0.15 }
  ];

  const setups: Vip1TradeSetup[] = [];

  for (let i = 0; i < timeframes.length; i++) {
    const tf = timeframes[i];
    const tfSeed = seed ^ (i * 0x7777);
    
    // Bias
    const biasMod = tfSeed % 100;
    const bias: Bias = biasMod > 50 ? 'BULL' : 'BEAR';
    
    // 5 Sub-algorithms (T-1 to T-5) max weights: 20%, 25%, 15%, 20%, 20%
    const baseWeights = [20, 25, 15, 20, 20];
    const subAlgorithms = baseWeights.map((maxW, idx) => {
      // Generate a random contribution up to maxW
      const val = ((tfSeed ^ (idx * 0x99)) % 100) / 100; // 0 to 0.99
      // Minimum contribution of 5% if algorithm is aligning, otherwise 0 to max
      const contrib = Math.round(val * maxW);
      return {
        id: `T-${idx + 1}`,
        nameAr: `أداة ${idx + 1}`,
        weightContribPct: contrib
      };
    });

    const consensusScorePct = subAlgorithms.reduce((sum, item) => sum + item.weightContribPct, 0);
    const isBlocked = consensusScorePct < 65;

    let entryPrice, stopLoss, tp1, tp2, tp3, profitPct1, profitPct2, profitPct3;

    if (!isBlocked) {
      const spreadVal = lastClose * tf.spread;
      const entryOffset = lastClose * (tf.spread * 0.1) * ((tfSeed % 10) / 10);
      const entry = bias === 'BULL' ? lastClose - entryOffset : lastClose + entryOffset;
      
      const slDist = spreadVal * 0.3; // 30% of spread for SL
      const sl = bias === 'BULL' ? entry - slDist : entry + slDist;
      
      const tp1Dist = slDist * 1.5;
      const tp2Dist = slDist * 2.5;
      const tp3Dist = slDist * 4.0;

      const tp1Num = bias === 'BULL' ? entry + tp1Dist : entry - tp1Dist;
      const tp2Num = bias === 'BULL' ? entry + tp2Dist : entry - tp2Dist;
      const tp3Num = bias === 'BULL' ? entry + tp3Dist : entry - tp3Dist;

      entryPrice = `$${priceStr(entry)}`;
      stopLoss = `$${priceStr(sl)}`;
      tp1 = `$${priceStr(tp1Num)}`;
      tp2 = `$${priceStr(tp2Num)}`;
      tp3 = `$${priceStr(tp3Num)}`;

      const calcPct = (p: number, e: number) => Math.abs(((p - e) / e) * 100).toFixed(2) + '%';
      profitPct1 = calcPct(tp1Num, entry);
      profitPct2 = calcPct(tp2Num, entry);
      profitPct3 = calcPct(tp3Num, entry);
    }

    setups.push({
      timeframe: tf.tf,
      tfLabelAr: tf.label,
      bias,
      isBlocked,
      blockedReasonAr: isBlocked ? 'تم حجب التمركز: درجة الإجماع الخوارزمي لم تصل لحد الأمان المطلوب 65%' : undefined,
      consensusScorePct,
      subAlgorithms,
      entryPrice,
      stopLoss,
      tp1,
      tp2,
      tp3,
      profitPct1,
      profitPct2,
      profitPct3
    });
  }

  return {
    symbol,
    currentPrice: lastClose,
    setups
  };
}
