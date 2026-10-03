/*
 * TizenPrehrajTo – TizenBrew mod pro Samsung TV
 * Injektuje se do https://prehrajto.cz/ při každém načtení stránky.
 *
 * Styly jsou v src/appStyles.css. Po změně spusť `npm run build`
 * a commitni dist/.
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
    CHANNEL_UP: 427,
    CHANNEL_DOWN: 428,
  };

  var SEEK_STEP_SECONDS = 10;

  // ------------------------------------------------------------------
  // Typ stránky
  // ------------------------------------------------------------------
  function pageType() {
    var p = location.pathname;
    if (p === '/' || p === '') return 'home';
    if (p.indexOf('/oblibena-videa') === 0) return 'favorites';
    try {
      // "právě sledovaná" sdílí režim s oblíbenými (cesta se ukládá při
      // nalezení odkazu v menu, viz watchedPath)
      var wp = sessionStorage.getItem('pt-watched-path');
      if (wp && p.indexOf(wp) === 0) return 'favorites';
    } catch (e) { /* bez sessionStorage */ }
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
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'ChannelUp', 'ChannelDown'].forEach(function (name) {
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
    favorites: 'input.video-search-phrase, a.pt-switch, a.video--link',
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

  // ------------------------------------------------------------------
  // Přepínač Oblíbená videa ⇄ Právě sledovaná. Odkaz na "právě sledované
  // uživateli" se zjistí z bočního menu (na TV je schované) a cesta se
  // uloží, aby šla cílová stránka poznat i po přechodu.
  // ------------------------------------------------------------------
  function watchedPath() {
    try {
      var stored = sessionStorage.getItem('pt-watched-path');
      if (stored) return stored;
    } catch (e) { /* bez sessionStorage */ }
    var links = document.querySelectorAll('a[href^="/"]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].classList.contains('pt-switch')) continue;
      if (/pr[áa]v[ěe]\s+sledovan/i.test(links[i].textContent || '')) {
        var path = links[i].getAttribute('href');
        try { sessionStorage.setItem('pt-watched-path', path); } catch (e) {}
        return path;
      }
    }
    return null;
  }

  function addSwitchButton() {
    if (document.querySelector('.pt-switch')) return;
    var header = document.querySelector('.header');
    if (!header) return;
    var onFavorites = location.pathname.indexOf('/oblibena-videa') === 0;
    var target = onFavorites ? watchedPath() : '/oblibena-videa/';
    if (!target) return;
    var row = document.createElement('div');
    row.className = 'pt-switch-row';
    var a = document.createElement('a');
    a.className = 'pt-switch';
    a.href = target;
    a.textContent = onFavorites ? 'Právě sledované uživateli' : 'Oblíbená videa';
    row.appendChild(a);
    header.appendChild(row);
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

  // Krátká informační hláška dole na obrazovce
  function showOsd(text) {
    var el = document.getElementById('pt-osd');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pt-osd';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('pt-osd--visible');
    clearTimeout(showOsd._t);
    showOsd._t = setTimeout(function () { el.classList.remove('pt-osd--visible'); }, 2000);
  }

  // Seznamy stop – přednostně z video.js playeru, jinak z <video>
  function getTrackLists() {
    var audio = null;
    var text = null;
    var p = null;
    try {
      if (window.videojs) {
        if (window.videojs.getPlayer) p = window.videojs.getPlayer('content_video');
        if (!p && window.videojs.players) {
          var ids = Object.keys(window.videojs.players);
          if (ids.length) p = window.videojs.players[ids[0]];
        }
      }
    } catch (e) { /* bez video.js */ }
    try { if (p && p.audioTracks) audio = p.audioTracks(); } catch (e) {}
    try { if (p && p.textTracks) text = p.textTracks(); } catch (e) {}
    var v = activeVideo();
    if ((!audio || !audio.length) && v) audio = v.audioTracks;
    if ((!text || !text.length) && v) text = v.textTracks;
    return { audio: audio, text: text };
  }

  function trackName(t, idx) {
    return t.label || t.language || ('stopa ' + (idx + 1));
  }

  function cycleAudio() {
    var tracks = getTrackLists().audio;
    if (!tracks || tracks.length < 2) {
      showOsd('Jen jedna zvuková stopa');
      return;
    }
    var cur = 0;
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].enabled) { cur = i; break; }
    }
    var next = (cur + 1) % tracks.length;
    for (var j = 0; j < tracks.length; j++) tracks[j].enabled = (j === next);
    showOsd('Zvuk: ' + trackName(tracks[next], next));
  }

  function cycleSubtitles() {
    var tracks = getTrackLists().text;
    var subs = [];
    if (tracks) {
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') subs.push(tracks[i]);
      }
    }
    if (!subs.length) {
      showOsd('Žádné titulky');
      return;
    }
    var cur = -1;
    for (var j = 0; j < subs.length; j++) {
      if (subs[j].mode === 'showing') { cur = j; break; }
    }
    var next = cur + 1; // po poslední stopě se titulky vypnou
    for (var k = 0; k < subs.length; k++) subs[k].mode = 'disabled';
    if (next < subs.length) {
      subs[next].mode = 'showing';
      showOsd('Titulky: ' + trackName(subs[next], next));
    } else {
      showOsd('Titulky: vypnuto');
    }
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
        } else if (type === 'home' ||
                   (type === 'favorites' && location.pathname.indexOf('/oblibena-videa') === 0)) {
          exitApp();
        } else {
          // na "právě sledovaných" a dalších stránkách vrací zpět
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
      case KEY.CHANNEL_UP:
        if (!video) return;
        cycleAudio();
        break;
      case KEY.CHANNEL_DOWN:
        if (!video) return;
        cycleSubtitles();
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
      addSwitchButton();
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

  });
})();
