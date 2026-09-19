import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('components');
let updated = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('fixed inset-0')) {
      if (!lines[i].includes('pt-[max') && !lines[i].includes('pt-safe')) {
        let old = lines[i];
        if (lines[i].includes(' p-4 ')) {
          lines[i] = lines[i].replace(' p-4 ', ' px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)] ');
        } else if (lines[i].includes(' p-4\"')) {
          lines[i] = lines[i].replace(' p-4\"', ' px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)]\"');
        } else if (lines[i].includes(' p-4`')) {
          lines[i] = lines[i].replace(' p-4`', ' px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)]`');
        } else if (lines[i].includes(' p-2 ')) {
          lines[i] = lines[i].replace(' p-2 ', ' px-2 pb-2 pt-[max(env(safe-area-inset-top,0.5rem),0.5rem)] ');
        }
        
        // Sm breakpoint
        if (lines[i].includes('sm:p-4')) {
           lines[i] = lines[i].replace('sm:p-4', 'sm:px-4 sm:pb-4 sm:pt-[max(env(safe-area-inset-top,1rem),1rem)]');
        }
        
        if (old !== lines[i]) {
          changed = true;
        }
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Updated second pass', file);
    updated++;
  }
});
console.log('Total files updated:', updated);
