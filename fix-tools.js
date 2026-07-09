const fs = require('fs');
const path = require('path');
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}
let c = 0;
walkDir('app/tools', (f) => {
  if (f.endsWith('page.tsx')) {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('tool={tool}') && !content.includes('const tool = slugToTool')) {
      const parts = f.split(path.sep);
      const slug = parts[parts.length - 2];
      
      const mainReturnStr = 'return (\n    <div className="flex flex-col';
      const mainReturnIndex = content.indexOf(mainReturnStr);
      
      if (mainReturnIndex !== -1) {
          const insert = `const tool = slugToTool('${slug}');\n  if (!tool) return notFound();\n\n  `;
          content = content.slice(0, mainReturnIndex) + insert + content.slice(mainReturnIndex);
          fs.writeFileSync(f, content);
          console.log('Fixed main return:', f);
          c++;
      } else {
          const fallbackIndex = content.lastIndexOf('return (');
          if (fallbackIndex !== -1) {
              const insert = `const tool = slugToTool('${slug}');\n  if (!tool) return notFound();\n\n  `;
              content = content.slice(0, fallbackIndex) + insert + content.slice(fallbackIndex);
              fs.writeFileSync(f, content);
              console.log('Fixed fallback return:', f);
              c++;
          }
      }
    }
  }
});
console.log('Total fixed:', c);
