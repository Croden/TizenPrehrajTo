// Dlaždice s informacemi o filmu (TMDB) na stránce hledání + backdrop.
// Spouštět z kořene repa: node tests/test_movie.js
// (SHOT=<adresář> uloží screenshoty pro vizuální kontrolu)
const { chromium } = require('playwright');
const path = require('path');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();
const SHOT = process.env.SHOT;

const favHtml = `<!doctype html><html><head><title>x</title></head><body>
<div class="page"><div class="page-box"><div class="content">
<div class="header"><div class="top-bar"><div class="top-bar-right">
  <div class="form__group--search"><input class="video-search-phrase" type="search"></div>
</div></div></div>
<main style="padding-top:3rem"><div class="grid-container"><div class="grid-x">
  <div class="cell medium-9"><div class="section section--medium"><div class="grid-x">
    <div class="cell video-wrapper"><div class="video__picture--container">
      <a class="video video--small video--link" href="/v1" title="Video 1"><h3 class="video__title">Video 1</h3></a>
    </div></div>
  </div></div></div>
</div></div></main>
</div></div></div></body></html>`;

const result = (i, title) => `<div class="video-wrapper"><div class="video__picture--container">
<a class="video video--small video--link" href="/r${i}" title="${title}"><div class="video__header">
<div class="video__tag video__tag--time">01:30:00</div></div>
<div class="video__content"><h3 class="video__title margin-bottom-0">${title}</h3></div></a></div></div>`;

