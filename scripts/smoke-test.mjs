/**
 * Production build smoke test.
 *
 *   npm run build && node scripts/smoke-test.mjs
 *
 * Serves `dist/` over loopback, loads it in headless Chrome, waits for the React
 * root to render and fails on uncaught page errors. Console output is printed so
 * a reviewer can see what the app logged.
 *
 * The subscription gate holds the application until the licence has been confirmed,
 * so the check is primed with a cached, in-period subscription before the page runs.
 * Without that this test would depend on the billing service being reachable — and
 * a build check that fails when the network is down is worse than no check.
 */
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const PORT = Number(process.env.SMOKE_PORT ?? 4173);

if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let filePath = path.join(distDir, urlPath);

  // SPA fallback, mirroring the production rewrite rules.
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

const run = async () => {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}/`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });

  const problems = [];
  const logs = [];
  page.on('console', (message) => logs.push(`[${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()}`));

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem(
      'dawar_subscription_state',
      JSON.stringify({
        settings: {
          simulateFailure: false,
          status: 'active',
          periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          lastPaidMonth: null,
          checkoutUrl: null,
        },
        checkedAt: new Date().toISOString(),
      })
    );
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return !!root && root.childElementCount > 0;
  }, { timeout: 20_000 });

  // The gate replaces the splash with either the app or the lock screen; waiting for
  // it to go keeps this test from passing on a loading state.
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="subscription-splash"]'),
    { timeout: 20_000 }
  );

  const summary = await page.evaluate(() => {
    const root = document.getElementById('root');
    const styles = getComputedStyle(document.body);
    const text = (root?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      renderedNodes: root?.childElementCount ?? 0,
      bodyBackground: styles.backgroundColor,
      title: document.title,
      hasManifestLink: !!document.querySelector('link[rel="manifest"]'),
      visibleText: text.slice(0, 160),
    };
  });

  const shotPath = path.join(distDir, 'smoke-screenshot.png');
  await page.screenshot({ path: shotPath });

  const locked = await page.evaluate(() =>
    /Subscription expired|انتهى الاشتراك/.test(document.body.innerText)
  );

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  console.log('rendered nodes :', summary.renderedNodes);
  console.log('title          :', summary.title);
  console.log('body background:', summary.bodyBackground);
  console.log('manifest link  :', summary.hasManifestLink);
  console.log('visible text   :', summary.visibleText);
  console.log('screenshot     :', shotPath);
  if (logs.length) console.log('console:\n' + logs.join('\n'));

  if (problems.length) {
    console.error('FAILED:\n' + problems.join('\n'));
    process.exit(1);
  }

  if (locked) {
    // A fresh profile with no cached licence and no reachable billing service is
    // expected to lock; say so plainly rather than reporting a pass that hides it.
    console.error(
      'FAILED: the app was held at the subscription gate, so the UI was never exercised. ' +
        'Check the billing service is reachable, or that the cached licence is valid.'
    );
    process.exit(1);
  }

  console.log('\nSMOKE TEST PASSED');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
