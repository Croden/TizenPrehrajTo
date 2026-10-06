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
    favorites: 'input.video-search-phrase, a.pt-switch, .pt-filter-group a, .pt-filter-group button, a.video--link, .pagination a',
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
    // řadit podle vizuální pozice, DOM pořadí jí nemusí odpovídat;
    // prvky s téměř stejnou výškou brát jako jeden řádek
    list.sort(function (a, b) {
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      var dy = ra.top - rb.top;
      if (Math.abs(dy) < 10) return ra.left - rb.left;
      return dy;
    });
    return list;
  }

  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
  }

  // Srdíčko „přidat do oblíbených" u karty videa (renderuje ho web,
  // jen po přihlášení). Fokusuje se šipkou dolů z videa.
  function favControlFor(videoLink) {
    if (!videoLink || !videoLink.closest) return null;
    var wrap = videoLink.closest('.video-wrapper') || videoLink.parentElement;
    if (!wrap) return null;
    var fav = wrap.querySelector('.video-favorite button, .video-favorite a, .video-favorite input');
    if (!fav) {
      fav = wrap.querySelector('.video-favorite');
      if (fav && fav.tabIndex < 0) fav.setAttribute('tabindex', '-1');
    }
    return fav && isVisible(fav) ? fav : null;
  }

  // Je-li fokus na srdíčku, vrátí odkaz videa, ke kterému patří
  function ownerVideoLink(el) {
    if (!el || !el.closest || !el.closest('.video-favorite')) return null;
    var wrap = el.closest('.video-wrapper');
    return el.closest('a.video--link') ||
      (wrap && wrap.querySelector('a.video--link'));
  }

  function moveFocus(dir) {
    var list = focusables();
    if (!list.length) return;
    var cur = document.activeElement;
    // doleva/doprava přepíná vždy mezi videi – ze srdíčka se vychází
    // z pozice jeho videa
    var owner = ownerVideoLink(cur);
    var idx = list.indexOf(owner || cur);
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
    var owner = ownerVideoLink(cur);
    if (owner) {
      // ze srdíčka: nahoru zpět na video, dolů pokračuje grid od videa
      if (dir < 0) {
        focusEl(owner);
        return;
      }
      cur = owner;
    } else if (list.indexOf(cur) === -1) {
      focusEl(list[0]);
      return;
    } else if (dir > 0 && cur.classList && cur.classList.contains('video--link')) {
      // z videa dolů nejdřív na jeho srdíčko (pokud existuje)
      var fav = favControlFor(cur);
      if (fav) {
        focusEl(fav);
        return;
      }
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
        if (sib.querySelector('a.video--link') || sib.querySelector('input.video-search-phrase') ||
            sib.querySelector('.pagination-item') ||
            (sib.classList && sib.classList.contains('pagination'))) continue;
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

  function makeSwitch(label, href) {
    // aktivní stránka je span – nedá se fokusovat ani otevřít
    var el = document.createElement(href ? 'a' : 'span');
    el.className = 'pt-switch' + (href ? '' : ' pt-switch--active');
    if (href) el.href = href;
    el.textContent = label;
    return el;
  }

  function addSwitchButton() {
    if (document.querySelector('.pt-switch-row')) return;
    var header = document.querySelector('.header');
    if (!header) return;
    var onFavorites = location.pathname.indexOf('/oblibena-videa') === 0;
    var row = document.createElement('div');
    row.className = 'pt-switch-row';
    row.appendChild(makeSwitch('Oblíbená videa', onFavorites ? null : '/oblibena-videa/'));
    var wp = onFavorites ? watchedPath() : null;
    if (!onFavorites) {
      row.appendChild(makeSwitch('Právě sledované uživateli', null));
    } else if (wp) {
      row.appendChild(makeSwitch('Právě sledované uživateli', wp));
    }
    header.appendChild(row);
  }

  // Srdíčko „přidat do oblíbených" (web ho kreslí přes thumbnail)
  // přesunout do řádku štítků pod thumbnailem, úplně doprava.
  // Background a zaoblení se kopíruje ze štítku s délkou videa.
  // Srdíčka web dokresluje (a po kliknutí mění) průběžně, volá se
  // proto opakovaně z intervalu.
  function placeFavorites() {
    var links = document.querySelectorAll('a.video--link');
    for (var i = 0; i < links.length; i++) {
      var wrap = (links[i].closest && links[i].closest('.video-wrapper')) || links[i];
      var fav = wrap.querySelector('.video-favorite:not(.pt-fav-tag)');
      if (!fav) continue;
      var header = links[i].querySelector('.video__header');
      if (!header) continue;
      fav.classList.add('pt-fav-tag');
      header.appendChild(fav);
      var ref = header.querySelector('.video__tag--time') ||
                header.querySelector('.video__tag');
      if (ref) {
        var cs = getComputedStyle(ref);
        fav.style.background = cs.backgroundColor;
        fav.style.borderRadius = cs.borderRadius;
        fav.style.color = cs.color;
        fav.style.fontSize = cs.fontSize;
        fav.style.padding = cs.padding;
      }
    }
  }

  // Tlačítka filtru doby ("24 hodin", "7 dní", "14 dní") na právě
  // sledovaných přesunout doprava na řádek přepínače. Jejich původní
  // kontejner (s nadpisem "nejsledovanější za…") zůstává schovaný.
  function moveTimeFilters() {
    var row = document.querySelector('.pt-switch-row');
    if (!row) return;
    var group = row.querySelector('.pt-filter-group');
    var nodes = document.querySelectorAll('main a, main button, main label, main span, main strong');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.classList.contains('pt-filter')) continue;
      if (el.closest && el.closest('.pt-filter-group')) continue;
      var t = (el.textContent || '').trim();
      if (!/^(24\s*hodin|7\s*dn[íi]|14\s*dn[íi])$/i.test(t)) continue;
      if (el.querySelector && el.querySelector('a, button, span, strong')) continue;
      if (!group) {
        group = document.createElement('div');
        group.className = 'pt-filter-group';
        row.appendChild(group);
      }
      el.classList.add('pt-filter');
      group.appendChild(el);
    }
    if (group) markActiveFilter(group);
  }

  // Zvýraznit aktivní filtr: podle třídy od webu, shody URL, aktivní
  // bývá i prvek, který není odkaz; jinak výchozí = první (24 hodin)
  function markActiveFilter(group) {
    var btns = group.querySelectorAll('.pt-filter');
    var active = null;
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      b.classList.remove('pt-filter--active');
      if (/(^|\s)(active|is-active|selected|current)(\s|$)/.test(b.className)) {
        active = b;
      } else if (b.tagName !== 'A' && b.tagName !== 'BUTTON') {
        if (!active) active = b;
      } else if (b.href) {
        try {
          var u = new URL(b.getAttribute('href'), location.href);
          if (u.pathname === location.pathname && u.search === location.search && location.search) {
            active = b;
          }
        } catch (e) { /* neplatné URL */ }
      }
    }
    if (!active && !location.search && btns.length) active = btns[0];
    if (active) active.classList.add('pt-filter--active');
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
  // Našeptávač vyhledávání – položky se vybírají šipkami, ale fokus
  // zůstává v inputu (web našeptávač při ztrátě fokusu zavírá), výběr
  // se jen zvýrazňuje a Enter ho otevře.
  // ------------------------------------------------------------------
  var suggestIdx = -1;

  function suggestItems() {
    var boxes = document.querySelectorAll('.suggest, .suggest-wrapper');
    var raw = [];
    for (var b = 0; b < boxes.length; b++) {
      if (!isVisible(boxes[b])) continue;
      var nodes = boxes[b].querySelectorAll('a, li, [class*="suggest-item"], [class*="suggest__item"]');
      for (var i = 0; i < nodes.length; i++) {
        if (isVisible(nodes[i]) && raw.indexOf(nodes[i]) === -1) raw.push(nodes[i]);
      }
    }
    // nechat jen nejvnitřnější prvky (li > a by bylo dvakrát)
    var items = [];
    for (var j = 0; j < raw.length; j++) {
      var nested = false;
      for (var k = 0; k < raw.length; k++) {
        if (j !== k && raw[j].contains(raw[k])) { nested = true; break; }
      }
      if (!nested) items.push(raw[j]);
    }
    return items;
  }

  function paintSuggestSel(items) {
    var old = document.querySelectorAll('.pt-suggest-sel');
    for (var i = 0; i < old.length; i++) old[i].classList.remove('pt-suggest-sel');
    if (suggestIdx >= 0 && items && items[suggestIdx]) {
      items[suggestIdx].classList.add('pt-suggest-sel');
      try { items[suggestIdx].scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  }

  function clearSuggestSel() {
    suggestIdx = -1;
    paintSuggestSel(null);
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
    // při přetáčení krátce ukázat ovládací lištu s progresem
    document.body.classList.add('pt-seeking');
    clearTimeout(seek._t);
    seek._t = setTimeout(function () {
      document.body.classList.remove('pt-seeking');
    }, 1800);
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
          // Zpět nejdřív zruší výběr v našeptávači, pak fokus
          // vyhledávání, až další ukončí/vrátí
          if (suggestIdx >= 0) {
            clearSuggestSel();
          } else {
            document.activeElement.blur();
          }
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
        // ve vyhledávání s otevřeným našeptávačem vybírají šipky položky
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('video-search-phrase')) {
          var sItems = suggestItems();
          if (sItems.length) {
            if (e.keyCode === KEY.DOWN) {
              suggestIdx = Math.min(sItems.length - 1, suggestIdx + 1);
            } else {
              suggestIdx = Math.max(-1, suggestIdx - 1);
            }
            paintSuggestSel(sItems);
            return;
          }
          clearSuggestSel();
        }
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
          // vybraná položka našeptávače má přednost před hledáním
          var selItems = suggestItems();
          if (suggestIdx >= 0 && selItems[suggestIdx]) {
            var sel = selItems[suggestIdx];
            clearSuggestSel();
            var selLink = sel.tagName === 'A' ? sel : sel.querySelector && sel.querySelector('a');
            if (sel.click) sel.click();
            if (selLink && selLink.href) location.href = selLink.href;
            return;
          }
          submitSearch(document.activeElement);
          return;
        }
        // Enter na srdíčku jen přepne oblíbené, nesmí otevřít video
        if (document.activeElement && document.activeElement.closest &&
            document.activeElement.closest('.video-favorite')) {
          e.preventDefault();
          e.stopPropagation();
          document.activeElement.click();
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
    if (type === 'home') {
      focusEl(document.querySelector('input.video-search-phrase'));
    } else if (type === 'favorites') {
      if (location.pathname.indexOf('/oblibena-videa') === 0) {
        focusEl(document.querySelector('input.video-search-phrase'));
      } else {
        // na "právě sledovaných" rovnou první video (jako po vyhledání)
        var fv = document.querySelector('a.video--link');
        focusEl(fv || document.querySelector('input.video-search-phrase'));
      }
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
  // při psaní se nabídka našeptávače mění – výběr zrušit
  window.addEventListener('input', function (ev) {
    if (ev.target && ev.target.classList &&
        ev.target.classList.contains('video-search-phrase')) {
      clearSuggestSel();
    }
  }, true);

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
      setInterval(moveTimeFilters, 500);
    }
    if (type === 'favorites' || type === 'search') {
      setInterval(placeFavorites, 500);
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
