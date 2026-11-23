// Tematická (sezónní) řada doporučení: Vánoce 15. 11. – 31. 12. místo
// „Rodinné": červený pás přes celou šířku se scénou (kopce, stromečky,
// animovaný sáňkař) pod postery, trvale sněží; novinky jsou v sezóně šedé.
// Datum se podstrkuje přes window.__PT_NOW__.
// Spouštět z kořene repa: node tests/test_season.js   (SHOT=<adresář> uloží screenshoty)
const path = require('path');
const { chromium } = require('playwright');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();
const SHOT = process.env.SHOT;

const pageHtml = `<!doctype html><html><head><title>x</title></head><body>
<div class="page"><div class="page-box"><div class="content">
<div class="header"><div class="top-bar"><div class="top-bar-right">
  <div class="form__group--search"><input class="video-search-phrase" type="search"></div>
</div></div></div>
<main style="padding-top:3rem"><div class="grid-container"><div class="grid-x">
  <div class="cell medium-3 sidebar"><ul>
    <li><a href="/oblibena-videa/">Oblíbená videa</a></li>
    <li><a href="/profil/prave-sledovana-videa">Právě sledované uživateli</a></li>
  </ul></div>
  <div class="cell medium-9"><div class="section section--medium" style="padding-top:2.5rem">
    <div class="grid-x">${[1, 2, 3, 4].map((i) => `
<div class="cell video-wrapper"><div class="video__picture--container">
  <a class="video video--small video--link" href="/v${i}" title="Video ${i}"><h3 class="video__title">Video ${i}</h3></a>
</div></div>`).join('')}</div>
  </div></div>
</div></div></main>
</div></div></div></body></html>`;

