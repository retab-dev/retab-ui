import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3100/homepage', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1500);
const txt = await page.evaluate(() => {
  const portal = document.querySelector('nextjs-portal');
  if (!portal || !portal.shadowRoot) return 'no portal/shadow';
  return portal.shadowRoot.textContent.slice(0, 1500);
});
console.log(txt);
await browser.close();
