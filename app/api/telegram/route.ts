import { Telegraf, Markup } from 'telegraf';
import { escapeMarkdownV2 } from '@/lib/sanitize';

// ─── Singleton bot instance (safe for serverless cold starts) ─────────────────
// A module-level guard prevents duplicate Telegraf instances across invocations.
let _bot: Telegraf | null = null;
function getBot(): Telegraf {
  if (!_bot) _bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
  return _bot;
}

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';
const APP_URL    = process.env.APP_URL || '';

// ─── Per-user rate limiter (in-memory, resets on cold start) ─────────────────
// Max 10 requests per user per 60-second window.
const rateLimiter = new Map<number, { count: number; resetAt: number }>();

function isRateLimited(userId: number): boolean {
  const now   = Date.now();
  const entry = rateLimiter.get(userId) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) {
    entry.count  = 0;
    entry.resetAt = now + 60_000;
  }
  entry.count++;
  rateLimiter.set(userId, entry);
  return entry.count > 10;
}

// ─── Handlers ────────────────────────────────────────────────────────────────
getBot().command('start', async (ctx) => {
  if (isRateLimited(ctx.from.id)) return; // silent drop — no reply on rate-limit

  try {
    if (!CHANNEL_ID) return await sendWelcomeMessage(ctx);

    const chatMember = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
    const isSubscribed = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);

    if (isSubscribed) {
      await sendWelcomeMessage(ctx);
    } else {
      await ctx.reply(
        '👋 مرحباً! للوصول إلى محطة تحليل العملات الرقمية، يرجى الانضمام إلى قناتنا أولاً.',
        Markup.inlineKeyboard([
          [Markup.button.url('📢 انضم للقناة', `https://t.me/${CHANNEL_ID.replace('@', '')}`)],
          [Markup.button.callback('✅ اشتركت — تحقق', 'check_subscription')],
        ])
      );
    }
  } catch (error) {
    console.error('Error in /start:', error);
    await ctx.reply(
      '⚠️ تعذّر التحقق من اشتراكك. يرجى الانضمام للقناة والمحاولة مجدداً.',
      Markup.inlineKeyboard([
        [Markup.button.url('📢 انضم للقناة', `https://t.me/${CHANNEL_ID.replace('@', '')}`)],
        [Markup.button.callback('✅ اشتركت — تحقق', 'check_subscription')],
      ])
    );
  }
});

getBot().action('check_subscription', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || isRateLimited(userId)) return;

  try {
    if (!CHANNEL_ID) return await sendWelcomeMessage(ctx);
    const chatMember = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
    const isSubscribed = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);

    if (isSubscribed) {
      await ctx.answerCbQuery('✅ تم التحقق! أهلاً بك.');
      await sendWelcomeMessage(ctx);
    } else {
      await ctx.answerCbQuery('❌ لم تشترك بعد. يرجى الانضمام للقناة أولاً.', { show_alert: true });
    }
  } catch (error) {
    console.error('Error in check_subscription:', error);
    await ctx.answerCbQuery('حدث خطأ. يرجى المحاولة لاحقاً.');
  }
});

async function sendWelcomeMessage(ctx: any) {
  const url         = process.env.APP_URL || 'https://t.me';
  const rawChannel  = CHANNEL_ID.replace('@', '') || 'CryptoTerm360';
  const safeChannel = escapeMarkdownV2(rawChannel);

  await ctx.reply(
    '🚀 مرحباً بك في *Crypto Terminal 360*\n\n' +
    '📊 محطة تحليل العملات الرقمية المتكاملة\n' +
    '⚡ 25 أداة تحليل فني لحظية\n' +
    '🔒 بيانات مباشرة من Binance\n\n' +
    'اضغط الزر أدناه لتشغيل التطبيق:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 تشغيل المحطة', url)],
        [Markup.button.url(`📢 قناتنا الرسمية`, `https://t.me/${safeChannel}`)],
      ]),
    }
  );
}

// ─── Webhook handler ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // Guard: reject oversized payloads before buffering (OOM protection)
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 1_000_000) {
    return new Response('Payload Too Large', { status: 413 });
  }

  // Guard: TELEGRAM_WEBHOOK_SECRET must always be set — fail closed, not open
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('[SECURITY] TELEGRAM_WEBHOOK_SECRET is not configured. Refusing all webhook traffic.');
    return new Response('Service Misconfigured', { status: 503 });
  }
  const received = req.headers.get('x-telegram-bot-api-secret-token');
  if (received !== expectedSecret) {
    console.warn('[Security] Rejected webhook with invalid secret token.');
    return new Response('Forbidden', { status: 403 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return Response.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    await getBot().handleUpdate(body);
    return new Response('OK');
  } catch (error: any) {
    console.error('Error handling Telegram update:', error);
    return new Response(error.message || 'Error', { status: 500 });
  }
}
