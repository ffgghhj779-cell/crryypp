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
    { angle: 45, label: 'زاوية 45° (مستوى فرعي)' },
    { angle: 90, label: 'زاوية 90° (مستوى قوي)' },
    { angle: 180, label: 'زاوية 180° (انعكاس رئيسي)' },
    { angle: 360, label: 'زاوية 360° (دورة كاملة)' },
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
        <h1 className="text-xl font-black text-white tracking-tight mt-1">حاسبة الزوايا السعرية</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          تحويل السعر الحالي إلى زوايا هندسية لتوقع الأهداف المستقبلية بسهولة
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {/* Input Card */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#0d0d0d] p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full pointer-events-none" />
          
          <label className="text-sm font-bold text-white/60 mb-3 flex items-center gap-3">
            <Calculator className="w-6 h-6 text-emerald-500" />
            أدخل السعر الحالي أو سعر القاع/القمة:
          </label>
          <input 
            type="number" 
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="مثال: 65000"
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
                  <span className="text-base font-bold text-white/90">{item.label}</span>
                  <span className="text-sm text-white/40 mt-1">الهدف المتوقع بناءً على السعر المدخل</span>
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
            💡 تستخدم هذه الحاسبة قوانين (مربع التسعة) الهندسية. كلما اكتملت زاوية 360°، يعتبر السعر قد أكمل دورة كاملة ومستعد لانعكاس قوي.
          </p>
        </div>
      </div>
    </div>
  );
}
