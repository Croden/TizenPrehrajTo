// LG webOS build: zavaděč (přibalený mod / novější z CDN), kódy kláves
// ovladače LG (Zpět 461, Channel 33/34), ukončení aplikace.
// Spouštět z kořene repa po `npm run build:webos`: node tests/test_webos.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { ok, CHROME, ROOT } = require('./helper');

const LOADER = fs.readFileSync(path.join(ROOT, 'build/webos/webOSUserScripts/userScript.js'), 'utf8');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const CDN = 'https://cdn.jsdelivr.net/gh/Croden/TizenPrehrajTo@main/';

const favHtml = `<!doctype html><html><head><title>x</title></head><body>
<div class="content"><div class="header"><input class="video-search-phrase" type="search"></div>
<main><div class="grid-x"><div class="cell video-wrapper"><div class="video__picture--container">
<a class="video video--small video--link" href="/v1" title="Video 1"><h3 class="video__title">Video 1</h3></a></div></div></div></main>
</div></body></html>`;
const videoHtml = `<!doctype html><html><head><title>video</title></head><body>
<div id="video-wrap"><div id="content_video"><video id="content_video_html5_api"></video></div></div>
<script>var sources = { tracks: [{ src: "https://cdn.example.test/a.vtt", label: "CZE", kind: "captions" }] };</script>
</body></html>`;

const press = (page, code) => page.evaluate((c) => {
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'keyCode', { get: () => c });
  window.dispatchEvent(ev);
}, code);

async function newCtx(browser, webos, cdn) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  if (webos) await ctx.addInitScript(() => { window.PalmSystem = {}; });
  await ctx.addInitScript(LOADER);
  await ctx.route('https://prehrajto.cz/oblibena-videa/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: favHtml }));
  await ctx.route('https://prehrajto.cz/film/abc', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: videoHtml }));
  await ctx.route('https://cdn.example.test/a.vtt', (r) => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'text/vtt',
    body: 'WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nAhoj\n' }));
  await ctx.route(CDN + '**', (r) => {
    const u = r.request().url();
    const c = cdn || { version: VERSION, code: '' };
    if (u.endsWith('package.json')) return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ version: c.version }) });
    return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/javascript', body: c.code });
  });
  return ctx;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  // 1. webOS: přibalený mod běží, klávesy LG
  let ctx = await newCtx(browser, true);
  let page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(1200);
  ok('zavaděč spustí přibalený mod', await page.evaluate(() => document.body.classList.contains('pt-favorites') && !!window.__TIZENPREHRAJTO__));
  ok('start aplikace = doporučení (brána hesla)', await page.evaluate(() => document.body.classList.contains('pt-reco')));
  await press(page, 461); // Zpět v poli hesla = jen zavřít klávesnici
  await press(page, 461); // Zpět v doporučení = na oblíbená
  await page.waitForTimeout(300);
  ok('Zpět (461) zavře doporučení', !(await page.evaluate(() => document.body.classList.contains('pt-reco'))));
  await page.evaluate(() => { window.close = () => { window.__closed = true; }; });
  await press(page, 461);
  ok('Zpět (461) na oblíbených ukončí aplikaci (window.close)', await page.evaluate(() => window.__closed === true));

  await page.goto('https://prehrajto.cz/film/abc');
  await page.waitForTimeout(1000);
  await press(page, 34);
  await page.waitForTimeout(200);
  const osd1 = await page.evaluate(() => (document.getElementById('pt-osd') || {}).textContent || '');
  ok('Channel ▼ (34) přepíná titulky', /^Titulky/.test(osd1), osd1);
  await press(page, 33);
  await page.waitForTimeout(200);
  const osd2 = await page.evaluate(() => (document.getElementById('pt-osd') || {}).textContent || '');
  ok('Channel ▲ (33) přepíná zvukovou stopu', /zvukov/i.test(osd2), osd2);
  ok('bez chyb JS', errors.length === 0, errors.join(' | '));
  await ctx.close();

  // 2. mimo webOS (PC/Tizen) jsou 33/34 PageUp/PageDown – nic nepřepínají
  ctx = await newCtx(browser, false);
  page = await ctx.newPage();
  await page.goto('https://prehrajto.cz/film/abc');
  await page.waitForTimeout(1000);
  await press(page, 34);
  await page.waitForTimeout(200);
  ok('mimo webOS PageDown nepřepíná titulky', !(await page.evaluate(() => !!document.getElementById('pt-osd'))));
  await ctx.close();

  // 3. novější verze na CDN: uloží se na pozadí, příště běží ona
  const cdnCode = 'window.__ptCdnMod = (window.__ptCdnMod || 0) + 1;';
  ctx = await newCtx(browser, true, { version: '99.0.0', code: cdnCode });
  page = await ctx.newPage();
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.waitForTimeout(4500);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tizenprehrajto.webosMod') || 'null'));
  ok('novější verze z CDN uložena', stored && stored.v === '99.0.0' && stored.code.indexOf('__ptCdnMod') !== -1, JSON.stringify(stored && stored.v));
  ok('první spuštění ještě s přibalenou verzí', await page.evaluate(() => !window.__ptCdnMod && !!window.__TIZENPREHRAJTO__));
  const p2 = await ctx.newPage();
  await p2.goto('https://prehrajto.cz/oblibena-videa/');
  await p2.waitForTimeout(800);
  ok('další spuštění běží verze z CDN', await p2.evaluate(() => window.__ptCdnMod === 1 && !window.__TIZENPREHRAJTO__));
  await ctx.close();

  // 4. rozbitý soubor na CDN se neuloží; starší uložená verze se ignoruje
  ctx = await newCtx(browser, true, { version: '99.0.1', code: 'function ( {' });
  page = await ctx.newPage();
  await page.goto('https://prehrajto.cz/oblibena-videa/');
  await page.evaluate(() => localStorage.setItem('tizenprehrajto.webosMod', JSON.stringify({ v: '0.0.1', code: 'window.__old = 1;' })));
  await page.waitForTimeout(4500);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('tizenprehrajto.webosMod')).v);
  ok('rozbitá verze z CDN se neuloží', kept === '0.0.1', kept);
  const p3 = await ctx.newPage();
  await p3.goto('https://prehrajto.cz/oblibena-videa/');
  await p3.waitForTimeout(800);
  ok('starší uložená verze se ignoruje (běží přibalená)', await p3.evaluate(() => !window.__old && !!window.__TIZENPREHRAJTO__));
  await ctx.close();

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
