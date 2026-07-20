import { parseNfeXml } from "@/lib/nfe-import";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 32;
const NAVY = [0.035, 0.075, 0.17] as const;
const BLUE = [0.04, 0.62, 0.88] as const;
const PURPLE = [0.48, 0.25, 0.92] as const;
const INK = [0.08, 0.11, 0.18] as const;
const MUTED = [0.32, 0.38, 0.48] as const;
const LINE = [0.82, 0.86, 0.92] as const;
const PALE = [0.95, 0.97, 0.99] as const;

export function buildSimplifiedDanfePdfFromXml(xml: string) {
  const parsed = parseNfeXml(xml);
  const accessKey = digitsOnly(parsed.accessKey);
  const operations: string[] = [];

  // Header and document identity.
  fillRect(operations, 0, PAGE_HEIGHT - 92, PAGE_WIDTH, 92, NAVY);
  fillRect(operations, 0, PAGE_HEIGHT - 96, PAGE_WIDTH, 4, BLUE);
  fillRect(operations, PAGE_WIDTH - 145, PAGE_HEIGHT - 92, 145, 92, PURPLE);
  text(operations, MARGIN, 792, "INFINOOS WMS", 19, [1, 1, 1], true);
  text(operations, MARGIN, 772, "DOCUMENTO AUXILIAR DA NF-E", 8, [0.72, 0.84, 1], true);
  text(operations, 465, 797, "DANFE", 17, [1, 1, 1], true);
  text(operations, 465, 779, "SIMPLIFICADA", 8, [0.88, 0.91, 1], true);
  text(operations, 465, 753, `NF ${safeAscii(parsed.noteNumber)}`, 11, [1, 1, 1], true);

  sectionTitle(operations, 32, 724, "IDENTIFICACAO DA NOTA");
  field(operations, 32, 682, 168, 34, "NUMERO DA NF-E", parsed.noteNumber);
  field(operations, 208, 682, 168, 34, "DIRECAO", parsed.direction === "SAIDA" ? "SAIDA" : "ENTRADA");
  field(operations, 384, 682, 179, 34, "EMISSAO", formatDateTime(parsed.issuedAt));

  sectionTitle(operations, 32, 650, "PARTICIPANTES");
  field(operations, 32, 592, 257, 48, "EMITENTE", parsed.supplierName, parsed.supplierDocument);
  field(operations, 306, 592, 257, 48, "DESTINATARIO", parsed.recipientName, parsed.recipientDocument);

  sectionTitle(operations, 32, 560, "INFORMACOES FISCAIS");
  field(operations, 32, 510, 257, 40, "PROTOCOLO SEFAZ", parsed.protocolNumber ?? "NAO INFORMADO");
  field(operations, 306, 510, 257, 40, "STATUS", parsed.protocolStatusLabel ?? "NAO INFORMADO");
  field(operations, 32, 460, 531, 40, "CHAVE DE ACESSO", accessKey || "NAO INFORMADA");

  if (accessKey.length === 44) {
    text(operations, 32, 444, "LEITURA PARA LIBERACAO DO ROMANEIO", 7, MUTED, true);
    drawCode128(operations, accessKey, 32, 396, 531, 38);
    text(operations, 32, 383, accessKey, 8, INK, false);
  }

  sectionTitle(operations, 32, 356, "ITENS DA NOTA");
  tableHeader(operations, 32, 332, [30, 112, 251, 58, 80], ["#", "CODIGO / EAN", "DESCRICAO", "QTD", "NCM"]);
  const visibleItems = parsed.items.slice(0, 7);
  let itemY = 308;
  visibleItems.forEach((item, index) => {
    const rowHeight = 27;
    if (index % 2 === 0) fillRect(operations, 32, itemY - 7, 531, rowHeight, [0.98, 0.985, 0.995]);
    const code = safeAscii(item.codigo ?? item.ean ?? "-");
    text(operations, 42, itemY, String(index + 1), 8, INK, false);
    text(operations, 67, itemY, truncate(code, 22), 8, INK, false);
    text(operations, 183, itemY, truncate(safeAscii(item.descricao), 43), 8, INK, false);
    text(operations, 438, itemY, item.quantidade.toLocaleString("pt-BR"), 8, INK, false);
    text(operations, 496, itemY, truncate(safeAscii(item.ncm ?? "-"), 10), 8, INK, false);
    line(operations, 32, itemY - 8, 563, itemY - 8, LINE, 0.35);
    itemY -= rowHeight;
  });
  if (parsed.items.length > visibleItems.length) {
    text(operations, 32, itemY, `+ ${parsed.items.length - visibleItems.length} item(ns) nao exibido(s)`, 8, MUTED, false);
    itemY -= 22;
  }

  const totalsY = Math.max(92, itemY - 18);
  sectionTitle(operations, 32, totalsY + 30, "TOTAIS E TRANSPORTE");
  field(operations, 32, totalsY - 10, 168, 40, "VALOR TOTAL", parsed.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  field(operations, 208, totalsY - 10, 168, 40, "VOLUMES", parsed.volumeCount.toLocaleString("pt-BR"));
  field(operations, 384, totalsY - 10, 179, 40, "ITENS", parsed.items.length.toLocaleString("pt-BR"));

  fillRect(operations, 32, 39, 531, 30, PALE);
  text(operations, 42, 51, "Documento operacional gerado pelo InfinOOs WMS. Consulte o XML para a escrituracao fiscal completa.", 7, MUTED, false);

  return createSimplePdf(operations.join("\n"));
}

function sectionTitle(operations: string[], x: number, y: number, label: string) {
  text(operations, x, y, label, 8, BLUE, true);
  line(operations, x, y - 7, PAGE_WIDTH - MARGIN, y - 7, LINE, 0.7);
}

function field(
  operations: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  secondary?: string | null,
) {
  fillRect(operations, x, y, width, height, PALE);
  strokeRect(operations, x, y, width, height, LINE, 0.7);
  text(operations, x + 9, y + height - 14, label, 7, MUTED, true);
  text(operations, x + 9, y + height - 28, truncate(safeAscii(value), Math.floor(width / 5.8)), 9, INK, true);
  if (secondary) text(operations, x + 9, y + 7, `DOC: ${safeAscii(secondary)}`, 7, MUTED, false);
}

function tableHeader(operations: string[], x: number, y: number, widths: number[], labels: string[]) {
  fillRect(operations, x, y, widths.reduce((sum, width) => sum + width, 0), 20, NAVY);
  let currentX = x;
  labels.forEach((label, index) => {
    text(operations, currentX + 8, y + 7, label, 7, [1, 1, 1], true);
    currentX += widths[index];
  });
}

function drawCode128(operations: string[], value: string, x: number, y: number, width: number, height: number) {
  const encoded = encodeCode128C(value);
  const totalModules = encoded.reduce((sum, pattern) => sum + pattern.split("").reduce((a, n) => a + Number(n), 0), 0);
  const moduleWidth = Math.min(1.65, width / totalModules);
  let cursor = x;
  encoded.forEach((pattern) => {
    let black = true;
    for (const character of pattern) {
      const barWidth = Number(character) * moduleWidth;
      if (black) fillRect(operations, cursor, y, barWidth, height, [0, 0, 0]);
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
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`,
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

function text(operations: string[], x: number, y: number, value: string, size: number, color: readonly [number, number, number], bold: boolean) {
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
