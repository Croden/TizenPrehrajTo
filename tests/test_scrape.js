// Limiter dotazů na prehrajto (web vrací 429 při ~10/min): max. N dotazů
// v okně, pauza a opakování po 429, výsledky natrvalo v cache (na pozadí
// se uložené neobnovují), přednost fokusované karty.
// Okno/pauza jsou pro test zkrácené (window.__PT_SCRAPE__).
// Spouštět z kořene repa: node tests/test_scrape.js
const { chromium } = require('playwright');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();
const YEAR = String(new Date().getFullYear());
const CFG = { perMin: 3, window: 3000, pause: 1500, concurrency: 1 };

const favHtml = `<!doctype html><html><head><title>x</title></head><body>
<div class="header"><input class="video-search-phrase" type="search"></div>
<main><div class="grid-x"><div class="cell video-wrapper"><a class="video video--small video--link" href="/v1"><h3 class="video__title">Video 1</h3></a></div></div></main>
</body></html>`;
const searchPage = (q) => `<!doctype html><html><body><div class="video-listing" id="snippet-videoListing-videoListingWrapper">
<div class="video-wrapper"><a class="video video--small video--link" href="/a"><div class="video__tag video__tag--time">01:40:00</div>
<h3 class="video__title">${q} ${YEAR} CZ dabing</h3></a></div>
<div class="video-wrapper"><a class="video video--small video--link" href="/b"><div class="video__tag video__tag--time">01:40:00</div>
<h3 class="video__title">${q} CZ dabing 1080p</h3></a></div></div></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript((cfg) => { window.__PT_SCRAPE__ = cfg; }, CFG);
  if (process.env.DEBUG) await ctx.addInitScript(() => localStorage.setItem('tizenprehrajto.debug', '1'));
  await ctx.addInitScript(MOD);
  await ctx.addInitScript(() => localStorage.setItem('tizenprehrajto.trending', JSON.stringify({ ids: [], t: Date.now() })));
  const page = await ctx.newPage();
  if (process.env.DEBUG) page.on('console', (m) => { if (/pt-scrape/.test(m.text())) console.log(Date.now() % 100000, m.text()); });

  const reqs = []; // {t, q, status, kind}
  let fail429 = 2; // první 2 hledání vrátí 429
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => {
    if (r.request().resourceType() !== 'document') reqs.push({ t: Date.now(), q: '(oblíbená)', status: 200, kind: 'fav' });
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: favHtml });
  });
  await page.route('https://prehrajto.cz/hledej/**', (r) => {
    const q = decodeURIComponent(r.request().url().split('/hledej/')[1]);
    if (fail429 > 0) {
      fail429--;
      reqs.push({ t: Date.now(), q, status: 429, kind: 'search' });
      return r.fulfill({ status: 429, contentType: 'text/html', body: 'Too Many Requests' });
    }
    reqs.push({ t: Date.now(), q, status: 200, kind: 'search' });
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchPage(q) });
  });

  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForSelector('#pt-reco-pass', { timeout: 5000 });
  await page.fill('#pt-reco-pass', 'test');
  await page.click('#pt-reco-gate button');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  const t0 = Date.now();
  await page.waitForTimeout(11000);

  // 1. limit: v žádném okně CFG.window víc než CFG.perMin ÚSPĚŠNÝCH dotazů
  //    (web 429 do limitu nepočítá – mod je z okna taky vyřadí)
  let maxInWindow = 0;
  const okReqs = reqs.filter((r) => r.status === 200);
  for (let i = 0; i < okReqs.length; i++) {
    const n = okReqs.filter((r) => r.t >= okReqs[i].t && r.t < okReqs[i].t + CFG.window).length;
    maxInWindow = Math.max(maxInWindow, n);
  }
  ok('limit dotazů v okně dodržen', reqs.length >= 4 && maxInWindow <= CFG.perMin, 'dotazů=' + reqs.length + ' max v okně=' + maxInWindow);

  // 2. po 429 pauza: další dotaz nejdřív po CFG.pause
  const i429 = reqs.findIndex((r) => r.status === 429);
  const after = reqs[i429 + 1];
  ok('po 429 pauza před dalším dotazem', i429 !== -1 && after && after.t - reqs[i429].t >= CFG.pause - 50,
    after ? (after.t - reqs[i429].t) + ' ms' : 'žádný další dotaz');

  // 3. titul s 429 se neuloží jako nedostupný a zkusí se znovu
  const q429 = reqs[i429].q;
  const retried = reqs.some((r, i) => i > i429 && r.q === q429 && r.status === 200);
  const e429 = await page.evaluate((q) => {
    const c = Array.from(document.querySelectorAll('.pt-reco-card')).find((x) => x.__ptMovie.title === q);
    return (JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}'))[c.__ptMovie.year + '|' + q];
  }, q429);
  ok('titul s 429 se zopakoval a uložil správně', retried && e429 && e429.n >= 1, q429 + ' ' + JSON.stringify(e429));
  ok('nic nebylo uloženo jako Nedostupné kvůli 429', await page.evaluate(() =>
    Object.values(JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}')).every((e) => e.n > 0)));

  // 4. natrvalo v cache: 3 dny staré letošní výsledky se ukážou hned,
  //    a na pozadí se už neobnovují
  // stálá řada „Nově ke zhlédnutí" – po znovuotevření stejné filmy
  await page.evaluate(() => {
    const m = {};
    document.querySelectorAll('.pt-reco-row--boxed .pt-reco-card').forEach((c) => {
      m[c.__ptMovie.year + '|' + c.__ptMovie.title] = { n: 0, d: 0, t: Date.now() - 3 * 864e5 };
    });
    localStorage.setItem('tizenprehrajto.avail5', JSON.stringify(m));
    localStorage.setItem('tizenprehrajto.favTitlesAt', String(Date.now())); // oblíbená čerstvá
  });
  const cachedKeys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tizenprehrajto.avail5'))));
  reqs.length = 0;
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(400);
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(300);
  const shown = await page.evaluate((keys) => {
    // fokusovaná karta se po 300 ms legitimně obnoví – vynechat
    const cs = Array.from(document.querySelectorAll('.pt-reco-card')).filter((c) => c !== document.activeElement &&
      keys.includes(c.__ptMovie.year + '|' + c.__ptMovie.title));
    return { n: cs.length, withBadge: cs.filter((c) => c.querySelector('.pt-reco-badge--ribbon')).length };
  }, cachedKeys);
  ok('3 dny starý výsledek se ukáže hned z cache', shown.n > 0 && shown.withBadge === shown.n, JSON.stringify(shown) + ' dotazů=' + reqs.length);

  await page.waitForTimeout(1500);
  const refetched = await page.evaluate(({ keys, qs }) => {
    const cs = Array.from(document.querySelectorAll('.pt-reco-card')).filter((c) => c !== document.activeElement &&
      keys.includes(c.__ptMovie.year + '|' + c.__ptMovie.title));
    return cs.map((c) => c.__ptMovie.title).filter((t) => qs.includes(t));
  }, { keys: cachedKeys, qs: reqs.filter((r) => r.kind === 'search').map((r) => r.q) });
  ok('uložené výsledky se na pozadí neobnovují', refetched.length === 0, refetched.join(', '));

  // 5. fokus má přednost před frontou na pozadí
  const oldTitle = await page.evaluate((year) => {
    const c = Array.from(document.querySelectorAll('.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-card'))
      .find((x) => x.__ptMovie.year && x.__ptMovie.year !== year && x !== document.activeElement);
    c.focus();
    return c.__ptMovie.title;
  }, YEAR);
  const tFocus = Date.now();
  if (process.env.DEBUG) console.log(tFocus % 100000, '>>> FOKUS', oldTitle);
  await page.waitForTimeout(CFG.window + 1500);
  // check se zařadí po 300 ms fokusu – první dotaz po tom musí být on
  const nextAfter = reqs.filter((r) => r.kind === 'search' && r.t > tFocus + 200);
  ok('fokusovaná karta jde před frontu na pozadí', nextAfter.length && nextAfter[0].q === oldTitle,
    oldTitle + ' vs ' + (nextAfter[0] || {}).q);
  ok('chybějící letošní se dohledávají na pozadí (stále v limitu)', reqs.filter((r) => r.kind === 'search').length >= 2);

  // 6. výchozí limit podle přihlášení (bez testovacího přepisu):
  //    oblíbená = přihlášený → 20/min (pozadí 16), jinak 5/min
  const ctx3 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx3.addInitScript(MOD);
  await ctx3.addInitScript(() => localStorage.setItem('tizenprehrajto.trending', JSON.stringify({ ids: [], t: Date.now() })));
  const p3 = await ctx3.newPage();
  let n3 = 0;
  await p3.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: favHtml }));
  await p3.route('https://prehrajto.cz/hledej/**', (r) => {
    n3++;
    const q = decodeURIComponent(r.request().url().split('/hledej/')[1]);
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchPage(q) });
  });
  await p3.goto('https://prehrajto.cz/oblibena-videa/');
  await p3.waitForSelector('#pt-reco-pass', { timeout: 5000 });
  await p3.fill('#pt-reco-pass', 'test');
  await p3.click('#pt-reco-gate button');
  await p3.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await p3.waitForTimeout(5000);
  ok('přihlášený (oblíbená): víc než 5 dotazů za minutu, max. 20', n3 > 5 && n3 <= 20, 'dotazů=' + n3);
  await ctx3.close();

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
