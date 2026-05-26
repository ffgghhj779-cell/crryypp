'use client';

/**
 * components/tools/ContextAssetBar.tsx
 *
 * Self-contained asset selector for context-based tools.
 * Reads and writes to MarketDataContext directly.
 * Insert this at the top of any tool that uses useMarketData().
 */

import { useMarketData } from '@/context/MarketDataContext';
import { SymbolDropdown } from '@/components/tools/SymbolDropdown';

export function ContextAssetBar() {
  const { symbol, setSymbol } = useMarketData();

  return (
    <div className="px-5 pt-4 pb-2">
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
        رمز الأصل المحلل
      </p>
      <SymbolDropdown value={symbol} onChange={setSymbol} />
    </div>
  );
}
