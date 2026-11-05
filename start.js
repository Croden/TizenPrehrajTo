// Dev náhled na PC: otevře prehrajto.cz v Chromu s injektovaným buildem
// (stejně, jako to dělá TizenBrew na TV).
//
// Spuštění:  npm start            – okno 1920×1080 (Tizen renderuje web
//                                   appky v 1080p i na 4K panelu)
//            npm start -- 3840 2160  – jiné rozlišení
//
// Ovládání:  šipky + Enter | Esc = Zpět | PgUp/PgDn = Channel ▲/▼
//            F1 = Play/Pause | F2 = Stop | F3 = Rewind | F4 = FastForward
//
// Přihlášení se ukládá do .chrome-profile/ (gitignorováno).

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const args = process.argv.slice(2).filter(function (a) { return /^\d+$/.test(a); });
const W = parseInt(args[0], 10) || 1920;
const H = parseInt(args[1], 10) || 1080;
const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const URL = require('./package.json').websiteURL;
const MOD = fs.readFileSync(path.join(__dirname, 'dist', 'userScript.js'), 'utf8');

// Mapování PC kláves na Tizen keyCodes, které očekává userScript.
const KEY_SHIM = '(function () {\n' +
  '  var map = { Escape: 10009, PageUp: 427, PageDown: 428, F1: 10252, F2: 413, F3: 412, F4: 417 };\n' +
  '  window.addEventListener("keydown", function (ev) {\n' +
  '    var code = map[ev.key];\n' +
  '    if (!code) return;\n' +
  '    ev.preventDefault();\n' +
  '    ev.stopImmediatePropagation();\n' +
  '    var e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true });\n' +
  '    Object.defineProperty(e, "keyCode", { get: function () { return code; } });\n' +
  '    window.dispatchEvent(e);\n' +
  '  }, true);\n' +
  '})();';

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(__dirname, '.chrome-profile'), {
    headless: !!process.env.PT_HEADLESS,
    executablePath: CHROME,
    viewport: null,
    args: ['--window-size=' + (W + 16) + ',' + (H + 120)],
  });
  await ctx.addInitScript(KEY_SHIM);
  await ctx.addInitScript(MOD);
  const page = ctx.pages()[0] || await ctx.newPage();

  // Obsah okna přesně W×H, okno vycentrovat na obrazovce.
  try {
    const cdp = await ctx.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    const m = await page.evaluate(function () {
      return { iw: innerWidth, ih: innerHeight, sw: screen.availWidth, sh: screen.availHeight };
    });
    const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
    const width = bounds.width + (W - m.iw);
    const height = bounds.height + (H - m.ih);
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: {
        width: width,
        height: height,
        left: Math.max(0, Math.round((m.sw - width) / 2)),
        top: Math.max(0, Math.round((m.sh - height) / 2)),
      },
    });
    if (width > m.sw || height > m.sh) {
      console.warn('Pozor: okno ' + width + '×' + height + ' přesahuje obrazovku ' + m.sw + '×' + m.sh + '.');
    }
  } catch (e) {
    console.warn('Nepodařilo se nastavit velikost okna:', e.message);
  }

  await page.goto(URL);
  console.log('Náhled ' + W + '×' + H + ': ' + URL);
  console.log('Esc = Zpět | PgUp/PgDn = zvuk/titulky | F1 Play/Pause | F2 Stop | F3 Rew | F4 FF');
  await new Promise(function (resolve) { ctx.on('close', resolve); });
})().catch(function (e) { console.error(e); process.exit(1); });
