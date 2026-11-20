/*
 * TizenPrehrajTo pro LG webOS – zavaděč modu.
 * webOS ho vloží do každé stránky aplikace (webOSUserScripts/userScript.js).
 *
 * Spustí nejnovější známou verzi modu: verzi přibalenou v .ipk, nebo
 * novější verzi z CDN uloženou v localStorage. Na pozadí (jednou za
 * spuštění aplikace) zkontroluje, jestli na CDN není novější verze, a
 * uloží ji – projeví se při dalším spuštění, .ipk tedy není potřeba
 * kvůli každé změně přeinstalovávat.
 *
 * Generuje build-webos.js – neupravovat ve složce build/.
 */
(function () {
  'use strict';

  if (window !== window.top) return;

  var BUNDLED_VERSION = /*__VERSION__*/ '0.0.0';
  var CACHE_KEY = 'tizenprehrajto.webosMod';
  var CHECKED_KEY = 'pt-webos-update-checked';
  var CDN = 'https://cdn.jsdelivr.net/gh/Croden/TizenPrehrajTo@main/';

  // přibalená verze modu (dist/userScript.js)
  var bundled = function () {
    /*__MOD__*/
  };

  // 1.10.2 > 1.9.9
  function newer(a, b) {
    var x = String(a).split('.');
    var y = String(b).split('.');
    for (var i = 0; i < 3; i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d > 0;
    }
    return false;
  }

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && typeof c.v === 'string' && typeof c.code === 'string') return c;
    } catch (e) { /* nic */ }
    return null;
  }

  var cache = readCache();
  var current = BUNDLED_VERSION;
  var ran = false;
  if (cache && newer(cache.v, BUNDLED_VERSION)) {
    try {
      (0, eval)(cache.code);
      ran = true;
      current = cache.v;
    } catch (e) {
      try { localStorage.removeItem(CACHE_KEY); } catch (e2) { /* nic */ }
    }
  }
  if (!ran) bundled();

  function checkUpdate() {
    try {
      if (sessionStorage.getItem(CHECKED_KEY)) return;
      sessionStorage.setItem(CHECKED_KEY, '1');
    } catch (e) { return; }
    if (!window.fetch) return;
    var latest = null;
    fetch(CDN + 'package.json', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (pkg) {
        latest = pkg && pkg.version;
        if (!latest || !newer(latest, current)) return null;
        return fetch(CDN + 'dist/userScript.js', { cache: 'no-store' }).then(function (res) {
          if (!res.ok) throw new Error('CDN ' + res.status);
          return res.text();
        });
      })
      .then(function (code) {
        if (!code) return;
        new Function(code); // jen kontrola syntaxe – rozbitý soubor neuložit
        localStorage.setItem(CACHE_KEY, JSON.stringify({ v: latest, code: code, t: Date.now() }));
      })
      .catch(function () { /* offline / CDN nedostupné – zkusí se příště */ });
  }

  if (document.readyState === 'complete') setTimeout(checkUpdate, 3000);
  else window.addEventListener('load', function () { setTimeout(checkUpdate, 3000); });
})();
