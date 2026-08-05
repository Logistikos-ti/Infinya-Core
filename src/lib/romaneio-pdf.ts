import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync, deflateSync } from "node:zlib";
import type { RomaneioCarrierGroup, RomaneioOrderSummary } from "@/lib/romaneio";
import type { RomaneioRecordDetail, RomaneioRecordOrder } from "@/lib/romaneio-records";

// ─────────────────────────────────────────────────────────────
// Visual identity — mirrors src/components/mobile/mobile-kit-tokens.tsx
// so the printed romaneio matches the app's dark navy / blue-violet look.
// Colors are expressed as PDF "rg"/"RG" triplets (0-1 floats).
// ─────────────────────────────────────────────────────────────
const NAVY: RGB = [0.039, 0.067, 0.125]; // #0A1120
const BLUE: RGB = [0.231, 0.51, 0.965]; // #3B82F6
const BLUE_LIGHT: RGB = [0.376, 0.647, 0.98]; // #60A5FA
const VIOLET: RGB = [0.545, 0.361, 0.965]; // #8B5CF6
const GREEN: RGB = [0.063, 0.725, 0.506]; // #10B981
const AMBER: RGB = [0.961, 0.62, 0.043]; // #F59E0B
const RED: RGB = [0.937, 0.267, 0.267]; // #EF4444
const TEXT_DARK: RGB = [0.106, 0.137, 0.192]; // near-navy body text on white
const MUTED: RGB = [0.525, 0.584, 0.678]; // #8695AD
const CARD_BG: RGB = [0.961, 0.969, 0.984]; // very light blue-gray
const CARD_BORDER: RGB = [0.878, 0.902, 0.933];
const TABLE_HEAD: RGB = NAVY;
const TABLE_ROW_ALT: RGB = [0.965, 0.973, 0.988];
const WHITE: RGB = [1, 1, 1];

type RGB = readonly [number, number, number];

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const HEADER_HEIGHT = 84;
const CONTENT_RIGHT = PAGE_W - MARGIN;

type TableOrderRow = {
  index: number;
  externalNumber: string;
  customer: string;
  destination: string;
  units: string;
  total: string;
  statusLabel: string;
};

type PhotoChecks = {
  hasOperatorPhoto: boolean;
  hasDriverPhoto: boolean;
};

type PageOptions = {
  docLabel: string;
  code?: string;
  statusLabel?: string;
  statusTone?: RGB;
  fields: { label: string; value: string }[];
  orders: TableOrderRow[];
  pageNumber: number;
  totalPages: number;
  photos?: PhotoChecks;
  emittedAt: string;
};

export function buildRomaneioPdf(group: RomaneioCarrierGroup) {
  const chunkSize = 16;
  const orders = group.orders.map(toGroupOrderRow);
  const chunks = chunkArray(orders, chunkSize);
  const totalPages = Math.max(1, chunks.length);
  const emittedAt = formatDateTime(new Date().toISOString());

  const pages = (chunks.length ? chunks : [[]]).map((chunk, index) =>
    buildPageContentStream({
      docLabel: "Romaneio de Expedição",
      fields: groupFields(group),
      orders: chunk,
      pageNumber: index + 1,
      totalPages,
      emittedAt,
    }),
  );

  return createBrandedPdfDocument(pages);
}

export function buildRomaneioRecordPdf(record: RomaneioRecordDetail) {
  return createBrandedPdfDocument(buildPersistedRomaneioPages(record));
}

/**
 * One combined PDF summarizing several romaneios at once (mobile
 * "Selecionar" + "Exportar" flow in the Finalizados tab) -- reuses the
 * exact same per-romaneio page layout as buildRomaneioRecordPdf, just
 * concatenating every selected romaneio's pages into a single document
 * instead of generating one file per romaneio.
 */
export function buildRomaneioRecordsSummaryPdf(records: RomaneioRecordDetail[]) {
  const pages = records.flatMap((record) => buildPersistedRomaneioPages(record));

  if (!pages.length) {
    const emittedAt = formatDateTime(new Date().toISOString());
    return createBrandedPdfDocument([
      buildPageContentStream({
        docLabel: "Resumo de Romaneios",
        fields: [],
        orders: [],
        pageNumber: 1,
        totalPages: 1,
        emittedAt,
      }),
    ]);
  }

  return createBrandedPdfDocument(pages);
}

