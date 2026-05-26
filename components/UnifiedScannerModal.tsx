'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { X, Zap, Globe, BarChart2, AlertTriangle } from 'lucide-react';
import { NativeSheet } from '@/components/ui/NativeSheet';
import { fetchKlines }      from '@/lib/binance/fetcher';
import { calculateSMC }    from '@/lib/algorithms/smc';
import type { SMCResult }  from '@/lib/algorithms/smc';
import { SMCResultCard }   from '@/components/tools/SMCResultCard';
import { calculateGARCH }  from '@/lib/algorithms/quant';
import type { GarchResult } from '@/lib/algorithms/quant';
import { GarchResultCard } from '@/components/tools/GarchResultCard';
import { VIPResultCard }   from '@/components/tools/VIPResultCard';
import { detectWedge }        from '@/lib/algorithms/patterns';
import type { PatternResult }  from '@/lib/algorithms/patterns';
import { WedgeResultCard }     from '@/components/tools/WedgeResultCard';
import {
  analyzeRSI, analyzeMACD, analyzeBollinger,
} from '@/lib/algorithms/momentum';
import type {
  RSIResult, MACDResult, BollingerResult,
} from '@/lib/algorithms/momentum';
import {
  RsiResultCard, MacdResultCard, BollingerResultCard,
} from '@/components/tools/MomentumResultCards';
import {
  analyzeFVG, analyzeLiquiditySweep, analyzeCVDProxy,
} from '@/lib/algorithms/orderflow';
import type {
  FVGResult, SweepResult, CVDResult,
} from '@/lib/algorithms/orderflow';
import {
  FvgResultCard, SweepResultCard, CvdResultCard,
} from '@/components/tools/OrderFlowResultCards';
import {
  analyzeMonteCarlo, analyzeLinearRegression, analyzeMarkovModel, analyzeFourier,
} from '@/lib/algorithms/advancedQuant';
import type {
  MonteCarloResult, LinearRegressionResult, MarkovResult, FourierResult,
} from '@/lib/algorithms/advancedQuant';
import {
  MonteCarloCard, LinearRegressionCard, MarkovCard, FourierCard,
} from '@/components/tools/QuantResultCards';
import {
  detectDoublePattern, detectCupHandle, detectHeadShoulders,
  detectTriangle, analyzeMarketStructure,
} from '@/lib/algorithms/classicPatterns';
import type {
  DoublePatternResult, CupHandleResult, HSResult,
  TriangleResult, MarketStructureResult,
} from '@/lib/algorithms/classicPatterns';
import {
  DoublePatternCard, CupHandleCard, HeadShouldersCard,
  TriangleCard, MarketStructureCard,
} from '@/components/tools/ClassicPatternCards';
import { analyzeWyckoff }   from '@/lib/algorithms/wyckoff';
import type { WyckoffResult } from '@/lib/algorithms/wyckoff';
import { WyckoffCard }       from '@/components/tools/WyckoffCard';
import { EWAResultCard }     from '@/components/tools/EWAResultCard';
import type { EWAResult }    from '@/lib/types/ewa';
import { useEWA }            from '@/lib/hooks/useEWA';

