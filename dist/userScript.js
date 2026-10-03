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

  var CUSTOM_CSS = "/*\n * Funkční styly aplikace TizenPrehrajTo (režimy stránek, fokus, fullscreen player).\n * Vlastní vizuální úpravy patří do userStyles.css, ne sem.\n */\n\n/* ===== Globální ===== */\n#feedback,\n.popup,\n.nav--mobile,\n.button--menu,\nfooter.footer {\n  display: none !important;\n}\n\ninput.video-search-phrase:focus,\n.header__links a:focus,\n.button--filters:focus,\n.filters-group__item:focus,\n.dialog a:focus,\n.dialog button:focus,\n.dialog input:focus {\n  outline: 4px solid #ffb400 !important;\n  outline-offset: 2px;\n}\n\na.video--link:focus {\n  outline: 5px solid #ffb400 !important;\n  outline-offset: 3px;\n  border-radius: 4px;\n}\n\n/* ===== Domovská stránka – jen vyhledávání + přihlásit ===== */\nbody.pt-home .logo,\nbody.pt-home .nav,\nbody.pt-home main .section,\nbody.pt-home #switch-theme-form,\nbody.pt-home .header a[href=\"#registration\"],\nbody.pt-home .header a[href=\"/cenik\"],\nbody.pt-home .header a[href=\"/profil/nahrat-soubor\"] {\n  display: none !important;\n}\n\nbody.pt-home .header {\n  position: fixed;\n  top: 32vh;\n  left: 50%;\n  transform: translateX(-50%);\n  width: 55vw;\n  background: transparent !important;\n  box-shadow: none !important;\n  /* přihlášení vizuálně až pod vyhledáváním */\n  display: flex;\n  flex-direction: column-reverse;\n}\n\nbody.pt-home .top-bar {\n  display: block;\n  background: transparent !important;\n  padding: 0;\n}\n\nbody.pt-home .top-bar-right,\nbody.pt-home .suggest-wrapper,\nbody.pt-home .suggest,\nbody.pt-home .form-search,\nbody.pt-home .form__group--search {\n  width: 100% !important;\n  max-width: none !important;\n  float: none !important;\n}\n\nbody.pt-home input.video-search-phrase {\n  font-size: 1.8rem !important;\n  height: 4rem !important;\n  width: 100% !important;\n}\n\nbody.pt-home .header__section {\n  display: block !important;\n}\n\nbody.pt-home .header__links {\n  display: flex;\n  justify-content: center;\n  margin-top: 2rem;\n  background: transparent !important;\n}\n\nbody.pt-home .header__section .grid-x {\n  justify-content: center !important;\n}\n\nbody.pt-home .header__links a[href=\"#login\"] {\n  font-size: 1.3rem;\n  padding: 0.5rem 1rem;\n}\n\n/* ===== Výsledky vyhledávání – vyhledávání + filtry + videa ===== */\nbody.pt-search .logo,\nbody.pt-search .nav,\nbody.pt-search #switch-theme-form,\nbody.pt-search .header__section.show-for-large,\nbody.pt-search main > .grid-x:not(:last-child) h1 {\n  display: none !important;\n}\n\nbody.pt-search .top-bar {\n  justify-content: center;\n}\n\n/* ===== Video stránka – fullscreen player + titulek + hodnocení ===== */\nbody.pt-video {\n  overflow: hidden !important;\n}\n\nbody.pt-video #video-player-row {\n  position: fixed;\n  inset: 0;\n  margin: 0 !important;\n  z-index: 9000;\n  background: #000;\n}\n\nbody.pt-video #video-player-row .cell,\nbody.pt-video .video--detail,\nbody.pt-video #video-wrap {\n  width: 100vw !important;\n  height: 100vh !important;\n  max-width: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\nbody.pt-video #content_video {\n  width: 100vw !important;\n  height: 100vh !important;\n  padding-top: 0 !important;\n}\n\nbody.pt-video #content_video video {\n  object-fit: contain;\n  width: 100%;\n  height: 100%;\n}\n\n/* Titulek a hodnocení jako overlay – viditelné jen při pauze */\nbody.pt-video h1.title {\n  position: fixed;\n  top: 2vh;\n  left: 2vw;\n  max-width: 70vw;\n  z-index: 9001;\n  color: #fff !important;\n  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);\n  transition: opacity 0.3s;\n  margin: 0;\n}\n\nbody.pt-video h1.title span {\n  color: #fff !important;\n}\n\nbody.pt-video .rate {\n  position: fixed;\n  top: 2vh;\n  right: 2vw;\n  z-index: 9001;\n  color: #fff !important;\n  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);\n  transition: opacity 0.3s;\n  background: rgba(0, 0, 0, 0.5);\n  padding: 0.4rem 0.8rem;\n  border-radius: 6px;\n}\n\nbody.pt-video .rate span {\n  color: #fff !important;\n}\n\nbody.pt-video:not(.pt-paused) h1.title,\nbody.pt-video:not(.pt-paused) .rate {\n  opacity: 0;\n  pointer-events: none;\n}\n\n/*\n * Vlastní CSS pro prehrajto.cz\n * Sem patří všechny vizuální úpravy – po změně spusť `npm run build`.\n */\n\n/* Příklad: schování loga (selektor si uprav podle skutečného DOM)\n.logo {\n  display: none !important;\n}\n*/\n";

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
        } else if (type === 'home') {
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
        moveFocus(e.keyCode === KEY.DOWN ? 1 : -1);
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
    if (type === 'home') {
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
  registerMediaKeys();
  window.addEventListener('keydown', onKeyDown, true);

  whenDomReady(function () {
    injectCss();
    var type = pageType();
    document.body.classList.add('pt-' + type);
    if (type === 'video') initVideoPage();

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
