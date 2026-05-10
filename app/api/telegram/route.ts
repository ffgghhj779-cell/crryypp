import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';
const APP_URL = process.env.APP_URL || '';

bot.command('start', async (ctx) => {
  try {
    if (!CHANNEL_ID) {
      return await sendWelcomeMessage(ctx);
    }
    
    // Check channel membership
    const userId = ctx.from.id;
    const chatMember = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
    
    const isSubscribed = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);
    
    if (isSubscribed) {
      await sendWelcomeMessage(ctx);
    } else {
      await ctx.reply(
        'Welcome! To use the Crypto Market App, please subscribe to our channel first.',
        Markup.inlineKeyboard([
          [Markup.button.url('Join Channel', `https://t.me/${CHANNEL_ID.replace('@', '')}`)],
          [Markup.button.callback('✅ I have subscribed', 'check_subscription')]
        ])
      );
    }
  } catch (error) {
    console.error('Error in /start:', error);
    await ctx.reply(
      '⚠️ Could not verify your channel membership. Please ensure you have joined our channel, then try again.',
      Markup.inlineKeyboard([
        [Markup.button.url('Join Channel', `https://t.me/${CHANNEL_ID.replace('@', '')}`)],
        [Markup.button.callback('✅ I have subscribed', 'check_subscription')]
      ])
    );
  }
});

bot.action('check_subscription', async (ctx) => {
  try {
    if (!CHANNEL_ID) return await sendWelcomeMessage(ctx);
    const userId = ctx.from?.id;
    if (!userId) return;

    const chatMember = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
    const isSubscribed = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);

    if (isSubscribed) {
      await ctx.answerCbQuery('Subscription verified! Welcome.');
      await sendWelcomeMessage(ctx);
    } else {
      await ctx.answerCbQuery('You have not subscribed yet. Please join the channel first.', { show_alert: true });
    }
  } catch (error) {
    console.error('Error in check_subscription:', error);
    await ctx.answerCbQuery('Failed to verify subscription. Please try again later.');
  }
});

async function sendWelcomeMessage(ctx: any) {
  const url = APP_URL || 'https://google.com'; // Fallback for dev testing
  await ctx.reply(
    '🚀 Welcome to the Crypto Market Analysis Terminal.\n\nClick the button below to launch the Mini App!',
    Markup.inlineKeyboard([
      [Markup.button.webApp('Launch Terminal 📈', url)]
    ])
  );
}

export async function POST(req: Request) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return Response.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
    }
    
    const body = await req.json();
    await bot.handleUpdate(body);
    return new Response('OK');
  } catch (error: any) {
    console.error('Error handling Telegram update:', error);
    return new Response(error.message || 'Error', { status: 500 });
  }
}
