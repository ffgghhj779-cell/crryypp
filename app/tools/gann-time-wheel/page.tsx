'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToolPageHeader } from '@/components/tools/ToolPageHeader';
import { slugToTool } from '@/lib/tools/registry';
import { notFound } from 'next/navigation';
import { computeGann, GannResult } from '@/lib/algorithms/gann';
import {
  ShieldAlert, AlertTriangle, TrendingUp, TrendingDown,
  Minus, ChevronRight, ArrowRight,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Asset    = 'BTC' | 'GOLD' | 'OIL' | 'USDEGP' | 'EGYXAU';
type ViewMode = 'wheel' | 'month_days';

interface OHLCBar { t: number; o: number; h: number; l: number; c: number; v: number; }

interface DayAnalytics {
  date:               string;
  dayNum:             number;
  weekNum:            number;   // 1-5
  open: number; high: number; low: number; close: number;
  change:             number;   // close - open
  changeFromPrev:     number;   // close - prev_close
  priceMagnitude:     number;   // high - low
  status:             'قمة' | 'قاع' | 'عادي';
  statusColor:        string;
  isUp:               boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_AR    = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_IN_MO   = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ─── Asset Config ──────────────────────────────────────────────────────────────
const ASSET_SYMBOL: Record<Asset, string> = {
  BTC: 'BTCUSDT', GOLD: 'XAUUSD', OIL: 'WTIUSD', USDEGP: 'USDEGP', EGYXAU: 'EGYXAU',
};
const COMMODITY_ASSETS = new Set<Asset>(['GOLD', 'OIL', 'USDEGP', 'EGYXAU']);

const ASSET_LABEL: Record<Asset, string> = {
  BTC: 'بيتكوين BTC', GOLD: 'ذهب XAU', OIL: 'نفط WTI', USDEGP: 'دولار/جنيه', EGYXAU: 'ذهب مصري',
};
const ASSET_CENTER: Record<Asset, string> = {
  BTC: '₿', GOLD: 'Au', OIL: '⛽', USDEGP: '$', EGYXAU: 'جم',
};
const ASSET_HEX: Record<Asset, string> = {
  BTC: '#f97316', GOLD: '#eab308', OIL: '#3b82f6', USDEGP: '#10b981', EGYXAU: '#d97706',
};
const ASSET_COLOR: Record<Asset, { active: string; text: string }> = {
  BTC:    { active: 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]',   text: 'text-orange-400' },
  GOLD:   { active: 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)]',    text: 'text-yellow-400' },
  OIL:    { active: 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]',     text: 'text-blue-400'   },
  USDEGP: { active: 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]',  text: 'text-emerald-400'},
  EGYXAU: { active: 'bg-amber-600 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]',    text: 'text-amber-400'  },
};

// ─── Price Formatter ─────────────────────────────────────────────────────────
function fmtPrice(n: number, asset: Asset): string {
  switch (asset) {
    case 'BTC':    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'GOLD':   return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'OIL':    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'USDEGP': return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} جنيه`;
    case 'EGYXAU': return `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} جنيه/جم`;
    default:       return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

function fmtChange(n: number, asset: Asset): string {
  const prefix = n >= 0 ? '+' : '';
  switch (asset) {
    case 'BTC':    return `${prefix}$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'GOLD':
    case 'OIL':    return `${prefix}$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'USDEGP': return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} جنيه`;
    case 'EGYXAU': return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} جنيه`;
    default:       return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

// ─── Fetch Daily Bars ─────────────────────────────────────────────────────────
async function fetchDailyBars(asset: Asset, year: number, month: number): Promise<OHLCBar[]> {
  const symbol = ASSET_SYMBOL[asset];
  if (COMMODITY_ASSETS.has(asset)) {
    try {
      const params = new URLSearchParams({ symbol, interval: '1d', limit: '730' });
      const res = await fetch(`/api/klines?${params}`);
      if (!res.ok) return [];
      const bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = await res.json();
      const startTs = new Date(year, month, 1).getTime() / 1000;
      const endTs   = new Date(year, month + 1, 1).getTime() / 1000;
      return bars
        .filter(b => b.time >= startTs && b.time < endTs)
        .map(b => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume }));
    } catch { return []; }
  }
  const start = new Date(year, month, 1).getTime();
  const end   = new Date(year, month + 1, 1).getTime();
  const url   = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${start}&endTime=${end}&limit=35`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const raw: any[][] = await res.json();
    return raw.map(k => ({ t: k[0]/1000, o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
  } catch { return []; }
}

// ─── Peak / Trough Detector ───────────────────────────────────────────────────
function detectStatus(bars: OHLCBar[], idx: number): 'قمة' | 'قاع' | 'عادي' {
  if (bars.length < 3) return 'عادي';
  const prev = bars[idx - 1], curr = bars[idx], next = bars[idx + 1];
  if (!prev || !next) return 'عادي';
  if (curr.h > prev.h && curr.h > next.h) return 'قمة';
  if (curr.l < prev.l && curr.l < next.l) return 'قاع';
  return 'عادي';
}

// ─── Build Day Analytics ──────────────────────────────────────────────────────
function buildDayAnalytics(bars: OHLCBar[], month: number): DayAnalytics[] {
  return bars.map((bar, i) => {
    const date    = new Date(bar.t * 1000);
    const dayNum  = date.getDate();
    const weekNum = Math.ceil(dayNum / 7);       // week 1-5
    const prev    = bars[i - 1];
    const status  = detectStatus(bars, i);
    const change          = bar.c - bar.o;
    const changeFromPrev  = prev ? bar.c - prev.c : change;
    const statusColor =
      status === 'قمة' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' :
      status === 'قاع' ? 'text-red-400 border-red-500/40 bg-red-500/10' :
                         'text-white/40 border-white/10 bg-white/5';
    return {
      date: `${dayNum} ${MONTHS_AR[month]}`,
      dayNum, weekNum,
      open: bar.o, high: bar.h, low: bar.l, close: bar.c,
      change, changeFromPrev,
      priceMagnitude: bar.h - bar.l,
      status, statusColor,
      isUp: bar.c >= bar.o,
    };
  });
}

// ─── Today Status from latest bars ───────────────────────────────────────────
type TodayStatus = 'قمة محتملة' | 'قاع محتمل' | 'صاعد' | 'هابط' | 'محايد';

function computeTodayStatus(bars: OHLCBar[]): TodayStatus {
  if (bars.length === 0) return 'محايد';
  const bar  = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const range    = bar.h - bar.l;
  const closePos = range > 0 ? (bar.c - bar.l) / range : 0.5;
  const isUp     = bar.c >= bar.o;

  if (prev) {
    // Close above prev high + closing in top 75% of range → peak candidate
    if (bar.c > prev.h && closePos > 0.75) return 'قمة محتملة';
    // Close below prev low + closing in bottom 25% → trough candidate
    if (bar.c < prev.l && closePos < 0.25) return 'قاع محتمل';
  }
  return isUp ? 'صاعد' : 'هابط';
}

// ─── Asset Toggle ─────────────────────────────────────────────────────────────
function AssetToggle({ asset, onChange }: { asset: Asset; onChange: (a: Asset) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {(['BTC', 'GOLD', 'OIL', 'USDEGP', 'EGYXAU'] as Asset[]).map(a => (
        <button
          key={a}
          onClick={() => onChange(a)}
          className={`px-4 py-2 rounded-xl text-sm font-black tracking-wide transition-all duration-200 border ${
            asset === a
              ? ASSET_COLOR[a].active + ' border-transparent'
              : 'text-white/40 border-white/10 hover:text-white/70 hover:border-white/20'
          }`}
        >
          {ASSET_LABEL[a]}
        </button>
      ))}
    </div>
  );
}

// ─── Today Stats Card ─────────────────────────────────────────────────────────
function TodayStatsCard({
  bars, asset,
}: { bars: OHLCBar[]; asset: Asset }) {
  if (bars.length === 0) return null;
  const bar     = bars[bars.length - 1];
  const prev    = bars[bars.length - 2];
  const status  = computeTodayStatus(bars);
  const isUp    = bar.c >= bar.o;
  const change       = bar.c - bar.o;
  const changeFromPrev = prev ? bar.c - prev.c : change;
  const changePct    = bar.o > 0 ? (change / bar.o) * 100 : 0;
  const range        = bar.h - bar.l;

  const statusColor =
    status === 'قمة محتملة' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    status === 'قاع محتمل'  ? 'text-red-400 border-red-500/30 bg-red-500/10' :
    status === 'صاعد'        ? 'text-sky-400 border-sky-500/30 bg-sky-500/10' :
    status === 'هابط'        ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                               'text-white/40 border-white/10 bg-white/5';

  const statusIcon =
    status === 'قمة محتملة' ? '▲' : status === 'قاع محتمل' ? '▼' :
    status === 'صاعد' ? '↑' : status === 'هابط' ? '↓' : '◎';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl border border-white/[0.08] bg-[#111] p-5 flex flex-col gap-4"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-mono text-white/30 uppercase tracking-widest">تحليل اليوم</p>
          <p className="text-lg font-black" style={{ color: ASSET_HEX[asset] }}>{ASSET_LABEL[asset]}</p>
        </div>
        <span className={`text-sm font-black px-3 py-1.5 rounded-xl border ${statusColor}`}>
          {statusIcon} {status}
        </span>
      </div>

      {/* Price Change Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Intraday change */}
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 text-center">
          <p className="text-sm text-white/30 mb-1.5">تغير اليوم</p>
          <p className={`text-base font-black tabular-nums ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtChange(change, asset)}
          </p>
          <p className={`text-sm tabular-nums mt-0.5 ${isUp ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </p>
        </div>
        {/* Range */}
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 text-center">
          <p className="text-sm text-white/30 mb-1.5">حركة النطاق</p>
          <p className="text-base font-black text-orange-300 tabular-nums">{fmtPrice(range, asset)}</p>
          <p className="text-sm text-white/25 mt-0.5">أعلى — أدنى</p>
        </div>
      </div>

      {/* From prev close */}
      {prev && (
        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
          <span className="text-sm text-white/40">تغير من إغلاق أمس</span>
          <span className={`text-sm font-black tabular-nums ${changeFromPrev >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtChange(changeFromPrev, asset)}
          </span>
        </div>
      )}

      {/* OHLC */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {[
          { label: 'فتح',   value: fmtPrice(bar.o, asset), color: 'text-white/60' },
          { label: 'أعلى',  value: fmtPrice(bar.h, asset), color: 'text-emerald-400' },
          { label: 'أدنى',  value: fmtPrice(bar.l, asset), color: 'text-red-400' },
          { label: 'إغلاق', value: fmtPrice(bar.c, asset), color: isUp ? 'text-emerald-400' : 'text-red-400' },
        ].map(item => (
          <div key={item.label} className="rounded-lg bg-white/[0.03] py-2">
            <p className="text-sm text-white/25 uppercase">{item.label}</p>
            <p className={`text-sm font-bold tabular-nums ${item.color} truncate`}>{item.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Gann Wheel SVG — FIXED NEEDLE + DAY SUBDIVISIONS ────────────────────────
function GannWheelSvg({
  result, selectedMonth, onMonthClick, asset, todayStatus,
}: {
  result:        GannResult;
  selectedMonth: number | null;
  onMonthClick:  (m: number) => void;
  asset:         Asset;
  todayStatus:   TodayStatus;
}) {
  const size   = 320;
  const cx     = size / 2;
  const cy     = size / 2;
  const outerR = 130;   // outer ring (Gann points)
  const weekR  = 117;   // week-tick ring outer edge
  const monthR = 106;   // month label ring
  const innerR = 75;    // inner boundary
  const toRad  = (deg: number) => (deg - 90) * (Math.PI / 180);

  const needleColor = ASSET_HEX[asset];
  const today       = new Date();
  const todayMo     = today.getMonth();
  const todayDay    = today.getDate();

  // ── Fixed needle — direct coordinate calculation (no CSS rotation!) ──────
  const needleRad  = toRad(result.todayAngle);
  const tipX       = cx + (outerR + 6) * Math.cos(needleRad);
  const tipY       = cy + (outerR + 6) * Math.sin(needleRad);
  const baseX      = cx + (innerR + 5) * Math.cos(needleRad);
  const baseY      = cy + (innerR + 5) * Math.sin(needleRad);

  // Status display in center
  const statusIcon  =
    todayStatus === 'قمة محتملة' ? '▲' : todayStatus === 'قاع محتمل' ? '▼' :
    todayStatus === 'صاعد' ? '↑' : todayStatus === 'هابط' ? '↓' : '◎';
  const statusColor =
    todayStatus === 'قمة محتملة' || todayStatus === 'صاعد' ? '#34d399' :
    todayStatus === 'قاع محتمل'  || todayStatus === 'هابط' ? '#f87171' : 'rgba(255,255,255,0.3)';

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible">

      {/* ── Rings ─────────────────────────────────────────────────────────── */}
      <circle cx={cx} cy={cy} r={outerR}  fill="rgba(255,255,255,0.005)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={weekR}   fill="none"                    stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="1 4" />
      <circle cx={cx} cy={cy} r={monthR}  fill="rgba(255,255,255,0.005)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="3 5" />
      <circle cx={cx} cy={cy} r={innerR}  fill="#0a0a0a"                 stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      {/* ── Month Segments + Day Subdivisions ─────────────────────────────── */}
      {MONTHS_SHORT.map((m, mi) => {
        const startDeg     = (mi / 12) * 360;
        const endDeg       = ((mi + 1) / 12) * 360;
        const midDeg       = (startDeg + endDeg) / 2;
        const monthSpan    = endDeg - startDeg;
        const daysInMo     = DAYS_IN_MO[mi];
        const isSelected   = selectedMonth === mi;
        const isCurrMonth  = todayMo === mi;

        // Segment arc
        const r1 = innerR + 2, r2 = monthR - 2;
        const sRad = toRad(startDeg), eRad = toRad(endDeg);
        const sx1 = cx + r2 * Math.cos(sRad), sy1 = cy + r2 * Math.sin(sRad);
        const sx2 = cx + r2 * Math.cos(eRad), sy2 = cy + r2 * Math.sin(eRad);
        const sx3 = cx + r1 * Math.cos(eRad), sy3 = cy + r1 * Math.sin(eRad);
        const sx4 = cx + r1 * Math.cos(sRad), sy4 = cy + r1 * Math.sin(sRad);

        // Label position
        const lRad = toRad(midDeg);
        const lr   = (r1 + r2) / 2;
        const lx   = cx + lr * Math.cos(lRad);
        const ly   = cy + lr * Math.sin(lRad);

        // ── Week tick marks (every 7 days) in outer ring ──────────────────
        const weekTicks = [];
        for (let d = 7; d < daysInMo; d += 7) {
          const frac    = d / daysInMo;
          const tickDeg = startDeg + frac * monthSpan;
          const tickRad = toRad(tickDeg);
          weekTicks.push(
            <line key={`wk-${mi}-${d}`}
              x1={cx + monthR * Math.cos(tickRad)}
              y1={cy + monthR * Math.sin(tickRad)}
              x2={cx + weekR * Math.cos(tickRad)}
              y2={cy + weekR * Math.sin(tickRad)}
              stroke={isCurrMonth ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}
              strokeWidth="0.6"
            />
          );
        }

        // ── Day boundary lines (thin, every day) ──────────────────────────
        const dayLines = [];
        for (let d = 1; d < daysInMo; d++) {
          const frac    = d / daysInMo;
          const tickDeg = startDeg + frac * monthSpan;
          const tickRad = toRad(tickDeg);
          dayLines.push(
            <line key={`day-${mi}-${d}`}
              x1={cx + monthR * Math.cos(tickRad)}
              y1={cy + monthR * Math.sin(tickRad)}
              x2={cx + (monthR + 4) * Math.cos(tickRad)}
              y2={cy + (monthR + 4) * Math.sin(tickRad)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.4"
            />
          );
        }

        // ── Today dot in current month ────────────────────────────────────
        let todayDot = null;
        if (isCurrMonth) {
          const frac     = (todayDay - 0.5) / daysInMo;
          const todayDeg = startDeg + frac * monthSpan;
          const todayRad = toRad(todayDeg);
          const dotR     = (monthR + weekR) / 2;
          todayDot = (
            <>
              {/* Glow */}
              <circle
                cx={cx + dotR * Math.cos(todayRad)}
                cy={cy + dotR * Math.sin(todayRad)}
                r="6" fill={needleColor} opacity="0.15"
              />
              {/* Dot */}
              <circle
                cx={cx + dotR * Math.cos(todayRad)}
                cy={cy + dotR * Math.sin(todayRad)}
                r="3.5" fill={needleColor} opacity="0.95"
              />
            </>
          );
        }

        return (
          <g
            key={m}
            onClick={() => onMonthClick(mi)}
            className="cursor-pointer"
            role="button"
            aria-label={`${MONTHS_AR[mi]} — انقر للتفاصيل`}
          >
            {/* Segment fill */}
            <path
              d={`M ${sx1} ${sy1} A ${r2} ${r2} 0 0 1 ${sx2} ${sy2} L ${sx3} ${sy3} A ${r1} ${r1} 0 0 0 ${sx4} ${sy4} Z`}
              fill={
                isSelected  ? 'rgba(249,115,22,0.22)' :
                isCurrMonth ? 'rgba(255,255,255,0.06)' :
                              'rgba(255,255,255,0.01)'
              }
              stroke={
                isSelected  ? 'rgba(249,115,22,0.7)' :
                isCurrMonth ? `${needleColor}55` :
                              'rgba(255,255,255,0.05)'
              }
              strokeWidth={isSelected ? '1.5' : '0.5'}
              className="transition-all duration-200 hover:fill-[rgba(255,255,255,0.05)]"
            />
            {dayLines}
            {weekTicks}
            {todayDot}
            {/* Month label */}
            <text
              x={lx} y={ly}
              fill={
                isSelected  ? '#f97316' :
                isCurrMonth ? 'rgba(255,255,255,0.8)' :
                              'rgba(255,255,255,0.22)'
              }
              fontSize={isSelected ? '8.5' : '7.5'}
              fontFamily="monospace"
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight={isSelected || isCurrMonth ? 'bold' : 'normal'}
            >
              {m}
            </text>
          </g>
        );
      })}

      {/* ── Outer Gann Points ─────────────────────────────────────────────── */}
      {result.points.map((p, i) => {
        const rad   = toRad(p.angle);
        const x     = cx + outerR * Math.cos(rad);
        const y     = cy + outerR * Math.sin(rad);
        const isMaj = p.type === 'major';
        const col   = isMaj ? '#f97316' : '#a8a29e';
        return (
          <g key={i}>
            <line x1={cx + monthR * Math.cos(rad)} y1={cy + monthR * Math.sin(rad)} x2={x} y2={y}
              stroke={col} strokeWidth="1" opacity={isMaj ? 0.5 : 0.2} />
            <circle cx={x} cy={y} r={isMaj ? 5 : 3} fill={col} />
            {isMaj && <circle cx={x} cy={y} r={10} fill="none" stroke={col} strokeWidth="1" opacity="0.3" />}
          </g>
        );
      })}

      {/* ── FIXED Needle ─────────────────────────────────────────────────── */}
      {/* Direct coordinate calculation — no CSS rotation (fixes stuck-arrow bug) */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}>
        {/* Needle body */}
        <line
          x1={baseX} y1={baseY} x2={tipX} y2={tipY}
          stroke={needleColor} strokeWidth="2.5" strokeLinecap="round"
          opacity="0.95"
        />
        {/* Outer glow circle at tip */}
        <circle cx={tipX} cy={tipY} r="8"  fill={needleColor} opacity="0.1" />
        <circle cx={tipX} cy={tipY} r="4"  fill={needleColor} opacity="0.8" />
        {/* Base circle */}
        <circle cx={baseX} cy={baseY} r="3" fill={needleColor} opacity="0.4" />
      </motion.g>

      {/* ── Center Circle Content ─────────────────────────────────────────── */}
      <circle cx={cx} cy={cy} r={innerR - 1} fill="#080808" />
      <circle cx={cx} cy={cy} r={innerR - 1} fill="none" stroke={needleColor} strokeWidth="1.5" opacity="0.35" />

      {/* Asset symbol (large) */}
      <text
        x={cx} y={cy - 20}
        fill={needleColor}
        fontSize="18" fontFamily="monospace"
        textAnchor="middle" fontWeight="bold" opacity="0.95"
      >
        {ASSET_CENTER[asset]}
      </text>

      {/* Asset name */}
      <text
        x={cx} y={cy - 5}
        fill={needleColor}
        fontSize="6.5" fontFamily="sans-serif"
        textAnchor="middle" opacity="0.65"
      >
        {ASSET_LABEL[asset].split(' ')[0]}
      </text>

      {/* Today date */}
      <text
        x={cx} y={cy + 9}
        fill="rgba(255,255,255,0.55)"
        fontSize="8.5" fontFamily="monospace"
        textAnchor="middle" fontWeight="bold"
      >
        {`${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`}
      </text>

      {/* Today status */}
      <text
        x={cx} y={cy + 24}
        fill={statusColor}
        fontSize="7.5" fontFamily="sans-serif"
        textAnchor="middle" fontWeight="bold"
      >
        {statusIcon} {todayStatus}
      </text>
    </svg>
  );
}

// ─── Day Card (enhanced) ──────────────────────────────────────────────────────
function DayCard({ day, asset }: { day: DayAnalytics; asset: Asset }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5 flex flex-col gap-2.5"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white/80">{day.date}</span>
          <span className="text-sm text-white/25 font-mono">أسبوع {day.weekNum}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {day.status !== 'عادي' && (
            <span className={`text-sm font-black px-2 py-0.5 rounded-full border ${day.statusColor}`}>
              {day.status === 'قمة' ? '▲ قمة' : '▼ قاع'}
            </span>
          )}
          {day.isUp
            ? <TrendingUp  className="w-3.5 h-3.5 text-emerald-400" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          }
        </div>
      </div>

      {/* Price changes */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.03] px-2.5 py-2 text-center">
          <p className="text-sm text-white/25 uppercase mb-0.5">تغير اليوم</p>
          <p className={`text-sm font-black tabular-nums ${day.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtChange(day.change, asset)}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2.5 py-2 text-center">
          <p className="text-sm text-white/25 uppercase mb-0.5">نطاق الحركة</p>
          <p className="text-sm font-black text-orange-300 tabular-nums">
            {fmtPrice(day.priceMagnitude, asset)}
          </p>
        </div>
      </div>

      {/* OHLC mini */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'فتح',   value: fmtPrice(day.open,  asset), color: 'text-white/50' },
          { label: 'أعلى',  value: fmtPrice(day.high,  asset), color: 'text-emerald-400' },
          { label: 'أدنى',  value: fmtPrice(day.low,   asset), color: 'text-red-400' },
          { label: 'إغلاق', value: fmtPrice(day.close, asset), color: day.isUp ? 'text-emerald-400' : 'text-red-400' },
        ].map(item => (
          <div key={item.label} className="flex flex-col">
            <span className="text-sm text-white/25 uppercase">{item.label}</span>
            <span className={`text-sm font-bold tabular-nums ${item.color} truncate`}>{item.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Month Drilldown View — grouped by week ───────────────────────────────────
function MonthDrilldown({
  monthIndex, year, asset, onBack,
}: { monthIndex: number; year: number; asset: Asset; onBack: () => void }) {
  const [bars,    setBars]    = useState<OHLCBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setBars([]);
      const data = await fetchDailyBars(asset, year, monthIndex);
      if (!cancelled) { setBars(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [asset, year, monthIndex]);

  const days = useMemo(() => buildDayAnalytics(bars, monthIndex), [bars, monthIndex]);

  // Group days by week
  const weeks = useMemo(() => {
    const map = new Map<number, DayAnalytics[]>();
    for (const d of days) {
      const wk = d.weekNum;
      if (!map.has(wk)) map.set(wk, []);
      map.get(wk)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [days]);

  const peakCount   = days.filter(d => d.status === 'قمة').length;
  const troughCount = days.filter(d => d.status === 'قاع').length;
  const avgRange    = days.length ? days.reduce((s, d) => s + d.priceMagnitude, 0) / days.length : 0;

  return (
    <div className="flex flex-col gap-5 w-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <div>
          <h3 className="text-lg font-black text-white">{MONTHS_AR[monthIndex]} {year}</h3>
          <p className="text-sm text-white/40 font-mono">التحليل اليومي — {ASSET_LABEL[asset]}</p>
        </div>
      </div>

      {/* Summary */}
      {!loading && days.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl p-3 text-center">
            <p className="text-base font-black text-emerald-400">{peakCount}</p>
            <p className="text-sm text-white/40 mt-0.5">قمم ▲</p>
          </div>
          <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl p-3 text-center">
            <p className="text-base font-black text-red-400">{troughCount}</p>
            <p className="text-sm text-white/40 mt-0.5">قيعان ▼</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 text-center">
            <p className="text-sm font-black text-orange-300 truncate">{fmtPrice(avgRange, asset)}</p>
            <p className="text-sm text-white/40 mt-0.5">متوسط النطاق</p>
          </div>
        </div>
      )}

      {/* Days grouped by week */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3">
          <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-white/40 text-sm">جاري التحميل...</span>
        </div>
      ) : days.length === 0 ? (
        <div className="text-center py-8 text-white/30 text-base">لا توجد بيانات لهذا الشهر</div>
      ) : (
        <div className="flex flex-col gap-5 max-h-[55vh] overflow-y-auto overscroll-contain pb-4 pr-1">
          {weeks.map(([weekNum, weekDays]) => (
            <div key={weekNum}>
              {/* Week header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-sm text-white/25 font-mono uppercase tracking-widest px-2">
                  الأسبوع {weekNum} · {weekDays[0]?.dayNum}–{weekDays[weekDays.length - 1]?.dayNum} {MONTHS_AR[monthIndex]}
                </span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              {/* Days in this week */}
              <div className="flex flex-col gap-2.5">
                {weekDays.map((day, i) => (
                  <DayCard key={i} day={day} asset={asset} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GannWheelPage() {
  const tool = slugToTool('gann-time-wheel');

  // All hooks MUST come before any conditional return
  const [result,        setResult]        = useState<GannResult | null>(null);
  const [asset,         setAsset]         = useState<Asset>('BTC');
  const [viewMode,      setViewMode]      = useState<ViewMode>('wheel');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [todayBars,     setTodayBars]     = useState<OHLCBar[]>([]);

  // Compute Gann wheel (date-only, not asset-dependent)
  useEffect(() => {
    const run = () => setResult(computeGann(new Date()));
    const t   = setTimeout(run, 0);
    const iv  = setInterval(run, 3_600_000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  // Fetch today's bars whenever asset changes
  useEffect(() => {
    const now = new Date();
    fetchDailyBars(asset, now.getFullYear(), now.getMonth())
      .then(bars => setTodayBars(bars));
  }, [asset]);

  const todayStatus = useMemo(() => computeTodayStatus(todayBars), [todayBars]);

  const handleMonthClick = useCallback((mi: number) => {
    setSelectedMonth(mi);
    setViewMode('month_days');
  }, []);

  const handleBack = useCallback(() => {
    setViewMode('wheel');
    setSelectedMonth(null);
  }, []);

  // Now safe to do conditional return after hooks
  if (!tool) return notFound();

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto pb-8">
      <ToolPageHeader tool={tool} />

      <div className="flex-1 px-5 pt-4 flex flex-col items-center max-w-lg mx-auto w-full gap-5">

        {/* Asset Toggle */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <AssetToggle
            asset={asset}
            onChange={a => { setAsset(a); setViewMode('wheel'); setSelectedMonth(null); }}
          />
        </motion.div>

        {/* Status Banner */}
        {result && viewMode === 'wheel' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full rounded-2xl border p-5 flex items-center gap-5 shadow-lg ${
              result.status === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 shadow-red-500/10'
              : result.status === 'WARNING' ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/10'
              : 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10'
            }`}
            dir="rtl"
          >
            <div className={`p-3 rounded-full ${
              result.status === 'CRITICAL' ? 'bg-red-500/20 text-red-400'
              : result.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400'
              : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {result.status === 'CRITICAL' ? <ShieldAlert className="w-5 h-5" />
              : result.status === 'WARNING'  ? <AlertTriangle className="w-5 h-5" />
              : <Minus className="w-5 h-5" />}
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-mono text-white/40 uppercase tracking-widest">حالة الدورة الزمنية</p>
              <h2 className={`text-base font-black ${
                result.status === 'CRITICAL' ? 'text-red-400'
                : result.status === 'WARNING' ? 'text-amber-400'
                : 'text-emerald-400'
              }`}>
                {result.status === 'CRITICAL' ? 'تحذير حرج' : result.status === 'WARNING' ? 'تنبيه' : 'مستقر'}
              </h2>
              <p className="text-sm text-white/50 mt-0.5 leading-snug">{result.advisoryAr.slice(0, 80)}...</p>
            </div>
          </motion.div>
        )}

        {/* Hint */}
        {viewMode === 'wheel' && result && (
          <p className="text-sm text-white/25 text-center font-mono flex items-center gap-1">
            <ArrowRight className="w-3 h-3 inline" />
            انقر على أي شهر لعرض التحليل اليومي مقسّمًا بالأسابيع
          </p>
        )}

        {/* Main content */}
        <AnimatePresence mode="wait">
          {viewMode === 'wheel' && result ? (
            <motion.div
              key="wheel"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ type: 'spring', damping: 22, stiffness: 180 }}
              className="relative w-full max-w-[320px] aspect-square"
            >
              <div className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${ASSET_HEX[asset]}08 0%, transparent 70%)` }} />
              <GannWheelSvg
                result={result}
                selectedMonth={selectedMonth}
                onMonthClick={handleMonthClick}
                asset={asset}
                todayStatus={todayStatus}
              />
            </motion.div>
          ) : viewMode === 'month_days' && selectedMonth !== null ? (
            <motion.div
              key="drilldown"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200 }}
              className="w-full"
            >
              <MonthDrilldown
                monthIndex={selectedMonth}
                year={new Date().getFullYear()}
                asset={asset}
                onBack={handleBack}
              />
            </motion.div>
          ) : (
            <div className="flex items-center justify-center py-16" key="loading">
              <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
            </div>
          )}
        </AnimatePresence>

        {/* Today Stats Card — always visible in wheel mode */}
        {viewMode === 'wheel' && todayBars.length > 0 && (
          <TodayStatsCard bars={todayBars} asset={asset} />
        )}

        {/* Next Gann Point Countdown */}
        {viewMode === 'wheel' && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full rounded-2xl bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 p-5"
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-mono text-orange-400/80 uppercase tracking-widest">النقطة الدورية القادمة</p>
                <p className="text-sm font-bold text-white/80 mt-0.5">{result.nextPoint.eventAr}</p>
              </div>
              <span className="text-sm text-white/60 font-mono">{result.nextPointDate}</span>
            </div>
            <div className="flex items-baseline gap-3 justify-center py-1">
              <span className="text-4xl font-black font-mono text-white tracking-tighter">{result.daysToNext}</span>
              <span className="text-white/40 font-mono text-base">يوم</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
