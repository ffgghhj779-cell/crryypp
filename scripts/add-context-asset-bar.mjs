/**
 * scripts/add-context-asset-bar.mjs
 *
 * Adds <ContextAssetBar /> to all context-based tool pages:
 *  - tools that import useMarketData but do NOT already have ContextAssetBar or SymbolDropdown
 *  - inserts it right after <ToolPageHeader tool={tool} />
 *
 * Run: node scripts/add-context-asset-bar.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

import { readdirSync, statSync } from 'fs';

// ── Collect all tool page.tsx files ─────────────────────────────────────────
function getAllToolPages(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...getAllToolPages(full));
      } else if (entry === 'page.tsx') {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

const toolsDir = join(ROOT, 'app', 'tools');
const allPages = getAllToolPages(toolsDir);

const IMPORT_LINE = `import { ContextAssetBar } from '@/components/tools/ContextAssetBar';`;

// Regex: matches <ToolPageHeader tool={tool} /> (with optional whitespace)
const HEADER_PATTERN = /(<ToolPageHeader\s+tool=\{tool\}\s*\/>)/g;
const HEADER_REPLACEMENT = `$1\n\n      {/* Asset selector — inside tool content */}\n      <ContextAssetBar />`;

let updated = 0;
let skipped = 0;

for (const filePath of allPages) {
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    continue;
  }

  const relPath = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');

  // Skip if: doesn't use useMarketData (not context-based)
  if (!content.includes('useMarketData')) {
    console.log(`⏭️  Skip (no useMarketData): ${relPath}`);
    skipped++;
    continue;
  }

  // Skip if: already has ContextAssetBar or SymbolDropdown (already updated)
  if (content.includes('ContextAssetBar') || content.includes('SymbolDropdown')) {
    console.log(`⏭️  Skip (already has selector): ${relPath}`);
    skipped++;
    continue;
  }

  // Skip if: doesn't have ToolPageHeader (unusual tool)
  if (!content.includes('ToolPageHeader')) {
    console.log(`⏭️  Skip (no ToolPageHeader): ${relPath}`);
    skipped++;
    continue;
  }

  let changed = false;

  // 1. Add import after last existing import
  if (!content.includes('ContextAssetBar')) {
    const lastImportIdx = content.lastIndexOf('\nimport ');
    const insertAfter = content.indexOf('\n', lastImportIdx + 1);
    if (insertAfter !== -1) {
      content = content.slice(0, insertAfter + 1) + IMPORT_LINE + '\n' + content.slice(insertAfter + 1);
      changed = true;
    }
  }

  // 2. Insert <ContextAssetBar /> after <ToolPageHeader tool={tool} />
  const before = content;
  content = content.replace(HEADER_PATTERN, HEADER_REPLACEMENT);
  if (content !== before) changed = true;

  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Updated: ${relPath}`);
    updated++;
  } else {
    console.log(`⏭️  No change: ${relPath}`);
    skipped++;
  }
}

console.log(`\n🎉 Done! ${updated} tools updated, ${skipped} skipped.`);
