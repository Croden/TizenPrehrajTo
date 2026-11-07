// Spuštění aplikace rovnou do Doporučení + fokus na první položku
// (poster / video / výsledek hledání) místo vyhledávání.
// Spouštět z kořene repa: node tests/test_launch.js
const { chromium } = require('playwright');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();

const card = (i) => `
<div class="cell video-wrapper"><div class="video__picture--container">
  <a class="video video--small video--link" href="/v${i}" title="Video ${i}">
    <h3 class="video__title">Video ${i}</h3>
  </a>
</div></div>`;

const favHtml = `<!doctype html><html><head><title>x</title></head><body>
<div class="page"><div class="page-box"><div class="content">
<div class="header"><div class="top-bar"><div class="top-bar-right">
  <div class="form__group--search"><input class="video-search-phrase" type="search"></div>
</div></div></div>
<main style="padding-top:3rem"><div class="grid-container"><div class="grid-x">
  <div class="cell medium-9"><div class="section section--medium">
    <div class="grid-x">${Array.from({ length: 6 }, (_, i) => card(i + 1)).join('')}</div>
  </div></div>
</div></div></main>
</div></div></div></body></html>`;

const searchHtml = `<!doctype html><html><head><title>hledej</title></head><body>
<div class="header"><input class="video-search-phrase" type="search"></div>
<main><div id="snippet-videoListing-videoListingWrapper"><div class="video-listing">
${Array.from({ length: 4 }, (_, i) => card(i + 10)).join('')}</div></div></main></body></html>`;

const active = (page) => page.evaluate(() => {
  const el = document.activeElement;
  return { cls: el.className || '', tag: el.tagName, href: el.getAttribute('href') || '' };
});

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  // rychlý limiter dotazů (výchozí 8/min by test natahoval na minuty)
  await ctx.addInitScript(() => { window.__PT_SCRAPE__ = { perMin: 1000, concurrency: 2, pause: 1500 }; });
  await ctx.addInitScript(MOD);
  // klíč odemčený z dřívějška (jako na TV po prvním zadání hesla)
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('tizenprehrajto.tmdbKey') && window.__ptTestKey) {
      localStorage.setItem('tizenprehrajto.tmdbKey', window.__ptTestKey);
    }
  });
  const page = await ctx.newPage();
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: favHtml }));
  await page.route('https://prehrajto.cz/hledej/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchHtml }));

  // 1. první spuštění bez klíče → doporučení s bránou (heslo)
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(800);
  ok('spuštění otevře doporučení', await page.evaluate(() => document.body.classList.contains('pt-reco')));
  ok('bez klíče brána s fokusem na hesle', (await active(page)).cls === '' && await page.evaluate(() => document.activeElement.id === 'pt-reco-pass'));
  await page.fill('#pt-reco-pass', 'test');
  await page.click('#pt-reco-gate button');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(800);
  ok('po odemčení fokus na prvním posteru', await page.evaluate(() => document.activeElement === document.querySelector('.pt-reco-card')));

  // 2. nové spuštění aplikace (nová relace = prázdný sessionStorage) s klíčem
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(800);
  ok('nové spuštění: rovnou doporučení', await page.evaluate(() => document.body.classList.contains('pt-reco')));
  ok('nové spuštění: fokus na prvním posteru', await page.evaluate(() => document.activeElement === document.querySelector('.pt-reco-card')));
  ok('nahoře (scroll 0)', await page.evaluate(() => window.scrollY === 0));

  // 3. BACK → oblíbená, fokus na prvním videu
  await page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: () => 10009 });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(400);
  let a = await active(page);
  ok('BACK z doporučení → oblíbená, fokus na 1. videu', a.href === '/v1', JSON.stringify(a));

  // 4. další načtení oblíbených ve stejné relaci → zůstává oblíbená
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(1200);
  ok('další načtení v relaci = oblíbená', !(await page.evaluate(() => document.body.classList.contains('pt-reco'))));
  a = await active(page);
  ok('oblíbená: fokus na 1. videu (ne vyhledávání)', a.href === '/v1', JSON.stringify(a));

  // 5. vyhledávání: fokus na prvním výsledku
  await page.goto('https://prehrajto.cz/hledej/shrek');
  await page.waitForTimeout(1200);
  a = await active(page);
  ok('hledání: fokus na 1. výsledku', a.href === '/v10', JSON.stringify(a));

  // 6. homepage → přesměrování na oblíbená
  await page.route('https://prehrajto.cz/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<html><body><input class="video-search-phrase"></body></html>' }));
  await page.evaluate(() => sessionStorage.removeItem('pt-home-redirect'));
  await page.goto('https://prehrajto.cz/');
  await page.waitForTimeout(800);
  ok('/ přesměruje na /oblibena-videa/', page.url() === 'https://prehrajto.cz/oblibena-videa/', page.url());

  // 7. nepřihlášený: oblíbená → / (web) – podruhé už žádná smyčka
  await page.unroute('https://prehrajto.cz/oblibena-videa/');
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ status: 302, headers: { location: 'https://prehrajto.cz/' } }));
  await page.evaluate(() => sessionStorage.removeItem('pt-home-redirect'));
  await page.goto('https://prehrajto.cz/');
  await page.waitForTimeout(1500);
  ok('nepřihlášený zůstane na homepage (bez smyčky)', page.url() === 'https://prehrajto.cz/', page.url());

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
