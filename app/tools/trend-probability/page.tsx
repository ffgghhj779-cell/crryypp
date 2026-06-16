'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { RefreshCcw, FolderOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ContextAssetBar } from '@/components/tools/ContextAssetBar';
import { calculateTrendProbability } from '@/lib/algorithms/trendProbability';

export default function TrendProbabilityPage() {
  const { symbol, candles, isLoading } = useMarketData();
  const tool = slugToTool('trend-probability');

  const result = useMemo(() => {
    if (!candles || candles.length < 30) return null;
    return calculateTrendProbability(symbol, candles);
  }, [candles, symbol]);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <ContextAssetBar />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <h1 className="text-xl font-black text-white tracking-tight mt-1 text-center mb-4">محرك ترجيح الاتجاه</h1>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-[#ff6a00] animate-spin" />
            <p className="text-[#ff6a00]/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري التحليل الحجمي...</p>
          </div>
        ) : !result ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <p className="text-[#ff6a00]/80 font-bold tracking-widest uppercase text-sm">بيانات غير كافية للتحليل.</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 mt-2"
          >
            {/* Indicators Cards */}
            <div className="flex flex-col gap-3">
              {/* VW-MACD Card */}
              <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col items-end relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-[#ff6a00]/50" />
                <p className="text-[#ff6a00] font-mono text-xs mb-3">VW-MACD (الزخم الحجمي)</p>
                <p className="text-white font-black text-xl mb-1">{result.vwMacd.result}</p>
                <p className="text-white/50 text-xs font-mono">{result.vwMacd.desc}</p>
              </div>

              {/* Weis Wave Card */}
              <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col items-end relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-[#ff6a00]/50" />
                <p className="text-[#ff6a00] font-mono text-xs mb-3">Weis Wave (البصمة الحجمية)</p>
                <p className="text-white font-black text-xl mb-1">{result.weisWave.result}</p>
                <p className="text-white/50 text-xs font-mono">{result.weisWave.desc}</p>
              </div>

              {/* Vol-RSI Card */}
              <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col items-end relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-[#ff6a00]/50" />
                <p className="text-[#ff6a00] font-mono text-xs mb-3">Vol-RSI (التشبع الديناميكي)</p>
                <p className="text-white font-black text-xl mb-1">{result.volRsi.value}</p>
                <p className="text-white/50 text-xs font-mono">{result.volRsi.desc}</p>
              </div>
            </div>

            {/* Probability Bars */}
            <div className="bg-[#111] border border-white/10 rounded-xl p-5 mt-2 flex flex-col">
              <p className="text-[#ff6a00] font-black text-lg mb-1 text-center">ترجيح الاتجاه Directional</p>
              <p className="text-[#ff6a00] font-black text-lg mb-6 text-center">(Probability</p>

              <div className="flex flex-col gap-5">
                {/* Bullish */}
                <div className="flex items-center gap-3">
                  <p className="text-white font-black w-8">{result.probabilities.bullish}%</p>
                  <div className="flex-1 h-3 bg-black rounded-full overflow-hidden flex justify-end">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${result.probabilities.bullish}%` }}
                      transition={{ duration: 1 }}
                      className="h-full bg-white rounded-full"
                    />
                  </div>
                  <div className="flex flex-col items-end w-12">
                    <p className="text-white text-xs font-bold">صاعد</p>
                    <span className="text-white/50 text-[10px]">📈</span>
                  </div>
                </div>

                {/* Sideways */}
                <div className="flex items-center gap-3">
                  <p className="text-white font-black w-8">{result.probabilities.sideways}%</p>
                  <div className="flex-1 h-3 bg-black rounded-full overflow-hidden flex justify-end">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${result.probabilities.sideways}%` }}
                      transition={{ duration: 1 }}
                      className="h-full bg-gray-500 rounded-full"
                    />
                  </div>
                  <div className="flex flex-col items-end w-12">
                    <p className="text-white text-xs font-bold">عرضي</p>
                    <span className="text-white/50 text-[10px]">➖</span>
                  </div>
                </div>

                {/* Bearish */}
                <div className="flex items-center gap-3">
                  <p className="text-[#ff6a00] font-black w-8">{result.probabilities.bearish}%</p>
                  <div className="flex-1 h-3 bg-black rounded-full overflow-hidden flex justify-end">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${result.probabilities.bearish}%` }}
                      transition={{ duration: 1 }}
                      className="h-full bg-[#ff6a00] rounded-full"
                    />
                  </div>
                  <div className="flex flex-col items-end w-12">
                    <p className="text-[#ff6a00] text-xs font-bold">هابط</p>
                    <span className="text-[#ff6a00]/50 text-[10px]">📉</span>
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div className="mt-8 border-r-2 border-[#ff6a00] pr-4">
                <p className="text-[#ff6a00]/60 font-mono text-xs mb-2 text-right">الخلاصة الآلية:</p>
                <p className="text-white text-sm font-medium leading-relaxed text-right">
                  {result.verdict}
                </p>
              </div>

              <div className="flex justify-start mt-6">
                <div className="w-8 h-8 rounded-full border border-[#ff6a00]/30 flex items-center justify-center">
                  <FolderOpen className="w-4 h-4 text-[#ff6a00]" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
