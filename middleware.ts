import { NextRequest, NextResponse } from 'next/server';

// ─── Telegram access gate ─────────────────────────────────────────────────────
// Routes that must remain publicly accessible.
// - Auth handshake + legal pages need no session to work.
// - Read-only market-data APIs (/api/markets, /api/global, /api/fng, /api/calendar)
//   return only public third-party data (CoinGecko, Alternative.me).
//   They contain zero user PII and no privileged operations, so blocking them
//   would only cause the UI to crash when the tg_session cookie is absent
//   (e.g. on Vercel preview deployments opened in Chrome for testing).
const PUBLIC_PATHS = new Set([
  // Auth & legal
  '/api/auth/verify',
  '/terms',
  '/privacy',
  // Public read-only market data — no user data, safe to expose
  '/api/markets',
  '/api/global',
  '/api/fng',
  '/api/calendar',
]);

// Telegram WebApp WebViews include one of these strings in their User-Agent.
// iOS: "TelegramBot" | "TelegramWebApp" | Telegram Messenger Webview
// Android: varies but always contains "Telegram"
const TELEGRAM_UA_PATTERNS = [
  /Telegram/i,
  /TelegramBot/i,
  /TelegramWebApp/i,
];

function isTelegramUA(ua: string | null): boolean {
  if (!ua) return false;
  return TELEGRAM_UA_PATTERNS.some(p => p.test(ua));
}

const SESSION_COOKIE = 'tg_session';

function block403(): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
    <title>403 — Forbidden</title>
    <style>body{margin:0;background:#000;color:#fff;font-family:sans-serif;
    display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px}
    h1{font-size:3rem;font-weight:900;color:#f97316}p{color:rgba(255,255,255,0.4);text-align:center;max-width:320px}
    </style></head><body>
    <h1>403</h1>
    <p>هذا التطبيق متاح فقط داخل تطبيق Telegram.</p>
    <p style="font-size:12px">This app is only accessible inside the Telegram Mini App.</p>
    </body></html>`,
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// ─── Per-IP rate limiter ───────────────────────────────────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/telegram': { max: 60,  windowMs: 60_000  }, // Telegram sends bursts
  '/api/global':   { max: 10,  windowMs: 60_000  },
  '/api/fng':      { max: 10,  windowMs: 60_000  },
  '/api/markets':  { max: 10,  windowMs: 60_000  },
  '/api/calendar': { max: 10,  windowMs: 60_000  },
  // EWA is CPU-heavy (Python microservice) — strict 3 req/min
  // User-level throttling is also enforced inside /api/ewa/route.ts
  '/api/ewa':      { max: 3,   windowMs: 60_000  },
  'default':       { max: 30,  windowMs: 60_000  },
};

function getLimit(pathname: string) {
  return LIMITS[pathname] ?? LIMITS['default'];
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Telegram access gate ───────────────────────────────────────────────────
  // Public paths bypass the gate entirely
  const isPublic = [...PUBLIC_PATHS].some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!isPublic) {
    const ua            = req.headers.get('user-agent');
    const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const hasValidUA    = isTelegramUA(ua);
    // Allow if: Telegram UA detected OR previously verified session cookie present
    if (!hasValidUA && !sessionCookie) {
      return block403();
    }
  }

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next();

  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const key   = `${ip}:${pathname}`;
  const now   = Date.now();
  const { max, windowMs } = getLimit(pathname);

  const entry = rateMap.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  rateMap.set(key, entry);

  // Evict stale entries periodically to prevent memory growth
  if (rateMap.size > 10_000) {
    for (const [k, v] of rateMap) {
      if (Date.now() > v.resetAt) rateMap.delete(k);
    }
  }

  if (entry.count > max) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After':          String(Math.ceil((entry.resetAt - now) / 1000)),
        'X-RateLimit-Limit':    String(max),
        'X-RateLimit-Remaining':'0',
        'X-RateLimit-Reset':    String(Math.ceil(entry.resetAt / 1000)),
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set('X-RateLimit-Limit',     String(max));
  res.headers.set('X-RateLimit-Remaining', String(max - entry.count));
  return res;
}

export const config = { matcher: '/api/:path*' };
