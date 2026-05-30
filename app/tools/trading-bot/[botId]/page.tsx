'use client';

/**
 * app/tools/trading-bot/[botId]/page.tsx
 *
 * Dynamic Trading Bot Interface
 * Renders 1 of 10 distinct algorithmic trading bots based on the route parameter.
 */

import { useState, useEffect, use } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanSearch, AlertCircle, Bot, Activity, Crosshair, Target, ShieldAlert, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { generateBotSignal, TradingBotSignal } from '@/lib/algorithms/tradingBots';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { getAssetInfo } from '@/lib/assetInfo';
import { useRouter } from 'next/navigation';

export default function TradingBotPage({ params }: { params: Promise<{ botId: string }> }) {
  const router = useRouter();
  
  // Unwrap params using React `use` for Next.js 15+ dynamic routes
  const unwrappedParams = use(params);
  const botId = unwrappedParams.botId;

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TradingBotSignal | null>(null);
  
  // Pre-fetch the bot's static info on load just to show header correctly
  const botStatic = generateBotSignal(botId, 0);

  const handleRunBot = async () => {
    setError('');
    if (!symbol.trim()) return setError('أدخل اسم الأصل للتداول.');
    
    setLoading(true);
    
    try {
      // Fetch real current price
      let currentPrice = 0;
      const sym = symbol.toUpperCase().trim();
      const COMMODITIES = ['XAUUSD', 'WTIUSD', 'BRENTUSD', 'USDEGP', 'EGYXAU'];

      if (COMMODITIES.includes(sym)) {
        // Real-time commodity price
        const res = await fetch('/api/commodities');
        if (res.ok) {
          const data = await res.json();
          const priceMap: Record<string, number> = {
            XAUUSD: data.gold?.price,
            WTIUSD: data.oil?.price,
            BRENTUSD: data.oil?.price,
            USDEGP: data.usdEgp?.price,
            EGYXAU: data.egyptianGold?.price,
          };
          currentPrice = priceMap[sym] || 0;
        }
      } else {
        // Binance ticker
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`);
        if (res.ok) {
          const data = await res.json();
          currentPrice = parseFloat(data.price) || 0;
        }
      }

      if (!currentPrice) currentPrice = 1000; // last resort
      const res = generateBotSignal(botId, currentPrice);
      setResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ في تشغيل المستشار الآلي.');
    } finally {
      setLoading(false);
    }
  };

  const assetInfo = getAssetInfo(symbol);
  const priceStr  = (val: number) => {
    const info = getAssetInfo(symbol);
    const fmt  = val.toLocaleString('en-US', { minimumFractionDigits: info.precision, maximumFractionDigits: Math.max(info.precision, 2) });
    return info.prefix ? `${info.prefix}${fmt}` : `${fmt} ${info.unit}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      
      {/* Custom Header for Dynamic Route */}
      <div className="flex flex-col border-b border-white/[0.05] bg-black/50 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-white font-black text-lg tracking-tight leading-none">
                {botStatic.nameAr}
              </h1>
              <span className="text-[10px] text-indigo-400/70 uppercase tracking-widest font-mono mt-1">
                ALGO-TRADER v{botId}.0
              </span>
            </div>
          </div>
          <button onClick={() => router.back()} className="text-xs font-bold text-white/40 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.05]">
            عودة
          </button>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-5 mt-5">
        
        {/* Strategy Description Box */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-white/80 leading-relaxed">
            {botStatic.descriptionAr}
          </p>
        </div>

        {/* Control Panel */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-4 shadow-xl shadow-black/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">تحديد الأصل المالي</label>
            <SymbolDropdown value={symbol} onChange={setSymbol} />
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
            onClick={handleRunBot}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl py-4 font-black text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 text-white"
            style={{
              background: loading ? 'linear-gradient(135deg, #312e81, #1e1b4b)' : 'linear-gradient(135deg, #6366f1, #4338ca)',
              boxShadow: !loading ? '0 0 20px rgba(99, 102, 241, 0.25)' : 'none'
            }}
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Activity className="w-4 h-4" />}
            {loading ? 'جاري تحليل الأسواق...' : 'تشغيل الخوارزمية'}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 18 }}
              className="flex flex-col gap-4"
            >
              
              <div className="grid grid-cols-2 gap-3">
                {/* Win Rate Radial Chart */}
                <div className="flex flex-col items-center justify-center p-5 rounded-2xl border border-indigo-500/20 bg-[#111] shadow-lg relative">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest absolute top-3 left-3">Win Rate</span>
                  <div className="relative w-24 h-24 flex items-center justify-center mt-2">
                    {/* Background Circle */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                      <motion.circle 
                        cx="48" cy="48" r="40" fill="transparent" 
                        stroke="#4ade80" 
                        strokeWidth="8" 
                        strokeDasharray={251.2} 
                        strokeLinecap="round"
                        initial={{ strokeDashoffset: 251.2 }}
                        animate={{ strokeDashoffset: 251.2 - (251.2 * result.winRate) / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                        style={{ filter: 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.5))' }}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-xl font-black text-emerald-400 font-mono">{result.winRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Signal State & Risk */}
                <div className="flex flex-col justify-between gap-3">
                  <div className={`flex-1 rounded-2xl border p-4 flex flex-col items-center justify-center gap-2 ${
                    result.signal === 'BUY' ? 'bg-emerald-500/10 border-emerald-500/30' :
                    result.signal === 'SELL' ? 'bg-red-500/10 border-red-500/30' :
                    'bg-white/5 border-white/10'
                  }`}>
                    {result.signal === 'BUY' ? <ArrowUpRight className="w-8 h-8 text-emerald-400" /> :
                     result.signal === 'SELL' ? <ArrowDownRight className="w-8 h-8 text-red-400" /> :
                     <Activity className="w-8 h-8 text-white/40" />}
                     
                    <span className={`text-xl font-black tracking-widest ${
                      result.signal === 'BUY' ? 'text-emerald-400' :
                      result.signal === 'SELL' ? 'text-red-400' :
                      'text-white/40'
                    }`}>
                      {result.signal === 'BUY' ? 'شراء قوي' : result.signal === 'SELL' ? 'بيع قوي' : 'انتظار'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-black/40 p-3 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">R:R Ratio</span>
                    <span className="text-sm font-black text-indigo-400 font-mono">{result.riskReward}</span>
                  </div>
                </div>
              </div>

              {/* Trade Execution Card */}
              {result.signal !== 'WAIT' && (
                <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md overflow-hidden shadow-2xl">
                  <div className="bg-indigo-500/10 border-b border-indigo-500/20 p-4">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                      <Crosshair className="w-4 h-4" /> بطاقة التداول الآلية (Execution)
                    </span>
                  </div>
                  
                  {/* Entry & SL */}
                  <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/[0.05]">
                    <div className="flex flex-col p-4 gap-1.5">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Entry (نقطة الدخول)</span>
                      <span className="text-xl font-black text-white font-mono">${priceStr(result.entryPrice)}</span>
                    </div>
                    <div className="flex flex-col p-4 gap-1.5 bg-red-500/5">
                      <span className="text-[10px] font-bold text-red-500/80 uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Stop Loss</span>
                      <span className="text-xl font-black text-red-400 font-mono">${priceStr(result.stopLoss)}</span>
                    </div>
                  </div>

                  {/* TPs */}
                  <div className="flex flex-col p-4 gap-3 border-t border-white/[0.05] bg-emerald-500/5">
                    <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest flex items-center gap-1 mb-1"><Target className="w-3 h-3" /> Take Profits (جني الأرباح)</span>
                    
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-emerald-500/10">
                      <span className="text-[11px] font-bold text-white/40 font-mono">TP 1</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">${priceStr(result.tp1)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-emerald-500/10">
                      <span className="text-[11px] font-bold text-white/40 font-mono">TP 2</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">${priceStr(result.tp2)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-emerald-500/10">
                      <span className="text-[11px] font-bold text-white/40 font-mono">TP 3</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">${priceStr(result.tp3)}</span>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
