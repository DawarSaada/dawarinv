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
  let newContent = content;

  // Find modals that use p-2 or p-4 with fixed inset-0
  newContent = newContent.replace(/className=(['"`])([^'"]*fixed inset-0[^'"]*(?:p-2|p-4)[^'"]*)\1/g, (match, quote, classes) => {
    if (classes.includes('pt-safe') || classes.includes('safe-area') || classes.includes('pt-[')) return match;
    
    // Add pt-safe and pt-4 (so it doesn't lose top padding entirely if safe area is 0).
    // Better: use Tailwind arbitrary variant if we want max, but `pt-safe` works well if it defaults to 0px and we still have padding inside the modal container.
    // Actually, if the modal uses `p-4`, and we add `pt-safe`, which wins?
    // Tailwind's `.pt-safe` is in index.css. It applies `padding-top: env(safe-area-inset-top, 0px);`
    // Wait! `p-4` sets BOTH padding-top and padding-bottom. If `pt-safe` comes after `p-4` in the CSS cascade, it overrides padding-top. BUT `index.css` imports `@tailwind utilities` AFTER custom CSS unless it's configured otherwise.
    // Let's replace `p-4` with `px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)]` directly to be 100% safe!
    
    let modifiedClasses = classes;
    if (classes.includes('p-4')) {
      modifiedClasses = modifiedClasses.replace(/\bp-4\b/g, 'px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)]');
    } else if (classes.includes('p-2')) {
      modifiedClasses = modifiedClasses.replace(/\bp-2\b/g, 'px-2 pb-2 pt-[max(env(safe-area-inset-top,0.5rem),0.5rem)]');
    }

    return `className=${quote}${modifiedClasses}${quote}`;
  });

  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log('Updated', file);
    updated++;
  }
});
console.log('Total files updated:', updated);
