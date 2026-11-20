// Vyrobí ikony aplikace pro LG (icon.png 80×80, largeIcon.png 130×130).
// Spuštění jen při změně vzhledu ikony: node webos/make-icons.js
const { chromium } = require('playwright');
const path = require('path');

const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100">
  <rect x="0" y="0" width="100" height="100" rx="22" fill="#1a1a1a"/>
  <circle cx="50" cy="50" r="34" fill="#be1e1e"/>
  <path d="M42 33 L70 50 L42 67 Z" fill="#fff"/>
  <rect x="16" y="84" width="68" height="5" rx="2.5" fill="#ffb400"/>
</svg>`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage();
  for (const [name, size] of [['icon.png', 80], ['largeIcon.png', 130]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size)}</body></html>`);
    await page.screenshot({ path: path.join(__dirname, name), omitBackground: true });
  }
  await browser.close();
  console.log('ikony hotové');
})();
