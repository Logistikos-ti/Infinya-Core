/**
 * Gera os PNGs do PWA a partir do SVG vetorial da marca.
 *
 * Historico do bug da "moldura branca":
 *  - Os PNGs originais eram um squircle: tinham fundo proprio (navy mais
 *    claro) + cantos arredondados desenhados + transparencia em volta. Nas
 *    plataformas que renderizam sem recorte, a transparencia virava branco.
 *  - A primeira tentativa de correcao reaproveitou esse PNG, colando-o
 *    reduzido sobre um quadrado escuro. Isso so trocou um problema por
 *    outro: o fundo mais claro do squircle passou a aparecer como uma
 *    moldura visivel dentro do quadrado.
 *
 * Correcao definitiva: renderizar direto do SVG (arte pura, sem fundo)
 * sobre um quadrado inteiro com o fundo do brand. Sem formas aninhadas,
 * sem cantos arredondados no arquivo -- o recorte fica por conta do SO.
 *
 * Sao gerados dois conjuntos, porque as duas finalidades pedem escalas
 * diferentes da arte:
 *  - purpose "any": renderizado direto (taskbar do Windows, dialogo de
 *    instalacao do Chrome, apple-touch-icon). Arte grande, preenche bem.
 *  - purpose "maskable": o SO recorta num circulo/squircle. A arte precisa
 *    caber na safe zone (circulo de 80% do lado), entao vai menor.
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
const appDir = path.resolve(__dirname, "..", "src", "app");

const markSvg = readFileSync(path.join(brandingDir, "infinoos-icon-wms.svg"), "utf-8");

/**
 * Fundo do brand. Gradiente radial sutil (mesma leitura do icone original)
 * terminando no #040816 do theme_color/background_color do manifest.
 */
const BACKGROUND = "radial-gradient(circle at 50% 42%, #16244e 0%, #0a1231 55%, #040816 100%)";

/**
 * Fracao do lado do icone ocupada pela largura da arte.
 *
 * Para maskable a safe zone e um circulo de diametro 0.8*N. Com a arte na
 * proporcao 120:96 do viewBox, a meia-diagonal e w*sqrt(0.25 + 0.16) =
 * 0.640*w, e exigir 0.640*w <= 0.40*N da w <= 0.625*N. Usamos 0.62 para
 * ficar dentro do limite com uma folga minima.
 */
const CONTENT_RATIO = { any: 0.8, maskable: 0.62 };

async function renderIcon(browser, { size, purpose, outputPath }) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });

  const contentWidth = Math.round(size * CONTENT_RATIO[purpose]);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; }
      body {
        width: ${size}px;
        height: ${size}px;
        background: ${BACKGROUND};
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      /* O SVG mantem a proporcao 120:96 do viewBox; fixamos a largura e a
         altura acompanha, com o flex centralizando nos dois eixos. */
      svg { width: ${contentWidth}px; height: auto; display: block; }
    </style>
  </head>
  <body>${markSvg}</body>
</html>`;

  await page.setContent(html, { waitUntil: "load" });
  await page.locator("svg").waitFor({ state: "visible" });
  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: false,
    type: "png",
  });
  await page.close();

  console.log(`  ${purpose.padEnd(8)} ${String(size).padStart(3)}px  ->  ${path.basename(outputPath)}`);
}

const targets = [
  // Icones referenciados pelo manifest.
  { size: 192, purpose: "any", dir: brandingDir, file: "infinoos-mark-192.png" },
  { size: 512, purpose: "any", dir: brandingDir, file: "infinoos-mark-512.png" },
  { size: 192, purpose: "maskable", dir: brandingDir, file: "infinoos-mark-maskable-192.png" },
  { size: 512, purpose: "maskable", dir: brandingDir, file: "infinoos-mark-maskable-512.png" },

  // Convencao de arquivo do Next (src/app/icon.png e src/app/apple-icon.png).
  // Hoje o `metadata.icons` declarado em src/app/layout.tsx tem precedencia
  // e o <head> aponta para /branding/*, entao estes dois nao chegam a ser
  // referenciados -- mas continuam servidos em /icon.png e /apple-icon.png.
  // Regeramos junto para nao deixar arte velha divergente no repo: se um dia
  // o metadata.icons for removido, o Next passa a usar estes arquivos.
  { size: 512, purpose: "any", dir: appDir, file: "icon.png" },
  // 180px e o tamanho canonico do apple-touch-icon. A Apple aplica o proprio
  // recorte e nao lida bem com transparencia, entao vai quadrado e opaco.
  { size: 180, purpose: "any", dir: appDir, file: "apple-icon.png" },
];

const browser = await chromium.launch();
try {
  console.log("Gerando icones a partir de infinoos-icon-wms.svg:");
  for (const target of targets) {
    await renderIcon(browser, {
      size: target.size,
      purpose: target.purpose,
      outputPath: path.join(target.dir, target.file),
    });
  }
} finally {
  await browser.close();
}
