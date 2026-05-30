/**
 * scripts/add-symbol-dropdown.mjs
 * Adds SymbolDropdown to tool pages that still have a plain text input for symbol.
 * Targets tools with `placeholder="BTCUSDT"` text input.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

const TARGETS = [
  'app/tools/harmonic-scanner/page.tsx',
  'app/tools/pattern-scanner/page.tsx',
  'app/tools/fibonacci-matrix/page.tsx',
  'app/tools/gann-144-star/page.tsx',
];

const IMPORT_LINE = `import { SymbolDropdown } from '@/components/tools/SymbolDropdown';\n`;

// Regex that matches the text input block used for symbol entry
const TEXT_INPUT_RE = /(\s*<input[\s\S]*?placeholder=["']BTCUSDT["'][\s\S]*?(?:\/>|<\/input>))/g;

// Replacement: SymbolDropdown (the value/onChange are already wired to the symbol state)
const DROPDOWN_REPLACEMENT = `
              <SymbolDropdown value={symbol} onChange={setSymbol} />`;

let updatedCount = 0;
let skippedCount = 0;

for (const rel of TARGETS) {
  const filePath = resolve(root, rel);
  let src;
  try {
    src = readFileSync(filePath, 'utf8');
  } catch {
    console.log(`❓ Not found: ${rel}`);
    skippedCount++;
    continue;
  }

  // Already has SymbolDropdown?
  if (src.includes('SymbolDropdown')) {
    console.log(`⏭️  Already has SymbolDropdown: ${rel}`);
    skippedCount++;
    continue;
  }

  // Must have placeholder="BTCUSDT" text input
  if (!src.includes('placeholder="BTCUSDT"') && !src.includes("placeholder='BTCUSDT'")) {
    console.log(`⏭️  No BTCUSDT placeholder found: ${rel}`);
    skippedCount++;
    continue;
  }

  // 1. Add import after last existing import line
  const importInsertIdx = (() => {
    // Find the position after the last import statement
    const lines = src.split('\n');
    let lastImport = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) lastImport = i;
    }
    // Return character offset of end of that line
    return lines.slice(0, lastImport + 1).join('\n').length;
  })();

  src = src.slice(0, importInsertIdx) + '\n' + IMPORT_LINE + src.slice(importInsertIdx);

  // 2. Replace the text input block for symbol
  // Strategy: find the <input> with placeholder="BTCUSDT" and replace up to its closing
  // Use a targeted approach that works with the indentation of each file

  // Pattern 1: self-closing <input ... placeholder="BTCUSDT" ... />
  src = src.replace(
    /<input[\s\S]*?placeholder=["']BTCUSDT["'][\s\S]*?\/>/g,
    '<SymbolDropdown value={symbol} onChange={setSymbol} />'
  );

  // 3. Remove unused onSymbolChange if it only fed the old text input
  // (safe to leave — won't break anything if present)

  writeFileSync(filePath, src, 'utf8');
  console.log(`✅ Updated: ${rel}`);
  updatedCount++;
}

console.log(`\n🎉 Done! ${updatedCount} tools updated, ${skippedCount} skipped.`);
