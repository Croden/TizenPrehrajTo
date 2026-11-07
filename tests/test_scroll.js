// Vertikální scroll okna v doporučeních BEZ scrollIntoView — simulace
// starého Tizen Chromium, kde scrollIntoView s options nefunguje.
// Spouštět z kořene repa: node tests/test_scroll.js
const { chromium } = require('playwright');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();

const pageHtml = `<!doctype html><html><head><title>x</title></head><body>
<div class="page"><div class="page-box"><div class="content">
<div class="header"><div class="top-bar"><div class="top-bar-right">
  <div class="form__group--search"><input class="video-search-phrase" type="search"></div>
</div></div></div>
<main style="padding-top:3rem"><div class="grid-container"><div class="grid-x">
  <div class="cell medium-9"><div class="section section--medium"><div class="grid-x"></div></div></div>
</div></div></main>
</div></div></div></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(MOD);
  await ctx.addInitScript(() => {
    // simulace staré Tizen Chromium: scrollIntoView s options nic nedělá
    Element.prototype.scrollIntoView = function () {};
  });
  const page = await ctx.newPage();
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml }));
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(400);
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForTimeout(300);
  if (await page.locator('#pt-reco-gate').isVisible().catch(() => false)) {
    await page.fill('#pt-reco-pass', 'test');
    await page.click('#pt-reco-gate button');
  }
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // fokus na úplně první kartě první řady
  await page.evaluate(() => document.querySelector('.pt-reco-card').focus());
  const y0 = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const y1 = await page.evaluate(() => window.scrollY);
  ok('dolů z první karty scrolluje okno', y1 > y0, y0 + ' → ' + y1);
  ok('fokus v další řadě', await page.evaluate(() => /pt-reco-card/.test(document.activeElement.className)));

  // dál dolů – scroll pokračuje
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const y2 = await page.evaluate(() => window.scrollY);
  ok('dolů dál scrolluje', y2 > y1, y1 + ' → ' + y2);

  // nahoru zpět – scroll se vrací
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  const y3 = await page.evaluate(() => window.scrollY);
  // nahoru z první řady → přepínač + scroll na 0
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  const yTop = await page.evaluate(() => window.scrollY);
  ok('nahoru vrací scroll', y3 < y2, y2 + ' → ' + y3);
  ok('nahoru z první řady = scroll 0', yTop === 0, 'y=' + yTop);

  // dolů až na konec skupiny → druhá skupina, karta viditelná
  for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250); }
  await page.waitForSelector('.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const vis = await page.evaluate(() => {
    const el = document.activeElement;
    if (!/pt-reco-card/.test(el.className)) return 'fokus=' + el.className;
    const r = el.getBoundingClientRect();
    return (r.top >= 0 && r.bottom <= window.innerHeight) ? 'ok' : 'mimo: top=' + r.top;
  });
  ok('karta viditelná po přepnutí skupiny', vis === 'ok', vis);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
