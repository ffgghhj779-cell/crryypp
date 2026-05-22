/**
 * app/api/ewa/route.ts
 *
 * Elliott Wave Analysis (EWA) API Route Handler — v1.1
 * =====================================================
 *
 * ARCHITECTURE (v1.1 — Bybit/OKX switch):
 *  POST /api/ewa  →  Authenticate Telegram user
 *                 →  Rate-limit check (3 req/min per user)
 *                 →  Forward symbol + timeframes to Python microservice
 *                 →  Python fetches OHLCV from Bybit/OKX internally
 *                 →  Return EWAResult JSON
 *
 * WHAT CHANGED FROM v1.0:
 *  Previously, Next.js fetched OHLCV bars from Binance and sent them to Python.
 *  This caused HTTP 451 (Geo-Restriction) errors on Render/cloud servers because
 *  Binance blocks cloud-server IP ranges.
 *
 *  Now, this route only sends the symbol and timeframes to Python. The Python
 *  microservice fetches its own OHLCV data from Bybit (fallback: OKX), which
 *  both work reliably from any cloud IP.
 *
 * SECURITY:
 *  - Telegram initData cryptographic verification
 *  - EWA-specific rate limit: 3 requests per minute per Telegram user ID
 *  - X-Service-Key internal auth to the Python microservice
 *  - All user inputs sanitized
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData }    from '@/lib/verifyTelegramAuth';

// ─── Configuration ────────────────────────────────────────────────────────────

const EWA_PYTHON_URL = process.env.EWA_PYTHON_URL ?? 'http://localhost:8001';

const EWA_RATE_LIMIT_MAX    = 3;
const EWA_RATE_LIMIT_WINDOW = 60_000; // 60 seconds

const ewaRateMap = new Map<string, { count: number; resetAt: number }>();

// Valid timeframes accepted by the Python engine
const VALID_TIMEFRAMES = new Set(['15m', '1h', '4h', '1d', '3d', '1w']);

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

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

  // Evict stale entries to prevent memory leak
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

// ─── Input Parser ─────────────────────────────────────────────────────────────

function parseRequestBody(body: unknown): {
  symbol:    string;
  macro_tf:  string;
  micro_tf:  string;
  init_data: string;
} {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object.');
  }

  const b = body as Record<string, unknown>;

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

  const macro_tf = String(b.macro_tf).toLowerCase().trim();
  const micro_tf = String(b.micro_tf).toLowerCase().trim();

  if (!VALID_TIMEFRAMES.has(macro_tf)) {
    throw new Error(`Invalid macro_tf: "${macro_tf}". Valid options: ${[...VALID_TIMEFRAMES].join(', ')}`);
  }
  if (!VALID_TIMEFRAMES.has(micro_tf)) {
    throw new Error(`Invalid micro_tf: "${micro_tf}". Valid options: ${[...VALID_TIMEFRAMES].join(', ')}`);
  }

  return {
    symbol:    String(b.symbol).toUpperCase().trim().replace(/[^A-Z0-9]/g, ''),
    macro_tf,
    micro_tf,
    init_data: b.init_data,
  };
}

// ─── Python RPC ───────────────────────────────────────────────────────────────

async function callPythonEWA(payload: {
  symbol:           string;
  macro_tf:         string;
  micro_tf:         string;
  telegram_user_id: number;
}): Promise<unknown> {
  const controller = new AbortController();
  // Python fetches from Bybit + runs analysis — allow up to 20 seconds
  const timeoutId  = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${EWA_PYTHON_URL}/analyze`, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'X-Service-Key': process.env.EWA_SERVICE_KEY ?? 'dev-internal-key',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Python EWA service returned ${res.status}: ${errBody.slice(0, 300)}`);
    }

    return await res.json();
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Python EWA analysis timed out after 20 seconds.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

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

  // ── 2. Telegram auth verification ────────────────────────────────────────
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

  // ── 3. Rate limiting ─────────────────────────────────────────────────────
  const rateLimit = checkEWARateLimit(telegramUserId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:          'EWA rate limit exceeded. Maximum 3 analyses per minute.',
        code:           'RATE_LIMITED',
        retry_after_ms: rateLimit.resetAt - Date.now(),
      },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit':     String(EWA_RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // ── 4. Check Python service is configured in production ───────────────────
  if (!process.env.EWA_PYTHON_URL && process.env.NODE_ENV === 'production') {
    console.error('[EWA] EWA_PYTHON_URL is not set in production environment.');
    return NextResponse.json(
      { error: 'EWA microservice not configured.', code: 'SERVICE_UNAVAILABLE' },
      { status: 503 }
    );
  }

  // ── 5. Call Python EWA microservice ──────────────────────────────────────
  //    Python handles all OHLCV fetching internally via Bybit/OKX.
  //    No Binance calls from this route anymore.
  let ewaResult: unknown;
  try {
    ewaResult = await callPythonEWA({
      symbol:           params.symbol,
      macro_tf:         params.macro_tf,
      micro_tf:         params.micro_tf,
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

  // ── 6. Respond ───────────────────────────────────────────────────────────
  const processingMs = Date.now() - requestStart;
  console.info(
    `[EWA] ${params.symbol} ${params.macro_tf}→${params.micro_tf} ` +
    `user:${telegramUserId} completed in ${processingMs}ms`
  );

  return NextResponse.json(
    {
      ...((ewaResult as object) ?? {}),
      _meta: {
        processing_ms:        processingMs,
        rate_limit_remaining: rateLimit.remaining,
        data_source:          'Bybit/OKX',
      },
    },
    {
      status: 200,
      headers: {
        'X-RateLimit-Limit':     String(EWA_RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'Cache-Control':         'no-store, no-cache',
      },
    }
  );
}

// Only POST is supported
export async function GET()    { return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 }); }
