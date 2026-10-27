// Disegna il logo di Martucc Fuel e lo esporta in tutte le misure.
// Uso: node logo.cjs <cartella-res-android> <cartella-public> <cartella-anteprime>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [RES, PUB, ANT] = process.argv.slice(2);

// Tutto su una tela 108x108 (l'icona adattiva di Android); la zona sicura
// e il cerchio di raggio 33 al centro.
const FONDO = `
  <defs>
    <radialGradient id="g1" cx="22" cy="18" r="70" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2ff0a8"/><stop offset="0.55" stop-color="#14b8a6" stop-opacity="0.55"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="96" cy="100" r="78" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8b5cf6"/><stop offset="0.5" stop-color="#6d5dfc" stop-opacity="0.6"/><stop offset="1" stop-color="#6d5dfc" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g3" cx="92" cy="10" r="50" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#38bdf8" stop-opacity="0.55"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lucido" x1="0" y1="0" x2="0" y2="108" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="108" height="108" fill="#070a12"/>
  <rect width="108" height="108" fill="url(#g2)"/>
  <rect width="108" height="108" fill="url(#g1)"/>
  <rect width="108" height="108" fill="url(#g3)"/>
  <rect width="108" height="108" fill="url(#lucido)"/>`;

// Il segno: un segnaposto con dentro, in negativo, una goccia di carburante.
const SEGNO_PATH = `
  M54 77.5
  C 50.2 72.2 36 60.5 36 46.5
  A 18 18 0 1 1 72 46.5
  C 72 60.5 57.8 72.2 54 77.5 Z
  M54 34.5
  C 51.4 38.8 46.6 43.6 46.6 49.4
  A 7.4 7.4 0 0 0 61.4 49.4
  C 61.4 43.6 56.6 38.8 54 34.5 Z`;

const segno = (bianco = true, ombra = true) => `
  <defs>
    <linearGradient id="bianco" x1="0" y1="30" x2="0" y2="78" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3f2ff"/>
    </linearGradient>
    <filter id="ombra" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2.2" stdDeviation="2.6" flood-color="#020308" flood-opacity="0.45"/>
    </filter>
  </defs>
  <path d="${SEGNO_PATH}" fill-rule="evenodd" fill="${bianco ? 'url(#bianco)' : '#ffffff'}" ${ombra ? 'filter="url(#ombra)"' : ''}/>`;

// Il puntino verde del «conviene qui», sulla punta del segnaposto.
const PUNTINO = `<circle cx="54" cy="83.2" r="2.6" fill="#2ff0a8"/><circle cx="54" cy="83.2" r="5" fill="#2ff0a8" opacity="0.18"/>`;

const svg = (contenuto, vista = '0 0 108 108') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vista}" width="100%" height="100%">${contenuto}</svg>`;

const pagina = (corpo, forma) => `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden}
  .t{width:100vw;height:100vh;${forma === 'tondo' ? 'border-radius:50%;overflow:hidden;' : forma === 'quadrotto' ? 'border-radius:22.5%;overflow:hidden;' : ''}}
</style></head><body><div class="t">${corpo}</div></body></html>`;

const DENSITA = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const scatta = async (html, lato, file) => {
    await page.setViewportSize({ width: lato, height: lato });
    await page.setContent(html);
    await page.screenshot({ path: file, omitBackground: true });
  };

  // Le icone classiche mostrano il centro della tela adattiva (72 su 108).
  const completo = svg(FONDO + segno() + PUNTINO, '16 16 76 76');

  for (const [d, k] of Object.entries(DENSITA)) {
    const dir = path.join(RES, `mipmap-${d}`);
    await scatta(pagina(svg(FONDO)), Math.round(108 * k), path.join(dir, 'ic_launcher_background.png'));
    await scatta(pagina(svg(segno() + PUNTINO)), Math.round(108 * k), path.join(dir, 'ic_launcher_foreground.png'));
    await scatta(pagina(svg(segno(false, false) + '<circle cx="54" cy="83.2" r="2.6" fill="#ffffff"/>')), Math.round(108 * k), path.join(dir, 'ic_launcher_monochrome.png'));
    await scatta(pagina(completo, 'quadrotto'), Math.round(48 * k), path.join(dir, 'ic_launcher.png'));
    await scatta(pagina(completo, 'tondo'), Math.round(48 * k), path.join(dir, 'ic_launcher_round.png'));
  }

  await scatta(pagina(completo, 'quadrotto'), 512, path.join(PUB, 'icon-512.png'));
  await scatta(pagina(completo, 'quadrotto'), 192, path.join(PUB, 'icon-192.png'));
  await scatta(pagina(completo, 'quadrotto'), 64, path.join(PUB, 'favicon.png'));

  // Anteprime per decidere: le forme che Android puo dare all'icona, e la
  // versione monocromatica su uno sfondo a tema.
  fs.mkdirSync(ANT, { recursive: true });
  await scatta(pagina(completo, 'quadrotto'), 512, path.join(ANT, 'quadrotto.png'));
  await scatta(pagina(completo, 'tondo'), 512, path.join(ANT, 'tondo.png'));
  await scatta(pagina(svg(`<rect width="108" height="108" fill="#d9e6dc"/>` + segno(false, false).replace('fill="#ffffff"', 'fill="#1f3b2a"') + '<circle cx="54" cy="83.2" r="2.6" fill="#1f3b2a"/>', '16 16 76 76'), 'tondo'), 512, path.join(ANT, 'monocromatico.png'));
  fs.writeFileSync(path.join(ANT, 'logo.svg'), svg(FONDO + segno() + PUNTINO));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
