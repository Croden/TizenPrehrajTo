# TizenPrehrajTo

Aplikace pro Samsung TV (Tizen), která přináší [prehrajto.cz](https://prehrajto.cz/) na televizní obrazovku – podobně jako TizenTube pro YouTube.

## Co umí

- **Oblíbená videa jako úvodní stránka** – nahoře vyhledávání a info o premiu, pod tím oblíbená videa přes celou šířku obrazovky
- **Přepínač pod vyhledáváním** – přepíná mezi oblíbenými a právě sledovanými videi
- **Ovládání dálkovým ovladačem** – šipkami se pohybuješ mezi prvky, Enter vybírá
  - šipky doleva/doprava přepínají mezi videi, šipka dolů zaměří srdíčko pro přidání/odebrání z oblíbených, další stisk pokračuje v mřížce dolů
  - srdíčko přidá i odebere video z oblíbených na jeden stisk (dialog s výběrem seznamů se vyřídí automaticky)
- **Vyhledávání** – po vyhledání zůstanou jen výsledky a filtry, první video se rovnou zaměří; Zpět zavře klávesnici a rovnou označí první návrh našeptávače, šipky nahoru/dolů vybírají návrhy, Enter otevírá a šipka nahoru z prvního návrhu vrací do vyhledávání
- **Přehrávání přes celou obrazovku** – video se po otevření samo spustí ve fullscreenu
  - **Enter** – pauza / přehrát (při pauze se zobrazí název a hodnocení videa)
  - **šipky doleva/doprava** – skok zpět/vpřed
  - fungují i mediální tlačítka (Play/Pause, Stop, převíjení)
  - **Channel ▲** – přepíná zvukovou stopu, **Channel ▼** – přepíná titulky (pokud je video má)
- **Tlačítko Zpět** – vrací na předchozí stránku; ve vyhledávání přejde na návrhy našeptávače (bez návrhů jen zruší fokus), na úvodní obrazovce ukončí aplikaci

## Instalace

1. Měj na televizi nainstalovaný [TizenBrew](https://github.com/reisxd/TizenBrew)
2. V TizenBrew otevři správu modulů a přidej modul (včetně `@main` – modul se pak sám aktualizuje):

   ```
   Croden/TizenPrehrajTo@main
   ```

3. Spusť modul – otevře se prehrajto.cz připravené pro TV

Po vydání nové verze stačí TizenBrew zavřít a znovu otevřít, modul není potřeba přeinstalovávat.

## Jak to funguje

Jde o TizenBrew modul typu `mods`: TizenBrew otevře prehrajto.cz a do stránky vstříkne skript ([dist/userScript.js](dist/userScript.js)), který přidá styly pro TV, ovládání dálkovým ovladačem a automatické přehrávání. Samotný web se nijak nemění.

## Vlastní úpravy

- **CSS** → [`src/appStyles.css`](src/appStyles.css)
- **JS** → [`src/userScript.js`](src/userScript.js)
