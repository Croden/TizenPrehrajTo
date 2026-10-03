# TizenPrehrajTo

TizenBrew modul pro Samsung TV – wrapper webu [prehrajto.cz](https://prehrajto.cz/) s možností vložit vlastní CSS a JS.

## Jak to funguje

TizenBrew modul typu `mods` otevře `https://prehrajto.cz/` a injektuje do stránky
`dist/userScript.js`. Ten vloží vlastní styly, zaregistruje mediální klávesy
ovladače (Play/Pause/Stop/FF/RW) a tlačítko Zpět mapuje na historii prohlížeče
(na úvodní stránce Zpět appku ukončí).

## Vlastní úpravy

- **CSS** → [`src/userStyles.css`](src/userStyles.css)
- **JS** → funkce `customJs()` v [`src/userScript.js`](src/userScript.js)

Po změně:

```sh
npm run build   # vygeneruje dist/userScript.js (commituje se!)
```

## Instalace do TV

1. Pushni repo na GitHub (veřejné) a vytvoř tag, např. `v1.0.0`.
2. V TizenBrew na TV přidej modul: `gh/<github-user>/<nazev-repa>`.

## Vydání nové verze

jsDelivr (přes který TizenBrew moduly stahuje) agresivně cachuje:

1. Zvyš `version` v `package.json`.
2. `npm run build`, commit, push.
3. Vytvoř nový git tag (`git tag v1.0.1 && git push --tags`).
4. Případně vynuť obnovu cache: `https://purge.jsdelivr.net/gh/<user>/<repo>@latest/package.json`
5. V TizenBrew modul aktualizuj/znovu načti.
