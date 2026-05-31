'use client';

import { useEffect, useRef, memo, useState } from 'react';

// ─── TradingView study IDs ────────────────────────────────────────────────────
// Maps each tool name to its TradingView study identifier(s).
// Empty array = clean chart (used for tools that are drawing-based or custom).
export const TOOL_STUDIES: Record<string, string[]> = {
  'SMC Order Blocks':      [],                                    // Drawing-based, clean chart
  'Fair Value Gaps':       [],                                    // Drawing-based, clean chart
  'Market Structure':      [],                                    // Drawing-based, clean chart
  'Fibonacci Retracement': [],                                    // Drawing tool, clean chart
  'Volume Profile':        ['VbPFixed@tv-basicstudies'],          // Volume Profile Fixed Range
  'VWAP Bands':            ['VWAP@tv-basicstudies'],
  'Stochastic RSI':        ['StochasticRSI@tv-basicstudies'],
  'MACD Divergence':       ['MACD@tv-basicstudies'],
  'Bollinger Bands':       ['BB@tv-basicstudies'],
  'Ichimoku Cloud':        ['IchimokuCloud@tv-basicstudies'],
  'Fear & Greed Index':    [],                                    // Custom gauge, no TV study
  'BTC Correlation':       [],                                    // Clean chart
};

// ─── Default TradingView intervals per tool ───────────────────────────────────
export const TOOL_DEFAULT_INTERVAL: Record<string, string> = {
  'SMC Order Blocks':      '60',
  'Fair Value Gaps':       '60',
  'Market Structure':      '240',
  'Fibonacci Retracement': '240',
  'Volume Profile':        'D',
  'VWAP Bands':            '60',
  'Stochastic RSI':        '60',
  'MACD Divergence':       '60',
  'Bollinger Bands':       '60',
  'Ichimoku Cloud':        'D',
  'Fear & Greed Index':    '60',
  'BTC Correlation':       'D',
};

// ─── Tool descriptions ────────────────────────────────────────────────────────
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  'SMC Order Blocks':      'Identify institutional supply/demand zones where large players entered or exited positions.',
  'Fair Value Gaps':       'Spot price imbalances (FVGs) that price frequently returns to fill before continuing its trend.',
  'Market Structure':      'Track Break of Structure (BOS) and Change of Character (ChoCH) to define trend direction.',
  'Fibonacci Retracement': 'Map key retracement levels (0.382, 0.5, 0.618, 0.786) to find high-probability reversal zones.',
  'Volume Profile':        'Visualize traded volume at each price level to identify high-volume nodes and value areas.',
  'VWAP Bands':            'Volume-Weighted Average Price with standard deviation bands — intraday institutional benchmark.',
  'Stochastic RSI':        'Combines RSI and Stochastic Oscillator for early overbought/oversold momentum signals.',
  'MACD Divergence':       'Detect bullish/bearish divergences between price action and MACD histogram momentum.',
  'Bollinger Bands':       'Measure volatility via standard deviation bands. Squeezes signal breakout potential.',
  'Ichimoku Cloud':        'Multi-component system providing trend, momentum, and support/resistance at a single glance.',
  'Fear & Greed Index':    'CNN-style market sentiment index from 0 (Extreme Fear) to 100 (Extreme Greed).',
  'BTC Correlation':       'BTC/USDT spot chart for correlation analysis against altcoins or macro assets.',
};

// ─── Interval options ─────────────────────────────────────────────────────────
const INTERVALS = [
  { label: '15m', value: '15' },
  { label: '1H',  value: '60' },
  { label: '4H',  value: '240' },
  { label: '1D',  value: 'D' },
];

// Extend window with TradingView global
declare global {
  interface Window {
    TradingView?: any;
  }
}

// ─── Main Widget Component ────────────────────────────────────────────────────
interface TradingViewWidgetProps {
  toolName: string;
  symbol?: string;
}

const TV_SYMBOL_MAP: Record<string, string> = {
  'BTCUSDT': 'BINANCE:BTCUSDT',
  'ETHUSDT': 'BINANCE:ETHUSDT',
  'BNBUSDT': 'BINANCE:BNBUSDT',
  'SOLUSDT': 'BINANCE:SOLUSDT',
  'XRPUSDT': 'BINANCE:XRPUSDT',
  'XAUUSD':  'OANDA:XAUUSD',
  'WTIUSD':  'TVC:USOIL',
  'BRENTUSD':'TVC:UKOIL',
  'USDEGP':  'FX_IDC:USDEGP',
  'EURUSD':  'FX:EURUSD',
  // EGYXAU is explicitly handled (not supported on TV natively in a clean way)
};

