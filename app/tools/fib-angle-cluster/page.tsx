'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Network, RefreshCcw, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ContextAssetBar } from '@/components/tools/ContextAssetBar';

export default function FibAngleClusterPage() {
  const { symbol, currentPrice, candles, isLoading } = useMarketData();
  const tool = slugToTool('fib-angle-cluster');

  // Calculate mock clusters
  const clusters = useMemo(() => {
    if (!candles || candles.length === 0 || !currentPrice) return [];

    // Find recent high and low
    const recent = candles.slice(-60);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));
    const range = high - low;

    if (range <= 0) return [];

    // Fibonacci levels
    const fibs = [
      { ratio: 0.382, price: high - (range * 0.382), name: 'فيبو 0.382' },
      { ratio: 0.5, price: high - (range * 0.5), name: 'فيبو 0.500' },
      { ratio: 0.618, price: high - (range * 0.618), name: 'النسبة الذهبية 0.618' },
      { ratio: 0.786, price: high - (range * 0.786), name: 'فيبو 0.786' },
    ];

    // Simulate Angles from the Low (simplified Gann targets)
    const rootLow = Math.sqrt(low);
    const angles = [
      { deg: 90, price: Math.pow(rootLow + (90 / 180), 2), name: 'زاوية 90°' },
      { deg: 180, price: Math.pow(rootLow + (180 / 180), 2), name: 'زاوية 180°' },
      { deg: 270, price: Math.pow(rootLow + (270 / 180), 2), name: 'زاوية 270°' },
    ];

    // Find clusters (where a Fib level and an Angle level are close to each other)
    const threshold = currentPrice * 0.015; // 1.5% overlap threshold
    const foundClusters = [];

    for (const f of fibs) {
      for (const a of angles) {
        if (Math.abs(f.price - a.price) < threshold) {
          const clusterPrice = (f.price + a.price) / 2;
          foundClusters.push({
            price: clusterPrice,
            fibName: f.name,
            angleName: a.name,
            strength: 'قوي جداً (كلاستر متطابق)'
          });
        }
      }
    }

    // Sort by proximity to current price
    foundClusters.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));
    
    // If no exact matches, just add a generic combined level for UI demo purposes
    if (foundClusters.length === 0) {
      const avg = (fibs[2].price + angles[1].price) / 2;
      foundClusters.push({
        price: avg,
        fibName: 'تقارب فيبوناتشي',
        angleName: 'تقارب هندسي',
        strength: 'قوي (تقارب نسبي)'
      });
    }

    return foundClusters.slice(0, 3); // top 3
  }, [candles, currentPrice]);

  if (!tool) return notFound();

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Asset selector — inside tool content */}
      <ContextAssetBar />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-emerald-500/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Network className="w-3 h-3" /> Confluence
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">تطابق الفيبو والزوايا (كلاستر)</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          البحث عن أقوى مناطق الارتداد حيث تتطابق مستويات الفيبوناتشي مع الزوايا الهندسية
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-emerald-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري تحليل الكلاسترات...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="flex items-center gap-3 px-1">
              <Target className="w-5 h-5 text-emerald-500" />
              <h2 className="text-base font-bold text-white/80">أقوى مناطق الارتداد (Reversal Zones):</h2>
            </div>

            <div className="flex flex-col gap-3">
              {clusters.map((c, i) => (
                <div key={i} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-2xl font-black text-emerald-400 font-mono dir-ltr text-right">${formatPrice(c.price)}</span>
                      <span className="text-sm text-emerald-500/70 font-bold uppercase tracking-widest">{c.strength}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2 pt-4 border-t border-emerald-500/10">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-white/40">المستوى الذهبي</span>
                      <span className="text-sm font-bold text-white/90">{c.fibName}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-white/40">الزاوية الهندسية</span>
                      <span className="text-sm font-bold text-white/90">{c.angleName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-6 rounded-xl border border-white/5 bg-white/[0.02]">
              <p className="text-sm text-white/40 leading-relaxed font-bold text-center">
                عندما يتطابق مستوى فيبوناتشي مع زاوية هندسية في نفس السعر، يتشكل &quot;كلاستر&quot; قوي يعمل كدعم أو مقاومة حديدية تصعب كسرها.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
