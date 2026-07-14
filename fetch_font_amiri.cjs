const https = require('https');
const fs = require('fs');

const url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf';

https.get(url, (res) => {
    let data = [];
    res.on('data', (chunk) => {
        data.push(chunk);
    });
    res.on('end', () => {
        const buffer = Buffer.concat(data);
        const base64 = buffer.toString('base64');
        const tsContent = `export const amiriBase64 = "${base64}";\n`;
        fs.writeFileSync('utils/amiriFont.ts', tsContent);
        console.log('Amiri Font successfully fetched and converted to utils/amiriFont.ts');
    });
}).on('error', (err) => {
    console.error('Error fetching font:', err);
});
