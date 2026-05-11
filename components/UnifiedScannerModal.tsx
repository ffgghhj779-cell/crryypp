'use client';

import { useState } from 'react';
import { X, Zap, Globe, BarChart2, AlertTriangle } from 'lucide-react';
import { fetchKlines }      from '@/lib/binance/fetcher';
import { calculateSMC }    from '@/lib/algorithms/smc';
import type { SMCResult }  from '@/lib/algorithms/smc';
import { SMCResultCard }   from '@/components/tools/SMCResultCard';
import { calculateGARCH }  from '@/lib/algorithms/quant';
import type { GarchResult } from '@/lib/algorithms/quant';
import { GarchResultCard } from '@/components/tools/GarchResultCard';
import { VIPResultCard }   from '@/components/tools/VIPResultCard';
import { detectWedge }     from '@/lib/algorithms/patterns';
import type { PatternResult } from '@/lib/algorithms/patterns';
import { WedgeResultCard } from '@/components/tools/WedgeResultCard';

// ─── Tool Dictionary ──────────────────────────────────────────────────────────
export type ToolCategory = 'pattern' | 'smc' | 'math' | 'momentum' | 'widget';
export type InputType = 'symbol' | 'timeframe' | 'price_start' | 'price_end' | 'period' | 'direction';

export interface ToolDef {
  name: string;
  tag: string;
  category: ToolCategory;
  subtitle: string;
  tagColor: string;
  requiredInputs: InputType[];
}

