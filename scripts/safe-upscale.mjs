/**
 * scripts/safe-upscale.mjs
 * ========================
 * Safe UI upscaling using Node.js (proper UTF-8, no BOM, no encoding corruption)
 * Run: node scripts/safe-upscale.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
let totalFiles = 0;
let totalChanges = 0;

// Collect all TSX files recursively (skip node_modules, .next, dynamic routes)
function walkDir(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkDir(full, files);
    else if (extname(name) === '.tsx' && !full.includes('[')) files.push(full);
  }
  return files;
}

function upgradeFile(filePath) {
  // Read as UTF-8 — Node.js fs preserves encoding perfectly
  const original = readFileSync(filePath, 'utf8');
  let content = original;

  // ── TEXT SIZE UPGRADE (3-pass safe) ──────────────────────────────────────
  // Pass 1: protect text-base → placeholder
  content = content.replaceAll('text-base', '__TEXTLG__');
  // Pass 2: text-sm → text-base
  content = content.replaceAll('text-sm', 'text-base');
  // Pass 3: text-xs → text-sm
  content = content.replaceAll('text-xs', 'text-sm');
  // Pass 4: restore placeholder → text-lg
  content = content.replaceAll('__TEXTLG__', 'text-lg');

  // ── CUSTOM PIXEL SIZES ───────────────────────────────────────────────────
  content = content.replaceAll('text-[8px]',  'text-sm');
  content = content.replaceAll('text-[9px]',  'text-sm');
  content = content.replaceAll('text-[10px]', 'text-sm');
  content = content.replaceAll('text-[11px]', 'text-sm');
  content = content.replaceAll('text-[12px]', 'text-sm');
  content = content.replaceAll('text-[13px]', 'text-base');
  content = content.replaceAll('text-[14px]', 'text-base');
  content = content.replaceAll('text-[15px]', 'text-lg');

  // ── ICON SIZES ───────────────────────────────────────────────────────────
  content = content.replaceAll('w-4 h-4', 'w-6 h-6');
  content = content.replaceAll('h-4 w-4', 'h-6 w-6');
  content = content.replaceAll('size={16}', 'size={22}');
  content = content.replaceAll('size={18}', 'size={24}');
  content = content.replaceAll('size={20}', 'size={26}');

  // ── PADDING (precise word-boundary via regex) ─────────────────────────────
  content = content.replace(/\bp-4\b(?!\d)/g, 'p-6');
  content = content.replace(/\bpx-4\b(?!\d)/g, 'px-5');
  content = content.replace(/\bpy-2\b(?!\d)/g, 'py-3');
  content = content.replace(/\bpy-3\b(?!\d)/g, 'py-4');

  // ── GAPS ─────────────────────────────────────────────────────────────────
  content = content.replace(/\bgap-4\b(?!\d)/g, 'gap-6');
  content = content.replace(/\bgap-2\b(?!\d)/g, 'gap-3');

  // ── CHART HEIGHTS ────────────────────────────────────────────────────────
  content = content.replace(/\bh-64\b(?!\d)/g, 'h-96');
  content = content.replace(/\bh-72\b(?!\d)/g, 'h-[420px]');
  content = content.replace(/\bh-80\b(?!\d)/g, 'h-[440px]');

  if (content !== original) {
    // Write back as UTF-8, no BOM — identical to how Node.js reads it
    writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    totalChanges += (content.match(/text-base|text-sm|text-lg|w-6 h-6|p-6|gap-6/g) || []).length;
    return true;
  }
  return false;
}

console.log('\n🚀 Safe UI Upscaling — Node.js UTF-8 Mode');
console.log('==========================================\n');

const dirs = [join(ROOT, 'components'), join(ROOT, 'app')];
const allFiles = [];
dirs.forEach(d => walkDir(d, allFiles));

console.log(`📂 Found ${allFiles.length} TSX files to process...\n`);

for (const f of allFiles) {
  const changed = upgradeFile(f);
  const rel = f.replace(ROOT, '').replace(/\\/g, '/');
  if (changed) process.stdout.write(`  ✅ ${rel}\n`);
}

console.log(`\n==========================================`);
console.log(`✅ Done! Updated ${totalFiles}/${allFiles.length} files`);
console.log(`   Upgraded ~${totalChanges} class instances`);
console.log(`==========================================\n`);
