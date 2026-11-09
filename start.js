// Dev náhled na PC: lokální proxy na prehrajto.cz, která do každé HTML
// stránky vloží dist/userScript.js stejně jako TizenBrew na TV (inline
// <script> na začátku <head>). Otevři v běžném prohlížeči:
//
//   http://localhost:3003/__tv   – vycentrovaný box 1920×1080 (TV render;
//                                  jiné rozlišení: /__tv?w=3840&h=2160)
//   http://localhost:3003/       – stránka přes celé okno
//
// Ovládání: šipky + Enter | Esc = Zpět | PgUp/PgDn = Channel ▲/▼
//           F1 = Play/Pause | F2 = Stop | F3 = Rewind | F4 = FastForward
//
// Přihlášení funguje normálně (cookies se drží na localhostu),
// cookie theme=dark se doplňuje automaticky.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = parseInt(process.env.PORT, 10) || 3003;
const TARGET = 'prehrajto.cz';
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

// userScript má guard proti spuštění v iframech (reklamy); v náhledu
// /__tv ale stránka běží v našem iframu #tv, takže guard pro něj povolíme.
const GUARD = 'if (window !== window.top) return;';
const MOD_DEV = MOD.indexOf(GUARD) !== -1
  ? MOD.replace(GUARD, 'if (window !== window.top && !window.__ptAllowFrame) return;')
  : MOD;
if (MOD_DEV === MOD) console.warn('Pozor: iframe guard v buildu nenalezen, /__tv nemusí fungovat.');

const ALLOW_FRAME = 'try { if (window.frameElement && window.frameElement.id === "tv") window.__ptAllowFrame = true; } catch (e) {}';

const INJECT = '<script>' + ALLOW_FRAME + '\n' + KEY_SHIM + '\n' +
  MOD_DEV.replace(/<\/script/gi, '<\\/script') + '</script>';

const DROP_RES_HEADERS = [
  'content-security-policy', 'content-security-policy-report-only',
  'strict-transport-security', 'x-frame-options',
  'connection', 'transfer-encoding',
];

function tvPage(query) {
  var w = parseInt(query.get('w'), 10) || 1920;
  var h = parseInt(query.get('h'), 10) || 1080;
  return '<!doctype html><html><head><meta charset="utf-8"><title>TizenPrehrajTo náhled</title><style>' +
    'html,body{margin:0;height:100%;background:#000;overflow:hidden}' +
    '.wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}' +
    'iframe{width:' + w + 'px;height:' + h + 'px;border:0;background:#000;flex:none}' +
    '</style></head><body><div class="wrap">' +
    '<iframe id="tv" src="/oblibena-videa/" allowfullscreen allow="autoplay; fullscreen"></iframe>' +
    '</div><script>' +
    'var W=' + w + ',H=' + h + ',tv=document.getElementById("tv");' +
    'function fit(){var s=Math.min(innerWidth/W,innerHeight/H,1);tv.style.transform="scale("+s+")";}' +
    'addEventListener("resize",fit);fit();tv.focus();' +
    'addEventListener("click",function(){tv.focus();});' +
    '</script></body></html>';
}

const server = http.createServer(function (req, res) {
  var url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__tv') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(tvPage(url.searchParams));
    return;
  }

  var headers = Object.assign({}, req.headers);
  delete headers.host;
  delete headers.connection;
  headers['accept-encoding'] = 'identity';
  if (headers.origin) headers.origin = 'https://' + TARGET;
  if (headers.referer) headers.referer = headers.referer.replace(/^https?:\/\/[^/]+/, 'https://' + TARGET);
  var hadTheme = /(^|;\s*)theme=/.test(headers.cookie || '');
  if (!hadTheme) headers.cookie = (headers.cookie ? headers.cookie + '; ' : '') + 'theme=dark';

  var preq = https.request(
    { host: TARGET, path: req.url, method: req.method, headers: headers },
    function (pres) {
      var out = {};
      Object.keys(pres.headers).forEach(function (k) {
        if (DROP_RES_HEADERS.indexOf(k.toLowerCase()) === -1) out[k] = pres.headers[k];
      });
      if (out.location) {
        out.location = String(out.location)
          .replace(new RegExp('^https?://(www\\.)?' + TARGET.replace('.', '\\.'), ''), '') || '/';
      }
      var cookies = pres.headers['set-cookie'] || [];
      out['set-cookie'] = cookies.map(function (c) {
        return c.replace(/;\s*domain=[^;]*/ig, '').replace(/;\s*secure/ig, '');
      });
      if (!hadTheme) out['set-cookie'].push('theme=dark; Path=/; Max-Age=31536000');

      var ct = String(pres.headers['content-type'] || '');
      if (ct.indexOf('text/html') === -1) {
        res.writeHead(pres.statusCode, out);
        pres.pipe(res);
        return;
      }

      var chunks = [];
      pres.on('data', function (c) { chunks.push(c); });
      pres.on('end', function () {
        var buf = Buffer.concat(chunks);
        var enc = String(pres.headers['content-encoding'] || '');
        try {
          if (enc === 'gzip') buf = zlib.gunzipSync(buf);
          else if (enc === 'deflate') buf = zlib.inflateSync(buf);
          else if (enc === 'br') buf = zlib.brotliDecompressSync(buf);
        } catch (e) { /* necháme jak je */ }
        delete out['content-encoding'];
        var body = buf.toString('utf8')
          .split('https://www.' + TARGET).join('')
          .split('https://' + TARGET).join('');
        var head = body.match(/<head[^>]*>/i);
        body = head ? body.replace(head[0], head[0] + INJECT) : INJECT + body;
        out['content-length'] = Buffer.byteLength(body);
        res.writeHead(pres.statusCode, out);
        res.end(body);
      });
    }
  );
  preq.on('error', function (e) {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Proxy chyba: ' + e.message);
  });
  req.pipe(preq);
});

server.listen(PORT, function () {
  console.log('TizenPrehrajTo náhled běží:');
  console.log('  http://localhost:' + PORT + '/__tv   (TV box 1920×1080, ?w=&h= pro jiné)');
  console.log('  http://localhost:' + PORT + '/       (celé okno)');
  console.log('Esc = Zpět | PgUp/PgDn = zvuk/titulky | F1 Play/Pause | F2 Stop | F3 Rew | F4 FF');
});
