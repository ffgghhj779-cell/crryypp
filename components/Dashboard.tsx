'use client';

import { useBinanceTicker } from '@/hooks/useBinanceTicker';
import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import { fetchKlines } from '@/lib/binance';
import { fetchFearGreedIndex } from '@/lib/fearGreed';
import { fetchGlobalData } from '@/lib/coingecko';
import { ChevronRight } from 'lucide-react';
import { ANALYSIS_TOOLS, UnifiedScannerModal, type ToolDef } from '@/components/UnifiedScannerModal';
import { MarketTicker } from '@/components/layout/MarketTicker';
import { LearnHub }     from '@/components/layout/LearnHub';
import { Footer }       from '@/components/layout/Footer';
import { saveAnalysis } from '@/lib/utils/historyStore';

// ── Analysis Arsenal — 24 Halal Spot/TA tools (imported from UnifiedScannerModal) ──

export function Dashboard() {
  const { ticker, connectionStatus } = useBinanceTicker('btcusdt');
  const [halvingCountdown, setHalvingCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [candleClose, setCandleClose] = useState('--:--:--');
  const [fearGreedIndex, setFearGreedIndex] = useState<number>(50);
  const [globalData, setGlobalData] = useState({ totalMarketCap: '---', btcDominance: '---' });

  useEffect(() => {
    fetchFearGreedIndex().then(setFearGreedIndex).catch(console.error);
    fetchGlobalData().then(setGlobalData).catch(console.error);

    const halvingDate = new Date('2028-04-15T00:00:00Z').getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const distance = halvingDate - now;

      setHalvingCountdown({
        days: Math.floor(distance / 86_400_000),
        hours: Math.floor((distance % 86_400_000) / 3_600_000),
        mins: Math.floor((distance % 3_600_000) / 60_000),
        secs: Math.floor((distance % 60_000) / 1000),
      });

      // Daily candle close: seconds remaining until next 00:00 UTC
      const d = new Date(now);
      const secondsLeft =
        (23 - d.getUTCHours()) * 3600 +
        (59 - d.getUTCMinutes()) * 60 +
        (59 - d.getUTCSeconds());
      const h = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
      const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
      const s = String(secondsLeft % 60).padStart(2, '0');
      setCandleClose(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isPositive = ticker && parseFloat(ticker.priceChangePercent) >= 0;

  return (
    <div className="w-full max-w-2xl pb-28 animate-fade-in">
      {/* ── Sticky Market Ticker ── */}
      <MarketTicker />

      <div className="px-3 pt-3 space-y-3">

      {/* ── Ticker Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-5 shadow-2xl">
        {/* Glow blob */}
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-orange-500/15 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 bg-orange-500/5 blur-2xl rounded-full" />

        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-white/50 font-semibold tracking-widest text-xs uppercase">BTC / USDT</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border tabular-nums ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {isPositive ? '+' : ''}{ticker?.priceChangePercent ?? '0.00'}%
              </span>
              {/* Connection dot */}
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-white/40 text-xl font-light">$</span>
              <span className="text-white text-5xl font-mono font-black tracking-tighter tabular-nums">
                {ticker ? Number(ticker.price).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '──────'}
              </span>
            </div>

            <p className={`text-sm font-mono font-semibold mt-1 tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{ticker?.priceChange ?? '0.00'} USD
            </p>
          </div>

          <div className="text-right space-y-2">
            <div>
              <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">24H High</p>
              <p className="text-sm font-mono font-semibold text-white/90 tabular-nums">
                ${ticker ? Number(ticker.high).toLocaleString('en-US') : '─────'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">24H Low</p>
              <p className="text-sm font-mono font-semibold text-white/90 tabular-nums">
                ${ticker ? Number(ticker.low).toLocaleString('en-US') : '─────'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Area Chart ── */}
      <div className="h-[200px] w-full rounded-xl border border-white/[0.05] bg-black/50 overflow-hidden">
        <LightweightAreaChart symbol="BTCUSDT" livePrice={ticker?.price ? parseFloat(ticker.price) : null} />
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="BTC Dominance" value={globalData.btcDominance} />
        <StatCard label="Total Market Cap" value={`$${globalData.totalMarketCap}`} />
      </div>

      {/* ── Fear & Greed Gauge ── */}
      <FearGreedGauge value={fearGreedIndex} />

      {/* ── Countdowns ── */}
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Countdown Events</h3>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
          </span>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
          <span className="text-sm text-white/60">Next Halving</span>
          <span className="font-mono text-sm text-orange-400 font-semibold tabular-nums">
            {halvingCountdown.days}d {halvingCountdown.hours}h {halvingCountdown.mins}m {halvingCountdown.secs}s
          </span>
        </div>

        <div className="flex items-center justify-between pt-3">
          <span className="text-sm text-white/60">Daily Candle Close</span>
          <span className="font-mono text-sm text-white/80 tabular-nums">{candleClose}</span>
        </div>
      </div>

      {/* ── Tools Grid ── */}
      <ToolsGrid />

      {/* ── Learn Hub ── */}
      <LearnHub />

      {/* ── Footer ── */}
      <Footer />

      </div>{/* end px-3 */}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">{label}</p>
      <p className="text-xl font-mono font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function FearGreedGauge({ value }: { value: number }) {
  // Map 0–100 → -90° to +90° (left to right across the arc)
  const angle = (value / 100) * 180 - 90;
  const color =
    value < 25 ? '#ef4444' :
    value < 45 ? '#f97316' :
    value < 55 ? '#eab308' :
    value < 75 ? '#22c55e' : '#16a34a';
  const label =
    value < 25 ? 'Extreme Fear' :
    value < 45 ? 'Fear' :
    value < 55 ? 'Neutral' :
    value < 75 ? 'Greed' : 'Extreme Greed';

  const r = 58; const cx = 80; const cy = 80;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const needleX = cx + r * Math.cos(toRad(angle));
  const needleY = cy + r * Math.sin(toRad(angle));

  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Fear & Greed Index</p>

      <svg viewBox="0 0 160 95" className="w-48 overflow-visible">
        {/* Track */}
        <path d="M 22 80 A 58 58 0 0 1 138 80" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round" />
        {/* Colored zones */}
        {[
          { color: '#ef4444', start: 180, end: 144 },
          { color: '#f97316', start: 144, end: 108 },
          { color: '#eab308', start: 108, end: 72 },
          { color: '#22c55e', start: 72,  end: 36 },
          { color: '#16a34a', start: 36,  end: 0 },
        ].map(({ color: c, start, end }, i) => {
          const startRad = toRad(start);
          const endRad = toRad(end);
          const x1 = cx + r * Math.cos(startRad);
          const y1 = cy + r * Math.sin(startRad);
          const x2 = cx + r * Math.cos(endRad);
          const y2 = cy + r * Math.sin(endRad);
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`}
              fill="none"
              stroke={c}
              strokeWidth="14"
              strokeLinecap="butt"
              opacity="0.25"
            />
          );
        })}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={color} />
        <circle cx={cx} cy={cy} r="2.5" fill="#000" />
        {/* Value */}
        <text x={cx} y={cy - 14} textAnchor="middle" fill="white" fontSize="22" fontWeight="800" fontFamily="monospace">{value}</text>
        <text x={cx} y={cy - 4}  textAnchor="middle" fill={color} fontSize="7.5" fontWeight="600" letterSpacing="0.5">{label.toUpperCase()}</text>
      </svg>
    </div>
  );
}

