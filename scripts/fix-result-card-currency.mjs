/**
 * scripts/fix-result-card-currency-v2.mjs
 * Properly patches 4 result card components with correct import placement.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

const ASSET_IMPORT = `import { formatAssetPrice } from '@/lib/assetInfo';\n`;

/**
 * Inserts import after the LAST complete import statement
 * (handles multi-line imports correctly by finding the closing line)
 */
function addImportSafely(src) {
  if (src.includes("from '@/lib/assetInfo'")) return src;

  const lines = src.split('\n');
  let lastImportEnd = -1;
  let inMultiLineImport = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') && line.includes('{') && !line.includes('}')) {
      inMultiLineImport = true;
    }
    if (inMultiLineImport && line.startsWith('}') && line.includes('from')) {
      inMultiLineImport = false;
      lastImportEnd = i;
    }
    if (!inMultiLineImport && line.startsWith('import ') && !line.includes('{')) {
      lastImportEnd = i;
    }
    if (!inMultiLineImport && line.startsWith('import ') && line.includes('}')) {
      lastImportEnd = i; // single-line import with braces
    }
  }

  if (lastImportEnd === -1) lastImportEnd = 0;
  lines.splice(lastImportEnd + 1, 0, ASSET_IMPORT.trimEnd());
  return lines.join('\n');
}

// ─── Apply patches to each file ───────────────────────────────────────────────

const FILES = [
  {
    rel: 'components/tools/SMCResultCard.tsx',
    patterns: [
      // `$${fmt(data.setup.entry)}`  etc.
      [/`\$\$\{fmt\(([^)]+)\)\}`/g, (_, p) => `formatAssetPrice(${p}, symbol)`],
    ],
  },
  {
    rel: 'components/tools/ClassicPatternCards.tsx',
    patterns: [
      // `$${fmtPrice(data.level1)}`  etc.
      [/`\$\$\{fmtPrice\(([^)]+)\)\}`/g, (_, p) => `formatAssetPrice(${p}, symbol)`],
    ],
  },
  {
    rel: 'components/tools/QuantResultCards.tsx',
    patterns: [
      [/`\$\$\{fmtPrice\(([^)]+)\)\}`/g, (_, p) => `formatAssetPrice(${p}, symbol)`],
    ],
  },
  {
    rel: 'components/tools/OrderFlowResultCards.tsx',
    patterns: [
      [/`\$\$\{fmtPrice\(([^)]+)\)\}`/g, (_, p) => `formatAssetPrice(${p}, symbol)`],
    ],
  },
  {
    rel: 'components/tools/GarchResultCard.tsx',
    patterns: [
      // `$${fmtPrice(data.upperBound)}`
      [/`\$\$\{fmtPrice\(([^)]+)\)\}`/g, (_, p) => `formatAssetPrice(${p}, symbol)`],
    ],
  },
];

let totalPatched = 0;

for (const { rel, patterns } of FILES) {
  const filePath = resolve(root, rel);
  let src;
  try {
    src = readFileSync(filePath, 'utf8');
  } catch {
    console.log(`❓ Not found: ${rel}`);
    continue;
  }

  const original = src;

  // 1. Count replaceable patterns before replacing
  let matchCount = 0;
  for (const [pattern] of patterns) {
    const m = src.match(new RegExp(pattern.source, 'g'));
    if (m) matchCount += m.length;
  }

  if (matchCount === 0) {
    console.log(`⏭️  No $ patterns found: ${rel}`);
    continue;
  }

  // 2. Apply pattern replacements
  for (const [pattern, replacement] of patterns) {
    src = src.replace(pattern, replacement);
  }

  // 3. Add import ONLY if replacements were made
  src = addImportSafely(src);

  writeFileSync(filePath, src, 'utf8');
  console.log(`✅ Patched ${matchCount} prices: ${rel}`);
  totalPatched++;
}

console.log(`\n🎉 Done! ${totalPatched} files patched.`);