const TradingViewWidget = memo(function TradingViewWidget({
  toolName,
  symbol = 'BTCUSDT',
}: TradingViewWidgetProps) {
  const defaultInterval = TOOL_DEFAULT_INTERVAL[toolName] ?? '60';
  const [interval, setInterval] = useState(defaultInterval);
  const containerRef = useRef<HTMLDivElement>(null);
  // Stable unique ID per widget instance
  const containerId = useRef(`tv_${Math.random().toString(36).slice(2, 9)}`).current;

  // Handle unsupported symbols like Egyptian Gold
  if (symbol.toUpperCase() === 'EGYXAU') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3 bg-zinc-950">
        <span className="text-4xl">🇪🇬</span>
        <p className="text-base text-white/50 font-bold">عذراً، شارت الذهب المصري غير متوفر على منصة TradingView</p>
        <p className="text-sm text-white/30 leading-relaxed">
          نظراً لأن الذهب المصري يعتمد على تسعير محلي خاص بالأسواق المصرية (جنيه للجرام 21)، 
          فإنه غير مدرج كمؤشر عالمي على منصة TradingView. يمكنك استخدام الأدوات الحسابية (مثل عجلة جان ومصفوفة فيبوناتشي) التي تعتمد على أسعارنا الخاصة بدلاً من الشارت.
        </p>
      </div>
    );
  }

  const tvSymbol = TV_SYMBOL_MAP[symbol.toUpperCase()] ?? `BINANCE:${symbol.toUpperCase()}`;

  useEffect(() => {
    if (!containerRef.current) return;

    const studies = TOOL_STUDIES[toolName] ?? [];

    const mountWidget = () => {
      if (!containerRef.current) return;
      // Clear any previous widget
      containerRef.current.innerHTML = '';

      const innerDiv = document.createElement('div');
      innerDiv.id = containerId;
      innerDiv.style.height = '100%';
      containerRef.current.appendChild(innerDiv);

      new window.TradingView!.widget({
        autosize: true,
        symbol: tvSymbol,
        interval,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0a0a0a',
        enable_publishing: false,
        hide_side_toolbar: true,
        hide_top_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        studies,
        container_id: containerId,
        // Premium dark overrides
        overrides: {
          'paneProperties.background':                '#050505',
          'paneProperties.backgroundType':           'solid',
          'paneProperties.vertGridProperties.color': 'rgba(255,255,255,0.02)',
          'paneProperties.horzGridProperties.color': 'rgba(255,255,255,0.02)',
          'scalesProperties.textColor':              'rgba(255,255,255,0.35)',
          'mainSeriesProperties.candleStyle.upColor':       '#22c55e',
          'mainSeriesProperties.candleStyle.downColor':     '#ef4444',
          'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
          'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
          'mainSeriesProperties.candleStyle.wickUpColor':   '#22c55e',
          'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
        },
        studies_overrides: {
          'bollinger bands.median.color': '#f97316',
          'bollinger bands.upper.color':  'rgba(249,115,22,0.5)',
          'bollinger bands.lower.color':  'rgba(249,115,22,0.5)',
          'VWAP.plot.color': '#f97316',
          'macd.macd.color': '#f97316',
          'macd.signal.color': '#22c55e',
        },
      });
    };

    // Load tv.js only once, reuse if already present
    if (window.TradingView) {
      mountWidget();
    } else {
      const existingScript = document.getElementById('tv-widget-script');
      if (existingScript) {
        existingScript.addEventListener('load', mountWidget);
      } else {
        const script = document.createElement('script');
        script.id = 'tv-widget-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = mountWidget;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  // Re-mount when interval or tool changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolName, interval, tvSymbol, containerId]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Interval Selector ── */}
      <div className="flex items-center gap-1.5 px-5 pt-3 pb-2 shrink-0">
        <span className="text-sm text-white/30 uppercase tracking-widest mr-1">Interval</span>
        {INTERVALS.map(iv => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className={`px-3 py-1 rounded-lg text-sm font-bold transition-all active:scale-95 ${
              interval === iv.value
                ? 'bg-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                : 'bg-white/[0.05] text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            {iv.label}
          </button>
        ))}
      </div>

      {/* ── Chart Container ── */}
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-hidden"
        style={{ minHeight: 0 }}
      />
    </div>
  );
});

export default TradingViewWidget;
