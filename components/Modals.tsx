'use client';

import { useAppStore } from '@/store/useAppStore';
import { X, AlertTriangle, TrendingUp, TrendingDown, RefreshCcw, Calendar, Star, BarChart2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchKlines, calculateRSI } from '@/lib/binance';
import { fetchFearGreedIndex } from '@/lib/fearGreed';

// ─── Shared modal header label map ────────────────────────────────────────────
const MODAL_TITLES: Record<string, string> = {
  risk_calculator: 'Risk Calculator',
  daily_briefing:  'Daily Briefing',
  sessions:        'Active Sessions',
  calendar:        'Economic Calendar',
  favorites:       'Favorite Assets',
  market_cap:      'Market Overview',
};

export function ModalsWrapper() {
  const { activeModal, setActiveModal } = useAppStore();
  if (activeModal === 'none') return null;

  return (
    // Full-screen overlay with animated fade
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ animation: 'fade-in 0.2s ease forwards' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setActiveModal('none')}
      />

      {/* Sheet / Modal Card — slides up on mobile, zooms in on desktop */}
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/60"
        style={{
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          animation: 'slide-up 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
          // Ensure it never overflows the viewport height
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle (mobile sheet feel) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="text-white font-bold text-base flex items-center gap-2.5">
            {activeModal === 'risk_calculator' && <AlertTriangle className="w-5 h-5 text-orange-500" />}
            {activeModal === 'daily_briefing'  && <TrendingUp   className="w-5 h-5 text-orange-500" />}
            {activeModal === 'sessions'        && <RefreshCcw   className="w-5 h-5 text-orange-500" />}
            {activeModal === 'calendar'        && <Calendar     className="w-5 h-5 text-orange-500" />}
            {activeModal === 'favorites'       && <Star         className="w-5 h-5 text-orange-500" />}
            {activeModal === 'market_cap'      && <BarChart2    className="w-5 h-5 text-orange-500" />}
            {MODAL_TITLES[activeModal] ?? activeModal}
          </h2>
          <button
            onClick={() => setActiveModal('none')}
            aria-label="Close"
            className="p-1.5 text-white/40 hover:text-white bg-white/[0.05] hover:bg-white/10 rounded-full transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overscroll-contain p-5 flex-1" style={{ WebkitOverflowScrolling: 'touch' } as any}>
          {activeModal === 'risk_calculator' && <RiskCalculator />}
          {activeModal === 'daily_briefing'  && <DailyBriefing />}
          {activeModal === 'sessions'        && <ActiveSessions />}
          {activeModal === 'calendar'        && <EconomicCalendar />}
          {activeModal === 'favorites'       && <Favorites />}
          {activeModal === 'market_cap'      && <MarketCap />}
        </div>
      </div>
    </div>
  );
}

// ─── Risk Calculator ─────────────────────────────────────────────────────────
function RiskCalculator() {
  const [drawdown, setDrawdown] = useState<number>(10);
  // Exact formula: required gain = Loss / (1 - Loss) * 100
  const requiredGain = drawdown < 100 ? (drawdown / (100 - drawdown)) * 100 : Infinity;

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/50">
        Calculate the exact gain required to fully recover from a drawdown.
      </p>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/70">Portfolio Drawdown</span>
          <span className="font-mono text-red-400 font-bold tabular-nums">-{drawdown.toFixed(1)}%</span>
        </div>
        <input
          type="range"
          min="1" max="99" step="0.5"
          value={drawdown}
          onChange={e => setDrawdown(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-full accent-orange-500 cursor-pointer appearance-none"
        />
        <div className="flex justify-between text-[10px] text-white/20 font-mono">
          <span>1%</span><span>25%</span><span>50%</span><span>75%</span><span>99%</span>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-white/[0.05] bg-white/[0.02] flex flex-col items-center gap-1">
        <span className="text-[10px] text-white/30 uppercase tracking-widest">Required Gain to Recover</span>
        <span className={`text-5xl font-mono font-black tabular-nums ${requiredGain > 100 ? 'text-orange-500' : 'text-emerald-400'}`}>
          +{isFinite(requiredGain) ? requiredGain.toFixed(2) : '∞'}%
        </span>
        {requiredGain > 200 && (
          <span className="text-xs text-orange-400/70 mt-1">⚠️ Extreme drawdown — capital preservation is critical</span>
        )}
      </div>

      {/* Quick reference table */}
      <div className="rounded-xl border border-white/[0.05] overflow-hidden">
        <div className="grid grid-cols-2 text-[10px] font-mono text-white/30 uppercase tracking-widest px-4 py-2 bg-white/[0.02]">
          <span>Drawdown</span><span className="text-right">Recovery Needed</span>
        </div>
        {[[10,11.11],[25,33.33],[50,100],[75,300],[90,900]].map(([dd, rr]) => (
          <div key={dd} className={`grid grid-cols-2 text-sm font-mono px-4 py-2.5 border-t border-white/[0.03] ${Math.abs(drawdown - dd) < 5 ? 'bg-orange-500/5 text-white' : 'text-white/50'}`}>
            <span className="tabular-nums">-{dd}%</span>
            <span className="text-right tabular-nums text-emerald-400">+{rr}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily Briefing ──────────────────────────────────────────────────────────
function DailyBriefing() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Fetch 50 candles for accurate RSI (14-period needs warm-up data)
    Promise.all([fetchKlines('BTCUSDT', '1h', 50), fetchFearGreedIndex()])
      .then(([klines, fg]) => {
        const currentPrice = klines[klines.length - 1].close;
        const openPrice24h = klines[klines.length - 25]?.open ?? klines[0].open;
        const isBull = currentPrice >= openPrice24h;
        const rsi = calculateRSI(klines, 14);
        setData({
          currentPrice,
          isBull,
          rsi,
          fg,
          fgLabel: fg < 25 ? 'Extreme Fear' : fg < 45 ? 'Fear' : fg < 55 ? 'Neutral' : fg < 75 ? 'Greed' : 'Extreme Greed',
          rsiLabel: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral',
          volume24h: klines[klines.length - 1],
        });
      })
      .catch(() => setError(true));
  }, []);

  if (error) return (
    <div className="text-center py-8 space-y-2">
      <p className="text-red-400 text-sm">Failed to load market data</p>
      <p className="text-white/30 text-xs">Check your connection and try again</p>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
      <p className="text-white/30 text-sm">Analyzing market data...</p>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Trend Banner */}
      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
        data.isBull ? 'bg-emerald-500/[0.07] border-emerald-500/20' : 'bg-red-500/[0.07] border-red-500/20'
      }`}>
        {data.isBull
          ? <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          : <TrendingDown className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
        <div>
          <h3 className={`font-bold text-sm ${data.isBull ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.isBull ? 'Bullish Momentum' : 'Bearish Pressure'}
          </h3>
          <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
            {data.isBull
              ? 'BTC is trading above its 24h open. Buyers are in control of current price action.'
              : 'BTC is trading below its 24h open. Sellers are dominating the current session.'}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">1H RSI (14)</p>
          <p className="text-2xl font-mono font-black tabular-nums text-white">{data.rsi.toFixed(1)}</p>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
            data.rsi > 70 ? 'text-red-400' : data.rsi < 30 ? 'text-emerald-400' : 'text-white/40'
          }`}>{data.rsiLabel}</span>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Fear & Greed</p>
          <p className="text-2xl font-mono font-black tabular-nums text-orange-400">{data.fg}</p>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/70">{data.fgLabel}</span>
        </div>
      </div>

      {/* Current Price */}
      <div className="flex justify-between items-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
        <span className="text-sm text-white/60">Current BTC Price</span>
        <span className="font-mono font-bold text-white tabular-nums">
          ${data.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

// ─── Active Sessions ──────────────────────────────────────────────────────────
function ActiveSessions() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const utcHour = time.getUTCHours();
  const sessions = [
    { name: 'Tokyo',    flag: '🇯🇵', open: 0,  close: 9,  active: utcHour >= 0  && utcHour < 9 },
    { name: 'London',   flag: '🇬🇧', open: 8,  close: 16, active: utcHour >= 8  && utcHour < 16 },
    { name: 'New York', flag: '🇺🇸', open: 13, close: 22, active: utcHour >= 13 && utcHour < 22 },
    { name: 'Sydney',   flag: '🇦🇺', open: 22, close: 7,  active: utcHour >= 22 || utcHour < 7 },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Current UTC Time</p>
        <p className="text-3xl font-mono text-white font-light tracking-widest tabular-nums">
          {time.toISOString().substring(11, 19)}
        </p>
      </div>

      <div className="space-y-2.5">
        {sessions.map(s => (
          <div
            key={s.name}
            className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
              s.active
                ? 'bg-orange-500/[0.07] border-orange-500/25'
                : 'bg-white/[0.02] border-white/[0.05]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{s.flag}</span>
              <div>
                <p className={`font-semibold text-sm ${s.active ? 'text-orange-400' : 'text-white/50'}`}>{s.name}</p>
                <p className="text-[10px] text-white/30 font-mono tabular-nums">
                  {s.open.toString().padStart(2,'0')}:00 – {s.close.toString().padStart(2,'0')}:00 UTC
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {s.active && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
              <span className={`text-xs font-semibold ${s.active ? 'text-orange-400' : 'text-white/20'}`}>
                {s.active ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Economic Calendar ────────────────────────────────────────────────────────
function EconomicCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEvents(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (!events.length) return (
    <p className="text-center text-white/30 text-sm py-8">No upcoming high-impact events.</p>
  );

  const flagMap: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CAD: '🇨🇦', AUD: '🇦🇺', CHF: '🇨🇭' };

  return (
    <div className="space-y-2.5">
      {events.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <span className="text-xl shrink-0 mt-0.5">{flagMap[item.country] ?? '🌐'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">{item.title}</p>
            <p className="text-[10px] text-white/30 font-mono mt-0.5 tabular-nums">{item.date} · {item.time} UTC</p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
            item.impact === 'High'
              ? 'bg-red-500/15 text-red-400 border border-red-500/20'
              : 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
          }`}>
            {item.impact}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Favorites (stub — wired to Zustand + Supabase) ──────────────────────────
function Favorites() {
  const { favoriteAssets } = useAppStore();
  return (
    <div className="space-y-2.5">
      {favoriteAssets.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-8">No favorites yet. Add assets from the tools grid.</p>
      ) : favoriteAssets.map(asset => (
        <div key={asset} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <span className="font-mono font-bold text-white">{asset}</span>
          <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">Watching</span>
        </div>
      ))}
    </div>
  );
}

// ─── Market Cap Overview ──────────────────────────────────────────────────────
function MarketCap() {
  return (
    <p className="text-center text-white/30 text-sm py-8">
      Global market metrics are displayed on the main dashboard.
    </p>
  );
}

const CalendarIcon = Calendar;
