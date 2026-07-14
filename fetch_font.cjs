const https = require('https');
const fs = require('fs');

const url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf';

https.get(url, (res) => {
    let data = [];
    res.on('data', (chunk) => {
        data.push(chunk);
    });
    res.on('end', () => {
        const buffer = Buffer.concat(data);
        const base64 = buffer.toString('base64');
        const tsContent = `export const cairoBase64 = "${base64}";\n`;
        fs.writeFileSync('utils/cairoFont.ts', tsContent);
        console.log('Font successfully fetched and converted to utils/cairoFont.ts');
    });
}).on('error', (err) => {
    console.error('Error fetching font:', err);
});
