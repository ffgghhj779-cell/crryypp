'use client';

/**
 * app/tools/trend-compass/page.tsx
 *
 * Trend Compass (بوصلة الاتجاه)
 * Analyzes trend using 5 classic indicators and outputs a visual confidence score.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, ChevronDown, Compass, CheckCircle2, XCircle, MinusCircle, Info } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateTrendCompass, TrendCompassResult } from '@/lib/algorithms/trendCompass';
import { fetchKlines, Kline, invalidateCache } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';

export default function TrendCompassPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1d');
  
  const [liveData, setLiveData] = useState<Kline[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [result, setResult] = useState<TrendCompassResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('trend-compass');

  // 1. Fetch initial live data on mount AND when symbol/timeframe changes
  useEffect(() => {
    let mounted = true;
    const fetchInitial = async () => {
      setIsLoading(true);
      setError('');
      try {
        const klines = await fetchKlines(symbol, timeframe.toLowerCase(), 1000);
        if (mounted) {
          setLiveData(klines);
          if (klines.length > 0) {
            // Auto-calculate when symbol/timeframe changes
            const res = calculateTrendCompass(symbol.toUpperCase().trim(), timeframe.toUpperCase(), klines);
            setResult(res);
            setTimeout(() => setAnimated(true), 100);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'فشل جلب البيانات المباشرة.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchInitial();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  // 2. Fetch new data when user explicitly clicks the button
  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل.');
    
    setCalculating(true);
    setAnimated(false);
    setResult(null); // Clear old results to force visual refresh
    
    try {
      invalidateCache(symbol);
      const klines = await fetchKlines(symbol.toUpperCase().trim(), timeframe.toLowerCase(), 1000);
      if (klines.length === 0) throw new Error('لا توجد بيانات متاحة لهذا الأصل.');
      
      setLiveData(klines);
      const res = calculateTrendCompass(symbol.toUpperCase().trim(), timeframe.toUpperCase(), klines);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء جلب البيانات أو المعالجة.');
    } finally {
      setCalculating(false);
    }
  };

  // Sleek, glowing loading skeleton for initial mount
  if (!tool) return notFound();

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
        <ToolPageHeader tool={tool} />
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="relative flex items-center justify-center">
            {/* Pulsing neon spinner */}
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-16 h-16 rounded-full border-t-2 border-r-2 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]"
            />
            <Compass className="absolute w-6 h-6 text-orange-400 opacity-80" />
          </div>
          <p className="text-orange-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">
            جاري الاتصال بالسوق...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Compass className="w-3 h-3" /> Trend Analysis
          </span>
          {liveData.length > 0 && (
            <span className="text-sm font-black text-emerald-500/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Live
            </span>
          )}
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          بوصلة الاتجاه (Trend Compass)
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          تحليل قوة وتوجه السوق عبر 5 مؤشرات كلاسيكية متزامنة
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Input */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest">رمز الأصل المالي</label>
              <SymbolDropdown value={symbol} onChange={setSymbol} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">الإطار الزمني</label>
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={e => setTimeframe(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-base px-5 py-4 appearance-none focus:outline-none focus:border-orange-500/40 transition-colors cursor-pointer"
                  dir="ltr"
                >
                  <option value="1h">1H</option>
                  <option value="4h">4H</option>
                  <option value="1d">1D</option>
                  <option value="1w">1W</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-6 h-6 text-white/40" />
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-4.5 mt-2">
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="w-full mt-2 flex items-center justify-center gap-3.5 rounded-xl py-4 font-black text-base tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: calculating ? 'linear-gradient(135deg, #7c2d12, #431407)' : 'linear-gradient(135deg, #ea580c, #9a3412)',
              boxShadow: !calculating ? '0 0 20px rgba(234, 88, 12, 0.25)' : 'none'
            }}
          >
            {calculating ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {calculating ? 'جاري قراءة البوصلة...' : 'تشغيل بوصلة الاتجاه'}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="flex flex-col gap-6"
            >
              {/* The Compass Gauge */}
              <div className="rounded-2xl border border-orange-500/20 bg-[#111] p-6 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(234,88,12,0.1)] relative overflow-hidden">
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none transition-colors duration-1000"
                  style={{ 
                    background: `radial-gradient(circle at center, ${
                      result.mainDirectionEn === 'BULL' ? '#10b981' : result.mainDirectionEn === 'BEAR' ? '#ef4444' : '#9ca3af'
                    } 0%, transparent 70%)` 
                  }}
                />
                
                <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4 z-10">مستوى الثقة (Confidence)</p>
                
                {/* Circular Gauge */}
                <div className="relative w-48 h-48 flex items-center justify-center z-10 mb-4">
                  <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_8px_currentColor]" viewBox="0 0 100 100">
                    {/* Background Track */}
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                    {/* Progress Track */}
                    <motion.circle
                      cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent"
                      strokeDasharray={282.7} // 2 * PI * 45
                      initial={{ strokeDashoffset: 282.7 }}
                      animate={animated ? { strokeDashoffset: 282.7 - (282.7 * result.confidencePct) / 100 } : { strokeDashoffset: 282.7 }}
                      transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
                      className={result.mainDirectionEn === 'BULL' ? 'text-emerald-500' : result.mainDirectionEn === 'BEAR' ? 'text-red-500' : 'text-gray-400'}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
                    <span className={`text-4xl font-black font-mono tracking-tighter ${
                      result.mainDirectionEn === 'BULL' ? 'text-emerald-400' : result.mainDirectionEn === 'BEAR' ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {result.confidencePct}%
                    </span>
                    <span className={`text-2xl font-black tracking-widest ${
                      result.mainDirectionEn === 'BULL' ? 'text-emerald-500' : result.mainDirectionEn === 'BEAR' ? 'text-red-500' : 'text-gray-400'
                    }`} style={{ textShadow: '0 0 10px currentColor' }}>
                      {result.mainDirectionAr}
                    </span>
                  </div>
                </div>

                {/* Tally */}
                <div className="flex items-center gap-3 z-10 bg-black/40 px-5 py-4.5 rounded-full border border-white/[0.05]">
                  <span className="text-sm font-mono text-emerald-400 font-bold">{result.bullCount} صعود</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-sm font-mono text-red-400 font-bold">{result.bearCount} هبوط</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-sm font-mono text-gray-400 font-bold">{result.neutralCount} محايد</span>
                </div>
              </div>

              {/* 5-Indicator Breakdown */}
              <div className="flex flex-col gap-3 mt-2">
                {result.metrics.map((metric, i) => {
                  let badgeColor = "bg-gray-500/20 text-gray-400 border-gray-500/30";
                  let Icon = MinusCircle;
                  if (metric.bias === 'BULL') {
                    badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                    Icon = CheckCircle2;
                  }
                  if (metric.bias === 'BEAR') {
                    badgeColor = "bg-orange-500/20 text-orange-400 border-orange-500/30";
                    Icon = XCircle;
                  }
                  
                  return (
                    <motion.div 
                      key={metric.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i, type: "spring", stiffness: 120 }}
                      className="rounded-xl border border-white/[0.05] bg-black/40 p-6 flex flex-col gap-3 relative overflow-hidden"
                    >
                      <div className={`absolute right-0 top-0 w-1 h-full opacity-50 ${
                        metric.bias === 'BULL' ? 'bg-emerald-500' : metric.bias === 'BEAR' ? 'bg-orange-500' : 'bg-gray-500'
                      }`} />
                      
                      <div className="flex justify-between items-center mr-1">
                        <span className="text-sm font-bold text-white/90">{metric.nameAr}</span>
                        <div className={`px-2 py-1 rounded flex items-center gap-1.5 border text-sm font-bold tracking-widest ${badgeColor}`}>
                          <Icon className="w-3 h-3" />
                          {metric.bias === 'BULL' ? 'إيجابي' : metric.bias === 'BEAR' ? 'سلبي' : 'محايد'}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mr-1 mt-1">
                        <span className="text-sm text-white/50">{metric.statusTextAr}</span>
                        <span className="text-sm font-mono text-white/30 uppercase tracking-widest">{metric.nameEn}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Conclusion Box */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="rounded-xl border-r-2 border-r-orange-500 border-white/[0.05] bg-orange-500/[0.03] p-5 text-right shadow-inner mt-2 mb-2"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Info className="w-6 h-6 text-orange-500" />
                  <span className="text-sm font-black text-orange-500 tracking-widest uppercase">الخلاصة</span>
                </div>
                <p className="text-base text-orange-50 font-medium leading-relaxed">
                  {result.conclusionAr}
                </p>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
