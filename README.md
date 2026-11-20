# TizenPrehrajTo

[prehrajto.cz](https://prehrajto.cz/) upravené pro televizi: ovládání dálkovým ovladačem, doporučení filmů ve stylu Netflixu a přehrávání přes celou obrazovku. Funguje na **Samsung TV (Tizen)** přes TizenBrew a na **LG TV (webOS)** jako samostatná aplikace.

## Samsung TV (Tizen)

1. Měj na televizi nainstalovaný [TizenBrew](https://github.com/reisxd/TizenBrew).
2. V TizenBrew otevři správu modulů a přidej modul (včetně `@main` – modul se pak sám aktualizuje):

   ```
   Croden/TizenPrehrajTo@main
   ```

3. Spusť modul – otevře se prehrajto.cz připravené pro TV.

Po vydání nové verze stačí TizenBrew zavřít a znovu otevřít.

## LG TV (webOS)

1. Stáhni aplikaci: **[prehrajto-lg.ipk](https://github.com/Croden/TizenPrehrajTo/raw/main/prehrajto-lg.ipk)**
2. Nainstaluj ji do televize přes [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop) (program pro PC):
   - **Běžná TV (bez rootu):** na [webostv.developer.lge.com](https://webostv.developer.lge.com/) si zdarma založ účet, na TV z LG Content Store nainstaluj aplikaci **Developer Mode**, přihlas se, zapni *Dev Mode Status* a TV restartuj. Pak v Developer Mode zapni *Key Server*, ve webOS Dev Manageru přidej TV (IP adresa a passphrase z aplikace Developer Mode) a nainstaluj staženou `.ipk`.
     Developer Mode platí jen omezenou dobu – v aplikaci Developer Mode ho jde prodloužit; když vyprší, televize nainstalované aplikace odebere.
   - **TV s rootem ([Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel)):** ve webOS Dev Manageru přidej TV a nainstaluj `.ipk` – bez omezení platnosti.
3. Spusť aplikaci **PrehrajTo** ze seznamu aplikací.

Nové verze si aplikace stahuje sama na pozadí a použije je při dalším spuštění, `.ipk` není potřeba kvůli každé změně přeinstalovávat.

## Ovládání

- **Šipky** a **OK** – pohyb a výběr, **Zpět** – předchozí stránka (na oblíbených ukončí aplikaci)
- **Při přehrávání:** OK = pauza/přehrát, šipky doleva/doprava = převíjení, fungují i tlačítka Play/Pause, Stop a převíjení
- **Channel ▲** – zvuková stopa, **Channel ▼** – titulky

Při prvním otevření doporučení je potřeba zadat heslo k API klíči TMDB.