// struktura jako na webu: hlavička s vyhledáváním, sekce s nadpisem,
// lištou filtrů a výpisem
const searchHtml = (q) => `<!doctype html><html><head><title>hledej</title></head><body>
<div class="page"><div class="page-box"><div class="content">
<div class="header"><div class="top-bar"><div class="top-bar-right">
  <div class="form__group--search"><input class="video-search-phrase" type="search" value="${q}"></div>
</div></div></div>
<main><section class="section section--medium"><div class="grid-container">
  <div class="grid-x section__header margin-bottom-2"><div class="cell"><h1 class="h2 title">${q}</h1></div></div>
  <div id="snippet-videoListing-filterBar"><div class="video-listing__filters-bar"><button class="button button--filters">Filtry</button></div></div>
  <div class="video-listing" id="snippet-videoListing-videoListingWrapper">
    ${Array.from({ length: 10 }, (_, i) => result(i, q + ' ' + (i + 1) + ' CZ dabing')).join('')}
  </div>
</div></section></main>
</div></div></div></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(() => { window.__PT_SCRAPE__ = { perMin: 1000, concurrency: 2, pause: 1500 }; });
  await ctx.addInitScript(MOD);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: favHtml }));
  await page.route('https://prehrajto.cz/hledej/**', (r) => {
    const q = decodeURIComponent(r.request().url().split('/hledej/')[1]);
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchHtml(q) });
  });

  // bez klíče: žádná dlaždice, hledání funguje dál
  await page.goto('https://prehrajto.cz/hledej/Shrek%202');
  await page.waitForTimeout(1500);
  ok('bez TMDB klíče žádná dlaždice', await page.locator('#pt-movie').count() === 0);

  // odemknout doporučení (klíč do localStorage)
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(500);
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForSelector('#pt-reco-pass', { timeout: 15000 });
  await page.fill('#pt-reco-pass', 'test');
  await page.click('#pt-reco-gate button');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });

  // 1. ruční hledání s rokem a „šumem" → dlaždice filmu
  await page.goto('https://prehrajto.cz/hledej/' + encodeURIComponent('Shrek 2 (2004) CZ dabing 1080p'));
  await page.waitForSelector('#pt-movie', { timeout: 10000 });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const box = document.getElementById('pt-movie');
    const r = box.getBoundingClientRect();
    const input = document.querySelector('input.video-search-phrase').getBoundingClientRect();
    const list = document.getElementById('snippet-videoListing-videoListingWrapper').getBoundingClientRect();
    const headHidden = getComputedStyle(document.querySelector('.section__header')).display === 'none';
    const poster = box.querySelector('.pt-movie-poster');
    const bg = document.getElementById('pt-reco-backdrop');
    return {
      title: box.querySelector('.pt-movie-title').textContent,
      titleColor: getComputedStyle(box.querySelector('.pt-movie-title')).color,
      overview: (box.querySelector('.pt-movie-overview') || {}).textContent || '',
      chips: Array.from(box.querySelectorAll('.pt-movie-chip')).map((c) => c.textContent),
      cast: !!box.querySelector('.pt-movie-credit'),
      poster: poster ? { w: Math.round(poster.getBoundingClientRect().width), h: Math.round(poster.getBoundingClientRect().height), left: Math.round(poster.getBoundingClientRect().left - r.left),
        overTop: Math.round(r.top - poster.getBoundingClientRect().top), overBottom: Math.round(poster.getBoundingClientRect().bottom - r.bottom),
        img: /w342/.test(getComputedStyle(poster).backgroundImage),
        textGap: Math.round(box.querySelector('.pt-movie-title').getBoundingClientRect().left - poster.getBoundingClientRect().right) } : null,
      cardLeft: Math.round(document.querySelector('.video-listing > .video-wrapper a.video--link').getBoundingClientRect().left), boxLeft: Math.round(r.left),
      creditColor: getComputedStyle(box.querySelector('.pt-movie-credit')).color,
      height: Math.round(r.height),
      between: r.top >= input.bottom && r.bottom <= list.top + 1,
      headHidden,
      firstRowOnScreen: Math.round(document.activeElement.getBoundingClientRect().bottom) <= 1080 && window.scrollY === 0,
      wide: Math.round(r.width),
      bgClass: document.body.classList.contains('pt-movie-bg'),
      bgOpacity: bg ? getComputedStyle(bg).opacity : null,
      layer: bg ? !!bg.querySelector('.pt-reco-layer--on') : false,
      focus: document.activeElement.className,
    };
  });
  ok('dlaždice: název filmu (červený)', /Shrek 2/.test(info.title) && info.titleColor === 'rgb(190, 30, 30)', JSON.stringify(info.title));
  ok('dlaždice: český popis', info.overview.length > 40 && /[ěščřžýáíéůú]/i.test(info.overview), info.overview.slice(0, 60));
  ok('dlaždice: hodnocení, rok, délka, žánry', info.chips.length >= 3 && /★/.test(info.chips[0]) && info.chips.indexOf('2004') !== -1, JSON.stringify(info.chips));
  ok('dlaždice: režie/herci', info.cast);
  ok('dlaždice: poster 2:3 bez ořezu vlevo, přesahuje box nahoře i dole, text vedle', info.poster && info.poster.img && Math.abs(info.poster.w - info.poster.h * 2 / 3) <= 1 && info.poster.textGap >= 20 &&
    info.poster.left < 40 && info.poster.overTop > 10 && info.poster.overBottom > 10, JSON.stringify(info.poster));
  ok('dlaždice lícuje s náhledy videí, nižší (do 340 px)', Math.abs(info.boxLeft - info.cardLeft) <= 1 && info.height <= 340, JSON.stringify([info.boxLeft, info.cardLeft, info.height]));
  ok('režie/herci zašedlé', info.creditColor === 'rgb(119, 119, 119)', info.creditColor);
  ok('dlaždice mezi vyhledáváním a výsledky, přes celou šířku', info.between && info.wide > 1700, JSON.stringify(info));
  ok('nadpis s dotazem schovaný, 1. řada výsledků na obrazovce', info.headHidden && info.firstRowOnScreen, JSON.stringify(info));
  ok('backdrop filmu za stránkou (opacity 0.3)', info.bgClass && info.layer && info.bgOpacity === '0.3', JSON.stringify(info));
  ok('fokus zůstává na výsledcích', /video--link/.test(info.focus), info.focus);
  if (SHOT) await page.screenshot({ path: path.join(SHOT, 'movie-manual.png') });

  // 2. obecný dotaz → nic
  await page.goto('https://prehrajto.cz/hledej/pohadky%20cz%20dabing');
  await page.waitForTimeout(2500);
  ok('obecný dotaz bez dlaždice i backdropu', await page.evaluate(() =>
    !document.getElementById('pt-movie') && !document.body.classList.contains('pt-movie-bg')));

  // 3. z posteru doporučení → dlaždice přesně toho filmu (TMDB id)
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.click('.pt-switch-row .pt-reco-switch').catch(() => {});
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(800);
  const cardTitle = await page.evaluate(() => {
    const c = document.querySelector('.pt-reco-card');
    c.focus();
    return c.querySelector('.pt-reco-title').textContent;
  });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#pt-movie', { timeout: 10000 });
  const fromCard = await page.evaluate(() => document.querySelector('#pt-movie .pt-movie-title').textContent);
  ok('z posteru: dlaždice stejného filmu', fromCard === cardTitle, cardTitle + ' / ' + fromCard);
  if (SHOT) {
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SHOT, 'movie-card.png') });
  }

  // 4. právě sledované: fokus na videu → backdrop filmu/seriálu (z názvu
  // videa), neznámé video → backdrop pryč
  const TITLES = [
    'Hodný dinosaurus [CZ dabing, 2015, animovany]',
    'Qwzx blbost nenajdes 1080p',
    'Sám doma 1 (1990) - CZ Dabing. Top2026',
    '#Avengers_Endgame_Encore_(2026)_CZ_DABING',
    'Přátelé S01E05 CZ dabing',
    'Shrek 2 2004 CZ Dabing TOPKVALITA byLorD',
  ];
  const thumbs = (i) => [1, 2, 3].map((n) => n === 1
    ? `<img data-next="2" class="thumb thumb1" src="https://thumb.prehrajto.cz/t/${i}/1.jpg">`
    : `<img data-next="${n + 1}" class="thumb-lazy-second thumb thumb${n}" style="display: none;" data-src="https://thumb.prehrajto.cz/t/${i}/${n}.jpg">`).join('');
  const listHtml = `<!doctype html><html><head><title>x</title></head><body>
