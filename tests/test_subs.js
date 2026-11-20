// Vlastní titulky na stránce videa (TV nevykreslí stopy webu): stažení
// VTT/SRT, vykreslení podle času videa, přepínání ChannelDown, bezpečné
// značky, windows-1250. Spouštět z kořene repa: node tests/test_subs.js
const { chromium } = require('playwright');
const { loadMod, ok, CHROME } = require('./helper');
const MOD = loadMod();

const VTT = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
Ahoj <i>světe</i> &amp; spol.

2
00:00:03.500 --> 00:00:04.500 align:start
<c.yellow>Druhý</c> <v Bob>řádek</v>
<b>tučně</b>

00:00:06.000 --> 00:00:07.000
<img src=x onerror="window.__xss=1">Bez <script>window.__xss=2</script>HTML
`;
// SRT ve windows-1250 (české znaky jako jednobajtové)
const SRT_TEXT = '1\r\n00:00:01,000 --> 00:00:03,000\r\nPříliš žluťoučký kůň\r\n\r\n';
const CP1250 = { 'ř': 0xF8, 'í': 0xED, 'š': 0x9A, 'ž': 0x9E, 'ť': 0x9D, 'ů': 0xF9, 'ň': 0xF2, 'ý': 0xFD, 'č': 0xE8, 'ú': 0xFA };
const SRT = Buffer.from(Array.from(SRT_TEXT).map((ch) => CP1250[ch] || ch.charCodeAt(0)));

const videoHtml = `<!doctype html><html><head><title>video</title></head><body>
<h1 class="h2 title"><span>Testfilm CZ tit</span></h1>
<div id="video-wrap"><div id="content_video"><video id="content_video_html5_api"></video></div></div>
<script>
  var sources = { videos: [], tracks: [
    { src: "https://cdn.example.test/a.vtt?token=1", srclang: "cze", label: "CZE", kind: "captions", default: true },
    { src: "https://cdn.example.test/b.srt", srclang: "eng", label: "ENG", kind: "captions" }
  ] };
</script></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(MOD);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cors = { 'access-control-allow-origin': '*' };
  await page.route('https://cdn.example.test/a.vtt**', (r) => r.fulfill({ headers: cors, contentType: 'text/vtt; charset=utf-8', body: VTT }));
  await page.route('https://cdn.example.test/b.srt', (r) => r.fulfill({ headers: cors, contentType: 'application/octet-stream', body: SRT }));
  await page.route('https://prehrajto.cz/testfilm/abc', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: videoHtml }));
  await page.goto('https://prehrajto.cz/testfilm/abc');
  await page.waitForTimeout(800);

  // čas videa řídí test (video bez zdroje se samo nepřehraje)
  await page.evaluate(() => {
    const v = document.querySelector('video');
    window.__t = 0;
    Object.defineProperty(v, 'currentTime', { get: () => window.__t, set: (x) => { window.__t = x; }, configurable: true });
    // stopa přehrávače zapnutá – mod ji musí vypnout (jinak by na PC byly titulky 2×)
    const nat = v.addTextTrack('subtitles', 'web', 'cs');
    nat.mode = 'showing';
    window.__nat = nat;
  });
  const at = (t) => page.evaluate((tt) => {
    window.__t = tt;
    document.querySelector('video').dispatchEvent(new Event('timeupdate'));
    const el = document.getElementById('pt-subs');
    const txt = el && el.querySelector('.pt-subs-text');
    return {
      text: txt ? txt.textContent : null,
      html: txt ? txt.innerHTML : null,
      shown: !!el && getComputedStyle(el).display !== 'none',
      bottom: el ? Math.round(1080 - el.getBoundingClientRect().bottom) : null,
      fs: txt ? getComputedStyle(txt).fontSize : null,
      nat: window.__nat.mode,
      osd: (document.getElementById('pt-osd') || {}).textContent || '',
    };
  }, t);

  let s = await at(1.5);
  ok('výchozí stopa zobrazena podle času', s.shown && s.text === 'Ahoj světe & spol.', JSON.stringify(s));
  ok('kurzíva zachovaná, entita dekódovaná', /<i>světe<\/i>/.test(s.html), s.html);
  ok('písmo 36 px dole nad videem', s.fs === '36px' && s.bottom > 40 && s.bottom < 200, JSON.stringify(s));
  ok('stopa přehrávače vypnutá (bez zdvojení)', s.nat === 'disabled', s.nat);
  s = await at(3.2);
  ok('mezi titulky nic', !s.shown, JSON.stringify(s));
  s = await at(4);
  ok('neznámé značky pryč, víc řádků', s.text === 'Druhý řádek\ntučně' && /<b>tučně<\/b>/.test(s.html) && !/<c|<v/.test(s.html), JSON.stringify(s));
  s = await at(6.5);
  const xss = await page.evaluate(() => ({ x: window.__xss || 0, img: document.querySelectorAll('#pt-subs img, #pt-subs script').length }));
  ok('HTML z titulků se nevykoná', s.text === 'Bez window.__xss=2HTML' && xss.x === 0 && xss.img === 0, JSON.stringify([s.text, xss]));

  // ChannelDown → další stopa (SRT ve windows-1250)
  const chDown = () => page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: () => 428 });
    window.dispatchEvent(ev);
  });
  await chDown();
  await page.waitForTimeout(400);
  s = await at(2);
  ok('ChannelDown přepne na další stopu', /Titulky: ENG/.test(s.osd) && s.text === 'Příliš žluťoučký kůň', JSON.stringify(s));
  await chDown();
  await page.waitForTimeout(300);
  s = await at(2);
  ok('po poslední stopě vypnuto', /vypnuto/.test(s.osd) && !s.shown, JSON.stringify(s));
  await chDown();
  await page.waitForTimeout(400);
  s = await at(1.5);
  ok('a znovu první stopa', /Titulky: CZE/.test(s.osd) && s.text === 'Ahoj světe & spol.', JSON.stringify(s));

  // pauza → titulky výš (nad ovládací lištou)
  await page.evaluate(() => document.body.classList.remove('pt-paused'));
  s = await at(1.5);
  const low = s.bottom;
  ok('při přehrávání nízko u spodního okraje', low >= 40 && low <= 100, String(low));
  await page.evaluate(() => document.body.classList.add('pt-paused'));
  s = await at(1.5);
  ok('při pauze výš nad lištou', s.bottom > low, low + ' → ' + s.bottom);

  ok('bez chyb JS', errors.length === 0, errors.join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
