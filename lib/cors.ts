/**
 * lib/cors.ts
 * CORS allowlist for Next.js API routes. (VULN-05)
 * Only requests from known origins receive the Access-Control-Allow-Origin header.
 * All other origins are served without CORS headers — the browser blocks them.
 */

const ALLOWED_ORIGINS = new Set([
  // Add your production Vercel URL here:
  process.env.APP_URL ?? '',
  // Telegram WebApp iframe origin
  'https://web.telegram.org',
  // Telegram Mini App CDN variants
  'https://webk.telegram.org',
  'https://webz.telegram.org',
].filter(Boolean));

export function applyCORS(response: Response, requestOrigin: string | null): Response {
  if (!requestOrigin || !ALLOWED_ORIGINS.has(requestOrigin)) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin',  requestOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Vary', 'Origin'); // Prevent cached CORS headers for wrong origins

  return new Response(response.body, { status: response.status, headers });
}

/** Handle CORS preflight OPTIONS requests. */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  const origin = req.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age':       '86400',
      'Vary':                         'Origin',
    },
  });
}
