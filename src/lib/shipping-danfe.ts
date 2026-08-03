import { parseNfeXml, type ParsedNfe } from "@/lib/nfe-import";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 4 x 6 inches at 72 dpi, suitable for thermal label printers.
const PAGE_WIDTH = 288;
const PAGE_HEIGHT = 432;
const MARGIN = 14;
const BLACK = [0, 0, 0] as const;
const DARK = [0.12, 0.12, 0.12] as const;
const GRAY = [0.45, 0.45, 0.45] as const;
const LIGHT = [0.93, 0.93, 0.93] as const;
const LOGO_JPEG_BASE64 = "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";

export function buildSimplifiedDanfePdfFromXml(xml: string, options?: { carrierName?: string | null }) {
  return buildSimplifiedDanfePdf(parseNfeXml(xml), options);
}

export function buildFullDanfePdfFromXml(xml: string, options?: { carrierName?: string | null }) {
  const parsed = parseNfeXml(xml);
  const accessKey = digitsOnly(parsed.accessKey);
  const carrierName = options?.carrierName?.trim() || parsed.carrierName || "NAO INFORMADO";
  const operations: string[] = [];
  const width = 595;
  const height = 842;
  const margin = 28;

  drawJpeg(operations, margin, 750, 165, 60);
  strokeRect(operations, margin, 742, width - margin * 2, 72, BLACK, 1.1);
  line(operations, 395, 742, 395, 814, BLACK, 0.8);
  text(operations, 411, 787, "DOCUMENTO AUXILIAR DA", 8, DARK, true);
  text(operations, 411, 771, "NOTA FISCAL ELETRONICA", 12, BLACK, true);
  text(operations, 411, 755, `NF-e ${safeAscii(parsed.noteNumber)} | SERIE 1`, 9, BLACK, true);

  fullField(operations, margin, 680, 270, 54, "EMITENTE", safeAscii(parsed.supplierName), `CNPJ: ${safeAscii(parsed.supplierDocument ?? "NAO INFORMADO")}`);
  fullField(operations, 302, 680, 265, 54, "DESTINATARIO / REMETENTE", safeAscii(parsed.recipientName), safeAscii(parsed.recipientAddress ?? "NAO INFORMADO"));
  fullField(operations, margin, 625, 170, 44, "DATA DE EMISSAO", formatDateTime(parsed.issuedAt));
  fullField(operations, 200, 625, 180, 44, "TRANSPORTADORA", safeAscii(carrierName));
  fullField(operations, 380, 625, 187, 44, "VALOR TOTAL", parsed.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

  text(operations, margin, 603, "ITENS DA NOTA FISCAL", 9, BLACK, true);
  tableHeader(operations, margin, 580, [30, 85, 275, 85, 64], ["#", "CODIGO", "DESCRICAO", "NCM", "QTD"]);
  let rowY = 562;
  parsed.items.slice(0, 20).forEach((item, index) => {
    if (index % 2 === 0) fillRect(operations, margin, rowY - 6, 539, 17, LIGHT);
    text(operations, margin + 9, rowY, String(index + 1), 7.5, DARK, false);
    text(operations, margin + 34, rowY, truncate(safeAscii(item.codigo ?? item.ean ?? "-"), 15), 7.5, DARK, false);
    text(operations, margin + 119, rowY, truncate(safeAscii(item.descricao), 47), 7.5, DARK, false);
    text(operations, margin + 394, rowY, truncate(safeAscii(item.ncm ?? "-"), 13), 7.5, DARK, false);
    text(operations, margin + 512, rowY, item.quantidade.toLocaleString("pt-BR"), 7.5, DARK, false);
    line(operations, margin, rowY - 7, width - margin, rowY - 7, [0.75, 0.75, 0.75], 0.3);
    rowY -= 17;
  });
  if (parsed.items.length > 20) text(operations, margin, rowY, `+ ${parsed.items.length - 20} itens nao exibidos nesta pagina`, 7, GRAY, false);

  const bottomY = 130;
  fullField(operations, margin, bottomY + 76, 175, 48, "VOLUMES", String(Math.max(1, parsed.volumeCount)));
  fullField(operations, 203, bottomY + 76, 175, 48, "PESO BRUTO", parsed.grossWeight != null ? `${parsed.grossWeight.toLocaleString("pt-BR")} kg` : "NAO INFORMADO");
  fullField(operations, 378, bottomY + 76, 189, 48, "PROTOCOLO", safeAscii(parsed.protocolNumber ?? "NAO INFORMADO"));
  strokeRect(operations, margin, bottomY, width - margin * 2, 66, BLACK, 0.8);
  text(operations, margin + 8, bottomY + 51, "CHAVE DE ACESSO", 7.5, BLACK, true);
  if (accessKey.length === 44) {
    drawCode128(operations, accessKey, margin + 8, bottomY + 18, width - margin * 2 - 16, 26);
    text(operations, margin + 8, bottomY + 8, accessKey, 7, BLACK, false);
  } else {
    text(operations, margin + 8, bottomY + 25, "CHAVE DE ACESSO NAO INFORMADA NO XML", 8, BLACK, true);
  }
  text(operations, margin, 48, `NF-e ${safeAscii(parsed.noteNumber)} | Documento fiscal completo`, 7.2, GRAY, false);
  text(operations, width - margin - 56, 48, "Pagina 1 de 1", 7.2, GRAY, false);

  return createSimplePdf(operations.join("\n"), width, height);
}

/**
 * Renders the complete fiscal-document preview used by the "Nota fiscal"
 * action. The thermal 4x6 DANFE remains a separate operational document.
 */
export function buildInvoicePreviewHtmlFromXml(xml: string, options?: { carrierName?: string | null }) {
  const parsed = parseNfeXml(xml);
  const carrierName = options?.carrierName?.trim() || parsed.carrierName || "Nao informado";
  const issuedAt = parsed.issuedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(parsed.issuedAt))
    : "Nao informada";
  const total = parsed.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const accessKey = parsed.accessKey || "Nao informada";
  const itemRows = parsed.items
    .map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.codigo || item.ean || "-")}</td>
        <td>${escapeHtml(item.descricao)}</td>
        <td>${escapeHtml(item.ncm || "-")}</td>
        <td class="number">${item.quantidade.toLocaleString("pt-BR")}</td>
      </tr>`)
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NF-e ${escapeHtml(parsed.noteNumber)}</title>
  <style>
    @page { size: A4 portrait; margin: 11mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font: 12px/1.38 Arial, Helvetica, sans-serif; }
    .page { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto; padding: 11mm; background: #fff; }
    .header { display: grid; grid-template-columns: 1fr 155px; border: 2px solid #0f172a; }
    .brand { min-height: 92px; padding: 16px; border-right: 1px solid #0f172a; }
    .brand h1 { margin: 0; font-size: 22px; letter-spacing: .06em; }
    .brand p { margin: 6px 0 0; color: #475569; font-size: 11px; }
    .nf-id { display: grid; place-items: center; padding: 12px; text-align: center; }
    .nf-id strong { font-size: 17px; }
    .nf-id span { display: block; margin-top: 4px; font-size: 11px; }
    .section { margin-top: 10px; border: 1px solid #0f172a; }
    .section-title { margin: 0; padding: 5px 8px; border-bottom: 1px solid #0f172a; background: #e2e8f0; font-size: 10px; letter-spacing: .05em; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .field { min-height: 48px; padding: 7px 8px; border-right: 1px solid #cbd5e1; }
    .field:last-child { border-right: 0; }
    .field label { display: block; margin-bottom: 4px; color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .field strong { display: block; font-size: 12px; overflow-wrap: anywhere; }
    .wide { grid-column: 1 / -1; border-top: 1px solid #cbd5e1; border-right: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 6px 7px; background: #0f172a; color: #fff; font-size: 9px; text-align: left; text-transform: uppercase; }
    td { padding: 7px; border-top: 1px solid #cbd5e1; font-size: 10px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .number { text-align: right; white-space: nowrap; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .summary .field { min-height: 54px; }
    .barcode { margin-top: 10px; border: 1px solid #0f172a; padding: 10px; }
    .barcode .bars { height: 42px; margin-top: 7px; background: repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 4px, #111 4px 5px, transparent 5px 8px); }
    .barcode code { display: block; margin-top: 5px; text-align: center; font-size: 10px; letter-spacing: .11em; overflow-wrap: anywhere; }
    .footer { margin-top: 10px; color: #64748b; font-size: 10px; text-align: right; }
    @media print { body { background: #fff; } .page { width: auto; min-height: auto; padding: 0; } }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="brand"><h1>NOTA FISCAL ELETRONICA</h1><p>Documento fiscal completo anexado ao pedido</p></div>
      <div class="nf-id"><strong>NF-e ${escapeHtml(parsed.noteNumber)}</strong><span>Serie 1</span><span>${parsed.direction}</span></div>
    </header>
    <section class="section"><h2 class="section-title">Emitente</h2><div class="grid"><div class="field wide"><label>Razao social</label><strong>${escapeHtml(parsed.supplierName)}</strong></div><div class="field"><label>CNPJ / CPF</label><strong>${escapeHtml(parsed.supplierDocument || "Nao informado")}</strong></div><div class="field"><label>Data de emissao</label><strong>${escapeHtml(issuedAt)}</strong></div><div class="field"><label>Protocolo</label><strong>${escapeHtml(parsed.protocolNumber || "Nao informado")}</strong></div></div></section>
    <section class="section"><h2 class="section-title">Destinatario / Remetente</h2><div class="grid"><div class="field wide"><label>Nome / Razao social</label><strong>${escapeHtml(parsed.recipientName)}</strong></div><div class="field"><label>CNPJ / CPF</label><strong>${escapeHtml(parsed.recipientDocument || "Nao informado")}</strong></div><div class="field wide"><label>Endereco completo</label><strong>${escapeHtml(parsed.recipientAddress || "Nao informado")}</strong></div></div></section>
    <section class="section"><h2 class="section-title">Itens da nota fiscal</h2><table><thead><tr><th>#</th><th>Codigo</th><th>Descricao</th><th>NCM</th><th class="number">Quantidade</th></tr></thead><tbody>${itemRows}</tbody></table></section>
    <section class="section"><h2 class="section-title">Totais e transporte</h2><div class="summary"><div class="field"><label>Valor total da nota</label><strong>${total}</strong></div><div class="field"><label>Volumes</label><strong>${Math.max(1, parsed.volumeCount)}</strong></div><div class="field"><label>Transportadora</label><strong>${escapeHtml(carrierName)}</strong></div></div></section>
    <section class="barcode"><strong>Chave de acesso</strong><div class="bars"></div><code>${escapeHtml(accessKey)}</code></section>
    <footer class="footer">NF-e ${escapeHtml(parsed.noteNumber)} | Documento fiscal completo</footer>
  </main>
</body>
</html>`;
}

