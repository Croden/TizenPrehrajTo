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

  var CUSTOM_CSS = /*__CSS__*/ '';

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
