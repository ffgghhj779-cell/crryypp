'use client';

import { useBinanceTicker } from '@/hooks/useBinanceTicker';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence }  from 'motion/react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import { fetchKlines }        from '@/lib/binance';
import { ChevronRight }       from 'lucide-react';
import Link                   from 'next/link';
import { ANALYSIS_TOOLS }     from '@/components/UnifiedScannerModal';
import { toolToSlug }         from '@/lib/tools/registry';
import { MarketTicker }       from '@/components/layout/MarketTicker';
import { LearnHub }           from '@/components/layout/LearnHub';
import { Footer }             from '@/components/layout/Footer';
import { FearGreedWidget }    from '@/components/widgets/FearGreedWidget';
import { DailyCloseWidget }   from '@/components/widgets/DailyCloseWidget';
import { NetworkMacroModal }  from '@/components/widgets/NetworkMacroModal';
import { useAppStore }        from '@/store/useAppStore';
import { saveAnalysis }       from '@/lib/utils/historyStore';

// â”€â”€ Analysis Arsenal â€” 24 Halal Spot/TA tools (imported from UnifiedScannerModal) â”€â”€

export function Dashboard() {
  const { ticker, connectionStatus } = useBinanceTicker('btcusdt');
  const setWsStatus = useAppStore(s => s.setWsStatus);
  const [halvingCountdown, setHalvingCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [globalData, setGlobalData] = useState({ totalMarketCap: '---', btcDominance: '---' });
  const [networkOpen, setNetworkOpen] = useState(false);

  // Sync live WS status into the global store so TopBar can read it
  useEffect(() => { setWsStatus(connectionStatus); }, [connectionStatus, setWsStatus]);

  useEffect(() => {
    // Use server proxy route â€” revalidate: 300 only works server-side
    fetch('/api/global')
      .then(r => r.json())
      .then(data => { if (!data.error) setGlobalData(data); })
      .catch(console.error);

    // â”€â”€ Live halving countdown via block height â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      {/* â”€â”€ Sticky Market Ticker â”€â”€ */}
      <MarketTicker />

      <div className="px-3 pt-3 space-y-3">

      {/* â”€â”€ Ticker Banner â”€â”€ */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-6 shadow-2xl">
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-orange-500/15 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 bg-orange-500/5 blur-2xl rounded-full" />

        <div className="relative z-10">
          {/* Top row: symbol + LIVE + connection */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <span className="text-white/50 font-bold tracking-widest text-base uppercase">BTC/USDT</span>
              <span className={`px-2 py-0.5 text-sm font-bold rounded-full tabular-nums border ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {isPositive ? 'â–²' : 'â–¼'} {Math.abs(parseFloat(ticker?.priceChangePercent ?? '0')).toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-orange-400 tracking-widest uppercase border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 rounded-full">LIVE</span>
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
              {ticker ? Number(ticker.price).toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'â”€â”€â”€â”€â”€â”€'}
            </span>
          </div>

          <p className="text-sm text-white/25 font-mono tracking-widest uppercase mb-3">HOURLY MACRO TREND (1H)</p>

          {/* 24H High / Low row */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-white/30 font-mono tracking-widest uppercase">24H HIGH</p>
              <p className="text-lg font-mono font-bold text-white/90 tabular-nums">
                ${ticker ? Number(ticker.high).toLocaleString('en-US') : 'â”€â”€â”€â”€â”€'}
              </p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-sm text-white/30 font-mono tracking-widest uppercase">24H LOW</p>
              <p className="text-lg font-mono font-bold text-white/90 tabular-nums">
                ${ticker ? Number(ticker.low).toLocaleString('en-US') : 'â”€â”€â”€â”€â”€'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Area Chart â”€â”€ */}
      <div className="h-[185px] w-full rounded-xl border border-white/[0.05] bg-black/50 overflow-hidden">
        <LightweightAreaChart symbol="BTCUSDT" livePrice={ticker?.price ? parseFloat(ticker.price) : null} />
      </div>

      {/* â”€â”€ Inline Stats Bar â”€â”€ */}
      <div className="flex items-center justify-between px-3 py-4 rounded-xl border border-white/[0.05] bg-white/[0.02]" dir="rtl">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white/30 font-mono">ط§ط³طھط¹ظˆط§ط°</span>
          <span className="text-sm font-mono font-bold text-orange-400 tabular-nums">
            BTC {globalData.btcDominance}
          </span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white/30 font-mono">ط§ظ„ظ‚ظٹظ…ط© ط§ظ„ط³ظˆظ‚ظٹط©</span>
          <span className="text-sm font-mono font-bold text-white/80 tabular-nums">
            ${globalData.totalMarketCap}
          </span>
        </div>
      </div>

      {/* â”€â”€ Halving Countdown (tappable â†’ Network Macro modal) â”€â”€ */}
      <button
        onClick={() => setNetworkOpen(true)}
        className="w-full rounded-2xl overflow-hidden border border-white/[0.07] active:scale-[0.98] transition-transform text-left"
        aria-label="ظ…ط§ظƒط±ظˆ ط§ظ„ط´ط¨ظƒط© ظˆط§ظ„طھط¹ط¯ظٹظ† â€” ط§ط¶ط؛ط· ظ„ظ„طھظپط§طµظٹظ„"
      >
        {/* Orange gradient header */}
        <div
          className="px-5 py-4 text-center"
          style={{ background: 'linear-gradient(135deg, #c2410c, #ea580c, #f97316)' }}
        >
          <p className="text-white font-black text-lg tracking-wide">ط§ظ„ط¹ط¯ ط§ظ„طھظ†ط§ط²ظ„ظٹ ظ„ظ‡ط§ظ„ظپظٹظ†ط¬ ط§ظ„ط¨ظٹطھظƒظˆظٹظ† ط§ظ„ظ‚ط§ط¯ظ… â€” ط§ظ„ط¨ظ„ظˆظƒ</p>
          <p className="text-white/90 font-mono font-bold text-lg mt-0.5 tabular-nums">1,050,000</p>
        </div>

        <div className="bg-[#0a0a0a] px-3 py-4">
          {/* Flip boxes â€” ظٹظˆظ… / ط³ط§ط¹ط© / ط¯ظ‚ظٹظ‚ط© / ط«ط§ظ†ظٹط© */}
          <div className="grid grid-cols-4 gap-3 mb-3" dir="rtl">
            {[
              { val: halvingCountdown.days,  label: 'ظٹظˆظ…' },
              { val: halvingCountdown.hours, label: 'ط³ط§ط¹ط©' },
              { val: halvingCountdown.mins,  label: 'ط¯ظ‚ظٹظ‚ط©' },
              { val: halvingCountdown.secs,  label: 'ط«ط§ظ†ظٹط©' },
            ].map(({ val, label }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="w-full rounded-xl bg-[#111] border border-white/[0.07] py-4 flex items-center justify-center shadow-inner">
                  <span className="text-2xl font-black font-mono tabular-nums text-white">
                    {String(val).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-sm text-white/40 mt-1.5 font-bold">{label}</span>
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
          <p className="text-sm text-white/35 text-center font-mono">
            ط§ظ„ظ…ظƒط§ظپط£ط© ط§ظ„ط­ط§ظ„ظٹط©: <span className="text-white/60 font-bold">BTC 3.125</span>
            {' â€” '}
            ط¨ط¹ط¯ ط§ظ„ظ‡ط§ظ„ظپظٹظ†ط¬: <span className="text-orange-400 font-bold">BTC 1.5625</span>
          </p>
        </div>
      </button>

      {/* â”€â”€ Fear & Greed  +  Daily Close â€” live widgets side-by-side â”€â”€ */}
      <div className="grid grid-cols-2 gap-3 items-stretch">
        <FearGreedWidget globalData={globalData} />
        <DailyCloseWidget />
      </div>

      {/* â”€â”€ Network Macro Modal â”€â”€ */}
      {networkOpen && (
        <NetworkMacroModal
          spotPrice={ticker?.price ? parseFloat(ticker.price) : 0}
          halvingDays={halvingCountdown.days}
          onClose={() => setNetworkOpen(false)}
        />
      )}

      {/* â”€â”€ Tools Grid â”€â”€ */}
      <ToolsGrid />

      {/* â”€â”€ Learn Hub â”€â”€ */}
      <LearnHub />

      {/* â”€â”€ Footer â”€â”€ */}
      <Footer />

      </div>{/* end px-3 */}
    </div>
  );
}

// StatCard removed â€” replaced by inline stats bar in mobile layout

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
      <p className="text-sm font-bold text-white/30 uppercase tracking-widest mb-1">Fear &amp; Greed Index</p>
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

    /* PATCH: Use clientHeight from the container instead of a hardcoded
       value. Previously height:200 was hardcoded while the container CSS
       was h-[185px], causing a 15px canvas overflow that produced the
       distorted horizontal line artifacts reported on certain screens. */
    const containerH = chartContainerRef.current.clientHeight || 185;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255,255,255,0.35)',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.025)' },
        horzLines: { color: 'rgba(255,255,255,0.025)' },
      },
      width:  chartContainerRef.current.clientWidth,
      height: containerH,
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
        chart.applyOptions({
          width:  chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 185,
        });
      }
    });
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [symbol]);

  // Update with live WebSocket price â€” debounced to 1 update/second max
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

// â”€â”€ Tool categories with Arabic labels and accent colors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TOOL_CATEGORIES: {
  key: string;
  labelAr: string;
  labelEn: string;
  number: string;
  accent: string;
  dotColor: string;
}[] = [
  { key: 'pattern',  labelAr: 'ظ†ظ…ط§ط°ط¬ ط§ظ„ط³ط¹ط±',       labelEn: 'Pattern Recognition', number: '01', accent: 'text-violet-400', dotColor: 'bg-violet-500' },
  { key: 'smc',      labelAr: 'ط§ظ„ظ…ط§ظ„ ط§ظ„ط°ظƒظٹ',        labelEn: 'Smart Money / ICT',   number: '02', accent: 'text-sky-400',    dotColor: 'bg-sky-500'    },
  { key: 'math',     labelAr: 'ط§ظ„طھط­ظ„ظٹظ„ ط§ظ„ظƒظ…ظٹ',      labelEn: 'Quant / Math',        number: '03', accent: 'text-emerald-400',dotColor: 'bg-emerald-500'},
  { key: 'momentum', labelAr: 'ط§ظ„ط²ط®ظ… ظˆط§ظ„ط¥ط´ط§ط±ط§طھ',    labelEn: 'Momentum & Signals',  number: '04', accent: 'text-amber-400',  dotColor: 'bg-amber-500'  },
  { key: 'widget',   labelAr: 'ط£ط¯ظˆط§طھ ط§ظ„ط³ظˆظ‚',        labelEn: 'Market Widgets',      number: '05', accent: 'text-rose-400',   dotColor: 'bg-rose-500'   },
];

function ToolsGrid() {
  function fireHaptic() {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch {}
  }

  // Group tools by category, preserving original order within each group
  const grouped = TOOL_CATEGORIES.map(cat => ({
    ...cat,
    tools: ANALYSIS_TOOLS.filter(t => t.category === cat.key),
  })).filter(g => g.tools.length > 0);

  // Sequential numbering across all tools
  let globalIndex = 0;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">طھط±ط³ط§ظ†ط© ط§ظ„طھط­ظ„ظٹظ„</h3>
        </div>
        <span className="text-sm text-white/25 tabular-nums font-mono">
          {ANALYSIS_TOOLS.length} ط£ط¯ط§ط© آ· 5 ظپط¦ط§طھ
        </span>
      </div>

      {/* Grouped categories */}
      {grouped.map((cat) => (
        <div key={cat.key}>
          {/* Category header */}
          <div className="flex items-center gap-3.5 mb-2.5 px-0.5">
            <span className={`font-mono text-sm font-black ${cat.accent} bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-md tracking-widest`}>
              {cat.number}
            </span>
            <div className="flex flex-col">
              <span className={`text-sm font-bold ${cat.accent} uppercase tracking-wider leading-none`}>
                {cat.labelAr}
              </span>
              <span className="text-sm text-white/20 font-mono tracking-widest mt-0.5">
                {cat.labelEn}
              </span>
            </div>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.06), transparent)` }} />
            <span className="text-sm text-white/20 font-mono">{cat.tools.length}</span>
          </div>

          {/* Tools grid for this category */}
          <div className="grid grid-cols-2 gap-3">
            {cat.tools.map((tool) => {
              const toolNumber = ++globalIndex;
              return (
                <Link
                  key={tool.name}
                  href={`/tools/${toolToSlug(tool.name)}`}
                  onClick={fireHaptic}
                  className="group relative p-3.5 text-right rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.06] hover:border-orange-500/25 active:scale-[0.97] transition-all duration-150 overflow-hidden block motion-card"
                >
                  {/* Hover glow */}
                  <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_bottom-right,rgba(249,115,22,0.08),transparent_70%)]" />

                  {/* Top row: tag + number + arrow */}
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${tool.tagColor}`}>
                        {tool.tag}
                      </span>
                      <span className="tool-number">{String(toolNumber).padStart(2,'0')}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-orange-400 transition-colors shrink-0 mt-0.5 rtl:rotate-180" />
                  </div>

                  {/* Tool name */}
                  <span className="text-base font-semibold text-white/75 group-hover:text-white transition-colors leading-snug block">
                    {tool.name}
                  </span>

                  {/* Subtitle */}
                  <p className="text-sm text-white/25 mt-1 leading-tight line-clamp-1">
                    {tool.subtitle}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

