const fs = require('fs');
const content = fs.readFileSync('components/UnifiedScannerModal.tsx', 'utf8');
const match = content.match(/export const ANALYSIS_TOOLS: ToolDef\[\] = \[([\s\S]*?)\];/);
if (match) {
  const tools = match[1].split('\n').filter(line => line.includes('{ name:'));
  tools.forEach((line, index) => {
    const nameMatch = line.match(/name:\s*'([^']+)'/);
    if (nameMatch) console.log(`${index + 1}: ${nameMatch[1]}`);
  });
}
