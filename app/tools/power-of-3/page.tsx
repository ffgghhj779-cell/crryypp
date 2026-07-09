'use client';

import { useState, useCallback, useMemo } from 'react';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { slugToTool } from '@/lib/tools/registry';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { ToolChart } from '@/components/tools/ToolChart';
import { notFound } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, Zap, AlertCircle, Hand, Scissors, Gem, TrendingUp, TrendingDown, Activity } from 'lucide-react';

type AMDPhase = 'Accumulation' | 'Distribution' | 'Manipulation_Bullish' | 'Manipulation_Bearish' | 'Neutral';

interface CandleData extends Kline {
  bodySize: number;       
  upperWickPct: number;   
  lowerWickPct: number;   
  upperWick: number;      
  lowerWick: number;      
  isBullish: boolean;
}

interface AMDAnalysis {
  candle: CandleData;
  phase: AMDPhase;
  confidence: number;
  title: string;
  explanation: string;
  recommendation: string;
  color: string;
}

function analyzeAMD(today: Kline, prev: Kline): AMDAnalysis {
  const { open, high, low, close } = today;
  const isBullish = close > open;

  const bodyTop = Math.max(open, close);
  const bodyBot = Math.min(open, close);
  const upperWick = high - bodyTop;
  const lowerWick = bodyBot - low;
  const bodyRange = bodyTop - bodyBot;

  const range = high - low || 1;
  const upperWickPct = (upperWick / high) * 100;
  const lowerWickPct = (lowerWick / high) * 100;
  const bodySizePct = (bodyRange / open) * 100;

  const isBullishManipulation = low < prev.low * 0.999 && close > prev.low;
  const isBearishManipulation = high > prev.high * 1.001 && close < prev.high;
  const isAccumulation = lowerWick > upperWick * 2 && lowerWick > bodyRange;
  const isDistribution = upperWick > lowerWick * 2 && upperWick > bodyRange;

  const candle: CandleData = {
    ...today,
    bodySize: parseFloat(bodySizePct.toFixed(2)),
    upperWickPct: parseFloat(upperWickPct.toFixed(2)),
    lowerWickPct: parseFloat(lowerWickPct.toFixed(2)),
    upperWick, lowerWick,
    isBullish,
  };

  if (isBullishManipulation) {
    return {
      candle, phase: 'Manipulation_Bullish', confidence: 80,
      title: 'تلاعب صاعد (Fake Breakdown)',
      explanation: `الشمعة كسرت قاع الشمعة السابقة (${prev.low.toFixed(2)}) ثم أغلقت فوقه — إشارة اصطياد وقوف الخسارة السفلية.`,
      recommendation: 'فرصة شرائية (عكس الكسر الكاذب).',
      color: '#10b981', // Emerald
    };
  }

  if (isBearishManipulation) {
    return {
      candle, phase: 'Manipulation_Bearish', confidence: 80,
      title: 'تلاعب هابط (Fake Breakout)',
      explanation: `الشمعة تجاوزت قمة الشمعة السابقة (${prev.high.toFixed(2)}) ثم أغلقت دونها — إشارة اصطياد وقف الربح/الاختراق الكاذب.`,
      recommendation: 'فرصة بيعية (عكس الكسر الكاذب).',
      color: '#ef4444', // Red
    };
  }

  if (isAccumulation) {
    return {
      candle, phase: 'Accumulation', confidence: 72,
      title: 'تجميع في القاع (Accumulation)',
      explanation: `الظل السفلي (${lowerWick.toFixed(2)}) أطول بشكل ملحوظ — دلالة على رفض الهبوط والشراء المؤسسي.`,
      recommendation: 'شمعة شرائية. ابحث عن تأكيد بالصعود.',
      color: '#3b82f6', // Blue
    };
  }

  if (isDistribution) {
    return {
      candle, phase: 'Distribution', confidence: 72,
      title: 'توزيع في القمة (Distribution)',
      explanation: `الظل العلوي (${upperWick.toFixed(2)}) أطول بشكل ملحوظ — دلالة على رفض الصعود والبيع المؤسسي.`,
      recommendation: 'شمعة بيعية. ابحث عن تأكيد بالهبوط.',
      color: '#f97316', // Orange
    };
  }

  return {
    candle, phase: 'Neutral', confidence: 45,
    title: 'متوازنة / محايدة (Neutral)',
    explanation: 'توازن بين قوى العرض والطلب ولا توجد إشارات تلاعب أو رفض واضحة.',
    recommendation: 'انتظر إشارة أوضح في الشموع القادمة.',
    color: isBullish ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
  };
}

