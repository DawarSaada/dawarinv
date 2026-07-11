const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Listen for console events
  page.on('console', msg => {
    console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  page.on('response', async (response) => {
    if (response.url().includes('supabase.co')) {
      console.log(`[Network] Supabase Request: ${response.url()} - Status: ${response.status()}`);
      try {
        const text = await response.text();
        console.log(`[Network Response] ${text.substring(0, 200)}`);
      } catch (e) {}
    }
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log("Page loaded successfully. Now evaluating `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` or we can just wait 2s.");
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Type username
    const inputs = await page.$$('input');
    console.log(`Found ${inputs.length} inputs.`);
    
    if (inputs.length >= 2) {
      await inputs[0].type('admin');
      await inputs[1].type('Admin1234');
      console.log("Typed credentials. Clicking submit...");
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.log("No submit button found!");
      }
      
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      if (bodyHTML.includes('Invalid username or password')) {
        console.log("LOGIN FAILED text found on screen!");
      } else {
        console.log("Login might have succeeded!");
      }
    }
  } catch (err) {
    console.error("Failed to load page:", err);
  }

  await browser.close();
})();