function LightweightAreaChart({ symbol, livePrice }: { symbol: string; livePrice: number | null }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<any>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255,255,255,0.35)',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.02)' },
        horzLines: { color: 'rgba(255,255,255,0.02)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
      timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#f97316',
      topColor: 'rgba(249,115,22,0.35)',
      bottomColor: 'rgba(249,115,22,0.0)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    fetchKlines(symbol, '1h', 100)
      .then(data => areaSeries.setData(data as any))
      .catch(err => console.error('[Chart] Klines error:', err));

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    const observer = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    });
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [symbol]);

  // Update with live WebSocket price — debounced to 1 update/second max
  const lastUpdateRef = useRef(0);
  useEffect(() => {
    if (!livePrice || !seriesRef.current) return;
    const now = Math.floor(Date.now() / 1000);
    if (now - lastUpdateRef.current < 1) return; // throttle to 1s
    lastUpdateRef.current = now;
    try {
      seriesRef.current.update({ time: now as any, value: livePrice });
    } catch {
      // Lightweight-charts throws if time is not strictly increasing; safe to ignore
    }
  }, [livePrice]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
}

function ToolsGrid() {
  const [activeScannerTool, setActiveScannerTool] = useState<ToolDef | null>(null);

  function handleScanComplete(symbol: string, timeframe: string, summary: string) {
    if (!activeScannerTool) return;
    saveAnalysis(activeScannerTool.name, symbol, timeframe, summary);
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3 ml-1">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Analysis Arsenal</h3>
          <span className="text-[10px] text-white/20 tabular-nums">{ANALYSIS_TOOLS.length} tools · Spot / TA</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ANALYSIS_TOOLS.map((tool) => (
            <button
              key={tool.name}
              onClick={() => setActiveScannerTool(tool)}
              className="group relative p-3.5 text-left rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.06] hover:border-orange-500/25 active:scale-[0.97] transition-all duration-150 overflow-hidden"
            >
              <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_bottom-right,rgba(249,115,22,0.08),transparent_70%)]" />
              <div className="flex items-start justify-between gap-1 mb-2">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${tool.tagColor}`}>
                  {tool.tag}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-orange-400 transition-colors shrink-0 mt-0.5" />
              </div>
              <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors leading-tight">{tool.name}</span>
              <p className="text-[10px] text-white/25 mt-1 leading-tight truncate">{tool.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      {activeScannerTool && (
        <UnifiedScannerModal
          tool={activeScannerTool}
          onClose={() => setActiveScannerTool(null)}
          onScanComplete={handleScanComplete}
        />
      )}
    </>
  );
}
