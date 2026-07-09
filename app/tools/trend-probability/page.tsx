'use client';

import { useState, useCallback, useMemo } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { RefreshCcw, FolderOpen, ScanSearch, AlertCircle, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { ToolChart } from '@/components/tools/ToolChart';

// Real ADX Calculation
function calcADX(klines: Kline[], period: number = 14) {
  if (klines.length <= period) return { adx: 50, pdi: 50, mdi: 50 };
  
  const tr = new Array(klines.length).fill(0);
  const pDM = new Array(klines.length).fill(0);
  const mDM = new Array(klines.length).fill(0);
  
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high, l = klines[i].low, pc = klines[i - 1].close, ph = klines[i - 1].high, pl = klines[i - 1].low;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const upMove = h - ph;
    const downMove = pl - l;
    pDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
    mDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
  }
  
  const rma = (data: number[], p: number) => {
    const res = new Array(data.length).fill(0);
    let sum = 0;
    for(let i=1; i<=p; i++) sum += data[i];
    res[p] = sum;
    for(let i=p+1; i<data.length; i++) {
      res[i] = res[i-1] - (res[i-1]/p) + data[i];
    }
    return res;
  };
  
  const smoothTR = rma(tr, period);
  const smoothPDM = rma(pDM, period);
  const smoothMDM = rma(mDM, period);
  
  const pDI = new Array(klines.length).fill(0);
  const mDI = new Array(klines.length).fill(0);
  const dx = new Array(klines.length).fill(0);
  
  for (let i = period; i < klines.length; i++) {
    pDI[i] = smoothTR[i] === 0 ? 0 : 100 * (smoothPDM[i] / smoothTR[i]);
    mDI[i] = smoothTR[i] === 0 ? 0 : 100 * (smoothMDM[i] / smoothTR[i]);
    const dxSum = pDI[i] + mDI[i];
    dx[i] = dxSum === 0 ? 0 : 100 * (Math.abs(pDI[i] - mDI[i]) / dxSum);
  }
  
  let adxSum = 0;
  for(let i=period; i<period*2; i++) adxSum += dx[i];
  let currentAdx = adxSum / period;
  
  for(let i=period*2; i<klines.length; i++) {
    currentAdx = ((currentAdx * (period - 1)) + dx[i]) / period;
  }
  
  const lastIdx = klines.length - 1;
  return {
    adx: currentAdx,
    pdi: pDI[lastIdx],
    mdi: mDI[lastIdx]
  };
}

// Real Aroon Calculation
function calcAroon(klines: Kline[], period: number = 14) {
  if (klines.length <= period) return { aroonUp: 50, aroonDown: 50 };
  
  const slice = klines.slice(-period - 1);
  const highs = slice.map(k => k.high);
  const lows = slice.map(k => k.low);
  
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  
  const daysSinceHigh = period - highs.indexOf(maxHigh);
  const daysSinceLow = period - lows.indexOf(minLow);
  
  const aroonUp = ((period - daysSinceHigh) / period) * 100;
  const aroonDown = ((period - daysSinceLow) / period) * 100;
  
  return { aroonUp: Math.max(0, aroonUp), aroonDown: Math.max(0, aroonDown) };
}

