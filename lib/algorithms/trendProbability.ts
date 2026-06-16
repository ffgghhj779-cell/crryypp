/**
 * lib/algorithms/trendProbability.ts
 *
 * Trend Probability Engine (محرك ترجيح الاتجاه)
 * Analyzes directional probability using volume-based indicators:
 * - VW-MACD (الزخم الحجمي)
 * - Weis Wave (البصمة الحجمية)
 * - Vol-RSI (التشبع الديناميكي)
 */

import type { Kline } from '@/lib/binance/fetcher';

export interface TrendProbResult {
  symbol: string;
  vwMacd: {
    result: string; // "إيجابي" or "سلبي"
    desc: string; // "اتجاه مستمر"
    isBullish: boolean;
  };
  weisWave: {
    result: string; // "موجة صاعدة"
    desc: string; // "صعود بضعف حجمي"
    isBullish: boolean;
  };
  volRsi: {
    value: number; // e.g. 49.4
    desc: string; // "نطاق آمن - مساحة حركة متاحة"
  };
  probabilities: {
    bullish: number; // 25
    sideways: number; // 35
    bearish: number; // 40
  };
  verdict: string; // "تضارب في المؤشرات. السوق في حالة تذبذب عرضي، يُنصح بالانتظار حتى وضوح الاتجاه."
}

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function calcVWMACD(klines: Kline[]): { isBullish: boolean; result: string; desc: string } {
  if (klines.length < 26) return { isBullish: false, result: 'محايد', desc: 'بيانات غير كافية' };
  
  // Simplified VW-MACD logic for representation
  // We use the last 20 candles
  const recent = klines.slice(-20);
  let buyVol = 0;
  let sellVol = 0;
  
  for (const k of recent) {
    if (k.close > k.open) buyVol += k.volume;
    else sellVol += k.volume;
  }
  
  const isBullish = buyVol > sellVol;
  
  return {
    isBullish,
    result: isBullish ? 'إيجابي' : 'سلبي',
    desc: isBullish ? 'زخم شرائي متزايد' : 'اتجاه مستمر'
  };
}

function calcWeisWave(klines: Kline[]): { isBullish: boolean; result: string; desc: string } {
  if (klines.length < 10) return { isBullish: false, result: 'محايد', desc: 'بيانات غير كافية' };
  
  const recent = klines.slice(-10);
  const current = recent[recent.length - 1];
  const prev = recent[recent.length - 2];
  
  const isBullish = current.close > prev.close;
  
  // Check volume strength
  const volAvg = recent.reduce((sum, k) => sum + k.volume, 0) / recent.length;
  const isWeak = current.volume < volAvg;
  
  let desc = '';
  if (isBullish) {
    desc = isWeak ? 'صعود بضعف حجمي (نقص طلب)' : 'صعود قوي مدعوم بالسيولة';
  } else {
    desc = isWeak ? 'هبوط بضعف حجمي (نقص عرض)' : 'هبوط قوي مدعوم بالبيوع';
  }
  
  return {
    isBullish,
    result: isBullish ? 'موجة صاعدة' : 'موجة هابطة',
    desc
  };
}

function calcVolRSI(klines: Kline[]): { value: number; desc: string } {
  if (klines.length < 14) return { value: 50, desc: 'محايد' };
  
  // Volume-weighted RSI
  let gains = 0;
  let losses = 0;
  const period = 14;
  const recent = klines.slice(-(period + 1));
  
  for (let i = 1; i <= period; i++) {
    const diff = recent[i].close - recent[i - 1].close;
    if (diff > 0) gains += diff * recent[i].volume;
    else losses += Math.abs(diff) * recent[i].volume;
  }
  
  if (gains === 0 && losses === 0) return { value: 50, desc: 'نطاق آمن - مساحة حركة متاحة' };
  
  const rs = gains / (losses === 0 ? 1 : losses);
  const rsi = 100 - (100 / (1 + rs));
  const roundedRsi = Math.round(rsi * 10) / 10;
  
  let desc = 'نطاق آمن - مساحة حركة متاحة';
  if (roundedRsi > 70) desc = 'تشبع شرائي - احتمالية انعكاس';
  if (roundedRsi < 30) desc = 'تشبع بيعي - احتمالية ارتداد';
  
  return {
    value: roundedRsi,
    desc
  };
}

export function calculateTrendProbability(symbol: string, klines: Kline[]): TrendProbResult {
  const vwMacd = calcVWMACD(klines);
  const weisWave = calcWeisWave(klines);
  const volRsi = calcVolRSI(klines);
  
  let bullProb = 0;
  let bearProb = 0;
  
  if (vwMacd.isBullish) bullProb += 30; else bearProb += 30;
  if (weisWave.isBullish) bullProb += 30; else bearProb += 30;
  
  if (volRsi.value > 50) bullProb += 15; else bearProb += 15;
  if (volRsi.value > 60) bullProb += 10; else bearProb += 10;
  
  const total = bullProb + bearProb;
  
  // Normalizing and introducing sideways based on conflicting indicators or low total momentum
  let sidewaysProb = 100 - total;
  if (sidewaysProb < 10) sidewaysProb = 10;
  
  // Adding conflict logic
  if (vwMacd.isBullish !== weisWave.isBullish) {
    sidewaysProb += 20;
    bullProb -= 10;
    bearProb -= 10;
  }
  
  // Ensure values don't go negative and sum to 100
  bullProb = Math.max(0, bullProb);
  bearProb = Math.max(0, bearProb);
  const actualTotal = bullProb + bearProb + sidewaysProb;
  
  const finalBull = Math.round((bullProb / actualTotal) * 100);
  const finalBear = Math.round((bearProb / actualTotal) * 100);
  const finalSide = 100 - finalBull - finalBear;
  
  let verdict = '';
  if (finalSide > finalBull && finalSide > finalBear) {
    verdict = 'تضارب في المؤشرات. السوق في حالة تذبذب عرضي، يُنصح بالانتظار حتى وضوح الاتجاه.';
  } else if (finalBull > finalBear) {
    verdict = 'الاتجاه العام صاعد مدعوم بتدفق سيولة إيجابي. يُنصح بالبحث عن فرص الشراء مع التراجعات.';
  } else {
    verdict = 'الاتجاه العام هابط. السيولة تميل لصالح البائعين، يُنصح بالحذر والبحث عن فرص البيع.';
  }
  
  return {
    symbol,
    vwMacd,
    weisWave,
    volRsi,
    probabilities: {
      bullish: finalBull,
      sideways: finalSide,
      bearish: finalBear
    },
    verdict
  };
}
