'use client';

import { useEffect, useState } from 'react';
import { X, Clock, Trash2, History, ChevronLeft } from 'lucide-react';
import {
  getHistory, clearHistory, deleteEntry, formatAge,
  type HistoryEntry,
} from '@/lib/utils/historyStore';

interface Props { open: boolean; onClose: () => void; }

const TOOL_COLOR: Record<string, string> = {
  'SMC Order Blocks':   'text-sky-400',
  'GARCH':              'text-emerald-400',
  'Wedge Scanner':      'text-violet-400',
  'Wyckoff':            'text-orange-400',
  'Monte Carlo':        'text-violet-400',
  'Linear Regression':  'text-emerald-400',
  'Markov Model (HMM)': 'text-emerald-400',
  'Fourier Transform':  'text-sky-400',
  'Divergence Scanner': 'text-amber-400',
  'CHOP Index':         'text-amber-400',
  '4x4 Confluence':     'text-amber-400',
  'FVG Scanner':        'text-sky-400',
  'Liquidity Sweep':    'text-sky-400',
  'Order Flow CDD':     'text-sky-400',
  'Double Pattern':     'text-violet-400',
  'Cup & Handle':       'text-violet-400',
  'Head & Shoulders':   'text-violet-400',
  'Triangle Predictor': 'text-violet-400',
  'Market Structure':   'text-sky-400',
};

function color(name: string) { return TOOL_COLOR[name] ?? 'text-orange-400'; }

export function HistorySidebar({ open, onClose }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  // Reload from localStorage every time panel opens
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) setEntries(getHistory()); }, [open]);

  function handleDelete(id: string) {
    deleteEntry(id);
    setEntries(getHistory());
  }

  function handleClearAll() {
    clearHistory();
    setEntries([]);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          style={{ animation: 'fade-in 0.2s ease forwards' }}
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 w-[85vw] max-w-xs flex flex-col"
        style={{
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(40px)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.32s cubic-bezier(0.16,1,0.3,1)',
        }}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-orange-500" />
            <div>
              <h2 className="text-white font-bold text-sm">سجل التحليلات</h2>
              <p className="text-[9px] text-white/30 font-mono">آخر {entries.length} عملية مسح</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/40 hover:text-white bg-white/[0.05] hover:bg-white/10 transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 pb-16">
              <Clock className="w-10 h-10 text-white/10" />
              <p className="text-white/30 text-sm text-center">لا توجد عمليات مسح مسجّلة بعد.</p>
              <p className="text-[10px] text-white/20 text-center leading-relaxed">
                قم بإجراء أي تحليل وسيظهر هنا تلقائياً
              </p>
            </div>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 group"
                style={{ animation: 'slide-up 0.25s cubic-bezier(0.16,1,0.3,1) forwards' }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="shrink-0 p-1 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 active:scale-95"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="text-right min-w-0 flex-1">
                    <p className={`text-[11px] font-bold truncate ${color(e.toolName)}`}>{e.toolName}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[9px] text-white/30 font-mono">{e.timeframe}</span>
                      <span className="text-white/15">·</span>
                      <span className="text-[9px] text-white font-mono font-bold">{e.symbol}</span>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <p className="text-[10px] text-white/45 leading-relaxed text-right border-r-2 border-orange-500/40 pr-2">
                  {e.summary}
                </p>

                {/* Age */}
                <div className="flex justify-end mt-1.5">
                  <span className="flex items-center gap-1 text-[8px] text-white/20 font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    {formatAge(e.timestamp)} مضت
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer actions */}
        {entries.length > 0 && (
          <div className="px-3 py-3 border-t border-white/[0.06] shrink-0 space-y-2">
            <button
              onClick={handleClearAll}
              className="w-full py-2.5 rounded-xl text-[11px] font-bold text-red-400 border border-red-500/20 bg-red-500/[0.05] hover:bg-red-500/10 transition-all active:scale-[0.98]"
            >
              مسح السجل بالكامل
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-[11px] font-bold text-white/50 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              العودة
            </button>
          </div>
        )}
      </div>
    </>
  );
}
