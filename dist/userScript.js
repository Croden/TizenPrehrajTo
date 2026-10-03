/*
 * TizenPrehrajTo – TizenBrew mod pro Samsung TV
 * Injektuje se do https://prehrajto.cz/ při každém načtení stránky.
 *
 * Vlastní CSS patří do src/userStyles.css, vlastní JS do funkce
 * customJs() níže. Po změně spusť `npm run build` a commitni dist/.
 */
(function () {
  'use strict';

  if (window !== window.top) return;
  if (window.__TIZENPREHRAJTO__) return;
  window.__TIZENPREHRAJTO__ = true;

  var CUSTOM_CSS = "/*\n * Funkční styly aplikace TizenPrehrajTo (režimy stránek, fokus, fullscreen player).\n * Vlastní vizuální úpravy patří do userStyles.css, ne sem.\n */\n\n/* ===== Globální ===== */\n/* stránka se ukáže až po aplikaci TV úprav (žádné probliknutí původního webu) */\nbody:not(.pt-ready) {\n  visibility: hidden !important;\n}\n\n/* srdíčko „oblíbené“ u videí schovat – označování jen na PC */\nbody.pt-search .video-favorite,\nbody.pt-favorites .video-favorite {\n  display: none !important;\n}\n\n/* web dává .video__content do flexu kvůli srdíčku – vrátit, ať má název plnou šířku */\nbody.pt-search .video__content,\nbody.pt-favorites .video__content {\n  display: block !important;\n}\n\n#feedback,\n.popup,\n.nav--mobile,\n.button--menu,\nfooter.footer {\n  display: none !important;\n}\n\ninput.video-search-phrase:focus,\n.header__links a:focus,\n.button--filters:focus,\n.filters-group__item:focus,\n.dialog a:focus,\n.dialog button:focus,\n.dialog input:focus {\n  outline: 4px solid #ffb400 !important;\n  outline-offset: 2px;\n}\n\na.video--link:focus {\n  outline: 5px solid #ffb400 !important;\n  outline-offset: 3px;\n  border-radius: 4px;\n}\n\n/* ===== Domovská stránka – jen vyhledávání + přihlásit ===== */\nbody.pt-home .logo,\nbody.pt-home .nav,\nbody.pt-home main .section,\nbody.pt-home #switch-theme-form,\nbody.pt-home .header a[href=\"#registration\"],\nbody.pt-home .header a[href=\"/cenik\"],\nbody.pt-home .header a[href=\"/profil/nahrat-soubor\"] {\n  display: none !important;\n}\n\nbody.pt-home .header {\n  position: fixed;\n  top: 32vh;\n  left: 50%;\n  transform: translateX(-50%);\n  width: 55vw;\n  background: transparent !important;\n  box-shadow: none !important;\n  /* přihlášení vizuálně až pod vyhledáváním */\n  display: flex;\n  flex-direction: column-reverse;\n}\n\nbody.pt-home .top-bar {\n  display: block;\n  background: transparent !important;\n  padding: 0;\n}\n\nbody.pt-home .top-bar-right,\nbody.pt-home .suggest-wrapper,\nbody.pt-home .suggest,\nbody.pt-home .form-search,\nbody.pt-home .form__group--search {\n  width: 100% !important;\n  max-width: none !important;\n  float: none !important;\n}\n\nbody.pt-home input.video-search-phrase {\n  font-size: 1.8rem !important;\n  height: 4rem !important;\n  width: 100% !important;\n}\n\nbody.pt-home .header__section {\n  display: block !important;\n}\n\nbody.pt-home .header__links {\n  display: flex;\n  justify-content: center;\n  margin-top: 2rem;\n  background: transparent !important;\n}\n\nbody.pt-home .header__section .grid-x {\n  justify-content: center !important;\n}\n\nbody.pt-home .header__links a[href=\"#login\"] {\n  font-size: 1.3rem;\n  padding: 0.5rem 1rem;\n}\n\n/* ===== Výsledky vyhledávání – vyhledávání + filtry + videa ===== */\nbody.pt-search .logo,\nbody.pt-search .nav,\nbody.pt-search #switch-theme-form,\nbody.pt-search .header__section.show-for-large,\nbody.pt-search main > .grid-x:not(:last-child) h1 {\n  display: none !important;\n}\n\n/* širší obsah – výchozí container je zbytečně úzký */\nbody.pt-search .grid-container {\n  max-width: 112rem !important;\n}\n\n/* vyhledávání přes celou šířku (logo je schované) */\nbody.pt-search .top-bar-left {\n  display: none !important;\n}\n\nbody.pt-search .top-bar-right,\nbody.pt-search .suggest-wrapper,\nbody.pt-search .suggest,\nbody.pt-search .form-search,\nbody.pt-search .form__group--search {\n  width: 100% !important;\n  max-width: none !important;\n  float: none !important;\n}\n\nbody.pt-search input.video-search-phrase {\n  width: 100% !important;\n}\n\n/* ===== Oblíbená videa (výchozí stránka) – search + premium + videa ===== */\nbody.pt-favorites .logo,\nbody.pt-favorites .nav,\nbody.pt-favorites .top-bar-left,\nbody.pt-favorites #switch-theme-form,\nbody.pt-favorites .section__header,\nbody.pt-favorites .breadcrumbs {\n  display: none !important;\n}\n\nbody.pt-favorites .grid-container {\n  max-width: 112rem !important;\n}\n\nbody.pt-favorites .top-bar-right,\nbody.pt-favorites .suggest-wrapper,\nbody.pt-favorites .suggest,\nbody.pt-favorites .form-search,\nbody.pt-favorites .form__group--search {\n  width: 100% !important;\n  max-width: none !important;\n  float: none !important;\n}\n\nbody.pt-favorites input.video-search-phrase {\n  width: 100% !important;\n}\n\n/* premium info v liště nechat viditelné a decentní */\nbody.pt-favorites .header__links {\n  justify-content: flex-end;\n}\n\n/* mřížka oblíbených: 6 videí vedle sebe, vycentrovaná\n   (.pt-fav-grid přidává skript na rodiče video karet) */\nbody.pt-favorites .pt-fav-grid {\n  display: flex !important;\n  flex-wrap: wrap;\n  justify-content: center;\n  width: 100% !important;\n  max-width: none !important;\n}\n\nbody.pt-favorites .pt-fav-grid > * {\n  flex: 0 0 auto;\n  width: calc(100% / 6 - 1rem) !important;\n  max-width: none !important;\n  margin: 0.5rem !important;\n}\n\nbody.pt-favorites .pt-fav-grid .video,\nbody.pt-favorites .pt-fav-grid .video__picture--container {\n  width: 100% !important;\n}\n\nbody.pt-favorites .pt-fav-grid .video img {\n  width: 100% !important;\n  height: auto;\n}\n\nbody.pt-favorites .pt-fav-grid .video__title {\n  width: 100% !important;\n  max-width: 100% !important;\n}\n\n/* ===== Video stránka – fullscreen player + titulek + hodnocení ===== */\nbody.pt-video {\n  overflow: hidden !important;\n}\n\nbody.pt-video #video-player-row {\n  position: fixed;\n  inset: 0;\n  margin: 0 !important;\n  z-index: 9000;\n  background: #000;\n}\n\nbody.pt-video #video-player-row .cell,\nbody.pt-video .video--detail,\nbody.pt-video #video-wrap {\n  width: 100vw !important;\n  height: 100vh !important;\n  max-width: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\nbody.pt-video #content_video {\n  width: 100vw !important;\n  height: 100vh !important;\n  padding-top: 0 !important;\n}\n\nbody.pt-video #content_video video {\n  object-fit: contain;\n  width: 100%;\n  height: 100%;\n}\n\n/* Titulek a hodnocení jako overlay – viditelné jen při pauze */\nbody.pt-video h1.title {\n  position: fixed;\n  top: 2vh;\n  left: 2vw;\n  max-width: 70vw;\n  z-index: 9001;\n  color: #fff !important;\n  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);\n  transition: opacity 0.3s;\n  margin: 0;\n}\n\nbody.pt-video h1.title span {\n  color: #fff !important;\n}\n\nbody.pt-video .rate {\n  position: fixed;\n  top: 2vh;\n  right: 2vw;\n  z-index: 9001;\n  color: #fff !important;\n  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);\n  transition: opacity 0.3s;\n  background: rgba(0, 0, 0, 0.5);\n  padding: 0.4rem 0.8rem;\n  border-radius: 6px;\n}\n\nbody.pt-video .rate span {\n  color: #fff !important;\n}\n\nbody.pt-video:not(.pt-paused) h1.title,\nbody.pt-video:not(.pt-paused) .rate {\n  opacity: 0;\n  pointer-events: none;\n}\n\n/*\n * Vlastní CSS pro prehrajto.cz\n * Sem patří všechny vizuální úpravy – po změně spusť `npm run build`.\n */\n\n/* Příklad: schování loga (selektor si uprav podle skutečného DOM)\n.logo {\n  display: none !important;\n}\n*/\n";

  var KEY = {
    BACK: 10009,
    ENTER: 13,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    MEDIA_PLAY_PAUSE: 10252,
    MEDIA_PLAY: 415,
    MEDIA_PAUSE: 19,
    MEDIA_STOP: 413,
    MEDIA_FAST_FORWARD: 417,
    MEDIA_REWIND: 412,
  };

  var SEEK_STEP_SECONDS = 10;

  // ------------------------------------------------------------------
  // Typ stránky
  // ------------------------------------------------------------------
  function pageType() {
    var p = location.pathname;
    if (p === '/' || p === '') return 'home';
    if (p.indexOf('/oblibena-videa') === 0) return 'favorites';
    if (p.indexOf('/hledej/') === 0) return 'search';
    if (document.getElementById('video-wrap')) return 'video';
    return 'other';
  }

  // ------------------------------------------------------------------
  // Pomůcky
  // ------------------------------------------------------------------
  function injectCss() {
    if (!CUSTOM_CSS || document.getElementById('tizenprehrajto-styles')) return;
    // skript může běžet ještě před parsováním dokumentu
    var parent = document.head || document.documentElement;
    if (!parent) return;
    var style = document.createElement('style');
    style.id = 'tizenprehrajto-styles';
    style.textContent = CUSTOM_CSS;
    parent.appendChild(style);
  }

  function whenDomReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function registerMediaKeys() {
    try {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'].forEach(function (name) {
        try { window.tizen.tvinputdevice.registerKey(name); } catch (e) { /* klávesa není dostupná */ }
      });
    } catch (e) { /* mimo Tizen */ }
  }

  function isVisible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  function activeVideo() {
    return document.getElementById('content_video_html5_api') || document.querySelector('video');
  }

  function openDialog() {
    var dialogs = document.querySelectorAll('.dialog.reveal:not(.hidden), .reveal.dialog:not(.hidden)');
    for (var i = 0; i < dialogs.length; i++) {
      if (isVisible(dialogs[i])) return dialogs[i];
    }
    return null;
  }

  function exitApp() {
    try {
      window.tizen.application.getCurrentApplication().exit();
    } catch (e) {
      try { window.close(); } catch (e2) { /* nic víc udělat nejde */ }
    }
  }

  // ------------------------------------------------------------------
  // Fokusová navigace (šipky nahoru/dolů)
  // ------------------------------------------------------------------
  var FOCUS_SELECTORS = {
    home: 'input.video-search-phrase, .header__links a[href="#login"]',
    favorites: 'input.video-search-phrase, a.video--link',
    search: 'input.video-search-phrase, .button--filters, #snippet-videoListing-videoListingWrapper a.video--link',
    other: 'main a[href], main button, main input:not([type=hidden]), .header__links a, input.video-search-phrase',
  };

  function focusables() {
    var dialog = openDialog();
    var root = dialog || document;
    var selector = dialog
      ? 'a[href], button, input:not([type=hidden])'
      : FOCUS_SELECTORS[pageType()] || FOCUS_SELECTORS.other;
    var list = [];
    var nodes = root.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      if (isVisible(nodes[i])) list.push(nodes[i]);
    }
    // řadit podle vizuální pozice, DOM pořadí jí nemusí odpovídat
    list.sort(function (a, b) {
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });
    return list;
  }

  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
  }

  function moveFocus(dir) {
    var list = focusables();
    if (!list.length) return;
    var idx = list.indexOf(document.activeElement);
    var next;
    if (idx === -1) {
      next = list[0];
    } else {
      next = list[Math.max(0, Math.min(list.length - 1, idx + dir))];
    }
    focusEl(next);
  }

  // Skok o řádek nahoru/dolů: nejbližší řádek v daném směru, v něm
  // prvek nejblíž aktuálnímu sloupci.
  function moveFocusRow(dir) {
    var list = focusables();
    if (!list.length) return;
    var cur = document.activeElement;
    if (list.indexOf(cur) === -1) {
      focusEl(list[0]);
      return;
    }
    var cr = cur.getBoundingClientRect();
    var cx = cr.left + cr.width / 2;
    var cy = cr.top + cr.height / 2;
    var ROW_TOLERANCE = 30;

    var candidates = [];
    var minDy = Infinity;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === cur) continue;
      var r = list[i].getBoundingClientRect();
      var y = r.top + r.height / 2;
      if (dir > 0 ? y <= cy + ROW_TOLERANCE : y >= cy - ROW_TOLERANCE) continue;
      var dy = Math.abs(y - cy);
      candidates.push({ el: list[i], dy: dy, dx: Math.abs(r.left + r.width / 2 - cx) });
      if (dy < minDy) minDy = dy;
    }
    if (!candidates.length) return;

    var best = null;
    for (var j = 0; j < candidates.length; j++) {
      var c = candidates[j];
      if (c.dy > minDy + ROW_TOLERANCE) continue;
      if (!best || c.dx < best.dx) best = c;
    }
    if (best) focusEl(best.el);
  }

  // ------------------------------------------------------------------
  // Přihlášená lišta – nechat jen info o premiu ("premium 32 dní"),
  // schovat "Můj účet" a "Odhlásit se". Selektory neznáme předem,
  // proto se řídí textem/odkazem položek.
  // ------------------------------------------------------------------
  function tidyAccountBar() {
    var items = document.querySelectorAll('.header__links li');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var text = (item.textContent || '').toLowerCase();
      if (text.indexOf('premium') !== -1 || /\d+\s*dn/.test(text)) continue;
      var a = item.querySelector('a, button');
      var href = a ? (a.getAttribute('href') || '') : '';
      if (/odhl|logout|sign-?out|profil|ucet|\u00fa\u010det/.test(text + ' ' + href)) {
        item.style.display = 'none';
      }
    }
    // tlačítko "Prodloužit" schovat, text s počtem dní premia nechat
    var links = document.querySelectorAll('.header a, .header button, .top-bar a, .top-bar button');
    for (var j = 0; j < links.length; j++) {
      var t = (links[j].textContent || '').trim().toLowerCase();
      if (/prodlou/.test(t) && !/\d+\s*dn/.test(t)) links[j].style.display = 'none';
    }
  }

  // ------------------------------------------------------------------
  // Oblíbená videa – schovat boční panel s menu, nechat jen mřížku
  // videí přes celou šířku. Panel nemá známý selektor, proto se od
  // videí stoupá k <main> a schovává se vše, co videa neobsahuje.
  // ------------------------------------------------------------------
  function tidyFavoritesLayout() {
    var link = document.querySelector('a.video--link');
    if (!link) return false;
    var wrapper = (link.closest && link.closest('.video-wrapper')) || link;
    var main = document.querySelector('main') || document.body;
    if (!main.contains(wrapper)) return true;
    if (wrapper.parentElement) wrapper.parentElement.classList.add('pt-fav-grid');
    var el = wrapper.parentElement;
    while (el && el !== main && el !== document.body) {
      var sibs = el.parentElement ? el.parentElement.children : [];
      for (var i = 0; i < sibs.length; i++) {
        var sib = sibs[i];
        if (sib === el) continue;
        if (sib.querySelector('a.video--link') || sib.querySelector('input.video-search-phrase')) continue;
        sib.style.display = 'none';
      }
      el.style.width = '100%';
      el.style.maxWidth = 'none';
      el = el.parentElement;
    }
    return true;
  }

  // Info o premiu zarovnat na pravou hranu vyhledávacího pole
  function alignPremiumToSearch() {
    var input = document.querySelector('input.video-search-phrase');
    var links = document.querySelector('.header__links');
    if (!input || !links) return;
    var item = null;
    var lis = links.querySelectorAll('li');
    for (var i = 0; i < lis.length; i++) {
      if (isVisible(lis[i])) { item = lis[i]; break; }
    }
    var r = (item || links).getBoundingClientRect();
    var ir = input.getBoundingClientRect();
    if (!r.width || !ir.width) return;
    var d = Math.round(r.right - ir.right);
    if (d) {
      links.style.marginRight =
        ((parseFloat(getComputedStyle(links).marginRight) || 0) + d) + 'px';
    }
  }

  // ------------------------------------------------------------------
  // Vyhledávání
  // ------------------------------------------------------------------
  function submitSearch(input) {
    var q = (input.value || '').trim();
    if (!q) return;
    location.href = '/hledej/' + encodeURIComponent(q);
  }

  // ------------------------------------------------------------------
  // Video stránka
  // ------------------------------------------------------------------
  function setPausedClass(paused) {
    document.body.classList.toggle('pt-paused', paused);
  }

  function initVideoPage() {
    document.body.classList.add('pt-paused');
    var tries = 0;
    var timer = setInterval(function () {
      var video = activeVideo();
      var player = document.getElementById('content_video');
      if (!video || !player) {
        if (++tries > 60) clearInterval(timer);
        return;
      }
      clearInterval(timer);

      player.classList.remove('hidden');
      video.addEventListener('play', function () { setPausedClass(false); });
      video.addEventListener('pause', function () { setPausedClass(true); });

      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay zablokován – spustí se Enterem */ });

      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }, 250);
  }

  function seek(delta) {
    var video = activeVideo();
    if (!video) return;
    var t = video.currentTime + delta;
    if (video.duration) t = Math.min(video.duration - 1, t);
    video.currentTime = Math.max(0, t);
  }

  function togglePlay() {
    var video = activeVideo();
    if (!video) return;
    if (video.paused) {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      video.pause();
    }
  }

  // ------------------------------------------------------------------
  // Klávesy
  // ------------------------------------------------------------------
  function onKeyDown(e) {
    var type = pageType();
    var video = activeVideo();
    var dialog = openDialog();

    switch (e.keyCode) {
      case KEY.BACK:
        e.preventDefault();
        e.stopPropagation();
        if (dialog) {
          var close = dialog.querySelector('.close-button');
          if (close) close.click();
        } else if (document.activeElement && document.activeElement.classList &&
                   document.activeElement.classList.contains('video-search-phrase')) {
          // první Zpět jen zruší fokus vyhledávání, až další ukončí/vrátí
          document.activeElement.blur();
        } else if (type === 'home' || type === 'favorites') {
          exitApp();
        } else {
          history.back();
        }
        return;

      case KEY.UP:
      case KEY.DOWN:
        if (type === 'video' && !dialog) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        moveFocusRow(e.keyCode === KEY.DOWN ? 1 : -1);
        return;

      case KEY.LEFT:
      case KEY.RIGHT:
        if (type === 'video' && !dialog) {
          e.preventDefault();
          seek(e.keyCode === KEY.RIGHT ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS);
          return;
        }
        // v gridu výsledků posouvá fokus i doleva/doprava; v inputu nechat kurzor
        if (document.activeElement && document.activeElement.tagName !== 'INPUT') {
          e.preventDefault();
          e.stopPropagation();
          moveFocus(e.keyCode === KEY.RIGHT ? 1 : -1);
        }
        return;

      case KEY.ENTER:
        if (type === 'video' && !dialog) {
          e.preventDefault();
          togglePlay();
          return;
        }
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('video-search-phrase')) {
          e.preventDefault();
          e.stopPropagation();
          submitSearch(document.activeElement);
        }
        return;

      case KEY.MEDIA_PLAY_PAUSE:
        togglePlay();
        break;
      case KEY.MEDIA_PLAY:
        if (video) video.play();
        break;
      case KEY.MEDIA_PAUSE:
        if (video) video.pause();
        break;
      case KEY.MEDIA_STOP:
        if (video) { video.pause(); video.currentTime = 0; }
        break;
      case KEY.MEDIA_FAST_FORWARD:
        seek(SEEK_STEP_SECONDS);
        break;
      case KEY.MEDIA_REWIND:
        seek(-SEEK_STEP_SECONDS);
        break;
      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();
  }

  // ------------------------------------------------------------------
  // Autofocus podle stránky
  // ------------------------------------------------------------------
  function autofocus(type) {
    if (type === 'home' || type === 'favorites') {
      focusEl(document.querySelector('input.video-search-phrase'));
    } else if (type === 'search') {
      var first = document.querySelector('#snippet-videoListing-videoListingWrapper a.video--link');
      focusEl(first || document.querySelector('input.video-search-phrase'));
    }
  }

  // ------------------------------------------------------------------
  // VLASTNÍ JS – sem piš svoje úpravy stránky
  // ------------------------------------------------------------------
  function customJs() {
  }
  // ------------------------------------------------------------------

  injectCss();
  // na TV se skript spouští ještě před parsováním dokumentu – zkoušet
  // vložit CSS co nejdřív, aby původní web vůbec neprobliknul
  if (CUSTOM_CSS && !document.getElementById('tizenprehrajto-styles')) {
    var cssTimer = setInterval(function () {
      injectCss();
      if (document.getElementById('tizenprehrajto-styles')) clearInterval(cssTimer);
    }, 10);
  }
  registerMediaKeys();
  window.addEventListener('keydown', onKeyDown, true);

  whenDomReady(function () {
    injectCss();
    var type = pageType();
    document.body.classList.add('pt-ready');
    document.body.classList.add('pt-' + type);
    tidyAccountBar();
    if (type === 'video') initVideoPage();
    if (type === 'favorites') {
      var favTries = 0;
      var favTimer = setInterval(function () {
        if (tidyFavoritesLayout()) {
          clearInterval(favTimer);
          alignPremiumToSearch();
        } else if (++favTries > 20) {
          clearInterval(favTimer);
        }
      }, 250);
    }

    // Vue komponenta vyhledávání se renderuje chvíli po DOMContentLoaded
    var tries = 0;
    var timer = setInterval(function () {
      var input = document.querySelector('input.video-search-phrase');
      if (input || ++tries > 20) {
        clearInterval(timer);
        autofocus(type);
      }
    }, 250);

    customJs();
  });
})();
