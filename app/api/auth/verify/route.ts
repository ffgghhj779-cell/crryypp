// app/api/auth/verify/route.ts
// VULN-14: Server-side endpoint to verify Telegram WebApp initData.
// The client POSTs the raw initData string; this route validates the HMAC
// and returns a verified user ID — never trust initDataUnsafe on the client.

import { verifyTelegramInitData } from '@/lib/verifyTelegramAuth';

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
      // Log for audit but return generic error to client
      console.warn('[Auth] Rejected invalid initData:', result.error);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return only the fields the client actually needs
    return Response.json({
      userId:    result.user.id,
      firstName: result.user.first_name,
      username:  result.user.username ?? null,
    });

  } catch (err: any) {
    console.error('[Auth] Verification error:', err.message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
