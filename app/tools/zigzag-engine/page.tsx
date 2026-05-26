'use client';

/**
 * app/tools/zigzag-engine/page.tsx
 *
 * ZigZag Pivot Engine (محرك القمم والقيعان)
 * Visualizes the ZigZag algorithm on deterministic mock data with an adjustable deviation slider.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, SlidersHorizontal, Settings2, Info } from 'lucide-react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { calculateZigZag, generateDeterministicMockData, ZigZagResult, DataPoint, PivotPoint } from '@/lib/algorithms/zigzag';
import { notFound } from 'next/navigation';

export default function ZigZagPage() {
  const [deviationPct, setDeviationPct] = useState<number>(5);
  const [result, setResult] = useState<ZigZagResult | null>(null);

  // Generate deterministic mock data once
  const mockData = useMemo(() => generateDeterministicMockData(42), []);

  useEffect(() => {
    // Recalculate ZigZag whenever deviation slider changes
    const res = calculateZigZag(mockData, deviationPct);
    setTimeout(() => setResult(res), 0);
  }, [deviationPct, mockData]);

  const tool = slugToTool('zigzag-engine');
  if (!tool) return notFound();

  const priceStr = (val: number) => {
    return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-blue-500/70 tracking-widest uppercase border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Activity className="w-3 h-3" /> Core Infrastructure
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">
          محرك القمم والقيعان (ZigZag)
        </h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          نواة هيكل السوق لحساب الانحرافات وتحديد الـ HH/HL تلقائياً
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5">
        
        {/* Control Panel */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 flex flex-col gap-6 shadow-xl shadow-black/50">
          <div className="flex justify-between items-end mb-1">
            <label className="text-sm font-bold text-white/70 flex items-center gap-3">
              <SlidersHorizontal className="w-6 h-6 text-blue-400" /> عمق الانحراف (Deviation Depth)
            </label>
            <span className="text-lg font-black text-blue-400 font-mono">{deviationPct}%</span>
          </div>
          
          <input 
            type="range" 
            min="1" 
            max="10" 
            step="0.5" 
            value={deviationPct} 
            onChange={(e) => setDeviationPct(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-2 bg-black/40 rounded-lg appearance-none cursor-pointer border border-white/[0.05]"
          />
          
          <div className="flex justify-between text-sm font-mono text-white/30 uppercase mt-1 px-1">
            <span>High Sensitivity (1%)</span>
            <span>Macro Trend (10%)</span>
          </div>
        </div>

        {/* Visual Wave Chart (Core Output) */}
        {result && (
          <div className="rounded-2xl border border-blue-500/20 bg-[#111] p-6 flex flex-col items-center shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
            <p className="text-sm font-bold text-blue-400/50 uppercase tracking-widest mb-4 flex items-center gap-1 w-full justify-start">
              <Settings2 className="w-3 h-3" /> ZigZag Mapping Engine
            </p>

            <div className="w-full h-96 relative">
              <ZigZagChart rawData={result.rawData} pivots={result.pivots} />
            </div>
          </div>
        )}

        {/* Status Box */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={result.currentStructure} // Re-animate on structure change
            className="rounded-xl border border-white/[0.05] bg-black/40 p-5 flex flex-col gap-3 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-1 h-full bg-blue-500/50" />
            <div className="flex items-center gap-3">
              <Info className="w-6 h-6 text-blue-400" />
              <span className="text-sm font-bold text-blue-400 uppercase tracking-widest">الخلاصة الهيكلية</span>
            </div>
            <p className="text-base text-white/80 font-medium leading-relaxed pr-2">
              الحالة الهيكلية الحالية: <strong className="text-blue-300 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">{result.currentStructure}</strong> مبني على انحراف {result.deviationPct}%.
            </p>
          </motion.div>
        )}

      </div>
    </div>
  );
}

// ─── SVG Chart Component ────────────────────────────────────────────────────────

function ZigZagChart({ rawData, pivots }: { rawData: DataPoint[], pivots: PivotPoint[] }) {
  if (rawData.length === 0) return null;

  // Find min/max for scaling
  const minPrice = Math.min(...rawData.map(d => d.price));
  const maxPrice = Math.max(...rawData.map(d => d.price));
  const priceRange = maxPrice - minPrice || 1;
  const padding = priceRange * 0.1; // 10% padding
  
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;
  const yRange = yMax - yMin;

  const width = 800; // viewBox width
  const height = 400; // viewBox height

  // Scale functions
  const scaleX = (index: number) => (index / (rawData.length - 1)) * width;
  const scaleY = (price: number) => height - ((price - yMin) / yRange) * height;

  // Generate SVG path for raw data
  const rawPath = rawData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.index)} ${scaleY(d.price)}`).join(' ');

  // Generate SVG path for ZigZag line
  const zzPath = pivots.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.index)} ${scaleY(p.price)}`).join(' ');

  return (
    <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <filter id="neonGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Raw Data Line (Faint) */}
      <path 
        d={rawPath} 
        fill="none" 
        stroke="rgba(255,255,255,0.15)" 
        strokeWidth="2" 
        strokeLinejoin="round" 
      />

      {/* ZigZag Line (Thick Glowing) */}
      {zzPath && (
        <motion.path 
          d={zzPath} 
          fill="none" 
          stroke="#3b82f6" // blue-500
          strokeWidth="4" 
          strokeLinejoin="round"
          filter="url(#neonGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      )}

      {/* Pivot Markers */}
      <AnimatePresence>
        {pivots.map((p, i) => {
          const x = scaleX(p.index);
          const y = scaleY(p.price);
          const isHigh = p.type === 'HIGH';
          
          const labelColor = isHigh ? '#10b981' : '#ef4444'; // Green for HH/LH, Red for LL/HL usually? Let's just use Green/Red based on structure.
          let badgeColor = '#6b7280'; // gray default
          if (p.structure === 'HH' || p.structure === 'HL') badgeColor = '#10b981'; // emerald
          if (p.structure === 'LL' || p.structure === 'LH') badgeColor = '#ef4444'; // red

          return (
            <motion.g 
              key={`${p.index}-${p.price}-${i}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.5 + (i * 0.1), type: 'spring', stiffness: 200 }}
            >
              {/* Dot */}
              <circle cx={x} cy={y} r="5" fill="#fff" stroke={badgeColor} strokeWidth="3" filter="url(#neonGlow)" />
              
              {/* Structure Label Badge */}
              <g transform={`translate(${x - 15}, ${isHigh ? y - 25 : y + 15})`}>
                <rect width="30" height="16" rx="4" fill="#111" stroke={badgeColor} strokeWidth="1" />
                <text x="15" y="11" fontSize="10" fontWeight="bold" fill={badgeColor} textAnchor="middle" fontFamily="monospace">
                  {p.structure !== 'START' ? p.structure : 'P'}
                </text>
              </g>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
