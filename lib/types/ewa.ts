/**
 * lib/types/ewa.ts
 *
 * TypeScript type definitions for the EWA (Elliott Wave Analysis) engine.
 * These types mirror the Python EWAResult JSON schema exactly.
 * Used by EWAResultCard.tsx and any component consuming /api/ewa.
 */

// ─── Core Types ────────────────────────────────────────────────────────────────

export type EWADirection   = 'bullish' | 'bearish';
export type EWAPatternType = 'impulse' | 'corrective_abc' | 'zigzag' | 'flat'
                           | 'diagonal_ending' | 'diagonal_leading' | 'triangle';
export type MTFAlignment   = 'full' | 'partial' | 'weak' | 'contradiction';

// ─── Wave Pivot ────────────────────────────────────────────────────────────────

export interface EWAPivot {
  label:      string;      // "0" | "1" | "2" | "3" | "4" | "5" | "A" | "B" | "C"
  timestamp:  number;      // Unix seconds
  price:      number;
  pivot_type: 'peak' | 'valley';
  bar_index:  number;      // Position in OHLCV array (for X-axis mapping)
  prominence: number;      // ATR-normalized significance
}

// ─── Elliott Rules ─────────────────────────────────────────────────────────────

export interface EWARuleResult {
  id:          string;    // "R1" | "R2" | "R3" | "ABC-R1" | "ABC-R2"
  name:        string;
  passed:      boolean;
  detail:      string;
  is_critical: boolean;
}

export interface EWAGuidelineResult {
  id:           string;   // "G1" | "G2" | "G3" | "G4" | "G5"
  name:         string;
  passed:       boolean;
  ratio:        number;
  ideal_ratio:  number;
}

export interface EWAElliottRules {
  all_pass:    boolean;
  rules_score: number;   // 0 or 40
  is_diagonal: boolean;
  rules:       EWARuleResult[];
  guidelines:  EWAGuidelineResult[];
}

// ─── Fibonacci Block ───────────────────────────────────────────────────────────

export interface FibRelation {
  waves:         string;
  name:          string;
  actual_ratio:  number;
  near_level:    number;
  deviation_pct: number;
  passes:        boolean;
  score:         number;
}

export interface EWAFibonacci {
  fib_score:     number;  // 0–25
  max_fib_score: number;  // 25
  relations:     FibRelation[];
}

// ─── MTF Alignment ─────────────────────────────────────────────────────────────

export interface EWAMTFAlignment {
  macro_timeframe:     string;
  micro_timeframe:     string;
  macro_state:         string;
  macro_direction:     EWADirection;
  mtf_aligned:         boolean;
  mtf_score:           number;    // 0–10
  alignment:           MTFAlignment;
  bias_description_ar: string;
  bias_description_en: string;
  contradiction_reason?: string;
}

// ─── Scoring Matrix ────────────────────────────────────────────────────────────

export interface ScoreComponent {
  score:      number;
  max:        number;
  weight_pct: number;
}

export interface EWAScoringMatrix {
  total_score:     number;  // 0–100
  confidence_pct:  number;  // Same as total_score
  macro_momentum:  ScoreComponent;  // 0–5
  mtf_alignment:   ScoreComponent;  // 0–10
  structure:       ScoreComponent;  // 0–20
  fibonacci:       ScoreComponent;  // 0–25
  elliott_rules:   ScoreComponent;  // 0–40
}

// ─── Targets ───────────────────────────────────────────────────────────────────

export interface EWATargets {
  invalidation_price:  number;
  invalidation_label:  string;
  target_price:        number;
  target_label:        string;
  target_pct_move:     string;
  extended_target?:    number;
  extended_label?:     string;
  fib_level_primary:   number;
  fib_level_extended:  number;
  risk_pct:            number;
  reward_pct:          number;
  risk_reward_ratio:   number;
}

// ─── Meta Strip ────────────────────────────────────────────────────────────────

export interface EWAMeta {
  inv:     string;   // Invalidation label
  dir:     'UP' | 'DN';
  pattern: string;   // "1-2-3-4-5" | "A-B-C"
  price:   string;   // Current price formatted
  pair:    string;   // "BTCUSDT"
}

// ─── Full EWA Result ────────────────────────────────────────────────────────────

export interface EWAResult {
  // Identity
  symbol:          string;
  macro_timeframe: string;
  micro_timeframe: string;
  analysis_ts:     number;
  current_price:   number;

  // Pattern
  pattern_type:    EWAPatternType;
  pattern_label:   string;
  direction:       EWADirection;
  pattern_name_en: string;
  pattern_name_ar: string;

  // SVG rendering coordinates
  pivots:          EWAPivot[];

  // Validation blocks
  elliott_rules:   EWAElliottRules;
  fibonacci:       EWAFibonacci;
  mtf_alignment:   EWAMTFAlignment;

  // Scoring
  scoring_matrix:  EWAScoringMatrix;

  // Trade levels
  targets:         EWATargets;

  // UI meta strip
  meta:            EWAMeta;

  // Algorithmic verdict
  verdict_ar:      string;
  verdict_en:      string;

  // Error state (when analysis fails)
  error?:             string;
  insufficient_pivots?: boolean;
}

// ─── API Request ────────────────────────────────────────────────────────────────

export interface EWAAPIRequest {
  init_data:   string;   // Telegram WebApp.initData
  symbol:      string;   // "BTCUSDT"
  macro_tf:    string;   // "1d"
  micro_tf:    string;   // "1h"
  macro_limit?: number;  // default 500
  micro_limit?: number;  // default 300
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

export function getConfidenceLabel(pct: number): string {
  if (pct >= 80) return 'عالية جداً';
  if (pct >= 65) return 'عالية';
  if (pct >= 50) return 'متوسطة';
  if (pct >= 35) return 'منخفضة';
  return 'ضعيفة';
}

export function getConfidenceColor(pct: number): string {
  if (pct >= 80) return '#10b981';  // emerald
  if (pct >= 65) return '#f59e0b';  // amber
  if (pct >= 50) return '#f97316';  // orange
  return '#ef4444';                  // red
}
