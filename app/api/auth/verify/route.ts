// app/api/auth/verify/route.ts
// VULN-14: Server-side endpoint to verify Telegram WebApp initData.
// On success, sets a secure HttpOnly session cookie so subsequent
// middleware checks can pass even after UA changes (e.g. browser reload).

import { verifyTelegramInitData } from '@/lib/verifyTelegramAuth';

const SESSION_COOKIE   = 'tg_session';
const SESSION_MAX_AGE  = 60 * 60 * 24; // 24 hours

export async function POST(req: Request) {
  try {
    const body     = await req.json();
    const initData = body?.initData;

    if (!initData || typeof initData !== 'string') {
      return Response.json({ error: 'initData is required' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return Response.json({ error: 'Bot not configured' }, { status: 503 });
    }

    const result = verifyTelegramInitData(initData, botToken);

    if (!result.valid || !result.user) {
      console.warn('[Auth] Rejected invalid initData:', result.error);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Issue a session cookie — HttpOnly so JS cannot read it,
    // Secure so it's only sent over HTTPS, SameSite=Strict to prevent CSRF.
    const cookieValue = Buffer.from(
      JSON.stringify({ uid: result.user.id, iat: Math.floor(Date.now() / 1000) })
    ).toString('base64');

    const res = Response.json({
      userId:    result.user.id,
      firstName: result.user.first_name,
      username:  result.user.username ?? null,
    });

    const headers = new Headers(res.headers);
    headers.set(
      'Set-Cookie',
      `${SESSION_COOKIE}=${cookieValue}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}; Path=/`
    );

    return new Response(res.body, { status: 200, headers });

  } catch (err: any) {
    console.error('[Auth] Verification error:', err.message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
