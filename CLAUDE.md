# TizenPrehrajTo — instrukce pro Claude

## Co to je

TizenBrew modul (`packageType: "mods"`) wrappující https://prehrajto.cz/ pro Samsung Neo QLED QE100QN80F (Tizen) s nainstalovaným TizenBrew + TizenBrewInstaller. Mod = injektovaný JS/CSS do webu na TV. Uživatel má smart ovladač (šipky, Enter, Back, media klávesy) — barevná tlačítka nejsou potřeba.

**Komunikace vždy česky.**

## Tvrdá omezení cílové platformy (staré Tizen Chromium ~47)

- **Jen ES5** v `src/userScript.js` — žádné async/await, arrow functions, template literals, let/const, spread.
- CSS: **žádný** `gap` u flexu, `aspect-ratio`, CSS proměnné, `:focus-within`, `:is()/:where()/:has()`.
- `el.focus({preventScroll})` a `scrollIntoView(options)` jsou **nespolehlivé** — vertikální scroll okna dělat ručně (`window.scrollBy/scrollTo`, viz `scrollWindowToCard`), horizontální přes `strip.scrollLeft`.
- `fetch` a WebCrypto (`crypto.subtle`) fungují.
- TV renderuje 1920×1080 i na 4K panelu.
- TV klávesy: BACK = keyCode **10009**, ChannelUp/Down 427/428, media klávesy registrované přes `tizen.tvinputdevice` (seznam v `package.json` → `keys`).
- Na PC existuje `:hover`, na TV jen `:focus` — interaktivní stavy vždy stylovat pro **obojí**.

## Struktura

- `src/userScript.js` — celý mod (ES5). Hlavní bloky: media klávesy, fokusová navigace šipkami, přepínače stránek (`.pt-switch-row`), úpravy layoutu oblíbených (`tidyFavoritesLayout` — pozor, schovává v `<main>` vše bez videí; výjimky má v podmínce, `#pt-reco` mezi nimi), stránka Doporučení, `onKeyDown`.
- `src/appStyles.css` — styly modu (tmavý motiv, pozadí `#1a1a1a`).
- `src/userStyles.css` + `customJs()` — **prostor uživatele, píše si ho sám**. Nenavrhovat mu konkrétní selektory/úpravy, dodávat jen infrastrukturu.
- `build.js` → `dist/userScript.js` (commituje se!), `npm run build`.
- `start.js` (`npm start`) — lokální dev proxy na **:3003**: přepisuje prehrajto.cz, stripuje CSP/X-Frame-Options, injektuje build; `/__tv` = iframe 1920×1080 škálovaný do okna. Klávesy v náhledu: Esc=Back, PgUp/PgDn=Channel, F1–F4 media. Restart: `fuser -k 3003/tcp; nohup node start.js > /tmp/proxy.log 2>&1 &`.
- `encrypt-key.js` — vyrábí `src/tmdbKey.enc` z `.env` (spouští jen uživatel svým heslem).
- `tests/` — Playwright testy (viz níže).

## TMDB klíč — bezpečnost

- Skutečný klíč je jen v `.env` (gitignored). **Nikdy ho nevypisovat** — do chatu, logů, testovacích výstupů, commitů.
- V repu je jen šifrovaný blob `src/tmdbKey.enc` (PBKDF2-SHA256 120000 iterací → AES-256-GCM; blob = salt16+iv12+ct+tag16, base64). Heslo zná jen uživatel, **blob v repu nikdy neměnit ani nepřešifrovávat**.
- Na TV se klíč odemkne heslem (brána `#pt-reco-gate`) → localStorage `tizenprehrajto.tmdbKey`.
- Testy si vyrábí **vlastní blob v paměti** s heslem `test` (viz `tests/helper.js`) — committed blob a skutečné heslo se netestují.

## Stránka Doporučení (od v1.13.0)

Netflix-style řady filmových posterů z TMDB API (v3, `api_key` v query, `language=cs-CZ`). Konfigurace řad v `RECO_ROWS` (16 řad; `shuffle: N` = náhodná startovní stránka 0..N-1, `boxed` = červený box, `wide` = postery na šířku). Skupiny po `RECO_GROUP_SIZE = 8` (`.pt-reco-group`) v rytmu 2 běžné · červená · 2 běžné · na šířku · 2 běžné; další skupina se líně donačítá při přechodu dolů z poslední řady. Infinite loading doprava. Fokusovaná karta: žlutý outline, pozadí `#1a1a1a`, **červený nadpis `#be1e1e`**, rating badge, velký backdrop za obsahem (crossfade vrstvy + token proti rychlému přepínání, opacity 0.3). Enter na kartě → uloží pozici do localStorage `tizenprehrajto.recoPos` (skupina/řada/karta + `base` všech řad, TTL 6 h) a hledá titul na `/hledej/<title>`. Po návratu **tlačítkem Zpět** (navigace `back_forward`, `isBackNavigation`) se doporučení **samo otevře na uložené kartě** (`restoreRecoFocus` donačte stránky řady); pozice se tím **spotřebuje** (jinak by každé další načtení oblíbených/sledovaných vracelo do doporučení) a bez Zpět se maže. Manuální klik na přepínač „Doporučení" = vždy od začátku + smazání pozice; BACK/return pozici také maže.

