/**
 * Regenerates the PWA/brand icons in public/ from a single SVG definition.
 *
 *   node scripts/generate-icons.mjs
 *
 * Requires the dev dependency `puppeteer` (already used for one-off rendering).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const iconsDir = path.join(publicDir, 'icons');

// The parcel mark, drawn on a 512x512 grid. `scale` shrinks it into the
// maskable safe zone (80% of the canvas must stay clear of the glyph).
const mark = (scale) => {
  const offset = (1 - scale) / 2;
  return `<g transform="translate(${offset * 512} ${offset * 512}) scale(${scale})">
    <path d="M128 168h256v32a24 24 0 0 1-24 24H152a24 24 0 0 1-24-24z" fill="#ffffff" opacity="0.65"/>
    <rect x="152" y="216" width="208" height="176" rx="22" fill="#ffffff"/>
    <rect x="238" y="216" width="36" height="176" fill="#ea580c" opacity="0.35"/>
    <rect x="152" y="216" width="208" height="14" fill="#ea580c" opacity="0.18"/>
  </g>`;
};

const background = `<rect width="512" height="512" rx="104" fill="url(#bg)"/>`;

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fb923c"/>
    <stop offset="1" stop-color="#c2410c"/>
  </linearGradient>
</defs>`;

const iconSvg = (scale = 0.92, radius = 104) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${defs}
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  ${mark(scale)}
</svg>`;

// Full-bleed square for maskable/apple variants (the platform applies its own mask).
const maskableSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${defs}
  ${background}
  ${mark(0.66)}
</svg>`;

// Notification badge: monochrome white glyph on transparency.
const badgeSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${mark(1)}
</svg>`;

const render = async (browser, svg, size) => {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<html><body style="margin:0;padding:0;background:transparent">
       <div style="width:${size}px;height:${size}px">${svg.replace(
         'width="512" height="512"',
         `width="${size}" height="${size}"`
       )}</div>
     </body></html>`,
    { waitUntil: 'load' }
  );
  const buffer = await page.screenshot({ type: 'png', omitBackground: true });
  await page.close();
  return buffer;
};

const main = async () => {
  mkdirSync(iconsDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true });

  try {
    const targets = [
      ['icons/icon-192.png', iconSvg(), 192],
      ['icons/icon-512.png', iconSvg(), 512],
      ['icons/maskable-512.png', maskableSvg(), 512],
      ['apple-touch-icon.png', maskableSvg(), 180],
    ];

    for (const [relative, svg, size] of targets) {
      const buffer = await render(browser, svg, size);
      writeFileSync(path.join(publicDir, relative), buffer);
      console.log(`wrote public/${relative} (${size}px, ${buffer.length} bytes)`);
    }

    writeFileSync(path.join(publicDir, 'favicon.svg'), iconSvg());
    writeFileSync(path.join(publicDir, 'masked-icon.svg'), badgeSvg());
    console.log('wrote public/favicon.svg and public/masked-icon.svg');
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