export const ANALYSIS_TOOLS: ToolDef[] = [
  // A – Pattern Recognition
  { name: 'Wedge Scanner',            tag: 'Pattern',     category: 'pattern',  subtitle: 'Rising & Falling Wedge detector', tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Double Pattern',           tag: 'Pattern',     category: 'pattern',  subtitle: 'Double Top & Bottom formations',  tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Cup & Handle',             tag: 'Pattern',     category: 'pattern',  subtitle: 'Bullish continuation scanner',    tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe', 'direction'] },
  { name: 'Head & Shoulders',         tag: 'Pattern',     category: 'pattern',  subtitle: 'Reversal pattern identifier',     tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe', 'direction'] },
  { name: 'Triangle Predictor',       tag: 'Pattern',     category: 'pattern',  subtitle: 'Sym / Asc / Desc triangles',      tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe', 'direction'] },
  // B – Smart Money
  { name: 'SMC Order Blocks',         tag: 'Smart Money', category: 'smc',      subtitle: 'Bullish & Bearish OB zones',      tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Market Structure',         tag: 'Smart Money', category: 'smc',      subtitle: 'BOS & CHoCH tracker',             tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Wyckoff',                  tag: 'Smart Money', category: 'smc',      subtitle: 'Accumulation / Distribution phase',tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe', 'direction'] },
  { name: 'Order Flow CDD',           tag: 'Smart Money', category: 'smc',      subtitle: 'Cumulative Delta Divergence',      tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Liquidity Sweep',          tag: 'Smart Money', category: 'smc',      subtitle: 'Stop-hunt & sweep detector',      tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe'] },
  // C – Advanced Math
  { name: 'Monte Carlo',              tag: 'Quant',       category: 'math',     subtitle: '1000-iteration price projection',  tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'price_start', 'price_end', 'period'] },
  { name: 'GARCH',                    tag: 'Quant',       category: 'math',     subtitle: 'Volatility forecasting bands',     tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Markov Model (HMM)',       tag: 'Quant',       category: 'math',     subtitle: 'Market regime classifier',         tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Fourier Transform',        tag: 'Quant',       category: 'math',     subtitle: 'Cycle & time period detection',    tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Linear Regression',        tag: 'Quant',       category: 'math',     subtitle: 'Fair value & channel estimation',  tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'price_start', 'price_end', 'direction'] },
  // D – Momentum & Signals
  { name: 'Divergence Scanner',       tag: 'Momentum',    category: 'momentum', subtitle: 'RSI & MACD hidden/regular div',   tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Trading VIP 1',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Trading VIP 2',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Trading VIP 3',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Trading VIP 4',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Trading VIP 5',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: '4x4 Confluence',           tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-timeframe alignment score',  tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol'] },
  { name: 'CHOP Index',               tag: 'Momentum',    category: 'momentum', subtitle: 'Choppiness vs trend strength',    tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  // E – TradingView Widgets
  { name: 'Economic Calendar',        tag: 'Widget',      category: 'widget',   subtitle: 'Macro event calendar',            tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',      requiredInputs: [] },
  { name: 'Heatmap',                  tag: 'Widget',      category: 'widget',   subtitle: 'Crypto market heatmap',           tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',      requiredInputs: [] },
];

// ─── Mock Engine ──────────────────────────────────────────────────────────────
interface ScanResult { [key: string]: string | number | boolean }

export function simulateScan(toolName: string, symbol: string, timeframe: string): ScanResult {
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1) + timeframe.length;
  const bull = seed % 2 === 0;
  const price = 103_240 + (seed * 137) % 5000;

  switch (true) {
    // Pattern Recognition
    case toolName === 'Wedge Scanner':
      return { pattern: bull ? 'Falling Wedge ✓' : 'Rising Wedge ✓', direction: bull ? 'BULLISH BREAKOUT' : 'BEARISH BREAKDOWN', confidence: `${72 + seed % 20}%`, neckline: `$${(price - 1200).toLocaleString()}`, target: `$${(price + 3400).toLocaleString()}`, stopLoss: `$${(price - 2100).toLocaleString()}` };
    case toolName === 'Double Pattern':
      return { pattern: bull ? 'Double Bottom ✓' : 'Double Top ✓', direction: bull ? 'BULLISH REVERSAL' : 'BEARISH REVERSAL', confidence: `${68 + seed % 22}%`, neckline: `$${(price - 800).toLocaleString()}`, target: `$${(price + 4100).toLocaleString()}`, stopLoss: `$${(price - 1600).toLocaleString()}` };
    case toolName === 'Cup & Handle':
      return { pattern: 'Cup & Handle ✓', direction: 'BULLISH CONTINUATION', confidence: `${75 + seed % 18}%`, cupDepth: `${18 + seed % 10}%`, handleDepth: `${6 + seed % 5}%`, target: `$${(price + 5200).toLocaleString()}` };
    case toolName === 'Head & Shoulders':
      return { pattern: bull ? 'Inverse H&S ✓' : 'Head & Shoulders ✓', direction: bull ? 'BULLISH' : 'BEARISH', confidence: `${70 + seed % 20}%`, leftShoulder: `$${(price - 2000).toLocaleString()}`, head: `$${(price + 1500).toLocaleString()}`, rightShoulder: `$${(price - 1800).toLocaleString()}`, neckline: `$${(price - 600).toLocaleString()}` };
    case toolName === 'Triangle Predictor':
      return { pattern: ['Symmetrical', 'Ascending', 'Descending'][seed % 3] + ' Triangle ✓', direction: bull ? 'BULLISH BREAKOUT' : 'BEARISH BREAKDOWN', confidence: `${65 + seed % 25}%`, apex: `${3 + seed % 5} candles`, target: `$${(price + 2800).toLocaleString()}` };

    // SMC
    case toolName === 'SMC Order Blocks':
      return { bias: bull ? 'BULLISH' : 'BEARISH', bullishOB: `$${(price - 1500).toLocaleString()} – $${(price - 900).toLocaleString()}`, bearishOB: `$${(price + 1800).toLocaleString()} – $${(price + 2600).toLocaleString()}`, mitigated: bull ? 'No' : 'Yes', premium: `$${(price + 1200).toLocaleString()}`, discount: `$${(price - 1100).toLocaleString()}` };
    case toolName === 'Market Structure':
      return { regime: bull ? 'UPTREND' : 'DOWNTREND', lastEvent: bull ? 'Break of Structure (BOS) ↑' : 'Change of Character (CHoCH) ↓', swing_high: `$${(price + 2100).toLocaleString()}`, swing_low: `$${(price - 1800).toLocaleString()}`, trend_bias: bull ? 'BULLISH' : 'BEARISH', confirmation: bull ? 'Strong' : 'Weak' };
    case toolName === 'Wyckoff':
      return { phase: ['Accumulation — Phase C', 'Distribution — Phase B', 'Markup', 'Markdown'][seed % 4], bias: bull ? 'BULLISH' : 'BEARISH', spring: bull ? 'Detected ✓' : 'Not Detected', upthrust: bull ? 'Not Detected' : 'Detected ✓', composite_man: bull ? 'Accumulating' : 'Distributing' };
    case toolName === 'Order Flow CDD':
      return { delta: bull ? `+${12400 + seed % 5000}` : `-${11200 + seed % 4000}`, divergence: bull ? 'Bullish CDD ✓' : 'Bearish CDD ✓', strength: `${60 + seed % 30}%`, buy_vol: `${(seed * 41) % 9000 + 8000} BTC`, sell_vol: `${(seed * 37) % 9000 + 7000} BTC` };
    case toolName === 'Liquidity Sweep':
      return { event: bull ? 'Buy-side Liquidity Grab ✓' : 'Sell-side Liquidity Grab ✓', swept_level: `$${(price + (bull ? 800 : -800)).toLocaleString()}`, reversal_zone: `$${(price + (bull ? -400 : 400)).toLocaleString()}`, probability: `${62 + seed % 28}%`, volume_spike: `${150 + seed % 80}%` };

    // Math / Quant
    case toolName === 'Monte Carlo':
      return { iterations: '1,000', timeframe, median: `$${price.toLocaleString()}`, high_95: `$${(price + 8200 + seed % 2000).toLocaleString()}`, low_95: `$${(price - 7100 - seed % 1500).toLocaleString()}`, upside_prob: `${45 + seed % 20}%`, sigma: `${2.1 + (seed % 10) / 10}` };
    case toolName === 'GARCH':
      return { model: 'GARCH(1,1)', annualized_vol: `${42 + seed % 20}%`, upper_band: `$${(price + 5400).toLocaleString()}`, lower_band: `$${(price - 4900).toLocaleString()}`, vix_equiv: `${38 + seed % 15}`, regime: seed % 2 === 0 ? 'HIGH VOLATILITY' : 'MODERATE VOLATILITY' };
    case toolName === 'Markov Model (HMM)':
      return { regime: ['TRENDING ↗', 'RANGING ↔', 'BREAKOUT PENDING ⚡'][seed % 3], confidence: `${70 + seed % 22}%`, state_duration: `${4 + seed % 10} candles`, transition_prob: `${seed % 2 === 0 ? 'Trend → Range' : 'Range → Trend'}: ${35 + seed % 30}%` };
    case toolName === 'Fourier Transform':
      return { dominant_cycle: `${14 + seed % 10} candles`, secondary_cycle: `${28 + seed % 14} candles`, next_peak: `${3 + seed % 5} candles`, next_trough: `${8 + seed % 6} candles`, cycle_strength: `${55 + seed % 35}%` };
    case toolName === 'Linear Regression':
      return { fair_value: `$${price.toLocaleString()}`, upper_channel: `$${(price + 3100).toLocaleString()}`, lower_channel: `$${(price - 2900).toLocaleString()}`, slope: bull ? '+' + (0.12 + (seed % 10) / 100).toFixed(2) : '-' + (0.08 + (seed % 8) / 100).toFixed(2), r_squared: (0.72 + (seed % 20) / 100).toFixed(3), deviation: `${1.8 + (seed % 12) / 10}%` };

    // Momentum
    case toolName === 'Divergence Scanner': {
      const type = ['Regular Bullish', 'Regular Bearish', 'Hidden Bullish', 'Hidden Bearish'][seed % 4];
      return { rsi_div: type + ' RSI Divergence ✓', macd_div: seed % 3 === 0 ? 'Hidden Bearish MACD ✓' : 'Not Detected', strength: `${65 + seed % 25}%`, direction: type.includes('Bullish') ? 'BULLISH' : 'BEARISH' };
    }
    case /^Trading VIP/.test(toolName): {
      const vipNum = parseInt(toolName.slice(-1)) || 1;
      const score = 50 + (seed * vipNum) % 40;
      return { consensus: score >= 70 ? 'STRONG BUY 🟢' : score >= 55 ? 'BUY 🟡' : score <= 30 ? 'STRONG SELL 🔴' : 'NEUTRAL ⚪', score: `${score}/100`, rsi: `${35 + seed % 35}`, macd: bull ? 'Bullish Cross ✓' : 'Bearish Cross ✗', ema: bull ? 'Price > EMA200 ✓' : 'Price < EMA200 ✗', bb: ['Upper', 'Middle', 'Lower'][seed % 3] + ' Band', adx: `${20 + seed % 30}` };
    }
    case toolName === '4x4 Confluence': {
      const tfs = ['15m','1H','4H','1D'];
      const signals = tfs.map((tf, i) => ({ tf, signal: (seed + i) % 2 === 0 ? '🟢 BULL' : '🔴 BEAR' }));
      const bullCount = signals.filter(s => s.signal.includes('BULL')).length;
      return { overall: bullCount >= 3 ? 'STRONG BULLISH ✓' : bullCount <= 1 ? 'STRONG BEARISH ✗' : 'MIXED ⚠', score: `${bullCount * 25}%`, ...Object.fromEntries(signals.map(s => [s.tf, s.signal])) };
    }
    case toolName === 'CHOP Index': {
      const chop = 45 + seed % 40;
      return { chop_value: chop.toFixed(2), regime: chop > 61.8 ? 'CHOPPY / RANGING ↔' : 'TRENDING ↗', strength: chop > 61.8 ? 'Avoid momentum trades' : 'Trend-following favored', threshold: '61.8', percentile: `${30 + seed % 50}th` };
    }

    default:
      return { status: 'COMPLETE', symbol, timeframe, result: 'Analysis complete' };
  }
}

// ─── Result Card ─────────────────────────────────────────────────────────────
function ResultCard({ result, tool }: { result: ScanResult; tool: ToolDef }) {
  const isBull = JSON.stringify(result).toUpperCase().includes('BULL');
  const isBear = JSON.stringify(result).toUpperCase().includes('BEAR');
  const accent = isBull ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : isBear ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-orange-500/30 bg-orange-500/[0.04]';
  const dotColor = isBull ? 'bg-emerald-500' : isBear ? 'bg-red-500' : 'bg-orange-500';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${accent}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Scan Complete — {tool.name}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(result).map(([k, v]) => (
          <div key={k} className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">{k.replace(/_/g, ' ')}</p>
            <p className={`text-sm font-mono font-bold tabular-nums leading-tight ${
              String(v).includes('BULL') || String(v).includes('BUY') || String(v).includes('✓') ? 'text-emerald-400'
              : String(v).includes('BEAR') || String(v).includes('SELL') || String(v).includes('✗') ? 'text-red-400'
              : 'text-orange-300'
            }`}>
              {String(v)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Widget Views ─────────────────────────────────────────────────────────────
function EconomicCalendarWidget() {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.07]" style={{ height: 420 }}>
      <iframe
        src="https://www.tradingview.com/embed-widget/events/?locale=en#%7B%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22width%22%3A%22100%25%22%2C%22height%22%3A%22100%25%22%7D"
        className="w-full h-full border-0"
        title="Economic Calendar"
        allowFullScreen
      />
    </div>
  );
}

function HeatmapWidget() {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.07]" style={{ height: 420 }}>
      <iframe
        src="https://www.tradingview.com/embed-widget/crypto-coins-heatmap/?locale=en#%7B%22dataSource%22%3A%22Crypto%22%2C%22blockSize%22%3A%22market_cap_calc%22%2C%22blockColor%22%3A%22change%22%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22width%22%3A%22100%25%22%2C%22height%22%3A%22100%25%22%7D"
        className="w-full h-full border-0"
        title="Crypto Heatmap"
        allowFullScreen
      />
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
interface Props { tool: ToolDef; onClose: () => void; }

// ─── Input field meta ────────────────────────────────────────────────────────
const INPUT_META: Record<InputType, { label: string; placeholder?: string; type: 'text' | 'number' | 'select' }> = {
  symbol:      { label: 'Symbol',      placeholder: 'BTCUSDT', type: 'text'   },
  timeframe:   { label: 'Timeframe',                           type: 'select' },
  price_start: { label: 'Start Price', placeholder: '100000',  type: 'number' },
  price_end:   { label: 'End Price',   placeholder: '110000',  type: 'number' },
  period:      { label: 'Period',      placeholder: '14',      type: 'number' },
  direction:   { label: 'Direction',                           type: 'select' },
};

export function UnifiedScannerModal({ tool, onClose }: Props) {
  const [symbol,     setSymbol]     = useState('BTCUSDT');
  const [timeframe,  setTimeframe]  = useState('1H');
  const [priceStart, setPriceStart] = useState('');
  const [priceEnd,   setPriceEnd]   = useState('');
  const [period,     setPeriod]     = useState('14');
  const [direction,  setDirection]  = useState('Bullish ↑');
  const [phase,        setPhase]       = useState<'idle' | 'scanning' | 'done'>('idle');
  const [result,       setResult]      = useState<ScanResult    | null>(null);
  const [smcResult,    setSmcResult]   = useState<SMCResult     | null>(null);
  const [garchResult,  setGarchResult] = useState<GarchResult   | null>(null);
  const [wedgeResult,  setWedgeResult] = useState<PatternResult | null>(null);
  const [fetchErr,     setFetchErr]    = useState<string | null>(null);

  const isWidget = tool.category === 'widget';

  // Map input key → current value (for simulateScan passthrough)
  function getInputValue(key: InputType): string {
    switch (key) {
      case 'symbol':      return symbol;
      case 'timeframe':   return timeframe;
      case 'price_start': return priceStart || '100000';
      case 'price_end':   return priceEnd   || '110000';
      case 'period':      return period;
      case 'direction':   return direction;
    }
  }

  async function handleScan() {
    setPhase('scanning');
    setResult(null);
    setSmcResult(null);
    setGarchResult(null);
    setWedgeResult(null);
    setFetchErr(null);

    if (!isWidget) {
      try {
        // ── SMC Order Blocks — 300 candles → full OB algorithm ──────────────
        if (tool.name === 'SMC Order Blocks') {
          const klines = await fetchKlines(symbol, timeframe, 300);
          console.info(`[SMC] ✓ ${symbol} ${timeframe} — last close: $${klines[klines.length-1]?.close.toLocaleString()}`);
          setSmcResult(calculateSMC(klines, symbol));
          setPhase('done');
          return;
        }

        // ── GARCH — 100 candles → volatility band algorithm ─────────────────
        if (tool.name === 'GARCH') {
          const klines = await fetchKlines(symbol, timeframe, 100);
          console.info(`[GARCH] ✓ ${symbol} ${timeframe} — last close: $${klines[klines.length-1]?.close.toLocaleString()}`);
          const barsPerYear: Record<string, number> = { '15m': 365*24*4, '1H': 365*24, '4H': 365*6, '1D': 365 };
          setGarchResult(calculateGARCH(klines, barsPerYear[timeframe] ?? 365*24));
          setPhase('done');
          return;
        }

        // ── Wedge Scanner — 400 candles on 4H → pivot regression ────────────
        if (tool.name === 'Wedge Scanner') {
          const klines = await fetchKlines(symbol, '4h', 400);
          console.info(`[Wedge] ✓ ${symbol} 4H — ${klines.length} candles`);
          setWedgeResult(detectWedge(klines));
          setPhase('done');
          return;
        }

        // ── All other tools — live connection test + mock result ─────────────
        const klines = await fetchKlines(symbol, timeframe, 100);
        console.info(`[BinanceFetcher] ✓ ${symbol} ${timeframe} — last close: $${klines[klines.length-1]?.close.toLocaleString()}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown fetch error';
        setFetchErr(msg);
        setPhase('idle');
        return;
      }
    }

    // Mocked quant result for non-quantitative tools
    setTimeout(() => {
      setResult(simulateScan(tool.name, symbol, timeframe));
      setPhase('done');
    }, 400 + Math.random() * 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ animation: 'fade-in 0.2s ease forwards' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60 flex flex-col"
        style={{ background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', maxHeight: '92dvh', animation: 'slide-up 0.32s cubic-bezier(0.16,1,0.3,1) forwards' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {tool.category === 'widget' ? <Globe className="w-5 h-5 text-orange-500 shrink-0" /> : <Zap className="w-5 h-5 text-orange-500 shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-white font-bold text-base truncate">{tool.name}</h2>
              <p className="text-[10px] text-white/35 truncate">{tool.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 ml-2 p-1.5 text-white/40 hover:text-white bg-white/[0.05] hover:bg-white/10 rounded-full transition-all active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>

          {/* Widget-only view */}
          {isWidget && (
            tool.name === 'Economic Calendar' ? <EconomicCalendarWidget /> : <HeatmapWidget />
          )}

          {/* VIP tools — self-contained card with its own fetch trigger */}
          {!isWidget && /^Trading VIP/.test(tool.name) && (
            <VIPResultCard symbol={symbol} />
          )}

          {/* All other non-widget tools — standard inputs + scan button */}
          {!isWidget && !/^Trading VIP/.test(tool.name) && (
            <>
              {/* Tag + category strip */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${tool.tagColor}`}>{tool.tag}</span>
                <BarChart2 className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[10px] text-white/30 font-mono">
                  {tool.requiredInputs.map(k => getInputValue(k)).filter(Boolean).join(' · ')}
                </span>
              </div>

              {/* Dynamic inputs */}
              <div className="grid grid-cols-2 gap-3">
                {tool.requiredInputs.map((key) => {
                  const meta = INPUT_META[key];
                  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono text-sm focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-white/20 tabular-nums";

                  if (meta.type === 'select' && key === 'timeframe') return (
                    <div key={key}>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">{meta.label}</label>
                      <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
                        className={inputClass + ' appearance-none cursor-pointer'}>
                        {['15m','1H','4H','1D'].map(tf => <option key={tf} value={tf} className="bg-zinc-900">{tf}</option>)}
                      </select>
                    </div>
                  );

                  if (meta.type === 'select' && key === 'direction') return (
                    <div key={key}>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">{meta.label}</label>
                      <select value={direction} onChange={e => setDirection(e.target.value)}
                        className={inputClass + ' appearance-none cursor-pointer'}>
                        {['Bullish ↑','Bearish ↓'].map(d => <option key={d} value={d} className="bg-zinc-900">{d}</option>)}
                      </select>
                    </div>
                  );

                  if (key === 'symbol') return (
                    <div key={key}>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">{meta.label}</label>
                      <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
                        className={inputClass} placeholder={meta.placeholder} />
                    </div>
                  );

                  if (key === 'price_start') return (
                    <div key={key}>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">{meta.label}</label>
                      <input type="number" value={priceStart} onChange={e => setPriceStart(e.target.value)}
                        className={inputClass} placeholder={meta.placeholder} />
                    </div>
                  );

                  if (key === 'price_end') return (
                    <div key={key}>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">{meta.label}</label>
                      <input type="number" value={priceEnd} onChange={e => setPriceEnd(e.target.value)}
                        className={inputClass} placeholder={meta.placeholder} />
                    </div>
                  );

                  if (key === 'period') return (
                    <div key={key}>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">{meta.label}</label>
                      <input type="number" value={period} onChange={e => setPeriod(e.target.value)}
                        className={inputClass} placeholder={meta.placeholder} min="1" max="200" />
                    </div>
                  );

                  return null;
                })}
              </div>

              {/* Error toast */}
              {fetchErr && (
                <div
                  className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-red-500/30 bg-red-500/[0.07]"
                  style={{ animation: 'slide-up 0.25s cubic-bezier(0.16,1,0.3,1) forwards' }}
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Fetch Error</p>
                    <p className="text-[11px] text-red-300/80 mt-0.5 leading-snug">{fetchErr}</p>
                  </div>
                </div>
              )}

              {/* Scan Button */}
              <button
                onClick={handleScan}
                disabled={phase === 'scanning'}
                className="w-full py-4 rounded-2xl font-bold text-base tracking-wider transition-all active:scale-[0.98] disabled:cursor-not-allowed relative overflow-hidden"
                style={{
                  background: phase === 'scanning'
                    ? 'linear-gradient(135deg, #92400e, #78350f)'
                    : 'linear-gradient(135deg, #f97316, #ea580c)',
                  boxShadow: phase !== 'scanning' ? '0 0 32px rgba(249,115,22,0.3)' : 'none',
                  color: '#fff',
                }}
              >
                {phase === 'scanning' ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <span className="w-4 h-4 border-2 border-orange-300/40 border-t-orange-200 rounded-full animate-spin" />
                    <span className="animate-pulse tracking-[0.2em] text-sm">FETCHING LIVE DATA...</span>
                  </span>
                ) : (
                  <span className="tracking-[0.15em]">⚡ START SCAN · تحليل</span>
                )}
              </button>

              {/* Result — SMC Order Blocks */}
              {phase === 'done' && smcResult && tool.name === 'SMC Order Blocks' && (
                <SMCResultCard data={smcResult} symbol={symbol} />
              )}

              {/* Result — GARCH Volatility */}
              {phase === 'done' && garchResult && tool.name === 'GARCH' && (
                <GarchResultCard data={garchResult} symbol={symbol} />
              )}

              {/* Result — Wedge Scanner */}
              {phase === 'done' && wedgeResult && tool.name === 'Wedge Scanner' && (
                <WedgeResultCard data={wedgeResult} symbol={symbol} />
              )}

              {/* Result — all other tools (mocked) */}
              {phase === 'done' && result && !['SMC Order Blocks','GARCH','Wedge Scanner'].includes(tool.name) && (
                <div style={{ animation: 'slide-up 0.3s cubic-bezier(0.16,1,0.3,1) forwards' }}>
                  <ResultCard result={result} tool={tool} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
