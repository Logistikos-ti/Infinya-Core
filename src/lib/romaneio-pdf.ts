import type { RomaneioCarrierGroup, RomaneioOrderSummary } from "@/lib/romaneio";
import type { RomaneioRecordDetail, RomaneioRecordOrder } from "@/lib/romaneio-records";

// ─────────────────────────────────────────────────────────────
// Infinoos WMS romaneio — hand-built PDF (no PDF library in this
// project; see src/lib/shipping-danfe.ts for the same approach on the
// DANFE side). The layout follows the approved design reference: dark
// header band with the wordmark + status pill, a light "emitido em"
// strip, a 4-up card grid, the orders table with a totals row, the
// audit-photo confirmations and a closing brand band.
// Colors mirror src/components/mobile/mobile-kit-tokens.tsx.
// ─────────────────────────────────────────────────────────────
type RGB = readonly [number, number, number];

const NAVY: RGB = [0.039, 0.067, 0.125]; // #0A1120
const NAVY_GLOW: RGB = [0.13, 0.105, 0.29]; // indigo glow on the header's right side
const BLUE: RGB = [0.231, 0.51, 0.965]; // #3B82F6
const BLUE_LIGHT: RGB = [0.376, 0.647, 0.98]; // #60A5FA
const VIOLET: RGB = [0.545, 0.361, 0.965]; // #8B5CF6
const PINK: RGB = [0.925, 0.282, 0.6]; // #EC4899 — right end of the accent bar
const GREEN: RGB = [0.063, 0.725, 0.506]; // #10B981
const GREEN_DEEP: RGB = [0.024, 0.47, 0.34]; // readable green on a light green fill
const GREEN_BRIGHT: RGB = [0.2, 0.9, 0.62]; // readable green on the dark header
const AMBER: RGB = [0.961, 0.62, 0.043]; // #F59E0B
const RED: RGB = [0.937, 0.267, 0.267]; // #EF4444
const TEXT_DARK: RGB = [0.106, 0.137, 0.192];
const MUTED: RGB = [0.525, 0.584, 0.678]; // #8695AD
const WHITE: RGB = [1, 1, 1];
const CARD_BORDER: RGB = [0.886, 0.91, 0.941];
const RULE: RGB = [0.902, 0.918, 0.945];
const BAND_BG: RGB = [0.973, 0.977, 0.988];
const ROW_ALT: RGB = [0.973, 0.977, 0.988];

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_RIGHT = PAGE_W - MARGIN;
const HEADER_H = 118;
const ACCENT_H = 3;
const META_H = 30;
const FOOTER_H = 30;

const ORDERS_PER_PAGE = 12;

type TableOrderRow = {
  index: number;
  externalNumber: string;
  customer: string;
  destination: string;
  units: string;
  total: string;
  statusLabel: string;
};

type InfoField = {
  label: string;
  value: string;
  /** Label color; defaults to MUTED. */
  accent?: RGB;
  /** Renders the card in the green "valor total" treatment. */
  highlight?: boolean;
};

type PhotoChecks = {
  hasOperatorPhoto: boolean;
  hasDriverPhoto: boolean;
  driverIsSignature: boolean;
};

type PageOptions = {
  docLabel: string;
  docSubtitle: string;
  code?: string;
  statusLabel?: string;
  statusTone?: RGB;
  /** "Liberado 06/08/2026, 08:04" — shown next to "Emitido em ...". */
  finalizedLabel?: string;
  fields: InfoField[];
  depositantesBar?: string;
  orders: TableOrderRow[];
  orderCountLabel: string;
  totalUnits?: string;
  totalValue?: string;
  photos?: PhotoChecks;
  pageNumber: number;
  totalPages: number;
  isLastPage: boolean;
  emittedAt: string;
};

