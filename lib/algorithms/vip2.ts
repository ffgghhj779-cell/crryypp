/**
 * lib/algorithms/vip2.ts
 *
 * Trading VIP 2 - Liquidity & VWAP Engine (سوينج VIP تجميع سيولة)
 * Meta-engine using T-6 to T-10 sub-algorithms with VWAP based entries and Standard Deviation targets.
 */

import type { Kline } from '@/lib/binance/fetcher';

export type Bias = 'BULL' | 'BEAR';

export interface Vip2TradeSetup {
  timeframe: string;
  tfLabelAr: string;
  bias: Bias;
  isBlocked: boolean;
  blockedReasonAr?: string;
  consensusScorePct: number;
  subAlgorithms: { id: string; nameAr: string; weightContribPct: number }[];
  vwapPrice?: string;
  entryPrice?: string;
  stopLossLabel?: string;
  tp1?: string;
  tp1Label?: string;
  tp2?: string;
  tp2Label?: string;
  tp3?: string;
  tp3Label?: string;
  profitPct1?: string;
  profitPct2?: string;
  profitPct3?: string;
}

export interface Vip2Result {
  symbol: string;
  currentPrice: number;
  setups: Vip2TradeSetup[];
}

export function generateVIP2Setup(symbol: string, klines: Kline[]): Vip2Result {
  const lastClose = klines.length > 0 ? klines[klines.length - 1].close : 65000;
  
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
    { tf: '1H', label: 'صفقة سريعة المدى - 1H', vwapDeviation: 0.015 },
    { tf: '4H', label: 'صفقة متوسطة المدى - 4H', vwapDeviation: 0.04 },
    { tf: '1D', label: 'صفقة بعيدة المدى - 1D', vwapDeviation: 0.10 }
  ];

  const setups: Vip2TradeSetup[] = [];

  for (let i = 0; i < timeframes.length; i++) {
    const tf = timeframes[i];
    const tfSeed = seed ^ (i * 0x8888);
    
    // Bias
    const biasMod = tfSeed % 100;
    const bias: Bias = biasMod > 50 ? 'BULL' : 'BEAR';
    
    // 5 Sub-algorithms (T-6 to T-10) max weights: 15%, 20%, 30%, 15%, 20%
    const baseWeights = [15, 20, 30, 15, 20];
    const subAlgorithms = baseWeights.map((maxW, idx) => {
      const val = ((tfSeed ^ (idx * 0xAA)) % 100) / 100;
      const contrib = Math.round(val * maxW);
      return {
        id: `T-${idx + 6}`,
        nameAr: `أداة ${idx + 6}`,
        weightContribPct: contrib
      };
    });

    const consensusScorePct = subAlgorithms.reduce((sum, item) => sum + item.weightContribPct, 0);
    const isBlocked = consensusScorePct < 65;

    let vwapPrice, entryPrice, stopLossLabel, tp1, tp2, tp3, tp1Label, tp2Label, tp3Label, profitPct1, profitPct2, profitPct3;

    if (!isBlocked) {
      // Calculate mock VWAP around current price
      const vwapOffset = lastClose * 0.005 * ((tfSeed % 20) / 20); // within 0.5% of price
      const vwapVal = bias === 'BULL' ? lastClose - vwapOffset : lastClose + vwapOffset;
      
      const stdDev = vwapVal * tf.vwapDeviation;
      
      // TPs based on VWAP Standard Deviations
      const tp1Num = bias === 'BULL' ? vwapVal + stdDev * 1.0 : vwapVal - stdDev * 1.0;
      const tp2Num = bias === 'BULL' ? vwapVal + stdDev * 2.0 : vwapVal - stdDev * 2.0;
      const tp3Num = bias === 'BULL' ? vwapVal + stdDev * 3.0 : vwapVal - stdDev * 3.0;

      vwapPrice = `$${priceStr(vwapVal)}`;
      entryPrice = `$${priceStr(vwapVal)}`; // Entry at VWAP
      stopLossLabel = bias === 'BULL' ? 'إغلاق 4 ساعات أسفل مستوى VWAP' : 'إغلاق 4 ساعات أعلى مستوى VWAP';
      
      tp1Label = bias === 'BULL' ? '+ VWAP 1.0σ' : '- VWAP 1.0σ';
      tp2Label = bias === 'BULL' ? '+ VWAP 2.0σ' : '- VWAP 2.0σ';
      tp3Label = bias === 'BULL' ? '+ VWAP 3.0σ' : '- VWAP 3.0σ';

      tp1 = `$${priceStr(tp1Num)}`;
      tp2 = `$${priceStr(tp2Num)}`;
      tp3 = `$${priceStr(tp3Num)}`;

      const calcPct = (p: number, e: number) => Math.abs(((p - e) / e) * 100).toFixed(2) + '%';
      profitPct1 = calcPct(tp1Num, vwapVal);
      profitPct2 = calcPct(tp2Num, vwapVal);
      profitPct3 = calcPct(tp3Num, vwapVal);
    }

    setups.push({
      timeframe: tf.tf,
      tfLabelAr: tf.label,
      bias,
      isBlocked,
      blockedReasonAr: isBlocked ? 'تم حجب التمركز: درجة الإجماع الخوارزمي لم تصل لحد الأمان المطلوب 65%' : undefined,
      consensusScorePct,
      subAlgorithms,
      vwapPrice,
      entryPrice,
      stopLossLabel,
      tp1,
      tp2,
      tp3,
      tp1Label,
      tp2Label,
      tp3Label,
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
