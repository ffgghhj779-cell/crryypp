'use client';

import { Activity, Calendar, Clock, Search, RefreshCw, BarChart2, Star, DollarSign } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function TopBar() {
  const { setActiveModal } = useAppStore();

  return (
    <div className="sticky top-0 z-40 glass-dark border-b border-white/[0.06] px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex flex-col">
        <h1 className="text-white font-bold text-lg leading-none tracking-tighter">Crypto Terminal</h1>
        <div className="flex items-center space-x-2 mt-1">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] text-white/40 font-mono tracking-widest uppercase">Live Datafeed</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {[
          { icon: <Star className="w-4 h-4" />, modal: 'favorites' as const, label: 'Favorites' },
          { icon: <BarChart2 className="w-4 h-4" />, modal: 'market_cap' as const, label: 'Market Cap' },
          { icon: <Calendar className="w-4 h-4" />, modal: 'calendar' as const, label: 'Calendar' },
          { icon: <Activity className="w-4 h-4" />, modal: 'daily_briefing' as const, label: 'Briefing' },
          { icon: <Clock className="w-4 h-4" />, modal: 'sessions' as const, label: 'Sessions' },
        ].map(({ icon, modal, label }) => (
          <button
            key={modal}
            aria-label={label}
            className="p-2 rounded-full text-white/50 hover:text-orange-400 hover:bg-orange-500/10 active:scale-95 transition-all duration-150"
            onClick={() => setActiveModal(modal)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BottomNav() {
  const { setActiveModal } = useAppStore();

  return (
    <div
      className="shrink-0 z-40 border-t border-white/[0.06] glass-dark"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        <NavButton icon={<Activity className="w-5 h-5" />} label="Market" active />
        <NavButton icon={<Search className="w-5 h-5" />} label="Search" />
        <NavButton
          icon={<DollarSign className="w-5 h-5" />}
          label="Risk Calc"
          onClick={() => setActiveModal('risk_calculator')}
        />
        <NavButton icon={<RefreshCw className="w-5 h-5" />} label="Refresh" onClick={() => window.location.reload()} />
      </div>
    </div>
  );
}

function NavButton({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-2 min-w-[68px] rounded-xl active:scale-95 transition-all duration-150 ${
        active ? 'text-orange-500' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {/* Active indicator pill */}
      {active && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-orange-500 rounded-b-full shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
      )}
      {icon}
      <span className="text-[9px] mt-1 font-semibold tracking-wider uppercase">{label}</span>
    </button>
  );
}
