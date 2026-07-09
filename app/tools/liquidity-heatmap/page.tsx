'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ScanSearch, AlertCircle, Target, Layers } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { fetchKlines, Kline } from '@/lib/binance/fetcher';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';
import { notFound } from 'next/navigation';
import { ToolChart, OverlaySeries } from '@/components/tools/ToolChart';

interface Bucket { 
  priceStart: number;
  priceEnd: number;
  priceMid: number;
  volume: number; 
  pct: number; 
  isHVN: boolean; 
  isPOC: boolean;
}

interface VPResult { 
  buckets: Bucket[]; 
  poc: Bucket; 
  hvns: Bucket[];
  currentPrice: number; 
}

function calcVolumeProfile(klines: Kline[], numBuckets: number = 50): VPResult {
  const currentPrice = klines[klines.length - 1].close;
  
  let maxHigh = -Infinity;
  let minLow = Infinity;
  for (const k of klines) {
    if (k.high > maxHigh) maxHigh = k.high;
    if (k.low < minLow) minLow = k.low;
  }

  // Handle edge case of zero range
  if (maxHigh === minLow) maxHigh += 1;

  const bucketSize = (maxHigh - minLow) / numBuckets;
  const buckets: Bucket[] = Array.from({ length: numBuckets }, (_, i) => ({
    priceStart: minLow + i * bucketSize,
    priceEnd: minLow + (i + 1) * bucketSize,
    priceMid: minLow + (i + 0.5) * bucketSize,
    volume: 0,
    pct: 0,
    isHVN: false,
    isPOC: false,
  }));

  // Distribute volume into buckets
  for (const k of klines) {
    const range = k.high - k.low;
    if (range <= 0) continue;
    
    // Find buckets that overlap with this kline
    for (let i = 0; i < numBuckets; i++) {
      const b = buckets[i];
      // Overlap calculation
      const overlapStart = Math.max(b.priceStart, k.low);
      const overlapEnd = Math.min(b.priceEnd, k.high);
      
      if (overlapEnd > overlapStart) {
        const overlapRatio = (overlapEnd - overlapStart) / range;
        b.volume += k.volume * overlapRatio;
      }
    }
  }

  const maxBucketVol = Math.max(...buckets.map(b => b.volume), 0.0001);
  let poc: Bucket = buckets[0];

  for (let i = 0; i < buckets.length; i++) {
    buckets[i].pct = Math.round((buckets[i].volume / maxBucketVol) * 100);
    if (buckets[i].volume > poc.volume) {
      poc = buckets[i];
    }
  }
  poc.isPOC = true;

  // Find High Volume Nodes (HVNs) - local peaks
  const hvns: Bucket[] = [];
  for (let i = 1; i < buckets.length - 1; i++) {
    if (
      buckets[i].volume > buckets[i-1].volume && 
      buckets[i].volume > buckets[i+1].volume &&
      buckets[i].pct > 40 // must be a significant peak
    ) {
      buckets[i].isHVN = true;
      hvns.push(buckets[i]);
    }
  }
  
  // Also include POC in HVNs if not already
  if (!hvns.find(h => h === poc)) {
    hvns.push(poc);
  }

  // Sort buckets descending by price for visual rendering (highest price at top)
  buckets.sort((a, b) => b.priceMid - a.priceMid);
  hvns.sort((a, b) => b.priceMid - a.priceMid);

  return { buckets, poc, hvns, currentPrice };
}

const fmtP = (p: number) => p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtV = (v: number) => {
  if (v > 1_000_000_000) return `${(v/1_000_000_000).toFixed(2)}B`;
  if (v > 1_000_000) return `${(v/1_000_000).toFixed(2)}M`;
  if (v > 1000) return `${(v/1000).toFixed(1)}K`;
  return v.toFixed(0);
};

