'use client';

import { useState } from 'react';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { Compass, Calculator } from 'lucide-react';
import { motion } from 'motion/react';

export default function PriceAnglePage() {
  const tool = slugToTool('price-angle');
  const [priceInput, setPriceInput] = useState<string>('');

  if (!tool) return notFound();

  // Basic Gann Angle Math: Price + (Angle / 180)^2 ... simplified for UI demo
  const price = parseFloat(priceInput);
  const isValid = !isNaN(price) && price > 0;

  const angles = [
    { angle: 45, label: 'ط²ط§ظˆظٹط© 45آ° (ظ…ط³طھظˆظ‰ ظپط±ط¹ظٹ)' },
    { angle: 90, label: 'ط²ط§ظˆظٹط© 90آ° (ظ…ط³طھظˆظ‰ ظ‚ظˆظٹ)' },
    { angle: 180, label: 'ط²ط§ظˆظٹط© 180آ° (ط§ظ†ط¹ظƒط§ط³ ط±ط¦ظٹط³ظٹ)' },
    { angle: 360, label: 'ط²ط§ظˆظٹط© 360آ° (ط¯ظˆط±ط© ظƒط§ظ…ظ„ط©)' },
  ];

  const calculateTarget = (angle: number) => {
    if (!isValid) return 0;
    // Square of nine simplified logic: (sqrt(price) + (angle/180))^2
    const root = Math.sqrt(price);
    const target = Math.pow(root + (angle / 180), 2);
    return target;
  };

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: p > 1000 ? 1 : 4, maximumFractionDigits: p > 1000 ? 1 : 4 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-emerald-500/70 tracking-widest uppercase border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Compass className="w-3 h-3" /> Geometry
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">ط­ط§ط³ط¨ط© ط§ظ„ط²ظˆط§ظٹط§ ط§ظ„ط³ط¹ط±ظٹط©</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          طھط­ظˆظٹظ„ ط§ظ„ط³ط¹ط± ط§ظ„ط­ط§ظ„ظٹ ط¥ظ„ظ‰ ط²ظˆط§ظٹط§ ظ‡ظ†ط¯ط³ظٹط© ظ„طھظˆظ‚ط¹ ط§ظ„ط£ظ‡ط¯ط§ظپ ط§ظ„ظ…ط³طھظ‚ط¨ظ„ظٹط© ط¨ط³ظ‡ظˆظ„ط©
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {/* Input Card */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full pointer-events-none" />
          
          <label className="text-base font-bold text-white/60 mb-3 flex items-center gap-3">
            <Calculator className="w-6 h-6 text-emerald-500" />
            ط£ط¯ط®ظ„ ط§ظ„ط³ط¹ط± ط§ظ„ط­ط§ظ„ظٹ ط£ظˆ ط³ط¹ط± ط§ظ„ظ‚ط§ط¹/ط§ظ„ظ‚ظ…ط©:
          </label>
          <input 
            type="number" 
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="ظ…ط«ط§ظ„: 65000"
            className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-white font-mono text-lg focus:outline-none focus:border-emerald-500/50 transition-colors dir-ltr text-right placeholder:text-white/20"
          />
        </div>

        {/* Results Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 gap-3"
        >
          {angles.map((item, i) => {
            const target = calculateTarget(item.angle);
            
            return (
              <div key={i} className="rounded-2xl border border-white/[0.05] bg-[#111] p-5 flex items-center justify-between relative overflow-hidden group">
                <div className="absolute top-0 bottom-0 right-0 w-1 bg-emerald-500/50 group-hover:bg-emerald-400 transition-colors" />
                
                <div className="flex flex-col pr-3">
                  <span className="text-lg font-bold text-white/90">{item.label}</span>
                  <span className="text-sm text-white/40 mt-1">ط§ظ„ظ‡ط¯ظپ ط§ظ„ظ…طھظˆظ‚ط¹ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط§ظ„ط³ط¹ط± ط§ظ„ظ…ط¯ط®ظ„</span>
                </div>

                <div className="flex flex-col items-end pl-2" dir="ltr">
                  <span className={`text-xl font-black font-mono ${isValid ? 'text-emerald-400' : 'text-white/20'}`}>
                    {isValid ? `$${formatPrice(target)}` : '---'}
                  </span>
                </div>
              </div>
            );
          })}
        </motion.div>
        
        <div className="text-center mt-2 px-5">
          <p className="text-sm text-white/30 leading-relaxed font-bold">
            ًں’، طھط³طھط®ط¯ظ… ظ‡ط°ظ‡ ط§ظ„ط­ط§ط³ط¨ط© ظ‚ظˆط§ظ†ظٹظ† (ظ…ط±ط¨ط¹ ط§ظ„طھط³ط¹ط©) ط§ظ„ظ‡ظ†ط¯ط³ظٹط©. ظƒظ„ظ…ط§ ط§ظƒطھظ…ظ„طھ ط²ط§ظˆظٹط© 360آ°طŒ ظٹط¹طھط¨ط± ط§ظ„ط³ط¹ط± ظ‚ط¯ ط£ظƒظ…ظ„ ط¯ظˆط±ط© ظƒط§ظ…ظ„ط© ظˆظ…ط³طھط¹ط¯ ظ„ط§ظ†ط¹ظƒط§ط³ ظ‚ظˆظٹ.
          </p>
        </div>
      </div>
    </div>
  );
}
