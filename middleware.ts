import { NextRequest, NextResponse } from 'next/server';

// ─── Per-IP rate limiter (Edge runtime, in-memory per instance) ──────────────
// For production scale, replace the Map with Vercel KV or Upstash Redis.
const rateMap = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/telegram': { max: 60,  windowMs: 60_000  }, // Telegram sends bursts
  '/api/global':   { max: 10,  windowMs: 60_000  },
  '/api/fng':      { max: 10,  windowMs: 60_000  },
  '/api/markets':  { max: 10,  windowMs: 60_000  },
  '/api/calendar': { max: 10,  windowMs: 60_000  },
  'default':       { max: 30,  windowMs: 60_000  },
};

function getLimit(pathname: string) {
  return LIMITS[pathname] ?? LIMITS['default'];
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
