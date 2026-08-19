/**
 * Reconstrói os PNGs do PWA para eliminar a borda branca vista no dock/launcher.
 *
 * Problema: o PNG original já vinha com cantos arredondados desenhados e
 * transparência ao redor. Nas plataformas que renderizam o ícone direto
 * (Windows dock, macOS), a área transparente vira fundo branco. Nas que
 * aplicam recorte adaptativo (maskable), como o PNG não tem safe zone de
 * padding, o recorte come parte da arte.
 *
 * Solução: gerar novos PNGs 192 e 512 com o quadrado inteiro preenchido com
 * o fundo do brand (#040816), sem cantos arredondados, com a arte central
 * ocupando ~66% (safe zone maskable ~17% de padding em cada lado).
 *
 * Uso:
 *   node scripts/rebuild-pwa-icons.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandingDir = path.resolve(__dirname, "..", "public", "branding");

const sourcePng = path.join(brandingDir, "infinoos-mark-512.png");
const sourceBase64 = readFileSync(sourcePng).toString("base64");
const sourceDataUrl = `data:image/png;base64,${sourceBase64}`;

const BG = "#040816";
// 66% de conteúdo → 17% de padding de cada lado. Cobre a safe zone maskable
// (círculo inscrito precisa de ~20% de folga) sem encolher demais a arte.
const CONTENT_RATIO = 0.66;

async function renderIcon(browser, size, outputPath) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const contentSize = Math.round(size * CONTENT_RATIO);
  const offset = Math.round((size - contentSize) / 2);
  const html = `<!doctype html><html><head><style>
    html,body { margin: 0; padding: 0; background: ${BG}; }
    body { width: ${size}px; height: ${size}px; display: block; }
    img { position: absolute; left: ${offset}px; top: ${offset}px; width: ${contentSize}px; height: ${contentSize}px; }
  </style></head><body><img src="${sourceDataUrl}" /></body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  await page.locator("img").waitFor({ state: "visible" });
  const clip = { x: 0, y: 0, width: size, height: size };
  await page.screenshot({ path: outputPath, clip, omitBackground: false, type: "png" });
  await page.close();
  console.log(`wrote ${outputPath}`);
}

const browser = await chromium.launch();
try {
  await renderIcon(browser, 192, path.join(brandingDir, "infinoos-mark-192.png"));
  await renderIcon(browser, 512, path.join(brandingDir, "infinoos-mark-512.png"));
  await renderIcon(browser, 512, path.join(brandingDir, "infinoos-mark-maskable-512.png"));
} finally {
  await browser.close();
}
