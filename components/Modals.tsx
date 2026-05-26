'use client';

import { useAppStore } from '@/store/useAppStore';
import { X, AlertTriangle, TrendingUp, TrendingDown, RefreshCcw, Calendar, Star, BarChart2, BarChart, Play, AlertCircle, Info, Search, RefreshCw } from 'lucide-react';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'motion/react';
import { NativeSheet }    from '@/components/ui/NativeSheet';
import { fetchKlines, calculateRSI } from '@/lib/binance';
import { TOOL_DESCRIPTIONS } from '@/components/TradingViewWidget';

// Lazy-load the TradingView widget so it doesn't block the main bundle
const TradingViewWidget = lazy(() => import('@/components/TradingViewWidget'));

// ─── Shared modal header label map ────────────────────────────────────────────
const MODAL_TITLES: Record<string, string> = {
  risk_calculator: 'Risk Calculator',
  daily_briefing:  'Daily Briefing',
  tool:            'Analysis Tool',
  sessions:        'Active Sessions',
  calendar:        'Economic Calendar',
  favorites:       'Favorite Assets',
  market_cap:      'Market Overview',
};

export function ModalsWrapper() {
  const { activeModal, setActiveModal, activeTool, setActiveTool } = useAppStore();
  const isOpen = activeModal !== 'none';

  function handleClose() {
    if (activeModal === 'tool') setActiveTool(null);
    else setActiveModal('none');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <NativeSheet key={activeModal} onClose={handleClose} zSheet={60}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
            <h2 className="text-white font-bold text-base flex items-center gap-2.5 min-w-0">
              {activeModal === 'risk_calculator' && <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />}
              {activeModal === 'daily_briefing'  && <TrendingUp   className="w-5 h-5 text-orange-500 shrink-0" />}
              {activeModal === 'sessions'        && <RefreshCcw   className="w-5 h-5 text-orange-500 shrink-0" />}
              {activeModal === 'calendar'        && <Calendar     className="w-5 h-5 text-orange-500 shrink-0" />}
              {activeModal === 'favorites'       && <Star         className="w-5 h-5 text-orange-500 shrink-0" />}
              {activeModal === 'market_cap'      && <BarChart2    className="w-5 h-5 text-orange-500 shrink-0" />}
              {activeModal === 'tool'            && <BarChart     className="w-5 h-5 text-orange-500 shrink-0" />}
              <span className="truncate">
                {activeModal === 'tool' ? (activeTool ?? 'Tool') : (MODAL_TITLES[activeModal] ?? activeModal)}
              </span>
            </h2>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="shrink-0 ml-2 w-11 h-11 flex items-center justify-center text-white/40 hover:text-white bg-white/[0.05] hover:bg-white/10 rounded-full transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div
            className={`overscroll-contain flex-1 ${
              activeModal === 'tool' ? 'overflow-hidden p-0 flex flex-col' : 'overflow-y-auto px-5 pt-5'
            }`}
            style={{ paddingBottom: activeModal === 'tool' ? '0' : 'max(2rem, env(safe-area-inset-bottom, 0.5rem))' }}
          >
            {activeModal === 'risk_calculator' && <RiskCalculator />}
            {activeModal === 'daily_briefing'  && <DailyBriefing />}
            {activeModal === 'sessions'        && <ActiveSessions />}
            {activeModal === 'calendar'        && <EconomicCalendar />}
            {activeModal === 'favorites'       && <Favorites />}
            {activeModal === 'market_cap'      && <MarketCap />}
            {activeModal === 'tool' && activeTool && <ToolModal toolName={activeTool} />}
          </div>
        </NativeSheet>
      )}
    </AnimatePresence>
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
    // Use the server proxy to benefit from Next.js ISR caching (revalidate)
    const fetchFng = fetch('/api/fng')
      .then(r => r.json())
      .then(d => d.value || 50)
      .catch(() => 50);

    Promise.all([fetchKlines('BTCUSDT', '1h', 50), fetchFng])
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

// ─── Reusable empty state ────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" dir="rtl">
      <span className="text-5xl">{icon}</span>
      <p className="text-sm font-bold text-white/40">{title}</p>
      <p className="text-xs text-white/20 leading-relaxed max-w-[220px]">{sub}</p>
    </div>
  );
}

// ─── Favorites ───────────────────────────────────────────────────────────────
function Favorites() {
  const { favoriteAssets } = useAppStore();
  return (
    <div className="space-y-2.5">
      {favoriteAssets.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="لا توجد أصول مفضلة بعد"
          sub="افتح أي أداة تحليل واضغط على زر النجمة لحفظ الرمز في قائمتك"
        />
      ) : favoriteAssets.map(asset => (
        <div key={asset} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <span className="font-mono font-bold text-white">{asset}</span>
          <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">مراقبة</span>
        </div>
      ))}
    </div>
  );
}

