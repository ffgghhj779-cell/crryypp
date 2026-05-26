'use client';

import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Layers, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function OrderBookPage() {
  const { symbol, currentPrice, isLoading } = useMarketData();
  const tool = slugToTool('order-book');

  // Simulate an order book around the current price for visual demonstration
  const { asks, bids } = useMemo(() => {
    if (!currentPrice) return { asks: [], bids: [] };
    
    const spread = currentPrice * 0.0001; // 0.01%
    const mockAsks = [];
    const mockBids = [];
    
    // Seed predictable randomness based on currentPrice to avoid crazy jumping
    const seed = Math.floor(currentPrice);
    
    for (let i = 0; i < 15; i++) {
      const askPrice = currentPrice + spread * (i + 1) + (seed % (i+1));
      const bidPrice = currentPrice - spread * (i + 1) - (seed % (i+1));
      
      const askVol = ((seed * (i+1) * 17) % 500) / 10 + 0.1;
      const bidVol = ((seed * (i+1) * 23) % 500) / 10 + 0.1;

      mockAsks.unshift({ price: askPrice, size: askVol, total: 0 }); // Reverse asks for UI (highest at top)
      mockBids.push({ price: bidPrice, size: bidVol, total: 0 });
    }

    // Calculate totals
    let askTotal = 0;
    for (let i = mockAsks.length - 1; i >= 0; i--) {
      askTotal += mockAsks[i].size;
      mockAsks[i].total = askTotal;
    }
    
    let bidTotal = 0;
    for (let i = 0; i < mockBids.length; i++) {
      bidTotal += mockBids[i].size;
      mockBids[i].total = bidTotal;
    }

    return { asks: mockAsks, bids: mockBids };
  }, [currentPrice]);

  if (!tool) return notFound();

  const maxTotal = Math.max(
    asks.length ? asks[0].total : 0, 
    bids.length ? bids[bids.length - 1].total : 0
  ) || 1;

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });
  const formatSize = (s: number) => s.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-indigo-500/70 tracking-widest uppercase border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Depth
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">تحليل دفتر الأوامر</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          نظرة حية على عمق السوق وطلبات الشراء وعروض البيع
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-indigo-500/80 font-bold tracking-widest uppercase text-sm animate-pulse">جاري جلب دفتر الأوامر...</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-1 rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-3 shadow-xl"
          >
            {/* Table Header */}
            <div className="grid grid-cols-3 text-sm text-white/30 font-bold uppercase tracking-widest pb-2 border-b border-white/[0.05] mb-2 px-2">
              <div className="text-right">الإجمالي</div>
              <div className="text-center">الكمية</div>
              <div className="text-left">السعر</div>
            </div>

            {/* Asks (Red) */}
            <div className="flex flex-col gap-[2px]">
              {asks.map((ask, i) => (
                <div key={i} className="relative grid grid-cols-3 text-sm font-mono py-1 px-2 items-center z-10 overflow-hidden rounded group">
                  <div className="absolute right-0 top-0 bottom-0 bg-red-500/10 -z-10 transition-all group-hover:bg-red-500/20" style={{ width: `${(ask.total / maxTotal) * 100}%` }} />
                  <div className="text-right text-white/40">{formatSize(ask.total)}</div>
                  <div className="text-center text-white/60">{formatSize(ask.size)}</div>
                  <div className="text-left text-red-400 font-bold">{formatPrice(ask.price)}</div>
                </div>
              ))}
            </div>

            {/* Current Price Divider */}
            <div className="flex items-center justify-center py-4 my-1 border-y border-white/[0.05] bg-white/[0.02]">
              <span className="text-xl font-black text-white tracking-widest font-mono">
                {formatPrice(currentPrice ?? 0)}
              </span>
            </div>

            {/* Bids (Green) */}
            <div className="flex flex-col gap-[2px]">
              {bids.map((bid, i) => (
                <div key={i} className="relative grid grid-cols-3 text-sm font-mono py-1 px-2 items-center z-10 overflow-hidden rounded group">
                  <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 -z-10 transition-all group-hover:bg-emerald-500/20" style={{ width: `${(bid.total / maxTotal) * 100}%` }} />
                  <div className="text-right text-white/40">{formatSize(bid.total)}</div>
                  <div className="text-center text-white/60">{formatSize(bid.size)}</div>
                  <div className="text-left text-emerald-400 font-bold">{formatPrice(bid.price)}</div>
                </div>
              ))}
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