export default function LiquidityHeatmapPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('4h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VPResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);

  const handleScan = useCallback(async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const fetchedKlines = await fetchKlines(symbol.toUpperCase().trim(), timeframe, 200);
      if (fetchedKlines.length < 50) throw new Error('بيانات غير كافية لرسم خريطة السيولة بدقة');
      
      setKlines(fetchedKlines);
      setResult(calcVolumeProfile(fetchedKlines, 50));
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ غير متوقع');
    } finally { 
      setLoading(false); 
    }
  }, [symbol, timeframe]);

  let verdict = '';
  if (result) {
    const isAbovePOC = result.currentPrice > result.poc.priceMid;
    const nearestRes = result.hvns.slice().reverse().find(h => h.priceMid > result.currentPrice);
    const nearestSup = result.hvns.find(h => h.priceMid < result.currentPrice);

    verdict = `السعر الحالي ${isAbovePOC ? 'أعلى' : 'أدنى'} من أقوى مستوى للسيولة (Point of Control) عند ${fmtP(result.poc.priceMid)}. `;
    
    if (nearestSup) verdict += `أقرب دعم مبني على الحجم (HVN) يتمركز عند ${fmtP(nearestSup.priceMid)}. `;
    if (nearestRes) verdict += `أقرب مقاومة للسيولة تتمركز عند ${fmtP(nearestRes.priceMid)}. `;
    verdict += `المناطق ذات السيولة العالية تمثل مغناطيس للسعر (Magnet Zones).`;
  }

  // Create chart markers & lines for HVNs
  const chartProps = useMemo(() => {
    if (!result) return null;
    
    const markers: any[] = [];
    const priceLines: any[] = [];
    
    // Draw horizontal lines for POC and HVNs
    priceLines.push({
      price: result.poc.priceMid,
      color: '#f97316',
      lineWidth: 2,
      lineStyle: 0, // solid
      title: 'POC (Max Liquidity)'
    });

    result.hvns.forEach(hvn => {
      if (hvn === result.poc) return;
      priceLines.push({
        price: hvn.priceMid,
        color: '#f97316',
        lineWidth: 1,
        lineStyle: 1, // dashed
        title: 'HVN'
      });
    });

    return { markers, priceLines };
  }, [result]);

  
  const tool = slugToTool('liquidity-heatmap');
  if (!tool) return notFound();
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />
      
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <span className="text-sm font-black text-orange-400/70 tracking-widest uppercase border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 rounded-full w-fit flex items-center gap-1">
          <Flame className="w-3 h-3" /> Liquidity
        </span>
        <h1 className="text-xl font-black text-white mt-1">خريطة السيولة (Volume Profile)</h1>
        <p className="text-sm text-white/40 font-mono">Heatmap of Trading Volume Distribution by Price Level</p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <SymbolDropdown value={symbol} onChange={setSymbol} />
            </div>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 text-white font-bold outline-none focus:border-orange-500/50"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
            </select>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={handleScan} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-black text-base text-white disabled:opacity-50 transition-all"
            style={{ background: loading ? '#1a1a1a' : 'linear-gradient(135deg,#f97316,#c2410c)', boxShadow: !loading ? '0 0 20px rgba(249,115,22,0.25)' : 'none' }}>
            {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ScanSearch className="w-6 h-6" />}
            {loading ? 'جاري رسم خريطة السيولة...' : 'كشف العقد السعرية (HVNs)'}
          </button>
        </div>

        <AnimatePresence>
          {result && chartProps && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="flex flex-col gap-5">
              
              {/* Tool Chart */}
              <div className="rounded-2xl bg-[#050505] p-4 border border-orange-500/20 shadow-lg shadow-orange-500/5">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2">
                    <Target className="w-4 h-4" /> Point of Control (POC): {fmtP(result.poc.priceMid)}
                  </p>
                </div>
                <ToolChart 
                  klines={klines}
                  priceLines={chartProps.priceLines}
                  height={300}
                />
              </div>

              {/* Verdict */}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 bottom-0 w-1 bg-orange-500" />
                <p className="text-sm font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Flame className="w-4 h-4" /> الدليل الإرشادي التكتيكي
                </p>
                <p className="text-sm text-white/80 leading-relaxed font-medium">
                  {verdict}
                </p>
              </div>

              {/* Volume Profile Visualizer */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-5 overflow-hidden">
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">كثافة السيولة السعرية (Heatmap)</p>
                
                <div className="flex flex-col gap-px bg-white/5 p-1 rounded-xl">
                  {result.buckets.map((b, i) => {
                    const isCurrent = Math.abs(b.priceMid - result.currentPrice) < Math.abs(result.buckets[0].priceStart - result.buckets[0].priceEnd);
                    const bgClr = b.isPOC ? '#f97316' : b.isHVN ? '#f59e0b' : '#333';
                    const opacity = b.isPOC ? '1' : b.isHVN ? '0.8' : '0.4';
                    

  return (
                      <div key={i} className={`relative flex items-center px-2 py-1 h-6 hover:bg-white/[0.05] transition-colors group ${isCurrent ? 'bg-white/[0.05]' : ''}`}>
                        {/* Price */}
                        <div className="w-24 shrink-0 flex items-center gap-2 z-10">
                          <span className={`text-[11px] font-mono ${isCurrent ? 'text-white font-black' : 'text-white/40'}`}>
                            {fmtP(b.priceMid)}
                          </span>
                          {b.isPOC && <span className="text-[9px] bg-orange-500 text-white px-1 rounded font-black tracking-tighter">POC</span>}
                        </div>
                        
                        {/* Bar */}
                        <div className="flex-1 h-full relative border-l border-white/10 ml-2 z-10">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${b.pct}%` }}
                            transition={{ duration: 0.5, delay: i * 0.01 }}
                            className="h-full rounded-r-sm flex items-center"
                            style={{ background: bgClr, opacity }}
                          >
                            <span className="text-[9px] text-white/80 font-mono pl-1 whitespace-nowrap hidden group-hover:block mix-blend-difference">
                              {fmtV(b.volume)}
                            </span>
                          </motion.div>
                        </div>
                        
                        {/* Current price marker */}
                        {isCurrent && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                            <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded shadow">السعر الحالي</span>
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