export default function PowerOf3Page() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Results
  const [results, setResults] = useState<AMDAnalysis[]>([]);

  
  const handleAnalyze = useCallback(async () => {
    setLoading(true); setError(null); setResults([]);
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 150);
      if (klines.length < 2) throw new Error('بيانات غير كافية.');
      
      const amdResults: AMDAnalysis[] = [];
      // Calculate AMD for each candle starting from index 1
      for (let i = 1; i < klines.length; i++) {
        amdResults.push(analyzeAMD(klines[i], klines[i - 1]));
      }
      setResults(amdResults);
    } catch (e: any) {
      setError(e.message || 'خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  const latestResult = results.length > 0 ? results[results.length - 1] : null;

  const chartKlines = useMemo(() => {
    if (results.length === 0) return [];
    // Map AMD colors to klines
    return results.map(r => ({
      ...r.candle,
      color: r.color,
      wickColor: r.color,
      borderColor: r.color
    }));
  }, [results]);

  const tool = slugToTool('power-of-3');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-amber-500/70 tracking-widest uppercase border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Zap className="w-3 h-3" /> Power of 3 (AMD)
        </span>
        <h1 className="text-xl font-black text-white mt-1">تتبع التلاعب (AMD)</h1>
        <p className="text-sm text-white/40 font-mono">تحديد التجميع (Accumulation)، التلاعب (Manipulation)، التوزيع (Distribution)</p>
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
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-amber-500/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
            </select>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white transition-all disabled:opacity-50"
            style={{
              background: loading ? '#1a1a1a' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: !loading ? '0 0 20px rgba(245,158,11,0.25)' : 'none',
            }}
          >
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RefreshCcw className="w-6 h-6" />}
            {loading ? 'جاري تحليل التلاعب...' : 'تحليل حركة صانع السوق (AMD)'}
          </button>
        </div>

        {latestResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
            
            {/* Visualizer */}
            <div className="rounded-2xl bg-[#050505] p-4 border border-amber-500/20 shadow-lg shadow-amber-500/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4" /> خريطة AMD (التجميع والتوزيع)
                </p>
              </div>
              <ToolChart 
                klines={chartKlines}
                height={350}
              />
              <div className="flex gap-4 mt-4 justify-center text-xs font-mono tracking-widest">
                <span className="flex items-center gap-2 text-white/60"><div className="w-3 h-3 rounded bg-blue-500" /> تجميع (Acc)</span>
                <span className="flex items-center gap-2 text-white/60"><div className="w-3 h-3 rounded bg-emerald-500" /> تلاعب صاعد</span>
                <span className="flex items-center gap-2 text-white/60"><div className="w-3 h-3 rounded bg-red-500" /> تلاعب هابط</span>
                <span className="flex items-center gap-2 text-white/60"><div className="w-3 h-3 rounded bg-orange-500" /> توزيع (Dist)</span>
              </div>
            </div>

            {/* Verdict (Latest Candle) */}
            <div className="rounded-2xl border p-5 flex flex-col gap-4 relative overflow-hidden" style={{ borderColor: `${latestResult.color}40`, background: `${latestResult.color}10` }}>
              <div className="absolute top-0 right-0 bottom-0 w-1" style={{ background: latestResult.color }} />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: latestResult.color }}>حالة الشمعة الأخيرة</p>
                  <p className="text-xl font-black text-white">{latestResult.title}</p>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${latestResult.color}20` }}>
                  {latestResult.phase.includes('Bullish') ? <TrendingUp className="w-6 h-6" style={{ color: latestResult.color }} /> :
                   latestResult.phase.includes('Bearish') ? <TrendingDown className="w-6 h-6" style={{ color: latestResult.color }} /> :
                   <Gem className="w-6 h-6" style={{ color: latestResult.color }} />}
                </div>
              </div>

              <p className="text-sm text-white/80 leading-relaxed font-medium">
                {latestResult.explanation}
              </p>

              <div className="mt-2 pt-4 border-t border-white/10">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-2">التوصية التكتيكية</p>
                <p className="text-sm font-bold" style={{ color: latestResult.color }}>
                  {latestResult.recommendation}
                </p>
              </div>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