<div class="page"><div class="page-box"><div class="content">
<div class="header"><input class="video-search-phrase" type="search"></div>
<main><div class="grid-container"><div class="grid-x"><div class="cell medium-9"><div class="section"><div class="grid-x">
  ${TITLES.map((t, i) =>
    `<div class="cell video-wrapper"><div class="video__picture--container"><a class="video video--small video--link" href="/w${i}" title="${t}">
      <div class="video__header"><picture class="video-item-thumb video__picture">${thumbs(i)}</picture></div><h3 class="video__title">${t}</h3></a></div></div>`).join('')}
</div></div></div></div></div></main></div></div></div></body></html>`;
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await page.route('https://thumb.prehrajto.cz/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route('https://prehrajto.cz/profil/prave-sledovana-videa', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: listHtml }));
  await page.evaluate(() => sessionStorage.setItem('pt-watched-path', '/profil/prave-sledovana-videa'));
  await page.goto('https://prehrajto.cz/profil/prave-sledovana-videa');
  await page.waitForTimeout(800);
  const bgState = () => page.evaluate(() => {
    const bg = document.getElementById('pt-reco-backdrop');
    const on = bg && bg.querySelector('.pt-reco-layer--on');
    return { cls: bg ? bg.className : null, op: bg ? getComputedStyle(bg).opacity : null, url: on ? on.style.backgroundImage : '' };
  });
  const focusW = async (i) => {
    await page.evaluate((k) => document.querySelectorAll('a.video--link')[k].focus(), i);
    await page.waitForTimeout(3000);
    return bgState();
  };
  const urls = [];
  const checks = [
    [0, 'název před [CZ…, rok]'], [2, '„Sám doma 1 (1990) - CZ Dabing. Top2026"'],
    [3, '„#Avengers_Endgame_Encore_(2026)_CZ_DABING"'], [4, 'seriál „Přátelé S01E05"'], [5, 'Shrek 2 2004 …'],
  ];
  for (const [i, label] of checks) {
    const w = await focusW(i);
    ok('sledované: backdrop – ' + label, w.cls === 'pt-visible' && /image\.tmdb\.org/.test(w.url) && w.op === '0.3' && urls.indexOf(w.url) === -1, JSON.stringify(w));
    urls.push(w.url);
  }
  const miss = await focusW(1);
  ok('sledované: neznámé video → backdrop schovaný', miss.cls === '' && miss.op === '0', JSON.stringify(miss));
  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('tizenprehrajto.tmdbVideo2') || '{}'));
  ok('sledované: výsledky v cache (i nenalezené)', cached['sam doma 1|1990'] && cached['avengers endgame encore|2026'] && cached['pratele|'] &&
    cached['qwzx blbost nenajdes|'] === '', JSON.stringify(Object.keys(cached)));
  if (SHOT) await page.screenshot({ path: path.join(SHOT, 'watched.png') });

  // 5. střídání náhledů na fokus (jako hover na webu), po blur zpět na 1.
  const th = await page.evaluate(async () => {
    const a = document.querySelectorAll('a.video--link')[1];
    const vis = () => Array.from(a.querySelectorAll('img.thumb')).findIndex((im) => im.style.display !== 'none');
    a.focus();
    const seen = new Set([vis()]);
    for (let k = 0; k < 6; k++) { await new Promise((r) => setTimeout(r, 300)); seen.add(vis()); }
    const srcs = Array.from(a.querySelectorAll('img.thumb')).map((im) => im.getAttribute('src'));
    a.blur();
    return { seen: Array.from(seen), loaded: srcs.every((x) => /\/\d\.jpg$/.test(x || '')), after: vis() };
  });
  ok('náhledy se při fokusu střídají (líné snímky načtené)', th.seen.length === 3 && th.loaded, JSON.stringify(th));
  ok('po odchodu fokusu zpět první náhled', th.after === 0, JSON.stringify(th));

  // 6. oblíbená videa: stejný backdrop při fokusu
  await page.unroute('https://prehrajto.cz/oblibena-videa/');
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: listHtml }));
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(800);
  const fav = await focusW(5);
  ok('oblíbená: fokus na videu → backdrop filmu', fav.cls === 'pt-visible' && fav.url === urls[4] && fav.op === '0.3', JSON.stringify(fav));

  ok('bez chyb JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
