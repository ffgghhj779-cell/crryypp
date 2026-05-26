'use client';

import { useState } from 'react';
import { useMarketData } from '@/context/MarketDataContext';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { ShieldAlert, Calculator } from 'lucide-react';
import { motion } from 'motion/react';
import { ContextAssetBar } from '@/components/tools/ContextAssetBar';

export default function RiskManagementPage() {
  const { currentPrice } = useMarketData();
  const tool = slugToTool('risk-management');

  const [capital, setCapital] = useState<string>('10000');
  const [riskPercent, setRiskPercent] = useState<string>('1');
  const [stopLoss, setStopLoss] = useState<string>(currentPrice ? (currentPrice * 0.95).toFixed(2) : '');

  if (!tool) return notFound();

  // Simple Risk Math
  const c = parseFloat(capital);
  const r = parseFloat(riskPercent);
  const sl = parseFloat(stopLoss);
  
  const isValid = !isNaN(c) && !isNaN(r) && !isNaN(sl) && sl > 0 && (currentPrice ?? 0) > 0;
  
  let positionSizeUsd = 0;
  let riskAmountUsd = 0;

  if (isValid) {
    riskAmountUsd = c * (r / 100);
    const priceDiff = Math.abs((currentPrice ?? 0) - sl);
    const slPercent = priceDiff / (currentPrice ?? 1);
    
    // Position Size = Risk Amount / Stop Loss Percentage
    positionSizeUsd = slPercent > 0 ? riskAmountUsd / slPercent : 0;
  }

  const formatUsd = (val: number) => val.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-10" dir="rtl">
      <ToolPageHeader tool={tool} />

      {/* Asset selector — inside tool content */}
      <ContextAssetBar />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-cyan-500/70 tracking-widest uppercase border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3" /> Risk
          </span>
        </div>
        <h1 className="text-xl font-black text-white tracking-tight mt-1">إدارة المخاطر المالية</h1>
        <p className="text-sm text-white/40 font-mono leading-relaxed">
          حاسبة ذكية لحماية رأس مالك وتحديد حجم الصفقة المناسب قبل الدخول
        </p>
      </div>

      <div className="px-5 flex flex-col gap-5 mt-4">
        {/* Input Form */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6 rounded-3xl border border-white/[0.05] bg-[#0d0d0d] p-6 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full pointer-events-none" />

          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-white/60">رأس المال (دولار):</label>
            <input 
              type="number" 
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-white font-mono focus:outline-none focus:border-cyan-500/50 transition-colors dir-ltr text-right"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-white/60">نسبة المخاطرة المقبولة (%):</label>
            <input 
              type="number" 
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-white font-mono focus:outline-none focus:border-cyan-500/50 transition-colors dir-ltr text-right"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-white/60 flex justify-between">
              <span>سعر وقف الخسارة (Stop Loss):</span>
              <span className="text-sm text-cyan-500/70">السعر الحالي: ${currentPrice != null ? formatUsd(currentPrice) : '----'}</span>
            </label>
            <input 
              type="number" 
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-white font-mono focus:outline-none focus:border-cyan-500/50 transition-colors dir-ltr text-right"
            />
          </div>
        </motion.div>

        {/* Output */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6 flex flex-col items-center text-center gap-6 relative overflow-hidden"
        >
          <Calculator className="absolute -bottom-4 -left-4 w-24 h-24 text-cyan-500/10 pointer-events-none" />
          
          <span className="text-base font-bold text-cyan-400">حجم الصفقة المناسب (للشراء)</span>
          
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black font-mono text-white dir-ltr" style={{ textShadow: '0 0 20px rgba(6,182,212,0.5)' }}>
              ${isValid ? formatUsd(positionSizeUsd) : '0.00'}
            </span>
            <span className="text-sm text-cyan-500/80 font-bold mt-2 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
              أقصى خسارة ممكنة: ${isValid ? formatUsd(riskAmountUsd) : '0.00'} فقط
            </span>
          </div>

          <p className="text-sm text-white/50 leading-relaxed font-bold mt-2 max-w-[250px]">
            إذا اشتريت بهذا المبلغ ووصل السعر إلى وقف الخسارة، ستخسر {r}% فقط من رأس مالك الكلي، مما يحميك من التصفية (اللكودة).
          </p>
        </motion.div>
      </div>
    </div>
  );
}
