import fs from 'fs';

let dump = JSON.parse(fs.readFileSync('catalog_dump.json', 'utf8'));
let arNames = Array.from(new Set(Object.values(dump).map(v => v.ar.trim()))).filter(Boolean);

fs.writeFileSync('ar_names.txt', arNames.join('\n'));
console.log(`Saved ${arNames.length} unique Arabic names.`);
