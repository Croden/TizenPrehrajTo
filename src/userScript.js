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
  // TMDB API klíč zašifrovaný heslem (AES-256-GCM, viz encrypt-key.js)
  var TMDB_ENC = /*__TMDB_ENC__*/ '';
  var TMDB_LS_KEY = 'tizenprehrajto.tmdbKey';
  var TMDB_PBKDF2_ITERATIONS = 120000;

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
  // Načítání / přechody stránek: dokud se layout neusadí, je vidět jen
  // tmavé pozadí (html.pt-loading), pak se stránka plynule prolne.
  // Při odchodu ze stránky se obsah naopak hned schová do pozadí.
  // ------------------------------------------------------------------
  function markLoading() {
    var de = document.documentElement;
    if (de && de.classList) de.classList.add('pt-loading');
    return !!de;
  }
  markLoading();

  // Původní homepage se nepoužívá – rovnou na oblíbená. Nepřihlášeného
  // ale web z oblíbených přesměruje zpět na / (kvůli přihlášení), proto
  // pojistka proti smyčce: podruhé do 15 s už homepage nechat.
  if (location.pathname === '/' || location.pathname === '') {
    var lastHomeRedirect = 0;
    try { lastHomeRedirect = parseInt(sessionStorage.getItem('pt-home-redirect'), 10) || 0; } catch (e) {}
    if (Date.now() - lastHomeRedirect > 15000) {
      try { sessionStorage.setItem('pt-home-redirect', String(Date.now())); } catch (e) {}
      location.replace('/oblibena-videa/');
      return;
    }
  }

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
    favorites: 'input.video-search-phrase, a.pt-switch, span.pt-reco-return, .pt-filter-group a, .pt-filter-group button, a.pt-hist-card, a.video--link, .pagination a, #pt-reco-gate input, #pt-reco-gate button, .pt-reco-card',
    search: 'input.video-search-phrase, .button--filters, #snippet-videoListing-videoListingWrapper a.video--link, .pagination a',
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

  // ----- plynulý scroll -----
  // Staré Tizen Chromium neumí scroll-behavior ani scrollTo/scrollIntoView
  // s options – posun se proto animuje ručně (requestAnimationFrame,
  // ease-out). Nový cíl během animace plynule navazuje z aktuální pozice
  // (držení šipky = souvislý pohyb, žádné skoky).
  var SCROLL_MS = 260;
  var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
    function (cb) { return setTimeout(cb, 16); };
  var cancelRaf = window.cancelAnimationFrame || window.webkitCancelAnimationFrame ||
    function (id) { clearTimeout(id); };

  function easeOutCubic(t) { var u = 1 - t; return 1 - u * u * u; }

  // holder = {raf, target}; target je cílová hodnota běžící animace
  function tweenScroll(holder, from, to, set, ms) {
    if (holder.raf) cancelRaf(holder.raf);
    holder.raf = 0;
    if (!ms || Math.abs(to - from) < 2) {
      holder.target = null;
      set(to);
      return;
    }
    holder.target = to;
    var start = Date.now();
    function frame() {
      var t = Math.min(1, (Date.now() - start) / ms);
      set(from + (to - from) * easeOutCubic(t));
      if (t < 1) {
        holder.raf = raf(frame);
      } else {
        holder.raf = 0;
        holder.target = null;
      }
    }
    holder.raf = raf(frame);
  }

  var winScroll = { raf: 0, target: null };

  function windowScrollY() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function viewportHeight() {
    return window.innerHeight || document.documentElement.clientHeight;
  }

  function smoothScrollWindowTo(y, instant) {
    var de = document.documentElement;
    var max = Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0) - viewportHeight();
    y = Math.round(Math.max(0, Math.min(Math.max(0, max), y)));
    var x = window.pageXOffset || 0;
    tweenScroll(winScroll, windowScrollY(), y, function (v) {
      window.scrollTo(x, Math.round(v));
    }, instant ? 0 : SCROLL_MS);
  }

  // vycentrovat prvek svisle do okna
  function centerInWindow(el, instant) {
    var r = el.getBoundingClientRect();
    smoothScrollWindowTo(r.top + windowScrollY() + r.height / 2 - viewportHeight() / 2, instant);
  }

  // posunout jen pokud prvek není celý pohodlně vidět
  function ensureInWindow(el, instant) {
    var r = el.getBoundingClientRect();
    var margin = 60;
    if (r.top < margin || r.bottom > viewportHeight() - margin) centerInWindow(el, instant);
  }

  function focusEl(el, instant) {
    if (!el) return;
    // položky našeptávače žijí ve fixed boxu – tam ať scrolluje prohlížeč
    if (el.closest && el.closest('#pt-suggest')) {
      el.focus();
      return;
    }
    // nativní scroll při focus() (preventScroll na TV nefunguje) vrátit
    // zpět a posunout plynule vlastní animací
    var sx = window.pageXOffset || 0;
    var sy = windowScrollY();
    // vodorovně posuvné řady: doporučení a naposledy přehrávané
    var parent = el.parentElement;
    var strip = parent && parent.classList &&
      (parent.classList.contains('pt-reco-strip') || parent.classList.contains('pt-history-row')) ? parent : null;
    var sl = strip ? strip.scrollLeft : 0;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    if (windowScrollY() !== sy || (window.pageXOffset || 0) !== sx) window.scrollTo(sx, sy);
    if (strip && strip.scrollLeft !== sl) strip.scrollLeft = sl;
    if (strip && strip.classList.contains('pt-history-row')) scrollStripToCard(strip, el, instant);
    // karty doporučení si posun okna řídí samy (řada vždy na střed)
    if (!strip || strip.classList.contains('pt-history-row')) ensureInWindow(el, instant);
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

  // U videa v oblíbených otevře klik na srdíčko dialog s výběrem
  // seznamů. Na TV ho obsloužíme automaticky: skrytý (body.pt-fav-auto)
  // se v něm odklikne checkbox seznamu a dialog se zavře – odlajknutí
  // i lajknutí tak funguje na jeden stisk. Dialog neznáme předem,
  // pozná se podle checkboxů, které po kliknutí získaly rozměry
  // (visibility:hidden z pt-fav-auto layout zachovává).
  function hasLayout(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  // označit vše, co v DOM existuje před kliknutím na srdíčko – nové
  // prvky (dialog/popover) se pak poznají podle chybějící značky
  function markExisting() {
    var all = document.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) all[i].__ptPre = true;
  }

  // snímek checkboxů před kliknutím: prvek + zda měl rozměry
  function snapshotBoxes() {
    var all = document.querySelectorAll('input[type=checkbox]');
    var snap = [];
    for (var i = 0; i < all.length; i++) {
      snap.push({ el: all[i], vis: hasLayout(all[i]) });
    }
    return snap;
  }

  function autoResolveFavDialog(preBoxes, heart) {
    document.body.classList.add('pt-fav-auto');
    var tries = 0;
    var timer = setInterval(function () {
      var all = document.querySelectorAll('input[type=checkbox]');
      var fresh = [];
      for (var i = 0; i < all.length; i++) {
        var known = null;
        for (var k = 0; k < preBoxes.length; k++) {
          if (preBoxes[k].el === all[i]) { known = preBoxes[k]; break; }
        }
        // nový checkbox, nebo starý (znovupoužitý popover), který
        // teprve teď dostal rozměry
        if (!known || (!known.vis && hasLayout(all[i]))) fresh.push(all[i]);
      }
      if (!fresh.length) {
        // dialog se neobjevil (lajk proběhl rovnou) – po 2 s skončit
        if (++tries > 20) {
          clearInterval(timer);
          document.body.classList.remove('pt-fav-auto');
        }
        return;
      }
      clearInterval(timer);
      // zaškrtnutý checkbox = video v seznamu → odškrtnout (odlajkne);
      // jinak zaškrtnout první (lajkne)
      var target = null;
      for (var j = 0; j < fresh.length; j++) {
        if (fresh[j].checked) { target = fresh[j]; break; }
      }
      if (!target) target = fresh[0];
      // kořen dialogu = nejvyšší nově vzniklý předek checkboxu
      var root = target;
      while (root.parentElement && root.parentElement !== document.body &&
             !root.parentElement.__ptPre) {
        root = root.parentElement;
      }
      if (root === target) {
        root = (target.closest &&
          target.closest('.reveal, .dialog, .modal, [class*="popup"], [class*="tooltip"], [class*="dialog"], [class*="favorite-list"]')) ||
          target.parentElement;
      }
      // trvale neviditelný (visibility kvůli zachování layoutu pro
      // příští detekci) – nesmí zůstat „viset" na obrazovce
      if (root && root.classList) root.classList.add('pt-fav-dialog');
      target.click();
      // chvíli počkat, ať web stihne změnu odeslat, pak dialog zavřít
      setTimeout(function () {
        var close = root && root.querySelector &&
          root.querySelector('.close-button, [data-close], button[class*="close"]');
        if (close) {
          close.click();
        } else if (heart && heart.click) {
          // popover bez zavíracího tlačítka se zavírá dalším klikem
          // na srdíčko (toggle)
          heart.click();
        }
        document.body.classList.remove('pt-fav-auto');
      }, 400);
    }, 100);
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
      // premium i položky bez textu (ikonová tlačítka) – zůstal by prázdný box
      if (text.indexOf('premium') !== -1 || /\d+\s*dn/.test(text) ||
          !text.replace(/\s+/g, '')) {
        item.style.display = 'none';
        continue;
      }
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
    // zůstal by prázdný box (ul má padding + background) – schovat celé ul,
    // pokud v něm nezbyla žádná viditelná položka
    var lists = document.querySelectorAll('.header__links');
    for (var k = 0; k < lists.length; k++) {
      var kids = lists[k].children;
      var anyVisible = false;
      for (var m = 0; m < kids.length; m++) {
        if (kids[m].style.display !== 'none') { anyVisible = true; break; }
      }
      lists[k].style.display = anyVisible ? '' : 'none';
    }
    hideEmptyHeaderBoxes();
  }

  // Po schování textu (premium, účet…) zůstávaly v hlavičce prázdné
  // boxy – rodič s pozadím/rámečkem a paddingem. Schová se každý
  // viditelný prvek hlavičky, který má vlastní pozadí nebo rámeček,
  // ale žádný viditelný text ani ovládací prvek.
  function hasPaintedBox(cs) {
    var bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) return true;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    var sides = ['Top', 'Right', 'Bottom', 'Left'];
    for (var i = 0; i < sides.length; i++) {
      if (parseFloat(cs['border' + sides[i] + 'Width']) > 0 &&
          cs['border' + sides[i] + 'Style'] !== 'none') return true;
    }
    return false;
  }

  function hasVisibleContent(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = walker.nextNode())) {
      if (!/\S/.test(n.nodeValue)) continue;
      var p = n.parentNode;
      if (!p || p.nodeType !== 1 || getComputedStyle(p).visibility === 'hidden') continue;
      var range = document.createRange();
      range.selectNodeContents(n);
      var rr = range.getBoundingClientRect();
      if (rr.width > 0 && rr.height > 0) return true;
    }
    var ctrls = el.querySelectorAll('input:not([type=hidden]), select, textarea, video');
    for (var i = 0; i < ctrls.length; i++) {
      if (isVisible(ctrls[i])) return true;
    }
    return false;
  }

  function hideEmptyHeaderBoxes() {
    var header = document.querySelector('.header');
    if (!header) return;
    var input = document.querySelector('input.video-search-phrase');
    var switchRow = header.querySelector('.pt-switch-row');
    var all = header.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.ownerSVGElement || el.tagName.toLowerCase() === 'svg') continue;
      if (el.style.display === 'none') continue;
      if (input && (el === input || el.contains(input) || input.contains(el))) continue;
      if (switchRow && (el.contains(switchRow) || switchRow.contains(el))) continue;
      if (el.id === 'pt-suggest' || (el.closest && el.closest('#pt-suggest'))) continue;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || !hasPaintedBox(cs)) continue;
      if (!hasVisibleContent(el)) el.style.display = 'none';
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
            (sib.classList && sib.classList.contains('pagination')) ||
            sib.id === 'pt-reco' || sib.querySelector('#pt-reco') ||
            sib.id === 'pt-history') continue;
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
    var reco = makeSwitch('Doporučení', '#doporuceni');
    reco.classList.add('pt-reco-switch');
    reco.addEventListener('click', function (ev) {
      ev.preventDefault();
      clearRecoPos(); // manuální přepnutí = vždy od začátku
      openReco();
    });
    row.appendChild(reco);
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

  // Info o premiu zarovnat na pravou hranu vyhledávacího pole –
  // měří se vnitřní odkaz (vizuální box s rámečkem), ne jen text
  function alignPremiumToSearch() {
    var input = document.querySelector('input.video-search-phrase');
    var links = document.querySelector('.header__links');
    if (!input || !links) return;
    var item = null;
    var lis = links.querySelectorAll('li');
    for (var i = 0; i < lis.length; i++) {
      if (isVisible(lis[i])) { item = lis[i]; break; }
    }
    var box = item ? (item.querySelector('a, button') || item) : links;
    var r = box.getBoundingClientRect();
    var ir = input.getBoundingClientRect();
    if (!r.width || !ir.width) return;
    var d = Math.round(r.right - ir.right);
    if (d) {
      links.style.marginRight =
        ((parseFloat(getComputedStyle(links).marginRight) || 0) + d) + 'px';
    }
  }

  // Paginaci zarovnat s hranami mřížky videí (karty mají 0.5rem
  // margin, takže začínají kousek od kraje kontejneru). Volá se
  // opakovaně z intervalu – po srovnání jsou korekce nulové.
  function alignPagination() {
    var grid = document.querySelector('.pt-fav-grid, .video-listing');
    var pag = document.querySelector('.pagination');
    if (!grid || !pag || !isVisible(pag)) return;
    var first = grid.querySelector('.video-wrapper') || grid.firstElementChild;
    if (!first) return;
    var g = grid.getBoundingClientRect();
    var left = first.getBoundingClientRect().left;
    var inset = left - g.left;
    var p = pag.getBoundingClientRect();
    if (!p.width) return;
    var dl = Math.round(left - p.left);
    if (dl) {
      pag.style.marginLeft =
        ((parseFloat(getComputedStyle(pag).marginLeft) || 0) + dl) + 'px';
    }
    var dr = Math.round(p.right - (g.right - inset));
    if (dr) {
      pag.style.marginRight =
        ((parseFloat(getComputedStyle(pag).marginRight) || 0) + dr) + 'px';
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
  // Našeptávač vyhledávání – šipka dolů zkopíruje nabídku webu do
  // vlastního fokusovatelného seznamu (#pt-suggest). Fokus musí z
  // inputu odejít, jinak OK na TV jen znovu otevře klávesnici.
  // ------------------------------------------------------------------

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

  // poslední nabídka pro aktuální text – web ji po odchodu fokusu z
  // inputu schová, overlay se pak staví z této kopie
  var lastSuggest = null;
  // nativní dropdown webu schovaný po dobu otevřeného overlaye,
  // aby pod ním neprosvítal
  var hiddenNativeSuggest = [];

  function hideNativeSuggest(items, input) {
    for (var i = 0; i < items.length; i++) {
      // vystoupat k nejvyššímu předku, který neobsahuje input –
      // to je kontejner dropdownu (sourozenecká větev inputu)
      var el = items[i];
      while (el.parentElement && !el.parentElement.contains(input)) {
        el = el.parentElement;
      }
      if (el && hiddenNativeSuggest.indexOf(el) === -1) {
        el.classList.add('pt-native-suggest-hidden');
        hiddenNativeSuggest.push(el);
      }
    }
  }

  function closeSuggestOverlay(refocus) {
    var box = document.getElementById('pt-suggest');
    if (box && box.parentElement) box.parentElement.removeChild(box);
    for (var i = 0; i < hiddenNativeSuggest.length; i++) {
      hiddenNativeSuggest[i].classList.remove('pt-native-suggest-hidden');
    }
    hiddenNativeSuggest = [];
    if (refocus) {
      var input = document.querySelector('input.video-search-phrase');
      if (input) focusEl(input);
    }
  }

  function openSuggestOverlay() {
    var input = document.querySelector('input.video-search-phrase');
    if (!input) return false;
    var live = suggestItems();
    var entries = [];
    for (var i = 0; i < live.length; i++) {
      var src = live[i];
      var link = src.tagName === 'A' ? src : (src.querySelector && src.querySelector('a'));
      entries.push({
        href: link && link.getAttribute('href'),
        text: (src.textContent || '').trim(),
        el: src,
      });
    }
    if (entries.length) {
      lastSuggest = { value: input.value, entries: entries };
    } else if (lastSuggest && lastSuggest.value === input.value) {
      // web nabídku po blur schoval – použít poslední známou kopii
      entries = lastSuggest.entries;
    }
    if (!entries.length) return false;
    closeSuggestOverlay(false);
    if (live.length) hideNativeSuggest(live, input);
    var box = document.createElement('div');
    box.id = 'pt-suggest';
    for (var j = 0; j < entries.length; j++) {
      (function (entry) {
        var a = document.createElement('a');
        a.className = 'pt-suggest-item';
        a.href = entry.href || '#';
        a.textContent = entry.text;
        if (!entry.href) {
          a.addEventListener('click', function (ev) {
            ev.preventDefault();
            if (entry.el && entry.el.click) entry.el.click();
          });
        }
        box.appendChild(a);
      })(entries[j]);
    }
    var r = input.getBoundingClientRect();
    box.style.left = r.left + 'px';
    box.style.top = (r.bottom + 4) + 'px';
    box.style.width = r.width + 'px';
    document.body.appendChild(box);
    // fokus nesmí zůstat v inputu, jinak OK znovu otevře klávesnici
    input.blur();
    focusEl(box.firstChild);
    return true;
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
      video.addEventListener('play', function () {
        setPausedClass(false);
        if (!initVideoPage.recorded) {
          initVideoPage.recorded = true;
          recordHistory();
        }
      });
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

  function subtitleTracks(list) {
    var subs = [];
    if (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].kind === 'subtitles' || list[i].kind === 'captions') subs.push(list[i]);
      }
    }
    return subs;
  }

  function cycleSubtitles() {
    // video.js drží vlastní (emulovaný) seznam stop vedle nativního –
    // režim se musí přepnout v obou, jinak se titulky nevykreslí
    var lists = [];
    var t = getTrackLists().text;
    if (t) lists.push(t);
    var v = activeVideo();
    if (v && v.textTracks && lists.indexOf(v.textTracks) === -1) lists.push(v.textTracks);
    var primary = null;
    for (var i = 0; i < lists.length; i++) {
      var s = subtitleTracks(lists[i]);
      if (s.length) { primary = s; break; }
    }
    if (!primary) {
      showOsd('Žádné titulky');
      return;
    }
    var cur = -1;
    for (var j = 0; j < primary.length; j++) {
      if (primary[j].mode === 'showing') { cur = j; break; }
    }
    var next = cur + 1; // po poslední stopě se titulky vypnou
    for (var l = 0; l < lists.length; l++) {
      var subs = subtitleTracks(lists[l]);
      for (var k = 0; k < subs.length; k++) {
        subs[k].mode = (k === next ? 'showing' : 'disabled');
      }
    }
    if (next < primary.length) {
      showOsd('Titulky: ' + trackName(primary[next], next));
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
  // Doporučení – vlastní stránka s řadami filmů z TMDB (jako knihovna
  // Netflixu). Otevírá se třetím přepínačem na oblíbených/sledovaných:
  // obsah webu se schová (CSS přes body.pt-reco) a místo něj se vykreslí
  // #pt-reco. API klíč je v buildu jen zašifrovaný – při prvním použití
  // ho odemkne krátké heslo (WebCrypto) a klíč se uloží do localStorage.
  // ------------------------------------------------------------------
  // Řady: stálé (Populární – co sleduje internet) + promíchané (shuffle:
  // náhodná startovní stránka 0..N-1 → při každém otevření jiné filmy).
  // RELEASED = jen filmy, které už vyšly mimo kino (digitálně/na disku
  // kdekoli na světě = existuje WEBRip/stream), nic jen z kin.
  // @today / @today-N = dnešní datum / před N dny.
  // wide = postery na šířku (backdrop), karta zabere dvě místa.
  var RELEASED = '&with_release_type=4%7C5&release_date.lte=@today';
  var NO_HORROR = '&without_genres=27';
  var FAMILY_GENRES = '10751%7C16%7C14%7C878%7C12'; // rodinné|animované|fantasy|sci-fi|dobrodružné
  // Skupiny po RECO_GROUP_SIZE řadách, v každé stejný rytmus:
  //   2× běžná · zvýrazněná (boxed) · 2× běžná · na šířku (wide) · 2× běžná
  // boxed: true = červený blok, 'yellow' = žlutý (2. skupina se tím odliší)
  // Na šířku jsou stálé řady (bez/s malým shuffle), ať se „velké"
  // zobrazení nemění pořád.
  var RECO_ROWS = [
    // ----- skupina 1 -----
    { title: 'Rodinné', path: '/discover/movie', params: RELEASED + '&with_genres=10751&sort_by=popularity.desc&vote_count.gte=100', shuffle: 5 },
    { title: 'Animované', path: '/discover/movie', params: RELEASED + '&with_genres=16&sort_by=popularity.desc&vote_count.gte=100', shuffle: 5 },
    { title: 'Nově ke zhlédnutí', path: '/discover/movie', params: '&with_release_type=4%7C5&release_date.gte=@today-120&release_date.lte=@today&sort_by=popularity.desc&vote_count.gte=30', boxed: true },
    { title: 'Náhodný tip', path: '/discover/movie', params: RELEASED + NO_HORROR + '&with_genres=' + FAMILY_GENRES + '&primary_release_date.gte=1990-01-01&sort_by=popularity.desc&vote_average.gte=7&vote_count.gte=500', shuffle: 40 },
    { title: 'Fantasy', path: '/discover/movie', params: RELEASED + NO_HORROR + '&with_genres=14&sort_by=popularity.desc&vote_count.gte=100', shuffle: 8 },
    { title: 'Populární', path: '/discover/movie', params: '&with_release_type=4%7C5&primary_release_date.lte=@today-150&sort_by=popularity.desc&vote_count.gte=500', wide: true },
    { title: 'Komedie', path: '/discover/movie', params: RELEASED + '&with_genres=35&sort_by=popularity.desc&vote_count.gte=100', shuffle: 10 },
    { title: 'Dobrodružné', path: '/discover/movie', params: RELEASED + NO_HORROR + '&with_genres=12&sort_by=popularity.desc&vote_count.gte=100', shuffle: 8 },
    // ----- skupina 2 -----
    { title: 'Skryté klenoty', path: '/discover/movie', params: '&with_genres=' + FAMILY_GENRES + '&without_genres=27%2C53&primary_release_date.gte=2000-01-01&primary_release_date.lte=@today-365&sort_by=popularity.desc&vote_average.gte=7.2&vote_count.gte=300&vote_count.lte=3000', shuffle: 15 },
    { title: 'Rodinné komedie', path: '/discover/movie', params: RELEASED + '&with_genres=10751%2C35&sort_by=popularity.desc&vote_count.gte=100', shuffle: 8 },
    { title: 'Novinky pro celou rodinu', path: '/discover/movie', params: '&with_genres=10751%7C16&with_release_type=4%7C5&release_date.gte=@today-365&release_date.lte=@today&sort_by=popularity.desc&vote_count.gte=30', boxed: 'yellow' },
    { title: 'Rodinná klasika (1990–2010)', path: '/discover/movie', params: '&with_genres=10751&primary_release_date.gte=1990-01-01&primary_release_date.lte=2010-12-31&sort_by=popularity.desc&vote_count.gte=1000', shuffle: 10 },
    { title: 'České filmy a pohádky', path: '/discover/movie', params: '&with_original_language=cs&with_genres=10751%7C14%7C16%7C35&sort_by=popularity.desc&vote_count.gte=20', shuffle: 3 },
    { title: 'Vysoce hodnocené', path: '/discover/movie', params: '&primary_release_date.gte=1990-01-01&sort_by=vote_average.desc&vote_count.gte=3000', shuffle: 3, wide: true },
    { title: 'Sci-Fi', path: '/discover/movie', params: RELEASED + NO_HORROR + '&with_genres=878&sort_by=popularity.desc&vote_count.gte=100', shuffle: 8 },
    { title: 'Akční', path: '/discover/movie', params: RELEASED + '&with_genres=28&sort_by=popularity.desc&vote_count.gte=100', shuffle: 10 },
  ];
  var RECO_GROUP_SIZE = 8;

  function getTmdbKey() {
    try { return localStorage.getItem(TMDB_LS_KEY); } catch (e) { return null; }
  }

  // ----- poslední pozice v doporučeních -----
  // Po výběru posteru se hledaná stránka načítá celá znovu, takže BACK
  // zahodí stav doporučení. Pozice (skupina/řada/karta + náhodné starty
  // promíchaných řad) se proto ukládá do localStorage a při návratu na
  // stránku se doporučení samo otevře na stejném místě.
  var RECO_POS_KEY = 'tizenprehrajto.recoPos';
  var RECO_POS_TTL = 6 * 60 * 60 * 1000;

  function saveRecoPos(card) {
    var strip = card.parentElement;
    var rowEl = card.closest('.pt-reco-row');
    var groupEl = card.closest('.pt-reco-group');
    var rows = document.getElementById('pt-reco-rows');
    if (!strip || !rowEl || !groupEl || !rows) return;
    var bases = [];
    for (var i = 0; i < recoState.length; i++) bases.push(recoState[i].base);
    try {
      localStorage.setItem(RECO_POS_KEY, JSON.stringify({
        g: Array.prototype.indexOf.call(rows.children, groupEl),
        r: Array.prototype.indexOf.call(groupEl.children, rowEl),
        c: Array.prototype.indexOf.call(strip.children, card),
        bases: bases,
        t: Date.now(),
      }));
    } catch (e) {}
  }

  function readRecoPos() {
    try {
      var pos = JSON.parse(localStorage.getItem(RECO_POS_KEY));
      if (!pos || typeof pos.g !== 'number' || typeof pos.r !== 'number' ||
          typeof pos.c !== 'number' || Date.now() - (pos.t || 0) > RECO_POS_TTL) return null;
      return pos;
    } catch (e) { return null; }
  }

  // stránka načtená přes Zpět/Vpřed (náš BACK volá history.back())
  function isBackNavigation() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type) return nav.type === 'back_forward';
    } catch (e) {}
    try { return !!(performance.navigation && performance.navigation.type === 2); } catch (e2) { return false; }
  }

  function clearRecoPos() {
    try { localStorage.removeItem(RECO_POS_KEY); } catch (e) {}
  }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Rozšifrování klíče heslem – PBKDF2-SHA256 + AES-256-GCM, blob je
  // salt(16) + iv(12) + ciphertext + tag. Špatné heslo = reject (GCM).
  function decryptTmdbKey(password) {
    if (!TMDB_ENC) return Promise.reject(new Error('missing blob'));
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('no webcrypto'));
    var data = b64ToBytes(TMDB_ENC);
    var salt = data.slice(0, 16);
    var iv = data.slice(16, 28);
    var ct = data.slice(28);
    return subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: TMDB_PBKDF2_ITERATIONS, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
        );
      })
      .then(function (key) { return subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct); })
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }

  function tmdbFetch(row, page) {
    var params = row.params.replace(/@today(-(\d+))?/g, function (m, g, days) {
      var d = new Date(Date.now() - (days ? parseInt(days, 10) : 0) * 86400000);
      return d.toISOString().slice(0, 10);
    });
    var url = 'https://api.themoviedb.org/3' + row.path +
      '?api_key=' + encodeURIComponent(getTmdbKey() || '') +
      '&language=cs-CZ&include_adult=false&page=' + page + params;
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('TMDB ' + res.status);
      return res.json();
    });
  }

  function recoContainer() {
    var el = document.getElementById('pt-reco');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pt-reco';
    var main = document.querySelector('main') || document.body;
    main.appendChild(el);
    return el;
  }

  function recoSwitchEl() {
    var row = document.querySelector('.pt-switch-row');
    return row ? row.querySelector('.pt-reco-switch') : null;
  }

  function openReco(restore) {
    document.body.classList.add('pt-reco');
    var sw = recoSwitchEl();
    var row = document.querySelector('.pt-switch-row');
    if (sw) sw.classList.add('pt-switch--active');
    // původně aktivní stránka (span) jde v režimu doporučení fokusovat
    // a potvrzením se na ni lze vrátit
    if (row) {
      var orig = row.querySelector('span.pt-switch--active:not(.pt-reco-switch)');
      if (orig) {
        orig.classList.remove('pt-switch--active');
        orig.classList.add('pt-reco-return');
        orig.setAttribute('tabindex', '0');
        if (!orig.__ptReturn) {
          orig.__ptReturn = true;
          orig.addEventListener('click', function () { closeReco(); });
        }
      }
    }
    var box = recoContainer();
    loadFavorites();
    loadTrending();
    if (getTmdbKey()) {
      buildRecoRows(box, restore);
    } else {
      showRecoGate(box);
    }
  }

  function closeReco() {
    clearRecoPos();
    document.body.classList.remove('pt-reco');
    hideRecoBackdrop();
    var sw = recoSwitchEl();
    if (sw) sw.classList.remove('pt-switch--active');
    var orig = document.querySelector('.pt-switch-row .pt-reco-return');
    if (orig) {
      orig.classList.add('pt-switch--active');
      orig.classList.remove('pt-reco-return');
      orig.removeAttribute('tabindex');
    }
    // zpět na oblíbené = jako vstup na stránku: fokus na první video
    focusEl(firstVideoLink() || sw);
  }

  // ----- heslová brána -----
  function showRecoGate(box) {
    var gate = document.getElementById('pt-reco-gate');
    if (gate) {
      focusEl(gate.querySelector('input'));
      return;
    }
    gate = document.createElement('form');
    gate.id = 'pt-reco-gate';
    var label = document.createElement('p');
    label.textContent = 'Zadej heslo pro odemčení doporučení';
    var input = document.createElement('input');
    input.type = 'password';
    input.id = 'pt-reco-pass';
    input.autocomplete = 'off';
    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = 'Odemknout';
    var err = document.createElement('p');
    err.className = 'pt-reco-err';
    gate.appendChild(label);
    gate.appendChild(input);
    gate.appendChild(btn);
    gate.appendChild(err);
    gate.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.textContent = '';
      btn.disabled = true;
      decryptTmdbKey(input.value)
        .then(function (key) {
          try { localStorage.setItem(TMDB_LS_KEY, key); } catch (e) {}
          gate.parentElement.removeChild(gate);
          buildRecoRows(recoContainer());
        })
        .catch(function () {
          btn.disabled = false;
          err.textContent = 'Špatné heslo, zkus to znovu.';
          input.value = '';
          focusEl(input);
        });
    });
    box.appendChild(gate);
    focusEl(input);
  }

  // ----- řady filmů -----
  var recoState = []; // {cfg, page, base, totalPages, loading, seen, strip}
  var recoGroups = []; // {el, states, loaded} – poloviny řad kvůli výkonu
  var recoGroupIndex = 0;

  function buildRecoRows(box, restore) {
    var rows = document.getElementById('pt-reco-rows');
    if (rows) {
      // opakované otevření (manuální klik) – vždy nahoru na první kartu
      smoothScrollWindowTo(0, true);
      activateRecoGroup(0, false);
      return;
    }
    rows = document.createElement('div');
    rows.id = 'pt-reco-rows';
    box.appendChild(rows);
    recoState = [];
    recoGroups = [];
    recoGroupIndex = 0;
    // řady rozdělené do skupin po RECO_GROUP_SIZE – zobrazená a načtená
    // je vždy jen jedna, mezi nimi se přechází šipkou dolů/nahoru na
    // kraji skupiny (další skupina se načte až při prvním zobrazení)
    var half = RECO_GROUP_SIZE;
    for (var g = 0; g * half < RECO_ROWS.length; g++) {
      var groupEl = document.createElement('div');
      groupEl.className = 'pt-reco-group' + (g ? ' pt-reco-group--hidden' : '');
      rows.appendChild(groupEl);
      var group = { el: groupEl, states: [], loaded: g === 0 };
      recoGroups.push(group);
      var slice = RECO_ROWS.slice(g * half, (g + 1) * half);
      for (var i = 0; i < slice.length; i++) {
        var cfg = slice[i];
        var rowEl = document.createElement('div');
        rowEl.className = 'pt-reco-row' + (cfg.boxed ? ' pt-reco-row--boxed' : '') +
          (cfg.boxed === 'yellow' ? ' pt-reco-row--yellow' : '') +
          (cfg.wide ? ' pt-reco-row--wide' : '');
        var h = document.createElement('h2');
        h.className = 'pt-reco-row-title';
        h.textContent = cfg.title;
        var strip = document.createElement('div');
        strip.className = 'pt-reco-strip';
        addRecoSkeletons(strip, cfg.wide);
        rowEl.appendChild(h);
        rowEl.appendChild(strip);
        groupEl.appendChild(rowEl);
        var globalIdx = g * half + i;
        // při obnově pozice stejné náhodné starty jako před odchodem,
        // jinak náhodný start pro "promíchané" řady – pokaždé jiné filmy
        var base = restore && restore.bases && typeof restore.bases[globalIdx] === 'number'
          ? restore.bases[globalIdx]
          : (cfg.shuffle ? Math.floor(Math.random() * cfg.shuffle) : 0);
        var state = {
          cfg: cfg,
          page: 0,
          base: base,
          totalPages: 1,
          loading: false,
          seen: {},
          strip: strip,
          focusFirst: !restore && g === 0 && i === 0,
        };
        recoState.push(state);
        group.states.push(state);
        if (g === 0) loadRecoPage(state);
      }
    }
    if (restore) {
      if (restore.g > 0) showRecoGroup(restore.g);
      restoreRecoFocus(restore);
    }
  }

  // přepnutí viditelné poloviny řad (bez fokusu) + líné donačtení
  function showRecoGroup(idx) {
    var group = recoGroups[idx];
    if (!group) return;
    for (var i = 0; i < recoGroups.length; i++) {
      recoGroups[i].el.className = 'pt-reco-group' + (i === idx ? '' : ' pt-reco-group--hidden');
    }
    recoGroupIndex = idx;
    if (!group.loaded) {
      group.loaded = true;
      for (var j = 0; j < group.states.length; j++) loadRecoPage(group.states[j]);
    }
  }

  function activateRecoGroup(idx, focusLast) {
    var group = recoGroups[idx];
    if (!group) return;
    if (!group.loaded) group.states[0].focusFirst = true; // fokus až po donačtení karet
    showRecoGroup(idx);
    var rowsIn = group.el.querySelectorAll('.pt-reco-row');
    var row = rowsIn[focusLast ? rowsIn.length - 1 : 0];
    var cardEl = row ? row.querySelector('.pt-reco-card') : null;
    if (cardEl) {
      focusEl(cardEl);
      scrollWindowToCard(cardEl, !document.body.classList.contains('pt-ready'));
    }
  }

  // po návratu z hledání počkat, až se uložená karta donačte (včetně
  // dalších stránek řady), a fokusovat ji
  var recoRestoring = false;

  function restoreRecoFocus(pos) {
    var group = recoGroups[pos.g] || recoGroups[0];
    if (!group) return;
    var state = group.states[pos.r] || group.states[0];
    if (!state) return;
    recoRestoring = true;
    var tries = 0;
    var timer = setInterval(function () {
      var cards = state.strip.querySelectorAll('.pt-reco-card');
      var found = cards.length > pos.c;
      var exhausted = !state.loading && state.page > 0 &&
        state.base + state.page >= state.totalPages;
      if (found || exhausted || ++tries > 80) {
        clearInterval(timer);
        recoRestoring = false;
        var card = found ? cards[pos.c] : cards[cards.length - 1];
        if (!card) return;
        // stránka je při obnově ještě schovaná – posun bez animace
        focusEl(card, true);
        scrollStripToCard(state.strip, card, true);
        scrollWindowToCard(card, true);
      } else if (!state.loading) {
        loadRecoPage(state);
      }
    }, 250);
  }

  // Skeleton karty – drží výšku řady (a rozložení stránky), než dorazí
  // odpověď z TMDB; rozměry jako skutečné karty. Nejsou to .pt-reco-card,
  // takže je navigace ignoruje.
  var RECO_SKELETONS = 9;
  var RECO_SKELETONS_WIDE = 5;

  function addRecoSkeletons(strip, wide) {
    var n = wide ? RECO_SKELETONS_WIDE : RECO_SKELETONS;
    for (var i = 0; i < n; i++) {
      var sk = document.createElement('div');
      sk.className = 'pt-reco-skel' + (wide ? ' pt-reco-skel--wide' : '');
      sk.innerHTML = '<span class="pt-reco-skel-img"></span>' +
        '<span class="pt-reco-skel-line"></span>' +
        '<span class="pt-reco-skel-line pt-reco-skel-line--short"></span>';
      strip.appendChild(sk);
    }
  }

  function removeRecoSkeletons(strip) {
    var sk = strip.querySelectorAll('.pt-reco-skel');
    for (var i = 0; i < sk.length; i++) strip.removeChild(sk[i]);
  }

  function loadRecoPage(state) {
    // první načtení projde vždy (totalPages se zjistí až z odpovědi)
    if (state.loading || (state.page > 0 && state.base + state.page >= state.totalPages)) return;
    state.loading = true;
    var wanted = state.base + state.page + 1;
    tmdbFetch(state.cfg, wanted)
      .then(function (data) {
        state.loading = false;
        state.totalPages = Math.min(data.total_pages || 1, 500);
        var list = data.results || [];
        // náhodný start ukázal za konec výsledků – začít od první stránky
        if (!state.page && state.base && (state.base >= state.totalPages || !list.length)) {
          state.base = 0;
          loadRecoPage(state);
          return;
        }
        state.page = wanted - state.base;
        removeRecoSkeletons(state.strip);
        var wide = !!state.cfg.wide;
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (!m.poster_path || (wide && !m.backdrop_path) || state.seen[m.id]) continue;
          state.seen[m.id] = true;
          state.strip.appendChild(makeRecoCard(m, wide));
        }
        if (state.focusFirst) {
          state.focusFirst = false;
          var first = state.strip.querySelector('.pt-reco-card');
          if (first && document.body.classList.contains('pt-reco') &&
              !document.getElementById('pt-reco-gate')) {
            focusEl(first);
            scrollWindowToCard(first, !document.body.classList.contains('pt-ready'));
          }
        }
      })
      .catch(function () {
        state.loading = false;
        removeRecoSkeletons(state.strip);
        if (!state.strip.firstChild) {
          var err = document.createElement('p');
          err.className = 'pt-reco-err';
          err.textContent = 'Nepodařilo se načíst (zkontroluj klíč/síť).';
          state.strip.appendChild(err);
        }
      });
  }

  function makeRecoCard(movie, wide) {
    var title = movie.title || movie.name || '';
    var card = document.createElement('a');
    card.className = 'pt-reco-card' + (wide ? ' pt-reco-card--wide' : '');
    card.href = '/hledej/' + encodeURIComponent(title);
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.src = wide
      ? 'https://image.tmdb.org/t/p/w780' + movie.backdrop_path
      : 'https://image.tmdb.org/t/p/w342' + movie.poster_path;
    img.alt = '';
    // obal obrázku – drží badge (pozicované vůči posteru, ne celé kartě)
    var poster = document.createElement('span');
    poster.className = 'pt-reco-poster';
    poster.appendChild(img);
    var t = document.createElement('span');
    t.className = 'pt-reco-title';
    t.textContent = title;
    // srdíčko „v oblíbených" – vlevo dole, vidět jen při fokusu/hoveru
    var heart = document.createElement('span');
    heart.className = 'pt-reco-fav';
    heart.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">' +
      '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09' +
      'C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    poster.appendChild(heart);
    card.appendChild(poster);
    card.appendChild(t);
    var year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    card.__ptMovie = {
      id: movie.id, title: title, orig: movie.original_title || '', year: year,
      vote: typeof movie.vote_average === 'number' ? movie.vote_average : 0,
    };
    markFavoriteCard(card);
    if (year) {
      var y = document.createElement('span');
      y.className = 'pt-reco-year';
      y.textContent = year;
      card.appendChild(y);
    }
    if (typeof movie.vote_average === 'number' && movie.vote_average > 0) {
      var r = document.createElement('span');
      r.className = 'pt-reco-rating';
      r.textContent = '\u2605 ' + movie.vote_average.toFixed(1);
      card.appendChild(r);
    }
    var backdropUrl = movie.backdrop_path
      ? 'https://image.tmdb.org/t/p/w1280' + movie.backdrop_path
      : 'https://image.tmdb.org/t/p/w780' + movie.poster_path;
    card.addEventListener('focus', function () {
      showRecoBackdrop(backdropUrl);
      prioritizeAvailability(card);
      // po 300 ms na kartě (ne při rychlém projíždění) čerstvý check
      clearTimeout(card.__ptDwell);
      card.__ptDwell = setTimeout(function () { refreshAvailability(card); }, AVAIL_DWELL_MS);
    });
    card.addEventListener('blur', function () { clearTimeout(card.__ptDwell); });
    // dostupnost: z cache hned, letošní filmy navíc do fronty na pozadí
    trackAvailability(card);
    card.addEventListener('click', function (ev) {
      ev.preventDefault();
      saveRecoPos(card);
      saveSearchContext(card.__ptMovie);
      searchRecoTitle(title);
    });
    return card;
  }

  // ----- badge na posteru -----
  // Obecná infrastruktura pro štítky na posteru. Sloty:
  //   'ribbon'      – šikmá páska přes levý horní roh (jen jedna)
  //   ostatní slot  – štítek („pill") vlevo dole (~10 % od spodu); víc
  //                   štítků se skládá nad sebe, pořadí dle PILL_ORDER
  // kind = barva/druh (např. 'red', 'yellow'), text null = badge pryč.
  var PILL_ORDER = ['reco', 'new'];

  function setCardBadge(card, slot, text, kind) {
    var poster = card.querySelector('.pt-reco-poster');
    if (!poster) return;
    var parent = poster;
    if (slot !== 'ribbon') {
      parent = poster.querySelector('.pt-reco-pills');
      if (!parent) {
        if (!text) return;
        parent = document.createElement('span');
        parent.className = 'pt-reco-pills';
        poster.appendChild(parent);
      }
    }
    var badge = parent.querySelector('.pt-reco-badge--' + slot);
    if (!text) {
      if (badge) parent.removeChild(badge);
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.__ptOrder = PILL_ORDER.indexOf(slot);
      var before = null;
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i].__ptOrder > badge.__ptOrder) { before = parent.children[i]; break; }
      }
      parent.insertBefore(badge, before);
    }
    badge.className = 'pt-reco-badge' + (slot === 'ribbon' ? '' : ' pt-reco-badge--pill') +
      ' pt-reco-badge--' + slot + (kind ? ' pt-reco-badge--' + kind : '');
    badge.textContent = text;
  }

  // ----- výsledky hledání na prehrajto -----
  // Stáhne a rozparsuje stránku /hledej/<dotaz> (stejný origin) →
  // [{title, href}]. Základ pro badge dostupnosti i další funkce.
  function fetchSearchResults(query) {
    return fetch('/hledej/' + encodeURIComponent(query), { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 429) {
          var tooMany = new Error('search 429');
          tooMany.blocked = true;
          tooMany.status = 429;
          throw tooMany;
        }
        if (!res.ok) throw new Error('search ' + res.status);
        return res.text();
      })
      .then(function (html) {
        // Skutečně prázdné hledání má kontejner výsledků (jen bez videí).
        // Stránka úplně bez něj = web hledání omezil (příliš mnoho
        // dotazů) – to není „nedostupné", výsledek se nesmí uložit.
        if (html.indexOf('snippet-videoListing-videoListingWrapper') === -1) {
          var err = new Error('search blocked');
          err.blocked = true;
          throw err;
        }
        return parseSearchResults(html);
      });
  }

  // Parsuje se textově (regex), ne přes DOMParser – stránka hledání má
  // ~300–400 kB a na TV by stavění celého DOMu kvůli pár názvům bylo
  // zbytečně drahé.
  function decodeEntities(str) {
    return str
      .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(parseInt(n, 10)); })
      .replace(/&#x([0-9a-f]+);/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); })
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }

  function parseSearchResults(html) {
    var at = html.indexOf('snippet-videoListing-videoListingWrapper');
    var part = at >= 0 ? html.slice(at) : html;
    var linkRe = /<a\s[^>]*class="[^"]*\bvideo--link\b[^"]*"[^>]*>/g;
    var hits = [];
    var m;
    while ((m = linkRe.exec(part))) hits.push({ tag: m[0], index: m.index });
    var items = [];
    for (var i = 0; i < hits.length; i++) {
      // nadpis hledat jen v úseku do dalšího odkazu
      var chunk = part.slice(hits[i].index, i + 1 < hits.length ? hits[i + 1].index : hits[i].index + 4000);
      var h = chunk.match(/class="[^"]*\bvideo__title\b[^"]*"[^>]*>([^<]*)/);
      var attrTitle = (hits[i].tag.match(/\stitle="([^"]*)"/) || [])[1] || '';
      var href = (hits[i].tag.match(/\shref="([^"]*)"/) || [])[1] || '';
      items.push({
        title: decodeEntities(h && h[1].trim() ? h[1] : attrTitle).replace(/\s+/g, ' ').trim(),
        href: decodeEntities(href),
        duration: parseDuration(chunk),
        rating: parseRating(chunk),
      });
    }
    return items;
  }

  // délka videa v sekundách ze štítku "01:32:46" / "45:10"; null = neznámá
  function parseDuration(chunk) {
    var m = chunk.match(/video__tag--time[^>]*>\s*([0-9:]+)\s*</);
    if (!m) return null;
    var parts = m[1].split(':');
    var sec = 0;
    for (var i = 0; i < parts.length; i++) sec = sec * 60 + (parseInt(parts[i], 10) || 0);
    return sec;
  }

  // hodnocení videa (lajky, záporné = převaha dislike); bez štítku 0.
  // Záporná podoba štítku zatím nebyla vidět (anonymně se neukazuje),
  // proto se bere číslo se znaménkem a „dislike" v bloku jako záporné.
  function parseRating(chunk) {
    var at = chunk.indexOf('video__tag--likes');
    if (at === -1) return 0;
    var end = chunk.indexOf('video__tag--size', at);
    if (end === -1) end = chunk.indexOf('video__play', at);
    var block = chunk.slice(at, end === -1 ? at + 1500 : end);
    var text = block.replace(/<[^>]*>/g, ' ');
    var m = text.match(/[-\u2212]?\s*\d+/);
    if (!m) return 0;
    var n = parseInt(m[0].replace(/[\s\u2212]/g, function (c) { return c === '\u2212' ? '-' : ''; }), 10) || 0;
    if (n > 0 && /dislike/i.test(block)) n = -n;
    return n;
  }

  // ----- limiter dotazů na prehrajto -----
  // Naměřeno (11/2026): přihlášenému web povolí ~29 dotazů za klouzavých
  // 60 s, nepřihlášenému jen ~5; další dostanou 429 (stránka bez
  // výsledků) a do limitu se nepočítají. Mod na TV je vždy přihlášený
  // (oblíbená jinak nejdou) – limit 20/min nechává rezervu pro web.
  // Všechny dotazy modu proto jdou přes jeden limiter:
  //   max. scrapePerMin() úspěšných za SCRAPE_WINDOW (přihlášený 20,
  //     2 najednou; nepřihlášený 5, 1 najednou)
  //   třídy: 'user' (fokusovaná karta) smí celý limit, 'bg' (fronta na
  //     pozadí) jen limit − scrapeReserve() (4, resp. 2), 'idle' (další stránky
  //     oblíbených) jen když je pozadí prázdné – na to, na co se uživatel
  //     dívá, tak slot zbyde vždy
  //   429: odmítnutý dotaz se z okna vyřadí, pauza od SCRAPE_MIN_PAUSE
  //     (zdvojuje se při dalších 429 za sebou, max. 60 s)
  // window.__PT_SCRAPE__ = {perMin, reserve, pause, concurrency, window}
  // jen pro testy; localStorage 'tizenprehrajto.debug' = '1' → log do konzole.
  var SCRAPE_CFG = window.__PT_SCRAPE__ || {};
  var SCRAPE_LIMIT_USER = 20; // přihlášený (naměřeno ~29)
  var SCRAPE_LIMIT_ANON = 5; // nepřihlášený (naměřeno ~5)
  var scrapeLoggedIn = null;

  // přihlášený = otevřená oblíbená (jinak web přesměruje) nebo v hlavičce
  // chybí odkaz na přihlášení; zjišťuje se až s hotovým DOM
  function isLoggedIn() {
    if (scrapeLoggedIn !== null) return scrapeLoggedIn;
    if (!document.body) return false;
    scrapeLoggedIn = location.pathname.indexOf('/oblibena-videa') === 0 ||
      !document.querySelector('a[href="#login"]');
    return scrapeLoggedIn;
  }

  function scrapePerMin() {
    return SCRAPE_CFG.perMin || (isLoggedIn() ? SCRAPE_LIMIT_USER : SCRAPE_LIMIT_ANON);
  }

  function scrapeReserve() {
    if (typeof SCRAPE_CFG.reserve === 'number') return SCRAPE_CFG.reserve;
    return scrapePerMin() >= 10 ? 4 : 2;
  }

  function scrapeConcurrency() {
    return SCRAPE_CFG.concurrency || (isLoggedIn() ? 2 : 1);
  }
  var SCRAPE_WINDOW = SCRAPE_CFG.window || 60 * 1000;
  var SCRAPE_MIN_PAUSE = SCRAPE_CFG.pause || 10 * 1000;
  var SCRAPE_MAX_PAUSE = 60 * 1000;
  var scrapeTimes = []; // starty dotazů, které se počítají do okna
  var scrapeActive = 0;
  var scrapeWaiters = { user: [], bg: [], idle: [] };
  var scrapeBlockedUntil = 0;
  var scrapeStreak = 0; // 429 za sebou
  var scrapeTimer = null;
  var scrapeDebug = false;
  try { scrapeDebug = localStorage.getItem('tizenprehrajto.debug') === '1'; } catch (e) {}

  function scrapeLog() {
    if (!scrapeDebug || !window.console) return;
    var args = ['[pt-scrape]'];
    for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
    args.push('| okno=' + scrapeTimes.length + ' čeká user/bg/idle=' + scrapeWaiters.user.length + '/' +
      scrapeWaiters.bg.length + '/' + scrapeWaiters.idle.length);
    console.log.apply(console, args);
  }

  function scrapeTrim() {
    var now = Date.now();
    while (scrapeTimes.length && now - scrapeTimes[0] >= SCRAPE_WINDOW) scrapeTimes.shift();
  }

  // 429 na dotaz spuštěný v čase startedAt
  function scrapeBlock(startedAt) {
    var i = scrapeTimes.indexOf(startedAt);
    if (i !== -1) scrapeTimes.splice(i, 1); // web ho nepočítá
    scrapeStreak++;
    var pause = Math.min(SCRAPE_MAX_PAUSE, SCRAPE_MIN_PAUSE * Math.pow(2, scrapeStreak - 1));
    scrapeBlockedUntil = Date.now() + pause;
    scrapeLog('429 → pauza', pause + ' ms');
  }

  // za kolik ms smí třída kind spustit dotaz (0 = hned)
  function scrapeWaitFor(kind) {
    scrapeTrim();
    var now = Date.now();
    var wait = Math.max(0, scrapeBlockedUntil - now);
    var perMin = scrapePerMin();
    var limit = kind === 'user' ? perMin : Math.max(1, perMin - scrapeReserve());
    if (scrapeTimes.length >= limit) {
      wait = Math.max(wait, scrapeTimes[scrapeTimes.length - limit] + SCRAPE_WINDOW - now);
    }
    return wait;
  }

  // cb(done) se zavolá, až je slot; done(status) po dokončení dotazu
  // (status 429 = odmítnuto limitem webu)
  function scrapeAcquire(cb, kind) {
    scrapeWaiters[kind || 'bg'].push(cb);
    scrapeDrain();
  }

  function scrapeDrain() {
    clearTimeout(scrapeTimer);
    var minWait = Infinity;
    var kinds = ['user', 'bg', 'idle'];
    while (scrapeActive < scrapeConcurrency()) {
      var kind = null;
      for (var k = 0; k < kinds.length; k++) {
        var list = scrapeWaiters[kinds[k]];
        if (!list.length) continue;
        // nečinnostní dotazy jen když pozadí nic nechce
        if (kinds[k] === 'idle' && (scrapeWaiters.bg.length || availQueue.length || availLowQueue.length)) continue;
        var w = scrapeWaitFor(kinds[k] === 'user' ? 'user' : 'bg');
        if (w === 0) { kind = kinds[k]; break; }
        if (w < minWait) minWait = w;
      }
      if (!kind) break;
      var cb = scrapeWaiters[kind].shift();
      scrapeActive++;
      var started = Date.now();
      scrapeTimes.push(started);
      scrapeLog('dotaz', kind);
      (function (started) {
        var finished = false;
        cb(function (status) {
          if (finished) return;
          finished = true;
          scrapeActive--;
          if (status === 429) scrapeBlock(started);
          else if (status) scrapeStreak = 0;
          scrapeDrain();
        });
      })(started);
    }
    if (minWait < Infinity) scrapeTimer = setTimeout(scrapeDrain, minWait + 50);
  }

  // ----- dostupnost a dabing -----
  // Z výsledků hledání se vyberou použitelné verze filmu (rok/název,
  // délka ≥ 40 min, ne záporné hodnocení) a u nich se pozná český dabing.
  //   výsledky se ukládají natrvalo a ukazují se hned z cache
  //   letošní filmy: chybějící výsledek → fronta na pozadí hned po
  //     vykreslení; výsledek starší než den → obnova jen při volné frontě
  //   starší filmy: zjišťují se jen po AVAIL_DWELL_MS fokusu
  //   fokus ≥ 300 ms: check na začátek fronty, pokud výsledek chybí nebo
  //     je starší než 30 min
  //   vše jde přes limiter dotazů (viz výše)
  // Badge: 0 verzí → páska „Nedostupné" (červená), verze bez CZ dabingu →
  // páska „Bez dabingu" (tmavá, nenápadná), letošní s 1–3 verzemi → „Novinka",
  // trend týdne + hodnocení ≥ 7 + CZ dabing → „Doporučené" (žlutá).
  var AVAIL_FEW = 3;
  var AVAIL_CACHE_KEY = 'tizenprehrajto.avail5'; // v5: nejdřív relevantní verze, pak dabing
  var AVAIL_STALE_NEW = 24 * 60 * 60 * 1000; // letošní starší než den → obnova na pozadí, když je fronta volná
  var AVAIL_REFRESH = 30 * 60 * 1000; // fokus ≥ 300 ms obnoví výsledek starší než 30 min
  var AVAIL_DWELL_MS = 300;
  var AVAIL_MAX_ENTRIES = 4000;
  var AVAIL_RETRY_DELAY = 60 * 1000; // síťová chyba → znovu za minutu
  var AVAIL_MAX_RETRIES = 5;
  var AVAIL_MAX_BLOCKS = 5; // opakování po 429/omezení na jeden titul
  var AVAIL_ZERO_RECHECK = (window.__PT_SCRAPE__ && window.__PT_SCRAPE__.zeroRecheck) || 30 * 1000;
  var AVAIL_START_DELAY = 1000;
  var AVAIL_MIN_DURATION = 40 * 60;
  var RECO_MIN_VOTE = 7;
  var availMem = null;
  var availJobs = {}; // key -> {movie, cards}
  var availQueue = []; // klíče čekající na fetch (fokus na začátek)
  var availLowQueue = []; // obnova starých letošních výsledků – jen když je availQueue prázdná
  var availWaitingUser = false; // čeká fronta na slot limiteru (fokus)?
  var availWaitingBg = false; // … (pozadí)?
  var availReady = false;
  var availStartTimer = null;

  function currentYear() { return String(new Date().getFullYear()); }

  function availKey(m) { return m.year + '|' + m.title; }

  function availLoad() {
    if (availMem) return availMem;
    try { availMem = JSON.parse(localStorage.getItem(AVAIL_CACHE_KEY)) || {}; } catch (e) { availMem = {}; }
    return availMem;
  }

  // uložený výsledek platí natrvalo (aktuálnost řeší obnova při fokusu
  // a obnova letošních na pozadí)
  function availCacheGet(m) {
    return availLoad()[availKey(m)] || null;
  }

  function availCacheSet(m, res) {
    var map = availLoad();
    var e = { n: res.n, d: res.d, t: Date.now() };
    map[availKey(m)] = e;
    var keys = Object.keys(map);
    if (keys.length > AVAIL_MAX_ENTRIES) {
      keys.sort(function (a, b) { return map[a].t - map[b].t; });
      for (var i = 0; i < keys.length - AVAIL_MAX_ENTRIES; i++) delete map[keys[i]];
    }
    try { localStorage.setItem(AVAIL_CACHE_KEY, JSON.stringify(map)); } catch (err) {}
    return e;
  }

  // Normalizovaný název pro rozpoznání jazyka: slepené značky rozdělí
  // („cztit" → „cz tit", „SKdab" → „sk dab", „CZtitulky", „ENsub"…),
  // jinak by „Buddy (2026) … cztit.mp4" nevypadalo jako titulky.
  function langNorm(title) {
    return normTitle(title).replace(/ (cz|cs|cze|sk|svk|en|eng)(tit|titl|titulky|titulkami|sub|subs|dab|dabing|dub) /g, ' $1 $2 ')
      .replace(/ (cz|cs|cze|sk|svk|en|eng)(tit|titl|titulky|titulkami|sub|subs|dab|dabing|dub) /g, ' $1 $2 ');
  }

  // Český dabing podle názvu videa: zmínka o dabingu (ne jen slovenském),
  // nebo „CZ" bez titulků („Film 2008 CZ" = česky).
  function hasCzDub(title) {
    var n = langNorm(title);
    var dub = / (dab|dabing|dabingem|dabovane|dub|dubbing) /.test(n);
    var cz = / (cz|cs|cze|cesky|czech|cestina) /.test(n);
    var sk = / (sk|svk|slovensky|slovak) /.test(n);
    var tit = / (tit|titulky|titulkami|titl|sub|subs|subtitles) /.test(n);
    return (dub && (cz || !sk)) || (cz && !tit);
  }

  // Je video verzí filmu? Letošní film: rok v názvu (jinak se plete se
  // staršími filmy stejného jména). Starší film: rok v názvu, nebo název
  // filmu a žádný jiný rok.
  function isMovieVersion(item, m) {
    var re = new RegExp('(^|[^0-9])' + m.year + '([^0-9]|$)');
    if (re.test(item.title)) return true;
    if (!m.year || m.year === currentYear()) return false;
    var n = normTitle(item.title);
    if (/ (19|20)\d\d /.test(n)) return false;
    var a = normTitle(m.title);
    var b = m.orig ? normTitle(m.orig) : '';
    return (a.length > 2 && n.indexOf(a) !== -1) || (b.length > 2 && n.indexOf(b) !== -1);
  }

  function isUsableVersion(item) {
    if (item.duration !== null && item.duration !== undefined && item.duration < AVAIL_MIN_DURATION) return false;
    return !(item.rating < 0);
  }

  // Výslovně BEZ českého dabingu (vylučovací metoda – verze bez označení
  // jazyka může dabing mít, např. „Super Mario Bros. ve filmu 2023 1080p"):
  //   titulky bez zmínky o dabingu, jen slovenský dabing, nebo cizí
  //   jazyk (EN) bez CZ.
  function isNoCzDub(title) {
    var n = langNorm(title);
    var dub = / (dab|dabing|dabingem|dabovane|dub|dubbing) /.test(n);
    var cz = / (cz|cs|cze|cesky|czech|cestina) /.test(n);
    var sk = / (sk|svk|slovensky|slovak) /.test(n);
    var tit = / (tit|titulky|titulkami|titl|sub|subs|subtitles) /.test(n);
    var foreign = / (en|eng|english|orig|original) /.test(n);
    if (dub) return sk && !cz;
    return tit || (foreign && !cz);
  }

  // Začíná název videa názvem filmu (českým nebo originálním)? Odfiltruje
  // pokračování/jiné filmy s podobným jménem („Návrat na zapomenutý
  // ostrov" ≠ „Zapomenutý ostrov"); „Forgotten Island (Zapomenutý
  // ostrov)" projde přes originální název.
  function startsWithMovie(item, m) {
    var n = normTitle(item.title);
    var a = normTitle(m.title);
    var b = m.orig ? normTitle(m.orig) : '';
    return (a.length > 2 && n.indexOf(a) === 0) || (b.length > 2 && n.indexOf(b) === 0);
  }

  // Relevantní výsledek = verze tohoto filmu:
  //   letošní film: jen s jeho rokem v názvu (bez roku/jiný rok bývá
  //     starší film stejného jména)
  //   starší film: rok v názvu, nebo název videa začíná názvem filmu
  //     a rok chybí / liší se max. o 1 (CZ vs. světová premiéra)
  function isRelevantVersion(item, m) {
    if (isMovieVersion(item, m)) return true;
    if (!m.year || m.year === currentYear() || !startsWithMovie(item, m)) return false;
    var years = normTitle(item.title).match(/ (19|20)\d\d /g);
    if (!years) return true;
    for (var i = 0; i < years.length; i++) {
      if (Math.abs(parseInt(years[i], 10) - parseInt(m.year, 10)) <= 1) return true;
    }
    return false;
  }

  // → {n: počet použitelných verzí, d: z nich ty, které CZ dabing mít
  // můžou}. Nejdřív se vyfiltrují relevantní a použitelné verze (rok,
  // délka, ne dislike), teprve u nich se zjišťuje dabing: „Bez dabingu"
  // (d = 0) jen když jsou VŠECHNY výslovně bez něj.
  function evaluateVersions(items, m) {
    var res = { n: 0, d: 0 };
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!isUsableVersion(it) || !isRelevantVersion(it, m)) continue;
      res.n++;
      if (!isNoCzDub(it.title)) res.d++;
    }
    return res;
  }

  function applyAvailability(card, entry) {
    var m = card.__ptMovie;
    var ribbon = null;
    var ribbonKind = null;
    if (entry.n === 0) { ribbon = 'Nedostupné'; ribbonKind = 'red'; }
    else if (!entry.d) { ribbon = 'Bez dabingu'; ribbonKind = 'dark'; }
    // nedostupný titul je ztlumený (tmavé pozadí + opacity, viz CSS)
    card.classList.toggle('pt-reco-card--unavailable', entry.n === 0);
    setCardBadge(card, 'ribbon', ribbon, ribbonKind);
    setCardBadge(card, 'new', m.year === currentYear() && entry.n > 0 && entry.n <= AVAIL_FEW ? 'Novinka' : null, 'red');
    setCardBadge(card, 'reco', entry.d > 0 && m.vote >= RECO_MIN_VOTE && isTrending(m.id) ? 'Doporučené' : null, 'yellow');
  }

  function applyAvailabilityToAll(m, entry) {
    var key = availKey(m);
    var cards = document.querySelectorAll('.pt-reco-card');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].__ptMovie && availKey(cards[i].__ptMovie) === key) applyAvailability(cards[i], entry);
    }
  }

  function trackAvailability(card) {
    var m = card.__ptMovie;
    if (!m || !m.title || !m.year) return;
    var cached = availCacheGet(m);
    if (cached) applyAvailability(card, cached);
    // starší filmy jen po fokusu (refreshAvailability); letošní: chybějící
    // hned do fronty, den staré jen jako obnova při volné frontě
    if (m.year !== currentYear()) return;
    if (!cached) enqueueAvailability(m, 'normal');
    else if (Date.now() - cached.t >= AVAIL_STALE_NEW) enqueueAvailability(m, 'low');
  }

  // prio: 'front' (fokus) | 'normal' | 'low' (obnova, jen při volné frontě)
  function enqueueAvailability(m, prio) {
    var key = availKey(m);
    var inQ = availQueue.indexOf(key);
    var inLow = availLowQueue.indexOf(key);
    if (!availJobs[key]) availJobs[key] = { movie: m };
    if (prio === 'front') availJobs[key].user = true; // fokus → slot třídy 'user'
    if (prio === 'low') {
      if (inQ === -1 && inLow === -1) availLowQueue.push(key);
    } else {
      if (inLow !== -1) availLowQueue.splice(inLow, 1);
      if (inQ !== -1) availQueue.splice(inQ, 1);
      if (prio === 'front') availQueue.unshift(key);
      else if (inQ !== -1) availQueue.splice(inQ, 0, key);
      else availQueue.push(key);
    }
    if (!availReady && !availStartTimer) {
      // nejdřív ať se načtou postery, pak teprve fetchovat hledání
      availStartTimer = setTimeout(function () {
        availReady = true;
        pumpAvailability();
      }, AVAIL_START_DELAY);
    }
    pumpAvailability();
  }

  function prioritizeAvailability(card) {
    var m = card.__ptMovie;
    if (!m) return;
    var key = availKey(m);
    if (availQueue.indexOf(key) > 0 || availLowQueue.indexOf(key) !== -1) enqueueAvailability(m, 'front');
  }

  // fokus ≥ 300 ms: zkontrolovat, pokud výsledek chybí nebo je starší
  function refreshAvailability(card) {
    var m = card.__ptMovie;
    if (!m || !m.title || !m.year) return;
    var e = availLoad()[availKey(m)];
    if (e && Date.now() - e.t < AVAIL_REFRESH) return;
    availReady = true; // uživatel čeká na tuhle kartu – nečekat na start
    enqueueAvailability(m, 'front');
  }

  // Fronta si o slot limiteru říká zvlášť za fokus ('user') a za pozadí
  // ('bg'), vždy jen jednou; který titul půjde, se rozhodne až při
  // přidělení slotu (fokusovaná karta mezitím mohla skočit dopředu).
  function takeAvailKey(userOnly) {
    for (var i = 0; i < availQueue.length; i++) {
      var job = availJobs[availQueue[i]];
      if (!userOnly || (job && job.user)) return availQueue.splice(i, 1)[0];
    }
    return userOnly ? null : availLowQueue.shift() || null;
  }

  function hasAvailWork(user) {
    for (var i = 0; i < availQueue.length; i++) {
      var job = availJobs[availQueue[i]];
      if (!!(job && job.user) === user) return true;
    }
    return !user && availLowQueue.length > 0;
  }

  function pumpAvailability() {
    if (!availReady) return;
    if (!availWaitingUser && hasAvailWork(true)) {
      availWaitingUser = true;
      scrapeAcquire(function (done) {
        availWaitingUser = false;
        startAvailability(takeAvailKey(true) || takeAvailKey(false), done);
      }, 'user');
    }
    if (!availWaitingBg && hasAvailWork(false)) {
      availWaitingBg = true;
      scrapeAcquire(function (done) {
        availWaitingBg = false;
        startAvailability(takeAvailKey(false), done);
      }, 'bg');
    }
  }

  function startAvailability(key, done) {
    if (!key || !availJobs[key]) {
      done(0);
      pumpAvailability();
      return;
    }
    runAvailability(key, done);
    pumpAvailability();
  }

  function runAvailability(key, done) {
    var job = availJobs[key];
    var status = 200;
    scrapeLog('hledání', job.movie.title, job.user ? '(fokus)' : '');
    fetchSearchResults(job.movie.title)
      .then(function (items) {
        // Úplně prázdné hledání bývá u známých filmů omezení webu (i bez
        // 429) – neuložit hned, za AVAIL_ZERO_RECHECK ověřit znovu; až
        // druhé prázdné hledání znamená „Nedostupné".
        if (!items.length && !job.zeroChecked) {
          job.zeroChecked = true;
          scrapeLog('prázdné hledání → ověřím znovu', job.movie.title);
          setTimeout(function () {
            if (availJobs[key] && availQueue.indexOf(key) === -1 && availLowQueue.indexOf(key) === -1) {
              availQueue.push(key);
              pumpAvailability();
            }
          }, AVAIL_ZERO_RECHECK);
          return;
        }
        delete availJobs[key];
        applyAvailabilityToAll(job.movie, availCacheSet(job.movie, evaluateVersions(items, job.movie)));
      })
      .catch(function (err) {
        status = err && err.blocked ? 429 : 0;
        // chyba se nikdy neukládá jako „nedostupné"
        if (err && err.blocked) {
          // 429 / omezená stránka: pauzu řeší limiter (done(429)); po
          // AVAIL_MAX_BLOCKS pokusech se titul vzdá (jinak by titul, který
          // web vrací omezený pořád, frontu ucpal) – zkusí se při fokusu
          job.blocks = (job.blocks || 0) + 1;
          if (job.blocks > AVAIL_MAX_BLOCKS) {
            delete availJobs[key];
          } else if (err.status === 429) {
            // globální limit – titul za nic nemůže, jde hned po pauze
            availQueue.unshift(key);
          } else {
            // stránka bez výsledků může být problém konkrétního dotazu
            availQueue.push(key);
          }
          return;
        }
        // jiná chyba (síť): znovu za minutu, max. AVAIL_MAX_RETRIES×
        job.retries = (job.retries || 0) + 1;
        if (job.retries > AVAIL_MAX_RETRIES) {
          delete availJobs[key];
          return;
        }
        setTimeout(function () {
          if (availJobs[key] && availQueue.indexOf(key) === -1 && availLowQueue.indexOf(key) === -1) {
            availQueue.push(key);
            pumpAvailability();
          }
        }, AVAIL_RETRY_DELAY);
      })
      .then(function () {
        done(status);
        pumpAvailability();
      });
  }

  // ----- trendy týdne (pro „Doporučené") -----
  var TRENDING_KEY = 'tizenprehrajto.trending';
  var TRENDING_TTL = 12 * 60 * 60 * 1000;
  var TRENDING_PAGES = 5;
  var trendingIds = null;

  function loadTrendingCache() {
    if (trendingIds) return trendingIds;
    try {
      var c = JSON.parse(localStorage.getItem(TRENDING_KEY));
      if (c && c.ids) trendingIds = c;
    } catch (e) {}
    return trendingIds;
  }

  function isTrending(id) {
    var c = loadTrendingCache();
    return !!(c && id && c.ids.indexOf(id) !== -1);
  }

  function loadTrending() {
    var c = loadTrendingCache();
    if ((c && Date.now() - c.t < TRENDING_TTL) || !getTmdbKey()) return;
    var ids = [];
    var done = 0;
    var cfg = { path: '/trending/movie/week', params: '' };
    for (var p = 1; p <= TRENDING_PAGES; p++) {
      tmdbFetch(cfg, p).then(function (data) {
        var r = data.results || [];
        for (var i = 0; i < r.length; i++) ids.push(r[i].id);
      }).catch(function () {}).then(function () {
        if (++done < TRENDING_PAGES || !ids.length) return;
        trendingIds = { ids: ids, t: Date.now() };
        try { localStorage.setItem(TRENDING_KEY, JSON.stringify(trendingIds)); } catch (e) {}
        // přepočítat „Doporučené" u karet s už známou dostupností
        var cards = document.querySelectorAll('.pt-reco-card');
        for (var k = 0; k < cards.length; k++) {
          var m = cards[k].__ptMovie;
          var e = m && availCacheGet(m);
          if (e) applyAvailability(cards[k], e);
        }
      });
    }
  }

  // ----- filmy v oblíbených -----
  // Stáhnou se všechny stránky oblíbených (stránka 1 + odkazy ze
  // stránkování, BFS, max. FAV_MAX_PAGES) a názvy videí se porovnají
  // s filmem: název (český nebo originální) musí být v názvu videa jako
  // celá slova, a pokud video uvádí rok, musí sedět. Seznam se drží
  // v localStorage (srdíčka hned po návratu), při každém otevření
  // doporučení se na pozadí obnoví.
  var FAV_CACHE_KEY = 'tizenprehrajto.favTitles';
  var FAV_TIME_KEY = 'tizenprehrajto.favTitlesAt';
  var FAV_TTL = 6 * 60 * 60 * 1000; // obnova seznamu nejvýš jednou za 6 h
  var FAV_MAX_PAGES = 15;
  var favTitles = null; // normalizované názvy videí v oblíbených
  var favLoading = false;

  function normTitle(str) {
    var s = String(str || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return ' ' + s.replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '') + ' ';
  }

  function favLoadCache() {
    if (favTitles) return favTitles;
    try { favTitles = JSON.parse(localStorage.getItem(FAV_CACHE_KEY)) || null; } catch (e) { favTitles = null; }
    return favTitles;
  }

  function isFavoriteMovie(m) {
    var list = favLoadCache();
    if (!list || !list.length || !m) return false;
    var names = [normTitle(m.title)];
    if (m.orig && normTitle(m.orig) !== names[0]) names.push(normTitle(m.orig));
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      var hit = false;
      for (var j = 0; j < names.length; j++) {
        if (names[j].length > 2 && v.indexOf(names[j]) !== -1) { hit = true; break; }
      }
      if (!hit) continue;
      // uvádí-li video rok, musí to být rok filmu (Shrek ≠ Shrek 2 2004)
      var years = v.match(/ (19|20)\d\d /g);
      if (!years || !m.year) return true;
      for (var k = 0; k < years.length; k++) {
        if (years[k].replace(/ /g, '') === m.year) return true;
      }
    }
    return false;
  }

  function markFavoriteCard(card) {
    if (!card.__ptMovie) return;
    card.classList.toggle('pt-reco-card--fav', isFavoriteMovie(card.__ptMovie));
  }

  function markAllFavoriteCards() {
    var cards = document.querySelectorAll('.pt-reco-card');
    for (var i = 0; i < cards.length; i++) markFavoriteCard(cards[i]);
  }

  // odkazy ze stránkování oblíbených v HTML stránky
  function favPageLinks(html) {
    var out = [];
    var re = /class="[^"]*\bpagination\b[^"]*"/g;
    var m;
    while ((m = re.exec(html))) {
      var end = html.indexOf('</ul>', m.index);
      var nav = html.indexOf('</nav>', m.index);
      if (end === -1 || (nav !== -1 && nav < end)) end = nav;
      var block = html.slice(m.index, end === -1 ? m.index + 5000 : end);
      var hre = /href="([^"#]+)"/g;
      var h;
      while ((h = hre.exec(block))) {
        var href = decodeEntities(h[1]);
        if (href.indexOf('/oblibena-videa') !== -1 && out.indexOf(href) === -1) out.push(href);
      }
    }
    return out;
  }

  function loadFavorites() {
    if (favLoading) return;
    var at = 0;
    try { at = parseInt(localStorage.getItem(FAV_TIME_KEY), 10) || 0; } catch (e) {}
    if (favLoadCache() && Date.now() - at < FAV_TTL) return;
    favLoading = true;
    var queue = ['/oblibena-videa/'];
    var seen = {};
    var titles = [];
    var fetched = 0;
    // stránka 1 oblíbených je většinou právě otevřená – vzít ji z DOM
    // a neutrácet za ni dotaz
    if (location.pathname.indexOf('/oblibena-videa') === 0 && !location.search) {
      var own = document.documentElement.outerHTML;
      var ownItems = parseSearchResults(own);
      for (var oi = 0; oi < ownItems.length; oi++) titles.push(normTitle(ownItems[oi].title));
      seen['/oblibena-videa/'] = true;
      queue = favPageLinks(own);
    }
    function next() {
      var url = null;
      while (queue.length && !url) {
        var u = queue.shift();
        if (!seen[u]) url = u;
      }
      if (!url || fetched >= FAV_MAX_PAGES) {
        favLoading = false;
        favTitles = titles;
        try {
          localStorage.setItem(FAV_CACHE_KEY, JSON.stringify(titles));
          localStorage.setItem(FAV_TIME_KEY, String(Date.now()));
        } catch (e) {}
        markAllFavoriteCards();
        return;
      }
      seen[url] = true;
      // přes limiter až když nic jiného nečeká (srdíčka nejsou kritická)
      scrapeAcquire(function (done) {
        fetched++;
        fetch(url, { credentials: 'same-origin' })
          .then(function (res) {
            if (res.status === 429) {
              var tooMany = new Error('fav 429');
              tooMany.blocked = true;
              throw tooMany;
            }
            // nepřihlášený → web přesměruje pryč z oblíbených
            if (!res.ok || (res.url && res.url.indexOf('/oblibena-videa') === -1)) throw new Error('fav');
            return res.text();
          })
          .then(function (html) {
            done(200);
            var items = parseSearchResults(html);
            for (var i = 0; i < items.length; i++) titles.push(normTitle(items[i].title));
            var links = favPageLinks(html);
            for (var j = 0; j < links.length; j++) {
              if (!seen[links[j]]) queue.push(links[j]);
            }
            next();
          })
          .catch(function (err) {
            done(err && err.blocked ? 429 : 0);
            if (err && err.blocked) {
              // 429: stránku zkusit znovu po pauze limiteru
              fetched--;
              delete seen[url];
              queue.unshift(url);
              next();
              return;
            }
            // jiná chyba hned na první stránce → nechat starou cache
            if (fetched === 1) { favLoading = false; return; }
            next();
          });
      }, 'idle');
    }
    next();
  }

  // velký poster/backdrop fokusovaného filmu – za obsahem, nad pozadím.
  // Nový obrázek se nejdřív načte, pak se prolne (0→1) přes starý
  // (1→0, po doběhnutí se smaže); token zahazuje opožděné načtení
  // při rychlém přepínání karet.
  var recoBackdropToken = 0;
  var recoBackdropUrl = '';

  function showRecoBackdrop(url) {
    var bg = document.getElementById('pt-reco-backdrop');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'pt-reco-backdrop';
      document.body.appendChild(bg);
    }
    bg.className = 'pt-visible';
    if (url === recoBackdropUrl) return;
    recoBackdropUrl = url;
    var token = ++recoBackdropToken;
    var img = new Image();
    img.onload = function () {
      if (token !== recoBackdropToken) return;
      var layer = document.createElement('div');
      layer.className = 'pt-reco-layer';
      layer.style.backgroundImage = 'url("' + url + '")';
      // starší skryté vrstvy pryč, zůstane jen právě viditelná
      while (bg.childNodes.length > 1) bg.removeChild(bg.firstChild);
      var old = bg.lastChild;
      bg.appendChild(layer);
      void layer.offsetWidth; // reflow, ať transition opravdu proběhne
      layer.className = 'pt-reco-layer pt-reco-layer--on';
      if (old) {
        old.className = 'pt-reco-layer';
        setTimeout(function () {
          if (old.parentNode && old !== bg.lastChild) old.parentNode.removeChild(old);
        }, 350);
      }
    };
    img.src = url;
  }

  function hideRecoBackdrop() {
    var bg = document.getElementById('pt-reco-backdrop');
    if (bg) bg.className = '';
    recoBackdropUrl = '';
    recoBackdropToken++;
  }

  // ----- nejlepší verze ve výsledcích hledání -----
  // Při hledání z posteru se uloží kontext filmu (název, rok). Stránka
  // hledání pak vybere verzi, kterou by člověk pustil (CZ dabing →
  // kvalita → lajky; jen správný rok/délka, bez dislike a CAM), naklonuje
  // ji jako první kartu (červený rámeček) a fokus jde rovnou na ni –
  // OK, OK a hraje. Ostatní výsledky zůstávají pod ní.
  var SEARCH_CTX_KEY = 'pt-search-ctx';
  var SEARCH_CTX_TTL = 30 * 60 * 1000;

  function saveSearchContext(m) {
    if (!m) return;
    try {
      sessionStorage.setItem(SEARCH_CTX_KEY, JSON.stringify({
        title: m.title, orig: m.orig, year: m.year, t: Date.now(),
      }));
    } catch (e) {}
  }

  function readSearchContext() {
    try {
      var c = JSON.parse(sessionStorage.getItem(SEARCH_CTX_KEY));
      if (!c || Date.now() - c.t > SEARCH_CTX_TTL) return null;
      var q = decodeURIComponent(location.pathname.replace(/^\/hledej\//, '')).replace(/\/$/, '');
      return q === c.title ? c : null;
    } catch (e) { return null; }
  }

  function scoreVersion(item) {
    var n = normTitle(item.title);
    var sc = 0;
    if (hasCzDub(item.title)) sc += 100;
    if (/ (2160p|4k|uhd) /.test(n)) sc += 25;
    else if (/ (1080p|1080|fhd|fullhd) /.test(n)) sc += 20;
    else if (/ (720p|hd) /.test(n)) sc += 10;
    sc += Math.min(Math.max(item.rating || 0, 0), 50);
    // nahrávka kamerou z kina / telesync – i s dabingem až na konec
    if (/ (cam|camrip|hdcam|ts|hdts|telesync|tc|telecine) /.test(n)) sc -= 200;
    return sc;
  }

  // vrací true, když už není co dělat (hotovo / nic vhodného)
  function injectBestPick() {
    if (document.querySelector('.pt-best')) return true;
    var ctx = readSearchContext();
    if (!ctx) return true;
    var listing = document.querySelector('#snippet-videoListing-videoListingWrapper .video-listing') ||
      document.querySelector('.video-listing');
    if (!listing) return false;
    var wrappers = listing.querySelectorAll('.video-wrapper');
    var best = null;
    for (var i = 0; i < wrappers.length; i++) {
      var item = parseSearchResults(wrappers[i].outerHTML)[0];
      if (!item || !isMovieVersion(item, ctx) || !isUsableVersion(item)) continue;
      var sc = scoreVersion(item);
      if (!best || sc > best.sc) best = { el: wrappers[i], sc: sc };
    }
    if (!best) return true;
    var clone = best.el.cloneNode(true);
    clone.classList.add('pt-best');
    // srdíčko/dropdown webu mají id a vlastní logiku – v kopii ne
    var favs = clone.querySelectorAll('.video-favorite');
    for (var f = 0; f < favs.length; f++) favs[f].parentNode.removeChild(favs[f]);
    var ids = clone.querySelectorAll('[id]');
    for (var k = 0; k < ids.length; k++) ids[k].removeAttribute('id');
    listing.insertBefore(clone, listing.firstChild);
    return true;
  }

  // ----- historie sledování -----
  // Na stránce videa se při prvním přehrání uloží odkaz, název a náhled;
  // na oblíbených se nad videi ukáže řádek posledních (max. 20) videí.
  var HISTORY_KEY = 'tizenprehrajto.history';
  var HISTORY_MAX = 20;
  var HISTORY_SHOW = 20; // všechno uložené – řádek se posouvá vodorovně

  function readHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function recordHistory() {
    var h1 = document.querySelector('h1.title');
    var span = h1 && h1.querySelector('span');
    var title = ((span || h1 || {}).textContent || document.title || '').replace(/\s+/g, ' ').trim();
    var og = document.querySelector('meta[property="og:image"]');
    var entry = {
      href: location.pathname,
      title: title,
      thumb: og ? og.getAttribute('content') : '',
      t: Date.now(),
    };
    var list = readHistory();
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].href === entry.href) list.splice(i, 1);
    }
    list.unshift(entry);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch (e) {}
  }

  function renderHistory() {
    if (location.pathname.indexOf('/oblibena-videa') !== 0 || document.getElementById('pt-history')) return;
    var list = readHistory().slice(0, HISTORY_SHOW);
    var grid = document.querySelector('.pt-fav-grid');
    if (!list.length || !grid || !grid.parentElement) return;
    var box = document.createElement('div');
    box.id = 'pt-history';
    var h = document.createElement('h2');
    h.className = 'pt-history-title';
    h.textContent = 'Naposledy přehrávané';
    var row = document.createElement('div');
    row.className = 'pt-history-row';
    for (var i = 0; i < list.length; i++) {
      var a = document.createElement('a');
      a.className = 'pt-hist-card';
      a.href = list[i].href;
      var pic = document.createElement('span');
      pic.className = 'pt-hist-thumb';
      if (list[i].thumb) {
        var img = document.createElement('img');
        // nenačtený náhled (smazané video) → jen šedá plocha, ne rozbitá ikona
        img.onerror = function () { if (this.parentNode) this.parentNode.removeChild(this); };
        img.src = list[i].thumb;
        img.alt = '';
        pic.appendChild(img);
      }
      var t = document.createElement('span');
      t.className = 'pt-hist-title';
      t.textContent = list[i].title;
      a.appendChild(pic);
      a.appendChild(t);
      row.appendChild(a);
    }
    box.appendChild(h);
    box.appendChild(row);
    grid.parentElement.insertBefore(box, grid);
  }

  // klik na poster: vyplnit vyhledávání a rovnou vyhledat
  function searchRecoTitle(title) {
    var input = document.querySelector('input.video-search-phrase');
    if (input) input.value = title;
    location.href = '/hledej/' + encodeURIComponent(title);
  }

  // ----- navigace v řadách -----
  function recoStateForStrip(strip) {
    for (var i = 0; i < recoState.length; i++) {
      if (recoState[i].strip === strip) return recoState[i];
    }
    return null;
  }

  // staré Tizen Chromium neumí spolehlivě scrollIntoView s options,
  // proto se posun okna i řady počítá ručně a animuje (tweenScroll)
  function scrollWindowToCard(card, instant) {
    // první řada první skupiny: stránka úplně nahoře (vidět přepínače
    // a vyhledávání), jinak řadu na střed
    var rowEl = card.closest('.pt-reco-row');
    var groupEl = card.closest('.pt-reco-group');
    if (rowEl && groupEl && groupEl === groupEl.parentElement.firstElementChild &&
        rowEl === groupEl.firstElementChild) {
      smoothScrollWindowTo(0, instant);
      return;
    }
    centerInWindow(card, instant);
  }

  // vodorovný posun řady; počítá s cílem právě běžící animace, takže
  // rychlé opakované stisky na sebe plynule navazují
  function scrollStripToCard(strip, card, instant) {
    var holder = strip.__ptScroll || (strip.__ptScroll = { raf: 0, target: null });
    var cur = strip.scrollLeft;
    var view = holder.target !== null ? holder.target : cur;
    var sr = strip.getBoundingClientRect();
    var cr = card.getBoundingClientRect();
    var left = cr.left - sr.left + cur; // pozice karty v obsahu řady
    var right = left + cr.width;
    var to = view;
    if (right > view + sr.width - 10) {
      to = right - sr.width + 120;
    } else if (left < view + 10) {
      to = left - 120;
    }
    to = Math.round(Math.max(0, Math.min(strip.scrollWidth - strip.clientWidth, to)));
    if (to === view && !instant) return;
    tweenScroll(holder, cur, to, function (v) { strip.scrollLeft = v; }, instant ? 0 : SCROLL_MS);
  }

  function recoNavHorizontal(card, dir) {
    var strip = card.parentElement;
    var next = dir > 0 ? card.nextElementSibling : card.previousElementSibling;
    if (next && next.classList && next.classList.contains('pt-reco-card')) {
      focusEl(next);
      scrollStripToCard(strip, next);
    }
    // infinite loading: blížíme se konci řady -> přitáhnout další stránku
    if (dir > 0) {
      var state = recoStateForStrip(strip);
      if (state) {
        var cards = strip.children;
        var idx = Array.prototype.indexOf.call(cards, next || card);
        if (cards.length - idx <= 6) loadRecoPage(state);
      }
    }
  }

  function recoNavVertical(card, dir) {
    var rowEl = card.closest('.pt-reco-row');
    var target = dir > 0 ? rowEl.nextElementSibling : rowEl.previousElementSibling;
    if (!target) {
      if (dir > 0) {
        // z poslední řady dolů do další poloviny řad
        activateRecoGroup(recoGroupIndex + 1, false);
      } else if (recoGroupIndex > 0) {
        // z první řady nahoru zpět do předchozí poloviny
        activateRecoGroup(recoGroupIndex - 1, true);
      } else {
        // z úplně první řady nahoru zpět na přepínače
        var sw = recoSwitchEl();
        focusEl(sw || document.querySelector('input.video-search-phrase'));
        smoothScrollWindowTo(0);
      }
      return;
    }
    var strip = target.querySelector('.pt-reco-strip');
    var cards = strip ? strip.querySelectorAll('.pt-reco-card') : [];
    if (!cards.length) return;
    var cx = card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2;
    var best = cards[0];
    var bestDx = Infinity;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      var dx = Math.abs(r.left + r.width / 2 - cx);
      if (dx < bestDx) { bestDx = dx; best = cards[i]; }
    }
    focusEl(best);
    scrollStripToCard(strip, best);
    scrollWindowToCard(best);
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
        } else if (document.getElementById('pt-suggest')) {
          // Zpět zavře našeptávač a vrátí fokus do vyhledávání
          closeSuggestOverlay(true);
        } else if (document.activeElement && document.activeElement.classList &&
                   document.activeElement.classList.contains('video-search-phrase')) {
          // Zpět zavře TV klávesnici – rovnou přejít na první návrh
          // našeptávače; bez návrhů jen zrušit fokus
          if (!openSuggestOverlay()) document.activeElement.blur();
        } else if (document.activeElement && document.activeElement.id === 'pt-reco-pass') {
          document.activeElement.blur();
        } else if (document.body.classList.contains('pt-reco')) {
          closeReco();
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
        // pohyb v otevřeném našeptávači
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('pt-suggest-item')) {
          var item = document.activeElement;
          if (e.keyCode === KEY.DOWN) {
            if (item.nextElementSibling) focusEl(item.nextElementSibling);
          } else if (item.previousElementSibling) {
            focusEl(item.previousElementSibling);
          } else {
            // nahoru z první položky zpět do vyhledávání
            closeSuggestOverlay(true);
          }
          return;
        }
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('pt-reco-card')) {
          recoNavVertical(document.activeElement, e.keyCode === KEY.DOWN ? 1 : -1);
          return;
        }
        // šipka dolů ve vyhledávání otevře našeptávač (pokud web nabízí)
        if (e.keyCode === KEY.DOWN &&
            document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('video-search-phrase') &&
            openSuggestOverlay()) {
          return;
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
        // v otevřeném našeptávači doleva/doprava nic nedělá
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('pt-suggest-item')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('pt-reco-card')) {
          e.preventDefault();
          e.stopPropagation();
          recoNavHorizontal(document.activeElement, e.keyCode === KEY.RIGHT ? 1 : -1);
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
        // OK na původním přepínači v režimu doporučení ho zavře
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('pt-reco-return')) {
          e.preventDefault();
          e.stopPropagation();
          closeReco();
          return;
        }
        // OK na položce našeptávače ji otevře
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('pt-suggest-item')) {
          e.preventDefault();
          e.stopPropagation();
          document.activeElement.click();
          return;
        }
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains('video-search-phrase')) {
          e.preventDefault();
          e.stopPropagation();
          submitSearch(document.activeElement);
          return;
        }
        // Enter na srdíčku jen přepne oblíbené, nesmí otevřít video;
        // případný dialog s výběrem seznamů se vyřídí automaticky
        if (document.activeElement && document.activeElement.closest &&
            document.activeElement.closest('.video-favorite')) {
          e.preventDefault();
          e.stopPropagation();
          var heart = document.activeElement;
          markExisting();
          var preBoxes = snapshotBoxes();
          heart.click();
          autoResolveFavDialog(preBoxes, heart);
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
  function firstVideoLink() {
    var links = document.querySelectorAll('main a.pt-hist-card, main a.video--link');
    for (var i = 0; i < links.length; i++) {
      if (isVisible(links[i])) return links[i];
    }
    return null;
  }

  // první stránka v této relaci aplikace (sessionStorage přežije
  // navigaci, ale ne nové spuštění)
  function isAppLaunch() {
    try {
      if (sessionStorage.getItem('pt-launched')) return false;
      sessionStorage.setItem('pt-launched', '1');
      return true;
    } catch (e) { return false; }
  }

  function autofocus(type) {
    // obnovená doporučení si fokus řídí sama
    if (document.body.classList.contains('pt-reco')) return;
    if (type === 'home') {
      focusEl(document.querySelector('input.video-search-phrase'));
    } else if (type === 'favorites') {
      // oblíbená i právě sledovaná: rovnou první video (vyhledávání je
      // o řádek výš); prázdný seznam → vyhledávání
      focusEl(firstVideoLink() || document.querySelector('input.video-search-phrase'));
    } else if (type === 'search') {
      var first = document.querySelector('#snippet-videoListing-videoListingWrapper a.video--link');
      focusEl(first || document.querySelector('input.video-search-phrase'));
    }
  }

  // ----- odhalení stránky až po usazení layoutu -----
  // Všechny úpravy, které jinak běží z intervalů, se před odhalením
  // provedou hned; stránka se ukáže, až je layout dvakrát po sobě hotový
  // (nebo po limitu), takže uživatel neuvidí rozbitý web ani „blik".
  function layoutSettled(type) {
    var input = document.querySelector('input.video-search-phrase');
    if (type === 'favorites') {
      if (document.body.classList.contains('pt-reco')) return !!input && !recoRestoring;
      var tidy = tidyFavoritesLayout();
      if (tidy) renderHistory();
      moveTimeFilters();
      placeFavorites();
      alignPagination();
      return !!input && tidy;
    }
    if (type === 'search') {
      var picked = injectBestPick();
      placeFavorites();
      alignPagination();
      return !!input && picked;
    }
    if (type === 'home') {
      alignPremiumToSearch();
      return !!input;
    }
    return true;
  }

  // autofocus jen jednou – podruhé by mohl přebít to, kam už uživatel
  // šipkami odešel
  var autofocused = false;
  function autofocusOnce(type) {
    if (autofocused) return;
    autofocused = true;
    autofocus(type);
  }

  // ----- hledání omezené webem (429) -----
  // Stránka hledání bez kontejneru výsledků = web dotaz odmítl (příliš
  // mnoho požadavků). Místo prázdné stránky hláška s odpočtem a novým
  // pokusem (max. BLOCKED_MAX_RETRIES za sebou, pak jen hláška).
  var BLOCKED_RETRY_S = (window.__PT_SCRAPE__ && window.__PT_SCRAPE__.blockedRetry) || 15;
  var BLOCKED_MAX_RETRIES = 5;
  var BLOCKED_KEY = 'pt-search-retries';

  function handleBlockedSearch() {
    var retries = 0;
    try { retries = parseInt(sessionStorage.getItem(BLOCKED_KEY), 10) || 0; } catch (e) {}
    if (document.getElementById('snippet-videoListing-videoListingWrapper')) {
      try { sessionStorage.removeItem(BLOCKED_KEY); } catch (e) {}
      return;
    }
    if (document.getElementById('pt-blocked')) return;
    var box = document.createElement('div');
    box.id = 'pt-blocked';
    var h = document.createElement('p');
    h.className = 'pt-blocked-title';
    h.textContent = 'Příliš mnoho požadavků na prehrajto.cz';
    var sub = document.createElement('p');
    sub.className = 'pt-blocked-sub';
    box.appendChild(h);
    box.appendChild(sub);
    (document.querySelector('main') || document.body).appendChild(box);
    if (retries >= BLOCKED_MAX_RETRIES) {
      sub.textContent = 'Web teď vyhledávání omezuje. Zkus to prosím za chvíli znovu.';
      return;
    }
    var left = BLOCKED_RETRY_S;
    var tick = function () {
      sub.textContent = 'Web teď vyhledávání omezuje – zkusím to znovu za ' + left + ' s.';
      if (left-- <= 0) {
        try { sessionStorage.setItem(BLOCKED_KEY, String(retries + 1)); } catch (e) {}
        location.reload();
        return;
      }
      setTimeout(tick, 1000);
    };
    tick();
  }

  function revealPage(type) {
    tidyAccountBar();
    if (type === 'search') handleBlockedSearch();
    // fokus ještě před odhalením, ať se nezvýrazní až dodatečně
    if (document.querySelector('input.video-search-phrase')) autofocusOnce(type);
    document.body.classList.add('pt-ready');
    document.documentElement.classList.remove('pt-loading');
  }

  function revealWhenSettled(type) {
    var start = Date.now();
    var max = document.body.classList.contains('pt-reco') ? 3000 : 1500;
    var stable = 0;
    (function step() {
      var done = true;
      try { done = layoutSettled(type); } catch (e) { /* radši ukázat */ }
      stable = done ? stable + 1 : 0;
      if (stable >= 2 || Date.now() - start > max) {
        revealPage(type);
        return;
      }
      setTimeout(step, 50);
    })();
  }

  // odchod ze stránky: obsah hned zmizí do pozadí (místo zamrzlé staré
  // stránky během načítání nové); pojistka, kdyby navigace neproběhla
  var leaveTimer = null;
  window.addEventListener('beforeunload', function () {
    markLoading();
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(function () {
      document.documentElement.classList.remove('pt-loading');
    }, 4000);
  });
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted && document.body && document.body.classList.contains('pt-ready')) {
      document.documentElement.classList.remove('pt-loading');
    }
  });

  injectCss();
  // na TV se skript spouští ještě před parsováním dokumentu – zkoušet
  // vložit CSS (a třídu pt-loading) co nejdřív, aby původní web vůbec
  // neprobliknul
  // MutationObserver zachytí vznik <html> hned při parsování (10ms timer
  // byl pomalejší než parser – web se stihl vykreslit bez stylů)
  if (CUSTOM_CSS && !document.getElementById('tizenprehrajto-styles')) {
    var earlyDone = function () {
      markLoading();
      injectCss();
      return !!document.getElementById('tizenprehrajto-styles');
    };
    var cssTimer = setInterval(function () {
      if (earlyDone()) clearInterval(cssTimer);
    }, 10);
    if (window.MutationObserver) {
      try {
        var earlyObs = new MutationObserver(function () {
          if (earlyDone()) {
            earlyObs.disconnect();
            clearInterval(cssTimer);
          }
        });
        earlyObs.observe(document, { childList: true, subtree: true });
      } catch (e) { /* zůstává timer */ }
    }
  }
  registerMediaKeys();
  window.addEventListener('keydown', onKeyDown, true);

  whenDomReady(function () {
    markLoading();
    injectCss();
    var type = pageType();
    var launch = isAppLaunch();
    document.body.classList.add('pt-' + type);
    tidyAccountBar();
    setInterval(tidyAccountBar, 1000); // lišta se dorenderovává později
    if (type === 'video') initVideoPage();
    if (type === 'favorites') {
      addSwitchButton();
      // návrat z hledání vybraného posteru – otevřít doporučení tam, kde byl
      // pozice se obnoví jen při návratu tlačítkem Zpět (z hledání) a hned
      // se spotřebuje – jinak by každé další načtení oblíbených/sledovaných
      // vracelo do doporučení
      var recoPos = isBackNavigation() ? readRecoPos() : null;
      clearRecoPos();
      if (recoPos && getTmdbKey()) {
        openReco(recoPos);
      } else if (launch && location.pathname.indexOf('/oblibena-videa') === 0) {
        // spuštění aplikace = rovnou doporučení (od začátku, fokus na
        // první poster); oblíbená jsou o přepínač vedle
        clearRecoPos();
        openReco();
      }
      var favTries = 0;
      var favTimer = setInterval(function () {
        if (tidyFavoritesLayout()) {
          renderHistory();
          clearInterval(favTimer);
        } else if (++favTries > 20) {
          clearInterval(favTimer);
        }
      }, 250);
      setInterval(moveTimeFilters, 500);
    }
    if (type === 'favorites' || type === 'search') {
      setInterval(function () {
        placeFavorites();
        alignPagination();
      }, 500);
    }
    if (type === 'home') {
      setInterval(alignPremiumToSearch, 500);
    }
    revealWhenSettled(type);

    // Vue komponenta vyhledávání se renderuje chvíli po DOMContentLoaded
    var tries = 0;
    var timer = setInterval(function () {
      var input = document.querySelector('input.video-search-phrase');
      if (input || ++tries > 20) {
        clearInterval(timer);
        autofocusOnce(type);
      }
    }, 250);

  });
})();
