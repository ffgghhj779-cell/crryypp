/**
 * lib/algorithms/tripleAnalysis.ts
 *
 * Triple Analysis (التحليل الثلاثي)
 * Analyzes the market across 3 core pillars:
 * 1. Momentum (RSI & MACD)
 * 2. Structure (Highs/Lows)
 * 3. Volume (OBV trend)
 */

import type { Kline } from '@/lib/binance/fetcher';

export interface PillarResult {
  name: string; // 'Momentum', 'Structure', 'Volume'
  status: 'Bullish' | 'Bearish' | 'Neutral';
  score: number; // 0 to 100
  details: string; // e.g. "RSI at 65 and MACD is positive"
}

export interface TripleAnalysisResult {
  symbol: string;
  pillars: PillarResult[];
  overallScore: number; // 0 to 100
  verdict: string;
}

function analyzeMomentum(klines: Kline[]): PillarResult {
  if (klines.length < 26) return { name: 'الزخم (Momentum)', status: 'Neutral', score: 50, details: 'بيانات غير كافية' };
  
  // RSI (14)
  let gains = 0, losses = 0;
  const recent = klines.slice(-15);
  for (let i = 1; i <= 14; i++) {
    const diff = recent[i].close - recent[i-1].close;
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const rs = gains / (losses === 0 ? 1 : losses);
  const rsi = 100 - (100 / (1 + rs));

  // MACD approximation
  let ema12 = klines[klines.length - 1].close;
  let ema26 = klines[klines.length - 1].close;
  
  const k12 = 2 / 13;
  const k26 = 2 / 27;

  for (let i = Math.max(0, klines.length - 50); i < klines.length; i++) {
    ema12 = klines[i].close * k12 + ema12 * (1 - k12);
    ema26 = klines[i].close * k26 + ema26 * (1 - k26);
  }
  
  const macd = ema12 - ema26;

  let score = 50;
  if (rsi > 55) score += 20;
  else if (rsi < 45) score -= 20;
  
  if (macd > 0) score += 20;
  else if (macd < 0) score -= 20;

  let status: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (score >= 70) status = 'Bullish';
  else if (score <= 30) status = 'Bearish';

  return {
    name: 'الزخم (Momentum)',
    status,
    score,
    details: `RSI عند ${Math.round(rsi)} و MACD ${macd > 0 ? 'إيجابي' : 'سلبي'}`
  };
}

function analyzeStructure(klines: Kline[]): PillarResult {
  if (klines.length < 20) return { name: 'الهيكل (Structure)', status: 'Neutral', score: 50, details: 'بيانات غير كافية' };

  const recent = klines.slice(-20);
  const currentPrice = recent[recent.length - 1].close;
  const pastPrice = recent[0].close;

  const maxH = Math.max(...recent.map(k => k.high));
  const minL = Math.min(...recent.map(k => k.low));

  let score = 50;
  if (currentPrice > pastPrice) score += 20;
  else score -= 20;

  // Position within the recent range
  const range = maxH - minL;
  if (range > 0) {
    const pos = (currentPrice - minL) / range;
    if (pos > 0.7) score += 20; // Near top of range
    else if (pos < 0.3) score -= 20; // Near bottom of range
  }

  let status: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (score >= 70) status = 'Bullish';
  else if (score <= 30) status = 'Bearish';

  return {
    name: 'الهيكل (Structure)',
    status,
    score,
    details: currentPrice > pastPrice ? 'اتجاه صاعد محلياً مع قيعان أعلى' : 'اتجاه هابط محلياً مع قمم أقل'
  };
}

function analyzeVolume(klines: Kline[]): PillarResult {
  if (klines.length < 20) return { name: 'السيولة (Volume)', status: 'Neutral', score: 50, details: 'بيانات غير كافية' };

  // On-Balance Volume (OBV) trend
  const recent = klines.slice(-20);
  let obv = 0;
  const obvData = [0];

  for (let i = 1; i < recent.length; i++) {
    if (recent[i].close > recent[i-1].close) obv += recent[i].volume;
    else if (recent[i].close < recent[i-1].close) obv -= recent[i].volume;
    obvData.push(obv);
  }

  const obvTrend = obvData[obvData.length - 1] > obvData[0];
  
  let score = 50;
  if (obvTrend) score += 30;
  else score -= 30;

  // Volume Delta simple (Buying volume vs Selling volume on last 5 candles)
  let buyVol = 0;
  let sellVol = 0;
  for (let i = recent.length - 5; i < recent.length; i++) {
    if (recent[i].close > recent[i].open) buyVol += recent[i].volume;
    else sellVol += recent[i].volume;
  }

  if (buyVol > sellVol * 1.2) score += 20;
  else if (sellVol > buyVol * 1.2) score -= 20;

  let status: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (score >= 70) status = 'Bullish';
  else if (score <= 30) status = 'Bearish';

  return {
    name: 'السيولة (Volume)',
    status,
    score,
    details: obvTrend ? 'تدفق سيولة إيجابي (OBV صاعد)' : 'خروج سيولة (OBV هابط)'
  };
}

export function calculateTripleAnalysis(symbol: string, klines: Kline[]): TripleAnalysisResult {
  const momentum = analyzeMomentum(klines);
  const structure = analyzeStructure(klines);
  const volume = analyzeVolume(klines);

  const pillars = [momentum, structure, volume];
  
  const totalScore = pillars.reduce((sum, p) => sum + p.score, 0);
  const overallScore = Math.round(totalScore / 3);

  let verdict = '';
  if (overallScore >= 75) {
    verdict = 'إيجابية مطلقة: الركائز الثلاث تتوافق لدعم مسار صاعد قوي.';
  } else if (overallScore <= 25) {
    verdict = 'سلبية مطلقة: الركائز الثلاث تتوافق لدعم مسار هابط قوي.';
  } else if (overallScore >= 55) {
    verdict = 'إيجابية ضعيفة: هناك ميل للصعود ولكن بتضارب في بعض الركائز.';
  } else if (overallScore <= 45) {
    verdict = 'سلبية ضعيفة: هناك ميل للهبوط ولكن بتضارب في بعض الركائز.';
  } else {
    verdict = 'حياد التام: تضارب كامل بين الزخم، الهيكل، والسيولة.';
  }

  return {
    symbol,
    pillars,
    overallScore,
    verdict
  };
}
