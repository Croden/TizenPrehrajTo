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

  var CUSTOM_CSS = "/*\n * Funkční styly aplikace TizenPrehrajTo (režimy stránek, fokus, fullscreen player).\n * Vlastní vizuální úpravy patří do userStyles.css, ne sem.\n *\n * Jednotná paleta ovládacích prvků (CSS proměnné nejsou kvůli starším\n * Tizenům – hodnoty držet synchronní ručně):\n *   pozadí tlačítek  #333\n *   rámeček          2px solid #777\n *   text             #fff\n *   akcent (aktivní) #ffb400, text na akcentu #000\n *   border-radius    8px\n *   fokus/hover      outline 4px solid #ffb400, offset 2px\n */\n\n/* ===== Globální ===== */\n/* stránka se ukáže až po aplikaci TV úprav (žádné probliknutí původního webu) */\nbody:not(.pt-ready) {\n  visibility: hidden !important;\n}\n\n/* srdíčko „přidat do oblíbených“ – skript ho přesouvá z thumbnailu do\n   řádku štítků pod ním (úplně vpravo); background/radius kopíruje ze\n   štítku s délkou videa */\nbody.pt-search .video__header .video-favorite,\nbody.pt-favorites .video__header .video-favorite {\n  position: static !important;\n  margin: 0.3rem 0 0 0.5rem !important;\n  justify-content: center;\n}\n\nbody.pt-search .video__header .video-favorite a,\nbody.pt-favorites .video__header .video-favorite a,\nbody.pt-search .video__header .video-favorite button,\nbody.pt-favorites .video__header .video-favorite button {\n  background: transparent !important;\n  border: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  color: inherit !important;\n  font-size: inherit !important;\n  line-height: 1;\n  display: inline-flex;\n  align-items: center;\n}\n\n/* všechny štítky pod thumbnailem (délka, lajky, velikost i srdíčko)\n   mají stejnou výšku */\nbody.pt-search .video__header .video__tag,\nbody.pt-favorites .video__header .video__tag,\nbody.pt-search .video__header .video-favorite,\nbody.pt-favorites .video__header .video-favorite {\n  height: 2.2rem;\n  box-sizing: border-box;\n  display: inline-flex !important;\n  align-items: center;\n}\n\n/* štítky uvnitř skupiny vpravo nesmí dědit horní odsazení řádku */\nbody.pt-search .video__header .video__tag--others .video__tag,\nbody.pt-favorites .video__header .video__tag--others .video__tag {\n  margin-top: 0 !important;\n}\n\n/* srdíčko „přidat do oblíbených“ – fokus šipkou dolů z videa */\nbody.pt-search .video-favorite:focus,\nbody.pt-favorites .video-favorite:focus,\nbody.pt-search .video-favorite :focus,\nbody.pt-favorites .video-favorite :focus {\n  outline: 4px solid #ffb400 !important;\n  outline-offset: 2px;\n  border-radius: 4px;\n}\n\n/* dialog výběru seznamů po kliknutí na srdíčko vyřizuje skript sám\n   (odklikne checkbox) – nemá ani probliknout; visibility (ne display)\n   kvůli zachování layoutu pro detekci checkboxů */\nbody.pt-fav-auto .reveal-overlay,\nbody.pt-fav-auto .reveal,\nbody.pt-fav-auto .dialog,\nbody.pt-fav-auto .modal,\nbody.pt-fav-auto [class*=\"popup\"],\nbody.pt-fav-auto [class*=\"tooltip\"] {\n  visibility: hidden !important;\n}\n\n/* jednou obsloužený dialog/popover zůstává neviditelný napořád –\n   visibility (ne display), aby mu zůstal layout pro příští detekci */\n.pt-fav-dialog {\n  visibility: hidden !important;\n}\n\n/* OSD hláška (přepínání zvuku/titulků) */\n#pt-osd {\n  position: fixed;\n  left: 50%;\n  bottom: 8vh;\n  transform: translateX(-50%);\n  z-index: 9500;\n  background: rgba(0, 0, 0, 0.75);\n  color: #fff;\n  font-size: 1.4rem;\n  padding: 0.6rem 1.4rem;\n  border-radius: 8px;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.2s;\n}\n\n#pt-osd.pt-osd--visible {\n  opacity: 1;\n}\n\n/* vlastní našeptávač (#pt-suggest) – kopie nabídky webu s reálně\n   fokusovatelnými položkami; fokus musí z inputu odejít, jinak OK\n   na TV jen znovu otevře klávesnici */\n#pt-suggest {\n  position: fixed;\n  z-index: 9600;\n  background: #333;\n  border: 2px solid #777;\n  border-radius: 8px;\n  max-height: 60vh;\n  overflow: auto;\n  padding: 0.3rem 0;\n}\n\n/* nativní dropdown webu je po dobu otevřeného overlaye schovaný,\n   aby pod ním neprosvítal (třídu přidává/odebírá skript) */\n.pt-native-suggest-hidden {\n  visibility: hidden !important;\n}\n\n.pt-suggest-item {\n  display: block;\n  padding: 0.5rem 1rem;\n  color: #fff;\n  font-size: 1.2rem;\n  text-decoration: none;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.pt-suggest-item:focus {\n  outline: none;\n  background: #ffb400;\n  color: #000;\n}\n\n#feedback,\n.popup,\n.nav--mobile,\n.button--menu,\nfooter.footer {\n  display: none !important;\n}\n\n/* jednotný fokus/hover pro všechny ovládací prvky */\ninput.video-search-phrase:focus,\n.header__links a:focus,\n.button--filters:focus,\n.button--filters:hover,\n.filters-group__item:focus,\n.dialog a:focus,\n.dialog button:focus,\n.dialog input:focus,\n.pagination a:focus,\n.pagination a:hover,\na.pt-switch:focus,\na.pt-switch:hover,\n.pt-filter:focus,\n.pt-filter:hover {\n  outline: 4px solid #ffb400 !important;\n  outline-offset: 2px;\n}\n\na.video--link:focus {\n  outline: 4px solid #ffb400 !important;\n  outline-offset: 2px;\n  border-radius: 8px;\n}\n\n/* ===== Domovská stránka – stejná hlavička jako na oblíbených ===== */\nbody.pt-home .logo,\nbody.pt-home .nav,\nbody.pt-home .top-bar-left,\nbody.pt-home main .section,\nbody.pt-home #switch-theme-form,\nbody.pt-home .header a[href=\"#registration\"],\nbody.pt-home .header a[href=\"/profil/nahrat-soubor\"] {\n  display: none !important;\n}\n\nbody.pt-home .grid-container {\n  max-width: none !important;\n  width: 100% !important;\n  padding-left: 1.5rem !important;\n  padding-right: 1.5rem !important;\n}\n\nbody.pt-home .top-bar {\n  background: transparent !important;\n}\n\nbody.pt-home .top-bar-right,\nbody.pt-home .suggest-wrapper,\nbody.pt-home .suggest,\nbody.pt-home .form-search,\nbody.pt-home .form__group--search {\n  width: 100% !important;\n  max-width: none !important;\n  float: none !important;\n}\n\nbody.pt-home input.video-search-phrase {\n  width: 100% !important;\n}\n\nbody.pt-home .header__section {\n  display: block !important;\n}\n\nbody.pt-home .header__links {\n  justify-content: flex-end;\n  background: transparent !important;\n}\n\n/* ===== Výsledky vyhledávání – vyhledávání + filtry + videa ===== */\nbody.pt-search .logo,\nbody.pt-search .nav,\nbody.pt-search #switch-theme-form,\nbody.pt-search .header__section.show-for-large,\nbody.pt-search main > .grid-x:not(:last-child) h1 {\n  display: none !important;\n}\n\n/* obsah přes celou šířku obrazovky (web omezuje .page na 1184 px) */\nbody.pt-search .page,\nbody.pt-favorites .page {\n  max-width: none !important;\n  width: 100% !important;\n  margin: 0 !important;\n}\n\nbody.pt-search .grid-container {\n  max-width: none !important;\n  width: 100% !important;\n  padding-left: 1.5rem !important;\n  padding-right: 1.5rem !important;\n}\n\n/* vyhledávání přes celou šířku (logo je schované) */\nbody.pt-search .top-bar-left {\n  display: none !important;\n}\n\nbody.pt-search .top-bar-right,\nbody.pt-search .suggest-wrapper,\nbody.pt-search .suggest,\nbody.pt-search .form-search,\nbody.pt-search .form__group--search {\n  width: 100% !important;\n  max-width: none !important;\n  float: none !important;\n}\n\nbody.pt-search input.video-search-phrase {\n  width: 100% !important;\n}\n\n/* tlačítko filtrů ve výsledcích – stejné žluté zvýraznění jako\n   aktivní přepínač/filtr na oblíbených */\nbody.pt-search .button--filters {\n  background: #ffb400 !important;\n  border: 2px solid #ffb400 !important;\n  border-radius: 8px;\n  color: #000 !important;\n}\n\nbody.pt-search .button--filters:focus {\n  outline: 4px solid #ffb400 !important;\n  outline-offset: 3px;\n}\n\n/* ===== Oblíbená videa (výchozí stránka) – search + premium + videa ===== */\nbody.pt-favorites .logo,\nbody.pt-favorites .nav,\nbody.pt-favorites .top-bar-left,\nbody.pt-favorites #switch-theme-form,\nbody.pt-favorites .section__header,\nbody.pt-favorites .breadcrumbs {\n  display: none !important;\n}\n\nbody.pt-favorites .grid-container {\n  max-width: none !important;\n  width: 100% !important;\n  padding-left: 1.5rem !important;\n  padding-right: 1.5rem !important;\n}\n\nbody.pt-favorites .top-bar-right,\nbody.pt-favorites .suggest-wrapper,\nbody.pt-favorites .suggest,\nbody.pt-favorites .form-search,\nbody.pt-favorites .form__group--search {\n  width: 100% !important;\n  max-width: none !important;\n  float: none !important;\n}\n\nbody.pt-favorites input.video-search-phrase {\n  width: 100% !important;\n}\n\n/* premium info v liště – stejný šedý box jako ostatní prvky,\n   pravou hranou zarovnaný na search (dorovnává skript) */\nbody.pt-favorites .header__links {\n  justify-content: flex-end;\n}\n\nbody.pt-favorites .header__links li a,\nbody.pt-favorites .header__links li button,\nbody.pt-home .header__links li a,\nbody.pt-home .header__links li button {\n  display: inline-flex;\n  align-items: center;\n  padding: 0.35rem 1.2rem;\n  background: #333;\n  color: #fff !important;\n  border: 2px solid #777;\n  border-radius: 8px;\n  text-decoration: none;\n}\n\n/* přepínač Oblíbená videa / Právě sledovaná pod vyhledáváním\n   (stejná mezera nad i pod – dole přičti 0.5rem margin karty videa,\n   obsah stránky nemá vlastní horní odsazení) */\nbody.pt-favorites .pt-switch-row {\n  position: relative;\n  display: flex;\n  justify-content: center;\n  gap: 1rem;\n  margin: 1rem 0 0.5rem;\n}\n\n/* filtry doby (\"24 hodin\", \"7 dní\", \"14 dní\") přesunuté z právě\n   sledovaných – vpravo na úrovni přepínače, vzhled jako tlačítka */\nbody.pt-favorites .pt-filter-group {\n  position: absolute;\n  right: 1.5rem;\n  top: 50%;\n  transform: translateY(-50%);\n  display: flex;\n  gap: 0.8rem;\n  align-items: center;\n}\n\nbody.pt-favorites .pt-filter-group .pt-filter {\n  display: inline-flex;\n  align-items: center;\n  font-size: 1.1rem;\n  line-height: 1.2;\n  padding: 0.35rem 1.2rem;\n  background: #333;\n  color: #fff !important;\n  border: 2px solid #777;\n  border-radius: 8px;\n  text-decoration: none;\n  cursor: pointer;\n}\n\n/* aktivní filtr – značí ho skript podle třídy od webu nebo shody URL */\nbody.pt-favorites .pt-filter-group .pt-filter--active {\n  background: #ffb400;\n  border-color: #ffb400;\n  color: #000 !important;\n}\n\nbody.pt-favorites main,\nbody.pt-favorites main .section {\n  padding-top: 0 !important;\n  margin-top: 0 !important;\n}\n\n/* paginace – šedá tlačítka, okraje zarovnává skript na hrany mřížky */\nbody.pt-favorites .pagination a,\nbody.pt-search .pagination a {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  padding: 0.35rem 1rem;\n  background: #333;\n  color: #fff !important;\n  border: 2px solid #777;\n  border-radius: 8px;\n  text-decoration: none;\n}\n\n/* aktuální stránka v paginaci – žlutá jako ostatní aktivní prvky */\nbody.pt-favorites .pagination a.pagination-active,\nbody.pt-search .pagination a.pagination-active {\n  background: #ffb400;\n  border-color: #ffb400;\n  color: #000 !important;\n}\n\nbody.pt-favorites .pt-switch {\n  font-size: 1.1rem;\n  padding: 0.35rem 1.2rem;\n  background: #333;\n  color: #fff;\n  border: 2px solid #777;\n  border-radius: 8px;\n}\n\n/* aktivní stránka – zvýrazněná, nejde fokusovat (je to span) */\nbody.pt-favorites .pt-switch--active {\n  background: #ffb400;\n  border-color: #ffb400;\n  color: #000;\n}\n\n/* ===== Mřížka videí (oblíbená i vyhledávání): 5 karet vedle sebe,\n   zarovnané doleva; .pt-fav-grid přidává na oblíbených skript ===== */\nbody.pt-favorites .pt-fav-grid,\nbody.pt-search .video-listing {\n  display: flex !important;\n  flex-wrap: wrap;\n  justify-content: flex-start;\n  width: 100% !important;\n  max-width: none !important;\n}\n\nbody.pt-favorites .pt-fav-grid > *,\nbody.pt-search .video-listing > .video-wrapper {\n  flex: 0 0 auto;\n  width: calc(100% / 5 - 1rem) !important;\n  max-width: none !important;\n  margin: 0.5rem !important;\n}\n\nbody.pt-favorites .video-wrapper .video,\nbody.pt-search .video-wrapper .video,\nbody.pt-favorites .video__picture--container,\nbody.pt-search .video__picture--container,\nbody.pt-favorites .video__title,\nbody.pt-search .video__title {\n  width: 100% !important;\n  max-width: 100% !important;\n}\n\n/* karta: do thumbnailu nic nezasahuje – pod ním délka vlevo,\n   HD/lajky/velikost vpravo, pak teprve název */\nbody.pt-favorites .video__header,\nbody.pt-search .video__header {\n  display: flex !important;\n  flex-wrap: wrap;\n  align-items: center;\n}\n\nbody.pt-favorites .video__header .video__picture,\nbody.pt-search .video__header .video__picture {\n  width: 100% !important;\n}\n\nbody.pt-favorites .video__header img.thumb,\nbody.pt-search .video__header img.thumb {\n  width: 100% !important;\n  height: auto !important;\n}\n\nbody.pt-favorites .video__header .video__tag,\nbody.pt-search .video__header .video__tag,\nbody.pt-favorites .video__header .video__tag--others,\nbody.pt-search .video__header .video__tag--others {\n  position: static !important;\n  margin: 0.3rem 0 0 !important;\n}\n\nbody.pt-favorites .video__header .video__tag--time,\nbody.pt-search .video__header .video__tag--time {\n  margin-right: auto !important;\n}\n\nbody.pt-favorites .video__header .video__tag--others,\nbody.pt-search .video__header .video__tag--others {\n  display: flex !important;\n  align-items: center;\n}\n\nbody.pt-favorites .video__header .video__tag--size,\nbody.pt-search .video__header .video__tag--size {\n  margin-left: 0.5rem !important;\n}\n\n/* ikonka kvality (HD) je zbytečná (selektor s .video__header musí\n   přebít display:inline-flex štítků výše) */\nbody.pt-favorites .video__tag--format,\nbody.pt-search .video__tag--format,\nbody.pt-favorites .video__header .video__tag--format,\nbody.pt-search .video__header .video__tag--format {\n  display: none !important;\n}\n\n/* ikona play překrývala thumbnail */\nbody.pt-favorites .video__play,\nbody.pt-search .video__play {\n  display: none !important;\n}\n\n/* ===== Video stránka – fullscreen player + titulek + hodnocení ===== */\nbody.pt-video {\n  overflow: hidden !important;\n}\n\nbody.pt-video #video-player-row {\n  position: fixed;\n  inset: 0;\n  margin: 0 !important;\n  z-index: 9000;\n  background: #000;\n}\n\nbody.pt-video #video-player-row .cell,\nbody.pt-video .video--detail,\nbody.pt-video #video-wrap {\n  width: 100vw !important;\n  height: 100vh !important;\n  max-width: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\nbody.pt-video #content_video {\n  width: 100vw !important;\n  height: 100vh !important;\n  padding-top: 0 !important;\n}\n\nbody.pt-video #content_video video {\n  object-fit: contain;\n  width: 100%;\n  height: 100%;\n}\n\n/* Ovládací lišta video.js: při přehrávání schovaná (zbytečně se\n   překresluje), ukáže se při pauze a krátce při přetáčení šipkami */\nbody.pt-video .vjs-control-bar,\nbody.pt-video .vjs-big-play-button {\n  display: none !important;\n}\n\nbody.pt-video.pt-paused .vjs-control-bar,\nbody.pt-video.pt-seeking .vjs-control-bar {\n  display: flex !important;\n  opacity: 1 !important;\n  visibility: visible !important;\n  font-size: 1.3em;\n}\n\n/* vrstva s titulky (video.js) musí zůstat viditelná i se schovanou\n   ovládací lištou */\nbody.pt-video .vjs-text-track-display {\n  display: block !important;\n  visibility: visible !important;\n  opacity: 1 !important;\n  z-index: 9002;\n}\n\n/* Titulek a hodnocení jako overlay – viditelné jen při pauze */\nbody.pt-video h1.title {\n  position: fixed;\n  top: 2vh;\n  left: 2vw;\n  max-width: 70vw;\n  z-index: 9001;\n  color: #fff !important;\n  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);\n  transition: opacity 0.3s;\n  margin: 0;\n}\n\nbody.pt-video h1.title span {\n  color: #fff !important;\n}\n\nbody.pt-video .rate {\n  position: fixed;\n  top: 2vh;\n  right: 2vw;\n  z-index: 9001;\n  color: #fff !important;\n  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);\n  transition: opacity 0.3s;\n  background: rgba(0, 0, 0, 0.5);\n  padding: 0.4rem 0.8rem;\n  border-radius: 6px;\n}\n\nbody.pt-video .rate span {\n  color: #fff !important;\n}\n\nbody.pt-video:not(.pt-paused) h1.title,\nbody.pt-video:not(.pt-paused) .rate {\n  opacity: 0;\n  pointer-events: none;\n}\n";

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