export default function TrendProbabilityPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const data = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 150);
      if (data.length < 30) throw new Error('بيانات غير كافية للتحليل.');
      setKlines(data);
    } catch (e: any) {
      setError(e.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  const result = useMemo(() => {
    if (klines.length === 0) return null;
    
    const adxResult = calcADX(klines, 14);
    const aroonResult = calcAroon(klines, 14);
    
    // Calculate Volume Trend
    const recent = klines.slice(-20);
    let buyVol = 0, sellVol = 0;
    for (const k of recent) {
      if (k.close > k.open) buyVol += k.volume;
      else sellVol += k.volume;
    }
    const volTrend = (buyVol / (buyVol + sellVol)) * 100 || 50;

    // True Probability calculation based on real indicators
    // ADX > 25 means trending. PDI > MDI means bullish.
    // Aroon Up > Aroon Down means bullish.
    
    let bullScore = 0;
    let bearScore = 0;
    let sideScore = 0;

    // 1. ADX Direction
    if (adxResult.adx > 25) {
      if (adxResult.pdi > adxResult.mdi) bullScore += adxResult.adx;
      else bearScore += adxResult.adx;
    } else {
      sideScore += (50 - adxResult.adx) * 2;
    }

    // 2. Aroon
    bullScore += aroonResult.aroonUp;
    bearScore += aroonResult.aroonDown;
    sideScore += Math.max(0, 100 - Math.abs(aroonResult.aroonUp - aroonResult.aroonDown));

    // 3. Volume Trend
    if (volTrend > 55) bullScore += volTrend;
    else if (volTrend < 45) bearScore += (100 - volTrend);
    else sideScore += 50;

    const total = bullScore + bearScore + sideScore;
    const bullishProb = Math.round((bullScore / total) * 100);
    const bearishProb = Math.round((bearScore / total) * 100);
    const sidewaysProb = 100 - bullishProb - bearishProb;

    let verdict = '';
    if (sidewaysProb > bullishProb && sidewaysProb > bearishProb) {
      verdict = 'السوق في حالة تذبذب عرضي. (ADX تحت 25). لا يوجد اتجاه واضح حالياً.';
    } else if (bullishProb > bearishProb) {
      verdict = 'الاتجاه العام صاعد. المشترون يسيطرون بقوة على السوق.';
    } else {
      verdict = 'الاتجاه العام هابط. البائعون يفرضون سيطرتهم.';
    }

    return {
      adx: Math.round(adxResult.adx),
      pdi: Math.round(adxResult.pdi),
      mdi: Math.round(adxResult.mdi),
      aroonUp: Math.round(aroonResult.aroonUp),
      aroonDown: Math.round(aroonResult.aroonDown),
      volTrend: Math.round(volTrend),
      probabilities: {
        bullish: bullishProb,
        sideways: sidewaysProb,
        bearish: bearishProb
      },
      verdict
    };
  }, [klines]);

  const tool = slugToTool('trend-probability');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <h1 className="text-xl font-black text-white tracking-tight mt-1 text-center mb-4">محرك ترجيح الاتجاه الحقيقي</h1>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {/* Input */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <SymbolDropdown value={symbol} onChange={setSymbol} />
            </div>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-[#ff6a00]/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
            </select>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#ff6a00,#b34a00)', boxShadow: !loading ? '0 0 20px rgba(255,106,0,0.25)' : 'none' }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحليل...' : 'تشغيل محرك الاحتمالات'}
          </button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 mt-2">
            
            <div className="rounded-2xl bg-black p-4 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> حركة السعر
                </p>
              </div>
              <ToolChart klines={klines} height={250} />
            </div>

            {/* Indicators Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* ADX Card */}
              <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col items-end relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-[#ff6a00]/50" />
                <p className="text-[#ff6a00] font-mono text-xs mb-3">ADX (قوة الاتجاه)</p>
                <p className="text-white font-black text-xl mb-1">{result.adx}</p>
                <p className="text-white/50 text-[10px] font-mono">+DI: {result.pdi} | -DI: {result.mdi}</p>
              </div>

              {/* Aroon Card */}
              <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col items-end relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-[#ff6a00]/50" />
                <p className="text-[#ff6a00] font-mono text-xs mb-3">Aroon (عمر الاتجاه)</p>
                <p className="text-white font-black text-xl mb-1">{result.aroonUp > result.aroonDown ? 'صاعد' : 'هابط'}</p>
                <p className="text-white/50 text-[10px] font-mono">Up: {result.aroonUp} | Down: {result.aroonDown}</p>
              </div>

              {/* Volume Trend Card */}
              <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col items-end relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-[#ff6a00]/50" />
                <p className="text-[#ff6a00] font-mono text-xs mb-3">سيولة المشترين</p>
                <p className="text-white font-black text-xl mb-1">{result.volTrend}%</p>
                <p className="text-white/50 text-[10px] font-mono">آخر 20 شمعة</p>
              </div>
            </div>

            {/* Probability Bars */}
            <div className="bg-[#111] border border-white/10 rounded-xl p-5 mt-2 flex flex-col">
              <p className="text-[#ff6a00] font-black text-lg mb-6 text-center">احتمالية الاتجاه الحقيقية</p>

              <div className="flex flex-col gap-5">
                {/* Bullish */}
                <div className="flex items-center gap-3">
                  <p className="text-white font-black w-8">{result.probabilities.bullish}%</p>
                  <div className="flex-1 h-3 bg-black rounded-full overflow-hidden flex justify-end">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${result.probabilities.bullish}%` }} transition={{ duration: 1 }} className="h-full bg-emerald-500 rounded-full" />
                  </div>
                  <div className="flex flex-col items-end w-12">
                    <p className="text-emerald-500 text-xs font-bold">صاعد</p>
                  </div>
                </div>

                {/* Sideways */}
                <div className="flex items-center gap-3">
                  <p className="text-white font-black w-8">{result.probabilities.sideways}%</p>
                  <div className="flex-1 h-3 bg-black rounded-full overflow-hidden flex justify-end">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${result.probabilities.sideways}%` }} transition={{ duration: 1 }} className="h-full bg-gray-500 rounded-full" />
                  </div>
                  <div className="flex flex-col items-end w-12">
                    <p className="text-white text-xs font-bold">عرضي</p>
                  </div>
                </div>

                {/* Bearish */}
                <div className="flex items-center gap-3">
                  <p className="text-[#ff6a00] font-black w-8">{result.probabilities.bearish}%</p>
                  <div className="flex-1 h-3 bg-black rounded-full overflow-hidden flex justify-end">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${result.probabilities.bearish}%` }} transition={{ duration: 1 }} className="h-full bg-red-500 rounded-full" />
                  </div>
                  <div className="flex flex-col items-end w-12">
                    <p className="text-red-500 text-xs font-bold">هابط</p>
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div className="mt-8 border-r-2 border-[#ff6a00] pr-4">
                <p className="text-[#ff6a00]/60 font-mono text-xs mb-2 text-right">الخلاصة المرجحة:</p>
                <p className="text-white text-sm font-medium leading-relaxed text-right">
                  {result.verdict}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