export function buildSimplifiedDanfePdf(parsed: ParsedNfe, options?: { carrierName?: string | null }) {
  const accessKey = digitsOnly(parsed.accessKey);
  const carrierName = options?.carrierName?.trim() || parsed.carrierName || "NAO INFORMADO";
  const operations: string[] = [];

  drawJpeg(operations, 14, 386, 110, 41);
  line(operations, MARGIN, 382, PAGE_WIDTH - MARGIN, 382, BLACK, 1.2);

  boxedField(operations, 14, 350, 112, 29, "NF-E", parsed.noteNumber);
  boxedField(operations, 130, 350, 70, 29, "SERIE", "1");
  boxedField(operations, 204, 350, 70, 29, "TIPO", parsed.direction === "SAIDA" ? "SAIDA" : "ENTRADA");

  boxedField(
    operations,
    14,
    296,
    260,
    46,
    "DESTINATARIO",
    truncate(safeAscii(parsed.recipientName), 43),
    wrapText(safeAscii(parsed.recipientAddress ?? "NAO INFORMADO"), 46),
  );
  boxedField(
    operations,
    14,
    246,
    260,
    40,
    "EMITENTE",
    truncate(safeAscii(parsed.supplierName), 43),
    `CNPJ: ${parsed.supplierDocument ?? "NAO INFORMADO"}`,
  );

  text(operations, 14, 232, "ITENS DA NOTA", 7, BLACK, true);
  line(operations, 14, 227, 274, 227, BLACK, 0.8);
  tableHeader(operations, 14, 209, [25, 62, 143, 30], ["#", "CODIGO", "DESCRICAO", "QTD"]);
  const visibleItems = parsed.items.slice(0, 5);
  let itemY = 194;
  visibleItems.forEach((item, index) => {
    if (index % 2 === 0) fillRect(operations, 14, itemY - 5, 260, 13, LIGHT);
    text(operations, 21, itemY, String(index + 1), 6.1, DARK, false);
    text(operations, 43, itemY, truncate(safeAscii(item.codigo ?? item.ean ?? "-"), 11), 6.1, DARK, false);
    text(operations, 89, itemY, truncate(safeAscii(item.descricao), 26), 6.1, DARK, false);
    text(operations, 244, itemY, item.quantidade.toLocaleString("pt-BR"), 6.1, DARK, false);
    line(operations, 14, itemY - 6, 274, itemY - 6, [0.75, 0.75, 0.75], 0.3);
    itemY -= 13;
  });
  if (parsed.items.length > visibleItems.length) {
    text(operations, 14, itemY, `+${parsed.items.length - visibleItems.length} item(ns)`, 6.5, GRAY, false);
    itemY -= 14;
  }

  const volumeTotal = Math.max(1, parsed.volumeCount);
  boxedField(operations, 14, 113, 84, 28, "TOTAL", parsed.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  boxedField(operations, 102, 113, 84, 28, "VOLUME", `1/${volumeTotal}`);
  boxedField(operations, 190, 113, 84, 28, "ENVIO", carrierName);

  text(operations, 14, 99, `PESO BRUTO: ${parsed.grossWeight != null ? `${parsed.grossWeight.toLocaleString("pt-BR")} kg` : "NAO INFORMADO"}`, 5.8, DARK, false);
  text(operations, 14, 90, `DADOS: ${truncate(safeAscii(parsed.additionalInfo ?? "Sem informacoes adicionais"), 54)}`, 5.8, DARK, false);
  text(operations, 14, 79, "CHAVE DE ACESSO - BIPAR PARA LIBERAR ROMANEIO", 6.2, BLACK, true);
  if (accessKey.length === 44) {
    drawCode128(operations, accessKey, 14, 40, 260, 34);
    text(operations, 14, 31, accessKey, 6.2, BLACK, false);
  } else {
    text(operations, 14, 53, "CHAVE NAO INFORMADA NO XML", 8, BLACK, true);
  }

  line(operations, MARGIN, 25, PAGE_WIDTH - MARGIN, 25, BLACK, 0.8);
  text(operations, 14, 13, `NF ${safeAscii(parsed.noteNumber)} | Documento operacional`, 6.3, GRAY, false);
  text(operations, 206, 13, "4 x 6", 6.3, GRAY, false);

  return createSimplePdf(operations.join("\n"));
}

function boxedField(operations: string[], x: number, y: number, width: number, height: number, label: string, value: string, secondary?: string | string[]) {
  strokeRect(operations, x, y, width, height, BLACK, 0.7);
  text(operations, x + 5, y + height - 10, label, 5.7, GRAY, true);
  text(operations, x + 5, secondary ? y + height - 23 : y + 7, truncate(safeAscii(value), Math.max(8, Math.floor(width / 4.4))), 7.2, BLACK, true);
  if (secondary) {
    if (Array.isArray(secondary)) {
      secondary.slice(0, 3).forEach((lineValue, index) => {
        text(operations, x + 5, y + 16 - index * 8, lineValue, 5.8, DARK, false);
      });
    } else {
      text(operations, x + 5, y + 7, truncate(safeAscii(secondary), Math.max(8, Math.floor(width / 4.1))), 5.8, DARK, false);
    }
  }
}

function fullField(operations: string[], x: number, y: number, width: number, height: number, label: string, value: string, secondary?: string) {
  strokeRect(operations, x, y, width, height, BLACK, 0.7);
  text(operations, x + 6, y + height - 11, label, 6.2, GRAY, true);
  text(operations, x + 6, secondary ? y + height - 25 : y + 11, truncate(value, Math.max(12, Math.floor(width / 4.5))), 8, BLACK, true);
  if (secondary) text(operations, x + 6, y + 10, truncate(secondary, Math.max(12, Math.floor(width / 5.1))), 6.9, DARK, false);
}

function wrapText(value: string, maxLength: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["NAO INFORMADO"];
}

function tableHeader(operations: string[], x: number, y: number, widths: number[], labels: string[]) {
  fillRect(operations, x, y, widths.reduce((sum, width) => sum + width, 0), 14, BLACK);
  let currentX = x;
  labels.forEach((label, index) => {
    text(operations, currentX + 5, y + 4, label, 5.8, [1, 1, 1], true);
    currentX += widths[index];
  });
}

function drawJpeg(operations: string[], x: number, y: number, width: number, height: number) {
  operations.push("q", `${width} 0 0 ${height} ${x} ${y} cm`, "/Im1 Do", "Q");
}

function drawCode128(operations: string[], value: string, x: number, y: number, width: number, height: number) {
  const patterns = encodeCode128C(value);
  const totalModules = patterns.reduce((sum, pattern) => sum + pattern.split("").reduce((a, n) => a + Number(n), 0), 0);
  const moduleWidth = Math.min(1.05, width / totalModules);
  let cursor = x;
  patterns.forEach((pattern) => {
    let black = true;
    for (const character of pattern) {
      const barWidth = Number(character) * moduleWidth;
      if (black) fillRect(operations, cursor, y, barWidth, height, BLACK);
      cursor += barWidth;
      black = !black;
    }
  });
}

function encodeCode128C(value: string) {
  const normalized = value.length % 2 === 0 ? value : `0${value}`;
  const values = [105];
  for (let index = 0; index < normalized.length; index += 2) values.push(Number(normalized.slice(index, index + 2)));
  const checksum = values.reduce((sum, current, index) => sum + current * (index === 0 ? 1 : index), 0) % 103;
  return [...values, checksum, 106].map((value) => CODE128_PATTERNS[value]);
}

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

function createSimplePdf(contentStream: string, pageWidth = PAGE_WIDTH, pageHeight = PAGE_HEIGHT) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`,
    createJpegObject(),
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function createJpegObject() {
  const image = readFileSync(join(process.cwd(), "public", "infinoos-lockup-gray.jpg"));
  return `<< /Type /XObject /Subtype /Image /Width 440 /Height 161 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n${image.toString("latin1")}\nendstream`;
}

function text(operations: string[], x: number, y: number, value: string, size: number, color: readonly [number, number, number], _bold: boolean) {
  operations.push(`${color[0]} ${color[1]} ${color[2]} rg`, "BT", `/F1 ${size} Tf`, `${x} ${y} Td`, `(${escapePdfString(value)}) Tj`, "ET");
}

function fillRect(operations: string[], x: number, y: number, width: number, height: number, color: readonly [number, number, number]) {
  operations.push(`${color[0]} ${color[1]} ${color[2]} rg`, `${x} ${y} ${width} ${height} re f`);
}

function strokeRect(operations: string[], x: number, y: number, width: number, height: number, color: readonly [number, number, number], lineWidth: number) {
  operations.push(`${color[0]} ${color[1]} ${color[2]} RG`, `${lineWidth} w`, `${x} ${y} ${width} ${height} re S`);
}

function line(operations: string[], x1: number, y1: number, x2: number, y2: number, color: readonly [number, number, number], lineWidth: number) {
  operations.push(`${color[0]} ${color[1]} ${color[2]} RG`, `${lineWidth} w`, `${x1} ${y1} m ${x2} ${y2} l S`);
}

function escapePdfString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r?\n/g, " ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function digitsOnly(value: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function safeAscii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 3))}...` : value;
}

function formatDateTime(value: string | null) {
  if (!value) return "NAO INFORMADA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeAscii(value);
  return safeAscii(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(date));
}
