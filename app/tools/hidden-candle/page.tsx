'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, ScanSearch, AlertCircle, Activity } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, type Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, type ChartMarker } from '@/components/tools/ToolChart';

interface CandlePattern { 
  name: string; 
  nameEn: string; 
  isBullish: boolean; 
  description: string; 
  index: number;
}

function detectPattern(klines: Kline[]): CandlePattern | null {
  if (klines.length < 3) return null;
  const [prev2, prev, curr] = klines.slice(-3);
  const body = Math.abs(curr.close - curr.open);
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const range = curr.high - curr.low || 0.0001;

  const lastIdx = klines.length - 1;

  // Hammer: small body, long lower wick (> 2x body), small upper wick
  if (lowerWick > body * 2 && upperWick < body * 0.5 && body / range < 0.4) {
    return { name: 'مطرقة (Hammer)', nameEn: 'Hammer', isBullish: true, description: 'نمط انعكاسي صعودي — ذيل سفلي طويل يعكس رفض البائعين وقوة المشترين', index: lastIdx };
  }
  // Shooting Star: small body, long upper wick
  if (upperWick > body * 2 && lowerWick < body * 0.5 && body / range < 0.4) {
    return { name: 'نجمة ساقطة (Shooting Star)', nameEn: 'Shooting Star', isBullish: false, description: 'نمط انعكاسي هبوطي — ذيل علوي طويل يعكس رفض المشترين وقوة البائعين', index: lastIdx };
  }
  // Bullish Engulfing
  if (prev.close < prev.open && curr.close > curr.open && curr.open < prev.close && curr.close > prev.open) {
    return { name: 'ابتلاع صعودي', nameEn: 'Bullish Engulfing', isBullish: true, description: 'شمعة خضراء كبيرة تبتلع الشمعة الحمراء السابقة — إشارة انعكاس صعودي قوية', index: lastIdx };
  }
  // Bearish Engulfing
  if (prev.close > prev.open && curr.close < curr.open && curr.open > prev.close && curr.close < prev.open) {
    return { name: 'ابتلاع هبوطي', nameEn: 'Bearish Engulfing', isBullish: false, description: 'شمعة حمراء كبيرة تبتلع الشمعة الخضراء السابقة — إشارة انعكاس هبوطي قوية', index: lastIdx };
  }
  // Inside Bar
  if (curr.high < prev.high && curr.low > prev.low) {
    return { name: 'شمعة داخلية (Inside Bar)', nameEn: 'Inside Bar', isBullish: curr.close > curr.open, description: 'تردد في السوق — انتظر الاختراق لتحديد الاتجاه التالي', index: lastIdx };
  }
  // Doji
  if (body / range < 0.05) {
    return { name: 'دوجي (Doji)', nameEn: 'Doji', isBullish: false, description: 'توازن تام بين المشترين والبائعين — إشارة تردد وتوقع حركة قوية قريباً', index: lastIdx };
  }
  return { name: 'شمعة عادية', nameEn: 'Standard Candle', isBullish: curr.close > curr.open, description: 'لا يوجد نمط انعكاسي واضح في الشمعة الأخيرة', index: lastIdx };
}

export default function HiddenCandlePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pattern, setPattern] = useState<CandlePattern | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 60);
      if (fetchedKlines.length < 3) throw new Error('بيانات غير كافية');
      
      const detPattern = detectPattern(fetchedKlines);
      
      // Highlight the specific candle
      if (detPattern) {
        fetchedKlines[detPattern.index].color = detPattern.isBullish ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';
        fetchedKlines[detPattern.index].borderColor = detPattern.isBullish ? '#34d399' : '#f87171';
      }

      setKlines(fetchedKlines);
      setPattern(detPattern);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol, timeframe]);

  const fmtP = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 100 ? 1 : 4, maximumFractionDigits: p > 100 ? 1 : 4 });

  const verdict = !pattern ? '' :
    pattern.name === 'شمعة عادية'
      ? 'لا يوجد نمط كيندل مخفي واضح — الاتجاه مستمر. لا تقاوم الترند الحالي.'
      : pattern.isBullish
      ? `✅ ${pattern.name}: ${pattern.description}. ابحث عن تأكيد شرائي في الشمعة التالية.`
      : `⚠️ ${pattern.name}: ${pattern.description}. كن حذراً وانتظر تأكيد الحركة.`;

  const patternColor = pattern?.isBullish ? '#10b981' : '#ef4444';

  
  let chartMarkers: ChartMarker[] = [];
  if (pattern && klines.length > 0 && pattern.name !== 'شمعة عادية') {
    chartMarkers.push({
      time: klines[pattern.index].time,
      position: pattern.isBullish ? 'belowBar' : 'aboveBar',
      shape: pattern.isBullish ? 'arrowUp' : 'arrowDown',
      color: patternColor,
      text: pattern.nameEn,
      size: 2
    });
  }

  const lastCandle = klines[klines.length - 1];

  const tool = slugToTool('hidden-candle');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-indigo-500/70 tracking-widest uppercase border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1"><Eye className="w-3 h-3" /> Candle Patterns</span>
        <h1 className="text-xl font-black text-white mt-1">كاشف النماذج الشمعية المخفية</h1>
        <p className="text-sm text-white/40 font-mono">تحليل الشموع الأخير لرصد إشارات الانعكاس مع توضيحها على الرسم البياني</p>
      </div>
      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <SymbolDropdown value={symbol} onChange={setSymbol} />
            </div>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-indigo-500/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
            </select>
          </div>
          <AnimatePresence>{error && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3"><AlertCircle className="w-4 h-4 text-red-400" /><p className="text-sm text-red-300">{error}</p></motion.div>}</AnimatePresence>
          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all" style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#6366f1,#4338ca)', boxShadow: !loading ? '0 0 20px rgba(99,102,241,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحليل...' : 'فحص النماذج الشمعية'}
          </button>
        </div>
        <AnimatePresence>
          {pattern && lastCandle && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              
              {/* Chart Visual */}
              <div className="rounded-3xl border border-indigo-500/20 bg-[#050505] p-5 flex flex-col shadow-lg shadow-indigo-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Price Action Context
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • {timeframe.toUpperCase()}</p>
                </div>
                <ToolChart 
                  klines={klines} 
                  height={300} 
                  markers={chartMarkers} 
                />
              </div>

              {/* OHLC */}
              <div className="grid grid-cols-4 gap-2">
                {[['Open', fmtP(lastCandle.open)], ['High', fmtP(lastCandle.high)], ['Low', fmtP(lastCandle.low)], ['Close', fmtP(lastCandle.close)]].map(([label, val]) => (
                  <div key={label} className="rounded-xl bg-white/5 border border-white/[0.06] p-3 flex flex-col gap-1">
                    <p className="text-xs text-white/30 font-mono">{label}</p>
                    <p className="text-sm font-black text-white font-mono">{val}</p>
                  </div>
                ))}
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border p-5 flex flex-col gap-2" style={{ borderColor: patternColor + '30', background: patternColor + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest" style={{ color: patternColor }}>{pattern.name}</p>
                <p className="text-sm text-white/80 leading-relaxed font-medium">{verdict}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
