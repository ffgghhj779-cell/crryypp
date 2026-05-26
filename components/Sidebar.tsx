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
    title: 'المستشار الآلي',
    subtitle: 'Trading Bots',
    icon: Bot,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    items: [
      { name: 'VIP 1 — النخبة', path: '/tools/trading-vip-1' },
      { name: 'VIP 2 — الذكاء', path: '/tools/trading-vip-2' },
      { name: 'VIP 3 — القمة', path: '/tools/trading-vip-3' },
    ],
  },
  {
    title: 'السيولة والأموال',
    subtitle: 'Liquidity & Money Flow',
    icon: Activity,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    items: [
      { name: 'Order Book', path: '/tools/order-book' },
      { name: 'Volume Delta', path: '/tools/volume-delta' },
      { name: 'Liquidity Heatmap', path: '/tools/liquidity-heatmap' },
      { name: 'Flow Index', path: '/tools/flow-index' },
      { name: 'Risk Management', path: '/tools/risk-management' },
    ],
  },
  {
    title: 'التحليل الهندسي',
    subtitle: 'Time & Geometry',
    icon: Clock,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    items: [
      { name: 'Gann 144 Star', path: '/tools/gann-144-star' },
      { name: 'Square of Nine', path: '/tools/sq9-square-of-nine' },
      { name: 'Gann Time Wheel', path: '/tools/gann-time-wheel' },
      { name: 'Fibonacci Matrix', path: '/tools/fibonacci-matrix' },
      { name: 'Halving Pulse', path: '/tools/halving-pulse' },
      { name: 'Cycle Calculator', path: '/tools/cycle-calculator' },
    ],
  },
  {
    title: 'النماذج والاتجاهات',
    subtitle: 'Patterns & Trends',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    items: [
      { name: 'Harmonic Scanner', path: '/tools/harmonic-scanner' },
      { name: 'Trend Compass', path: '/tools/trend-compass' },
      { name: 'Momentum Intelligence', path: '/tools/momentum-intelligence' },
      { name: 'Wyckoff Map', path: '/tools/wyckoff-map' },
      { name: 'EMA Ribbon', path: '/tools/ema-ribbon' },
      { name: 'Matrix 4x4', path: '/tools/matrix-4x4' },
    ],
  },
  {
    title: 'لوحة المعلومات',
    subtitle: 'Dashboard & Analytics',
    icon: LayoutDashboard,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    items: [
      { name: 'Live Ticker', path: '/tools/live-ticker' },
      { name: 'Fear & Greed', path: '/tools/fear-and-greed' },
      { name: 'Macro Network', path: '/tools/macro-network' },
      { name: 'Unified Decision', path: '/tools/unified-decision-6-tools' },
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
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
          />

          {/* Sidebar Drawer — PHASE 3: wider 95%/max-w-[400px] */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-[110] w-[95%] max-w-[400px] bg-[#080808]/97 backdrop-blur-2xl border-l border-white/[0.08] flex flex-col shadow-[-30px_0_60px_rgba(0,0,0,0.7)]"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/8 blur-[60px] pointer-events-none rounded-full" />
              <div className="flex flex-col z-10 gap-1">
                <h2 className="text-2xl font-black text-white tracking-tight">القائمة الرئيسية</h2>
                <span className="text-sm font-mono text-orange-500 uppercase tracking-widest">Crypto Terminal 360</span>
              </div>
              <button
                onClick={onClose}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white/70 hover:text-white transition-all z-10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-28 overscroll-contain">
              {CATEGORIES.map((category, idx) => {
                const Icon = category.icon;
                return (
                  <div key={idx} className="flex flex-col">
                    {/* Category Header */}
                    <div className={`flex items-center gap-3 px-3 py-3 mb-2 rounded-xl ${category.bg} border ${category.border}`}>
                      <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${category.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <h3 className={`text-lg font-black ${category.color}`}>{category.title}</h3>
                        <span className="text-xs text-white/40 font-mono">{category.subtitle}</span>
                      </div>
                    </div>

                    {/* Links list */}
                    <div className="flex flex-col gap-1 pr-2">
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
                                : 'hover:bg-white/5 border border-transparent hover:border-white/10'
                            }`}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="active-nav-glow"
                                className="absolute inset-0 bg-orange-500/5 rounded-xl blur-md pointer-events-none"
                              />
                            )}
                            {isActive && (
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1/2 bg-orange-500 rounded-l-full shadow-[0_0_12px_rgba(249,115,22,0.9)]" />
                            )}
                            <span className={`text-base font-bold z-10 ${isActive ? 'text-orange-400' : 'text-white/75'}`}>
                              {item.name}
                            </span>
                            {isActive ? (
                              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,1)] z-10" />
                            ) : (
                              <ChevronLeft className="w-5 h-5 text-white/25 z-10" />
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
            <div className="px-6 py-4 border-t border-white/[0.08] shrink-0 text-center bg-[#050505]">
              <span className="text-sm text-white/30 font-mono tracking-widest">
                Crypto Terminal 360 · v3.0
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
