// Obnova pozice v doporučeních po návratu z hledání (localStorage
// tizenprehrajto.recoPos) + červený nadpis fokusované karty.
// Spouštět z kořene repa: node tests/test_restore.js
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
const searchHtml = `<!doctype html><html><head><title>hledej</title></head><body>
<main><input class="video-search-phrase" type="search"><div id="snippet-videoListing-videoListingWrapper"></div></main></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  // rychlý limiter dotazů (výchozí 8/min by test natahoval na minuty)
  await ctx.addInitScript(() => { window.__PT_SCRAPE__ = { perMin: 1000, concurrency: 2, pause: 1500 }; });
  await ctx.addInitScript(MOD);
  const page = await ctx.newPage();
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml }));
  await page.route('https://prehrajto.cz/hledej/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchHtml }));
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(400);
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForTimeout(300);
  await page.fill('#pt-reco-pass', 'test');
  await page.click('#pt-reco-gate button');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // posun: 3× doprava, 1× dolů
  for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); }
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400);
  const picked = await page.evaluate(() => ({
    title: document.activeElement.querySelector('.pt-reco-title').textContent,
    row: document.activeElement.closest('.pt-reco-row').querySelector('.pt-reco-row-title').textContent,
  }));

  // červený nadpis při fokusu
  const col = await page.evaluate(() => getComputedStyle(document.activeElement.querySelector('.pt-reco-title')).color);
  ok('nadpis fokusované karty červený', col === 'rgb(190, 30, 30)', col);

  // Enter -> hledání, pozice uložená
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  ok('přesměrováno na hledání', page.url().indexOf('/hledej/') !== -1, page.url());
  ok('pozice v localStorage', await page.evaluate(() => !!localStorage.getItem('tizenprehrajto.recoPos')));

  // "back" = nové načtení oblíbených
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const restored = await page.evaluate(() => {
    const el = document.activeElement;
    if (!/pt-reco-card/.test(el.className)) return { title: '(fokus: ' + el.className + '|' + el.tagName + ')', row: '' };
    return {
      title: el.querySelector('.pt-reco-title').textContent,
      row: el.closest('.pt-reco-row').querySelector('.pt-reco-row-title').textContent,
      visible: (() => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; })(),
    };
  });
  ok('reco se samo otevřelo', await page.evaluate(() => document.body.classList.contains('pt-reco')));
  ok('fokus na stejné kartě', restored.title === picked.title, picked.title + ' vs ' + restored.title);
  ok('stejná řada', restored.row === picked.row, picked.row + ' vs ' + restored.row);
  ok('karta viditelná', restored.visible === true);

  // manuální klik na přepínač = reset nahoru na první kartu
  await page.evaluate(() => document.querySelector('.pt-switch-row .pt-reco-switch').click());
  await page.waitForTimeout(500);
  const afterClick = await page.evaluate(() => ({
    y: window.scrollY,
    pos: localStorage.getItem('tizenprehrajto.recoPos'),
    firstRow: document.activeElement.closest('.pt-reco-row')
      ? document.activeElement.closest('.pt-reco-row').querySelector('.pt-reco-row-title').textContent : '(mimo)',
    isFirstCard: document.activeElement === document.querySelector('.pt-reco-strip .pt-reco-card'),
  }));
  ok('manuální klik = scroll nahoru', afterClick.y === 0, 'y=' + afterClick.y);
  ok('manuální klik = smazaná pozice', !afterClick.pos);
  ok('manuální klik = první karta první řady', afterClick.isFirstCard, afterClick.firstRow);

  // restore do druhé skupiny: dolů na 9. řadu, vybrat, enter, back
  for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300); }
  await page.waitForSelector('.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const picked2 = await page.evaluate(() => ({
    title: document.activeElement.querySelector('.pt-reco-title').textContent,
    row: document.activeElement.closest('.pt-reco-row').querySelector('.pt-reco-row-title').textContent,
  }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForSelector('.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const restored2 = await page.evaluate(() => {
    const el = document.activeElement;
    if (!/pt-reco-card/.test(el.className)) return { title: '(fokus mimo)', row: '' };
    return {
      title: el.querySelector('.pt-reco-title').textContent,
      row: el.closest('.pt-reco-row').querySelector('.pt-reco-row-title').textContent,
      groupVisible: !el.closest('.pt-reco-group').classList.contains('pt-reco-group--hidden'),
    };
  });
  ok('druhá skupina: stejná karta', restored2.title === picked2.title, picked2.title + ' vs ' + restored2.title);
  ok('druhá skupina: stejná řada', restored2.row === picked2.row, picked2.row + ' vs ' + restored2.row);
  ok('druhá skupina viditelná', restored2.groupVisible === true);

  // BACK zavře reco a smaže pozici -> další load bez auto-otevření
  await page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: () => 10009 });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(300);
  ok('BACK smaže pozici', await page.evaluate(() => !localStorage.getItem('tizenprehrajto.recoPos')));
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(1500);
  ok('bez pozice se reco neotevírá', !(await page.evaluate(() => document.body.classList.contains('pt-reco'))));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
