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
    favorites: 'input.video-search-phrase, a.pt-switch, span.pt-reco-return, .pt-filter-group a, .pt-filter-group button, a.video--link, .pagination a, #pt-reco-gate input, #pt-reco-gate button, .pt-reco-card',
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
            sib.id === 'pt-reco' || sib.querySelector('#pt-reco')) continue;
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
  var RECO_ROWS = [
    { title: 'Populární', path: '/movie/popular', params: '' },
    { title: 'Populární v ČR (stream)', path: '/discover/movie', params: '&watch_region=CZ&with_watch_monetization_types=flatrate%7Cfree%7Cads&sort_by=popularity.desc&vote_count.gte=50' },
    { title: 'Novinky na streamu', path: '/discover/movie', params: '&watch_region=CZ&with_watch_monetization_types=flatrate%7Cfree%7Cads&sort_by=primary_release_date.desc&vote_count.gte=50&primary_release_date.lte=@today', boxed: true },
    { title: 'Animované', path: '/discover/movie', params: '&with_genres=16&sort_by=popularity.desc&vote_count.gte=100' },
    { title: 'Náhodný tip', path: '/discover/movie', params: '&sort_by=popularity.desc&vote_average.gte=7&vote_count.gte=500', shuffle: 100 },
    { title: 'Trendy tento týden', path: '/trending/movie/week', params: '' },
    { title: 'Skryté klenoty', path: '/discover/movie', params: '&sort_by=popularity.desc&vote_average.gte=7.4&vote_count.gte=500&vote_count.lte=3000&primary_release_date.gte=2000-01-01' },
    { title: 'Nejlépe hodnocené', path: '/movie/top_rated', params: '' },
    { title: 'Komedie', path: '/discover/movie', params: '&with_genres=35&sort_by=popularity.desc&vote_count.gte=100', shuffle: 10 },
    { title: 'Fantasy', path: '/discover/movie', params: '&with_genres=14&sort_by=popularity.desc&vote_count.gte=100', shuffle: 10 },
    { title: 'Sci-Fi', path: '/discover/movie', params: '&with_genres=878&sort_by=popularity.desc&vote_count.gte=100', shuffle: 10 },
    { title: 'Dobrodružné', path: '/discover/movie', params: '&with_genres=12&sort_by=popularity.desc&vote_count.gte=100', shuffle: 10 },
    { title: 'Akční', path: '/discover/movie', params: '&with_genres=28&sort_by=popularity.desc&vote_count.gte=100', shuffle: 10 },
    { title: 'Romantické', path: '/discover/movie', params: '&with_genres=10749&sort_by=popularity.desc&vote_count.gte=100', shuffle: 10 },
  ];

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
    var params = row.params.replace('@today', new Date().toISOString().slice(0, 10));
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
    if (sw) focusEl(sw);
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
      window.scrollTo(0, 0);
      activateRecoGroup(0, false);
      return;
    }
    rows = document.createElement('div');
    rows.id = 'pt-reco-rows';
    box.appendChild(rows);
    recoState = [];
    recoGroups = [];
    recoGroupIndex = 0;
    // řady rozdělené na poloviny – zobrazená a načtená je vždy jen jedna,
    // mezi nimi se přechází šipkou dolů/nahoru na kraji skupiny
    var half = Math.ceil(RECO_ROWS.length / 2);
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
        rowEl.className = 'pt-reco-row' + (cfg.boxed ? ' pt-reco-row--boxed' : '');
        var h = document.createElement('h2');
        h.className = 'pt-reco-row-title';
        h.textContent = cfg.title;
        var strip = document.createElement('div');
        strip.className = 'pt-reco-strip';
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
      scrollWindowToCard(cardEl);
    }
  }

  // po návratu z hledání počkat, až se uložená karta donačte (včetně
  // dalších stránek řady), a fokusovat ji
  function restoreRecoFocus(pos) {
    var group = recoGroups[pos.g] || recoGroups[0];
    if (!group) return;
    var state = group.states[pos.r] || group.states[0];
    if (!state) return;
    var tries = 0;
    var timer = setInterval(function () {
      var cards = state.strip.querySelectorAll('.pt-reco-card');
      var found = cards.length > pos.c;
      var exhausted = !state.loading && state.page > 0 &&
        state.base + state.page >= state.totalPages;
      if (found || exhausted || ++tries > 80) {
        clearInterval(timer);
        var card = found ? cards[pos.c] : cards[cards.length - 1];
        if (!card) return;
        focusEl(card);
        scrollStripToCard(state.strip, card);
        scrollWindowToCard(card);
      } else if (!state.loading) {
        loadRecoPage(state);
      }
    }, 250);
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
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (!m.poster_path || state.seen[m.id]) continue;
          state.seen[m.id] = true;
          state.strip.appendChild(makeRecoCard(m));
        }
        if (state.focusFirst) {
          state.focusFirst = false;
          var first = state.strip.querySelector('.pt-reco-card');
          if (first && document.body.classList.contains('pt-reco') &&
              !document.getElementById('pt-reco-gate')) {
            focusEl(first);
            scrollWindowToCard(first);
          }
        }
      })
      .catch(function () {
        state.loading = false;
        if (!state.strip.firstChild) {
          var err = document.createElement('p');
          err.className = 'pt-reco-err';
          err.textContent = 'Nepodařilo se načíst (zkontroluj klíč/síť).';
          state.strip.appendChild(err);
        }
      });
  }

  function makeRecoCard(movie) {
    var title = movie.title || movie.name || '';
    var card = document.createElement('a');
    card.className = 'pt-reco-card';
    card.href = '/hledej/' + encodeURIComponent(title);
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.src = 'https://image.tmdb.org/t/p/w342' + movie.poster_path;
    img.alt = '';
    var t = document.createElement('span');
    t.className = 'pt-reco-title';
    t.textContent = title;
    card.appendChild(img);
    card.appendChild(t);
    var year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
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
    card.addEventListener('focus', function () { showRecoBackdrop(backdropUrl); });
    card.addEventListener('click', function (ev) {
      ev.preventDefault();
      saveRecoPos(card);
      searchRecoTitle(title);
    });
    return card;
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
  // proto vertikální posun okna počítáme ručně
  function scrollWindowToCard(card) {
    var r = card.getBoundingClientRect();
    var wh = window.innerHeight || document.documentElement.clientHeight;
    var delta = Math.round(r.top + r.height / 2 - wh / 2);
    if (delta) window.scrollBy(0, delta);
  }

  function scrollStripToCard(strip, card) {
    var sr = strip.getBoundingClientRect();
    var cr = card.getBoundingClientRect();
    if (cr.right > sr.right - 10) {
      strip.scrollLeft += Math.round(cr.right - sr.right) + 120;
    } else if (cr.left < sr.left + 10) {
      strip.scrollLeft -= Math.round(sr.left - cr.left) + 120;
    }
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
        window.scrollTo(0, 0);
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
  function autofocus(type) {
    // obnovená doporučení si fokus řídí sama
    if (document.body.classList.contains('pt-reco')) return;
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

  whenDomReady(function () {
    injectCss();
    var type = pageType();
    document.body.classList.add('pt-ready');
    document.body.classList.add('pt-' + type);
    tidyAccountBar();
    setInterval(tidyAccountBar, 1000); // lišta se dorenderovává později
    if (type === 'video') initVideoPage();
    if (type === 'favorites') {
      addSwitchButton();
      // návrat z hledání vybraného posteru – otevřít doporučení tam, kde byl
      var recoPos = readRecoPos();
      if (recoPos && getTmdbKey()) openReco(recoPos);
      var favTries = 0;
      var favTimer = setInterval(function () {
        if (tidyFavoritesLayout()) {
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
