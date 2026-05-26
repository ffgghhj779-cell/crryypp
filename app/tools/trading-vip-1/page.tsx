'use client';

/**
 * app/tools/trading-vip-1/page.tsx
 *
 * Trading VIP 1 - Consensus Engine (محرك الإجماع الفائق)
 * Combines 5 sub-algorithms. Blocks trades if consensus < 65%.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, ShieldBan, CheckCircle, Target, ShieldAlert } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { generateVIP1Setup, Vip1Result, Vip1TradeSetup } from '@/lib/algorithms/vip1';
import { fetchKlines } from '@/lib/binance/fetcher';
import { notFound } from 'next/navigation';

export default function Vip1Page() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  
  const [result, setResult] = useState<Vip1Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  const tool = slugToTool('trading-vip-1');
  if (!tool) return notFound();

  const handleCalculate = async () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل.');
    
    setLoading(true);
    setAnimated(false);
    
    try {
      const klines = await fetchKlines(symbol.toUpperCase().trim(), '1d', 100);
      if (klines.length === 0) throw new Error('لا توجد بيانات متاحة لهذا الأصل.');
      
      const res = generateVIP1Setup(symbol.toUpperCase().trim(), klines);
      setResult(res);
      setTimeout(() => setAnimated(true), 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء جلب البيانات أو المعالجة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-4 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-orange-500/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full">
            VIP Consensus
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          TRADING VIP 1 (محرك الإجماع الفائق)
        </h1>
        <p className="text-[12px] text-white/40 font-mono leading-relaxed">
          نظام مؤسسي مدمج بـ 5 خوارزميات لفلترة الصفقات الآمنة
        </p>
      </div>

      <div className="px-4 flex flex-col gap-5">
        {/* Input */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-4 shadow-xl shadow-black/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">رمز الأصل المالي</label>
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
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
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 font-black text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #7c2d12, #431407)' : 'linear-gradient(135deg, #ea580c, #9a3412)',
              boxShadow: !loading ? '0 0 20px rgba(234, 88, 12, 0.25)' : 'none'
            }}
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {loading ? 'جاري التحليل...' : 'تشغيل محرك الإجماع'}
          </button>
        </div>

        {/* Results */}
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
              {result.setups.map((setup, idx) => (
                <Vip1TradeCard key={setup.timeframe} setup={setup} delay={0.1 * idx} animated={animated} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Vip1TradeCard({ setup, delay, animated }: { setup: Vip1TradeSetup, delay: number, animated: boolean }) {
  const isBlocked = setup.isBlocked;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`rounded-xl border ${isBlocked ? 'border-gray-500/20 bg-[#0d0d0d]/80' : 'border-orange-500/20 bg-[#111]'} overflow-hidden shadow-lg`}
    >
      <div className="p-4 border-b border-white/[0.04] flex justify-between items-center bg-white/[0.01]">
        <div className="flex flex-col">
          <span className="text-[12px] font-black text-white/80">{setup.tfLabelAr}</span>
          {!isBlocked && (
            <span className={`text-[10px] font-bold ${setup.bias === 'BULL' ? 'text-emerald-400' : 'text-red-400'}`}>
              {setup.bias === 'BULL' ? 'شراء (BUY)' : 'بيع (SELL)'}
            </span>
          )}
        </div>
        
        {/* Circular Progress (Consensus Meter) */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="w-12 h-12 transform -rotate-90">
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/10" />
            <motion.circle
              cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent"
              strokeDasharray={125.6} // 2 * PI * 20
              initial={{ strokeDashoffset: 125.6 }}
              animate={animated ? { strokeDashoffset: 125.6 - (125.6 * setup.consensusScorePct) / 100 } : { strokeDashoffset: 125.6 }}
              transition={{ duration: 1.5, delay: delay + 0.2 }}
              className={isBlocked ? 'text-gray-500' : 'text-orange-500'}
              strokeLinecap="round"
            />
          </svg>
          <span className={`absolute text-[10px] font-black font-mono ${isBlocked ? 'text-gray-400' : 'text-orange-400'}`}>
            {setup.consensusScorePct}%
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Sub-Algorithms Breakdown */}
        <div className="flex justify-between gap-1 items-end h-16 bg-black/40 p-2 rounded-lg border border-white/[0.03]">
          {setup.subAlgorithms.map((sub, i) => (
            <div key={sub.id} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-[8px] font-mono text-white/40">{sub.weightContribPct}%</span>
              <motion.div 
                className={`w-full rounded-sm ${isBlocked ? 'bg-gray-600/50' : 'bg-orange-500/70'}`}
                initial={{ height: 0 }}
                animate={animated ? { height: `${(sub.weightContribPct / 25) * 100}%` } : { height: 0 }}
                transition={{ duration: 1, delay: delay + 0.5 + i * 0.1 }}
                style={{ maxHeight: '100%' }}
              />
              <span className="text-[7px] text-white/30 uppercase">{sub.id}</span>
            </div>
          ))}
        </div>

        {isBlocked ? (
          <div className="flex flex-col items-center justify-center py-4 px-2 gap-2 text-center border border-dashed border-gray-600/50 rounded-lg bg-gray-500/5">
            <ShieldBan className="w-8 h-8 text-gray-500" />
            <p className="text-[11px] font-bold text-gray-400 leading-relaxed">
              {setup.blockedReasonAr}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Entry & SL */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-orange-500/50 uppercase tracking-widest flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Entry</span>
                <span className="text-lg font-black text-white font-mono">{setup.entryPrice}</span>
              </div>
              <div className="h-8 w-px bg-orange-500/20" />
              <div className="flex flex-col gap-1 items-end">
                <span className="text-[10px] font-mono text-red-500/70 uppercase tracking-widest flex items-center gap-1">Stop Loss <ShieldAlert className="w-3 h-3" /></span>
                <span className="text-lg font-black text-red-400 font-mono">{setup.stopLoss}</span>
              </div>
            </div>

            {/* TPs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[9px] text-white/40 font-mono mb-1">TP 1</span>
                <span className="text-[11px] font-bold text-emerald-400 font-mono">{setup.tp1}</span>
                <span className="text-[9px] text-emerald-500/60 font-mono mt-0.5">+{setup.profitPct1}</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[9px] text-white/40 font-mono mb-1">TP 2</span>
                <span className="text-[11px] font-bold text-emerald-400 font-mono">{setup.tp2}</span>
                <span className="text-[9px] text-emerald-500/60 font-mono mt-0.5">+{setup.profitPct2}</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[9px] text-white/40 font-mono mb-1">TP 3</span>
                <span className="text-[11px] font-bold text-emerald-400 font-mono">{setup.tp3}</span>
                <span className="text-[9px] text-emerald-500/60 font-mono mt-0.5">+{setup.profitPct3}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
