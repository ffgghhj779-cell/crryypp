const fs = require('fs');
const files = [
  { path: 'app/tools/liquidity-heatmap/page.tsx', mainRet: 185, slug: 'liquidity-heatmap' },
  { path: 'app/tools/momentum-intelligence/page.tsx', mainRet: 121, slug: 'momentum-intelligence' },
  { path: 'app/tools/wyckoff-map/page.tsx', mainRet: 139, slug: 'wyckoff-map' },
  { path: 'app/tools/zigzag-engine/page.tsx', mainRet: 57, slug: 'zigzag-engine' }
];

for (const f of files) {
  let lines = fs.readFileSync(f.path, 'utf8').split('\n');
  
  // Remove all wrongly indented lines
  lines = lines.filter(line => !line.match(/^\s*const tool = slugToTool/));
  lines = lines.filter(line => !line.match(/^\s*if \(!tool\) return notFound\(\);/));
  
  // Find the ToolPageHeader line
  const headerIdx = lines.findIndex(line => line.includes('<ToolPageHeader tool={tool} />'));
  
  // The main return ( is usually 2 or 3 lines above headerIdx
  let returnIdx = headerIdx;
  while (returnIdx > 0 && !lines[returnIdx].includes('return (')) {
      returnIdx--;
  }
  
  if (returnIdx > 0) {
      lines.splice(returnIdx, 0, `  const tool = slugToTool('${f.slug}');`);
      lines.splice(returnIdx + 1, 0, `  if (!tool) return notFound();`);
      fs.writeFileSync(f.path, lines.join('\n'));
      console.log('Fixed', f.path);
  }
}
