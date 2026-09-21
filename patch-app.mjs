import fs from 'fs';

const file = 'App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace all instances of `text-gray-900 bg-gray-50 dark:bg-gray-900`
// with `text-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-gray-100`

const target = 'text-gray-900 bg-gray-50 dark:bg-gray-900';
const replacement = 'text-gray-900 bg-gray-50 dark:bg-gray-900 dark:text-gray-100';

if (content.includes(target)) {
  content = content.split(target).join(replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed App.tsx wrappers!');
} else {
  console.log('Target string not found in App.tsx');
}