## Scrapování prehrajto (badge, oblíbená)

- Web vrací **429 při ~10 dotazech/min**; anonymně navíc občas stránku úplně bez kontejneru výsledků (`snippet-videoListing-videoListingWrapper`) – obojí = omezení, **nikdy neukládat jako „nedostupné"**.
- Naměřeno 11/2026: **přihlášený ~29 dotazů / klouzavých 60 s**, nepřihlášený ~5; 429 se do limitu nepočítají. Všechny dotazy modu jdou přes limiter (`scrapeAcquire`): přihlášený 20/min (2 souběžně), nepřihlášený 5/min (1); třídy `user` (fokus, celý limit) / `bg` (pozadí, limit − 4 resp. 2) / `idle` (další stránky oblíbených, jen při prázdné frontě). Po 429 se dotaz z okna vyřadí, pauza 10 s (zdvojuje se, max. 60 s). Debug: `localStorage["tizenprehrajto.debug"]="1"`. Měřicí skript: dávka po 1,5 s do prvního 429 v konzoli na prehrajto.cz.
- Výsledky dostupnosti v localStorage `tizenprehrajto.avail5` (klíč `rok|název`) natrvalo, **na pozadí se nic neobnovuje** (429). Na pozadí se dohledávají jen chybějící letošní; starší jen po fokusu ≥ 300 ms. Fokus znovu ověří jen „Nedostupné“/„Bez dabingu“ starší než den — dostupný s dabingem nikdy. Puntík vlevo dole na posteru: šedý = nezjištěno, žlutý = právě se hledá.

## Testování

- **Na TV testovat nejde** — testuje uživatel a dává feedback. Před vydáním vždy ověřit Playwright testy + případně náhledem přes proxy.
- Testy (spouštět **z kořene repa**, potřebují `.env` a build v `dist/`): `test_reco` (19), `test_restore` (20, bez bfcache – Zpět = `page.goBack()`), `test_scroll` (6), `test_ui` (34 – načítání, hlavička, skeleton, řada na šířku, badge dostupnosti, srdíčko, plynulý scroll, Filtry), `test_launch` (12 – start do doporučení, fokus na 1. položku, redirect `/`), `test_badges` (48 – puntík stavu, obnova při fokusu, šířka karet ve hledání s 1 výsledkem, dabing vylučovací metodou, prázdné hledání se ověřuje 2×, hláška při omezeném hledání, starší filmy po fokusu, Doporučené, nejlepší verze v hledání, historie, typografie karet), `test_scrape` (9 – limiter, 429, limit podle přihlášení). Používají `executablePath: '/usr/bin/google-chrome'` a mock HTML stránek prehrajto (route intercept). Limiter dotazů se v testech zrychluje přes `window.__PT_SCRAPE__` (init script před modem).
- `test_scroll` simuluje TV vypnutím `scrollIntoView` — tak se chytají chyby staré platformy.
- Výstup testů: řádky `OK`/`FAIL` — po změně chování modu testy aktualizovat.

## Release — po každé dokončené a otestované změně rovnou vydat

Uživatel chce změny **rovnou vydávat** (testuje je pak na TV). Přesný postup:

1. Bump `version` v `package.json`.
2. `npm run build` (dist/ se commituje).
3. `git add` + commit (zpráva `vX.Y.Z: ...`).
4. **Lightweight tag** `vX.Y.Z` na release commit (uživatel výslovně chce kompletní tagy).
5. `git push origin main vX.Y.Z`.
6. `npm run purge` (jsDelivr).
7. **OVĚŘIT CDN OBSAHEM** — purge hned po pushi může nacachovat starý obsah ("finished" ≠ čerstvé; stalo se u v1.13.1, TV se neaktualizovala):
   ```
   curl -s https://cdn.jsdelivr.net/gh/Croden/TizenPrehrajTo@main/package.json | grep version
   curl -s https://cdn.jsdelivr.net/gh/Croden/TizenPrehrajTo@main/dist/userScript.js | grep -c <novyIdentifikator>
   ```
   Když je verze stará, purge po pár sekundách **opakovat**, dokud CDN neservíruje novou.

## README

README psát pro uživatele repa (co mod umí, instalace v TizenBrew) — **bez** build/release sekcí.