export function buildRomaneioPdf(group: RomaneioCarrierGroup) {
  const orders = group.orders.map(toGroupOrderRow);
  const chunks = chunkArray(orders, ORDERS_PER_PAGE);
  const totalPages = Math.max(1, chunks.length);
  const emittedAt = formatDateTime(new Date().toISOString());

  const pages = (chunks.length ? chunks : [[]]).map((chunk, index) =>
    buildPageContentStream({
      docLabel: "Romaneio de Expedição",
      docSubtitle: "Documento de carga · expedição e coleta",
      fields: groupFields(group),
      depositantesBar: group.depositantes.join("  —  ") || "-",
      orders: chunk,
      orderCountLabel: pluralOrders(group.orderCount),
      totalUnits: group.totalUnits,
      totalValue: group.totalValue,
      pageNumber: index + 1,
      totalPages,
      isLastPage: index === totalPages - 1,
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
    return createBrandedPdfDocument([
      buildPageContentStream({
        docLabel: "Resumo de Romaneios",
        docSubtitle: "Documento de carga · expedição e coleta",
        fields: [],
        orders: [],
        orderCountLabel: "0 pedidos",
        pageNumber: 1,
        totalPages: 1,
        isLastPage: true,
        emittedAt: formatDateTime(new Date().toISOString()),
      }),
    ]);
  }

  return createBrandedPdfDocument(pages);
}

function buildPersistedRomaneioPages(record: RomaneioRecordDetail) {
  const orders = record.orders.map(toRecordOrderRow);
  const chunks = chunkArray(orders, ORDERS_PER_PAGE);
  const totalPages = Math.max(1, chunks.length);
  const emittedAt = formatDateTime(new Date().toISOString());
  const photos = parseConferenciaPhotos(record.conferenceInfoJson);
  const finalizedAt = record.releasedAt ?? record.canceledAt;
  const finalizedLabel = finalizedAt ? `${record.statusLabel} ${formatDateTime(finalizedAt)}` : undefined;

  return (chunks.length ? chunks : [[]]).map((chunk, index) =>
    buildPageContentStream({
      docLabel: "Romaneio Operacional",
      docSubtitle: "Documento de carga · expedição e coleta",
      code: record.code,
      statusLabel: record.statusLabel,
      statusTone: statusTone(record.status),
      finalizedLabel,
      fields: recordFields(record),
      depositantesBar: record.depositantes.join("  —  ") || "-",
      orders: chunk,
      orderCountLabel: pluralOrders(record.orderCount),
      totalUnits: record.totalUnits,
      totalValue: record.totalValue,
      photos,
      pageNumber: index + 1,
      totalPages,
      isLastPage: index === totalPages - 1,
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
  if (!notes) return { hasOperatorPhoto: false, hasDriverPhoto: false, driverIsSignature: false };
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      hasOperatorPhoto: typeof parsed.foto_operador_url === "string" && parsed.foto_operador_url.length > 0,
      hasDriverPhoto: typeof parsed.foto_motorista_url === "string" && parsed.foto_motorista_url.length > 0,
      driverIsSignature: parsed.foto_motorista_tipo === "assinatura",
    };
  } catch {
    return { hasOperatorPhoto: false, hasDriverPhoto: false, driverIsSignature: false };
  }
}

function groupFields(group: RomaneioCarrierGroup): InfoField[] {
  return [
    { label: "Transportadora", value: group.carrierName || "-", accent: VIOLET },
    { label: "Cutoff operacional", value: group.cutoff || "-", accent: BLUE },
    { label: "Pedidos / Unidades", value: `${group.orderCount} pedidos · ${group.totalUnits} un.` },
    { label: "Valor total da carga", value: group.totalValue || "-", accent: GREEN, highlight: true },
    { label: "Depositantes", value: depositanteCountLabel(group.depositantes.length) },
    { label: "Nº de destinos", value: destinationCountLabel(group.destinations.length) },
  ];
}

function recordFields(record: RomaneioRecordDetail): InfoField[] {
  return [
    { label: "Transportadora", value: record.carrierName || "-", accent: VIOLET },
    { label: "Motorista", value: record.driverName || "Não informado", accent: BLUE },
    { label: "Doc. motorista", value: record.driverDocument || "Não informado" },
    { label: "Veículo / Placa", value: `${record.vehicleModel || "-"} · ${record.vehiclePlate || "-"}` },
    { label: "Pedidos / Unidades", value: `${record.orderCount} pedidos · ${record.totalUnits} un.` },
    { label: "Valor total da carga", value: record.totalValue || "-", accent: GREEN, highlight: true },
    { label: "Depositantes", value: depositanteCountLabel(record.depositantes.length) },
    { label: "Nº de destinos", value: destinationCountLabel(record.destinations.length) },
  ];
}

function depositanteCountLabel(count: number) {
  return count === 1 ? "1 depositante" : `${count} depositantes`;
}

function destinationCountLabel(count: number) {
  return count === 1 ? "1 cidade" : `${count} cidades`;
}

function pluralOrders(count: number) {
  return count === 1 ? "1 pedido" : `${count} pedidos`;
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
// Page composition
// ─────────────────────────────────────────────────────────────
function buildPageContentStream(opts: PageOptions): string {
  const ops: string[] = [];

  drawHeader(ops, opts);
  drawMetaBand(ops, opts);

  let y = PAGE_H - HEADER_H - ACCENT_H - META_H - 26;

  if (opts.fields.length) {
    drawSectionTitle(ops, y, "DADOS DA CARGA");
    y -= 16;
    y = drawInfoCards(ops, y, opts.fields);
    y -= 14;
  }

  if (opts.depositantesBar) {
    y = drawDepositantesBar(ops, y, opts.depositantesBar);
    y -= 22;
  }

  drawSectionTitle(ops, y, "PEDIDOS DA CARGA", opts.orderCountLabel);
  y -= 14;

  y = drawOrdersTable(ops, y, opts);

  if (opts.isLastPage && opts.photos && (opts.photos.hasOperatorPhoto || opts.photos.hasDriverPhoto)) {
    y -= 26;
    drawSectionTitle(ops, y, "FOTOS DE AUDITORIA");
    y -= 14;
    drawPhotoChecks(ops, y, opts.photos);
  }

  drawFooterBand(ops, opts.code);

  return ops.join("\n");
}

function drawHeader(ops: string[], opts: PageOptions) {
  // Horizontal navy -> indigo wash, brightest toward the right edge.
  const strips = 56;
  const stripWidth = PAGE_W / strips;
  for (let i = 0; i < strips; i += 1) {
    const t = i / (strips - 1);
    const glow = Math.max(0, (t - 0.42) / 0.58);
    fillRect(ops, i * stripWidth, PAGE_H - HEADER_H, stripWidth + 0.7, HEADER_H, lerpColor(NAVY, NAVY_GLOW, glow * glow));
  }

  text(ops, MARGIN, PAGE_H - 34, "INFINOOS", 8.6, BLUE_LIGHT, true, "left", 3.4);
  text(ops, MARGIN, PAGE_H - 57, "WMS", 22, BLUE_LIGHT, true);
  text(ops, MARGIN, PAGE_H - 82, opts.docLabel, 15.5, WHITE, true);
  text(ops, MARGIN, PAGE_H - 97, opts.docSubtitle, 8.4, lerpColor(NAVY, WHITE, 0.62), false);

  if (opts.statusLabel) {
    const tone = opts.statusTone ?? MUTED;
    const label = opts.statusLabel.toUpperCase();
    const pillH = 20;
    const pillW = measureText(label, 8.4, true, 1.2) + 34;
    const pillX = CONTENT_RIGHT - pillW;
    const pillY = PAGE_H - 45;
    fillStrokeRoundedRect(ops, pillX, pillY, pillW, pillH, pillH / 2, lerpColor(NAVY, tone, 0.24), lerpColor(NAVY, tone, 0.55), 0.9);
    fillCircle(ops, pillX + 13, pillY + pillH / 2, 3.2, tone === GREEN ? GREEN_BRIGHT : tone);
    text(ops, pillX + 22, pillY + 6.5, label, 8.4, tone === GREEN ? GREEN_BRIGHT : tone, true, "left", 1.2);
  }

  if (opts.code) {
    text(ops, CONTENT_RIGHT, PAGE_H - 61, "ROMANEIO Nº", 7, lerpColor(NAVY, WHITE, 0.45), true, "right", 2.2);
    text(ops, CONTENT_RIGHT, PAGE_H - 80, opts.code, 15, WHITE, true, "right");
  }

  // Accent bar: blue -> violet -> pink, matching the app's gradient.
  const accentY = PAGE_H - HEADER_H - ACCENT_H;
  for (let i = 0; i < strips; i += 1) {
    const t = i / (strips - 1);
    const color = t < 0.5 ? lerpColor(BLUE, VIOLET, t / 0.5) : lerpColor(VIOLET, PINK, (t - 0.5) / 0.5);
    fillRect(ops, i * stripWidth, accentY, stripWidth + 0.7, ACCENT_H, color);
  }
}

function drawMetaBand(ops: string[], opts: PageOptions) {
  const bandY = PAGE_H - HEADER_H - ACCENT_H - META_H;
  fillRect(ops, 0, bandY, PAGE_W, META_H, BAND_BG);
  line(ops, 0, bandY, PAGE_W, bandY, RULE, 0.7);

  const baseline = bandY + 11;
  let x = MARGIN;
  x = textRun(ops, x, baseline, "Emitido em ", 8.4, MUTED, false);
  x = textRun(ops, x, baseline, opts.emittedAt, 8.4, TEXT_DARK, true);
  if (opts.finalizedLabel) {
    textRun(ops, x, baseline, ` · ${opts.finalizedLabel}`, 8.4, MUTED, false);
  }

  text(ops, CONTENT_RIGHT, baseline, `Página ${opts.pageNumber} de ${opts.totalPages}`, 8.4, MUTED, false, "right");
}

function drawSectionTitle(ops: string[], baseline: number, title: string, pillLabel?: string) {
  text(ops, MARGIN, baseline, title, 10.5, NAVY, true, "left", 1.7);
  let x = MARGIN + measureText(title, 10.5, true, 1.7) + 14;

  if (pillLabel) {
    const pillH = 15;
    const pillW = measureText(pillLabel, 7.6, true) + 18;
    fillStrokeRoundedRect(ops, x, baseline - 4, pillW, pillH, pillH / 2, tint(BLUE, 0.13), tint(BLUE, 0.32), 0.7);
    text(ops, x + 9, baseline + 0.5, pillLabel, 7.6, lerpColor(BLUE, NAVY, 0.25), true);
    x += pillW + 14;
  }

  line(ops, x, baseline + 3.5, CONTENT_RIGHT, baseline + 3.5, RULE, 0.9);
}

function drawInfoCards(ops: string[], topY: number, fields: InfoField[]) {
  const columns = 4;
  const gap = 10;
  const cardW = (CONTENT_W - gap * (columns - 1)) / columns;
  const cardH = 48;
  const rows = Math.ceil(fields.length / columns);

  fields.forEach((field, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + col * (cardW + gap);
    const y = topY - row * (cardH + gap) - cardH;

    const bg = field.highlight ? tint(GREEN, 0.08) : WHITE;
    const border = field.highlight ? tint(GREEN, 0.4) : CARD_BORDER;
    fillStrokeRoundedRect(ops, x, y, cardW, cardH, 7, bg, border, 0.85);

    text(ops, x + 11, y + cardH - 17, field.label.toUpperCase(), 6.6, field.accent ?? MUTED, true, "left", 0.55);
    text(ops, x + 11, y + 12, truncate(field.value || "-", 19), 9.8, field.highlight ? GREEN_DEEP : TEXT_DARK, true);
  });

  return topY - rows * cardH - (rows - 1) * gap;
}

function drawDepositantesBar(ops: string[], topY: number, value: string) {
  const height = 28;
  const y = topY - height;
  fillStrokeRoundedRect(ops, MARGIN, y, CONTENT_W, height, 7, WHITE, CARD_BORDER, 0.85);
  text(ops, MARGIN + 12, y + 10.5, "DEPOSITANTES", 6.6, MUTED, true, "left", 0.55);
  const valueX = MARGIN + 12 + measureText("DEPOSITANTES", 6.6, true, 0.55) + 14;
  text(ops, valueX, y + 10, truncate(value, 92), 9, TEXT_DARK, false);
  return y;
}

const TABLE_COLUMNS: { label: string; width: number; align: "left" | "right" }[] = [
  { label: "#", width: 28, align: "left" },
  { label: "PEDIDO", width: 62, align: "left" },
  { label: "CLIENTE", width: 170, align: "left" },
  { label: "DESTINO", width: 112, align: "left" },
  { label: "UNID.", width: 40, align: "right" },
  { label: "VALOR", width: 58, align: "right" },
  { label: "STATUS", width: 45, align: "right" },
];

function drawOrdersTable(ops: string[], topY: number, opts: PageOptions) {
  const headerH = 24;
  const rowH = 22;
  const totalRowH = 24;
  const radius = 8;
  const showTotals = opts.isLastPage && Boolean(opts.totalValue);

  // Header band (rounded top corners only, so it meets the rows flush).
  const headerY = topY - headerH;
  ops.push(`${NAVY[0]} ${NAVY[1]} ${NAVY[2]} rg`);
  roundedTopRectPath(ops, MARGIN, headerY, CONTENT_W, headerH, radius);
  ops.push("f");

  let colX = MARGIN;
  TABLE_COLUMNS.forEach((col) => {
    const labelX = col.align === "right" ? colX + col.width - 10 : colX + 10;
    text(ops, labelX, headerY + 8.5, col.label, 6.8, lerpColor(NAVY, WHITE, 0.72), true, col.align, 0.7);
    colX += col.width;
  });

  let y = headerY;

  if (!opts.orders.length) {
    fillRect(ops, MARGIN, y - rowH, CONTENT_W, rowH, ROW_ALT);
    text(ops, MARGIN + 10, y - rowH + 7.5, "Nenhum pedido nesta página.", 8, MUTED, false);
    y -= rowH;
  }

  opts.orders.forEach((order, index) => {
    const rowY = y - rowH;
    if (index % 2 === 1) fillRect(ops, MARGIN, rowY, CONTENT_W, rowH, ROW_ALT);

    let cellX = MARGIN;
    const baseline = rowY + 7.5;

    // #
    text(ops, cellX + 10, baseline, String(order.index), 8, lerpColor(MUTED, VIOLET, 0.55), true);
    cellX += TABLE_COLUMNS[0].width;

    // PEDIDO
    text(ops, cellX + 10, baseline, truncate(order.externalNumber || "-", 10), 8.4, TEXT_DARK, true);
    cellX += TABLE_COLUMNS[1].width;

    // CLIENTE
    text(ops, cellX + 10, baseline, truncate(order.customer || "-", 34), 8.4, TEXT_DARK, false);
    cellX += TABLE_COLUMNS[2].width;

    // DESTINO
    text(ops, cellX + 10, baseline, truncate(order.destination || "-", 23), 8.2, MUTED, false);
    cellX += TABLE_COLUMNS[3].width;

    // UNID.
    text(ops, cellX + TABLE_COLUMNS[4].width - 10, baseline, order.units || "-", 8.4, TEXT_DARK, true, "right");
    cellX += TABLE_COLUMNS[4].width;

    // VALOR
    text(ops, cellX + TABLE_COLUMNS[5].width - 10, baseline, truncate(order.total || "-", 12), 8.4, TEXT_DARK, true, "right");
    cellX += TABLE_COLUMNS[5].width;

    // STATUS pill, right-aligned inside its column.
    const statusLabel = truncate(order.statusLabel || "-", 10);
    const pillH = 14;
    const pillW = measureText(statusLabel, 7, true) + 14;
    const pillX = cellX + TABLE_COLUMNS[6].width - 10 - pillW;
    fillStrokeRoundedRect(ops, pillX, rowY + (rowH - pillH) / 2, pillW, pillH, pillH / 2, tint(GREEN, 0.13), tint(GREEN, 0.32), 0.6);
    text(ops, pillX + 7, rowY + (rowH - pillH) / 2 + 4.3, statusLabel, 7, GREEN_DEEP, true);

    line(ops, MARGIN, rowY, MARGIN + CONTENT_W, rowY, RULE, 0.5);
    y = rowY;
  });

  if (showTotals) {
    const totalY = y - totalRowH;
    ops.push(`${ROW_ALT[0]} ${ROW_ALT[1]} ${ROW_ALT[2]} rg`);
    roundedBottomRectPath(ops, MARGIN, totalY, CONTENT_W, totalRowH, radius);
    ops.push("f");

    const labelRight = MARGIN + TABLE_COLUMNS.slice(0, 4).reduce((sum, col) => sum + col.width, 0) - 4;
    text(ops, labelRight, totalY + 8.5, "TOTAL DA CARGA", 8, MUTED, true, "right", 0.4);

    let cellX = MARGIN + TABLE_COLUMNS.slice(0, 4).reduce((sum, col) => sum + col.width, 0);
    text(ops, cellX + TABLE_COLUMNS[4].width - 10, totalY + 8.5, opts.totalUnits ?? "-", 8.8, TEXT_DARK, true, "right");
    cellX += TABLE_COLUMNS[4].width;
    text(ops, cellX + TABLE_COLUMNS[5].width - 10, totalY + 8.5, opts.totalValue ?? "-", 8.8, GREEN_DEEP, true, "right");

    y = totalY;
  }

  // Outline over the whole table so the rounded corners read as one card.
  ops.push(`${CARD_BORDER[0]} ${CARD_BORDER[1]} ${CARD_BORDER[2]} RG`, "0.85 w");
  roundedRectPath(ops, MARGIN, y, CONTENT_W, topY - y, radius);
  ops.push("S");

  return y;
}

// Renders a "confirmed" badge per captured audit photo instead of the
// actual image (kept out of the printed document on purpose, same
// privacy-conscious treatment as the PhotoCheck cards on the mobile
// "Visualizar Romaneio" summary screen).
function drawPhotoChecks(ops: string[], topY: number, photos: PhotoChecks) {
  const cardH = 46;
  const gap = 14;
  const cardW = (CONTENT_W - gap) / 2;
  const y = topY - cardH;

  const items: { label: string; caption: string }[] = [];
  if (photos.hasOperatorPhoto) {
    items.push({ label: "Foto do operador", caption: "Confirmada no ato da coleta" });
  }
  if (photos.hasDriverPhoto) {
    items.push(
      photos.driverIsSignature
        ? { label: "Assinatura do motorista", caption: "Assinada no ato da coleta" }
        : { label: "Foto do motorista", caption: "Confirmada no ato da coleta" },
    );
  }

  items.forEach((item, index) => {
    const x = MARGIN + index * (cardW + gap);
    fillStrokeRoundedRect(ops, x, y, cardW, cardH, 9, tint(GREEN, 0.08), tint(GREEN, 0.32), 0.85);
    fillCircle(ops, x + 25, y + cardH / 2, 11, tint(GREEN, 0.2));
    drawCheckIcon(ops, x + 19, y + cardH / 2 - 5, 12, GREEN_DEEP);
    text(ops, x + 45, y + cardH / 2 + 2.5, item.label, 9.8, TEXT_DARK, true);
    text(ops, x + 45, y + cardH / 2 - 10, item.caption, 7.6, GREEN_DEEP, false);
  });

  return y;
}

function drawFooterBand(ops: string[], code?: string) {
  fillRect(ops, 0, 0, PAGE_W, FOOTER_H, NAVY);
  text(ops, MARGIN, 12, "INFINOOS WMS", 7.4, lerpColor(NAVY, WHITE, 0.42), true, "left", 2.6);
  const note = code
    ? `Documento gerado eletronicamente · ${code}`
    : "Documento gerado eletronicamente pelo sistema";
  text(ops, CONTENT_RIGHT, 12, note, 7.4, lerpColor(NAVY, WHITE, 0.38), false, "right");
}

function drawCheckIcon(ops: string[], x: number, y: number, size: number, color: RGB) {
  const p1 = [x + size * 0.16, y + size * 0.5];
  const p2 = [x + size * 0.4, y + size * 0.24];
  const p3 = [x + size * 0.86, y + size * 0.74];
  ops.push(
    `${color[0]} ${color[1]} ${color[2]} RG`,
    `${size * 0.16} w`,
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
  const drawX = align === "right" ? x - measureText(value, size, bold, letterSpacing) : x;
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

/** Draws a run of text and returns the x where the next run should start. */
function textRun(ops: string[], x: number, y: number, value: string, size: number, color: RGB, bold: boolean) {
  text(ops, x, y, value, size, color, bold);
  return x + measureText(value, size, bold);
}

function fillRect(ops: string[], x: number, y: number, width: number, height: number, color: RGB) {
  ops.push(`${color[0]} ${color[1]} ${color[2]} rg`, `${x} ${y} ${width} ${height} re f`);
}

function line(ops: string[], x1: number, y1: number, x2: number, y2: number, color: RGB, lineWidth: number) {
  ops.push(`${color[0]} ${color[1]} ${color[2]} RG`, `${lineWidth} w`, `${x1} ${y1} m ${x2} ${y2} l S`);
}

// 0.5523 is the standard circle/quarter-arc bezier constant.
const ARC = 0.5523;

function roundedRectPath(ops: string[], x: number, y: number, w: number, h: number, r: number) {
  const k = ARC * r;
  ops.push(
    `${x + r} ${y} m`,
    `${x + w - r} ${y} l`,
    `${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r} c`,
    `${x + w} ${y + h - r} l`,
    `${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h} c`,
    `${x + r} ${y + h} l`,
    `${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r} c`,
    `${x} ${y + r} l`,
    `${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c`,
  );
}

function roundedTopRectPath(ops: string[], x: number, y: number, w: number, h: number, r: number) {
  const k = ARC * r;
  ops.push(
    `${x} ${y} m`,
    `${x + w} ${y} l`,
    `${x + w} ${y + h - r} l`,
    `${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h} c`,
    `${x + r} ${y + h} l`,
    `${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r} c`,
    `${x} ${y} l`,
  );
}

function roundedBottomRectPath(ops: string[], x: number, y: number, w: number, h: number, r: number) {
  const k = ARC * r;
  ops.push(
    `${x} ${y + h} m`,
    `${x} ${y + r} l`,
    `${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c`,
    `${x + w - r} ${y} l`,
    `${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r} c`,
    `${x + w} ${y + h} l`,
    `${x} ${y + h} l`,
  );
}

function fillStrokeRoundedRect(
  ops: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: RGB,
  stroke: RGB,
  lineWidth: number,
) {
  ops.push(`${fill[0]} ${fill[1]} ${fill[2]} rg`);
  roundedRectPath(ops, x, y, w, h, r);
  ops.push("f");
  ops.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`, `${lineWidth} w`);
  roundedRectPath(ops, x, y, w, h, r);
  ops.push("S");
}

function fillCircle(ops: string[], cx: number, cy: number, r: number, color: RGB) {
  const k = ARC * r;
  ops.push(
    `${color[0]} ${color[1]} ${color[2]} rg`,
    `${cx - r} ${cy} m`,
    `${cx - r} ${cy + k} ${cx - k} ${cy + r} ${cx} ${cy + r} c`,
    `${cx + k} ${cy + r} ${cx + r} ${cy + k} ${cx + r} ${cy} c`,
    `${cx + r} ${cy - k} ${cx + k} ${cy - r} ${cx} ${cy - r} c`,
    `${cx - k} ${cy - r} ${cx - r} ${cy - k} ${cx - r} ${cy} c`,
    "f",
  );
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function tint(color: RGB, alpha: number): RGB {
  // Blends a color toward white to emulate a translucent fill/border,
  // since this hand-rolled PDF doesn't use real alpha compositing.
  return lerpColor(WHITE, color, alpha);
}

// Average glyph advance for the Helvetica pair, good enough for
// right-aligning and for laying runs side by side without loading the
// AFM width tables for the standard 14 fonts.
function measureText(value: string, size: number, bold: boolean, letterSpacing = 0) {
  const perEm = bold ? 0.56 : 0.52;
  return value.length * size * perEm + Math.max(0, value.length - 1) * letterSpacing;
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
// Minimal raw PDF document assembly (no external PDF library).
// ─────────────────────────────────────────────────────────────
function createBrandedPdfDocument(pages: string[]) {
  // Object layout: 1 catalog, 2 pages tree, then per-page [page, content]
  // pairs, then the two shared font objects.
  const firstPageObjectNumber = 3;
  const pageObjectNumbers = pages.map((_, index) => firstPageObjectNumber + index * 2);
  const contentObjectNumbers = pages.map((_, index) => firstPageObjectNumber + index * 2 + 1);
  const regularFontObject = firstPageObjectNumber + pages.length * 2;
  const boldFontObject = regularFontObject + 1;

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] >>`,
  );

  pages.forEach((contentStream, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = contentObjectNumbers[index];
    objects[pageObjectNumber - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${regularFontObject} 0 R /F2 ${boldFontObject} 0 R >> >> ` +
      `/Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber - 1] =
      `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`;
  });

  objects[regularFontObject - 1] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[boldFontObject - 1] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

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
