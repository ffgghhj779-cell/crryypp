'use client';

import { useState } from 'react';
import { fetchKlines }   from '@/lib/binance/fetcher';
import { calculateVIP }  from '@/lib/algorithms/vip';
import type { VIPResult } from '@/lib/algorithms/vip';
import { AlertTriangle } from 'lucide-react';
import { getAssetInfo } from '@/lib/assetInfo';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number, symbol: string): string {
  const info = getAssetInfo(symbol);
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: info.precision,
    maximumFractionDigits: Math.max(info.precision, n >= 10_000 ? 1 : n >= 1 ? 4 : 6),
  });
  return info.prefix ? `${info.prefix}${formatted}` : `${formatted} ${info.unit}`;
}

const inputCls =
  'w-full px-3 py-4.5 rounded-xl bg-white/[0.04] border border-white/[0.08] ' +
  'text-white font-mono text-base focus:outline-none focus:border-orange-500/60 ' +
  'focus:bg-white/[0.07] focus:ring-1 focus:ring-orange-500/30 transition-all ' +
  'placeholder:text-white/20 tabular-nums';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  symbol: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VIPResultCard({ symbol }: Props) {
  const [portfolio, setPortfolio] = useState('1000');
  const [phase,     setPhase]     = useState<'idle' | 'loading' | 'done'>('idle');
  const [result,    setResult]    = useState<VIPResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  async function handleGenerate() {
    const portfolioSize = parseFloat(portfolio);
    if (!portfolioSize || portfolioSize <= 0) {
      setError('يرجى إدخال حجم محفظة صحيح.');
      return;
    }
    setPhase('loading');
    setResult(null);
    setError(null);

    try {
      // Concurrent 3-timeframe fetch (500 candles each)
      const [k1h, k4h, k1d] = await Promise.all([
        fetchKlines(symbol, '1h',  500),
        fetchKlines(symbol, '4h',  500),
        fetchKlines(symbol, '1d',  500),
      ]);
      console.info(`[VIP] ✓ ${symbol} — 1H:${k1h.length} 4H:${k4h.length} 1D:${k1d.length} candles`);
      setResult(calculateVIP(portfolioSize, k1h, k4h, k1d));
      setPhase('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('idle');
    }
  }

  // ── State 1: Input Form + (optional result below) ──────────────────────────

  return (
    <div className="space-y-3" style={{ animation: 'fade-in 0.2s ease forwards' }}>

      {/* Input Form */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111111] p-6 space-y-3">
        <p className="text-sm text-white/25 uppercase tracking-widest font-mono">Trading VIP · إعداد التمركز</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Symbol — read-only */}
          <div>
            <label className="text-sm text-white/30 uppercase tracking-widest block mb-1.5">
              رمز الأصل المالي
            </label>
            <input value={symbol} readOnly className={inputCls + ' opacity-60 cursor-not-allowed'} />
          </div>
          {/* Portfolio size */}
          <div>
            <label className="text-sm text-white/30 uppercase tracking-widest block mb-1.5">
              إجمالي المحفظة
            </label>
            <input
              type="number"
              value={portfolio}
              onChange={e => setPortfolio(e.target.value)}
              className={inputCls}
              placeholder="1000"
              min="10"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 px-3 py-4.5 rounded-xl border border-red-500/30 bg-red-500/[0.07]">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300/80">{error}</p>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={phase === 'loading'}
          className="w-full py-4.5 rounded-xl font-bold text-base tracking-wider transition-all active:scale-[0.98] disabled:cursor-not-allowed"
          style={{
            background: phase === 'loading'
              ? 'linear-gradient(135deg,#92400e,#78350f)'
              : 'linear-gradient(135deg,#f97316,#ea580c)',
            boxShadow: phase !== 'loading' ? '0 0 28px rgba(249,115,22,0.28)' : 'none',
            color: '#fff',
          }}
        >
          {phase === 'loading' ? (
            <span className="flex items-center justify-center gap-3">
              <span className="w-6 h-6 border-2 border-orange-300/40 border-t-orange-200 rounded-full animate-spin" />
              <span className="animate-pulse">جارٍ التحليل المتعدد الأطر...</span>
            </span>
          ) : (
            '⚡ توليد الإجماع والتمركز الفائق'
          )}
        </button>
      </div>

      {/* ── State 2: Rejection UI ────────────────────────────────────────────── */}
      {phase === 'done' && result?.rejected && (
        <div
          className="rounded-2xl border border-white/[0.06] bg-[#121212] px-5 py-5 text-center space-y-2"
          style={{ animation: 'slide-up 0.3s cubic-bezier(0.16,1,0.3,1) forwards' }}
          dir="rtl"
        >
          <div className="flex justify-center mb-3">
            <span className="text-5xl font-black text-red-500 tabular-nums font-mono">{result.score}%</span>
          </div>
          <p className="text-sm text-white/50 leading-relaxed">
            تم حجب التمركز: درجة الإجماع الخوارزمي{' '}
            <span className="text-red-400 font-bold">({result.score}%)</span>{' '}
            لم تصل لحد الأمان المطلوب{' '}
            <span className="text-orange-400 font-bold">65%</span>
          </p>
          {/* Factor breakdown even on rejection */}
          <div className="grid grid-cols-5 gap-1.5 mt-4 pt-4 border-t border-white/[0.05]">
            {result.factors.map(f => (
              <div key={f.label} className="text-center">
                <p className="text-sm font-mono font-bold text-white/30 tabular-nums">{f.score}</p>
                <p className="text-sm text-white/20 mt-0.5">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── State 3: Success UI ──────────────────────────────────────────────── */}
      {phase === 'done' && result && !result.rejected && (() => {
        const { score, factors, setup } = result;
        return (
          <div
            className="rounded-2xl border border-white/[0.06] bg-[#121212] overflow-hidden"
            style={{ animation: 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-white/[0.05] bg-[#0f0f0f]" dir="rtl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/25 uppercase tracking-widest font-mono mb-0.5">Trading VIP · إجماع متعدد الأطر</p>
                  <p className="text-white font-bold text-base">سوينج VIP ممتد</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black text-orange-500 tabular-nums font-mono leading-none">{score}%</p>
                  <span className="text-sm text-white/30 font-mono border border-white/[0.1] px-2 py-0.5 rounded mt-1 inline-block">
                    TIMEFRAME: 4H
                  </span>
                </div>
              </div>
            </div>

            {/* 5-Factor breakdown */}
            <div className="grid grid-cols-5 divide-x divide-white/[0.05] border-b border-white/[0.05]" dir="rtl">
              {[...factors].reverse().map(f => (
                <div key={f.label} className="py-4 text-center">
                  <p className="text-sm font-mono font-bold text-orange-400 tabular-nums">{f.score}%</p>
                  <p className="text-sm text-white/30 mt-0.5">{f.label}</p>
                </div>
              ))}
            </div>

            {/* Entry price */}
            <div className="px-5 py-4 border-b border-white/[0.05] text-center">
              <p className="text-sm text-white/30 uppercase tracking-widest font-mono mb-1">سعر الدخول المرجح</p>
              <p className="text-2xl font-black text-white font-mono tabular-nums">{fmtPrice(setup.entry, symbol)}</p>
            </div>

            {/* TP 1/2/3 */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-b border-white/[0.05]" dir="rtl">
              {([
                { label: 'الهدف الأول (TP1)',  price: setup.tp1, pct: setup.tp1Pct },
                { label: 'الهدف الثاني (TP2)', price: setup.tp2, pct: setup.tp2Pct },
                { label: 'الهدف الثالث (TP3)', price: setup.tp3, pct: setup.tp3Pct },
              ] as const).map(t => (
                <div key={t.label} className="py-4 px-2 text-center">
                  <p className="text-sm text-white/25 font-medium mb-1 leading-tight">{t.label}</p>
                  <p className="text-sm font-mono font-bold text-white tabular-nums">{fmtPrice(t.price, symbol)}</p>
                  <p className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                    +{t.pct.toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>

            {/* Stop Loss */}
            <div className="mx-4 my-3 rounded-xl border border-white/[0.07] border-t-orange-500 bg-[#0d0d0d] overflow-hidden" dir="rtl">
              <div className="h-[2px] bg-orange-500 w-full" />
              <div className="px-3 py-4">
                <p className="text-sm text-white/35 leading-snug mb-2">
                  وقف الخسارة (SL) — الإلغاء الصارم: إغلاق يومي أسفل هذا المستوى.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/30 font-mono">-{setup.slDropPct.toFixed(2)}%</span>
                  <span className="text-lg font-mono font-bold text-orange-400 tabular-nums">{fmtPrice(setup.sl, symbol)}</span>
                </div>
              </div>
            </div>

            {/* Risk management box */}
            <div className="mx-4 mb-3 grid grid-cols-2 gap-3" dir="rtl">
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-3 py-4 text-right">
                <p className="text-sm text-white/30 mb-1">تأكل المحفظة الفعلي</p>
                <p className="text-lg font-mono font-bold text-red-400 tabular-nums">-{setup.actualRiskPct.toFixed(2)}%</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-4 text-right">
                <p className="text-sm text-white/30 mb-1">حجم الدخول المسموح</p>
                <p className="text-lg font-mono font-bold text-orange-300 tabular-nums">{setup.positionSizePct.toFixed(1)}%</p>
                <p className="text-sm text-white/20 tabular-nums">≈ {fmtPrice(setup.positionUSDT, symbol)} · أقصى 20%</p>
              </div>
            </div>

            {/* Footer disclaimer */}
            <div className="mx-4 mb-4 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-4" dir="rtl">
              <p className="text-sm text-white/25 leading-relaxed text-right">
                يعتمد هذا الإجماع على خمس أدوات خوارزمية: توافق الاتجاه متعدد الأطر (EMA-50)، زخم التقاطع (EMA-9/21)، البنية بالنسبة لـ SMA-200، تأكيد الحجم، وجودة الشمعة — مع تطبيق صارم لإدارة المخاطر بحد أقصى 1.4% خسارة من المحفظة لكل صفقة.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
