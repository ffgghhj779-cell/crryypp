'use client';

/**
 * app/tools/trading-vip-3/page.tsx
 *
 * Trading VIP 3 - Institutional Trading System
 * Combines RSI Divergence, Fibonacci OTE, and SMC Order Blocks into actionable setups.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, ChevronDown, Activity, Info, Target, Crosshair, ShieldAlert } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { generateVIP3Setup, Vip3Result, Vip3TradeSetup, ToolGrade } from '@/lib/algorithms/vip3';
import { useMarketData } from '@/context/MarketDataContext';
import { notFound } from 'next/navigation';

export default function Vip3Page() {
  const { symbol, setSymbol, candles, isLoading } = useMarketData();
  const [localSymbol, setLocalSymbol] = useState(symbol);
  
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  
  const tool = slugToTool('trading-vip-3');

  // Compute VIP3 result directly during render from global state
  let result: Vip3Result | null = null;
  if (candles.length > 0 && symbol.trim()) {
    try {
      result = generateVIP3Setup(symbol.toUpperCase().trim(), candles as any);
    } catch (err: any) {
      console.error('VIP 3 Engine Error:', err);
    }
  }

  // Use a simple delayed animation flag that resets when data changes
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setAnimated(true), 100);
      return () => {
        clearTimeout(timer);
        setAnimated(false);
      };
    }
  }, [result]);

  const handleCalculate = async () => {
    setError('');
    if (!localSymbol.trim()) return setError('أدخل اسم الأصل.');
    
    setCalculating(true);
    setAnimated(false);
    
    // Update global symbol. The MarketDataContext will automatically fetch live data,
    // which then triggers the useEffect above to recalculate.
    setSymbol(localSymbol.toUpperCase().trim());
    
    setTimeout(() => {
      setCalculating(false);
    }, 500); // Visual feedback
  };

  if (!tool) return notFound();

  // Sleek glowing skeleton for global data loading
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
        <ToolPageHeader tool={tool} />
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="relative flex items-center justify-center">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-20 h-20 rounded-full border-t-2 border-r-2 border-orange-500/80 shadow-[0_0_25px_rgba(249,115,22,0.6)]"
            />
            <Activity className="absolute w-8 h-8 text-orange-400 animate-pulse" />
          </div>
          <p className="text-orange-500/80 font-bold tracking-widest uppercase text-xs animate-pulse">
            جاري مزامنة بيانات المؤسسات المباشرة...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full">
            Institutional
          </span>
          <span className="text-[9px] font-black text-emerald-500/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Live Data
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          Trading VIP 3 (نظام المؤسسات)
        </h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          دخول فائق الدقة بدمج (RSI Div, Fib OTE, SMC OB)
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5">
        {/* ── Input Form ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-4 shadow-xl shadow-black/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">رمز الأصل المالي (Spot)</label>
            <input
              type="text"
              value={localSymbol}
              onChange={e => setLocalSymbol(e.target.value)}
              placeholder="BTCUSDT"
              className="w-full rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-sm px-4 py-3 placeholder:text-white/20 focus:outline-none focus:border-orange-500/40 transition-colors"
              dir="ltr"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 mt-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 font-black text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: calculating ? 'linear-gradient(135deg, #7c2d12, #431407)' : 'linear-gradient(135deg, #f97316, #c2410c)',
              boxShadow: !calculating ? '0 0 20px rgba(249, 115, 22, 0.25)' : 'none'
            }}
          >
            {calculating ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {calculating ? 'جاري المزامنة مع السوق...' : 'تحديث إشارات VIP 3'}
          </button>
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="flex flex-col gap-4"
            >
              {/* Master Scoreboard */}
              <div className="rounded-2xl border border-orange-500/20 bg-[#111] p-5 flex flex-col shadow-[0_0_30px_rgba(249,115,22,0.1)] relative overflow-hidden">
                <div 
                  className="absolute -right-10 -top-10 w-40 h-40 bg-orange-500/10 blur-[50px] rounded-full pointer-events-none"
                />
                
                <div className="flex justify-between items-start mb-4 z-10">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-orange-500/70 uppercase tracking-widest">MASTER SIGNAL</span>
                    <span className={`text-xl font-black tracking-widest ${
                      result.masterBias === 'BULL' ? 'text-emerald-500' : result.masterBias === 'BEAR' ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {result.masterBias}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">TFs ALIGNED</span>
                    <span className="text-xl font-black text-white/90 font-mono">{result.tfsAligned}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 z-10">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 shadow-[0_0_15px_currentColor] ${
                    result.masterBias === 'BULL' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 
                    result.masterBias === 'BEAR' ? 'border-red-500/50 text-red-400 bg-red-500/10' : 
                    'border-gray-500/50 text-gray-400 bg-gray-500/10'
                  }`}>
                    <span className="text-3xl font-black uppercase leading-none">
                      {result.masterBias.charAt(0)}
                    </span>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Score Quality</span>
                      <span className="text-lg font-black text-orange-400 font-mono leading-none">{result.masterScore}/100</span>
                    </div>
                    {/* Score Bar */}
                    <div className="h-2 w-full bg-black/60 rounded-full border border-white/[0.05] relative overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={animated ? { width: `${result.masterScore}%` } : { width: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full rounded-r-full bg-gradient-to-l from-orange-400 to-orange-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Trade Setup Cards */}
              <div className="flex flex-col gap-3">
                {result.setups.map((setup, idx) => (
                  <TradeSetupCard key={setup.timeframe} setup={setup} delay={0.2 + idx * 0.15} />
                ))}
              </div>

              {/* Reading Guide */}
              <ReadingGuide delay={0.8} />

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────────

