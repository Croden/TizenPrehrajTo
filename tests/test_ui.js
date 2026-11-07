// UI z v1.14.0: odhalení stránky po usazení layoutu, schování prázdných
// boxů v hlavičce, plynulý (animovaný) scroll v doporučeních, řada
// s postery na šířku, tlačítko Filtry ve vyhledávání.
// Spouštět z kořene repa: node tests/test_ui.js
const { chromium } = require('playwright');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();

const card = (i) => `
<div class="cell video-wrapper"><div class="video__picture--container">
  <a class="video video--small video--link" href="/v${i}" title="Video ${i}">
    <h3 class="video__title">Video ${i}</h3>
  </a>
</div></div>`;

// hlavička s boxy, které po schování textu zůstaly prázdné
const favHtml = `<!doctype html><html><head><title>x</title>
<style>
  .header__links{display:flex;list-style:none;margin:0;padding:10px;background:#333}
  .grey-box{background:#444;padding:12px 20px;border-radius:8px}
</style></head><body>
<script>window.__early = { loading: document.documentElement.classList.contains('pt-loading'), styles: !!document.getElementById('tizenprehrajto-styles'), op: getComputedStyle(document.body).opacity };</script>
<div class="page"><div class="page-box"><div class="content">
<div class="header"><div class="top-bar"><div class="top-bar-right">
  <div class="form__group--search"><input class="video-search-phrase" type="search"></div>
</div></div>
<div class="header__section"><ul class="header__links"><li><a href="/cenik">Premium 32 dní</a></li></ul></div>
<div class="header__section"><div class="grey-box" id="leftover"><span style="display:none">premium</span></div></div>
<div class="header__section"><div class="grey-box" id="keep">Zůstávám</div></div>
</div>
<main style="padding-top:3rem"><div class="grid-container"><div class="grid-x">
  <div class="cell medium-9"><div class="section section--medium">
    <div class="grid-x">${Array.from({ length: 4 }, (_, i) => card(i + 1)).join('')}</div>
  </div></div>
</div></div></main>
</div></div></div></body></html>`;

