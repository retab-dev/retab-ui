import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 1500, height: 2400 });
const resp = await page.goto('http://localhost:3100/homepage', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);

// surface any Next.js error overlay
const err = await page.evaluate(() => {
  const o = document.querySelector('nextjs-portal');
  return o ? 'NEXT ERROR OVERLAY PRESENT' : null;
});
if (err) console.log(err);

const cards = await page.$$('.aspect-\\[210\\/297\\]');
console.log('cards found:', cards.length);
const names = ['parse', 'extract', 'edit', 'split', 'partition', 'classify'];
for (let i = 0; i < cards.length; i++) {
  await cards[i].scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(150);
  const parent = await cards[i].evaluateHandle(el => el.parentElement);
  const pe = parent.asElement();
  try { await pe.screenshot({ path: `/tmp/prim-shots/v2-card-${i}-${names[i] || i}.png` }); }
  catch (e) { await cards[i].screenshot({ path: `/tmp/prim-shots/v2-card-${i}-${names[i] || i}.png` }); }
}
await browser.close();
console.log('DONE');