function TradeSetupCard({ setup, delay }: { setup: Vip3TradeSetup, delay: number }) {
  const [open, setOpen] = useState(false);
  
  const isBull = setup.bias === 'BULL';
  const colorText = isBull ? 'text-emerald-400' : 'text-red-400';
  const colorBg = isBull ? 'bg-emerald-500/10' : 'bg-red-500/10';
  const colorBorder = isBull ? 'border-emerald-500/20' : 'border-red-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-xl border border-white/[0.08] bg-[#0d0d0d] overflow-hidden shadow-lg"
    >
      {/* Header Button */}
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex flex-col p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors relative overflow-hidden"
      >
        <div className={`absolute top-0 right-0 w-1 h-full ${isBull ? 'bg-emerald-500' : 'bg-red-500'}`} />
        
        <div className="flex justify-between items-center w-full mb-2">
          <span className="text-[11px] font-bold text-white/50">{setup.tfLabelAr}</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded border ${colorBg} ${colorBorder} ${colorText}`}>
              {setup.signalType}
            </span>
            <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>

        <div className="flex justify-between items-end w-full">
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1"><Crosshair className="w-3 h-3" /> Entry / الدخول</span>
            <span className="text-xl font-black text-white/90 font-mono">{setup.entryPrice}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1"><Target className="w-3 h-3" /> Score</span>
            <span className="text-lg font-black text-orange-400 font-mono">{setup.score}</span>
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-white/[0.04] flex flex-col gap-4">
              
              {/* SL */}
              <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-red-500/80 uppercase tracking-widest flex items-center gap-1.5"><ShieldAlert className="w-3 h-3" /> Stop Loss (OB Based)</span>
                  <span className="text-sm font-black text-red-400 font-mono">{setup.stopLoss}</span>
                </div>
                <span className="text-[9px] text-red-500/60 leading-relaxed font-bold">الإلغاء الصارم: إغلاق أسفل هذا المستوى</span>
              </div>

              {/* TPs */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Target className="w-3 h-3" /> Take Profits (Fib Ext)</div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[9px] text-white/40 font-mono mb-1">TP 1</span>
                    <span className="text-[11px] font-bold text-white/80 font-mono">{setup.tp1}</span>
                    <span className="text-[9px] text-emerald-400/80 font-mono mt-0.5">+{setup.profitPct1}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[9px] text-white/40 font-mono mb-1">TP 2</span>
                    <span className="text-[11px] font-bold text-white/80 font-mono">{setup.tp2}</span>
                    <span className="text-[9px] text-emerald-400/80 font-mono mt-0.5">+{setup.profitPct2}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[9px] text-white/40 font-mono mb-1">TP 3</span>
                    <span className="text-[11px] font-bold text-white/80 font-mono">{setup.tp3}</span>
                    <span className="text-[9px] text-emerald-400/80 font-mono mt-0.5">+{setup.profitPct3}</span>
                  </div>
                </div>
              </div>

              {/* Footer Stats */}
              <div className="pt-3 border-t border-white/[0.05] grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-[9px] text-white/40 uppercase font-bold">Quality</span>
                    <span className="text-[10px] text-orange-400 font-black">{setup.quality}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] text-white/40 uppercase font-bold">Exp. Value</span>
                    <span className="text-[10px] text-emerald-400 font-black font-mono">{setup.expValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] text-white/40 uppercase font-bold">Avg R:R</span>
                    <span className="text-[10px] text-white/80 font-black font-mono">{setup.avgRR}</span>
                  </div>
                </div>

                {/* Tool Grades */}
                <div className="flex justify-end items-center gap-1.5">
                  <ToolBadge name="SMC" grade={setup.grades.smc} />
                  <ToolBadge name="FIB" grade={setup.grades.fib} />
                  <ToolBadge name="RSI" grade={setup.grades.rsi} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ToolBadge({ name, grade }: { name: string, grade: ToolGrade }) {
  let color = 'text-gray-400 border-gray-500/30';
  if (grade === 'A') color = 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10';
  if (grade === 'B') color = 'text-amber-400 border-amber-500/50 bg-amber-500/10';
  if (grade === 'C') color = 'text-orange-400 border-orange-500/50 bg-orange-500/10';

  return (
    <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg border ${color}`}>
      <span className="text-[8px] opacity-70 font-mono mb-0.5">{name}</span>
      <span className="text-[12px] font-black leading-none">{grade}</span>
    </div>
  );
}

function ReadingGuide({ delay }: { delay: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-orange-500/20 bg-[#111] overflow-hidden"
    >
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-orange-500" />
          <span className="text-[11px] font-black text-orange-500 tracking-widest uppercase">دليل القراءة (المنهجية)</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-orange-500/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="p-4 border-t border-orange-500/20 text-right">
              <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                <strong className="text-orange-400">التسلسل المنهجي:</strong> RSI Div يقول &quot;انعكاس قادم&quot;، الفيبوناتشي يحدد &quot;المنطقة الذهبية OTE&quot;، و SMC يؤكد &quot;نقطة الدخول والوقف&quot; بناءً على بلوكات أوامر المؤسسات. يتم دمج هذه الإشارات الثلاث لإنتاج صفقات عالية الدقة.
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-[10px] text-white/50 pr-4 list-disc marker:text-orange-500/50">
                <li><strong>الدرجة (Score):</strong> من 100، كلما ارتفعت زادت جودة وموثوقية الصفقة.</li>
                <li><strong>التقييمات (A, B, C):</strong> تقييم أداء كل مؤشر فرعي داخل الصفقة.</li>
                <li><strong>متوسط المخاطرة للعائد (Avg R:R):</strong> يمثل نسبة العائد المتوقع إلى المخاطرة المحتملة في أسوأ السيناريوهات.</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
