#!/usr/bin/env node
/**
 * scripts/set-webhook.mjs
 *
 * Registers the Telegram webhook for your bot.
 * Uses Node 18+ native fetch — no npm dependencies required.
 *
 * Usage:
 *   node scripts/set-webhook.mjs
 *   — or —
 *   npm run set-webhook
 *
 * Required in .env.local:
 *   TELEGRAM_BOT_TOKEN=...
 *   APP_URL=https://your-deployment.vercel.app    ← the public URL of this Next.js app
 *   TELEGRAM_WEBHOOK_SECRET=8f2a9b4e7c1d3f5a0b8c2e9d4f1a6b3c9f8e7d6c5b4a3f2e1d
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── 1. Resolve project root ───────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// ── 2. Parse .env.local (no external deps) ───────────────────────────────────
function loadEnv(filename) {
  const envPath = resolve(ROOT, filename);
  if (!existsSync(envPath)) return {};

  const lines = readFileSync(envPath, 'utf-8').split('\n');
  const env   = {};

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;          // skip blanks + comments

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key   = line.slice(0, eqIdx).trim();
    let   value = line.slice(eqIdx + 1).trim();

    // Strip surrounding quotes (" or ')
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
  return env;
}

// Merge .env then .env.local (local takes priority)
const env = {
  ...loadEnv('.env'),
  ...loadEnv('.env.local'),
  ...process.env,           // actual process env always wins
};

// ── 3. Read & validate config ─────────────────────────────────────────────────
const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
const APP_URL   = env.APP_URL;

// The canonical secret for this project.
// Override by setting TELEGRAM_WEBHOOK_SECRET in .env.local
const WEBHOOK_SECRET =
  env.TELEGRAM_WEBHOOK_SECRET ||
  '8f2a9b4e7c1d3f5a0b8c2e9d4f1a6b3c9f8e7d6c5b4a3f2e1d';

const WEBHOOK_PATH = '/api/telegram';   // Next.js API route

// Validation
const errors = [];
if (!BOT_TOKEN) errors.push('❌  TELEGRAM_BOT_TOKEN is not set in .env.local');
if (!APP_URL)   errors.push('❌  APP_URL is not set in .env.local  (e.g. https://your-app.vercel.app)');

if (errors.length) {
  console.error('\n🚨  Missing required environment variables:\n');
  errors.forEach(e => console.error('   ' + e));
  console.error('\n📄  Add them to .env.local and retry.\n');
  process.exit(1);
}

// ── 4. Build the webhook URL ──────────────────────────────────────────────────
const webhookUrl = APP_URL.replace(/\/$/, '') + WEBHOOK_PATH;

// ── 5. Call Telegram setWebhook ───────────────────────────────────────────────
async function setWebhook() {
  const telegramApi =
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;

  const payload = {
    url:          webhookUrl,
    secret_token: WEBHOOK_SECRET,
    // Optional: allow_updates = undefined → Telegram defaults (all update types)
    drop_pending_updates: true,   // clear any backlog from polling mode
  };

  console.log('\n🤖  Crypto Terminal 360 — Telegram Webhook Setup');
  console.log('─'.repeat(52));
  console.log(`   Webhook URL   : ${webhookUrl}`);
  console.log(`   Secret token  : ${WEBHOOK_SECRET.slice(0, 8)}${'*'.repeat(WEBHOOK_SECRET.length - 8)}`);
  console.log('─'.repeat(52));
  console.log('   Calling Telegram API...\n');

  let res;
  try {
    res = await fetch(telegramApi, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    console.error('❌  Network error — could not reach Telegram API.');
    console.error('   ', err.message);
    process.exit(1);
  }

  const data = await res.json();

  if (data.ok) {
    console.log('✅  Webhook registered successfully!');
    console.log(`   Description: ${data.description}`);
    console.log('\n📌  Next steps:');
    console.log(`   1. Add to .env.local:\n      TELEGRAM_WEBHOOK_SECRET=${WEBHOOK_SECRET}`);
    console.log('   2. Redeploy your Next.js app so the new env var takes effect.');
    console.log('   3. Send /start to your bot to verify everything works.\n');
  } else {
    console.error('❌  Telegram returned an error:');
    console.error(`   Error code : ${data.error_code}`);
    console.error(`   Description: ${data.description}`);
    console.error('\n🔧  Common fixes:');
    console.error('   • BOT_TOKEN must belong to the bot you\'re registering');
    console.error('   • APP_URL must be a publicly reachable HTTPS URL');
    console.error('   • APP_URL cannot be localhost (use ngrok for local testing)\n');
    process.exit(1);
  }
}

setWebhook();
