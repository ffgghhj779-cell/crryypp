'use client';

import { use, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { computeGann, GannResult, GannPointWithMeta, GANN_POINTS } from '@/lib/algorithms/gann';
import { ShieldAlert, Info, Clock, AlertTriangle } from 'lucide-react';

export default function GannWheelPage() {
  const tool = slugToTool('gann-time-wheel');
  const [result, setResult] = useState<GannResult | null>(null);

  useEffect(() => {
    // Run calculator on client
    setResult(computeGann(new Date()));
    
    // Update every hour just in case user leaves app open
    const interval = setInterval(() => {
      setResult(computeGann(new Date()));
    }, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-8">
      <ToolPageHeader tool={tool} />

      {/* Main Content */}
      <div className="flex-1 px-4 pt-6 flex flex-col items-center max-w-lg mx-auto w-full gap-6">
        
        {/* Risk Meter Card */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full rounded-2xl border p-4 backdrop-blur-md flex items-center gap-4 shadow-lg ${
              result.status === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 shadow-red-500/10' :
              result.status === 'WARNING'  ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/10' :
                                            'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10'
            }`}
          >
            <div className={`p-3 rounded-full ${
              result.status === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
              result.status === 'WARNING'  ? 'bg-amber-500/20 text-amber-400' :
                                            'bg-emerald-500/20 text-emerald-400'
            }`}>
              {result.status === 'CRITICAL' ? <ShieldAlert className="w-6 h-6" /> :
               result.status === 'WARNING'  ? <AlertTriangle className="w-6 h-6" /> :
                                              <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest mb-1">Current Cycle Status</p>
              <h2 className={`text-xl font-black tracking-wide ${
                result.status === 'CRITICAL' ? 'text-red-400' :
                result.status === 'WARNING'  ? 'text-amber-400' :
                                              'text-emerald-400'
              }`}>
                {result.status}
              </h2>
            </div>
          </motion.div>
        )}

        {/* The Gann Wheel (SVG) */}
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="relative w-full max-w-[320px] aspect-square my-4"
          >
            {/* Glowing Backdrop */}
            <div className="absolute inset-0 bg-white/[0.02] rounded-full blur-2xl" />
            
            <GannWheelSvg result={result} />
            
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Gann Cycle</span>
              <span className="text-white/80 font-bold font-mono text-sm">{new Date().getFullYear()}</span>
            </div>
          </motion.div>
        )}

        {/* Advisory Card */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-orange-400" />
              <h3 className="text-xs font-bold text-white/70 uppercase tracking-widest">Cycle Advisory</h3>
            </div>
            
            {/* Arabic Advisory */}
            <p className="text-sm text-white/90 leading-relaxed text-right" dir="rtl">
              {result.advisoryAr}
            </p>
            
            <div className="h-px w-full bg-white/[0.05]" />
            
            {/* English Advisory */}
            <p className="text-xs text-white/50 leading-relaxed font-mono">
              {result.advisoryEn}
            </p>
          </motion.div>
        )}

        {/* Countdown Timer */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full rounded-2xl bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="text-[10px] font-mono text-orange-400/80 uppercase tracking-widest">Next Critical Point</span>
              </div>
              <span className="text-xs font-bold text-white/80">{result.nextPointDate}</span>
            </div>

            <div className="flex flex-col items-center py-2">
              <span className="text-[10px] text-white/40 font-mono tracking-widest uppercase mb-2 text-center">
                {result.nextPoint.eventEn ?? result.nextPoint.event}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black font-mono text-white tracking-tighter">
                  {result.daysToNext}
                </span>
                <span className="text-white/50 font-mono text-sm tracking-widest">DAYS</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <p className="text-[9px] text-white/30 text-center font-mono leading-relaxed mt-4 max-w-xs mx-auto">
          This tool is based on historical statistical cycles and mathematical geometry. It is for informational purposes only.
        </p>

      </div>
    </div>
  );
}

// ─── Gann Wheel SVG Component ─────────────────────────────────────────────────

function GannWheelSvg({ result }: { result: GannResult }) {
  // SVG coordinates and sizes
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 130;
  const innerRadius = 80;

  // Draw months
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Converts standard angle (0=Right, 90=Top) to Gann Calendar (0=March 21 roughly Right/East)
  // For simplicity visually, we map dayOfYear to 360, where Jan 1 = top (-90 deg visually)
  // So angle visually: deg - 90
  
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Outer Ring */}
      <circle cx={cx} cy={cy} r={radius} fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={innerRadius} fill="#0a0a0a" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

      {/* Month segments (12 dividers) */}
      {months.map((m, i) => {
        const deg = (i / 12) * 360;
        const rad = toRad(deg);
        const x1 = cx + innerRadius * Math.cos(rad);
        const y1 = cy + innerRadius * Math.sin(rad);
        const x2 = cx + radius * Math.cos(rad);
        const y2 = cy + radius * Math.sin(rad);
        
        // Label position
        const lRad = toRad(deg + 15);
        const lx = cx + (radius + 15) * Math.cos(lRad);
        const ly = cy + (radius + 15) * Math.sin(lRad);

        return (
          <g key={m}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 4" />
            <text x={lx} y={ly} fill="rgba(255,255,255,0.2)" fontSize="10" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${deg + 15}, ${lx}, ${ly})`}>
              {m}
            </text>
          </g>
        );
      })}

      {/* 8 Gann Points */}
      {result.points.map((p, i) => {
        const rad = toRad(p.angle);
        const x = cx + radius * Math.cos(rad);
        const y = cy + radius * Math.sin(rad);
        
        const isMajor = p.type === 'major';
        const color = isMajor ? '#f97316' : '#a8a29e'; // orange for major, warm gray for minor
        
        // Node dot
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={isMajor ? 4 : 2} fill={color} />
            {isMajor && (
              <circle cx={x} cy={y} r={8} fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
            )}
            
            <line x1={cx + innerRadius * Math.cos(rad)} y1={cy + innerRadius * Math.sin(rad)} 
                  x2={x} y2={y} 
                  stroke={color} strokeWidth="1" opacity={isMajor ? 0.3 : 0.15} />
          </g>
        );
      })}

      {/* Today's Needle (Animated) */}
      <motion.g
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: result.todayAngle, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 40, delay: 0.5 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <line x1={cx} y1={cy - innerRadius + 10} x2={cx} y2={cy - radius - 5} stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy - radius - 5} r="4" fill="#38bdf8" className="drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
        <path d={`M ${cx - 4} ${cy - innerRadius + 10} L ${cx + 4} ${cy - innerRadius + 10} L ${cx} ${cy - innerRadius + 20} Z`} fill="#38bdf8" />
      </motion.g>

      {/* Center inner glow */}
      <circle cx={cx} cy={cy} r={30} fill="rgba(56,189,248,0.05)" className="blur-md" />
    </svg>
  );
}