function buildPersistedRomaneioPages(record: RomaneioRecordDetail) {
  const chunkSize = 16;
  const orders = record.orders.map(toRecordOrderRow);
  const chunks = chunkArray(orders, chunkSize);
  const totalPages = Math.max(1, chunks.length);
  const emittedAt = formatDateTime(new Date().toISOString());
  const photos = parseConferenciaPhotos(record.notes);

  return (chunks.length ? chunks : [[]]).map((chunk, index) =>
    buildPageContentStream({
      docLabel: "Romaneio Operacional",
      code: record.code,
      statusLabel: record.statusLabel,
      statusTone: statusTone(record.status),
      fields: recordFields(record),
      orders: chunk,
      pageNumber: index + 1,
      totalPages,
      photos,
      emittedAt,
    }),
  );
}

/**
 * record.notes stores the double-check JSON payload written by
 * completeRomaneioWithDoubleCheck ({ foto_operador_url, foto_motorista_url,
 * conferido_em, conferido_por }) -- same shape parsed by the "Visualizar
 * Romaneio" mobile page. The PDF never embeds the actual photos (kept out
 * of the printed document on purpose), just whether each one was taken.
 */
function parseConferenciaPhotos(notes: string | null): PhotoChecks {
  if (!notes) return { hasOperatorPhoto: false, hasDriverPhoto: false };
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      hasOperatorPhoto: typeof parsed.foto_operador_url === "string" && parsed.foto_operador_url.length > 0,
      hasDriverPhoto: typeof parsed.foto_motorista_url === "string" && parsed.foto_motorista_url.length > 0,
    };
  } catch {
    return { hasOperatorPhoto: false, hasDriverPhoto: false };
  }
}

function groupFields(group: RomaneioCarrierGroup) {
  return [
    { label: "Transportadora", value: group.carrierName || "-" },
    { label: "Cutoff operacional", value: group.cutoff || "-" },
    { label: "Pedidos / Unidades", value: `${group.orderCount} pedido(s) · ${group.totalUnits} un.` },
    { label: "Valor total da carga", value: group.totalValue || "-" },
    { label: "Depositantes", value: group.depositantes.join(", ") || "-" },
    { label: "Destinos", value: group.destinations.join(", ") || "-" },
  ];
}

function recordFields(record: RomaneioRecordDetail) {
  return [
    { label: "Transportadora", value: record.carrierName || "-" },
    { label: "Motorista", value: record.driverName || "Não informado" },
    { label: "Documento do motorista", value: record.driverDocument || "Não informado" },
    { label: "Veículo / Placa", value: `${record.vehicleModel || "-"} · ${record.vehiclePlate || "-"}` },
    { label: "Pedidos / Unidades", value: `${record.orderCount} pedido(s) · ${record.totalUnits} un.` },
    { label: "Valor total da carga", value: record.totalValue || "-" },
    { label: "Depositantes", value: record.depositantes.join(", ") || "-" },
    { label: "Destinos", value: record.destinations.join(", ") || "-" },
  ];
}

function toGroupOrderRow(order: RomaneioOrderSummary, index: number): TableOrderRow {
  return {
    index: index + 1,
    externalNumber: order.externalNumber,
    customer: order.customer,
    destination: order.destination,
    units: order.units,
    total: order.total,
    statusLabel: order.statusLabel,
  };
}

function toRecordOrderRow(order: RomaneioRecordOrder, index: number): TableOrderRow {
  return {
    index: index + 1,
    externalNumber: order.externalNumber,
    customer: order.customer,
    destination: order.destination,
    units: order.units,
    total: order.total,
    statusLabel: order.statusLabel,
  };
}

