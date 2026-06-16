'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, Activity, Layers, AlertCircle, FolderOpen } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines } from '@/lib/binance/fetcher';
import { calculateMTFCScanner, MTFCResult } from '@/lib/algorithms/mtfcScanner';
import { notFound } from 'next/navigation';

export default function MtfcScannerPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [result, setResult] = useState<MTFCResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('mtfc-scanner');
  if (!tool) return notFound();

  async function handleScan() {
    if (!symbol.trim()) {
      setError('أدخل اسم الأصل.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    setAnimated(false);

    try {
      const formattedSymbol = symbol.toUpperCase().trim();
      const [klines1H, klines4H, klines1D] = await Promise.all([
        fetchKlines(formattedSymbol, '1h', 200),
        fetchKlines(formattedSymbol, '4h', 200),
        fetchKlines(formattedSymbol, '1d', 200),
      ]);

      if (klines1H.length < 50 || klines4H.length < 50 || klines1D.length < 50) {
        throw new Error('بيانات غير كافية لتحليل التقاء الفريمات (MTFC).');
      }

      const res = calculateMTFCScanner(formattedSymbol, klines1H, klines4H, klines1D);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب البيانات أو تحليلها.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Input Section */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-black text-[#ff6a00] uppercase tracking-widest flex items-center justify-center">
            ماسح التقاء الفريمات المتعددة
          </p>
          <p className="text-[10px] text-center font-black text-[#ff6a00]/70 uppercase tracking-[0.2em]">
            MULTI-TIMEFRAME CONFLUENCE SCANNER
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="BTCUSDT"
            className="w-full bg-[#111] border border-[#ff6a00]/20 rounded-lg px-4 py-3 text-center text-white font-bold tracking-widest uppercase focus:outline-none focus:border-[#ff6a00] transition-colors"
          />
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full bg-[#ff6a00] hover:bg-[#ff8533] disabled:opacity-50 text-black font-black uppercase tracking-widest py-3 rounded-lg transition-all"
          >
            {loading ? '...' : 'START'}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Section */}
      {result && (
        <div className="px-5 flex flex-col gap-6 mt-4">
          
          {/* GRADE Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-[#ff6a00] rounded-xl bg-black p-5 flex flex-col items-center relative overflow-hidden"
          >
            <p className="text-xs text-[#ff6a00] font-mono mb-2">التقييم الفني للتطابق المتعدد // CONFLUENCE</p>
            <p className="text-[10px] text-white/50 tracking-widest uppercase mb-1">GRADE</p>
            <p className="text-6xl font-black text-white leading-none mb-4">{result.grade}</p>
            <p className="text-sm font-bold text-white mb-6">{result.verdictTitle}</p>
            
            <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden mb-2">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: animated ? `${result.score}%` : '0%' }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-[#ff6a00]"
              />
            </div>
            
            <div className="flex justify-between w-full">
              <p className="text-xs text-[#ff6a00] font-bold">{result.score}/100</p>
              <p className="text-xs text-white/40 font-mono">نقاط التقييم التراكمي (SCORE)</p>
            </div>
          </motion.div>

          {/* MTF CONFLUENCE MAP Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border border-white/10 rounded-xl bg-black p-4 flex flex-col gap-4 relative"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-white/50 font-bold tracking-widest uppercase">LIVE</span>
              </div>
              <p className="text-xs text-[#ff6a00] font-black uppercase tracking-widest">
                MTF CONFLUENCE MAP // {result.symbol}
              </p>
            </div>

            <div className="flex flex-col gap-5">
              {result.timeframes.map((tf, i) => (
                <div key={tf.timeframe} className="flex gap-3 h-20 items-stretch">
                  <div className="bg-[#ff6a00] text-black font-black text-xs w-8 flex items-center justify-center shrink-0 rounded-sm">
                    {tf.timeframe}
                  </div>
                  <div className="flex-1 relative bg-[#111] border border-white/5 rounded-sm overflow-hidden">
                    {/* Background Band (30-70) */}
                    <div className="absolute top-[30%] bottom-[30%] left-0 right-0 bg-[#ff6a00]/5 border-y border-[#ff6a00]/20 border-dashed" />
                    {/* Line Chart */}
                    <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {tf.chartData.length > 0 && (
                        <motion.path 
                          d={`M ${tf.chartData.map((p, idx) => `${(idx / (tf.chartData.length - 1)) * 100} ${100 - p.value}`).join(' L ')}`}
                          fill="none" 
                          stroke="#fff" 
                          strokeWidth="1.5" 
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: animated ? 1 : 0 }}
                          transition={{ duration: 1.5, delay: 0.2 + i * 0.1 }}
                        />
                      )}
                    </svg>
                  </div>
                  <div className="w-8 flex flex-col items-center justify-center shrink-0">
                    <p className="text-[10px] text-white/50">{tf.confluenceCount}/4</p>
                    <span className="text-[#10b981] text-xs">✔</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2 mt-2 pt-3 border-t border-white/10">
              <FolderOpen className="w-4 h-4 text-[#ff6a00]" />
              <p className="text-xs text-white/40 font-mono flex-1 text-left">مؤشرات التقاء الفريمات (RSI/OB/FVG)</p>
            </div>
          </motion.div>

          {/* BREAKDOWN Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="text-center mb-2">
              <p className="text-sm text-[#ff6a00] font-bold">تحليل وتجزئة الشروط الهيكلية لكل إطار زمني //</p>
              <p className="text-xs text-[#ff6a00]/60 tracking-widest uppercase">BREAKDOWN</p>
            </div>

            {result.timeframes.map((tf) => (
              <div key={tf.timeframe} className="border border-white/10 rounded-xl bg-black p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                  <p className="text-xs font-mono text-white/60">{tf.confluenceCount}/4 توافقات مسجلة</p>
                  <p className="text-sm font-black text-white">{tf.timeframe} TIMEFRAME</p>
                </div>
                
                <div className="grid grid-cols-2 gap-px bg-white/10 border border-white/10">
                  {/* Row 1 */}
                  <div className="bg-black p-3 flex justify-between items-center">
                    <p className="text-xs text-white/50">التباعد التقني (DIV)</p>
                    <p className={`text-xs font-bold ${tf.div.active ? 'text-white' : 'text-white/20'}`}>{tf.div.text}</p>
                  </div>
                  <div className="bg-black p-3 flex justify-between items-center">
                    <p className="text-xs text-white/50">تمركز السيولة (OB)</p>
                    <p className={`text-xs font-bold ${tf.ob.active ? 'text-white' : 'text-white/20'}`}>{tf.ob.text}</p>
                  </div>
                  {/* Row 2 */}
                  <div className="bg-black p-3 flex justify-between items-center">
                    <p className="text-xs text-white/50">الفجوة العادلة (FVG)</p>
                    <p className={`text-xs font-bold ${tf.fvg.active ? 'text-white' : 'text-white/20'}`}>{tf.fvg.text}</p>
                  </div>
                  <div className="bg-black p-3 flex justify-between items-center">
                    <p className="text-xs text-white/50">نسبة الارتداد (FIB)</p>
                    <p className={`text-xs font-bold ${tf.fib.active ? 'text-white' : 'text-white/20'}`}>{tf.fib.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* VERDICT Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="border border-[#ff6a00] rounded-xl bg-black p-5 flex flex-col relative"
          >
            <div className="absolute top-0 right-0 w-1 h-full bg-[#ff6a00]" />
            <p className="text-xs text-[#ff6a00] font-mono mb-4 text-right">الخلاصة التوجيهية الاستراتيجية // VERDICT</p>
            <p className="text-xl font-black text-white text-right leading-tight mb-4">
              يفضل الانتظار لتقييم الاتجاه قبل طرح صفقات
            </p>
            <p className="text-sm text-white/60 text-right leading-relaxed font-medium">
              {result.verdictText}
            </p>
          </motion.div>

        </div>
      )}
    </div>
  );
}
