'use client';

import { useEffect, useState } from 'react';
import { X, Cpu, Flame, Layers, Activity } from 'lucide-react';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface NetworkData {
  spotPrice:    number;   // from parent (Binance ticker)
  mempoolTx:    number;
  mempoolStatus: string;  // 'Congestion' | 'Normal' | 'Low'
  hashrateEH:   number;
  hashrateChange24h: number;
  difficulty:   number;   // in Trillions
  avgDailyBlocks: number;
  currentBlock: number;
}

const HALVING_START = 840_000;   // 4th halving block
const HALVING_END   = 1_050_000; // 5th halving block
const BTC_PRODUCTION_COST = 98_500; // industry avg estimate (USD)

// â”€â”€ Fetch helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchNetworkData(): Promise<NetworkData> {
  const [mempoolRes, heightRes, hashrateRes, diffRes] = await Promise.allSettled([
    fetch('https://mempool.space/api/mempool').then(r => r.json()),
    fetch('https://mempool.space/api/blocks/tip/height').then(r => r.json()),
    fetch('https://mempool.space/api/v1/mining/hashrate/1w').then(r => r.json()),
    fetch('https://mempool.space/api/v1/difficulty-adjustment').then(r => r.json()),
  ]);

  const mempool  = mempoolRes.status  === 'fulfilled' ? mempoolRes.value  : null;
  const height   = heightRes.status   === 'fulfilled' ? heightRes.value   : null;
  const hashrate = hashrateRes.status === 'fulfilled' ? hashrateRes.value : null;
  const diff     = diffRes.status     === 'fulfilled' ? diffRes.value     : null;

  const mempoolTx = mempool?.count ?? 0;
  const mempoolStatus = mempoolTx > 80_000 ? 'Congestion' : mempoolTx > 30_000 ? 'Normal' : 'Low';

  // Hashrate from last 2 data points
  const hPoints = hashrate?.hashrates ?? [];
  const hrLast  = hPoints.length > 0 ? hPoints[hPoints.length - 1]?.avgHashrate ?? 0 : 0;
  const hrPrev  = hPoints.length > 1 ? hPoints[hPoints.length - 2]?.avgHashrate ?? hrLast : hrLast;
  const hashrateEH = hrLast / 1e18;
  const hashrateChange24h = hrPrev > 0 ? ((hrLast - hrPrev) / hrPrev) * 100 : 0;

  const difficulty = diff?.difficulty ? diff.difficulty / 1e12 : 0;
  const currentBlock = typeof height === 'number' ? height : 0;

  // Estimate avg daily blocks from diff adjustment
  const avgDailyBlocks = diff?.estimatedRetargetDate
    ? Math.round(diff.remainingBlocks / (diff.remainingTime / 86_400))
    : 144;

  return {
    spotPrice: 0, // injected from parent
    mempoolTx, mempoolStatus,
    hashrateEH: parseFloat(hashrateEH.toFixed(2)),
    hashrateChange24h: parseFloat(hashrateChange24h.toFixed(2)),
    difficulty: parseFloat(difficulty.toFixed(2)),
    avgDailyBlocks: isFinite(avgDailyBlocks) ? avgDailyBlocks : 144,
    currentBlock,
  };
}

