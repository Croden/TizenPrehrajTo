// Stránka Doporučení: brána s heslem, řady karet, navigace, infinite
// loading, BACK. Spouštět z kořene repa: node tests/test_reco.js
const { chromium } = require('playwright');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();

const card = (i) => `
<div class="cell video-wrapper"><div class="video__picture--container">
  <a class="video video--small video--link" href="/v${i}" title="Video ${i}">
    <h3 class="video__title">Video ${i}</h3>
  </a>
</div></div>`;

const pageHtml = `<!doctype html><html><head><title>x</title>
<style>
  .top-bar-right{display:flex;justify-content:flex-end;padding-right:40px}
  .header__links{display:flex;justify-content:flex-end;list-style:none;margin:0;padding:0 10px 0 0}
</style></head><body>
<div class="page"><div class="page-box"><div class="content">
<div class="header"><div class="top-bar"><div class="top-bar-right">
  <div class="form__group--search"><input class="video-search-phrase" type="search"></div>
</div></div>
<div class="header__section"><ul class="header__links"><li><a href="/cenik">Premium 32 dní</a></li></ul></div></div>
<main style="padding-top:3rem"><div class="grid-container"><div class="grid-x">
  <div class="cell medium-3 sidebar"><ul>
    <li><a href="/oblibena-videa/">Oblíbená videa</a></li>
    <li><a href="/profil/prave-sledovana-videa">Právě sledované uživateli</a></li>
  </ul></div>
  <div class="cell medium-9"><div class="section section--medium" style="padding-top:2.5rem">
    <div class="grid-x">${Array.from({ length: 4 }, (_, i) => card(i + 1)).join('')}</div>
  </div></div>
</div></div></main>
</div></div></div></body></html>`;

const searchHtml = `<!doctype html><html><head><title>hledej</title></head><body>
<main><input class="video-search-phrase" type="search"><div id="snippet-videoListing-videoListingWrapper"></div></main></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(MOD);
  const page = await ctx.newPage();
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml }));
  await page.route('https://prehrajto.cz/hledej/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchHtml }));
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(500);

  // 1. třetí přepínač existuje
  const sw = page.locator('.pt-switch-row .pt-reco-switch');
  ok('přepínač Doporučení existuje', await sw.count() === 1);

  // 2. klik → brána (bez klíče v localStorage)
  await sw.click();
  await page.waitForTimeout(300);
  ok('body.pt-reco', await page.evaluate(() => document.body.classList.contains('pt-reco')));
  ok('brána viditelná', await page.locator('#pt-reco-gate').isVisible());
  ok('grid skrytý', !(await page.locator('.pt-fav-grid').first().isVisible().catch(() => false)));

  // 3. špatné heslo → chyba
  await page.fill('#pt-reco-pass', 'spatne');
  await page.click('#pt-reco-gate button');
  await page.waitForTimeout(800);
  const err = await page.locator('.pt-reco-err').textContent();
  ok('špatné heslo hlásí chybu', /heslo/i.test(err), JSON.stringify(err));

  // 4. správné heslo → řady karet z TMDB
  await page.fill('#pt-reco-pass', 'test');
  await page.click('#pt-reco-gate button');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const rows = await page.locator('.pt-reco-row').count();
  const cards = await page.locator('.pt-reco-card').count();
  ok('řady kategorií', rows === 14, 'rows=' + rows);
  ok('karty načtené', cards > 50, 'cards=' + cards);
  ok('klíč v localStorage', await page.evaluate(() => !!localStorage.getItem('tizenprehrajto.tmdbKey')));
  ok('titulky viditelné', await page.locator('.pt-reco-title').first().isVisible());

  // 5. fokus na první kartě
  let focused = await page.evaluate(() => document.activeElement.className);
  ok('fokus na kartě', /pt-reco-card/.test(focused), focused);

  // 6. šipky: doprava posune v řadě
  const firstTitle = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const secondTitle = await page.evaluate(() => document.activeElement.textContent.trim());
  ok('doprava = další karta', /pt-reco-card/.test(await page.evaluate(() => document.activeElement.className)) && secondTitle !== firstTitle);

  // 7. dolů = další řada
  const row0 = await page.evaluate(() => document.activeElement.closest('.pt-reco-row').querySelector('.pt-reco-row-title').textContent);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  const row1 = await page.evaluate(() => {
    const el = document.activeElement;
    return el.closest('.pt-reco-row') ? el.closest('.pt-reco-row').querySelector('.pt-reco-row-title').textContent : '(mimo)';
  });
  ok('dolů = jiná kategorie', row1 !== row0 && row1 !== '(mimo)', row0 + ' → ' + row1);

  // 8. nahoru z první řady → přepínač/hledání
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  const upEl = await page.evaluate(() => document.activeElement.className + '|' + document.activeElement.tagName);
  ok('nahoru opustí karty', !/pt-reco-card/.test(upEl), upEl);

  // 9. infinite loading: na konec řady a doprava
  await page.evaluate(() => {
    const strip = document.querySelector('.pt-reco-strip');
    const cs = strip.querySelectorAll('.pt-reco-card');
    cs[cs.length - 1].focus();
  });
  const before = await page.evaluate(() => document.querySelectorAll('.pt-reco-strip')[0].querySelectorAll('.pt-reco-card').length);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => document.querySelectorAll('.pt-reco-strip')[0].querySelectorAll('.pt-reco-card').length);
  ok('infinite loading', after > before, before + ' → ' + after);

  // 10. Enter na kartě → /hledej/<title>
  const title = await page.evaluate(() => {
    const c = document.querySelector('.pt-reco-card');
    c.focus();
    return c.querySelector('.pt-reco-title').textContent;
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  ok('Enter hledá titul', page.url().indexOf('/hledej/') !== -1 && decodeURIComponent(page.url()).indexOf(title) !== -1, page.url());

  // 11. návrat a klik na přepínač (pozice z Enteru se smaže, reco od začátku)
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(500);
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  ok('podruhé bez brány', !(await page.locator('#pt-reco-gate').isVisible().catch(() => false)));
  await page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: () => 10009 });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(300);
  ok('BACK zavře doporučení', !(await page.evaluate(() => document.body.classList.contains('pt-reco'))));
  const fcls = await page.evaluate(() => document.activeElement.className);
  ok('fokus zpět na přepínači', /pt-reco-switch/.test(fcls), fcls);

  // 12. Enter na pt-reco-return zavře
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.evaluate(() => document.querySelector('.pt-reco-return').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  ok('Enter na návratu zavře', !(await page.evaluate(() => document.body.classList.contains('pt-reco'))));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
