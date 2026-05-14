#!/usr/bin/env node
/**
 * scripts/check-secrets.mjs
 * VULN-11: CI guard that fails the build if server-only secrets are referenced
 * in client-side code (components/, hooks/, app/ excluding api/ routes).
 *
 * Run: node scripts/check-secrets.mjs
 * Add to package.json: "prebuild": "node scripts/check-secrets.mjs"
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// Secrets that must NEVER appear in client-side code
const DANGEROUS_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
];

// Directories to scan (client-side code locations)
const SCAN_DIRS = ['components', 'hooks', 'store', 'lib'];
// Exclude server-side files within lib/
const EXCLUDE_PATTERNS = [/app\/api/, /scripts/, /node_modules/, /\.next/];

function getAllFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!EXCLUDE_PATTERNS.some(p => p.test(full))) getAllFiles(full, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

let violations = 0;

for (const dir of SCAN_DIRS) {
  const fullDir = join(ROOT, dir);
  try {
    const files = getAllFiles(fullDir);
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const key of DANGEROUS_KEYS) {
        if (content.includes(key)) {
          console.error(`🚨 SECRET LEAK: "${key}" found in client file: ${relative(ROOT, file)}`);
          violations++;
        }
      }
    }
  } catch { /* dir may not exist — skip */ }
}

if (violations > 0) {
  console.error(`\n❌ ${violations} secret leak(s) detected. Build aborted.\n`);
  process.exit(1);
} else {
  console.log('✅ Secret leak check passed — no server-only secrets in client code.');
}
