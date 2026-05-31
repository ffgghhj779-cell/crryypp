/**
 * lib/assetInfo.ts
 * Per-asset metadata for display formatting.
 * Keeps currency, precision, and human-readable labels consistent across all tools.
 */

export interface AssetInfo {
  /** ISO currency code for display (USD, EGP) */
  currency:  'USD' | 'EGP';
  /** Short unit label shown after prices */
  unit:      string;
  /** Arabic label */
  labelAr:   string;
  /** Price decimal places */
  precision: number;
  /** Currency symbol prefix */
  prefix:    string;
}

const ASSET_MAP: Record<string, AssetInfo> = {
  // ── Crypto ──────────────────────────────────────────────────────────────────
  BTCUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'بيتكوين',  precision: 2, prefix: '$' },
  ETHUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'إيثريوم',  precision: 2, prefix: '$' },
  BNBUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'بي إن بي', precision: 3, prefix: '$' },
  SOLUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'سولانا',   precision: 3, prefix: '$' },
  XRPUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'ريبل',     precision: 5, prefix: '$' },
  ADAUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'كاردانو',  precision: 5, prefix: '$' },
  DOGEUSDT:  { currency: 'USD', unit: 'USDT', labelAr: 'دوجكوين',  precision: 6, prefix: '$' },
  LTCUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'لايتكوين', precision: 2, prefix: '$' },
  DOTUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'بولكاداوت', precision: 4, prefix: '$' },
  AVAXUSDT:  { currency: 'USD', unit: 'USDT', labelAr: 'أفالانش',  precision: 3, prefix: '$' },
  LINKUSDT:  { currency: 'USD', unit: 'USDT', labelAr: 'تشين لينك', precision: 4, prefix: '$' },
  UNIUSDT:   { currency: 'USD', unit: 'USDT', labelAr: 'يوني سواب', precision: 4, prefix: '$' },
  MATICUSDT: { currency: 'USD', unit: 'USDT', labelAr: 'بوليجون',  precision: 5, prefix: '$' },
  // ── Commodities ─────────────────────────────────────────────────────────────
  XAUUSD:    { currency: 'USD', unit: 'USD/oz',     labelAr: 'ذهب عالمي',   precision: 2, prefix: '$' },
  WTIUSD:    { currency: 'USD', unit: 'USD/bbl',    labelAr: 'نفط WTI',     precision: 2, prefix: '$' },
  BRENTUSD:  { currency: 'USD', unit: 'USD/bbl',    labelAr: 'برنت',        precision: 2, prefix: '$' },
  USDEGP:    { currency: 'EGP', unit: 'جنيه/دولار', labelAr: 'دولار/جنيه', precision: 2, prefix: '' },
  EGYXAU:    { currency: 'EGP', unit: 'جنيه/جرام',  labelAr: 'ذهب مصري',   precision: 0, prefix: '' },
  EURUSD:    { currency: 'USD', unit: 'USD',        labelAr: 'EUR/USD',    precision: 4, prefix: '$' },
};

/** Fallback for unknown symbols */
const DEFAULT_ASSET: AssetInfo = {
  currency: 'USD', unit: 'USDT', labelAr: 'أصل مالي', precision: 2, prefix: '$',
};

/**
 * Returns display metadata for a given symbol.
 * Safe — never throws; returns default for unknown symbols.
 */
export function getAssetInfo(symbol: string): AssetInfo {
  return ASSET_MAP[symbol.toUpperCase().trim()] ?? DEFAULT_ASSET;
}

/**
 * Returns the Arabic display name for a symbol.
 * Examples:
 *   assetLabelAr('XAUUSD')  → 'ذهب عالمي'
 *   assetLabelAr('EGYXAU')  → 'ذهب مصري'
 *   assetLabelAr('BTCUSDT') → 'بيتكوين'
 *   assetLabelAr('UNKNOWN') → 'UNKNOWN'
 */
export function assetLabelAr(symbol: string): string {
  return (ASSET_MAP[symbol.toUpperCase().trim()] ?? DEFAULT_ASSET).labelAr || symbol;
}

/**
 * Returns just the currency prefix for a symbol.
 * Use this to prefix price strings: `${currencyPrefix(symbol)}${price}`
 * For EGP assets it returns '' (suffix style — use formatAssetPrice instead).
 */
export function currencyPrefix(symbol: string): string {
  return getAssetInfo(symbol).prefix;
}

/**
 * Formats a price number according to its asset's convention.
 * Examples:
 *   formatAssetPrice(3340.25, 'XAUUSD')  → '$3,340.25'
 *   formatAssetPrice(4850, 'EGYXAU')     → '4,850 جنيه'
 *   formatAssetPrice(50.85, 'USDEGP')    → '50.85 جنيه'
 *   formatAssetPrice(105000, 'BTCUSDT')  → '$105,000.00'
 */
export function formatAssetPrice(price: number, symbol: string): string {
  const info = getAssetInfo(symbol);
  const formatted = price.toLocaleString('en-US', {
    minimumFractionDigits: info.precision,
    maximumFractionDigits: info.precision,
  });
  return info.prefix
    ? `${info.prefix}${formatted}`
    : `${formatted} ${info.unit}`;
}