async function openReco(browser, now) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript((t) => { window.__PT_NOW__ = t; }, now);
  await ctx.addInitScript(() => { window.__PT_SCRAPE__ = { perMin: 1000, concurrency: 2, pause: 1500 }; });
  await ctx.addInitScript(MOD);
  const page = await ctx.newPage();
  await page.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml }));
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(500);
  await page.locator('.pt-switch-row .pt-reco-switch').click();
  await page.waitForTimeout(300);
  await page.fill('#pt-reco-pass', 'test');
  await page.click('#pt-reco-gate button');
  await page.waitForSelector('.pt-reco-card', { timeout: 15000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}

const firstRow = (page) => page.evaluate(() => {
  const r = document.querySelector('.pt-reco-row');
  const bleed = r.querySelector('.pt-reco-bleed');
  return { title: r.querySelector('.pt-reco-row-title').textContent, cls: r.className,
    bg: bleed ? getComputedStyle(bleed).backgroundColor : null, decor: !!r.querySelector('.pt-reco-decor svg'),
    cards: r.querySelectorAll('.pt-reco-card').length, rows: document.querySelectorAll('.pt-reco-row').length,
    news: Array.from(document.querySelectorAll('.pt-reco-row--boxed')).map((b) =>
      b.querySelector('.pt-reco-row-title').textContent + ':' + getComputedStyle(b).backgroundColor)[0] };
});
const snow = (page) => page.evaluate(() => {
  const s = document.querySelector('.pt-snow');
  return { el: !!s, inRow: !!(s && s.parentNode.classList.contains('pt-reco-row--xmas')),
    flakes: s ? s.children.length : 0, opacity: s ? +getComputedStyle(s).opacity : -1,
    css: !!document.getElementById('pt-theme-css'), count: document.querySelectorAll('.pt-snow').length };
});

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  // ----- v sezóně (1. 12.) -----
  let { ctx, page } = await openReco(browser, new Date(2026, 11, 1, 12).getTime());
  let r = await firstRow(page);
  ok('v sezóně: 1. řada je Vánoční (místo Rodinné)', r.title === 'Vánoční' && r.rows === 16, JSON.stringify(r));
  ok('červený pás', /pt-reco-row--xmas/.test(r.cls) && r.bg === 'rgba(190, 30, 30, 0.5)', r.cls + ' ' + r.bg);
  ok('novinky jsou v sezóně šedé', r.news === 'Nově ke zhlédnutí:rgba(34, 34, 34, 0.72)', r.news);
  const band = await page.evaluate(() => {
    const row = document.querySelector('.pt-reco-row--xmas');
    const b = row.querySelector('.pt-reco-bleed').getBoundingClientRect();
    const sn = row.querySelector('.pt-snow').getBoundingClientRect();
    const d = row.querySelector('.pt-reco-decor').getBoundingClientRect();
    const hill = row.querySelector('.pt-reco-decor > svg').getBoundingClientRect();
    const cards = row.querySelectorAll('.pt-reco-card');
    const cb = cards[0].getBoundingClientRect().bottom;
    const cs = getComputedStyle(row.querySelector('.pt-reco-bleed'));
    return { left: b.left, right: Math.round(b.right), rowRight: Math.round(row.getBoundingClientRect().right), snowLeft: sn.left,
      radius: cs.borderTopLeftRadius, rowRadius: getComputedStyle(row).borderTopLeftRadius,
      decorTop: Math.round(d.top), cardBottom: Math.round(cb), decorBottom: Math.round(d.bottom), rowBottom: Math.round(b.bottom),
      hillW: Math.round(hill.width), bleedW: Math.round(b.width),
      trees: row.querySelectorAll('.pt-xmas-sprite').length };
  });
  ok('pás sahá k levému kraji stránky, bez zaoblení', band.left === 0 && band.snowLeft === 0 && band.right === band.rowRight &&
    band.radius === '0px' && band.rowRadius === '0px', JSON.stringify(band));
  ok('scéna je dole pod postery (nepřekrývá karty)', band.decorTop >= band.cardBottom - 8 && band.decorBottom === band.rowBottom, JSON.stringify(band));
  ok('kopce přes celou šířku pásu', band.hillW === band.bleedW && band.trees >= 8, JSON.stringify(band));
  ok('vánoční filmy načtené z TMDB', r.cards > 5, 'cards=' + r.cards);
  ok('fokus na 1. kartě vánoční řady', await page.evaluate(() => !!document.activeElement.closest('.pt-reco-row--xmas')));

  await page.waitForTimeout(800);
  let s = await snow(page);
  ok('sníh padá ve vánoční řadě', s.el && s.inRow && s.flakes === 40 && s.css && s.opacity === 1, JSON.stringify(s));
  const moving = await page.evaluate(() => new Promise((res) => {
    const f = document.querySelector('.pt-snow i');
    const a = f.getBoundingClientRect().top;
    setTimeout(() => res(f.getBoundingClientRect().top !== a), 400);
  }));
  ok('vločky se hýbou', moving);

  // sáňkař: jede po terénu, střídá pózu jízda/chůze, pořád dokola
  const sled = (t) => page.evaluate((t) => {
    document.getAnimations().forEach((a) => { if (/pt-xmas-(pos|tilt|ride|walk)$/.test(a.animationName)) { a.pause(); a.currentTime = t * 1000; } });
    const m = new DOMMatrix(getComputedStyle(document.querySelector('.pt-xmas-sled')).transform);
    return { x: Math.round(m.m41), y: Math.round(m.m42),
      ride: +getComputedStyle(document.querySelector('.pt-xmas-ride')).opacity,
      walk: +getComputedStyle(document.querySelector('.pt-xmas-walk')).opacity };
  }, t);
  const s0 = await sled(0), s1 = await sled(3.5), s2 = await sled(10), s3 = await sled(16.5);
  ok('sáňkař sjede z kopce (doprava a dolů) a sedí na saních', s1.x > s0.x + 300 && s1.y > s0.y + 20 && s0.ride === 1 && s1.ride === 1 && s1.walk === 0,
    JSON.stringify([s0, s1]));
  ok('pak jde se saněmi zpátky nahoru', s2.x < s1.x && s2.x > s0.x && s2.walk === 1 && s2.ride === 0, JSON.stringify(s2));
  ok('nahoře si sedne a čeká na další jízdu', s3.x === s0.x && s3.y === s0.y && s3.ride === 1 && s3.walk === 0, JSON.stringify(s3));
  await page.evaluate(() => document.getAnimations().forEach((a) => { if (/pt-xmas/.test(a.animationName)) a.play(); }));
  const anim = await page.evaluate(() => {
    const sprites = Array.from(document.querySelectorAll('.pt-xmas-sprite'));
    const isStar = (p) => p.getAttribute('fill') === '#ffb400' && /^M30 -6/.test(p.getAttribute('d'));
    const trees = sprites.filter((e) => e.querySelector('path[fill="#1f9a4d"]'));
    const snowman = sprites.filter((e) => e.querySelector('path[fill="#ff8a1f"]'))[0];
    return { sled: getComputedStyle(document.querySelector('.pt-xmas-sled')).animationIterationCount,
      trees: trees.length, sway: trees.filter((e) => getComputedStyle(e).animationName === 'pt-xmas-sway').length,
      stars: trees.filter((e) => Array.from(e.querySelectorAll('path')).some(isStar)).length,
      balls: trees.filter((e) => e.querySelector('circle')).length,
      faces: trees.filter((e) => e.querySelector('[fill="#0d3b1e"], [stroke="#0d3b1e"]')).length,
      outlined: trees.filter((e) => e.querySelector('path[stroke="#fff"]') && e.querySelector('path[stroke="#222"]')).length,
      snowman: snowman ? getComputedStyle(snowman).animationName : null,
      snowmanInk: !!(snowman && snowman.querySelector('path[stroke="#fff"]') && snowman.querySelector('path[stroke="#222"]')) };
  });
  ok('animace sáňkaře běží dokola', anim.sled === 'infinite');
  ok('všechny stromečky se pohupují, sněhulák stojí', anim.trees >= 8 && anim.sway === anim.trees && anim.snowman === 'none', JSON.stringify(anim));
  ok('hvězdu a ozdoby má jen jeden stromeček, žádný nemá obličej', anim.stars === 1 && anim.balls === 1 && anim.faces === 0, JSON.stringify(anim));
  ok('stromečky i sněhulák: tmavá linka s bílým obrysem', anim.outlined === anim.trees && anim.snowmanInk, JSON.stringify(anim));
  if (SHOT) await page.screenshot({ path: path.join(SHOT, 'season-xmas.png') });

  // sníh běží trvale – i když fokus z řady odejde (dolů, na přepínače)
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1200);
  s = await snow(page);
  ok('fokus v jiné řadě: sníh dál padá', s.count === 1 && s.opacity === 1 && s.flakes === 40, JSON.stringify(s));
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(1200);
  s = await snow(page);
  ok('fokus na přepínačích: sníh dál padá, jen jeden', s.count === 1 && s.opacity === 1 && s.css, JSON.stringify(s));
  await ctx.close();

  // ----- hranice období -----
  for (const [label, date, on] of [
    ['14. 11. ještě Rodinné', new Date(2026, 10, 14, 23), false],
    ['15. 11. už Vánoční', new Date(2026, 10, 15, 0, 5), true],
    ['31. 12. ještě Vánoční', new Date(2026, 11, 31, 23), true],
    ['1. 1. zase Rodinné', new Date(2027, 0, 1, 0, 5), false],
  ]) {
    ({ ctx, page } = await openReco(browser, date.getTime()));
    r = await firstRow(page);
    await page.waitForTimeout(500);
    s = await snow(page);
    ok(label, on ? (r.title === 'Vánoční' && s.el) : (r.title === 'Rodinné' && !/theme/.test(r.cls) && !r.decor && !s.el && r.rows === 16 &&
      r.news === 'Nově ke zhlédnutí:rgba(190, 30, 30, 0.5)'),
      JSON.stringify(r));
    await ctx.close();
  }

  await browser.close();
})();
