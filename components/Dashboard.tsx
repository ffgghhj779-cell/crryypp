'use client';

import { useBinanceTicker } from '@/hooks/useBinanceTicker';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import { fetchKlines } from '@/lib/binance';
import { ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ANALYSIS_TOOLS, type ToolDef } from '@/components/UnifiedScannerModal';

// Lazy-load the heavy modal (46KB+) — excluded from the critical-path bundle
const UnifiedScannerModal = dynamic(
  () => import('@/components/UnifiedScannerModal').then(m => ({ default: m.UnifiedScannerModal })),
  { ssr: false }
);
import { MarketTicker }      from '@/components/layout/MarketTicker';
import { LearnHub }          from '@/components/layout/LearnHub';
import { Footer }            from '@/components/layout/Footer';
import { saveAnalysis }      from '@/lib/utils/historyStore';
import { FearGreedWidget }   from '@/components/widgets/FearGreedWidget';
import { DailyCloseWidget }  from '@/components/widgets/DailyCloseWidget';
import { NetworkMacroModal } from '@/components/widgets/NetworkMacroModal';
import { useAppStore }       from '@/store/useAppStore';

// ── Analysis Arsenal — 24 Halal Spot/TA tools (imported from UnifiedScannerModal) ──

export function Dashboard() {
  const { ticker, connectionStatus } = useBinanceTicker('btcusdt');
  const setWsStatus = useAppStore(s => s.setWsStatus);
  const [halvingCountdown, setHalvingCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [globalData, setGlobalData] = useState({ totalMarketCap: '---', btcDominance: '---' });
  const [networkOpen, setNetworkOpen] = useState(false);

  // Sync live WS status into the global store so TopBar can read it
  useEffect(() => { setWsStatus(connectionStatus); }, [connectionStatus, setWsStatus]);

  useEffect(() => {
    // Use server proxy route — revalidate: 300 only works server-side
    fetch('/api/global')
      .then(r => r.json())
      .then(data => { if (!data.error) setGlobalData(data); })
      .catch(console.error);

    // ── Live halving countdown via block height ────────────────────────────
    // Fallback to estimated date if API fails
    const FALLBACK_DATE = new Date('2028-04-15T00:00:00Z').getTime();
    const NEXT_HALVING_BLOCK = 1_050_000;
    const AVG_BLOCK_TIME_MS  = 10 * 60 * 1_000; // ~10 minutes

    let halvingTarget = FALLBACK_DATE;

    fetch('https://blockchain.info/q/getblockcount')
      .then(r => r.text())
      .then(text => {
        const currentBlock = parseInt(text.trim(), 10);
        if (!isNaN(currentBlock) && currentBlock < NEXT_HALVING_BLOCK) {
          const blocksLeft = NEXT_HALVING_BLOCK - currentBlock;
          halvingTarget = Date.now() + blocksLeft * AVG_BLOCK_TIME_MS;
        }
      })
      .catch(() => { /* keep fallback date */ });

    const interval = setInterval(() => {
      const distance = halvingTarget - Date.now();
      if (distance <= 0) {
        setHalvingCountdown({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }
      setHalvingCountdown({
        days:  Math.floor(distance / 86_400_000),
        hours: Math.floor((distance % 86_400_000) / 3_600_000),
        mins:  Math.floor((distance % 3_600_000) / 60_000),
        secs:  Math.floor((distance % 60_000) / 1000),
      });
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
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-4 shadow-2xl">
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-orange-500/15 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 bg-orange-500/5 blur-2xl rounded-full" />

        <div className="relative z-10">
          {/* Top row: symbol + LIVE + connection */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-white/50 font-bold tracking-widest text-xs uppercase">BTC/USDT</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full tabular-nums border ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {isPositive ? '▲' : '▼'} {Math.abs(parseFloat(ticker?.priceChangePercent ?? '0')).toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-orange-400 tracking-widest uppercase border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 rounded-full">LIVE</span>
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`} />
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-1 mb-0.5">
            <span className="text-white/40 text-lg font-light">$</span>
            <span className="text-white text-[42px] font-mono font-black tracking-tighter tabular-nums leading-none">
              {ticker ? Number(ticker.price).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '──────'}
            </span>
          </div>

          <p className="text-[9px] text-white/25 font-mono tracking-widest uppercase mb-3">HOURLY MACRO TREND (1H)</p>

          {/* 24H High / Low row */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[9px] text-white/30 font-mono tracking-widest uppercase">24H HIGH</p>
              <p className="text-sm font-mono font-bold text-white/90 tabular-nums">
                ${ticker ? Number(ticker.high).toLocaleString('en-US') : '─────'}
              </p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-[9px] text-white/30 font-mono tracking-widest uppercase">24H LOW</p>
              <p className="text-sm font-mono font-bold text-white/90 tabular-nums">
                ${ticker ? Number(ticker.low).toLocaleString('en-US') : '─────'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Area Chart ── */}
      <div className="h-[185px] w-full rounded-xl border border-white/[0.05] bg-black/50 overflow-hidden">
        <LightweightAreaChart symbol="BTCUSDT" livePrice={ticker?.price ? parseFloat(ticker.price) : null} />
      </div>

      {/* ── Inline Stats Bar ── */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/[0.05] bg-white/[0.02]" dir="rtl">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30 font-mono">استعواذ</span>
          <span className="text-[11px] font-mono font-bold text-orange-400 tabular-nums">
            BTC {globalData.btcDominance}
          </span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30 font-mono">القيمة السوقية</span>
          <span className="text-[11px] font-mono font-bold text-white/80 tabular-nums">
            ${globalData.totalMarketCap}
          </span>
        </div>
      </div>

      {/* ── Halving Countdown (tappable → Network Macro modal) ── */}
      <button
        onClick={() => setNetworkOpen(true)}
        className="w-full rounded-2xl overflow-hidden border border-white/[0.07] active:scale-[0.98] transition-transform text-left"
        aria-label="ماكرو الشبكة والتعدين — اضغط للتفاصيل"
      >
        {/* Orange gradient header */}
        <div
          className="px-4 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, #c2410c, #ea580c, #f97316)' }}
        >
          <p className="text-white font-black text-sm tracking-wide">العد التنازلي لهالفينج البيتكوين القادم — البلوك</p>
          <p className="text-white/90 font-mono font-bold text-base mt-0.5 tabular-nums">1,050,000</p>
        </div>

        <div className="bg-[#0a0a0a] px-3 py-4">
          {/* Flip boxes — يوم / ساعة / دقيقة / ثانية */}
          <div className="grid grid-cols-4 gap-2 mb-3" dir="rtl">
            {[
              { val: halvingCountdown.days,  label: 'يوم' },
              { val: halvingCountdown.hours, label: 'ساعة' },
              { val: halvingCountdown.mins,  label: 'دقيقة' },
              { val: halvingCountdown.secs,  label: 'ثانية' },
            ].map(({ val, label }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="w-full rounded-xl bg-[#111] border border-white/[0.07] py-3 flex items-center justify-center shadow-inner">
                  <span className="text-2xl font-black font-mono tabular-nums text-white">
                    {String(val).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] text-white/40 mt-1.5 font-bold">{label}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] mb-3 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (halvingCountdown.days / 1460) * 100).toFixed(1)}%`,
                background: 'linear-gradient(90deg, #f97316, #ea580c)',
              }}
            />
          </div>

          {/* Reward info */}
          <p className="text-[10px] text-white/35 text-center font-mono">
            المكافأة الحالية: <span className="text-white/60 font-bold">BTC 3.125</span>
            {' — '}
            بعد الهالفينج: <span className="text-orange-400 font-bold">BTC 1.5625</span>
          </p>
        </div>
      </button>

      {/* ── Fear & Greed  +  Daily Close — live widgets side-by-side ── */}
      <div className="grid grid-cols-2 gap-3 items-stretch">
        <FearGreedWidget globalData={globalData} />
        <DailyCloseWidget />
      </div>

      {/* ── Network Macro Modal ── */}
      {networkOpen && (
        <NetworkMacroModal
          spotPrice={ticker?.price ? parseFloat(ticker.price) : 0}
          halvingDays={halvingCountdown.days}
          onClose={() => setNetworkOpen(false)}
        />
      )}

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

// StatCard removed — replaced by inline stats bar in mobile layout

function FearGreedGauge({ value, compact = false }: { value: number; compact?: boolean }) {
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

  const r = compact ? 42 : 58;
  const cx = compact ? 60 : 80;
  const cy = compact ? 60 : 80;
  const vw = compact ? 120 : 160;
  const vh = compact ? 70  : 95;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const needleX = cx + r * Math.cos(toRad(angle));
  const needleY = cy + r * Math.sin(toRad(angle));
  const sw = compact ? 10 : 14;
  const fs = compact ? 16 : 22;

  const gauge = (
    <svg viewBox={`0 0 ${vw} ${vh}`} className={compact ? 'w-36 overflow-visible' : 'w-48 overflow-visible'}>
      <path d={`M ${cx - r + 2} ${cy} A ${r} ${r} 0 0 1 ${cx + r - 2} ${cy}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} strokeLinecap="round" />
      {[
        { color: '#ef4444', start: 180, end: 144 },
        { color: '#f97316', start: 144, end: 108 },
        { color: '#eab308', start: 108, end: 72 },
        { color: '#22c55e', start: 72,  end: 36 },
        { color: '#16a34a', start: 36,  end: 0 },
      ].map(({ color: c, start, end }, i) => {
        const x1 = cx + r * Math.cos(toRad(start)), y1 = cy + r * Math.sin(toRad(start));
        const x2 = cx + r * Math.cos(toRad(end)),   y2 = cy + r * Math.sin(toRad(end));
        return (
          <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`}
            fill="none" stroke={c} strokeWidth={sw} strokeLinecap="butt" opacity="0.25" />
        );
      })}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={color} />
      <circle cx={cx} cy={cy} r="2.5" fill="#000" />
      <text x={cx} y={cy - (compact ? 10 : 14)} textAnchor="middle" fill="white" fontSize={fs} fontWeight="800" fontFamily="monospace">{value}</text>
      <text x={cx} y={cy - (compact ? 1 : 4)} textAnchor="middle" fill={color} fontSize={compact ? 6 : 7.5} fontWeight="600" letterSpacing="0.5">{label.toUpperCase()}</text>
    </svg>
  );

  if (compact) return gauge;

  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Fear &amp; Greed Index</p>
      {gauge}
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
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">ترسانة التحليل</h3>
          <span className="text-[10px] text-white/20 tabular-nums">{ANALYSIS_TOOLS.length} أداة · سبوت / تحليل فني</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ANALYSIS_TOOLS.map((tool) => (
            <button
              key={tool.name}
              onClick={() => {
                try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch {}
                setActiveScannerTool(tool);
              }}
              className="group relative p-3.5 text-right rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.06] hover:border-orange-500/25 active:scale-[0.97] transition-all duration-150 overflow-hidden"
            >
              <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_bottom-right,rgba(249,115,22,0.08),transparent_70%)]" />
              <div className="flex items-start justify-between gap-1 mb-2">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${tool.tagColor}`}>
                  {tool.tag}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-orange-400 transition-colors shrink-0 mt-0.5 rtl:rotate-180" />
              </div>
              <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors leading-tight">{tool.name}</span>
              <p className="text-[10px] text-white/25 mt-1 leading-tight truncate">{tool.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeScannerTool && (
          <UnifiedScannerModal
            key={activeScannerTool.name}
            tool={activeScannerTool}
            onClose={() => setActiveScannerTool(null)}
            onScanComplete={handleScanComplete}
          />
        )}
      </AnimatePresence>
    </>
  );
}
