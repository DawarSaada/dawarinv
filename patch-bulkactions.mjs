import fs from 'fs';

let content = fs.readFileSync('components/inventory/BulkActionsBar.tsx', 'utf8');
content = content.replace(/className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-xl transition-colors text-sm font-bold"/g, 'className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-xl transition-colors text-sm font-bold whitespace-nowrap shrink-0"');
content = content.replace(/className="flex items-center gap-2 px-4 py-2 hover:bg-red-900\/30 text-red-400 rounded-xl transition-colors text-sm font-bold"/g, 'className="flex items-center gap-2 px-3 py-2 hover:bg-red-900/30 text-red-400 rounded-xl transition-colors text-sm font-bold whitespace-nowrap shrink-0"');
content = content.replace(/className="p-2 hover:bg-gray-800 rounded-xl transition-colors"/g, 'className="p-2 hover:bg-gray-800 rounded-xl transition-colors shrink-0"');
fs.writeFileSync('components/inventory/BulkActionsBar.tsx', content, 'utf8');

console.log("Patched BulkActionsBar.tsx");
