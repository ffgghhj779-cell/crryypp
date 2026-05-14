/**
 * lib/sanitize.ts
 * Central input sanitization for all user-supplied values.
 * VULN-02: Prevents XSS and injection via symbol/timeframe fields.
 */

const VALID_SYMBOL   = /^[A-Z0-9]{2,20}$/;
const VALID_INTERVALS = new Set([
  '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
]);

/** Sanitize a trading symbol — strips non-alphanumeric, enforces uppercase, rejects invalid format. */
export function sanitizeSymbol(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  if (!VALID_SYMBOL.test(cleaned)) {
    throw new Error(`رمز غير صالح: "${raw}". مثال صحيح: BTCUSDT`);
  }
  return cleaned;
}

/** Sanitize a Binance kline interval string. */
export function sanitizeInterval(raw: string): string {
  if (!VALID_INTERVALS.has(raw)) {
    throw new Error(`إطار زمني غير صالح: "${raw}"`);
  }
  return raw;
}

/** Escape Telegram MarkdownV2 special characters in user-supplied strings (VULN-03). */
export function escapeMarkdownV2(text: string): string {
  // Per Telegram docs: _ * [ ] ( ) ~ ` > # + - = | { } . ! must be escaped
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/** Strip any HTML tags from a string to prevent stored XSS. */
export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}
