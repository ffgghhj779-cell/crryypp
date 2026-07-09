'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Building2, ShieldAlert, Target, Zap, Activity } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, HorizontalLine } from '@/components/tools/ToolChart';
import { calculateSMC, SMCResult } from '@/lib/algorithms/smc';

export default function SMCOrderBlocksPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SMCResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  
  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), '4h', 300);
      if (fetchedKlines.length < 50) throw new Error('بيانات غير كافية للتحليل (نحتاج 50 شمعة على الأقل)');
      
      setKlines(fetchedKlines);
      const res = calculateSMC(fetchedKlines, symbol);
      setResult(res);
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol]);

  const isBullish = result?.verdict === 'BULLISH';
  const colorHex = isBullish ? '#10b981' : '#ef4444';
  const statusColor = result?.status === 'FRESH' ? '#10b981' : result?.status === 'MITIGATED' ? '#f59e0b' : '#ef4444';

  const priceStr = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: val > 1000 ? 1 : 4, maximumFractionDigits: val > 1000 ? 1 : 4 });

  // Generate lines for ToolChart
  const priceLines: HorizontalLine[] = [];
  if (result) {
    priceLines.push({
      price: result.priceRange.high,
      color: colorHex,
      title: 'OB High',
      lineWidth: 1,
      lineStyle: 2
    });

    priceLines.push({
      price: result.priceRange.low,
      color: colorHex,
      title: 'OB Low',
      lineWidth: 1,
      lineStyle: 2
    });

    priceLines.push({
      price: result.bosLevel,
      color: '#f59e0b',
      title: 'BOS Level',
      lineWidth: 2,
      lineStyle: 1
    });
  }

  const tool = slugToTool('smc-order-blocks');
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-indigo-400/70 tracking-widest uppercase border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Smart Money Concepts
        </span>
        <h1 className="text-xl font-black text-white mt-1">الأوردر بلوك المؤسساتي</h1>
        <p className="text-sm text-white/40 font-mono">Institutional Order Blocks & BOS Detection</p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4 shadow-xl">
          <SymbolDropdown value={symbol} onChange={setSymbol} />
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#4f46e5,#3730a3)', boxShadow: !loading ? '0 0 20px rgba(79,70,229,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري التحليل المؤسساتي...' : 'تحليل الأوردر بلوك'}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-4">
              
              <div className={`rounded-xl border p-6 flex flex-col gap-3 shadow-lg ${isBullish ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5"><Activity className="w-3 h-3" /> اتجاه السيولة</span>
                    <span className={`text-lg font-black tracking-widest ${isBullish ? 'text-emerald-400' : 'text-red-400'}`}>أوردر بلوك {isBullish ? 'شرائي (Demand)' : 'بيعي (Supply)'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 py-4 rounded-lg bg-black/40 border border-white/[0.05]">
                  <Zap className={`w-6 h-6 ${isBullish ? 'text-emerald-500' : 'text-red-500'}`} />
                  <span className="text-sm font-bold text-white/80">{result.strongMoveDetails}</span>
                </div>
              </div>

              <div className="rounded-2xl bg-[#050505] p-4 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Order Block Zone
                  </p>
                  <p className="text-xs font-mono text-white/40">{symbol.toUpperCase()} • 4H</p>
                </div>
                <ToolChart 
                  klines={klines}
                  height={300}
                  priceLines={priceLines}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4">
                  <p className="text-xs text-white/40 mb-1">حالة المنطقة (Status)</p>
                  <p className="text-lg font-black font-mono" style={{ color: statusColor }}>{result.status}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/[0.06] p-4">
                  <p className="text-xs text-white/40 mb-1">قوة الأوردر بلوك (Score)</p>
                  <p className="text-lg font-black text-white font-mono">{result.score}/100</p>
                </div>
              </div>

              {/* Trade Execution */}
              <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5">
                <span className="text-sm font-bold text-white/70 uppercase tracking-widest border-b border-white/[0.05] pb-2 mb-1">
                  إعدادات الصفقة المقترحة
                </span>

                <div className="flex justify-between items-center p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><ScanSearch className="w-3 h-3" /> Entry Level</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base font-black text-white font-mono">{priceStr(result.setup.entry)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div className="flex flex-col p-3 rounded-lg bg-red-500/5 border border-red-500/10 gap-1.5">
                    <span className="text-sm font-mono text-red-500/70 uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Stop Loss</span>
                    <span className="text-lg font-black text-red-400 font-mono">{priceStr(result.setup.sl)}</span>
                  </div>
                  <div className="flex flex-col p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 gap-1.5">
                    <span className="text-sm font-mono text-emerald-500/70 uppercase tracking-widest flex items-center gap-1"><Target className="w-3 h-3" /> Targets</span>
                    <div className="flex justify-between"><span className="text-sm text-white/40 font-mono">TP1</span><span className="text-sm font-black text-emerald-400 font-mono">{priceStr(result.setup.tp1)}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-white/40 font-mono">TP2</span><span className="text-sm font-black text-emerald-400 font-mono">{priceStr(result.setup.tp2)}</span></div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: colorHex + '30', background: colorHex + '08' }}>
                <p className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: colorHex }}>توصية الدخول</p>
                <p className="text-sm text-white/70 leading-relaxed">
                  {result.status === 'BROKEN' ? 'المنطقة مكسورة. يفضل عدم التداول عليها والبحث عن أوردر بلوك جديد.' : 
                   result.status === 'MITIGATED' ? 'المنطقة تم لمسها مسبقاً (Mitigated). الدخول هنا يحمل مخاطرة أعلى.' :
                   `المنطقة حديثة ولم تُلمس بعد (Fresh). يعتبر مستوى ${priceStr(result.setup.entry)} نقطة ارتداد قوية محتملة.`}
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
