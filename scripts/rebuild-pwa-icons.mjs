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

/**
 * Raio dos cantos, como fracao do lado. 0 = quadrado.
 *
 * NAO ARREDONDE NENHUM ICONE AQUI. Ja tentamos, e regride.
 *
 * Historico, para nao repetirmos:
 *   1. Icones originais eram squircle com transparencia em volta ->
 *      moldura branca no Windows.
 *   2. Trocamos por quadrados opacos -> resolveu em todo lugar.
 *   3. Arredondamos os "any" a pedido (raio 22%) -> ficou bom no dialogo de
 *      instalacao do Chrome, mas ao fixar na barra de tarefas do Windows a
 *      moldura branca VOLTOU. Canto arredondado e canto transparente, e o
 *      atalho do Windows preenche transparencia com branco.
 *
 * Conclusao: na barra de tarefas, opaco e a unica forma que nunca mostra
 * branco. O arredondamento tem que vir do SO, nao do arquivo:
 *   - Android    -> arredonda sozinho a partir do icone "maskable".
 *   - iOS        -> arredonda sozinho a partir do apple-touch-icon.
 *   - Windows    -> nao arredonda icone de PWA; fica quadrado mesmo, que e
 *                   o comportamento nativo da plataforma.
 *
 * Mantido parametrizavel apenas para registrar a decisao; todos os alvos
 * abaixo usam rounded: false.
 */
const CORNER_RADIUS_RATIO = 0.22;

async function renderIcon(browser, { size, purpose, rounded, outputPath }) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });

  const contentWidth = Math.round(size * CONTENT_RATIO[purpose]);
  const radius = rounded ? Math.round(size * CORNER_RADIUS_RATIO) : 0;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; }
      body { width: ${size}px; height: ${size}px; }
      /* O fundo vive no .icon, nao no body, para que o border-radius recorte
         de verdade e os cantos saiam transparentes no PNG. */
      .icon {
        width: ${size}px;
        height: ${size}px;
        border-radius: ${radius}px;
        background: ${BACKGROUND};
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      /* O SVG mantem a proporcao 120:96 do viewBox; fixamos a largura e a
         altura acompanha, com o flex centralizando nos dois eixos. */
      svg { width: ${contentWidth}px; height: auto; display: block; }
    </style>
  </head>
  <body><div class="icon">${markSvg}</div></body>
</html>`;

  await page.setContent(html, { waitUntil: "load" });
  await page.locator("svg").waitFor({ state: "visible" });
  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width: size, height: size },
    // Precisa ser true para que os cantos fora do border-radius fiquem
    // transparentes em vez de brancos.
    omitBackground: true,
    type: "png",
  });
  await page.close();

  const shape = rounded ? `r=${radius}px` : "quadrado";
  console.log(
    `  ${purpose.padEnd(8)} ${String(size).padStart(3)}px  ${shape.padEnd(11)} ->  ${path.basename(outputPath)}`,
  );
}

const targets = [
  // Manifest, purpose "any": renderizados direto (barra de tarefas do
  // Windows, dialogo de instalacao). Opacos -- ver CORNER_RADIUS_RATIO.
  { size: 192, purpose: "any", rounded: false, dir: brandingDir, file: "infinoos-mark-192.png" },
  { size: 512, purpose: "any", rounded: false, dir: brandingDir, file: "infinoos-mark-512.png" },

  // Manifest, purpose "maskable": o SO recorta -> quadrados.
  { size: 192, purpose: "maskable", rounded: false, dir: brandingDir, file: "infinoos-mark-maskable-192.png" },
  { size: 512, purpose: "maskable", rounded: false, dir: brandingDir, file: "infinoos-mark-maskable-512.png" },

  // apple-touch-icon: quadrado e opaco, o iOS aplica o proprio recorte.
  // Referenciado por `metadata.icons.apple` em src/app/layout.tsx.
  { size: 180, purpose: "any", rounded: false, dir: brandingDir, file: "infinoos-mark-apple-180.png" },

  // Convencao de arquivo do Next (src/app/icon.png e src/app/apple-icon.png).
  // Hoje o `metadata.icons` declarado em src/app/layout.tsx tem precedencia
  // e o <head> aponta para /branding/*, entao estes dois nao chegam a ser
  // referenciados -- mas continuam servidos em /icon.png e /apple-icon.png.
  // Regeramos junto para nao deixar arte velha divergente no repo: se um dia
  // o metadata.icons for removido, o Next passa a usar estes arquivos.
  { size: 512, purpose: "any", rounded: false, dir: appDir, file: "icon.png" },
  { size: 180, purpose: "any", rounded: false, dir: appDir, file: "apple-icon.png" },
];

const browser = await chromium.launch();
try {
  console.log("Gerando icones a partir de infinoos-icon-wms.svg:");
  for (const target of targets) {
    await renderIcon(browser, {
      size: target.size,
      purpose: target.purpose,
      rounded: target.rounded,
      outputPath: path.join(target.dir, target.file),
    });
  }
} finally {
  await browser.close();
}
