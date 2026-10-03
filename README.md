# TizenPrehrajTo

Aplikace pro Samsung TV (Tizen), která přináší [prehrajto.cz](https://prehrajto.cz/) na televizní obrazovku – podobně jako TizenTube pro YouTube.

## Co umí

- **Čistá domovská obrazovka** – jen vyhledávání a přihlášení, žádné bannery a reklamy okolo
- **Ovládání dálkovým ovladačem** – šipkami se pohybuješ mezi prvky, Enter vybírá
- **Vyhledávání** – po vyhledání zůstanou jen výsledky a filtry, první video se rovnou zaměří
- **Přehrávání přes celou obrazovku** – video se po otevření samo spustí ve fullscreenu
  - **Enter** – pauza / přehrát (při pauze se zobrazí název a hodnocení videa)
  - **šipky doleva/doprava** – skok o 10 s zpět/vpřed
  - fungují i mediální tlačítka (Play/Pause, Stop, převíjení)
- **Tlačítko Zpět** – vrací na předchozí stránku, na domovské obrazovce ukončí aplikaci

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

- **CSS** → [`src/userStyles.css`](src/userStyles.css)
- **JS** → funkce `customJs()` v [`src/userScript.js`](src/userScript.js)
