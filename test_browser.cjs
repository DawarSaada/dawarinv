const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Listen for console events
  page.on('console', msg => {
    console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  // Listen for uncaught exceptions
  page.on('pageerror', error => {
    console.log(`[Browser ERROR] ${error.message}`);
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log("Page loaded successfully.");
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    if (!bodyHTML.trim() || bodyHTML.includes('id="root"></div>')) {
        console.log("Body is empty! White screen confirmed.");
    } else {
        console.log("Body length: " + bodyHTML.length);
    }
  } catch (err) {
    console.error("Failed to load page:", err);
  }

  await browser.close();
})();