function statusTone(status: string): RGB {
  if (status === "LIBERADO") return GREEN;
  if (status === "CANCELADO") return RED;
  return AMBER;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

// ─────────────────────────────────────────────────────────────
// Page content stream — draws the branded header, an info card with the
// romaneio's key data, the orders table and (when the double-check
// captured them) the audit photo confirmations, using raw PDF drawing
// operators (this file hand-builds the PDF byte stream, there is no
// external PDF library dependency in this project).
// ─────────────────────────────────────────────────────────────
function buildPageContentStream(opts: PageOptions): string {
  const ops: string[] = [];

  drawHeader(ops, opts.docLabel);

  let y = PAGE_H - HEADER_HEIGHT - 34;

  // Code + status chips, page indicator.
  if (opts.code) {
    let chipX = MARGIN;
    chipX = drawChip(ops, chipX, y, opts.code, NAVY, CARD_BG, CARD_BORDER) + 8;
    if (opts.statusLabel) {
      chipX = drawChip(ops, chipX, y, opts.statusLabel, opts.statusTone ?? MUTED, tint(opts.statusTone ?? MUTED, 0.12), tint(opts.statusTone ?? MUTED, 0.35)) + 8;
    }
  }
  text(ops, CONTENT_RIGHT, y + 5, `Página ${opts.pageNumber} de ${opts.totalPages}`, 8.5, MUTED, false, "right");
  y -= 26;
  text(ops, MARGIN, y, `Emitido em ${opts.emittedAt}`, 8.5, MUTED, false);
  y -= 18;

  // Info card.
  if (opts.fields.length) {
    y = drawInfoCard(ops, y, opts.fields);
    y -= 14;
  }

  // Orders table section title.
  text(ops, MARGIN, y, "PEDIDOS DA CARGA", 11, NAVY, true);
  fillRect(ops, MARGIN, y - 5, 96, 2, gradientMid());
  y -= 22;

  y = drawOrdersTable(ops, y, opts.orders);

  if (opts.photos && (opts.photos.hasOperatorPhoto || opts.photos.hasDriverPhoto)) {
    y -= 20;
    drawPhotoChecks(ops, y, opts.photos);
  }

  return ops.join("\n");
}

function drawHeader(ops: string[], docLabel: string) {
  fillRect(ops, 0, PAGE_H - HEADER_HEIGHT, PAGE_W, HEADER_HEIGHT, NAVY);

  const logo = getLogoImage();
  if (logo) {
    const logoWidth = 132;
    const logoHeight = (logoWidth * logo.height) / logo.width;
    const logoY = PAGE_H - HEADER_HEIGHT + (HEADER_HEIGHT - logoHeight) / 2;
    drawImage(ops, MARGIN, logoY, logoWidth, logoHeight);
  }

  text(ops, 208, PAGE_H - 32, "INFINOOS WMS", 9, BLUE_LIGHT, true, "left", 1.4);
  text(ops, 208, PAGE_H - 52, docLabel, 18, WHITE, true);
  text(ops, 208, PAGE_H - 68, "Sistema de gestão de armazém", 9, tint(WHITE, 0.6), false);

  // Poor man's gradient accent bar under the header (blue -> violet).
  const segments = 24;
  const segmentWidth = PAGE_W / segments;
  for (let i = 0; i < segments; i += 1) {
    const color = lerpColor(BLUE, VIOLET, i / (segments - 1));
    fillRect(ops, i * segmentWidth, PAGE_H - HEADER_HEIGHT - 4, segmentWidth + 0.5, 4, color);
  }
}

function drawInfoCard(ops: string[], topY: number, fields: { label: string; value: string }[]) {
  const columns = 2;
  const rows = Math.ceil(fields.length / columns);
  const rowHeight = 30;
  const cardPaddingY = 14;
  const cardHeight = rows * rowHeight + cardPaddingY * 2 - (rowHeight - 22);
  const cardY = topY - cardHeight;
  const colWidth = (PAGE_W - MARGIN * 2) / columns;

  strokeRect(ops, MARGIN, cardY, PAGE_W - MARGIN * 2, cardHeight, CARD_BORDER, 0.75, CARD_BG);

  fields.forEach((field, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + 18 + col * colWidth;
    const fieldTopY = cardY + cardHeight - cardPaddingY - row * rowHeight;
    text(ops, x, fieldTopY - 9, field.label.toUpperCase(), 7, MUTED, true, "left", 0.4);
    text(ops, x, fieldTopY - 21, truncate(field.value || "-", 58), 9.5, TEXT_DARK, false);
  });

  return cardY;
}

function drawOrdersTable(ops: string[], topY: number, orders: TableOrderRow[]) {
  const columns = [
    { label: "#", width: 24 },
    { label: "PEDIDO", width: 82 },
    { label: "CLIENTE", width: 150 },
    { label: "DESTINO", width: 118 },
    { label: "UNID.", width: 42 },
    { label: "VALOR", width: 65 },
    { label: "STATUS", width: 34 },
  ];
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const rowHeight = 18;
  const headerHeight = 20;

  let y = topY;
  fillRect(ops, MARGIN, y - headerHeight, tableWidth, headerHeight, TABLE_HEAD);
  let colX = MARGIN;
  columns.forEach((col) => {
    text(ops, colX + 6, y - headerHeight + 7, col.label, 7.2, WHITE, true);
    colX += col.width;
  });
  y -= headerHeight;

  if (!orders.length) {
    fillRect(ops, MARGIN, y - rowHeight, tableWidth, rowHeight, TABLE_ROW_ALT);
    text(ops, MARGIN + 6, y - rowHeight + 6, "Nenhum pedido nesta página.", 8, MUTED, false);
    y -= rowHeight;
    strokeRect(ops, MARGIN, y, tableWidth, headerHeight + rowHeight, CARD_BORDER, 0.6);
    return y;
  }

  orders.forEach((order, index) => {
    if (index % 2 === 1) fillRect(ops, MARGIN, y - rowHeight, tableWidth, rowHeight, TABLE_ROW_ALT);
    colX = MARGIN;
    const cells = [
      String(order.index),
      truncate(order.externalNumber || "-", 14),
      truncate(order.customer || "-", 26),
      truncate(order.destination || "-", 20),
      order.units || "-",
      truncate(order.total || "-", 11),
      truncate(order.statusLabel || "-", 6),
    ];
    cells.forEach((cellText, cellIndex) => {
      text(ops, colX + 6, y - rowHeight + 6, cellText, 7.6, TEXT_DARK, false);
      colX += columns[cellIndex].width;
    });
    line(ops, MARGIN, y - rowHeight, MARGIN + tableWidth, y - rowHeight, CARD_BORDER, 0.4);
    y -= rowHeight;
  });

  strokeRect(ops, MARGIN, y, tableWidth, topY - y, CARD_BORDER, 0.6);
  return y;
}

// Renders a "confirmed" badge per captured audit photo instead of the
// actual image (kept out of the printed document on purpose, same
// privacy-conscious treatment as the PhotoCheck cards on the mobile
// "Visualizar Romaneio" summary screen) -- a green check icon plus a
// short label, side by side.
function drawPhotoChecks(ops: string[], topY: number, photos: PhotoChecks) {
  text(ops, MARGIN, topY, "FOTOS DE AUDITORIA", 9.5, NAVY, true);
  const badgeY = topY - 34;
  let x = MARGIN;
  if (photos.hasOperatorPhoto) x = drawPhotoBadge(ops, x, badgeY, "Foto do operador confirmada") + 12;
  if (photos.hasDriverPhoto) drawPhotoBadge(ops, x, badgeY, "Foto do motorista confirmada");
}

function drawPhotoBadge(ops: string[], x: number, y: number, label: string) {
  const iconSize = 22;
  strokeRect(ops, x, y, iconSize, iconSize, tint(GREEN, 0.4), 0.8, tint(GREEN, 0.12));
  drawCheckIcon(ops, x, y, iconSize, GREEN);
  text(ops, x + iconSize + 8, y + 7, label, 8.6, TEXT_DARK, false);
  return x + iconSize + 8 + estimateTextWidth(label, 8.6);
}

function drawCheckIcon(ops: string[], x: number, y: number, size: number, color: RGB) {
  const p1 = [x + size * 0.22, y + size * 0.48];
  const p2 = [x + size * 0.42, y + size * 0.26];
  const p3 = [x + size * 0.8, y + size * 0.68];
  ops.push(
    `${color[0]} ${color[1]} ${color[2]} RG`,
    `${size * 0.14} w`,
    "1 J",
    "1 j",
    `${p1[0]} ${p1[1]} m ${p2[0]} ${p2[1]} l ${p3[0]} ${p3[1]} l S`,
  );
}

// ─────────────────────────────────────────────────────────────
// Drawing primitives
// ─────────────────────────────────────────────────────────────
function text(
  ops: string[],
  x: number,
  y: number,
  value: string,
  size: number,
  color: RGB,
  bold: boolean,
  align: "left" | "right" = "left",
  letterSpacing = 0,
) {
  const drawX = align === "right" ? x - estimateTextWidth(value, size) : x;
  // Tc (character spacing) is graphics state, not text-object-scoped, so
  // it must always be set explicitly here -- otherwise a letter-spaced
  // label would leak its spacing into every plain text() call after it.
  ops.push(
    `${color[0]} ${color[1]} ${color[2]} rg`,
    "BT",
    `/${bold ? "F2" : "F1"} ${size} Tf`,
    `${letterSpacing} Tc`,
    `${drawX} ${y} Td`,
    `(${escapePdfString(value)}) Tj`,
    "ET",
  );
}

function fillRect(ops: string[], x: number, y: number, width: number, height: number, color: RGB) {
  ops.push(`${color[0]} ${color[1]} ${color[2]} rg`, `${x} ${y} ${width} ${height} re f`);
}

function strokeRect(
  ops: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGB,
  lineWidth: number,
  fill?: RGB,
) {
  if (fill) fillRect(ops, x, y, width, height, fill);
  ops.push(`${color[0]} ${color[1]} ${color[2]} RG`, `${lineWidth} w`, `${x} ${y} ${width} ${height} re S`);
}

function line(ops: string[], x1: number, y1: number, x2: number, y2: number, color: RGB, lineWidth: number) {
  ops.push(`${color[0]} ${color[1]} ${color[2]} RG`, `${lineWidth} w`, `${x1} ${y1} m ${x2} ${y2} l S`);
}

function drawImage(ops: string[], x: number, y: number, width: number, height: number) {
  ops.push("q", `${width} 0 0 ${height} ${x} ${y} cm`, "/Im1 Do", "Q");
}

function drawChip(ops: string[], x: number, y: number, label: string, textColor: RGB, bg: RGB, border: RGB) {
  const paddingX = 8;
  const height = 18;
  const width = estimateTextWidth(label, 8.5) + paddingX * 2;
  strokeRect(ops, x, y - 4, width, height, border, 0.6, bg);
  text(ops, x + paddingX, y + 1, label, 8.5, textColor, true);
  return x + width;
}

function gradientMid(): RGB {
  return lerpColor(BLUE, VIOLET, 0.5);
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function tint(color: RGB, alpha: number): RGB {
  // Blends a color toward white to emulate a translucent fill/border,
  // since this hand-rolled PDF doesn't use real alpha compositing.
  return lerpColor(WHITE, color, alpha);
}

// Rough average glyph width for Helvetica at a given size — good enough
// for right-aligning short labels/page numbers without loading the AFM
// width tables for the standard 14 fonts.
function estimateTextWidth(value: string, size: number) {
  return value.length * size * 0.52;
}

// WinAnsiEncoding's ellipsis lives at byte 0x85 -- the real "…" character
// (U+2026) is outside Latin-1, so Buffer.from(pdf, "latin1") at final
// assembly would silently mask it down to its low byte (0x26 = "&"),
// corrupting every truncated string. String.fromCharCode(0x85) produces
// a JS string whose single UTF-16 code unit IS that byte, so it survives
// the latin1 round-trip and renders as the correct glyph.
const PDF_ELLIPSIS = String.fromCharCode(0x85);

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 1))}${PDF_ELLIPSIS}` : value;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function escapePdfString(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

// ─────────────────────────────────────────────────────────────
// Logo embedding — decodes public/branding/infinoos-lockup-wms.png (a
// standard, non-interlaced 8-bit RGBA PNG) using only Node's built-in
// zlib, then re-splits it into an RGB image + a grayscale alpha mask so
// it can be embedded as a PDF Image XObject with a soft mask. There is
// no PDF/image library dependency anywhere in this project (see the
// DCTDecode logo embed in src/lib/shipping-danfe.ts for the JPEG
// equivalent of this same pattern) — decoding PNG ourselves keeps the
// full-color gradient logo without adding one.
// ─────────────────────────────────────────────────────────────
type DecodedLogo = { width: number; height: number; rgb: Buffer; alpha: Buffer };

let cachedLogo: DecodedLogo | null | undefined;

function getLogoImage(): DecodedLogo | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const filePath = join(process.cwd(), "public", "branding", "infinoos-lockup-wms.png");
    cachedLogo = decodeRgbaPng(readFileSync(filePath));
  } catch {
    // Logo is decorative — never let a missing/corrupt asset break PDF export.
    cachedLogo = null;
  }
  return cachedLogo;
}

function decodeRgbaPng(buf: Buffer): DecodedLogo {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error("Unsupported PNG format for logo embedding (expected 8-bit non-interlaced RGBA).");
  }

  const idatChunks: Buffer[] = [];
  let offset = 8;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idatChunks.push(buf.subarray(offset + 8, offset + 8 + len));
    offset += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const stride = width * bpp;
  const pixels = Buffer.alloc(height * stride);
  let pos = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = raw[pos];
    pos += 1;
    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[pos + x];
      const a = x >= bpp ? pixels[y * stride + x - bpp] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp] : 0;
      let value: number;
      switch (filterType) {
        case 0: value = rawByte; break;
        case 1: value = (rawByte + a) & 0xff; break;
        case 2: value = (rawByte + b) & 0xff; break;
        case 3: value = (rawByte + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: value = (rawByte + paeth(a, b, c)) & 0xff; break;
        default: throw new Error(`Unsupported PNG filter type ${filterType}`);
      }
      pixels[y * stride + x] = value;
    }
    pos += stride;
  }

  const rgb = Buffer.alloc(width * height * 3);
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i += 1) {
    rgb[i * 3] = pixels[i * 4];
    rgb[i * 3 + 1] = pixels[i * 4 + 1];
    rgb[i * 3 + 2] = pixels[i * 4 + 2];
    alpha[i] = pixels[i * 4 + 3];
  }

  return { width, height, rgb, alpha };
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ─────────────────────────────────────────────────────────────
// Minimal raw PDF document assembly (no external PDF library).
// ─────────────────────────────────────────────────────────────
function createBrandedPdfDocument(pages: string[]) {
  const logo = getLogoImage();

  // Object layout: 1 catalog, 2 pages tree, then per-page [page, content]
  // pairs, then trailing shared resources (fonts, image + smask).
  const firstPageObjectNumber = 3;
  const pageObjectNumbers = pages.map((_, index) => firstPageObjectNumber + index * 2);
  const contentObjectNumbers = pages.map((_, index) => firstPageObjectNumber + index * 2 + 1);
  const sharedStart = firstPageObjectNumber + pages.length * 2;
  const regularFontObject = sharedStart;
  const boldFontObject = sharedStart + 1;
  const imageObject = logo ? sharedStart + 2 : null;
  const smaskObject = logo ? sharedStart + 3 : null;

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] >>`,
  );

  const xObjectEntry = imageObject ? ` /XObject << /Im1 ${imageObject} 0 R >>` : "";

  pages.forEach((contentStream, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = contentObjectNumbers[index];
    objects[pageObjectNumber - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${regularFontObject} 0 R /F2 ${boldFontObject} 0 R >>${xObjectEntry} >> ` +
      `/Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber - 1] =
      `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`;
  });

  objects[regularFontObject - 1] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[boldFontObject - 1] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  if (logo && imageObject && smaskObject) {
    const rgbDeflated = deflateSync(logo.rgb);
    const alphaDeflated = deflateSync(logo.alpha);
    objects[imageObject - 1] =
      `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB ` +
      `/BitsPerComponent 8 /Filter /FlateDecode /SMask ${smaskObject} 0 R /Length ${rgbDeflated.length} >>\n` +
      `stream\n${rgbDeflated.toString("latin1")}\nendstream`;
    objects[smaskObject - 1] =
      `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray ` +
      `/BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaDeflated.length} >>\n` +
      `stream\n${alphaDeflated.toString("latin1")}\nendstream`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((objectContent, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${objectContent}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
