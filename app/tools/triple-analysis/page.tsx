'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { RefreshCcw, LayoutTemplate } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ContextAssetBar } from '@/components/tools/ContextAssetBar';
import { calculateTripleAnalysis } from '@/lib/algorithms/tripleAnalysis';

export default function TripleAnalysisPage() {
  const { symbol, candles, isLoading } = useMarketData();
  const tool = slugToTool('triple-analysis');

  const result = useMemo(() => {
    if (!candles || candles.length < 50) return null;
    return calculateTripleAnalysis(symbol, candles);
  }, [candles, symbol]);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <ContextAssetBar />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <h1 className="text-xl font-black text-white tracking-tight mt-1 text-center mb-4">التحليل الثلاثي (3 Pillars)</h1>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-[#ff6a00] animate-spin" />
            <p className="text-[#ff6a00]/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري دمج الركائز الثلاث...</p>
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
            
            {/* Overall Score Card */}
            <div className="border border-white/10 rounded-xl bg-black p-5 flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-gray-500 to-green-500" />
              <p className="text-xs text-white/50 font-mono mb-2 uppercase tracking-widest">Aggregate Score</p>
              <p className="text-6xl font-black text-white leading-none mb-4">{result.overallScore}</p>
              <p className="text-sm font-bold text-[#ff6a00] text-center leading-relaxed">
                {result.verdict}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-2">
              {result.pillars.map((pillar, idx) => {
                const isBullish = pillar.status === 'Bullish';
                const isBearish = pillar.status === 'Bearish';
                const colorClass = isBullish ? 'text-green-500' : isBearish ? 'text-red-500' : 'text-gray-400';
                const borderClass = isBullish ? 'border-green-500/30' : isBearish ? 'border-red-500/30' : 'border-gray-500/30';
                const bgClass = isBullish ? 'bg-green-500/5' : isBearish ? 'bg-red-500/5' : 'bg-gray-500/5';

                return (
                  <motion.div 
                    key={pillar.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    className={`border ${borderClass} ${bgClass} rounded-xl p-4 flex flex-col relative`}
                  >
                    <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                      <p className="text-lg font-black text-white">{pillar.name}</p>
                      <div className={`px-2 py-1 rounded text-xs font-bold ${isBullish ? 'bg-green-500/20 text-green-400' : isBearish ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-300'}`}>
                        {pillar.status}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex-1">
                        <div className="h-2 w-full bg-black rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${isBullish ? 'bg-green-500' : isBearish ? 'bg-red-500' : 'bg-gray-500'}`} 
                            style={{ width: `${pillar.score}%` }}
                          />
                        </div>
                      </div>
                      <p className={`text-xl font-black ${colorClass}`}>{pillar.score}</p>
                    </div>

                    <p className="text-xs text-white/60 font-mono mt-1">{pillar.details}</p>
                  </motion.div>
                );
              })}
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
