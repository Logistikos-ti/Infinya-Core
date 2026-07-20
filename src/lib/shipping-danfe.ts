import { parseNfeXml } from "@/lib/nfe-import";

// 4 x 6 inches at 72 dpi, suitable for thermal label printers.
const PAGE_WIDTH = 288;
const PAGE_HEIGHT = 432;
const MARGIN = 14;
const BLACK = [0, 0, 0] as const;
const DARK = [0.12, 0.12, 0.12] as const;
const GRAY = [0.45, 0.45, 0.45] as const;
const LIGHT = [0.93, 0.93, 0.93] as const;
const LOGO_JPEG_BASE64 = "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";

export function buildSimplifiedDanfePdfFromXml(xml: string) {
  const parsed = parseNfeXml(xml);
  const accessKey = digitsOnly(parsed.accessKey);
  const operations: string[] = [];

  drawJpeg(operations, 14, 392, 28, 28);
  text(operations, 48, 412, "INFINOOS", 13, BLACK, true);
  text(operations, 48, 399, "WMS", 8, BLACK, true);
  text(operations, 86, 399, "DANFE SIMPLIFICADA", 6.4, GRAY, true);
  line(operations, MARGIN, 387, PAGE_WIDTH - MARGIN, 387, BLACK, 1.2);

  boxedField(operations, 14, 350, 112, 29, "NF-E", parsed.noteNumber);
  boxedField(operations, 130, 350, 70, 29, "SERIE", "1");
  boxedField(operations, 204, 350, 70, 29, "TIPO", parsed.direction === "SAIDA" ? "SAIDA" : "ENTRADA");

  boxedField(operations, 14, 311, 260, 31, "DESTINATARIO", truncate(safeAscii(parsed.recipientName), 43));
  boxedField(operations, 14, 272, 260, 31, "EMITENTE", truncate(safeAscii(parsed.supplierName), 43));

  text(operations, 14, 258, "ITENS DA NOTA", 7, BLACK, true);
  line(operations, 14, 253, 274, 253, BLACK, 0.8);
  tableHeader(operations, 14, 235, [25, 62, 143, 30], ["#", "CODIGO", "DESCRICAO", "QTD"]);
  const visibleItems = parsed.items.slice(0, 5);
  let itemY = 220;
  visibleItems.forEach((item, index) => {
    if (index % 2 === 0) fillRect(operations, 14, itemY - 5, 260, 19, LIGHT);
    text(operations, 21, itemY, String(index + 1), 6.5, DARK, false);
    text(operations, 43, itemY, truncate(safeAscii(item.codigo ?? item.ean ?? "-"), 11), 6.5, DARK, false);
    text(operations, 89, itemY, truncate(safeAscii(item.descricao), 26), 6.5, DARK, false);
    text(operations, 244, itemY, item.quantidade.toLocaleString("pt-BR"), 6.5, DARK, false);
    line(operations, 14, itemY - 6, 274, itemY - 6, [0.75, 0.75, 0.75], 0.3);
    itemY -= 19;
  });
  if (parsed.items.length > visibleItems.length) {
    text(operations, 14, itemY, `+${parsed.items.length - visibleItems.length} item(ns)`, 6.5, GRAY, false);
    itemY -= 14;
  }

  boxedField(operations, 14, 113, 84, 28, "TOTAL", parsed.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  boxedField(operations, 102, 113, 84, 28, "VOLUMES", parsed.volumeCount.toLocaleString("pt-BR"));
  boxedField(operations, 190, 113, 84, 28, "EMISSAO", formatDateTime(parsed.issuedAt));

  text(operations, 14, 99, "CHAVE DE ACESSO - BIPAR PARA LIBERAR ROMANEIO", 6.2, BLACK, true);
  if (accessKey.length === 44) {
    drawCode128(operations, accessKey, 14, 58, 260, 34);
    text(operations, 14, 48, accessKey, 6.2, BLACK, false);
  } else {
    text(operations, 14, 72, "CHAVE NAO INFORMADA NO XML", 8, BLACK, true);
  }

  line(operations, MARGIN, 35, PAGE_WIDTH - MARGIN, 35, BLACK, 0.8);
  text(operations, 14, 22, `NF ${safeAscii(parsed.noteNumber)} | Documento operacional`, 6.3, GRAY, false);
  text(operations, 206, 22, "4 x 6", 6.3, GRAY, false);

  return createSimplePdf(operations.join("\n"));
}

function boxedField(operations: string[], x: number, y: number, width: number, height: number, label: string, value: string) {
  strokeRect(operations, x, y, width, height, BLACK, 0.7);
  text(operations, x + 5, y + height - 10, label, 5.7, GRAY, true);
  text(operations, x + 5, y + 7, truncate(safeAscii(value), Math.max(8, Math.floor(width / 4.4))), 7.5, BLACK, true);
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

function createSimplePdf(contentStream: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 5 0 R >>`,
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
  const image = Buffer.from(LOGO_JPEG_BASE64, "base64");
  return `<< /Type /XObject /Subtype /Image /Width 84 /Height 84 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n${image.toString("latin1")}\nendstream`;
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
