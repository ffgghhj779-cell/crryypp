/**
 * scripts/add-symbol-dropdown.mjs
 *
 * Updates all manual/fetch tool pages to replace the plain symbol <input>
 * with the SymbolDropdown component.
 *
 * Run with: node scripts/add-symbol-dropdown.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Tools that have a symbol text input + fetchKlines ────────────────────────
const TOOL_FILES = [
  'app/tools/atr-volatility/page.tsx',
  'app/tools/ema-ribbon/page.tsx',
  'app/tools/matrix-4x4/page.tsx',
  'app/tools/momentum-intelligence/page.tsx',
  'app/tools/trading-vip-1/page.tsx',
  'app/tools/trading-vip-2/page.tsx',
  'app/tools/triple-lens/page.tsx',
  'app/tools/unified-decision-6-tools/page.tsx',
];

const IMPORT_LINE = `import { SymbolDropdown } from '@/components/tools/SymbolDropdown';`;

// Matches any <input block with value={symbol} (the symbol text input)
// We replace the ENTIRE <input ... /> element with <SymbolDropdown value={symbol} onChange={setSymbol} />
const INPUT_PATTERN = /<input[\s\S]*?value=\{symbol\}[\s\S]*?\/>/g;
const DROPDOWN_REPLACEMENT = `<SymbolDropdown value={symbol} onChange={setSymbol} />`;

let totalFixed = 0;

for (const relPath of TOOL_FILES) {
  const filePath = join(ROOT, relPath);
  let content;

  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error(`❌ Cannot read ${relPath}: ${e.message}`);
    continue;
  }

  let changed = false;

  // 1. Add import if not already present
  if (!content.includes('SymbolDropdown')) {
    // Insert after the last existing import line
    const lastImportIdx = content.lastIndexOf("\nimport ");
    const insertAfter = content.indexOf('\n', lastImportIdx + 1);
    if (insertAfter !== -1) {
      content = content.slice(0, insertAfter + 1) + IMPORT_LINE + '\n' + content.slice(insertAfter + 1);
      changed = true;
    }
  }

  // 2. Replace symbol <input ... /> with <SymbolDropdown ... />
  const before = content;
  content = content.replace(INPUT_PATTERN, (match) => {
    // Only replace if this input is clearly the symbol input
    if (match.includes('value={symbol}') && (
      match.includes('placeholder="BTCUSDT"') ||
      match.includes("placeholder='BTCUSDT'") ||
      match.includes('placeholder="BTC"') ||
      match.includes('dir="ltr"') ||
      match.includes("dir='ltr'")
    )) {
      changed = true;
      return DROPDOWN_REPLACEMENT;
    }
    return match; // leave non-symbol inputs untouched
  });

  if (content !== before) changed = true;

  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Updated: ${relPath}`);
    totalFixed++;
  } else {
    console.log(`⏭️  No change needed: ${relPath}`);
  }
}

console.log(`\n🎉 Done! Updated ${totalFixed} / ${TOOL_FILES.length} tool pages.`);
