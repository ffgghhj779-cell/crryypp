/**
 * scripts/remove-disclaimers.mjs
 * Removes all disclaimer/warning sections from tool pages and VIPResultCard.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

// ─── Patterns to remove ────────────────────────────────────────────────────────
// Each pattern is a regex that matches a JSX block (including surrounding whitespace)
const DISCLAIMER_PATTERNS = [
  // {/* Disclaimer */} followed by any <p> or <div> containing disclaimer text
  /\s*\{\/\*[^*]*[Dd]isclaimer[^*]*\*\/\}\s*<[^>]+>[^<]*(?:تعليمية|إخلاء|مسؤولية|للأغراض|هذه الأداة|للمعلومات|نصيحة|Educational)[^<]*<\/[^>]+>/g,
  
  // Larger block: {/* ... Disclaimer ... */} <div ...> ... </div>
  /\s*\{\/\*[^*]*[Dd]isclaimer[^*]*\*\/\}\s*<p[^>]*>[^<]*(?:تعليمية|إخلاء|مسؤولية|للأغراض|هذه الأداة)[^<]*<\/p>/g,

  // <p className="...text-white/40..."> ... تعليمية ... </p>
  /\s*<p[^>]*className[^>]*text-white[^>]*>[^<]*(?:تعليمية فقط|إخلاء مسؤولية|للأغراض التعليمية|هذه الأداة مبنية)[^<]*<\/p>/g,
];

// ─── Files to patch ────────────────────────────────────────────────────────────
const FILES = [
  'app/tools/gann-144-star/page.tsx',
  'app/tools/gann-time-wheel/page.tsx',
  'app/tools/sq9-square-of-nine/page.tsx',
  'components/tools/VIPResultCard.tsx',
];

// ─── Apply removals ────────────────────────────────────────────────────────────
let totalPatched = 0;

for (const rel of FILES) {
  const filePath = resolve(root, rel);
  let src;
  try {
    src = readFileSync(filePath, 'utf8');
  } catch {
    console.log(`❓ Not found: ${rel}`);
    continue;
  }

  const original = src;

  // Apply each regex pattern
  for (const pat of DISCLAIMER_PATTERNS) {
    src = src.replace(pat, '');
  }

  // Also remove any FAQ entry about disclaimer by title match
  src = src.replace(/\{\s*title:\s*['"`][^'"]*إخلاء[^'"]*['"`]\s*,\s*content:\s*['"`][^'"]*['"`]\s*,?\s*\}/gs, '');
  src = src.replace(/\{\s*title:\s*['"`][^'"]*مسؤولية[^'"]*['"`]\s*,\s*content:\s*['"`][^'"]*['"`]\s*,?\s*\}/gs, '');

  if (src !== original) {
    writeFileSync(filePath, src, 'utf8');
    console.log(`✅ Cleaned: ${rel}`);
    totalPatched++;
  } else {
    console.log(`⏭️  No change: ${rel}`);
  }
}

console.log(`\n🎉 Done! ${totalPatched} files cleaned.`);
