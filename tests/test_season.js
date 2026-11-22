// Tematická (sezónní) řada doporučení: Vánoce 15. 11. – 31. 12. místo
// „Rodinné", zelený blok s malůvkami (za postery), v řadě trvale sněží.
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
  return { title: r.querySelector('.pt-reco-row-title').textContent, cls: r.className,
    bg: getComputedStyle(r).backgroundColor, decor: !!r.querySelector('.pt-reco-decor svg'),
    cards: r.querySelectorAll('.pt-reco-card').length, rows: document.querySelectorAll('.pt-reco-row').length };
});
const snow = (page) => page.evaluate(() => {
  const s = document.querySelector('.pt-snow');
  return { el: !!s, inRow: !!(s && s.parentNode.classList.contains('pt-reco-row--xmas')),
    flakes: s ? s.children.length : 0, opacity: s ? +getComputedStyle(s).opacity : -1,
    css: !!document.getElementById('pt-snow-css'), count: document.querySelectorAll('.pt-snow').length };
});

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  // ----- v sezóně (1. 12.) -----
  let { ctx, page } = await openReco(browser, new Date(2026, 11, 1, 12).getTime());
  let r = await firstRow(page);
  ok('v sezóně: 1. řada je Vánoční (místo Rodinné)', r.title === 'Vánoční' && r.rows === 16, JSON.stringify(r));
  ok('zelený blok', /pt-reco-row--xmas/.test(r.cls) && r.bg === 'rgba(30, 158, 70, 0.5)', r.cls + ' ' + r.bg);
  ok('červený blok zůstal jen jeden', await page.evaluate(() => document.querySelectorAll('.pt-reco-row--boxed:not(.pt-reco-row--yellow)').length) === 1);
  ok('malůvky (svg) v řadě', r.decor);
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
  if (SHOT) await page.screenshot({ path: path.join(SHOT, 'season-xmas.png') });

  // kopec/malůvky jsou za postery: na místě, kde se kryjí, je nahoře karta
  const behind = await page.evaluate(() => {
    const d = document.querySelector('.pt-reco-decor').getBoundingClientRect();
    const c = document.querySelectorAll('.pt-reco-row--xmas .pt-reco-card')[2].getBoundingClientRect();
    const hit = document.elementFromPoint(c.left + 20, c.top + 2);
    return { overlap: d.bottom > c.top + 2 && d.left < c.left && d.right > c.left + 20,
      card: !!(hit && hit.closest('.pt-reco-card')) };
  });
  ok('malůvky jsou za postery', behind.overlap && behind.card, JSON.stringify(behind));
  ok('bez nehybných vloček v malůvkách', await page.evaluate(() => !document.querySelector('.pt-reco-decor circle[r="1.5"], .pt-reco-decor circle[r="1.2"]')));

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
    ok(label, on ? (r.title === 'Vánoční' && s.el) : (r.title === 'Rodinné' && !/theme/.test(r.cls) && !r.decor && !s.el && r.rows === 16),
      JSON.stringify(r));
    await ctx.close();
  }

  await browser.close();
})();
