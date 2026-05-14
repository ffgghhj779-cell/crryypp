'use client';

import { Activity, Calendar, Clock, Search, RefreshCw, BarChart2, Star, DollarSign, History, Home, Shield, Menu } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useState } from 'react';
import { HistorySidebar } from '@/components/layout/HistorySidebar';

export function TopBar() {
  const { setActiveModal, wsStatus } = useAppStore();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <HistorySidebar open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <div className="sticky top-0 z-40 glass-dark border-b border-white/[0.06] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <h1 className="text-white font-bold text-lg leading-none tracking-tighter">Crypto Terminal</h1>
          <div className="flex items-center space-x-2 mt-1">
            <span className="flex h-2 w-2 relative">
              {wsStatus === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                wsStatus === 'connected'  ? 'bg-emerald-500' :
                wsStatus === 'connecting' ? 'bg-yellow-400'  :
                                           'bg-red-500'
              }`} />
            </span>
            <span className={`text-[10px] font-mono tracking-widest uppercase ${
              wsStatus === 'connected'  ? 'text-white/40' :
              wsStatus === 'connecting' ? 'text-yellow-400/70' :
                                         'text-red-400/80'
            }`}>
              {wsStatus === 'connected' ? 'Live Datafeed' : wsStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* History button */}
          <button
            aria-label="History"
            className="p-2 rounded-full text-white/50 hover:text-orange-400 hover:bg-orange-500/10 active:scale-95 transition-all duration-150"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="w-4 h-4" />
          </button>

          {[
            { icon: <Star className="w-4 h-4" />,     modal: 'favorites'      as const, label: 'Favorites' },
            { icon: <BarChart2 className="w-4 h-4" />, modal: 'market_cap'    as const, label: 'Market Cap' },
            { icon: <Calendar className="w-4 h-4" />, modal: 'calendar'       as const, label: 'Calendar' },
            { icon: <Activity className="w-4 h-4" />, modal: 'daily_briefing' as const, label: 'Briefing' },
            { icon: <Clock className="w-4 h-4" />,    modal: 'sessions'       as const, label: 'Sessions' },
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
    </>
  );
}

export function BottomNav() {
  const { setActiveModal } = useAppStore();

  return (
    <div
      className="shrink-0 z-40 border-t border-white/[0.06] glass-dark"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="flex items-center justify-around px-1 py-1.5" dir="rtl">
        {/* الرئيسية — Home (active) */}
        <NavButton
          icon={<Home className="w-[22px] h-[22px]" />}
          label="الرئيسية"
          active
        />

        {/* بحث — Search / Favorites */}
        <NavButton
          icon={<Search className="w-[22px] h-[22px]" />}
          label="بحث"
          onClick={() => setActiveModal('favorites')}
        />

        {/* محاضر — Modals/Tools */}
        <NavButton
          icon={<Shield className="w-[22px] h-[22px]" />}
          label="محاضر"
          onClick={() => setActiveModal('daily_briefing')}
        />

        {/* الأحدث — Latest/Refresh */}
        <NavButton
          icon={<RefreshCw className="w-[22px] h-[22px]" />}
          label="الأحدث"
          onClick={() => window.location.reload()}
        />

        {/* القائمة — Menu */}
        <NavButton
          icon={<Menu className="w-[22px] h-[22px]" />}
          label="القائمة"
          onClick={() => setActiveModal('market_cap')}
        />
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
      className={`relative flex flex-col items-center justify-center pt-2 pb-1 min-w-[58px] rounded-xl active:scale-95 transition-all duration-150 ${
        active ? 'text-orange-500' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {/* Active indicator pill */}
      {active && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-orange-500 rounded-b-full shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
      )}
      {icon}
      <span className="text-[9px] mt-1 font-bold tracking-wide" style={{ fontFamily: 'inherit' }}>{label}</span>
    </button>
  );
}
