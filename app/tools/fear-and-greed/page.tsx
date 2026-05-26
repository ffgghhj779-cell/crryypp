'use client';

import { useState, useEffect } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Gauge, RefreshCcw, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export default function FearAndGreedPage() {
  const tool = slugToTool('fear-and-greed');
  const [fngData, setFngData] = useState<{ value: number, classification: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchFnG() {
      try {
        const res = await fetch('https://api.alternative.me/fng/');
        const json = await res.json();
        if (json && json.data && json.data.length > 0) {
          const item = json.data[0];
          setFngData({
            value: parseInt(item.value, 10),
            classification: item.value_classification
          });
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('FnG Error:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchFnG();
  }, []);

  if (!tool) return notFound();

  // Arabic translation helper
  const getArabicLabel = (classification: string) => {
    switch (classification.toLowerCase()) {
      case 'extreme fear': return 'ط®ظˆظپ ط´ط¯ظٹط¯';
      case 'fear': return 'ط®ظˆظپ';
      case 'neutral': return 'ظ…ط­ط§ظٹط¯';
      case 'greed': return 'ط·ظ…ط¹';
      case 'extreme greed': return 'ط·ظ…ط¹ ط´ط¯ظٹط¯';
      default: return classification;
    }
  };

  // Color helper based on value 0-100
  const getColor = (val: number) => {
    if (val <= 25) return '#ef4444'; // Red
    if (val <= 45) return '#f97316'; // Orange
    if (val <= 55) return '#eab308'; // Yellow
    if (val <= 75) return '#84cc16'; // Light Green
    return '#10b981'; // Emerald
  };

  const val = fngData?.value || 0;
  const color = getColor(val);
  
  // Calculate rotation for speedometer needle (-90 to 90 degrees)
  const rotation = (val / 100) * 180 - 90;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-amber-500/70 tracking-widest uppercase border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Gauge className="w-3 h-3" /> Sentiment
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ظ…ط¤ط´ط± ط§ظ„ط®ظˆظپ ظˆط§ظ„ط·ظ…ط¹</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          ظ‚ظٹط§ط³ ط§ظ„ظ…ط´ط§ط¹ط± ط§ظ„ط¹ط§ظ…ط© ظ„ظ…طھط¯ط§ظˆظ„ظٹ ط§ظ„ط¹ظ…ظ„ط§طھ ط§ظ„ط±ظ‚ظ…ظٹط©
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <RefreshCcw className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-amber-500/80 font-bold tracking-widest uppercase text-base animate-pulse">ط¬ط§ط±ظٹ ظ‚ظٹط§ط³ ط§ظ„ظ…ط´ط§ط¹ط±...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6 bg-red-500/5 rounded-3xl border border-red-500/10">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <p className="text-red-500/80 font-bold tracking-widest uppercase text-base">طھط¹ط°ط± ط¬ظ„ط¨ ط§ظ„ط¨ظٹط§ظ†ط§طھ</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-3xl border border-white/[0.08] bg-[#0d0d0d] p-8 flex flex-col items-center justify-center gap-8 shadow-xl overflow-hidden"
          >
            {/* Speedometer Gauge UI */}
            <div className="relative w-64 h-32 overflow-hidden flex items-end justify-center pt-8">
              {/* Arc background */}
              <div className="absolute w-64 h-96 border-[30px] border-white/10 rounded-full box-border border-b-transparent border-l-transparent -rotate-45" />
              
              {/* Colored Arc overlay - CSS conic gradient is tricky for semi-circle, let's use an SVG for a perfect half-ring gradient */}
              <svg className="absolute w-64 h-32 top-0 left-0" viewBox="0 0 200 100">
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="35%" stopColor="#f97316" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="65%" stopColor="#84cc16" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="30" strokeLinecap="butt" />
              </svg>

              {/* Needle */}
              <motion.div 
                initial={{ rotate: -90 }}
                animate={{ rotate: rotation }}
                transition={{ type: "spring", stiffness: 50, damping: 15, delay: 0.2 }}
                className="absolute bottom-0 w-2 h-28 origin-bottom z-10"
                style={{ transformOrigin: 'bottom center' }}
              >
                <div className="w-full h-full bg-white rounded-t-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
              </motion.div>
              
              {/* Needle Hub */}
              <div className="absolute bottom-[-10px] w-6 h-6 bg-white rounded-full z-20 shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
            </div>

            <div className="flex flex-col items-center gap-3 z-10 mt-2">
              <span className="text-6xl font-black font-mono tracking-tighter" style={{ color, textShadow: `0 0 30px ${color}80` }}>
                {val}
              </span>
              <span className="text-xl font-bold tracking-widest text-white/90">
                {getArabicLabel(fngData!.classification)}
              </span>
            </div>
            
            <div className="flex justify-between w-full px-5 text-sm text-white/30 font-bold uppercase tracking-widest mt-4">
              <span>ط®ظˆظپ ط´ط¯ظٹط¯ (0)</span>
              <span>ط·ظ…ط¹ ط´ط¯ظٹط¯ (100)</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
