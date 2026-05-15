import { Telegraf, Markup } from 'telegraf';
import { escapeMarkdownV2 } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

// ─── Config ───────────────────────────────────────────────────────────────────
// TELEGRAM_CHANNEL_ID env var overrides the hardcoded default.
// Always store the channel as "@handle" format.
const CHANNEL_ID  = process.env.TELEGRAM_CHANNEL_ID || '@mycryptoappTT20';
const CHANNEL_URL = `https://t.me/${CHANNEL_ID.replace('@', '')}`;
const APP_URL     = process.env.APP_URL || '';

// ─── Subscription status helper ───────────────────────────────────────────────
// Per spec: only 'creator', 'administrator', 'member' count as subscribed.
// 'restricted', 'left', 'kicked' all get the subscription gate.
function isMember(status: string): boolean {
  return ['creator', 'administrator', 'member'].includes(status);
}

// ─── Shared message content (single source of truth) ─────────────────────────
const WELCOME_TEXT =
  '🚀 *مرحباً بك في Crypto Terminal 360*\n\n' +
  '📊 محطة تحليل العملات الرقمية المتكاملة\n' +
  '⚡ 25 أداة تحليل فني لحظية\n' +
  '🔒 بيانات مباشرة من Binance\n\n' +
  'اضغط الزر أدناه لتشغيل التطبيق:';

const GATE_TEXT =
  '⛔ *عذراً، يجب الاشتراك في قناتنا الرسمية أولاً*\n\n' +
  'لتتمكن من فتح منصة التحليل يرجى الاشتراك في القناة،\n' +
  'ثم الضغط على زر "✅ اشتركت الآن" للتحقق.';

// ─── Inline keyboards ─────────────────────────────────────────────────────────
function gateKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url('📢 اشترك في القناة', CHANNEL_URL)],
    [Markup.button.callback('✅ اشتركت الآن', 'check_subscription')],
  ]);
}

function welcomeKeyboard() {
  const rawChannel  = CHANNEL_ID.replace('@', '');
  const safeChannel = escapeMarkdownV2(rawChannel);
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 تشغيل المحطة', APP_URL)],
    [Markup.button.url(`📢 قناتنا الرسمية @${safeChannel}`, CHANNEL_URL)],
  ]);
}

// ─── Singleton bot instance ───────────────────────────────────────────────────
// Module-level guard prevents duplicate Telegraf instances across invocations.
let _bot: Telegraf | null = null;
function getBot(): Telegraf {
  if (!_bot) _bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
  return _bot;
}

// ─── Per-user rate limiter (in-memory, resets on cold start) ──────────────────
// Max 10 requests per user per 60-second window.
const rateLimiter = new Map<number, { count: number; resetAt: number }>();

function isRateLimited(userId: number): boolean {
  const now   = Date.now();
  const entry = rateLimiter.get(userId) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) {
    entry.count   = 0;
    entry.resetAt = now + 60_000;
  }
  entry.count++;
  rateLimiter.set(userId, entry);
  return entry.count > 10;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Send the welcome message with the Web App launch button (new message). */
async function sendWelcomeMessage(ctx: any) {
  await ctx.reply(WELCOME_TEXT, {
    parse_mode: 'Markdown',
    ...welcomeKeyboard(),
  });
}

/** Edit the current message to become the welcome message with Web App button. */
async function editToWelcome(ctx: any) {
  try {
    await ctx.editMessageText(WELCOME_TEXT, {
      parse_mode: 'Markdown',
      reply_markup: welcomeKeyboard().reply_markup,
    });
  } catch {
    // Message might be too old to edit — fall back to sending a new one
    await sendWelcomeMessage(ctx);
  }
}

/**
 * Check whether a user is subscribed to the channel.
 * Returns true if subscribed, false otherwise.
 * Throws on API errors.
 */
async function checkSubscription(ctx: any, userId: number): Promise<boolean> {
  const chatMember = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
  return isMember(chatMember.status);
}

// ─── /start command ───────────────────────────────────────────────────────────
getBot().command('start', async (ctx) => {
  if (isRateLimited(ctx.from.id)) return; // silent drop on rate-limit

  // If no channel is configured, skip the gate and show welcome directly
  if (!CHANNEL_ID) return sendWelcomeMessage(ctx);

  try {
    const subscribed = await checkSubscription(ctx, ctx.from.id);

    if (subscribed) {
      await sendWelcomeMessage(ctx);
    } else {
      await ctx.reply(GATE_TEXT, {
        parse_mode: 'Markdown',
        ...gateKeyboard(),
      });
    }
  } catch (error) {
    // getChatMember can fail if bot lacks permissions — show gate as safe fallback
    console.error('[/start] getChatMember failed:', error);
    await ctx.reply(GATE_TEXT, {
      parse_mode: 'Markdown',
      ...gateKeyboard(),
    });
  }
});

// ─── check_subscription callback ─────────────────────────────────────────────
// Triggered when the user taps "✅ اشتركت الآن" after joining the channel.
getBot().action('check_subscription', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || isRateLimited(userId)) {
    await ctx.answerCbQuery(); // always acknowledge to dismiss the loading state
    return;
  }

  if (!CHANNEL_ID) {
    await ctx.answerCbQuery('✅ أهلاً بك!');
    await editToWelcome(ctx);
    return;
  }

  try {
    const subscribed = await checkSubscription(ctx, userId);

    if (subscribed) {
      // ── Joined ✅ — dismiss spinner, then swap the message to the welcome view
      await ctx.answerCbQuery('✅ تم التحقق! أهلاً بك في المحطة.');
      await editToWelcome(ctx);
    } else {
      // ── Still not joined ❌ — show an alert popup (show_alert blocks the UI)
      await ctx.answerCbQuery('لم تقم بالاشتراك بعد!', { show_alert: true });
    }
  } catch (error) {
    console.error('[check_subscription] getChatMember failed:', error);
    await ctx.answerCbQuery('⚠️ حدث خطأ في التحقق. يرجى المحاولة مرة أخرى.', {
      show_alert: true,
    });
  }
});

// ─── Webhook POST handler ─────────────────────────────────────────────────────
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
    console.error('[Webhook] Error handling Telegram update:', error);
    return new Response(error.message || 'Internal Error', { status: 500 });
  }
}