// â”€â”€â”€ Tool Dictionary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // A â€“ Pattern Recognition
  { name: 'Wedge Scanner',            tag: 'Pattern',     category: 'pattern',  subtitle: 'Rising & Falling Wedge detector', tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Double Pattern',           tag: 'Pattern',     category: 'pattern',  subtitle: 'Double Top & Bottom formations',  tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Cup & Handle',             tag: 'Pattern',     category: 'pattern',  subtitle: 'Bullish continuation scanner',    tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe', 'direction'] },
  { name: 'Head & Shoulders',         tag: 'Pattern',     category: 'pattern',  subtitle: 'Reversal pattern identifier',     tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe', 'direction'] },
  { name: 'Triangle Predictor',       tag: 'Pattern',     category: 'pattern',  subtitle: 'Sym / Asc / Desc triangles',      tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20', requiredInputs: ['symbol', 'timeframe', 'direction'] },
  { name: 'Pattern Scanner',          tag: 'Pattern',     category: 'pattern',  subtitle: 'ظ…ظƒطھط´ظپ ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ظƒظ„ط§ط³ظٹظƒظٹط© ط§ظ„ط£ظˆطھظˆظ…ط§طھظٹظƒظٹ', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  { name: 'Harmonic Scanner',         tag: 'Pattern',     category: 'pattern',  subtitle: 'ظ…ط§ط³ط­ ط§ظ„ظ‡ط§ط±ظ…ظˆظ†ظٹظƒ â€” XABCD PRZ',      tagColor: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20', requiredInputs: [] },
  // B â€“ Smart Money
  { name: 'ZigZag Engine',            tag: 'Structure',   category: 'smc',      subtitle: 'ظ…ط­ط±ظƒ ط§ظ„ظ‚ظ…ظ… ظˆط§ظ„ظ‚ظٹط¹ط§ظ† (ط§ظ„ط§ظ†ط­ط±ط§ظپ ط§ظ„ظ‡ظٹظƒظ„ظٹ)',  tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',      requiredInputs: [] },
  { name: 'SMC Order Blocks',         tag: 'Smart Money', category: 'smc',      subtitle: 'Bullish & Bearish OB zones',      tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Market Structure',         tag: 'Smart Money', category: 'smc',      subtitle: 'BOS & CHoCH tracker',             tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Wyckoff',                  tag: 'Smart Money', category: 'smc',      subtitle: 'Accumulation / Distribution phase',tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe', 'direction'] },
  { name: 'Order Flow CDD',           tag: 'Smart Money', category: 'smc',      subtitle: 'Cumulative Delta Divergence',      tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Liquidity Sweep',          tag: 'Smart Money', category: 'smc',      subtitle: 'Stop-hunt & sweep detector',      tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         requiredInputs: ['symbol', 'timeframe'] },
  // C â€“ Advanced Math
  { name: 'Fibonacci Matrix',         tag: 'Quant',       category: 'math',     subtitle: 'ظ…طµظپظˆظپط© ظپظٹط¨ظˆظ†ط§طھط´ظٹ â€” طھظ‚ط§ط·ط¹ ط§ظ„ط²ظ…ظ† ظˆط§ظ„ط³ط¹ط±', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: [] },
  { name: 'Monte Carlo',              tag: 'Quant',       category: 'math',     subtitle: '1000-iteration price projection',  tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'price_start', 'price_end', 'period'] },
  { name: 'GARCH',                    tag: 'Quant',       category: 'math',     subtitle: 'Volatility forecasting bands',     tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Markov Model (HMM)',       tag: 'Quant',       category: 'math',     subtitle: 'Market regime classifier',         tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Fourier Transform',        tag: 'Quant',       category: 'math',     subtitle: 'Cycle & time period detection',    tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Linear Regression',        tag: 'Quant',       category: 'math',     subtitle: 'Fair value & channel estimation',  tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: ['symbol', 'price_start', 'price_end', 'direction'] },
  { name: 'Elliott Wave (EWA)',        tag: 'EWA',         category: 'math',     subtitle: 'Quantitative 5-wave MTF engine',   tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',   requiredInputs: ['symbol', 'timeframe'] },
  { name: 'Gann Time Wheel',          tag: 'Cycles',      category: 'math',     subtitle: 'W.D. Gann Annual Time Cycles',    tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  { name: 'Gann 144 Star',            tag: 'Gann 144',    category: 'math',     subtitle: 'طھط±ط¨ظٹط¹ ط§ظ„ط²ظ…ظ† ظˆط§ظ„ط³ط¹ط± â€” ط¹ط§ظ…ظ„ ظ،ظ¤ظ¤',  tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  { name: 'SQ9 - Square of Nine',     tag: 'Gann SQ9',    category: 'math',     subtitle: 'ط­ط§ط³ط¨ط© ط¬ط§ظ† ظ„ظ„طھط±ط¨ظٹط¹ ط§ظ„ط²ظ…ظ†ظٹ ظˆط§ظ„ط³ط¹ط±ظٹ', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  // D â€“ Momentum & Signals
  { name: 'Momentum Intelligence',    tag: 'Kinetic',     category: 'momentum', subtitle: 'ط°ظƒط§ط، ط§ظ„ط²ط®ظ… â€” ط¯ظ…ط¬ RSI ظˆ MACD ظˆ Stochastic', tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20', requiredInputs: [] },
  { name: 'Divergence Scanner',       tag: 'Momentum',    category: 'momentum', subtitle: 'RSI & MACD hidden/regular div',   tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Trading VIP 1',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: [] },
  { name: 'Trading VIP 2',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: [] },
  { name: 'Trading VIP 3',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: [] },
  { name: 'Trading VIP 4',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'Trading VIP 5',            tag: 'Momentum',    category: 'momentum', subtitle: 'Multi-indicator consensus engine', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'EMA Ribbon',               tag: 'Trend',       category: 'momentum', subtitle: 'ط´ط±ظٹط· ط§ظ„ظ…طھظˆط³ط·ط§طھ â€” ظ‚ظٹط§ط³ ظ‚ظˆط© ط§ظ„ط§طھط¬ط§ظ‡ ط¨ظ€ 8 ظ…طھظˆط³ط·ط§طھ', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: [] },
  { name: 'Trend Compass',            tag: 'Trend',       category: 'momentum', subtitle: 'ط¨ظˆطµظ„ط© ط§ظ„ط§طھط¬ط§ظ‡ â€” طھط­ظ„ظٹظ„ ظ…ظˆط­ط¯ ط¹ط¨ط± 5 ظ…ط¤ط´ط±ط§طھ ظƒظ„ط§ط³ظٹظƒظٹط©', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  { name: 'Matrix 4x4',                 tag: 'Confluence',  category: 'momentum', subtitle: 'ظ…طµظپظˆظپط© ط§ظ„طھظˆط§ظپظ‚ â€” 4 ظ…ط¤ط´ط±ط§طھ ط¹ط¨ط± 4 ط¥ط·ط§ط±ط§طھ',  tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', requiredInputs: [] },
  { name: 'Triple Lens',              tag: 'Multifactor', category: 'momentum', subtitle: 'ط§ظ„ط¹ط¯ط³ط© ط§ظ„ط«ظ„ط§ط«ظٹط© â€” Ichimoku / BB / Volume', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: [] },
  { name: 'Unified Decision - 6 Tools', tag: 'Consensus',   category: 'momentum', subtitle: 'ط§ظ„ظ‚ط±ط§ط± ط§ظ„ظ…ظˆط­ط¯ â€” 6 ظ…ط¤ط´ط±ط§طھ ظ…ط¬ظ…ط¹ط©',  tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', requiredInputs: [] },
  { name: 'CHOP Index',               tag: 'Momentum',    category: 'momentum', subtitle: 'Choppiness vs trend strength',    tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: ['symbol', 'timeframe', 'period'] },
  { name: 'ATR Volatility',           tag: 'Volatility',  category: 'momentum', subtitle: 'ظ…ط­ط±ظƒ ط§ظ„طھظ‚ظ„ط¨ط§طھ â€” ط­ط³ط§ط¨ ط§ظ„ط¥ظٹظ‚ط§ظپ ط§ظ„ط¢ظ…ظ† (ATR)', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', requiredInputs: [] },
  // E â€“ TradingView Widgets
  { name: 'Economic Calendar',        tag: 'Widget',      category: 'widget',   subtitle: 'Macro event calendar',            tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',      requiredInputs: [] },
  { name: 'Heatmap',                  tag: 'Widget',      category: 'widget',   subtitle: 'Crypto market heatmap',           tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',      requiredInputs: [] },
  // F â€“ Informational Dashboards
  { name: 'Live Ticker',              tag: 'Info',        category: 'widget',   subtitle: 'ط§ظ„ط³ط¹ط± ط§ظ„ط­ظٹ â€” ظ…طھط§ط¨ط¹ط© ط¢ظ†ظٹط©',         tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',      requiredInputs: [] },
  { name: 'Fear And Greed',           tag: 'Sentiment',   category: 'widget',   subtitle: 'ظ…ط¤ط´ط± ط§ظ„ط®ظˆظپ ظˆط§ظ„ط·ظ…ط¹',              tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   requiredInputs: [] },
  { name: 'Halving Pulse',            tag: 'Event',       category: 'widget',   subtitle: 'ظ†ط¨ط¶ ط§ظ„ظˆظ‚طھ â€” ط¹ط¯ط§ط¯ ط§ظ„طھظ†طµظٹظپ',        tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',      requiredInputs: [] },
  { name: 'Daily Close Stats',        tag: 'Stats',       category: 'widget',   subtitle: 'ط¥ط­طµط§ط،ط§طھ ط§ظ„ط¥ط؛ظ„ط§ظ‚ ط§ظ„ظٹظˆظ…ظٹ',          tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: [] },
  // G â€“ Order Flow & Liquidity Dashboards
  { name: 'Order Book',               tag: 'Depth',       category: 'widget',   subtitle: 'طھط­ظ„ظٹظ„ ط¯ظپطھط± ط§ظ„ط£ظˆط§ظ…ط±',               tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', requiredInputs: [] },
  { name: 'Volume Delta',             tag: 'Volume',      category: 'widget',   subtitle: 'ظ…ط­ظ„ظ„ ط¯ظ„طھط§ ط§ظ„ط­ط¬ظ…',                tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', requiredInputs: [] },
  { name: 'Footprint Pro',            tag: 'OrderFlow',   category: 'widget',   subtitle: 'ظ…ط­ظ„ظ„ ط¨طµظ…ط© ط§ظ„ط­ط¬ظ…',                tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', requiredInputs: [] },
  { name: 'Liquidity Heatmap',        tag: 'Liquidity',   category: 'widget',   subtitle: 'ط®ط±ظٹط·ط© ط§ظ„ط³ظٹظˆظ„ط©',                  tagColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', requiredInputs: [] },
  // H â€“ Geometry & Fibonacci Dashboards
  { name: 'Price Angle',              tag: 'Geometry',    category: 'math',     subtitle: 'ط­ط§ط³ط¨ط© ط§ظ„ط²ظˆط§ظٹط§ ط§ظ„ط³ط¹ط±ظٹط©',           tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: [] },
  { name: 'Fib Angle Cluster',        tag: 'Geometry',    category: 'math',     subtitle: 'ظپظٹط¨ظˆ + ط²ظˆط§ظٹط§',                   tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: [] },
  { name: 'Fibonacci Circles',        tag: 'Geometry',    category: 'math',     subtitle: 'ط¯ظˆط§ط¦ط± ظپظٹط¨ظˆظ†ط§طھط´ظٹ',                tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: [] },
  { name: 'Fib Spiral',               tag: 'Geometry',    category: 'math',     subtitle: 'ط§ظ„ط­ظ„ط²ظˆظ† ط§ظ„ط°ظ‡ط¨ظٹ',                 tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', requiredInputs: [] },
  // I â€“ Predictive & Trend Dashboards
  { name: 'Trend Probability',        tag: 'Prediction',  category: 'math',     subtitle: 'ط§ط­طھظ…ط§ظ„ظٹط© ط§ظ„ط§طھط¬ط§ظ‡',               tagColor: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20', requiredInputs: [] },
  { name: 'Hidden Candle',            tag: 'Prediction',  category: 'math',     subtitle: 'ط§ظ„ط´ظ…ط¹ط© ط§ظ„ظ…ط®ظپظٹط©',                 tagColor: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20', requiredInputs: [] },
  { name: 'Fractal Detector',         tag: 'Pattern',     category: 'pattern',  subtitle: 'ظƒط§ط´ظپ ط§ظ„ظپط±ط§ظƒطھظ„',                  tagColor: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20', requiredInputs: [] },
  { name: 'Multi-Scale Fractal',      tag: 'Pattern',     category: 'pattern',  subtitle: 'ظپط±ط§ظƒطھظ„ ظ…طھط¹ط¯ط¯ ط§ظ„ط£ط·ط±',             tagColor: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20', requiredInputs: [] },
  // J â€“ Risk & Money Flow Dashboards
  { name: 'Risk Management',          tag: 'Risk',        category: 'math',     subtitle: 'ط¥ط¯ط§ط±ط© ط§ظ„ظ…ط®ط§ط·ط±',                  tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', requiredInputs: [] },
  { name: 'Flow Index',               tag: 'Volume',      category: 'math',     subtitle: 'ظ…ط¤ط´ط± ط§ظ„طھط¯ظپظ‚',                    tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', requiredInputs: [] },
  { name: 'MFI MTF',                  tag: 'Volume',      category: 'math',     subtitle: 'طھط¯ظپظ‚ ط§ظ„ط£ظ…ظˆط§ظ„ ط§ظ„ظ…طھط¹ط¯ط¯',             tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', requiredInputs: [] },
  { name: 'DeMark TD',                tag: 'Pattern',     category: 'pattern',  subtitle: 'ظ†ظ…ظˆط°ط¬ ط§ظ„ط¥ط±ظ‡ط§ظ‚ (TD)',             tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', requiredInputs: [] },
  // K â€“ Macro & Cyclical Dashboards
  { name: 'Macro Network',            tag: 'Macro',       category: 'widget',   subtitle: 'ظ…ط§ظƒط±ظˆ ط§ظ„ط´ط¨ظƒط© ظˆط§ظ„طھط¹ط¯ظٹظ†',            tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  { name: 'Cycle Calculator',         tag: 'Cycles',      category: 'math',     subtitle: 'ط­ط§ط³ط¨ط© ط§ظ„ط¯ظˆط±ط§طھ ظˆط§ظ„ط£ط´ظƒط§ظ„',           tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  { name: 'Periodic Bands',           tag: 'Bands',       category: 'math',     subtitle: 'ط­ط§ط³ط¨ط© ط§ظ„ظ†ط·ط§ظ‚ط§طھ ط§ظ„ط¯ظˆط±ظٹط©',           tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  { name: 'Cycle Confluence',         tag: 'Cycles',      category: 'math',     subtitle: 'طھظˆط§ظپظ‚ ط§ظ„ط¯ظˆط±ط§طھ',                  tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20', requiredInputs: [] },
  // L â€“ MTF & Multi-Analysis Dashboards
  { name: 'MTF Confluence',           tag: 'Confluence',  category: 'pattern',  subtitle: 'طھظˆط§ظپظ‚ ط§ظ„ط£ط·ط± ط§ظ„ظ…طھط¹ط¯ط¯ط©',           tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20', requiredInputs: [] },
  { name: 'Triple Analysis',          tag: 'Confluence',  category: 'pattern',  subtitle: 'ط§ظ„طھط­ظ„ظٹظ„ ط§ظ„ط«ظ„ط§ط«ظٹ',                tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20', requiredInputs: [] },
  { name: 'Confluence Detector',      tag: 'Confluence',  category: 'pattern',  subtitle: 'ظƒط§ط´ظپ ط§ظ„طھظˆط§ظپظ‚',                   tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20', requiredInputs: [] },
  { name: 'MTFC Scanner',             tag: 'Scanner',     category: 'pattern',  subtitle: 'ظ…ط§ط³ط­ ط§ظ„طھظ‚ط§ط، ط§ظ„ط£ط·ط±',                tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20', requiredInputs: [] },
  // M â€“ Advanced Institutional & Gann
  { name: 'Wyckoff Map',              tag: 'Pattern',     category: 'pattern',  subtitle: 'ط®ط±ظٹط·ط© ظˆط§ظٹظƒظˆظپ',                   tagColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', requiredInputs: [] },
  { name: 'Gann Squaring',            tag: 'Geometry',    category: 'math',     subtitle: 'ظƒط§ط´ظپ طھط±ط¨ظٹط¹ ط§ظ„ط³ط¹ط± ظˆط§ظ„ط²ظ…ظ†',         tagColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', requiredInputs: [] },
  { name: 'Power of 3',               tag: 'Pattern',     category: 'pattern',  subtitle: 'ط§ظ„طھط¬ظ…ظٹط¹ ط§ظ„ط«ظ„ط§ط«ظٹ',                tagColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', requiredInputs: [] },
  { name: 'LSM Strategy',             tag: 'Pattern',     category: 'pattern',  subtitle: 'ظƒط§ط´ظپ ط§ظ„ط§ط®طھط±ط§ظ‚',                  tagColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', requiredInputs: [] },
];

// â”€â”€â”€ Mock Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ScanResult { [key: string]: string | number | boolean }

/** @deprecated Dead code â€” all 25 tools run live Binance algorithms via handleScan(). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function simulateScan(toolName: string, symbol: string, timeframe: string): ScanResult {
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1) + timeframe.length;
  const bull = seed % 2 === 0;
  const price = 103_240 + (seed * 137) % 5000;

  switch (true) {
    // Pattern Recognition
    case toolName === 'Wedge Scanner':
      return { pattern: bull ? 'Falling Wedge âœ“' : 'Rising Wedge âœ“', direction: bull ? 'BULLISH BREAKOUT' : 'BEARISH BREAKDOWN', confidence: `${72 + seed % 20}%`, neckline: `$${(price - 1200).toLocaleString()}`, target: `$${(price + 3400).toLocaleString()}`, stopLoss: `$${(price - 2100).toLocaleString()}` };
    case toolName === 'Double Pattern':
      return { pattern: bull ? 'Double Bottom âœ“' : 'Double Top âœ“', direction: bull ? 'BULLISH REVERSAL' : 'BEARISH REVERSAL', confidence: `${68 + seed % 22}%`, neckline: `$${(price - 800).toLocaleString()}`, target: `$${(price + 4100).toLocaleString()}`, stopLoss: `$${(price - 1600).toLocaleString()}` };
    case toolName === 'Cup & Handle':
      return { pattern: 'Cup & Handle âœ“', direction: 'BULLISH CONTINUATION', confidence: `${75 + seed % 18}%`, cupDepth: `${18 + seed % 10}%`, handleDepth: `${6 + seed % 5}%`, target: `$${(price + 5200).toLocaleString()}` };
    case toolName === 'Head & Shoulders':
      return { pattern: bull ? 'Inverse H&S âœ“' : 'Head & Shoulders âœ“', direction: bull ? 'BULLISH' : 'BEARISH', confidence: `${70 + seed % 20}%`, leftShoulder: `$${(price - 2000).toLocaleString()}`, head: `$${(price + 1500).toLocaleString()}`, rightShoulder: `$${(price - 1800).toLocaleString()}`, neckline: `$${(price - 600).toLocaleString()}` };
    case toolName === 'Triangle Predictor':
      return { pattern: ['Symmetrical', 'Ascending', 'Descending'][seed % 3] + ' Triangle âœ“', direction: bull ? 'BULLISH BREAKOUT' : 'BEARISH BREAKDOWN', confidence: `${65 + seed % 25}%`, apex: `${3 + seed % 5} candles`, target: `$${(price + 2800).toLocaleString()}` };

    // SMC
    case toolName === 'SMC Order Blocks':
      return { bias: bull ? 'BULLISH' : 'BEARISH', bullishOB: `$${(price - 1500).toLocaleString()} â€“ $${(price - 900).toLocaleString()}`, bearishOB: `$${(price + 1800).toLocaleString()} â€“ $${(price + 2600).toLocaleString()}`, mitigated: bull ? 'No' : 'Yes', premium: `$${(price + 1200).toLocaleString()}`, discount: `$${(price - 1100).toLocaleString()}` };
    case toolName === 'Market Structure':
      return { regime: bull ? 'UPTREND' : 'DOWNTREND', lastEvent: bull ? 'Break of Structure (BOS) â†‘' : 'Change of Character (CHoCH) â†“', swing_high: `$${(price + 2100).toLocaleString()}`, swing_low: `$${(price - 1800).toLocaleString()}`, trend_bias: bull ? 'BULLISH' : 'BEARISH', confirmation: bull ? 'Strong' : 'Weak' };
    case toolName === 'Wyckoff':
      return { phase: ['Accumulation â€” Phase C', 'Distribution â€” Phase B', 'Markup', 'Markdown'][seed % 4], bias: bull ? 'BULLISH' : 'BEARISH', spring: bull ? 'Detected âœ“' : 'Not Detected', upthrust: bull ? 'Not Detected' : 'Detected âœ“', composite_man: bull ? 'Accumulating' : 'Distributing' };
    case toolName === 'Order Flow CDD':
      return { delta: bull ? `+${12400 + seed % 5000}` : `-${11200 + seed % 4000}`, divergence: bull ? 'Bullish CDD âœ“' : 'Bearish CDD âœ“', strength: `${60 + seed % 30}%`, buy_vol: `${(seed * 41) % 9000 + 8000} BTC`, sell_vol: `${(seed * 37) % 9000 + 7000} BTC` };
    case toolName === 'Liquidity Sweep':
      return { event: bull ? 'Buy-side Liquidity Grab âœ“' : 'Sell-side Liquidity Grab âœ“', swept_level: `$${(price + (bull ? 800 : -800)).toLocaleString()}`, reversal_zone: `$${(price + (bull ? -400 : 400)).toLocaleString()}`, probability: `${62 + seed % 28}%`, volume_spike: `${150 + seed % 80}%` };

    // Math / Quant
    case toolName === 'Monte Carlo':
      return { iterations: '1,000', timeframe, median: `$${price.toLocaleString()}`, high_95: `$${(price + 8200 + seed % 2000).toLocaleString()}`, low_95: `$${(price - 7100 - seed % 1500).toLocaleString()}`, upside_prob: `${45 + seed % 20}%`, sigma: `${2.1 + (seed % 10) / 10}` };
    case toolName === 'GARCH':
      return { model: 'GARCH(1,1)', annualized_vol: `${42 + seed % 20}%`, upper_band: `$${(price + 5400).toLocaleString()}`, lower_band: `$${(price - 4900).toLocaleString()}`, vix_equiv: `${38 + seed % 15}`, regime: seed % 2 === 0 ? 'HIGH VOLATILITY' : 'MODERATE VOLATILITY' };
    case toolName === 'Markov Model (HMM)':
      return { regime: ['TRENDING â†—', 'RANGING â†”', 'BREAKOUT PENDING âڑ،'][seed % 3], confidence: `${70 + seed % 22}%`, state_duration: `${4 + seed % 10} candles`, transition_prob: `${seed % 2 === 0 ? 'Trend â†’ Range' : 'Range â†’ Trend'}: ${35 + seed % 30}%` };
    case toolName === 'Fourier Transform':
      return { dominant_cycle: `${14 + seed % 10} candles`, secondary_cycle: `${28 + seed % 14} candles`, next_peak: `${3 + seed % 5} candles`, next_trough: `${8 + seed % 6} candles`, cycle_strength: `${55 + seed % 35}%` };
    case toolName === 'Linear Regression':
      return { fair_value: `$${price.toLocaleString()}`, upper_channel: `$${(price + 3100).toLocaleString()}`, lower_channel: `$${(price - 2900).toLocaleString()}`, slope: bull ? '+' + (0.12 + (seed % 10) / 100).toFixed(2) : '-' + (0.08 + (seed % 8) / 100).toFixed(2), r_squared: (0.72 + (seed % 20) / 100).toFixed(3), deviation: `${1.8 + (seed % 12) / 10}%` };

    // Momentum
    case toolName === 'Divergence Scanner': {
      const type = ['Regular Bullish', 'Regular Bearish', 'Hidden Bullish', 'Hidden Bearish'][seed % 4];
      return { rsi_div: type + ' RSI Divergence âœ“', macd_div: seed % 3 === 0 ? 'Hidden Bearish MACD âœ“' : 'Not Detected', strength: `${65 + seed % 25}%`, direction: type.includes('Bullish') ? 'BULLISH' : 'BEARISH' };
    }
    case /^Trading VIP/.test(toolName): {
      const vipNum = parseInt(toolName.slice(-1)) || 1;
      const score = 50 + (seed * vipNum) % 40;
      return { consensus: score >= 70 ? 'STRONG BUY ًںں¢' : score >= 55 ? 'BUY ًںں،' : score <= 30 ? 'STRONG SELL ًں”´' : 'NEUTRAL âڑھ', score: `${score}/100`, rsi: `${35 + seed % 35}`, macd: bull ? 'Bullish Cross âœ“' : 'Bearish Cross âœ—', ema: bull ? 'Price > EMA200 âœ“' : 'Price < EMA200 âœ—', bb: ['Upper', 'Middle', 'Lower'][seed % 3] + ' Band', adx: `${20 + seed % 30}` };
    }
    case toolName === '4x4 Confluence': {
      const tfs = ['15m','1H','4H','1D'];
      const signals = tfs.map((tf, i) => ({ tf, signal: (seed + i) % 2 === 0 ? 'ًںں¢ BULL' : 'ًں”´ BEAR' }));
      const bullCount = signals.filter(s => s.signal.includes('BULL')).length;
      return { overall: bullCount >= 3 ? 'STRONG BULLISH âœ“' : bullCount <= 1 ? 'STRONG BEARISH âœ—' : 'MIXED âڑ ', score: `${bullCount * 25}%`, ...Object.fromEntries(signals.map(s => [s.tf, s.signal])) };
    }
    case toolName === 'CHOP Index': {
      const chop = 45 + seed % 40;
      return { chop_value: chop.toFixed(2), regime: chop > 61.8 ? 'CHOPPY / RANGING â†”' : 'TRENDING â†—', strength: chop > 61.8 ? 'Avoid momentum trades' : 'Trend-following favored', threshold: '61.8', percentile: `${30 + seed % 50}th` };
    }

    default:
      return { status: 'COMPLETE', symbol, timeframe, result: 'Analysis complete' };
  }
}

// â”€â”€â”€ Result Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ResultCard({ result, tool }: { result: ScanResult; tool: ToolDef }) {
  const isBull = JSON.stringify(result).toUpperCase().includes('BULL');
  const isBear = JSON.stringify(result).toUpperCase().includes('BEAR');
  const accent = isBull ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : isBear ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-orange-500/30 bg-orange-500/[0.04]';
  const dotColor = isBull ? 'bg-emerald-500' : isBear ? 'bg-red-500' : 'bg-orange-500';

  return (
    <div className={`rounded-2xl border p-6 space-y-3 ${accent}`}>
      <div className="flex items-center gap-3 mb-1">
        <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
        <span className="text-sm font-bold uppercase tracking-widest text-white/40">Scan Complete â€” {tool.name}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(result).map(([k, v]) => (
          <div key={k} className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
            <p className="text-sm uppercase tracking-widest text-white/30 mb-1">{k.replace(/_/g, ' ')}</p>
            <p className={`text-lg font-mono font-bold tabular-nums leading-tight ${
              String(v).includes('BULL') || String(v).includes('BUY') || String(v).includes('âœ“') ? 'text-emerald-400'
              : String(v).includes('BEAR') || String(v).includes('SELL') || String(v).includes('âœ—') ? 'text-red-400'
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

// â”€â”€â”€ Widget Views â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Main Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Props {
  tool:            ToolDef;
  onClose:         () => void;
  onScanComplete?: (symbol: string, timeframe: string, summary: string) => void;
  /**
   * pageMode â€” when true, renders body content only (no NativeSheet, no backdrop,
   * no internal header). Use this on /tools/[slug] page where ToolPageHeader
   * provides the navigation header.
   */
  pageMode?: boolean;
}

// â”€â”€â”€ Input field meta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const INPUT_META: Record<InputType, { label: string; placeholder?: string; type: 'text' | 'number' | 'select' }> = {
  symbol:      { label: 'Symbol',      placeholder: 'BTCUSDT', type: 'text'   },
  timeframe:   { label: 'Timeframe',                           type: 'select' },
  price_start: { label: 'Start Price', placeholder: '100000',  type: 'number' },
  price_end:   { label: 'End Price',   placeholder: '110000',  type: 'number' },
  period:      { label: 'Period',      placeholder: '14',      type: 'number' },
  direction:   { label: 'Direction',                           type: 'select' },
};

export function UnifiedScannerModal({ tool, onClose, onScanComplete, pageMode = false }: Props) {
  const [symbol,     setSymbol]     = useState('BTCUSDT');
  const [timeframe,  setTimeframe]  = useState('1H');
  const [priceStart, setPriceStart] = useState('');
  const [priceEnd,   setPriceEnd]   = useState('');
  const [period,     setPeriod]     = useState('14');
  const [direction,  setDirection]  = useState('Bullish â†‘');
  const [phase,            setPhase]           = useState<'idle' | 'scanning' | 'done'>('idle');
  const [result,           setResult]          = useState<ScanResult    | null>(null);
  const [smcResult,        setSmcResult]       = useState<SMCResult     | null>(null);
  const [garchResult,      setGarchResult]     = useState<GarchResult   | null>(null);
  const [wedgeResult,      setWedgeResult]     = useState<PatternResult | null>(null);
  const [rsiResult,        setRsiResult]       = useState<RSIResult     | null>(null);
  const [macdResult,       setMacdResult]      = useState<MACDResult    | null>(null);
  const [bollingerResult,  setBollingerResult] = useState<BollingerResult|null>(null);
  const [fvgResult,        setFvgResult]       = useState<FVGResult     | null>(null);
  const [sweepResult,      setSweepResult]     = useState<SweepResult   | null>(null);
  const [cvdResult,        setCvdResult]       = useState<CVDResult     | null>(null);
  const [mcResult,         setMcResult]        = useState<MonteCarloResult      | null>(null);
  const [lrResult,         setLrResult]        = useState<LinearRegressionResult| null>(null);
  const [markovResult,     setMarkovResult]    = useState<MarkovResult           | null>(null);
  const [fourierResult,    setFourierResult]   = useState<FourierResult          | null>(null);
  const [doubleResult,     setDoubleResult]    = useState<DoublePatternResult | null>(null);
  const [cupResult,        setCupResult]       = useState<CupHandleResult     | null>(null);
  const [hsResult,         setHsResult]        = useState<HSResult            | null>(null);
  const [triangleResult,   setTriangleResult]  = useState<TriangleResult      | null>(null);
  const [msResult,         setMsResult]        = useState<MarketStructureResult| null>(null);
  const [wyckoffResult,    setWyckoffResult]   = useState<WyckoffResult        | null>(null);
  const [ewaResult,        setEwaResult]       = useState<EWAResult             | null>(null);
  const [fetchErr,         setFetchErr]        = useState<string | null>(null);

  // â”€â”€ Stable memoized values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const isWidget = useMemo(() => tool.category === 'widget', [tool.category]);

  // â”€â”€ Stable input handlers â€” prevent child re-renders on every keystroke â”€â”€â”€â”€
  const onSymbolChange    = useCallback((e: React.ChangeEvent<HTMLInputElement>)  => setSymbol(e.target.value.toUpperCase()), []);
  const onTfChange        = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setTimeframe(e.target.value), []);
  const onDirChange       = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setDirection(e.target.value), []);
  const onPriceStartChange= useCallback((e: React.ChangeEvent<HTMLInputElement>)  => setPriceStart(e.target.value), []);
  const onPriceEndChange  = useCallback((e: React.ChangeEvent<HTMLInputElement>)  => setPriceEnd(e.target.value), []);
  const onPeriodChange    = useCallback((e: React.ChangeEvent<HTMLInputElement>)  => setPeriod(e.target.value), []);

  // â”€â”€ Notify parent after every completed scan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (phase !== 'done' || !onScanComplete) return;
    // Build a 1-line summary from whichever result state is set
    let summary = '';
    if (smcResult)      summary = `${smcResult.verdict} â€” ط§طھط¬ط§ظ‡: ${smcResult.verdict}`;
    if (garchResult)    summary = `ط­ط§ظ„ط©: ${garchResult.state} â€” ظ†ط·ط§ظ‚: ${garchResult.lowerBound}â€“${garchResult.upperBound}`;
    if (wedgeResult)    summary = wedgeResult.detected ? `${wedgeResult.type} â€” ط§ط®طھط±ط§ظ‚ ظ…ط­طھظ…ظ„` : 'ظ„ظ… ظٹظڈط±طµط¯ ظ†ظ…ظˆط°ط¬ ط¥ط³ظپظٹظ†';
    if (rsiResult)      summary = `RSI: ${rsiResult.value.toFixed(1)} â€” ${rsiResult.state}`;
    if (macdResult)     summary = `MACD: ${macdResult.state} â€” ظ‡ظٹط³طھظˆط؛ط±ط§ظ…: ${macdResult.histogram.toFixed(4)}`;
    if (bollingerResult)summary = `BB: ${bollingerResult.state} â€” ط¹ط±ط¶: ${bollingerResult.bandwidth.toFixed(4)}`;
    if (fvgResult)      summary = fvgResult.detected ? `${fvgResult.type} FVG ط¹ظ†ط¯ ${fvgResult.top}â€“${fvgResult.bottom}` : 'ظ„ظ… ظٹظڈط±طµط¯ FVG';
    if (sweepResult)    summary = sweepResult.swept ? `${sweepResult.type} â€” ظ…ط³طھظˆظ‰: ${sweepResult.sweepLevel}` : 'ظ„ط§ ظٹظˆط¬ط¯ ط§ط®طھط·ط§ظپ ط³ظٹظˆظ„ط©';
    if (cvdResult)      summary = cvdResult.verdict;
    if (mcResult)       summary = `MC: ${mcResult.verdict} â€” ظ†ط·ط§ظ‚: ${mcResult.projectedLow}â€“${mcResult.projectedHigh}`;
    if (lrResult)       summary = lrResult.verdict;
    if (markovResult)   summary = markovResult.verdict;
    if (fourierResult)  summary = fourierResult.verdict;
    if (doubleResult)   summary = doubleResult.verdict;
    if (cupResult)      summary = cupResult.verdict;
    if (hsResult)       summary = hsResult.verdict;
    if (triangleResult) summary = triangleResult.verdict;
    if (msResult)       summary = msResult.verdict;
    if (wyckoffResult)  summary = `ظ…ط±ط­ظ„ط©: ${wyckoffResult.phaseAr} â€” ط«ظ‚ط©: ${wyckoffResult.confidence}%`;
    if (ewaResult && !ewaResult.error) summary = `EWA: ${ewaResult.pattern_name_ar} â€” ط«ظ‚ط©: ${ewaResult.scoring_matrix.confidence_pct}%`;
    if (summary) onScanComplete(symbol, timeframe, summary);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Map input key â†’ current value (for simulateScan passthrough)
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
    setRsiResult(null);
    setMacdResult(null);
    setBollingerResult(null);
    setFvgResult(null);
    setSweepResult(null);
    setCvdResult(null);
    setMcResult(null);
    setLrResult(null);
    setMarkovResult(null);
    setFourierResult(null);
    setDoubleResult(null);
    setCupResult(null);
    setHsResult(null);
    setTriangleResult(null);
    setMsResult(null);
    setWyckoffResult(null);
    setEwaResult(null);
    setFetchErr(null);

    if (!isWidget) {
      try {
        // â”€â”€ SMC Order Blocks â€” 300 candles â†’ full OB algorithm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (tool.name === 'SMC Order Blocks') {
          const klines = await fetchKlines(symbol, timeframe, 300);
          console.info(`[SMC] âœ“ ${symbol} ${timeframe} â€” last close: $${klines[klines.length-1]?.close.toLocaleString()}`);
          setSmcResult(calculateSMC(klines, symbol));
          setPhase('done');
          return;
        }

        // â”€â”€ GARCH â€” 100 candles â†’ volatility band algorithm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (tool.name === 'GARCH') {
          const klines = await fetchKlines(symbol, timeframe, 100);
          console.info(`[GARCH] âœ“ ${symbol} ${timeframe} â€” last close: $${klines[klines.length-1]?.close.toLocaleString()}`);
          const barsPerYear: Record<string, number> = { '15m': 365*24*4, '1H': 365*24, '4H': 365*6, '1D': 365 };
          setGarchResult(calculateGARCH(klines, barsPerYear[timeframe] ?? 365*24));
          setPhase('done');
          return;
        }

        // â”€â”€ Wedge Scanner â€” 400 candles on 4H â†’ pivot regression â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (tool.name === 'Wedge Scanner') {
          const klines = await fetchKlines(symbol, '4h', 400);
          console.info(`[Wedge] âœ“ ${symbol} 4H â€” ${klines.length} candles`);
          setWedgeResult(detectWedge(klines));
          setPhase('done');
          return;
        }

        // â”€â”€ Momentum Batch â€” 100 candles â†’ RSI / MACD / Bollinger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (tool.name === 'Divergence Scanner') {
          const klines = await fetchKlines(symbol, timeframe, 100);
          console.info(`[RSI] âœ“ ${symbol} ${timeframe}`);
          setRsiResult(analyzeRSI(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'CHOP Index') {
          const klines = await fetchKlines(symbol, timeframe, 100);
          // Bollinger bandwidth is the canonical choppiness proxy:
          // high BW = trending market, low BW = choppy/ranging market.
          console.info(`[Choppiness/BB] âœ“ ${symbol} ${timeframe}`);
          setBollingerResult(analyzeBollinger(klines));
          setPhase('done');
          return;
        }
        if (tool.name === '4x4 Confluence') {
          const klines = await fetchKlines(symbol, timeframe, 100);
          // MACD provides the directional momentum bias â€” primary confluence signal.
          console.info(`[MACD/Confluence] âœ“ ${symbol} ${timeframe}`);
          setMacdResult(analyzeMACD(klines));
          setPhase('done');
          return;
        }

        // â”€â”€ Order Flow Batch â€” 150 candles â†’ FVG / Sweep / CVD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (tool.name === 'FVG Scanner') {
          const klines = await fetchKlines(symbol, timeframe, 150);
          console.info(`[FVG] âœ“ ${symbol} ${timeframe}`);
          setFvgResult(analyzeFVG(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Liquidity Sweep') {
          const klines = await fetchKlines(symbol, timeframe, 150);
          console.info(`[Sweep] âœ“ ${symbol} ${timeframe}`);
          setSweepResult(analyzeLiquiditySweep(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Order Flow CDD') {
          const klines = await fetchKlines(symbol, timeframe, 150);
          console.info(`[CVD] âœ“ ${symbol} ${timeframe}`);
          setCvdResult(analyzeCVDProxy(klines));
          setPhase('done');
          return;
        }

        // â”€â”€ Advanced Quant Batch 3 â€” 200â€“300 candles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (tool.name === 'Monte Carlo') {
          const klines = await fetchKlines(symbol, timeframe, 200);
          console.info(`[MC] âœ“ ${symbol} ${timeframe}`);
          setMcResult(analyzeMonteCarlo(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Linear Regression') {
          const klines = await fetchKlines(symbol, timeframe, 300);
          console.info(`[LR] âœ“ ${symbol} ${timeframe}`);
          setLrResult(analyzeLinearRegression(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Markov Model (HMM)') {
          const klines = await fetchKlines(symbol, timeframe, 300);
          console.info(`[Markov] âœ“ ${symbol} ${timeframe}`);
          setMarkovResult(analyzeMarkovModel(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Fourier Transform') {
          const klines = await fetchKlines(symbol, timeframe, 300);
          console.info(`[Fourier] âœ“ ${symbol} ${timeframe}`);
          setFourierResult(analyzeFourier(klines));
          setPhase('done');
          return;
        }

        // â”€â”€ Classic Pattern Batch 4 â€” 300 candles on 4H â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (tool.name === 'Double Pattern') {
          const klines = await fetchKlines(symbol, '4h', 300);
          console.info(`[Double] âœ“ ${symbol} 4H`);
          setDoubleResult(detectDoublePattern(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Cup & Handle') {
          const klines = await fetchKlines(symbol, '4h', 300);
          console.info(`[Cup] âœ“ ${symbol} 4H`);
          setCupResult(detectCupHandle(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Head & Shoulders') {
          const klines = await fetchKlines(symbol, '4h', 300);
          console.info(`[H&S] âœ“ ${symbol} 4H`);
          setHsResult(detectHeadShoulders(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Triangle Predictor') {
          const klines = await fetchKlines(symbol, '4h', 300);
          console.info(`[Triangle] âœ“ ${symbol} 4H`);
          setTriangleResult(detectTriangle(klines));
          setPhase('done');
          return;
        }
        if (tool.name === 'Market Structure') {
          const klines = await fetchKlines(symbol, timeframe, 150);
          console.info(`[MS] âœ“ ${symbol} ${timeframe}`);
          setMsResult(analyzeMarketStructure(klines));
          setPhase('done');
          return;
        }

        // â”€â”€ Wyckoff â€” 500 candles â†’ effort / volatility / phase classification â”€â”€â”€
        if (tool.name === 'Wyckoff') {
          const klines = await fetchKlines(symbol, timeframe, 500);
          console.info(`[Wyckoff] âœ“ ${symbol} ${timeframe} â€” ${klines.length} candles`);
          setWyckoffResult(analyzeWyckoff(klines));
          setPhase('done');
          return;
        }

        // â”€â”€ Elliott Wave (EWA) â€” Python service fetches OHLCV from Bybit/OKX internally â”€â”€
        if (tool.name === 'Elliott Wave (EWA)') {
          const initData = (window as any)?.Telegram?.WebApp?.initData ?? '';
          if (!initData) throw new Error('Telegram initData ط؛ظٹط± ظ…طھط§ط­. ط§ظپطھط­ ط§ظ„طھط·ط¨ظٹظ‚ ط¯ط§ط®ظ„ طھظٹظ„ظٹط؛ط±ط§ظ….');
          // Map UI timeframe (1H/4H/1D) to engine format (1h/4h/1d)
          const macro_tf = timeframe.toLowerCase() === '1h' ? '4h'
                         : timeframe.toLowerCase() === '4h' ? '1d'
                         : '1d';
          const micro_tf = timeframe.toLowerCase() === '1h' ? '1h'
                         : timeframe.toLowerCase() === '4h' ? '4h'
                         : '4h';
          console.info(`[EWA] âœ“ ${symbol} macro=${macro_tf} micro=${micro_tf} | data: Bybit/OKX`);
          const res = await fetch('/api/ewa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              init_data: initData,
              symbol: symbol.toUpperCase(),
              macro_tf,
              micro_tf,
              // No OHLCV bars â€” Python fetches directly from Bybit/OKX
            }),
          });
          const json: EWAResult = await res.json();
          if (!res.ok || json.error) {
            throw new Error(json.error ?? `EWA API error ${res.status}`);
          }
          setEwaResult(json);
          setPhase('done');
          return;
        }

        // â”€â”€ No handler matched â€” throw immediately so missing tools surface during dev â”€â”€
        throw new Error(`ظ„ط§ ظٹظˆط¬ط¯ ظ…ط­ظ„ظ„ ظ…ظڈطھط§ط­ ظ„ط£ط¯ط§ط©: "${tool.name}". ط£ط¶ظپ handler ظپظٹ handleScan().`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown fetch error';
        setFetchErr(msg);
        setPhase('idle');
        return;
      }
    }

    // All tools are now live â€” no mock fallback needed
  }

  // â”€â”€ Shared body JSX (used in both modal and page mode) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const bodyContent = (
    <div
      className="overflow-y-auto flex-1 px-5 pt-4 pb-8 space-y-4 overscroll-contain"
      style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0.5rem))' }}
    >

          {/* Widget-only view */}
          {isWidget && (
            tool.name === 'Economic Calendar' ? <EconomicCalendarWidget /> : <HeatmapWidget />
          )}

          {/* VIP tools â€” self-contained card with its own fetch trigger */}
          {!isWidget && /^Trading VIP/.test(tool.name) && (
            <VIPResultCard symbol={symbol} />
          )}

          {/* All other non-widget tools â€” standard inputs + scan button */}
          {!isWidget && !/^Trading VIP/.test(tool.name) && (
            <>
              {/* Tag + category strip */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-sm font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${tool.tagColor}`}>{tool.tag}</span>
                <BarChart2 className="w-3.5 h-3.5 text-white/20" />
                <span className="text-sm text-white/30 font-mono">
                  {tool.requiredInputs.map(k => getInputValue(k)).filter(Boolean).join(' آ· ')}
                </span>
              </div>

              {/* Dynamic inputs â€” grid auto-adjusts: 1 input â†’ full width, 2+ â†’ 2-col */}
              <div className={`grid gap-3 ${tool.requiredInputs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {tool.requiredInputs.map((key) => {
                  const meta = INPUT_META[key];
                  // py-4 = ~48px total height, satisfies 44px min touch target
                  const inputClass = "w-full px-3 py-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono text-lg focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-white/20 tabular-nums";

                  if (meta.type === 'select' && key === 'timeframe') return (
                    <div key={key}>
                      <label className="text-sm text-white/30 uppercase tracking-widest block mb-2">{meta.label}</label>
                      <select value={timeframe} onChange={onTfChange}
                        className={inputClass + ' appearance-none cursor-pointer'}>
                        {['15m','1H','4H','1D'].map(tf => <option key={tf} value={tf} className="bg-zinc-900">{tf}</option>)}
                      </select>
                    </div>
                  );

                  if (meta.type === 'select' && key === 'direction') return (
                    <div key={key}>
                      <label className="text-sm text-white/30 uppercase tracking-widest block mb-2">{meta.label}</label>
                      <select value={direction} onChange={onDirChange}
                        className={inputClass + ' appearance-none cursor-pointer'}>
                        {['Bullish â†‘','Bearish â†“'].map(d => <option key={d} value={d} className="bg-zinc-900">{d}</option>)}
                      </select>
                    </div>
                  );

                  if (key === 'symbol') return (
                    <div key={key}>
                      <label className="text-sm text-white/30 uppercase tracking-widest block mb-2">{meta.label}</label>
                      <input value={symbol} onChange={onSymbolChange}
                        className={inputClass} placeholder={meta.placeholder}
                        autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
                    </div>
                  );

                  if (key === 'price_start') return (
                    <div key={key}>
                      <label className="text-sm text-white/30 uppercase tracking-widest block mb-2">{meta.label}</label>
                      <input type="number" inputMode="decimal" value={priceStart} onChange={onPriceStartChange}
                        className={inputClass} placeholder={meta.placeholder} />
                    </div>
                  );

                  if (key === 'price_end') return (
                    <div key={key}>
                      <label className="text-sm text-white/30 uppercase tracking-widest block mb-2">{meta.label}</label>
                      <input type="number" inputMode="decimal" value={priceEnd} onChange={onPriceEndChange}
                        className={inputClass} placeholder={meta.placeholder} />
                    </div>
                  );

                  if (key === 'period') return (
                    <div key={key}>
                      <label className="text-sm text-white/30 uppercase tracking-widest block mb-2">{meta.label}</label>
                      <input type="number" inputMode="numeric" value={period} onChange={onPeriodChange}
                        className={inputClass} placeholder={meta.placeholder} min="1" max="200" />
                    </div>
                  );

                  return null;
                })}
              </div>

              {/* Error toast */}
              {fetchErr && (
                <div
                  className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-red-500/30 bg-red-500/[0.07]"
                  style={{ animation: 'slide-up 0.25s cubic-bezier(0.16,1,0.3,1) forwards' }}
                >
                  <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-base font-bold text-red-400 uppercase tracking-wider">Fetch Error</p>
                    <p className="text-sm text-red-300/80 mt-0.5 leading-snug">{fetchErr}</p>
                  </div>
                </div>
              )}

              {/* Scan Button â€” min-h-[52px] ensures 44px+ touch target on all devices */}
              <button
                onClick={handleScan}
                disabled={phase === 'scanning'}
                className="w-full min-h-[52px] rounded-2xl font-bold text-lg tracking-wider transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
                style={{
                  background: phase === 'scanning'
                    ? 'linear-gradient(135deg, #92400e, #78350f)'
                    : 'linear-gradient(135deg, #f97316, #ea580c)',
                  boxShadow: phase !== 'scanning' ? '0 0 32px rgba(249,115,22,0.3)' : 'none',
                  color: '#fff',
                }}
              >
                {phase === 'scanning' ? (
                  <span className="flex items-center justify-center gap-3.5 py-4.5">
                    <span className="w-6 h-6 border-2 border-orange-300/40 border-t-orange-200 rounded-full animate-spin" />
                    <span className="animate-pulse tracking-[0.15em] text-lg">ط¬ط§ط±ظچ ط¬ظ„ط¨ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ„ط­ط¸ظٹط©...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center py-4.5 tracking-[0.15em]">âڑ، طھط´ط؛ظٹظ„ ط§ظ„طھط­ظ„ظٹظ„</span>
                )}
              </button>

              {/* Result â€” SMC Order Blocks */}
              {phase === 'done' && smcResult && tool.name === 'SMC Order Blocks' && (
                <SMCResultCard data={smcResult} symbol={symbol} />
              )}

              {/* Result â€” GARCH Volatility */}
              {phase === 'done' && garchResult && tool.name === 'GARCH' && (
                <GarchResultCard data={garchResult} symbol={symbol} />
              )}

              {/* Result â€” Wedge Scanner */}
              {phase === 'done' && wedgeResult && tool.name === 'Wedge Scanner' && (
                <WedgeResultCard data={wedgeResult} symbol={symbol} />
              )}

              {/* Result â€” RSI (Divergence Scanner) */}
              {phase === 'done' && rsiResult && tool.name === 'Divergence Scanner' && (
                <RsiResultCard data={rsiResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Bollinger Bands (CHOP Index â€” BB bandwidth = choppiness proxy) */}
              {phase === 'done' && bollingerResult && tool.name === 'CHOP Index' && (
                <BollingerResultCard data={bollingerResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” MACD (4x4 Confluence â€” directional momentum signal) */}
              {phase === 'done' && macdResult && tool.name === '4x4 Confluence' && (
                <MacdResultCard data={macdResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” FVG Scanner */}
              {phase === 'done' && fvgResult && tool.name === 'FVG Scanner' && (
                <FvgResultCard data={fvgResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Liquidity Sweep */}
              {phase === 'done' && sweepResult && tool.name === 'Liquidity Sweep' && (
                <SweepResultCard data={sweepResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” CVD Proxy (Order Flow CDD) */}
              {phase === 'done' && cvdResult && tool.name === 'Order Flow CDD' && (
                <CvdResultCard data={cvdResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Monte Carlo */}
              {phase === 'done' && mcResult && tool.name === 'Monte Carlo' && (
                <MonteCarloCard data={mcResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Linear Regression */}
              {phase === 'done' && lrResult && tool.name === 'Linear Regression' && (
                <LinearRegressionCard data={lrResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Markov Model */}
              {phase === 'done' && markovResult && tool.name === 'Markov Model (HMM)' && (
                <MarkovCard data={markovResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Fourier Transform */}
              {phase === 'done' && fourierResult && tool.name === 'Fourier Transform' && (
                <FourierCard data={fourierResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Double Pattern */}
              {phase === 'done' && doubleResult && tool.name === 'Double Pattern' && (
                <DoublePatternCard data={doubleResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Cup & Handle */}
              {phase === 'done' && cupResult && tool.name === 'Cup & Handle' && (
                <CupHandleCard data={cupResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Head & Shoulders */}
              {phase === 'done' && hsResult && tool.name === 'Head & Shoulders' && (
                <HeadShouldersCard data={hsResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Triangle Predictor */}
              {phase === 'done' && triangleResult && tool.name === 'Triangle Predictor' && (
                <TriangleCard data={triangleResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Market Structure */}
              {phase === 'done' && msResult && tool.name === 'Market Structure' && (
                <MarketStructureCard data={msResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Wyckoff */}
              {phase === 'done' && wyckoffResult && tool.name === 'Wyckoff' && (
                <WyckoffCard data={wyckoffResult} symbol={symbol} timeframe={timeframe} />
              )}

              {/* Result â€” Elliott Wave Analysis */}
              {phase === 'done' && ewaResult && !ewaResult.error && tool.name === 'Elliott Wave (EWA)' && (
                <EWAResultCard data={ewaResult} symbol={symbol} />
              )}

              {/* EWA error state */}
              {phase === 'done' && ewaResult?.error && tool.name === 'Elliott Wave (EWA)' && (
                <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-red-500/30 bg-red-500/[0.07]">
                  <div>
                    <p className="text-base font-bold text-red-400 uppercase tracking-wider">EWA Engine Error</p>
                    <p className="text-sm text-red-300/80 mt-0.5 leading-snug" dir="rtl">{ewaResult.error}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
  ); // end bodyContent

  // â”€â”€ Page mode: render body only (header provided by ToolPageHeader in route) â”€
  if (pageMode) {
    return bodyContent;
  }

  // â”€â”€ Modal mode: wrap body + internal header in NativeSheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <NativeSheet onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {tool.category === 'widget' ? <Globe className="w-5 h-5 text-orange-500 shrink-0" /> : <Zap className="w-5 h-5 text-orange-500 shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-white font-bold text-lg truncate">{tool.name}</h2>
            <p className="text-sm text-white/35 truncate">{tool.subtitle}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="shrink-0 ml-2 w-11 h-11 flex items-center justify-center text-white/40 hover:text-white bg-white/[0.05] hover:bg-white/10 rounded-full transition-all active:scale-95">
          <X className="w-6 h-6" />
        </button>
      </div>
      {bodyContent}
    </NativeSheet>
  );
}

