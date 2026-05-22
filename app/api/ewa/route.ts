/**
 * app/api/ewa/route.ts
 *
 * Elliott Wave Analysis (EWA) API Route Handler.
 *
 * ARCHITECTURE:
 *  POST /api/ewa  →  Validate input  →  Fetch dual-TF OHLCV  →  Python EWA microservice
 *                 →  Return typed EWAResult JSON
 *
 * SECURITY:
 *  - Telegram initData cryptographic verification (reuses existing verifyTelegramInitData)
 *  - EWA-specific rate limit: 3 requests per minute per Telegram user ID
 *    (EWA is CPU-heavy on the Python side — strict throttling is required)
 *  - Spot-Lock enforced by fetchDualTFBars (never touches futures endpoints)
 *  - All user inputs sanitized before any network call
 *
 * PYTHON RPC:
 *  The Python EWA microservice runs as a separate process/container.
 *  It is called via HTTP POST to EWA_PYTHON_URL (env var).
 *  If EWA_PYTHON_URL is not set, the route returns 503 with a clear error.
 *  The Python service is stateless — it receives OHLCV + config, returns JSON.
 *
 * CACHING:
 *  No caching on this route. EWA results must reflect the latest closed candle.
 *  The Python service may implement its own memoization per (symbol, TF, bar_count).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData }    from '@/lib/verifyTelegramAuth';
import { fetchDualTFBars, validateEWARequest } from '@/lib/binance/ewa-fetcher';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Python EWA microservice URL.
 * In development: http://localhost:8001
 * In production: set via environment variable EWA_PYTHON_URL
 */
const EWA_PYTHON_URL = process.env.EWA_PYTHON_URL ?? 'http://localhost:8001';

/**
 * EWA-specific rate limit: max 3 requests per 60 seconds per Telegram user.
 * Stored in module-level Map (process-scoped). In production with multiple
 * Vercel instances, upgrade to Redis-backed rate limiting.
 */
const EWA_RATE_LIMIT_MAX     = 3;
const EWA_RATE_LIMIT_WINDOW  = 60_000; // 60 seconds

const ewaRateMap = new Map<string, { count: number; resetAt: number }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * EWA-specific per-user rate limiter (keyed by Telegram user ID, not IP).
 * User-ID keying is more accurate than IP keying for TMA users who may
 * share IPs (mobile carrier NAT, corporate proxies, etc.).
 */
function checkEWARateLimit(telegramUserId: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const key = `ewa:${telegramUserId}`;
  const now = Date.now();

  let entry = ewaRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + EWA_RATE_LIMIT_WINDOW };
  }

  entry.count++;
  ewaRateMap.set(key, entry);

  // Evict stale entries to prevent memory leak in long-running processes
  if (ewaRateMap.size > 5_000) {
    for (const [k, v] of ewaRateMap) {
      if (Date.now() > v.resetAt) ewaRateMap.delete(k);
    }
  }

  return {
    allowed:   entry.count <= EWA_RATE_LIMIT_MAX,
    remaining: Math.max(0, EWA_RATE_LIMIT_MAX - entry.count),
    resetAt:   entry.resetAt,
  };
}

/**
 * Validate the JSON request body structure and business rules.
 * Returns typed params or throws with a descriptive message.
 */
function parseRequestBody(body: unknown): {
  symbol:      string;
  macro_tf:    string;
  micro_tf:    string;
  macro_limit: number;
  micro_limit: number;
  init_data:   string;
} {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object.');
  }

  const b = body as Record<string, unknown>;

  // Required fields
  if (typeof b.init_data !== 'string' || !b.init_data) {
    throw new Error('Missing required field: init_data (Telegram WebApp.initData).');
  }
  if (typeof b.symbol !== 'string' || !b.symbol) {
    throw new Error('Missing required field: symbol (e.g. "BTCUSDT").');
  }
  if (typeof b.macro_tf !== 'string' || !b.macro_tf) {
    throw new Error('Missing required field: macro_tf (e.g. "1d").');
  }
  if (typeof b.micro_tf !== 'string' || !b.micro_tf) {
    throw new Error('Missing required field: micro_tf (e.g. "1h").');
  }

  // Optional limits with safe defaults
  const macro_limit = typeof b.macro_limit === 'number'
    ? Math.min(Math.max(50, Math.floor(b.macro_limit)), 500)
    : 500;

  const micro_limit = typeof b.micro_limit === 'number'
    ? Math.min(Math.max(50, Math.floor(b.micro_limit)), 300)
    : 300;

  return {
    symbol:      String(b.symbol).toUpperCase().trim(),
    macro_tf:    String(b.macro_tf).toLowerCase().trim(),
    micro_tf:    String(b.micro_tf).toLowerCase().trim(),
    macro_limit,
    micro_limit,
    init_data:   b.init_data,
  };
}

/**
 * Calls the Python EWA microservice with OHLCV data and analysis config.
 * The Python service is stateless — it accepts OHLCV arrays and returns
 * the fully computed EWAResult JSON schema.
 */
