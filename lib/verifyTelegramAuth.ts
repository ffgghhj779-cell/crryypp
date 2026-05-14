/**
 * lib/verifyTelegramAuth.ts
 * VULN-14: Cryptographic verification of Telegram WebApp initData.
 *
 * Telegram signs the initData string with HMAC-SHA256 using a key derived from
 * the bot token. This must be verified SERVER-SIDE — client-supplied user IDs
 * (WebApp.initDataUnsafe) can be trivially spoofed via DevTools.
 *
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import crypto from 'crypto';

export interface TelegramUser {
  id:         number;
  first_name: string;
  last_name?: string;
  username?:  string;
  language_code?: string;
}

export interface VerifyResult {
  valid:  boolean;
  user?:  TelegramUser;
  error?: string;
}

/**
 * Verifies the HMAC signature of Telegram's initData string.
 * Returns the verified user object only if the signature is valid.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
): VerifyResult {
  if (!initData || !botToken) {
    return { valid: false, error: 'Missing initData or botToken' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return { valid: false, error: 'Missing hash in initData' };

    params.delete('hash');

    // Build the data-check string: sorted key=value pairs joined by \n
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Derive the secret key: HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Compute expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const hashBuffer     = Buffer.from(hash,         'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (hashBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: 'Hash length mismatch' };
    }

    if (!crypto.timingSafeEqual(hashBuffer, expectedBuffer)) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Check auth_date is not stale (reject tokens older than 24 hours)
    const authDate = parseInt(params.get('auth_date') ?? '0', 10);
    const age      = Math.floor(Date.now() / 1000) - authDate;
    if (age > 86_400) {
      return { valid: false, error: 'initData is expired (> 24h)' };
    }

    // Parse and return the verified user
    const userRaw = params.get('user');
    if (!userRaw) return { valid: false, error: 'No user in initData' };

    const user: TelegramUser = JSON.parse(userRaw);
    return { valid: true, user };

  } catch (err: any) {
    return { valid: false, error: `Verification error: ${err.message}` };
  }
}
