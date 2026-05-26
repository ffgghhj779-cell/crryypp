'use client';

import { useBinanceTicker } from '@/hooks/useBinanceTicker';
import { useEffect, useRef, useState, startTransition } from 'react';
import { AnimatePresence }  from 'motion/react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import { fetchKlines }        from '@/lib/binance';
import { ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
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
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-6 shadow-2xl">
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-orange-500/15 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 bg-orange-500/5 blur-2xl rounded-full" />

        <div className="relative z-10">
          {/* Top row: symbol + LIVE + connection */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <span className="text-white/50 font-bold tracking-widest text-sm uppercase">BTC/USDT</span>
              <span className={`px-2 py-0.5 text-sm font-bold rounded-full tabular-nums border ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {isPositive ? '▲' : '▼'} {Math.abs(parseFloat(ticker?.priceChangePercent ?? '0')).toFixed(2)}%
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
              {ticker ? Number(ticker.price).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '──────'}
            </span>
          </div>

          <p className="text-sm text-white/25 font-mono tracking-widest uppercase mb-3">HOURLY MACRO TREND (1H)</p>

          {/* 24H High / Low row */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-white/30 font-mono tracking-widest uppercase">24H HIGH</p>
              <p className="text-base font-mono font-bold text-white/90 tabular-nums">
                ${ticker ? Number(ticker.high).toLocaleString('en-US') : '─────'}
              </p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-sm text-white/30 font-mono tracking-widest uppercase">24H LOW</p>
              <p className="text-base font-mono font-bold text-white/90 tabular-nums">
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
      <div className="flex items-center justify-between px-3 py-4 rounded-xl border border-white/[0.05] bg-white/[0.02]" dir="rtl">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white/30 font-mono">استعواذ</span>
          <span className="text-sm font-mono font-bold text-orange-400 tabular-nums">
            BTC {globalData.btcDominance}
          </span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white/30 font-mono">القيمة السوقية</span>
          <span className="text-sm font-mono font-bold text-white/80 tabular-nums">
            ${globalData.totalMarketCap}
          </span>
        </div>
      </div>

      {/* ── Live Commodities Panel ── */}
      <CommoditiesPanel />

      {/* ── Halving Countdown (tappable → Network Macro modal) ── */}
      <button
        onClick={() => setNetworkOpen(true)}
        className="w-full rounded-2xl overflow-hidden border border-white/[0.07] active:scale-[0.98] transition-transform text-left"
        aria-label="ماكرو الشبكة والتعدين — اضغط للتفاصيل"
      >
        {/* Orange gradient header */}
        <div
          className="px-5 py-4 text-center"
          style={{ background: 'linear-gradient(135deg, #c2410c, #ea580c, #f97316)' }}
        >
          <p className="text-white font-black text-base tracking-wide">العد التنازلي لهالفينج البيتكوين القادم — البلوك</p>
          <p className="text-white/90 font-mono font-bold text-lg mt-0.5 tabular-nums">1,050,000</p>
        </div>

        <div className="bg-[#0a0a0a] px-3 py-4">
          {/* Flip boxes — يوم / ساعة / دقيقة / ثانية */}
          <div className="grid grid-cols-4 gap-3 mb-3" dir="rtl">
            {[
              { val: halvingCountdown.days,  label: 'يوم' },
              { val: halvingCountdown.hours, label: 'ساعة' },
              { val: halvingCountdown.mins,  label: 'دقيقة' },
              { val: halvingCountdown.secs,  label: 'ثانية' },
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

// ══ COMMODITIES PANEL ═══════════════════════════════════════════════════════════════════════════

interface CommodityItem {
  price: number;
  changePct: number;
  source?: string;
}

interface CommodityData {
  gold:         CommodityItem | null;
  oil:          CommodityItem | null;
  usdEgp:       CommodityItem | null;
  egyptianGold: CommodityItem | null;
}

function CommoditiesPanel() {
  const [data, setData] = useState<CommodityData>({
    gold: null, oil: null, usdEgp: null, egyptianGold: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const safetyTimer = setTimeout(() => setLoading(false), 12_000);

    async function load() {
      try {
        // Direct browser fetch — bypasses Vercel server-side IP blocking
        const [goldData, egpData, oilData] = await Promise.all([
          fetch('https://api.gold-api.com/price/XAU').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('https://open.er-api.com/v6/latest/USD').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('https://api.gold-api.com/price/BRENT').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        const goldPrice    = Number(goldData?.price ?? 3345);
        const goldPrev     = Number(goldData?.prev_close_price ?? goldPrice);
        const goldChgPct   = goldPrev ? ((goldPrice - goldPrev) / goldPrev) * 100 : 0;
        const egpRate      = Number(egpData?.rates?.EGP ?? 50.85);
        const oilPrice     = Number(oilData?.price ?? 79.5);
        const oilPrev      = Number(oilData?.prev_close_price ?? oilPrice);
        const oilChgPct    = oilPrev ? ((oilPrice - oilPrev) / oilPrev) * 100 : 0;
        const egpGold      = Math.round((goldPrice / 31.1035) * egpRate * (21 / 24));

        startTransition(() => {
          setData({
            gold:         { price: goldPrice, changePct: goldChgPct },
            oil:          { price: oilPrice,  changePct: oilChgPct },
            usdEgp:       { price: egpRate,   changePct: 0 },
            egyptianGold: { price: egpGold,   changePct: goldChgPct, source: 'calculated' },
          });
          setLoading(false);
          clearTimeout(safetyTimer);
          setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        });
      } catch {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    }

    load();
    const t = setInterval(load, 60_000);
    return () => { clearInterval(t); clearTimeout(safetyTimer); };
  }, []);


  type CardDef = {
    id: string;
    icon: string;
    labelAr: string;
    labelEn: string;
    price: string;
    unit: string;
    changePct: number;
    accentCls: string;
    glowCls: string;
    loaded: boolean;
  };

  const cards: CardDef[] = [
    {
      id: 'gold',
      icon: '🥇',
      labelAr: 'الذهب العالمي',
      labelEn: 'XAU / USD',
      price: data.gold
        ? `$${data.gold.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '---',
      unit: 'للأونصة',
      changePct: data.gold?.changePct ?? 0,
      accentCls: 'border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-black to-zinc-950',
      glowCls: 'bg-amber-500/10',
      loaded: !!data.gold,
    },
    {
      id: 'egygold',
      icon: '🇪🇬',
      labelAr: 'الذهب المصري',
      labelEn: data.egyptianGold?.source === 'scrape' ? 'عيار 21 · سوق' : 'عيار 21 · محسوب',
      price: data.egyptianGold
        ? `${Math.round(data.egyptianGold.price).toLocaleString('en-US')} ج`
        : '---',
      unit: 'جنيه / جرام',
      changePct: data.egyptianGold?.changePct ?? 0,
      accentCls: 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-black to-zinc-950',
      glowCls: 'bg-emerald-500/10',
      loaded: !!data.egyptianGold,
    },
    {
      id: 'oil',
      icon: '🛢️',
      labelAr: 'النفط الخام',
      labelEn: 'WTI Crude · USD/bbl',
      price: data.oil ? `$${data.oil.price.toFixed(2)}` : '---',
      unit: 'للبرميل',
      changePct: data.oil?.changePct ?? 0,
      accentCls: 'border-slate-500/30 bg-gradient-to-br from-slate-900/60 via-black to-zinc-950',
      glowCls: 'bg-slate-500/10',
      loaded: !!data.oil,
    },
    {
      id: 'usdegp',
      icon: '💵',
      labelAr: 'سعر الدولار',
      labelEn: 'USD / EGP',
      price: data.usdEgp ? `${data.usdEgp.price.toFixed(2)} ج` : '---',
      unit: 'جنيه مصري',
      changePct: data.usdEgp?.changePct ?? 0,
      accentCls: 'border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-black to-zinc-950',
      glowCls: 'bg-blue-500/10',
      loaded: !!data.usdEgp,
    },
  ];

  return (
    <div className="space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">السلع اللحظية</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {lastUpdated && <span className="text-xs text-white/20 font-mono">{lastUpdated}</span>}
          <span className="text-xs font-mono text-amber-500/70 border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 rounded-full">LIVE</span>
        </div>
      </div>

      {/* 2x2 cards grid */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const pos = card.changePct >= 0;
          return (
            <div key={card.id} className={`relative overflow-hidden rounded-2xl border p-4 ${card.accentCls} shadow-lg`}>
              <div className={`pointer-events-none absolute -top-6 -right-6 w-24 h-24 ${card.glowCls} blur-2xl rounded-full`} />
              <div className="flex items-start justify-between mb-3 relative z-10">
                <div>
                  <p className="text-white/35 text-xs font-mono tracking-widest leading-none mb-0.5">{card.labelEn}</p>
                  <p className="text-white/85 text-sm font-bold leading-tight">{card.labelAr}</p>
                </div>
                <span className="text-2xl leading-none">{card.icon}</span>
              </div>
              <div className="relative z-10">
                {loading && !card.loaded ? (
                  <div className="h-7 w-28 rounded-lg bg-white/5 animate-pulse mb-1" />
                ) : (
                  <p className="text-white font-black font-mono tabular-nums text-xl leading-none tracking-tight mb-1">{card.price}</p>
                )}
                <p className="text-white/25 text-xs font-mono">{card.unit}</p>
              </div>
              <div className="flex items-center justify-between mt-3 relative z-10">
                <span className={`inline-flex items-center gap-1 text-sm font-bold font-mono tabular-nums px-2 py-0.5 rounded-lg border ${
                  pos ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10' : 'text-red-400 border-red-500/25 bg-red-500/10'
                }`}>
                  {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {pos ? '+' : ''}{card.changePct.toFixed(2)}%
                </span>
                <span className="text-xs text-white/15 font-mono">24H</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

// ── Tool categories with Arabic labels and accent colors ─────────────────────
const TOOL_CATEGORIES: {
  key: string;
  labelAr: string;
  labelEn: string;
  number: string;
  accent: string;
  dotColor: string;
}[] = [
  { key: 'pattern',  labelAr: 'نماذج السعر',       labelEn: 'Pattern Recognition', number: '01', accent: 'text-violet-400', dotColor: 'bg-violet-500' },
  { key: 'smc',      labelAr: 'المال الذكي',        labelEn: 'Smart Money / ICT',   number: '02', accent: 'text-sky-400',    dotColor: 'bg-sky-500'    },
  { key: 'math',     labelAr: 'التحليل الكمي',      labelEn: 'Quant / Math',        number: '03', accent: 'text-emerald-400',dotColor: 'bg-emerald-500'},
  { key: 'momentum', labelAr: 'الزخم والإشارات',    labelEn: 'Momentum & Signals',  number: '04', accent: 'text-amber-400',  dotColor: 'bg-amber-500'  },
  { key: 'widget',   labelAr: 'أدوات السوق',        labelEn: 'Market Widgets',      number: '05', accent: 'text-rose-400',   dotColor: 'bg-rose-500'   },
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
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">ترسانة التحليل</h3>
        </div>
        <span className="text-sm text-white/25 tabular-nums font-mono">
          {ANALYSIS_TOOLS.length} أداة · 5 فئات
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

