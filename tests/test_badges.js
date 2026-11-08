// Dabing/dostupnost (Bez dabingu, starší filmy po fokusu + trvalá cache),
// badge „Doporučené", nejlepší verze ve výsledcích hledání, historie
// sledování na oblíbených. Spouštět z kořene repa: node tests/test_badges.js
const { chromium } = require('playwright');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();
const YEAR = String(new Date().getFullYear());

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

// výsledek hledání se strukturou webu
const result = (href, title, dur, cls, val) => `<div class="video-wrapper"><div class="video__picture--container">
<a class="video video--small video--link" href="${href}" title="${title}"><div class="video__header">
<div class="video__tag video__tag--time">${dur}</div><div class="video__tag--others"><div class="video__tag--likes">
${cls ? `<div class="video__tag--${cls}"><img src="/public/icons/${cls}.svg" width="16" height="16"> ${val}</div>` : ''}
</div><div class="video__tag video__tag--size">2 GB</div></div></div>
<div class="video__content"><h3 class="video__title margin-bottom-0">${title}</h3></div></a></div></div>`;
const searchPage = (items) => `<!doctype html><html><head><title>hledej</title></head><body>
<div class="header"><input class="video-search-phrase" type="search"></div>
<main><div id="snippet-videoListing-videoListingWrapper"><div class="video-listing">${items.join('')}</div></div></main></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  // rychlý limiter dotazů (výchozí 8/min by test natahoval na minuty)
  await ctx.addInitScript(() => { window.__PT_SCRAPE__ = { perMin: 1000, concurrency: 2, pause: 1500, zeroRecheck: 1500, blockedRetry: 2 }; });
  await ctx.addInitScript(MOD);
  const page = await ctx.newPage();
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: favHtml }));

  // hledání: letošní tituly jen s titulky (2 verze), starší film s dabingem
  const queries = [];
  const namedTitles = new Set();
  const blockedTitles = new Set(); // web hledání omezil – stránka bez výsledků
  const customResults = new Map(); // titul → seznam názvů výsledků
  const blockedHtml = '<!doctype html><html><body><main><p>Stáhněte si novou mobilní aplikaci</p></main></body></html>';
  await page.route('https://prehrajto.cz/hledej/**', (r) => {
    const q = decodeURIComponent(r.request().url().split('/hledej/')[1]);
    queries.push(q);
    if (blockedTitles.has(q)) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: blockedHtml });
    if (customResults.has(q)) {
      return r.fulfill({ contentType: 'text/html; charset=utf-8',
        body: searchPage(customResults.get(q).map((name, i) => result('/c' + i, name, '01:40:00', 'like', '2'))) });
    }
    if (q === 'Testfilm') {
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchPage([
        result('/a', 'Testfilm 2019 CZ tit 1080p', '01:30:00', 'like', '30'),
        result('/b', 'Testfilm 2019 CZ dabing 720p', '01:30:00', 'like', '2'),
        result('/c', 'Testfilm 2019 CZ dabing 1080p', '01:30:00', 'dislike', '-1'),
        result('/d', 'Testfilm (2019) CZ dabing 1080p', '01:30:00', 'like', '5'),
        result('/e', 'Testfilm 2 2022 CZ dabing 4K', '01:35:00', 'like', '50'),
        result('/f', 'Testfilm 2019 CZ Dabing 1080p CAM', '02:05:00', 'like', '40'),
      ]) });
    }
    if (q === 'Jinyfilm') {
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchPage([
        result('/x', 'Jinyfilm 2019 CZ dabing 1080p', '01:30:00', 'like', '5'),
      ]) });
    }
    const items = namedTitles.has(q)
      ? [result('/n1', q + ' CZ dabing 1080p', '01:40:00', 'like', '3')]
      : [result('/t1', q + ' ' + YEAR + ' CZ tit', '01:40:00', 'like', '3'), result('/t2', q + ' ' + YEAR + ' SK titulky', '01:40:00', '', '')];
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: searchPage(items) });
  });

  // spuštění → doporučení s bránou
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.evaluate(() => localStorage.setItem('tizenprehrajto.trending', JSON.stringify({ ids: [], t: Date.now() })));
  await page.waitForSelector('#pt-reco-pass', { timeout: 5000 });
  await page.fill('#pt-reco-pass', 'test');
  await page.click('#pt-reco-gate button');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(1500);

  const SEL = '.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-card';
  const badgesOf = (pred) => page.evaluate(({ sel, pred }) => {
    const f = new Function('m', 'return ' + pred);
    const c = Array.from(document.querySelectorAll(sel)).find((x) => f(x.__ptMovie));
    if (!c) return null;
    const b = (q) => { const e = c.querySelector(q); return e ? { text: e.textContent, bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color } : null; };
    return { title: c.__ptMovie.title, ribbon: b('.pt-reco-badge--ribbon'), news: b('.pt-reco-badge--new'), reco: b('.pt-reco-badge--reco') };
  }, { sel: SEL, pred });

  // 1. letošní film jen s titulky → žlutá páska „Bez dabingu" + Novinka
  await page.waitForFunction((sel) => Array.from(document.querySelectorAll(sel)).some((c) => c.querySelector('.pt-reco-badge--ribbon')), SEL, { timeout: 30000 });
  let b = await badgesOf(`m.year === '${YEAR}'`);
  ok('jen titulky = tmavá páska „Bez dabingu"', b.ribbon && b.ribbon.text === 'Bez dabingu' && b.ribbon.bg === 'rgb(26, 26, 26)' && b.ribbon.color === 'rgb(187, 187, 187)', JSON.stringify(b));
  ok('SK titulky / dislike se nepočítá do dabingu, Novinka zůstává', b.news && b.news.text === 'Novinka', JSON.stringify(b.news));

  // 2. starší film: bez fokusu žádný fetch, po 300 ms fokusu ano
  const old = await page.evaluate(({ sel, year }) => {
    const cs = Array.from(document.querySelectorAll('.pt-reco-row--wide .pt-reco-card'));
    const c = cs.find((x) => x.__ptMovie.year && x.__ptMovie.year !== year && x !== document.activeElement);
    return { title: c.__ptMovie.title, year: c.__ptMovie.year, id: c.__ptMovie.id, vote: c.__ptMovie.vote };
  }, { sel: SEL, year: YEAR });
  namedTitles.add(old.title);
  ok('starší film se bez fokusu nefetchuje', !queries.includes(old.title), old.title);
  const focusTitle = (t) => page.evaluate((t) => Array.from(document.querySelectorAll('.pt-reco-card')).find((x) => x.__ptMovie.title === t).focus(), t);
  await focusTitle(old.title);
  await page.waitForTimeout(150);
  ok('rychle přes kartu = žádný fetch', !queries.includes(old.title));
  await page.waitForTimeout(700);
  ok('po 300 ms fokusu fetch', queries.includes(old.title));
  const entry = await page.evaluate((k) => JSON.parse(localStorage.getItem('tizenprehrajto.avail5'))[k], old.year + '|' + old.title);
  ok('starší film s CZ dabingem: uloženo n=1 d=1', entry && entry.n === 1 && entry.d === 1, JSON.stringify(entry));
  b = await badgesOf(`m.title === ${JSON.stringify(old.title)}`);
  ok('starší film s dabingem bez badge', !b.ribbon && !b.news, JSON.stringify(b));

  // 2b. omezení od webu (stránka bez kontejneru výsledků) ≠ nedostupné
  const blocked = await page.evaluate(({ year, used }) => {
    const cache = JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}');
    const c = Array.from(document.querySelectorAll('.pt-reco-row--wide .pt-reco-card'))
      .find((x) => x.__ptMovie.year && x.__ptMovie.year !== year && x.__ptMovie.title !== used &&
        x !== document.activeElement && !cache[x.__ptMovie.year + '|' + x.__ptMovie.title]);
    return { title: c.__ptMovie.title, year: c.__ptMovie.year };
  }, { year: YEAR, used: old.title });
  blockedTitles.add(blocked.title);
  await focusTitle(blocked.title);
  await page.waitForTimeout(900);
  const bEntry = await page.evaluate((k) => JSON.parse(localStorage.getItem('tizenprehrajto.avail5'))[k], blocked.year + '|' + blocked.title);
  b = await badgesOf(`m.title === ${JSON.stringify(blocked.title)}`);
  ok('omezená odpověď webu se neuloží ani neukáže jako Nedostupné', queries.includes(blocked.title) && !bEntry && !b.ribbon, JSON.stringify({ bEntry, b }));

  // 2b2. úplně prázdné hledání (omezení webu bez 429) se neuloží hned –
  //      až druhé prázdné hledání po chvíli znamená „Nedostupné"
  const zero = await page.evaluate(({ year, used }) => {
    const cache = JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}');
    const c = Array.from(document.querySelectorAll('.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-card'))
      .find((x) => x.__ptMovie.year && x.__ptMovie.year !== year && !used.includes(x.__ptMovie.title) &&
        x !== document.activeElement && !cache[x.__ptMovie.year + '|' + x.__ptMovie.title]);
    return { title: c.__ptMovie.title, year: c.__ptMovie.year };
  }, { year: YEAR, used: [old.title, blocked.title] });
  customResults.set(zero.title, []);
  await focusTitle(zero.title);
  // limiter může být po testu omezení ještě v pauze – počkat na 1. dotaz
  for (let i = 0; i < 100 && !queries.includes(zero.title); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(150);
  const zKey = zero.year + '|' + zero.title;
  const z1 = await page.evaluate((k) => (JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}'))[k], zKey);
  b = await badgesOf(`m.title === ${JSON.stringify(zero.title)}`);
  ok('první prázdné hledání se neuloží ani neukáže', queries.filter((q) => q === zero.title).length === 1 && !z1 && !b.ribbon,
    JSON.stringify({ z1, n: queries.filter((q) => q === zero.title).length }));
  await page.waitForFunction((k) => !!(JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}'))[k], zKey, { timeout: 15000 }).catch(() => {});
  const z2 = await page.evaluate((k) => (JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}'))[k], zKey);
  b = await badgesOf(`m.title === ${JSON.stringify(zero.title)}`);
  ok('druhé prázdné hledání = Nedostupné', queries.filter((q) => q === zero.title).length === 2 && z2 && z2.n === 0 &&
    b.ribbon && b.ribbon.text === 'Nedostupné', JSON.stringify({ z2, n: queries.filter((q) => q === zero.title).length }));

  // 2c. dabing vylučovací metodou: verze bez označení jazyka (Super Mario)
  //     a dabing s rokem ±1 (Mayday) ≠ „Bez dabingu"
  const two = await page.evaluate(({ year, used }) => {
    const cache = JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}');
    return Array.from(document.querySelectorAll('.pt-reco-group:not(.pt-reco-group--hidden) .pt-reco-card'))
      .filter((x) => x.__ptMovie.year && x.__ptMovie.year !== year && !used.includes(x.__ptMovie.title) &&
        x !== document.activeElement && !cache[x.__ptMovie.year + '|' + x.__ptMovie.title])
      .slice(0, 3).map((x) => ({ title: x.__ptMovie.title, year: x.__ptMovie.year }));
  }, { year: YEAR, used: [old.title, blocked.title] });
  const [noMark, yearOff, subsOnly] = two;
  customResults.set(noMark.title, [noMark.title + ' ' + noMark.year + ' 1080p', noMark.title + ' ' + noMark.year + ' CZ tit']);
  customResults.set(yearOff.title, [yearOff.title + ' ' + (+yearOff.year - 1) + ' CZ dabing', yearOff.title + ' ' + yearOff.year + ' CZ titulky']);
  customResults.set(subsOnly.title, [subsOnly.title + ' ' + subsOnly.year + ' CZ tit', subsOnly.title + ' ' + subsOnly.year + ' SK dabing', subsOnly.title + ' ' + subsOnly.year + ' EN']);
  for (const m of two) {
    await focusTitle(m.title);
    await page.waitForFunction((k) => !!(JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}'))[k],
      m.year + '|' + m.title, { timeout: 15000 }).catch(() => {});
  }
  const ribbonOf = async (title) => { const x = await badgesOf(`m.title === ${JSON.stringify(title)}`); return x.ribbon ? x.ribbon.text : null; };
  ok('verze bez označení jazyka = může mít dabing (ne „Bez dabingu")', await ribbonOf(noMark.title) === null, noMark.title);
  ok('CZ dabing s rokem o 1 jiným se počítá', await ribbonOf(yearOff.title) === null, yearOff.title);
  ok('jen titulky / SK dabing / EN = „Bez dabingu"', await ribbonOf(subsOnly.title) === 'Bez dabingu', subsOnly.title);

  // 2d. letošní film (případ „Zapomenutý ostrov"): dabované výsledky jiného
  //     roku / bez roku / pokračování se nepočítají – relevantní je jen
  //     verze s letošním rokem, a ta má jen titulky → „Bez dabingu"
  // stálá řada „Nově ke zhlédnutí" (po znovunačtení stejné filmy); mod drží
  // cache i v paměti, proto smazat v localStorage a stránku načíst znovu
  const cur = await page.evaluate((year) => {
    const c = Array.from(document.querySelectorAll('.pt-reco-row--boxed .pt-reco-card'))
      .find((x) => x.__ptMovie.year === year && x !== document.activeElement);
    return { title: c.__ptMovie.title, orig: c.__ptMovie.orig, year: c.__ptMovie.year };
  }, YEAR);
  customResults.set(cur.title, [
    cur.title + ' 2008 CZ dabing 1080p',
    cur.title + ' CZ dabing',
    'Návrat na ' + cur.title + ' CZ dabing',
    (cur.orig || cur.title) + ' ( ' + cur.title + ' ) ' + YEAR + ' FullHD CZ tit',
    // případ „Buddy": slepené „cztit" = taky jen titulky
    cur.title + ' (' + YEAR + ') horor Sci-Fi komedie cztit.mp4',
  ]);
  await page.evaluate((k) => {
    const m = JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}');
    delete m[k];
    localStorage.setItem('tizenprehrajto.avail5', JSON.stringify(m));
  }, cur.year + '|' + cur.title);
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(400);
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await focusTitle(cur.title);
  await page.waitForFunction((k) => !!(JSON.parse(localStorage.getItem('tizenprehrajto.avail5') || '{}'))[k],
    cur.year + '|' + cur.title, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(100);
  const curEntry = await page.evaluate((k) => JSON.parse(localStorage.getItem('tizenprehrajto.avail5'))[k], cur.year + '|' + cur.title);
  ok('letošní: dabing jiného roku/bez roku/pokračování se nepočítá, „cztit" = titulky → „Bez dabingu"',
    await ribbonOf(cur.title) === 'Bez dabingu' && curEntry && curEntry.n === 2 && curEntry.d === 0, cur.title + ' ' + JSON.stringify(curEntry));

  // 3. trvalá cache: 30 dní stará položka platí, bez fokusu žádný fetch
  await page.evaluate(({ k }) => {
    const m = JSON.parse(localStorage.getItem('tizenprehrajto.avail5'));
    m[k] = { n: 0, d: 0, t: Date.now() - 30 * 864e5 };
    localStorage.setItem('tizenprehrajto.avail5', JSON.stringify(m));
  }, { k: old.year + '|' + old.title });
  const reopen = async () => {
    await page.goto('https://prehrajto.cz/oblibena-videa/');
    await page.waitForTimeout(400);
    await page.click('.pt-switch-row .pt-reco-switch');
    await page.waitForSelector('.pt-reco-row--wide .pt-reco-card', { timeout: 15000 });
    await page.waitForTimeout(1500);
  };
  queries.length = 0;
  await reopen();
  b = await badgesOf(`m.title === ${JSON.stringify(old.title)}`);
  ok('stará položka (30 dní) se ukáže z cache', b && b.ribbon && b.ribbon.text === 'Nedostupné' && b.ribbon.bg === 'rgb(190, 30, 30)', JSON.stringify(b));
  ok('…a bez fokusu se nefetchuje', !queries.includes(old.title));
  const dim = await page.evaluate((title) => {
    const c = Array.from(document.querySelectorAll('.pt-reco-card')).find((x) => x.__ptMovie.title === title);
    const st = () => ({
      card: getComputedStyle(c).opacity, bg: getComputedStyle(c.querySelector('.pt-reco-poster')).backgroundColor,
      cardBg: getComputedStyle(c).backgroundColor,
      img: getComputedStyle(c.querySelector('.pt-reco-poster img')).opacity,
      ribbon: getComputedStyle(c.querySelector('.pt-reco-badge--ribbon')).opacity,
      title: getComputedStyle(c.querySelector('.pt-reco-title')).opacity,
    });
    const before = st();
    c.focus();
    return { before, focus: st() };
  }, old.title);
  ok('nedostupný: tmavý podklad jen pod obrázkem, ztlumený obrázek (0.5), text a badge naplno', dim.before.img === '0.5' && dim.before.card === '1' &&
    dim.before.ribbon === '1' && dim.before.title === '1' && dim.before.bg === 'rgb(26, 26, 26)' &&
    dim.before.cardBg === 'rgba(0, 0, 0, 0)', JSON.stringify(dim.before));
  ok('při fokusu i obrázek naplno', dim.focus.img === '1', JSON.stringify(dim.focus));
  const pad = await page.evaluate(() => {
    const c = document.querySelector('.pt-reco-card');
    const a = getComputedStyle(c.querySelector('.pt-reco-title'));
    const b = getComputedStyle(c.querySelector('.pt-reco-year'));
    return [a.paddingLeft, a.paddingRight, b.paddingLeft, b.paddingRight].join(' ');
  });
  ok('název a rok pod posterem s 2px paddingem vlevo/vpravo', pad === '2px 2px 2px 2px', pad);

  // 4. „Doporučené": trend týdne + hodnocení ≥ 7 + CZ dabing
  const hot = await page.evaluate(({ year }) => {
    const c = Array.from(document.querySelectorAll('.pt-reco-row--wide .pt-reco-card'))
      .find((x) => x.__ptMovie.vote >= 7 && x.__ptMovie.year !== year);
    return c ? { title: c.__ptMovie.title, year: c.__ptMovie.year, id: c.__ptMovie.id } : null;
  }, { year: YEAR });
  if (hot) {
    await page.evaluate(({ hot }) => {
      localStorage.setItem('tizenprehrajto.trending', JSON.stringify({ ids: [hot.id], t: Date.now() }));
      const m = JSON.parse(localStorage.getItem('tizenprehrajto.avail5'));
      m[hot.year + '|' + hot.title] = { n: 4, d: 2, t: Date.now() };
      localStorage.setItem('tizenprehrajto.avail5', JSON.stringify(m));
    }, { hot });
    await reopen();
    b = await badgesOf(`m.id === ${hot.id}`);
    ok('trend + hodnocení + dabing = žlutý štítek „Doporučené"', b.reco && b.reco.text === 'Doporučené' && b.reco.bg === 'rgb(255, 180, 0)' && !b.ribbon, JSON.stringify(b));
    const other = await badgesOf(`m.id !== ${hot.id} && m.year !== '${YEAR}'`);
    ok('ostatní bez „Doporučené"', !other.reco);
  } else {
    ok('„Doporučené" – v Populárních není film s hodnocením ≥ 7', false);
  }

  // 5. hledání z posteru: nejlepší verze jako první zvýrazněná karta
  await page.evaluate(() => sessionStorage.setItem('pt-search-ctx', JSON.stringify({ title: 'Testfilm', orig: '', year: '2019', t: Date.now() })));
  await page.goto('https://prehrajto.cz/hledej/Testfilm');
  await page.waitForTimeout(1200);
  const best = await page.evaluate(() => {
    const ws = document.querySelectorAll('.video-listing > .video-wrapper');
    const first = ws[0];
    const a = first.querySelector('a.video--link');
    const focusedShadow = getComputedStyle(a).boxShadow;
    a.blur();
    const cs = getComputedStyle(a);
    return {
      n: ws.length, best: first.classList.contains('pt-best'), href: a.getAttribute('href'),
      label: !!first.querySelector('.pt-best-label'),
      focused: focusedShadow.indexOf('rgb(255, 180, 0)') !== -1,
      shadow: cs.boxShadow, outline: cs.outlineStyle, radius: cs.borderRadius, bg: cs.backgroundColor,
      favs: first.querySelectorAll('.video-favorite').length,
      inside: (() => {
        const o = first.getBoundingClientRect();
        const i = first.querySelector('.video__picture--container').getBoundingClientRect();
        return i.left >= o.left && i.right <= o.right && i.top >= o.top && i.bottom <= o.bottom;
      })(),
    };
  });
  ok('první karta = nejlepší verze (CZ dabing, správný rok, bez dislike, ne CAM)', best.best && best.href === '/d' && best.n === 7, JSON.stringify(best));
  ok('karta nepřetéká obal', best.inside);
  ok('bez štítku, červený rámeček (box-shadow) se zaoblením, tmavé pozadí', !best.label && /rgb\(190, 30, 30\) 0px 0px 0px 6px/.test(best.shadow) &&
    best.outline === 'none' && best.radius === '8px' && best.bg === 'rgb(26, 26, 26)', JSON.stringify(best));
  ok('fokus rovnou na nejlepší verzi, rámeček žlutý', best.focused);

  // typografie karet + lajky/dislajky vpravo nahoře
  const typo = await page.evaluate(() => {
    const t = getComputedStyle(document.querySelector('.video-wrapper:not(.pt-best) .video__title'));
    const pos = (sel) => {
      const el = document.querySelector(sel);
      const box = el.closest('.video__tag--likes').getBoundingClientRect();
      const pic = el.closest('.video__header').getBoundingClientRect();
      const cs = getComputedStyle(el);
      const before = getComputedStyle(el, ':before');
      return { color: cs.color, fs: cs.fontSize, dr: Math.round(pic.right - box.right), dt: Math.round(box.top - pic.top),
        icon: getComputedStyle(el.querySelector('img')).display, thumb: /svg/.test(before.backgroundImage) && before.width === '13px' };
    };
    return { color: t.color, fs: t.fontSize, fw: t.fontWeight, like: pos('.video__tag--like'), dislike: pos('.video__tag--dislike') };
  });
  ok('nadpis videa bílý, 14px (jako rok u posteru), normální řez', typo.color === 'rgb(255, 255, 255)' && typo.fs === '14px' && typo.fw === '400', JSON.stringify(typo));
  ok('lajk: žlutý, malý, vpravo nahoře, vlastní ikonka palce', typo.like.color === 'rgb(255, 180, 0)' && typo.like.fs === '14px' &&
    typo.like.dr === 6 && typo.like.dt === 6 && typo.like.icon === 'none' && typo.like.thumb, JSON.stringify(typo.like));
  ok('dislike: červený, vpravo nahoře, palec dolů', typo.dislike.color === 'rgb(216, 35, 42)' && typo.dislike.dr === 6 && typo.dislike.thumb, JSON.stringify(typo.dislike));
  // hledání omezené webem: hláška místo prázdné stránky + nový pokus
  blockedTitles.add('Blokovano');
  await page.goto('https://prehrajto.cz/hledej/Blokovano');
  await page.waitForTimeout(1800);
  const notice = await page.evaluate(() => {
    const el = document.getElementById('pt-blocked');
    return el ? { text: el.textContent, vis: el.getBoundingClientRect().height > 0 } : null;
  });
  ok('omezené hledání: hláška „Příliš mnoho požadavků" s odpočtem', notice && notice.vis &&
    /Příliš mnoho požadavků/.test(notice.text) && /znovu za \d+ s/.test(notice.text), JSON.stringify(notice));
  blockedTitles.delete('Blokovano'); // web se mezitím uvolní
  await page.waitForTimeout(3500);
  const retried = await page.evaluate(() => ({
    notice: !!document.getElementById('pt-blocked'),
    results: document.querySelectorAll('.video-listing .video-wrapper').length,
    counter: sessionStorage.getItem('pt-search-retries'),
  }));
  ok('po odpočtu nový pokus – výsledky, hláška pryč', !retried.notice && retried.results > 0 && !retried.counter, JSON.stringify(retried));

  await page.goto('https://prehrajto.cz/hledej/Jinyfilm');
  await page.waitForTimeout(1000);
  ok('ruční hledání (bez kontextu) beze změny', await page.evaluate(() => !document.querySelector('.pt-best')));

  // 6. historie: přehrané video se ukáže na oblíbených v šedém bloku
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await page.route('https://thumb.prehrajto.cz/a/b/abc123/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route('https://prehrajto.cz/test-video/abc123', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body:
    `<!doctype html><html><head><meta property="og:image" content="https://thumb.prehrajto.cz/a/b/abc123/index/1.jpg"></head><body>
    <h1 class="h2 title"><span class="hide-for-large">Testovací video 2019 CZ</span><span class="show-for-large">Testovací video 2019 CZ</span></h1>
    <div id="video-wrap"><div id="content_video"><video id="content_video_html5_api"></video></div></div></body></html>` }));
  await page.goto('https://prehrajto.cz/test-video/abc123');
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('video').dispatchEvent(new Event('play')));
  await page.waitForTimeout(200);
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(1500);
  const hist = await page.evaluate(() => {
    const box = document.getElementById('pt-history');
    if (!box) return null;
    const c = box.querySelector('a.pt-hist-card');
    const grid = document.querySelector('.pt-fav-grid');
    return {
      cards: box.querySelectorAll('a.pt-hist-card').length, href: c.getAttribute('href'),
      title: c.querySelector('.pt-hist-title').textContent, thumb: (c.querySelector('img') || {}).src,
      bg: getComputedStyle(box).backgroundColor, fs: getComputedStyle(c.querySelector('.pt-hist-title')).fontSize, above: box.getBoundingClientRect().bottom <= grid.getBoundingClientRect().top + 1,
      focused: document.activeElement === c,
      focusShadow: getComputedStyle(c).boxShadow, focusOutline: getComputedStyle(c).outlineStyle, focusBg: getComputedStyle(c).backgroundColor,
      gap: Math.round(box.getBoundingClientRect().top - document.querySelector('.pt-switch-row').getBoundingClientRect().bottom),
    };
  });
  ok('historie na oblíbených (název 14px)', hist && hist.fs === '14px' && hist.cards === 1 && hist.href === '/test-video/abc123' && hist.title === 'Testovací video 2019 CZ', JSON.stringify(hist));
  ok('tmavě šedý blok nad videi, s náhledem', hist && hist.bg === 'rgb(34, 34, 34)' && hist.above && /abc123/.test(hist.thumb), JSON.stringify(hist));
  ok('fokus na první položce historie (žlutý box-shadow, tmavé pozadí)', hist && hist.focused && /rgb\(255, 180, 0\) 0px 0px 0px 6px/.test(hist.focusShadow) &&
    hist.focusOutline === 'none' && hist.focusBg === 'rgb(26, 26, 26)', JSON.stringify(hist));

  // nenačtený náhled (smazané video) → bez rozbité ikony, jen zástupná plocha
  await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('tizenprehrajto.history'));
    h.unshift({ href: '/smazane/xyz', title: 'Smazané video', thumb: 'https://thumb.prehrajto.cz/neexistuje/xyz.jpg', t: Date.now() });
    localStorage.setItem('tizenprehrajto.history', JSON.stringify(h));
  });
  await page.route('https://thumb.prehrajto.cz/neexistuje/**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(1500);
  const broken = await page.evaluate(() => {
    const c = document.querySelector('#pt-history a.pt-hist-card');
    return { img: !!c.querySelector('img'), h: Math.round(c.querySelector('.pt-hist-thumb').getBoundingClientRect().height) };
  });
  ok('nenačtený náhled: bez obrázku, zástupná plocha drží výšku', !broken.img && broken.h > 80, JSON.stringify(broken));

  // 20 videí: poloviční karty, řádek se posouvá šipkami
  await page.evaluate(() => {
    const h = [];
    for (let i = 0; i < 25; i++) h.push({ href: '/v-hist/' + i, title: 'Video historie ' + i, thumb: '', t: Date.now() - i });
    localStorage.setItem('tizenprehrajto.history', JSON.stringify(h));
  });
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(1500);
  const row = await page.evaluate(() => {
    const cs = document.querySelectorAll('#pt-history a.pt-hist-card');
    const r = document.querySelector('.pt-history-row').getBoundingClientRect();
    const visible = Array.from(cs).filter((c) => { const b = c.getBoundingClientRect(); return b.right <= r.right && b.left >= r.left; }).length;
    return { n: cs.length, thumbH: Math.round(cs[0].querySelector('.pt-hist-thumb').getBoundingClientRect().height), visible };
  });
  ok('historie: max. 20 videí, náhled na 2/3 (~133 px), víc vedle sebe', row.n === 20 && row.thumbH >= 128 && row.thumbH <= 138 && row.visible >= 7, JSON.stringify(row));
  for (let i = 0; i < 14; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120); }
  await page.waitForTimeout(500);
  const scrolled = await page.evaluate(() => {
    const el = document.activeElement;
    const strip = document.querySelector('.pt-history-row');
    const r = strip.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return { cls: el.className, href: el.getAttribute('href'), sl: strip.scrollLeft, inView: b.left >= r.left && b.right <= r.right };
  });
  ok('šipkou doprava se řádek historie posouvá, fokus vidět', /pt-hist-card/.test(scrolled.cls) && scrolled.href === '/v-hist/14' &&
    scrolled.sl > 0 && scrolled.inView, JSON.stringify(scrolled));
  ok('mezera pod přepínači (ne nalepené)', hist && hist.gap >= 16, 'gap=' + (hist && hist.gap));
  await page.click('.pt-switch-row .pt-reco-switch');
  await page.waitForTimeout(400);
  ok('v doporučeních historie schovaná', await page.evaluate(() => getComputedStyle(document.getElementById('pt-history')).display === 'none'));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