const searchHtml = `<!doctype html><html><head><title>hledej</title></head><body>
<div class="header"><input class="video-search-phrase" type="search"></div>
<main><section class="section"><div class="grid-container">
  <div class="grid-x section__header"><div class="cell"><h1 class="h2 title"><span class="show-for-large color-g650">shrek</span></h1></div></div>
  <div class="video-listing__filters-bar"><button class="button button--filters"><img src="/assets/ico/filter.svg" class="icon" width="16" height="16"> Filtry</button></div>
  <div id="snippet-videoListing-videoListingWrapper"><div class="video-listing">${Array.from({ length: 4 }, (_, i) => card(i + 1)).join('')}</div></div>
</div></section></main></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  // rychlý limiter dotazů (výchozí 8/min by test natahoval na minuty)
  await ctx.addInitScript(() => { window.__PT_SCRAPE__ = { perMin: 1000, concurrency: 2, pause: 1500 }; });
  await ctx.addInitScript(MOD);
  // bez trendů → žádné „Doporučené" (testuje se v test_badges.js)
  await ctx.addInitScript(() => localStorage.setItem('tizenprehrajto.trending', JSON.stringify({ ids: [], t: Date.now() })));
  const page = await ctx.newPage();
  let favExtra = []; // názvy videí přidané do mocku oblíbených
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8',
    body: favHtml.replace('<div class="grid-x">', '<div class="grid-x">' + favExtra.map((t, i) =>
      `<div class="cell video-wrapper"><a class="video video--small video--link" href="/f${i}"><h3 class="video__title">${t}</h3></a></div>`).join('')) }));
  // hledání: výchozí mock / mock s N výsledky letošního roku (badge)
  const YEAR = String(new Date().getFullYear());
  let searchMode = null; // null | počet výsledků s rokem
  let searchFetches = 0;
  const yearHtml = (n) => `<!doctype html><html><body><main><div id="snippet-videoListing-videoListingWrapper">` +
    Array.from({ length: n }, (_, i) => `<a class="video--link" href="/x${i}"><h3 class="video__title">Film ${YEAR} CZ ${i}</h3></a>`).join('') +
    `<a class="video--link" href="/old"><h3 class="video__title">Film 2008 CZ</h3></a>` +
    `</div></main></body></html>`;
  await page.route('https://prehrajto.cz/hledej/**', (r) => {
    if (searchMode === null) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchHtml });
    searchFetches++;
    if (searchMode === 'bad') {
      // letošní, ale nepoužitelné: záporné hodnocení a krátký klip
      // struktura štítků přesně podle webu (dislike = video__tag--dislike, „-1")
      const v = (t, d, cls, val) => `<a class="video video--small video--link" href="/b"><div class="video__header">` +
        `<div class="video__tag video__tag--time">${d}</div><div class="video__tag--others"><div class="video__tag--likes">` +
        `<div class="video__tag--${cls}"><picture class="icon margin-right-1"><source srcset="/public/icons/${cls}-red.svg">` +
        `<img src="/public/icons/${cls}.svg" width="16" height="16"></picture>\n ${val}\n</div></div>` +
        `<div class="video__tag video__tag--size">6.42 GB</div></div></div>` +
        `<div class="video__content"><h3 class="video__title margin-bottom-0">${t}</h3></div></a>`;
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<div id="snippet-videoListing-videoListingWrapper">` +
        v('Forgotten Island ( Film ) ' + YEAR + ' FullHD CZ tit', '01:48:53', 'dislike', '-1') +
        v('Film ' + YEAR + ' trailer CZ', '02:10', 'like', '15') + `</div>` });
    }
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: yearHtml(searchMode) });
  });

  // 1. načítání: stránka schovaná, dokud se layout neusadí
  // stav čte inline skript stránky během parsování (před DOMContentLoaded)
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  const early = await page.evaluate(() => window.__early);
  ok('při parsování už styly + html.pt-loading + obsah schovaný', early.loading && early.styles && early.op === '0', JSON.stringify(early));
  await page.waitForTimeout(800);
  const ready = await page.evaluate(() => ({
    loading: document.documentElement.classList.contains('pt-loading'),
    ready: document.body.classList.contains('pt-ready'),
    op: getComputedStyle(document.body).opacity,
  }));
  ok('po usazení odhaleno', !ready.loading && ready.ready && ready.op === '1', JSON.stringify(ready));

  // 2. prázdné boxy v hlavičce pryč, box s textem zůstává
  const boxes = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return {
      ul: vis(document.querySelector('.header__links')),
      leftover: vis(document.getElementById('leftover')),
      keep: vis(document.getElementById('keep')),
      search: vis(document.querySelector('input.video-search-phrase')),
    };
  });
  ok('premium ul schované', !boxes.ul);
  ok('prázdný šedý box schovaný', !boxes.leftover);
  ok('box s textem zůstává', boxes.keep);
  ok('vyhledávání zůstává', boxes.search);

  // 3. doporučení: řada na šířku + plynulý scroll
  searchMode = 0; // hledání: 0 výsledků s letošním rokem
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForTimeout(300);
  await page.fill('#pt-reco-pass', 'test');
  await page.click('#pt-reco-gate button');
  // skeleton drží výšku řady, než dorazí data z TMDB
  await page.waitForSelector('.pt-reco-skel', { timeout: 15000, state: 'attached' });
  const skel = await page.evaluate(() => {
    const s = document.querySelector('.pt-reco-strip');
    return { h: s.getBoundingClientRect().height, n: s.querySelectorAll('.pt-reco-skel').length };
  });
  ok('skeleton při načítání', skel.n > 0 && skel.h > 380, JSON.stringify(skel));
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForSelector('.pt-reco-row--wide .pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const skelLeft = await page.evaluate(() => document.querySelectorAll('.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-skel').length);
  const stripH = await page.evaluate(() => document.querySelector('.pt-reco-strip').getBoundingClientRect().height);
  ok('po načtení skeletony pryč, výška řady stejná', skelLeft === 0 && Math.abs(stripH - skel.h) <= 2, skelLeft + ' / ' + skel.h + ' → ' + stripH);
  const wide = await page.evaluate(() => {
    const w = document.querySelector('.pt-reco-row--wide .pt-reco-card');
    const n = document.querySelector('.pt-reco-row:not(.pt-reco-row--wide) .pt-reco-card');
    const wi = w.querySelector('img').getBoundingClientRect();
    const ni = n.querySelector('img').getBoundingClientRect();
    return { ww: wi.width, wh: wi.height, nw: ni.width, cls: w.className, src: w.querySelector('img').src };
  });
  ok('řada na šířku má široké karty', /pt-reco-card--wide/.test(wide.cls));
  ok('široká karta = 2 místa', Math.abs(wide.ww - (2 * wide.nw + 12)) < 2, JSON.stringify(wide));
  ok('široká karta je na šířku', wide.ww > wide.wh * 1.5);
  ok('široká karta má backdrop w780', /\/w780\//.test(wide.src));

  // badge dostupnosti letošních filmů – zjišťuje se hned po vykreslení
  // (fronta na pozadí), ne až při fokusu
  const SEL = '.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-card';
  const yearInfo = () => page.evaluate(({ year, sel }) => {
    const cs = Array.from(document.querySelectorAll(sel)).filter((c) => {
      const y = c.querySelector('.pt-reco-year');
      return y && y.textContent === year;
    });
    const titles = new Set(cs.map((c) => c.querySelector('.pt-reco-title').textContent));
    const badges = cs.map((c) => { const b = c.querySelector('.pt-reco-badge'); return b ? b.textContent : null; });
    return { n: cs.length, unique: titles.size, badges };
  }, { year: YEAR, sel: SEL });
  const waitBadges = (text) => page.waitForFunction(({ year, sel, text }) => {
    const cs = Array.from(document.querySelectorAll(sel)).filter((c) => {
      const y = c.querySelector('.pt-reco-year');
      return y && y.textContent === year;
    });
    return cs.length > 0 && cs.every((c) => { const b = c.querySelector('.pt-reco-badge'); return text === null ? true : b && b.textContent === text; });
  }, { year: YEAR, sel: SEL, text }, { timeout: 30000 });
  const reopenReco = async () => {
    await page.goto('https://prehrajto.cz/oblibena-videa/');
    await page.waitForTimeout(400);
    await page.click('.pt-switch-row .pt-reco-switch');
    await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  };

  let info = await yearInfo();
  ok('jsou letošní karty', info.n >= 3, 'n=' + info.n);
  await waitBadges('Nedostupné').then(() => ok('všechny letošní karty mají badge bez fokusu', true))
    .catch(() => ok('všechny letošní karty mají badge bez fokusu', false, JSON.stringify(info)));
  info = await yearInfo();
  // +1 = fokusovaná první karta (starší film) – check po 300 ms fokusu
  ok('jeden fetch na titul', searchFetches === info.unique || searchFetches === info.unique + 1, 'fetches=' + searchFetches + ' titulů=' + info.unique);
  const stored = await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}');
    const k = Object.keys(m);
    return { n: k.length, t: k.length ? m[k[0]].t : 0 };
  });
  ok('cache v localStorage', (stored.n === info.unique || stored.n === info.unique + 1) && Date.now() - stored.t < 60000, JSON.stringify(stored));
  // „Nedostupné" = šikmá páska přes levý horní roh posteru
  const rib = await page.evaluate((sel) => {
    const b = document.querySelector(sel + ' .pt-reco-badge');
    const im = b.closest('.pt-reco-poster').getBoundingClientRect();
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { slot: b.className, tr: cs.transform, top: Math.round(r.top - im.top), left: Math.round(r.left - im.left),
      cx: (r.left + r.width / 2 - im.left) / im.width, cy: (r.top + r.height / 2 - im.top) / im.height,
      clip: getComputedStyle(b.closest('.pt-reco-poster')).overflow, shadow: cs.boxShadow };
  }, SEL);
  // rotate(-45deg) = matrix(0.707, -0.707, 0.707, 0.707, …)
  ok('Nedostupné = šikmá páska vlevo nahoře', /pt-reco-badge--ribbon/.test(rib.slot) && /^matrix\(0\.70\d+, -0\.70\d+/.test(rib.tr) &&
    rib.cx < 0.35 && rib.cy < 0.25 && rib.clip === 'hidden', JSON.stringify(rib));
  ok('páska má černý stín', /rgba\(0, 0, 0/.test(rib.shadow));

  // 2 výsledky s rokem → Novinka
  await page.evaluate(() => localStorage.removeItem('tizenprehrajto.avail5'));
  searchMode = 2;
  await reopenReco();
  await waitBadges('Novinka').then(() => ok('2 výsledky s rokem = Novinka', true))
    .catch(async () => ok('2 výsledky s rokem = Novinka', false, JSON.stringify(await yearInfo())));
  const pill = await page.evaluate((sel) => {
    const b = Array.from(document.querySelectorAll(sel + ' .pt-reco-badge--pill')).find((x) => !x.closest('.pt-reco-card--wide'));
    const im = b.closest('.pt-reco-poster').getBoundingClientRect();
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { slot: b.className, text: b.textContent, dl: Math.round(r.left - im.left), fromBottom: (im.bottom - r.bottom) / im.height,
      w: r.width / im.width, bg: cs.backgroundColor, pl: cs.paddingLeft, pr: cs.paddingRight };
  }, SEL);
  ok('Novinka = červený pill vlevo, ~10 % od spodu, šířka podle textu', /pt-reco-badge--pill/.test(pill.slot) && pill.text === 'Novinka' &&
    pill.dl === 0 && Math.abs(pill.fromBottom - 0.1) < 0.02 && pill.w < 0.6 && pill.pl === pill.pr && pill.bg === 'rgb(190, 30, 30)', JSON.stringify(pill));

  // po reloadu z cache – zjištěné tituly bez fetchu, badge hned (řady jsou
  // promíchané, nové tituly se fetchují normálně)
  searchMode = 5; searchFetches = 0;
  await reopenReco();
  await page.waitForTimeout(2500);
  const cacheCheck = await page.evaluate(({ year, sel }) => {
    const m = JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}');
    const cs = Array.from(document.querySelectorAll(sel)).filter((c) => {
      const y = c.querySelector('.pt-reco-year');
      return y && y.textContent === year;
    });
    let cached = 0, bad = 0;
    const fresh = new Set();
    cs.forEach((c) => {
      const t = c.querySelector('.pt-reco-title').textContent;
      const e = m[year + '|' + t];
      const b = c.querySelector('.pt-reco-badge');
      if (e && e.n === 2) { cached++; if (!b || b.textContent !== 'Novinka') bad++; } else fresh.add(t);
    });
    return { cached, bad, fresh: fresh.size };
  }, { year: YEAR, sel: SEL });
  // +1 = fokusovaná první karta (starší film) si po 300 ms dělá vlastní check
  ok('po reloadu z cache: badge hned, fetch jen nové tituly', cacheCheck.cached > 0 && cacheCheck.bad === 0 &&
    searchFetches >= cacheCheck.fresh && searchFetches <= cacheCheck.fresh + 1,
    JSON.stringify(cacheCheck) + ' fetches=' + searchFetches);

  // jen nepoužitelné letošní verze (dislike, trailer) → Nedostupné
  await page.evaluate(() => localStorage.removeItem('tizenprehrajto.avail5'));
  searchMode = 'bad';
  await reopenReco();
  await waitBadges('Nedostupné').then(() => ok('záporné hodnocení / krátký klip se nepočítá', true))
    .catch(async () => ok('záporné hodnocení / krátký klip se nepočítá', false, JSON.stringify((await yearInfo()).badges.slice(0, 5))));
  searchMode = 5;

  // 5 výsledků → bez badge
  await page.evaluate(() => localStorage.removeItem('tizenprehrajto.avail5'));
  searchFetches = 0;
  await reopenReco();
  await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}')).length > 0, null, { timeout: 15000 });
  info = await yearInfo();
  await page.waitForFunction((u) => Object.keys(JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}')).length >= u, info.unique, { timeout: 30000 });
  info = await yearInfo();
  ok('5 výsledků = bez badge', info.badges.every((b) => b === null), JSON.stringify(info.badges.slice(0, 5)));
  searchMode = null;

  // srdíčko u filmů v oblíbených – jen při fokusu
  // stálá (nemíchaná) řada – po znovuotevření budou stejné filmy
  const movies = await page.evaluate(() => Array.from(document.querySelectorAll('.pt-reco-row--boxed .pt-reco-card')).slice(0, 12).map((c) => ({
    title: c.querySelector('.pt-reco-title').textContent,
    year: (c.querySelector('.pt-reco-year') || {}).textContent || '',
  })));
  const favMovie = movies.find((m) => m.year);
  const wrongYear = movies.find((m) => m.year && m.title !== favMovie.title && !m.title.includes(favMovie.title) && !favMovie.title.includes(m.title));
  favExtra = [favMovie.title + ' (' + favMovie.year + ') CZ dabing 1080p', wrongYear.title + ' 1950 CZ'];
  // seznam oblíbených se obnovuje max. 1× za 30 min – vynutit obnovu
  await page.evaluate(() => localStorage.removeItem('tizenprehrajto.favTitlesAt'));
  await reopenReco();
  await page.waitForFunction(() => !!localStorage.getItem('tizenprehrajto.favTitles') &&
    JSON.parse(localStorage.getItem('tizenprehrajto.favTitles')).length >= 2, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const heartOf = (title) => page.evaluate(({ sel, title }) => {
    const c = Array.from(document.querySelectorAll(sel)).find((x) => x.querySelector('.pt-reco-title').textContent === title);
    const h = c.querySelector('.pt-reco-fav');
    return { fav: c.classList.contains('pt-reco-card--fav'), shown: getComputedStyle(h).display !== 'none' };
  }, { sel: SEL, title });
  let hs = await heartOf(favMovie.title);
  ok('film v oblíbených označen, bez fokusu srdíčko skryté', hs.fav && !hs.shown, JSON.stringify(hs) + ' ' + favMovie.title);
  await page.evaluate(({ sel, title }) => Array.from(document.querySelectorAll(sel))
    .find((x) => x.querySelector('.pt-reco-title').textContent === title).focus(), { sel: SEL, title: favMovie.title });
  hs = await heartOf(favMovie.title);
  const hpos = await page.evaluate(() => {
    const h = document.activeElement.querySelector('.pt-reco-fav').getBoundingClientRect();
    const p = document.activeElement.querySelector('.pt-reco-poster').getBoundingClientRect();
    const fill = getComputedStyle(document.activeElement.querySelector('.pt-reco-fav svg')).fill;
    return { dl: h.left - p.left, db: p.bottom - h.bottom, fill };
  });
  ok('při fokusu červené srdíčko vlevo dole', hs.shown && hpos.dl < 12 && hpos.db < 12 && hpos.fill === 'rgb(190, 30, 30)', JSON.stringify(hpos));
  hs = await heartOf(wrongYear.title);
  ok('jiný rok ve videu = není v oblíbených', !hs.fav, wrongYear.title);
  favExtra = [];

  // návrat na původní stránku (span) má v doporučení hover jako ostatní
  await page.hover('.pt-switch-row .pt-reco-return');
  const retOutline = await page.evaluate(() => getComputedStyle(document.querySelector('.pt-reco-return')).outlineStyle);
  ok('návratový přepínač reaguje na hover', retOutline === 'solid', retOutline);

  // druhá skupina: „Novinky pro celou rodinu" ve žlutém bloku s tmavým textem
  const yellow = await page.evaluate(() => {
    const r = document.querySelector('.pt-reco-row--yellow');
    if (!r) return null;
    const cs = (sel) => getComputedStyle(r.querySelector(sel));
    return { title: r.querySelector('.pt-reco-row-title').textContent, bg: getComputedStyle(r).backgroundColor,
      rowTitle: cs('.pt-reco-row-title').color, cardTitle: r.querySelector('.pt-reco-title') ? cs('.pt-reco-title').color : null,
      redRows: document.querySelectorAll('.pt-reco-row--boxed:not(.pt-reco-row--yellow)').length };
  });
  ok('2. skupina: žlutý blok (opacita 0.5), tmavý text', yellow && yellow.title === 'Novinky pro celou rodinu' &&
    yellow.bg === 'rgba(255, 180, 0, 0.5)' && yellow.rowTitle === 'rgb(26, 26, 26)' && yellow.redRows === 1, JSON.stringify(yellow));

  await page.evaluate(() => document.querySelector('.pt-reco-card').focus());
  await page.evaluate(() => window.scrollTo(0, 0));
  const y0 = await page.evaluate(() => window.scrollY);
  // vzorkovat scroll během animace
  const samples = await page.evaluate(() => new Promise((res) => {
    const ys = [];
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: () => 40 });
    window.dispatchEvent(ev);
    const t0 = Date.now();
    (function tick() {
      ys.push(window.scrollY);
      if (Date.now() - t0 < 500) requestAnimationFrame(tick); else res(ys);
    })();
  }));
  const end = samples[samples.length - 1];
  const mid = samples.filter((y) => y > y0 && y < end).length;
  ok('scroll okna je animovaný', end > y0 && mid >= 3, 'mezikroků=' + mid + ' ' + y0 + '→' + end);

  // vodorovně: řada se posouvá plynule
  const h = await page.evaluate(() => new Promise((res) => {
    const strip = document.activeElement.parentElement;
    const cards = strip.querySelectorAll('.pt-reco-card');
    cards[5].focus();
    const s0 = strip.scrollLeft;
    const xs = [];
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: () => 39 });
    for (let i = 0; i < 4; i++) window.dispatchEvent(ev);
    const t0 = Date.now();
    (function tick() {
      xs.push(strip.scrollLeft);
      if (Date.now() - t0 < 500) requestAnimationFrame(tick); else res({ s0, xs });
    })();
  }));
  const hEnd = h.xs[h.xs.length - 1];
  const hMid = h.xs.filter((x) => x > h.s0 && x < hEnd).length;
  ok('řada se posouvá animovaně', hEnd > h.s0 && hMid >= 3, 'mezikroků=' + hMid + ' ' + h.s0 + '→' + hEnd);
  const inView = await page.evaluate(() => {
    const el = document.activeElement;
    const s = el.parentElement.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.left >= s.left && r.right <= s.right;
  });
  ok('fokusovaná karta po animaci v řadě vidět', inView);

  // 4. vyhledávání: tlačítko Filtry bez ikonky, proporce jako přepínače
  await page.goto('https://prehrajto.cz/hledej/shrek');
  await page.waitForTimeout(800);
  const btn = await page.evaluate(() => {
    const b = document.querySelector('.button--filters');
    const cs = getComputedStyle(b);
    const h1 = getComputedStyle(document.querySelector('main h1.title'));
    const span = getComputedStyle(document.querySelector('main h1.title span'));
    return {
      icon: getComputedStyle(b.querySelector('img')).display,
      fs: cs.fontSize, pad: cs.padding,
      h1fs: h1.fontSize, spanColor: span.color,
    };
  });
  ok('ikonka filtrů schovaná', btn.icon === 'none');
  ok('tlačítko Filtry jako přepínač', btn.fs === '18px' && btn.pad === '6px 20px', btn.fs + ' / ' + btn.pad);
  ok('nadpis hledání jako nadpis řady', btn.h1fs === '22px' && btn.spanColor === 'rgb(255, 255, 255)', btn.h1fs + ' ' + btn.spanColor);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
