'use client';

import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Bot, Activity, Clock, TrendingUp, LayoutDashboard, ChevronLeft } from 'lucide-react';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  {
    title: 'المستشار الآلي (Trading Bots)',
    icon: Bot,
    items: [
      { name: 'VIP 1', path: '/tools/trading-vip-1' },
      { name: 'VIP 2', path: '/tools/trading-vip-2' },
      { name: 'VIP 3', path: '/tools/trading-vip-3' },
      { name: 'Trading Bots 1-10', path: '/tools/ai-bot-1' }, // Routing to the first bot as an example
    ],
  },
  {
    title: 'السيولة وحركة الأموال',
    icon: Activity,
    items: [
      { name: 'Order Book', path: '/tools/order-book' },
      { name: 'Volume Delta', path: '/tools/volume-delta' },
      { name: 'Liquidity Heatmap', path: '/tools/liquidity-heatmap' },
      { name: 'SMC Scanner', path: '/tools/smc-scanner' },
      { name: 'Flow Index', path: '/tools/flow-index' },
      { name: 'Risk Management', path: '/tools/risk-management' },
    ],
  },
  {
    title: 'التحليل الزمني والهندسي',
    icon: Clock,
    items: [
      { name: 'Gann 144', path: '/tools/gann-144' },
      { name: 'Square of 9', path: '/tools/square-of-9' },
      { name: 'Elliott Wave', path: '/tools/ewa-engine' },
      { name: 'Fib Matrix', path: '/tools/fib-matrix' },
      { name: 'Halving Pulse', path: '/tools/halving-pulse' },
      { name: 'Cycle Calculator', path: '/tools/cycle-calculator' },
    ],
  },
  {
    title: 'النماذج والاتجاهات',
    icon: TrendingUp,
    items: [
      { name: 'Harmonic Scanner', path: '/tools/harmonic-scanner' },
      { name: 'Classic Patterns', path: '/tools/classic-patterns' },
      { name: 'Trend Compass', path: '/tools/trend-compass' },
      { name: 'Momentum Intel', path: '/tools/momentum-intel' },
      { name: 'Hidden Candle', path: '/tools/hidden-candle' },
    ],
  },
  {
    title: 'لوحة المعلومات',
    icon: LayoutDashboard,
    items: [
      { name: 'Live Ticker', path: '/tools/live-ticker' },
      { name: 'Fear & Greed', path: '/tools/fear-and-greed' },
      { name: 'Macro Network', path: '/tools/macro-network' },
    ],
  },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Sidebar Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-[110] w-[85%] max-w-[320px] bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.08] shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-[40px] pointer-events-none rounded-full" />
              <div className="flex flex-col z-10">
                {/* PHASE 2: bumped from text-lg to text-xl */}
                <h2 className="text-xl font-black text-white tracking-tight">القائمة الرئيسية</h2>
                {/* PHASE 2: bumped from text-[10px] to text-xs */}
                <span className="text-xs font-mono text-orange-500 uppercase tracking-widest">Master Navigation</span>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white/70 hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 pb-24 overscroll-contain">
              {CATEGORIES.map((category, idx) => {
                const Icon = category.icon;
                return (
                  <div key={idx} className="flex flex-col">
                    {/* Category Title - PHASE 2: p-2 → p-3, gap-2 → gap-3 */}
                    <div className="flex items-center gap-3 px-2 mb-3">
                      <div className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60">
                        <Icon className="w-4 h-4" />
                      </div>
                      {/* PHASE 2: bumped from text-sm to text-base, font-bold kept */}
                      <h3 className="text-base font-bold text-white/90">{category.title}</h3>
                    </div>

                    {/* Links list */}
                    <div className="flex flex-col gap-1">
                      {category.items.map((item, itemIdx) => {
                        const isActive = pathname === item.path;

                        return (
                          <Link 
                            key={itemIdx} 
                            href={item.path}
                            onClick={onClose}
                            className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 ${
                              isActive 
                                ? 'bg-orange-500/10 border border-orange-500/30' 
                                : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            {isActive && (
                              <motion.div 
                                layoutId="active-nav-glow"
                                className="absolute inset-0 bg-orange-500/5 rounded-xl blur-md pointer-events-none"
                              />
                            )}
                            {isActive && (
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-orange-500 rounded-l-full shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                            )}
                            
                            {/* PHASE 2: bumped from text-xs to text-sm */}
                            <span className={`text-sm font-bold z-10 ${isActive ? 'text-orange-400' : 'text-white/70'}`}>
                              {item.name}
                            </span>
                            
                            {isActive ? (
                              <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,1)] z-10" />
                            ) : (
                              <ChevronLeft className="w-3.5 h-3.5 text-white/25 z-10" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-white/[0.08] shrink-0 text-center bg-[#050505]">
              {/* PHASE 2: bumped from text-[10px] to text-xs */}
              <span className="text-xs text-white/30 font-mono tracking-widest">
                Crypto Terminal 360 · v3.0
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
