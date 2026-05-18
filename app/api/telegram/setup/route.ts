export async function GET(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.APP_URL;

  if (!token || !appUrl) {
    return Response.json({ error: 'Missing TELEGRAM_BOT_TOKEN or APP_URL environment variables.' }, { status: 400 });
  }

  const webhookUrl = `${appUrl}/api/telegram`;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

  try {
    let url = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`;
    if (secretToken) {
        url += `&secret_token=${secretToken}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    return Response.json(data);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