async function callPythonEWA(payload: {
  symbol:      string;
  macro_tf:    string;
  micro_tf:    string;
  macro_bars:  unknown[];
  micro_bars:  unknown[];
  telegram_user_id: number;
}): Promise<unknown> {
  const controller = new AbortController();
  // Python analysis can take up to 15 seconds for large bar arrays
  const timeoutId  = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${EWA_PYTHON_URL}/analyze`, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        // Internal service auth — Python checks this header
        'X-Service-Key': process.env.EWA_SERVICE_KEY ?? 'dev-internal-key',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(
        `Python EWA service returned ${res.status}: ${errBody.slice(0, 300)}`
      );
    }

    return await res.json();
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Python EWA analysis timed out after 15 seconds.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'; // Never cache EWA responses

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestStart = Date.now();

  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  let params: ReturnType<typeof parseRequestBody>;
  try {
    params = parseRequestBody(body);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message, code: 'INVALID_PARAMS' },
      { status: 400 }
    );
  }

  // ── 2. Cryptographic Telegram auth verification ───────────────────────────
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[EWA] TELEGRAM_BOT_TOKEN environment variable is not set.');
    return NextResponse.json(
      { error: 'Server configuration error.', code: 'SERVER_CONFIG' },
      { status: 503 }
    );
  }

  const authResult = verifyTelegramInitData(params.init_data, botToken);
  if (!authResult.valid || !authResult.user) {
    return NextResponse.json(
      {
        error:  'Telegram authentication failed.',
        detail: authResult.error,
        code:   'AUTH_FAILED',
      },
      { status: 401 }
    );
  }

  const telegramUserId = authResult.user.id;

  // ── 3. EWA-specific rate limiting (per Telegram user ID) ─────────────────
  const rateLimit = checkEWARateLimit(telegramUserId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:     'EWA rate limit exceeded. Maximum 3 analyses per minute.',
        code:      'RATE_LIMITED',
        retry_after_ms: rateLimit.resetAt - Date.now(),
      },
      {
        status:  429,
        headers: {
          'Retry-After':          String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit':    String(EWA_RATE_LIMIT_MAX),
          'X-RateLimit-Remaining':'0',
        },
      }
    );
  }

  // ── 4. Pre-validate EWA request (Spot-Lock + TF guard, no network yet) ───
  const preValidation = validateEWARequest(
    params.symbol,
    params.macro_tf,
    params.micro_tf,
  );
  if (!preValidation.valid) {
    return NextResponse.json(
      { error: preValidation.error, code: 'SPOT_LOCK_VIOLATION' },
      { status: 400 }
    );
  }

  // ── 5. Check Python service is configured ─────────────────────────────────
  if (!process.env.EWA_PYTHON_URL && process.env.NODE_ENV === 'production') {
    console.error('[EWA] EWA_PYTHON_URL is not set in production environment.');
    return NextResponse.json(
      { error: 'EWA microservice not configured.', code: 'SERVICE_UNAVAILABLE' },
      { status: 503 }
    );
  }

  // ── 6. Fetch OHLCV from Binance Spot (concurrent dual-TF) ─────────────────
  let ohlcvData: Awaited<ReturnType<typeof fetchDualTFBars>>;
  try {
    ohlcvData = await fetchDualTFBars({
      symbol:      params.symbol,
      macro_tf:    params.macro_tf,
      micro_tf:    params.micro_tf,
      macro_limit: params.macro_limit,
      micro_limit: params.micro_limit,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    console.error(`[EWA] OHLCV fetch error for ${params.symbol}:`, msg);

    // Distinguish Spot-Lock violations from network errors
    const isSpotLock = msg.includes('EWA-SPOT-LOCK') || msg.includes('EWA-TF-GUARD');
    return NextResponse.json(
      {
        error: msg,
        code:  isSpotLock ? 'SPOT_LOCK_VIOLATION' : 'FETCH_ERROR',
      },
      { status: isSpotLock ? 400 : 502 }
    );
  }

  // Sanity check: refuse analysis if we don't have enough bars
  const MIN_BARS_MACRO = 50;
  const MIN_BARS_MICRO = 30;
  if (ohlcvData.macro.bar_count < MIN_BARS_MACRO) {
    return NextResponse.json(
      {
        error: `Insufficient macro bars: got ${ohlcvData.macro.bar_count}, need ≥ ${MIN_BARS_MACRO}.`,
        code:  'INSUFFICIENT_DATA',
      },
      { status: 422 }
    );
  }
  if (ohlcvData.micro.bar_count < MIN_BARS_MICRO) {
    return NextResponse.json(
      {
        error: `Insufficient micro bars: got ${ohlcvData.micro.bar_count}, need ≥ ${MIN_BARS_MICRO}.`,
        code:  'INSUFFICIENT_DATA',
      },
      { status: 422 }
    );
  }

  // ── 7. Call Python EWA analysis microservice ──────────────────────────────
  let ewaResult: unknown;
  try {
    ewaResult = await callPythonEWA({
      symbol:           ohlcvData.symbol,
      macro_tf:         ohlcvData.macro.timeframe,
      micro_tf:         ohlcvData.micro.timeframe,
      macro_bars:       ohlcvData.macro.bars,
      micro_bars:       ohlcvData.micro.bars,
      telegram_user_id: telegramUserId,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    console.error('[EWA] Python service error:', msg);
    return NextResponse.json(
      { error: `EWA analysis failed: ${msg}`, code: 'PYTHON_SERVICE_ERROR' },
      { status: 502 }
    );
  }

  // ── 8. Respond with EWA result + performance metadata ─────────────────────
  const processingMs = Date.now() - requestStart;
  console.info(
    `[EWA] ${params.symbol} ${params.macro_tf}→${params.micro_tf} ` +
    `user:${telegramUserId} completed in ${processingMs}ms`
  );

  return NextResponse.json(
    {
      ...((ewaResult as object) ?? {}),
      // Attach server-side metadata for debugging / client-side display
      _meta: {
        processing_ms:     processingMs,
        macro_bars_used:   ohlcvData.macro.bar_count,
        micro_bars_used:   ohlcvData.micro.bar_count,
        fetched_at:        ohlcvData.fetched_at,
        rate_limit_remaining: rateLimit.remaining,
      },
    },
    {
      status:  200,
      headers: {
        'X-RateLimit-Limit':     String(EWA_RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'Cache-Control':         'no-store, no-cache',
      },
    }
  );
}

// Only POST is supported — reject all other methods
export async function GET()    { return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 }); }