// â”€â”€ Stat Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatRow({ label, value, valueColor = 'text-white' }: {
  label: string; value: string; valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0" dir="rtl">
      <span className="text-sm text-white/60">{label}</span>
      <span className={`text-base font-mono font-bold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}

// â”€â”€ Public Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function NetworkMacroModal({
  spotPrice,
  halvingDays,
  onClose,
}: {
  spotPrice: number;
  halvingDays: number;
  onClose: () => void;
}) {
  const [data,    setData]    = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchNetworkData()
      .then(d => { if (!cancelled) setData({ ...d, spotPrice }); })
      .catch(() => { if (!cancelled) setData({ spotPrice, mempoolTx: 0, mempoolStatus: 'N/A', hashrateEH: 0, hashrateChange24h: 0, difficulty: 0, avgDailyBlocks: 144, currentBlock: 0 }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spotPrice]);

  // Epoch progress
  const currentBlock = data?.currentBlock ?? 0;
  const blocksElapsed = Math.max(0, currentBlock - HALVING_START);
  const epochTotal    = HALVING_END - HALVING_START;
  const epochPct      = Math.min(100, (blocksElapsed / epochTotal) * 100);

  const priceVsCost   = spotPrice > 0 && BTC_PRODUCTION_COST > 0
    ? ((spotPrice - BTC_PRODUCTION_COST) / BTC_PRODUCTION_COST * 100).toFixed(1)
    : '---';
  const priceAboveCost = spotPrice >= BTC_PRODUCTION_COST;

  // Ribbon signal
  const ribbonSignal  = data && data.hashrateChange24h > 0 ? 'طھط¹ط§ظپظٹ ظˆطھط±ط§ظƒظ…' : 'ط¶ط؛ط· ظˆطھط±ط§ط¬ط¹';
  const ribbonColor   = data && data.hashrateChange24h > 0 ? 'text-orange-400' : 'text-red-400';

  // Mempool status color
  const mStatusColor  = data?.mempoolStatus === 'Congestion' ? 'text-red-400'
    : data?.mempoolStatus === 'Normal' ? 'text-yellow-400' : 'text-emerald-400';
  const mStatusAr     = data?.mempoolStatus === 'Congestion' ? 'ط§ط²ط¯ط­ط§ظ… ط¹ط§ظ„ظچ'
    : data?.mempoolStatus === 'Normal' ? 'ط³ظٹظˆظ„ط© ظ…ط¹طھط¯ظ„ط©' : 'طھط¯ظپظ‚ ظ…ظ†ط®ظپط¶';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ animation: 'fade-in 0.2s ease forwards' }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-3xl border border-white/[0.08] flex flex-col overflow-hidden"
        style={{ background: 'rgba(8,8,8,0.97)', backdropFilter: 'blur(40px)', maxHeight: '94dvh', animation: 'slide-up 0.32s cubic-bezier(0.16,1,0.3,1) forwards' }}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 shrink-0"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>

        <div className="overflow-y-auto px-5 pt-4 pb-8 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-orange-400">ظ…ط§ظƒط±ظˆ ط§ظ„ط´ط¨ظƒط© ظˆط§ظ„طھط¹ط¯ظٹظ†</h2>
              <p className="text-sm text-white/40 mt-0.5 leading-relaxed">
                ظ„ظˆط­ط© ظ‚ظٹط§ط¯ط© ط§ظ‚طھطµط§ط¯ظٹط© ظ„طھظ‚ظٹظٹظ… ط§ظ„ظ†ط¯ط±ط©طŒ ط§ظ„طھظƒظ„ظپط©طŒ ظˆطµط­ط© ط§ظ„ط¨ظ„ظˆظƒطھط´ظٹظ†
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/[0.06] text-white/40 hover:text-white shrink-0">
              <X className="w-6 h-6" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* â”€â”€ Epoch Progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-white/40">ط¯ظˆط±ط© ط§ظ„طھظ†طµظٹظپ ط§ظ„ظ‚ط§ط¯ظ…ط© (Halving Epoch 5)</p>
                  <span className="text-sm font-mono font-black text-white">{epochPct.toFixed(2)}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden mb-3">
                  <div className="h-full rounded-full" style={{ width: `${epochPct}%`, background: 'linear-gradient(90deg,#f97316,#ea580c)' }} />
                </div>
                <div className="flex justify-between text-sm font-mono text-white/30">
                  <span>ط§ظ„ظ…ظƒط§ظپط¢طھ ط§ظ„ظ…ظ†طھط¸ط±ط©: <span className="text-white/60 font-bold">BTC 3.125</span></span>
                  <span>ط§ظ„ظ…ظƒط§ظپط¢طھ ط§ظ„ط­ط§ظ„ظٹط©: <span className="text-white/50">{currentBlock.toLocaleString()}</span></span>
                </div>
              </div>

              {/* â”€â”€ Price vs Cost â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="grid grid-cols-2 gap-3">
                {/* Production cost */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <p className="text-sm text-white/40 font-mono">طھظƒظ„ظپط© ط§ظ„ط¥ظ†طھط§ط¬ (BTC 1)</p>
                  </div>
                  <p className="text-[17px] font-mono font-black tabular-nums text-white">
                    ${BTC_PRODUCTION_COST.toLocaleString()}
                  </p>
                  <p className={`text-sm mt-1 font-semibold ${priceAboveCost ? 'text-red-400' : 'text-emerald-400'}`}>
                    ط¹ط¬ط² طھظ‚ط¯ظٹط±ظٹ: {priceAboveCost ? '-' : '+'}{Math.abs(parseFloat(priceVsCost))}%
                  </p>
                </div>
                {/* Spot price */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <p className="text-sm text-white/40 font-mono">ط§ظ„ط³ط¹ط± ط§ظ„ظ„ط­ط¸ظٹ (Spot)</p>
                  </div>
                  <p className="text-[17px] font-mono font-black tabular-nums text-white">
                    ${spotPrice > 0 ? spotPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '---'}
                  </p>
                  <p className="text-sm text-white/30 mt-1">طھط³ط¹ظٹط± ط§ظ„ط³ظˆظ‚ ط§ظ„ط®ط§ط±ط¬ظٹ</p>
                </div>
              </div>

              {/* â”€â”€ Mempool + Ribbons + Hashrate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="grid grid-cols-3 gap-3">
                {/* Mempool */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col">
                  <p className="text-sm text-white/40 mb-0.5">ط¥ط²ط¯ط­ط§ظ…</p>
                  <p className="text-sm text-white/25 mb-2">(Mempool)</p>
                  <p className="text-base font-mono font-black tabular-nums text-white leading-none">
                    {data!.mempoolTx > 0 ? data!.mempoolTx.toLocaleString() : '---'}
                  </p>
                  <p className="text-sm text-white/30 mt-0.5">Tx</p>
                  <p className={`text-sm font-bold mt-1 ${mStatusColor}`}>{mStatusAr}</p>
                </div>

                {/* Ribbons */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col">
                  <p className="text-sm text-white/40 mb-0.5">ط£ط´ط±ط·ط© ط§ظ„ظ‡ط§ط´</p>
                  <p className="text-sm text-white/25 mb-2">(Ribbons)</p>
                  <p className={`text-sm font-bold leading-tight mt-auto ${ribbonColor}`}>
                    {ribbonSignal}
                  </p>
                  <p className="text-sm text-white/25 mt-1">
                    {data!.hashrateChange24h > 0 ? 'Recovery' : 'Sell Signal'}
                  </p>
                </div>

                {/* Hashrate */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Cpu className="w-2.5 h-2.5 text-white/30" />
                    <p className="text-sm text-white/40">ط§ظ„ظ‚ظˆط© ط§ظ„ط­ظˆط³ط¨ظٹط©</p>
                  </div>
                  <p className="text-sm text-white/25 mb-2"> </p>
                  <p className="text-base font-mono font-black tabular-nums text-white leading-none">
                    {data!.hashrateEH > 0 ? data!.hashrateEH : '---'}
                  </p>
                  <p className="text-sm text-white/30 mt-0.5">EH/s</p>
                  <p className={`text-sm font-bold mt-1 ${data!.hashrateChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data!.hashrateChange24h >= 0 ? '+' : ''}{data!.hashrateChange24h}% (24h)
                  </p>
                </div>
              </div>

              {/* â”€â”€ Stats rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-1">
                <StatRow label="طµط¹ظˆط¨ط© ط§ظ„طھط¹ط¯ظٹظ† ط§ظ„طھط±ط§ظƒظ…ظٹط©"
                  value={data!.difficulty > 0 ? `${data!.difficulty}T` : '---'}
                  valueColor="text-orange-400" />
                <StatRow label="ظ…طھظˆط³ط· ط§ظ„ط¨ظ„ظˆظƒط§طھ ط§ظ„ظٹظˆظ…ظٹط©"
                  value={data!.avgDailyBlocks.toString()} />
                <StatRow label="ط§ظ„ظƒطھظ„ط© ط§ظ„ط­ط§ظ„ظٹط©"
                  value={currentBlock > 0 ? currentBlock.toLocaleString() : '---'} />
                <StatRow label="ط¨ظ„ظˆظƒط§طھ ظ…طھط¨ظ‚ظٹط© ظ„ظ„ظ‡ط§ظ„ظپظٹظ†ط¬"
                  value={currentBlock > 0 ? Math.max(0, HALVING_END - currentBlock).toLocaleString() : '---'} />
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-1">
                <Layers className="w-3.5 h-3.5 text-white/20" />
                <p className="text-sm text-white/25 font-mono">ط¨ظٹط§ظ†ط§طھ ظ…ظ† mempool.space آ· طھط­ط¯ظٹط« ظپظˆط±ظٹ</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