// ─── Market Cap Overview ────────────────────────────────────────────────────
function MarketCap() {
  type Coin = {
    rank: number; symbol: string; name: string;
    price: number; change24h: string; marketCap: number;
  };
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stale, setStale] = useState(false);

  useEffect(() => {
    fetch('/api/markets')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (!data.coins) throw new Error(data.error ?? 'Bad response');
        setCoins(data.coins);
        setStale(!!data.stale);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmtMcap = (v: number) =>
    v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` :
    v >= 1e9  ? `$${(v / 1e9).toFixed(1)}B`  : `$${(v / 1e6).toFixed(0)}M`;

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <div className="w-5 h-5 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
      <span className="text-white/30 text-sm">جار تحميل بيانات السوق...</span>
    </div>
  );

  if (error) return (
    <p className="text-center text-red-400 text-sm py-8">⚠️ {error}</p>
  );

  return (
    <div className="divide-y divide-white/[0.04]">
      {stale && (
        <div className="px-1 py-2 mb-1 text-center">
          <p className="text-[9px] text-amber-400/70 font-mono">
            ⚠ بيانات مؤقتة — CoinGecko rate-limited
          </p>
        </div>
      )}
      {coins.map(coin => {
        const isUp = parseFloat(coin.change24h) >= 0;
        const priceStr = coin.price > 0
          ? (coin.price >= 1
              ? `$${coin.price.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `$${coin.price.toFixed(4)}`)
          : '$ ---';
        return (
          <div key={coin.symbol} className="flex items-center gap-3 px-1 py-3">
            <span className="text-[11px] font-mono text-white/20 w-5 text-center shrink-0">
              {coin.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white">{coin.symbol}</p>
              <p className="text-[10px] text-white/30 truncate">{coin.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[12px] font-mono font-bold text-white tabular-nums">{priceStr}</p>
              <p className={`text-[10px] font-mono tabular-nums ${coin.price > 0 ? (isUp ? 'text-emerald-400' : 'text-red-400') : 'text-white/20'}`}>
                {coin.price > 0 ? `${isUp ? '+' : ''}${coin.change24h}%` : '---'}
              </p>
            </div>
            <div className="w-16 text-right shrink-0">
              <p className="text-[10px] text-white/35 font-mono">
                {coin.marketCap > 0 ? fmtMcap(coin.marketCap) : '---'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CalendarIcon = Calendar;

// ─── Tool Modal ──────────────────────────────────────────────────────────────────────────
function ToolModal({ toolName }: { toolName: string }) {
  const description = TOOL_DESCRIPTIONS[toolName];
  const isFearGreed = toolName === 'Fear & Greed Index';

  return (
    <div className="flex flex-col h-full">
      {/* Description strip */}
      {description && (
        <div className="px-4 py-2.5 bg-orange-500/[0.06] border-b border-orange-500/10 shrink-0">
          <p className="text-xs text-white/50 leading-relaxed">{description}</p>
        </div>
      )}

      {/* Chart or custom view */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {isFearGreed ? (
          <FearGreedDetail />
        ) : (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-white/30 text-xs">Loading TradingView chart...</p>
              </div>
            }
          >
            <TradingViewWidget toolName={toolName} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── Fear & Greed standalone view (used when TV chart is not relevant) ─────────
function FearGreedDetail() {
  const [data, setData] = useState<{ value: number; label: string; prevValue: number } | null>(null);

  useEffect(() => {
    // Use /api/fng server proxy for cached data (avoids direct browser call)
    fetch('/api/fng')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData({ value: d.value, label: d.label, prevValue: d.prevValue });
      })
      .catch(console.error);
  }, []);

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
      <p className="text-white/30 text-xs">Fetching sentiment data...</p>
    </div>
  );

  const delta = data.value - data.prevValue;
  const color = data.value < 25 ? '#ef4444' : data.value < 45 ? '#f97316' : data.value < 55 ? '#eab308' : data.value < 75 ? '#22c55e' : '#16a34a';
  const angle = (data.value / 100) * 180 - 90;
  const r = 72; const cx = 100; const cy = 100;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const nx = cx + r * Math.cos(toRad(angle));
  const ny = cy + r * Math.sin(toRad(angle));

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-6 py-4">
      <svg viewBox="0 0 200 115" className="w-64 overflow-visible">
        <path d="M 28 100 A 72 72 0 0 1 172 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" strokeLinecap="round" />
        {[
          { c: '#ef4444', s: 180, e: 144 }, { c: '#f97316', s: 144, e: 108 },
          { c: '#eab308', s: 108, e: 72 },  { c: '#22c55e', s: 72,  e: 36 },
          { c: '#16a34a', s: 36,  e: 0 },
        ].map(({ c, s, e }, i) => {
          const x1 = cx + r * Math.cos(toRad(s)); const y1 = cy + r * Math.sin(toRad(s));
          const x2 = cx + r * Math.cos(toRad(e)); const y2 = cy + r * Math.sin(toRad(e));
          return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`} fill="none" stroke={c} strokeWidth="18" strokeLinecap="butt" opacity="0.3" />;
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill={color} />
        <circle cx={cx} cy={cy} r="3" fill="#000" />
      </svg>

      <div className="text-center">
        <p className="text-7xl font-mono font-black tabular-nums" style={{ color }}>{data.value}</p>
        <p className="text-sm font-bold uppercase tracking-widest mt-1" style={{ color }}>{data.label}</p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-white/30">vs yesterday:</span>
        <span className={`font-mono font-bold tabular-nums ${
          delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-white/40'
        }`}>
          {delta > 0 ? '+' : ''}{delta} ({data.prevValue})
        </span>
      </div>

      {/* Scale labels */}
      <div className="grid grid-cols-5 w-full gap-1 text-center">
        {['Extr. Fear', 'Fear', 'Neutral', 'Greed', 'Extr. Greed'].map((l, i) => (
          <span key={i} className="text-[9px] text-white/20 font-semibold uppercase leading-tight">{l}</span>
        ))}
      </div>
    </div>
  );
}
