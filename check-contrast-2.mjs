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
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./components');
let found = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const classMatches = content.match(/className(?:Name)?=['"{`][\s\S]*?['"`}]/g) || [];
  classMatches.forEach(match => {
    // text-gray-900 check
    if ((match.includes('text-gray-900') || match.includes('text-gray-800')) && 
        !match.includes('dark:text-white') && 
        !match.includes('dark:text-gray-100') && 
        !match.includes('dark:text-gray-200') &&
        !match.includes('dark:text-gray-300') &&
        !match.includes('dark:text-gray-400')) {
      console.log(file + ': MISSING DARK TEXT -> ' + match.replace(/\n/g, ' '));
      found++;
    }
    
    // bg-white check
    if (match.includes('bg-white') && 
        !match.includes('dark:bg-gray-900') && 
        !match.includes('dark:bg-gray-800') &&
        !match.includes('dark:bg-gray-950') &&
        !match.includes('dark:bg-gray-700') &&
        !match.includes('dark:bg-gray-600') &&
        !match.includes('bg-white/')) {
      console.log(file + ': MISSING DARK BG -> ' + match.replace(/\n/g, ' '));
      found++;
    }
  });
});
console.log('Total issues:', found);
