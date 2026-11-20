// Build aplikace pro LG webOS → prehrajto-lg.ipk v kořeni repa.
// Spouští se přes `npm run build:webos` (nejdřív se udělá běžný build).
//
// Obsah balíčku (build/webos/):
//   appinfo.json                  – manifest (verze z package.json)
//   index.html                    – jen přesměruje na prehrajto.cz
//   webOSUserScripts/userScript.js – zavaděč modu (webos/loader.js)
//                                   s přibaleným dist/userScript.js
//   icon.png, largeIcon.png
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'webos');
const STAGE = path.join(ROOT, 'build', 'webos');
const OUT_NAME = 'prehrajto-lg.ipk';

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const mod = fs.readFileSync(path.join(ROOT, 'dist', 'userScript.js'), 'utf8');

fs.rmSync(path.join(ROOT, 'build'), { recursive: true, force: true });
fs.mkdirSync(path.join(STAGE, 'webOSUserScripts'), { recursive: true });

const appinfo = JSON.parse(fs.readFileSync(path.join(SRC, 'appinfo.json'), 'utf8'));
appinfo.version = pkg.version;
fs.writeFileSync(path.join(STAGE, 'appinfo.json'), JSON.stringify(appinfo, null, 2) + '\n');
for (const f of ['index.html', 'icon.png', 'largeIcon.png']) {
  fs.copyFileSync(path.join(SRC, f), path.join(STAGE, f));
}

const loader = fs.readFileSync(path.join(SRC, 'loader.js'), 'utf8')
  .replace("/*__VERSION__*/ '0.0.0'", () => JSON.stringify(pkg.version))
  .replace('/*__MOD__*/', () => mod);
try {
  new Function(loader);
} catch (e) {
  console.error('Syntaktická chyba v zavaděči: ' + e.message);
  process.exit(1);
}
fs.writeFileSync(path.join(STAGE, 'webOSUserScripts', 'userScript.js'), loader);

// oficiální balič LG (@webos-tools/cli); -n = bez minifikace (na TV jde
// přesně otestovaný kód)
const tmp = path.join(ROOT, 'build', 'ipk');
fs.mkdirSync(tmp, { recursive: true });
const ares = path.join(ROOT, 'node_modules', '.bin', 'ares-package');
execFileSync(ares, ['-n', '-o', tmp, STAGE], { stdio: 'inherit' });
const built = fs.readdirSync(tmp).find((f) => f.endsWith('.ipk'));
if (!built) {
  console.error('ares-package nevyrobil .ipk');
  process.exit(1);
}
fs.copyFileSync(path.join(tmp, built), path.join(ROOT, OUT_NAME));
console.log(OUT_NAME + ' vygenerován (' + built + ', ' + fs.statSync(path.join(ROOT, OUT_NAME)).size + ' B)');
