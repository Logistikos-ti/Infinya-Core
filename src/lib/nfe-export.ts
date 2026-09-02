import AdmZip from "adm-zip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { FiscalDocumentDetail } from "@/lib/fiscal-documents";

// ── Helpers de formatação (servidor) ───────────────────────────────────────
export type StatusKey = "AUTORIZADA" | "PENDENTE" | "CANCELADA" | "DENEGADA";

const STATUS_LABEL: Record<StatusKey, string> = {
  AUTORIZADA: "Autorizada",
  PENDENTE: "Pendente",
  CANCELADA: "Cancelada",
  DENEGADA: "Denegada",
};

export function nfeStatusKey(code: string | null): StatusKey {
  if (code === "100" || code === "150") return "AUTORIZADA";
  if (["101", "135", "151", "155"].includes(code ?? "")) return "CANCELADA";
  if (["110", "301", "302", "303"].includes(code ?? "")) return "DENEGADA";
  return "PENDENTE";
}

function statusLabel(code: string | null): string {
  return STATUS_LABEL[nfeStatusKey(code)];
}

function formatDoc(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return value;
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(d);
}

function counterparty(d: FiscalDocumentDetail) {
  return d.flow === "ENTRADA"
    ? { nome: d.issuerName, doc: d.issuerDocument }
    : { nome: d.recipientName, doc: d.recipientDocument };
}

const HEADERS = [
  "Número",
  "Tipo",
  "Emitente/Destinatário",
  "Documento",
  "Depositante",
  "Data",
  "Valor",
  "Itens",
  "Status",
  "Chave de acesso",
];

// ── CSV ─────────────────────────────────────────────────────────────────────
export function buildCsv(details: FiscalDocumentDetail[]): Buffer {
  const rows = details.map((d) => {
    const cp = counterparty(d);
    return [
      d.noteNumber,
      d.flow === "ENTRADA" ? "Entrada" : "Saída",
      cp.nome,
      formatDoc(cp.doc),
      d.depositante,
      formatDate(d.issuedAt ?? d.createdAt),
      d.totalValue.toFixed(2).replace(".", ","),
      String(d.itemCount),
      statusLabel(d.protocolStatusCode),
      d.accessKey ?? "",
    ];
  });
  const csv = [HEADERS, ...rows]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  // BOM para o Excel abrir os acentos corretamente.
  return Buffer.from("﻿" + csv, "utf-8");
}

// ── XLSX (OOXML mínimo, empacotado com adm-zip) ─────────────────────────────
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function buildXlsx(details: FiscalDocumentDetail[]): Buffer {
  // Cada linha é um array de células: string (inlineStr) ou number.
  const dataRows: (string | number)[][] = [
    HEADERS,
    ...details.map((d) => {
      const cp = counterparty(d);
      return [
        d.noteNumber,
        d.flow === "ENTRADA" ? "Entrada" : "Saída",
        cp.nome,
        formatDoc(cp.doc),
        d.depositante,
        formatDate(d.issuedAt ?? d.createdAt),
        d.totalValue,
        d.itemCount,
        statusLabel(d.protocolStatusCode),
        d.accessKey ?? "",
      ] as (string | number)[];
    }),
  ];

  const sheetRows = dataRows
    .map((cells, r) => {
      const cellsXml = cells
        .map((cell, c) => {
          const ref = `${colLetter(c)}${r + 1}`;
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(cell))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cellsXml}</row>`;
    })
    .join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="NF-e" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from(contentTypes, "utf-8"));
  zip.addFile("_rels/.rels", Buffer.from(rels, "utf-8"));
  zip.addFile("xl/workbook.xml", Buffer.from(workbook, "utf-8"));
  zip.addFile("xl/_rels/workbook.xml.rels", Buffer.from(workbookRels, "utf-8"));
  zip.addFile("xl/worksheets/sheet1.xml", Buffer.from(sheet, "utf-8"));
  return zip.toBuffer();
}

// ── PDF (tabela simples com pdf-lib, paisagem) ──────────────────────────────
export async function buildPdf(details: FiscalDocumentDetail[], title: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 842;
  const pageH = 595;
  const margin = 32;
  const ink = rgb(0.05, 0.07, 0.13);
  const muted = rgb(0.4, 0.45, 0.55);
  const line = rgb(0.85, 0.88, 0.92);

  // colunas: [label, x, width]
  const cols: { label: string; w: number; align?: "right" }[] = [
    { label: "Número", w: 55 },
    { label: "Tipo", w: 55 },
    { label: "Emitente/Destinatário", w: 210 },
    { label: "Depositante", w: 150 },
    { label: "Data", w: 70 },
    { label: "Valor", w: 85, align: "right" },
    { label: "Status", w: 80 },
  ];
  const startX = margin;

  const fit = (text: string, width: number, size: number, f = font) => {
    let t = text ?? "";
    while (t.length > 0 && f.widthOfTextAtSize(t, size) > width - 4) t = t.slice(0, -1);
    return t === text ? t : t.slice(0, Math.max(0, t.length - 1)) + "…";
  };

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const drawHeader = () => {
    page.drawText(title, { x: margin, y, size: 14, font: bold, color: ink });
    y -= 22;
    let x = startX;
    for (const col of cols) {
      page.drawText(col.label, { x: col.align === "right" ? x + col.w - bold.widthOfTextAtSize(col.label, 8) - 4 : x, y, size: 8, font: bold, color: muted });
      x += col.w;
    }
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1, color: line });
    y -= 14;
  };

  drawHeader();

  for (const d of details) {
    if (y < margin + 20) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
      drawHeader();
    }
    const cp = counterparty(d);
    const values = [
      d.noteNumber,
      d.flow === "ENTRADA" ? "Entrada" : "Saída",
      cp.nome,
      d.depositante,
      formatDate(d.issuedAt ?? d.createdAt),
      formatBRL(d.totalValue),
      statusLabel(d.protocolStatusCode),
    ];
    let x = startX;
    values.forEach((val, i) => {
      const col = cols[i];
      const text = fit(String(val ?? ""), col.w, 8.5);
      const tx = col.align === "right" ? x + col.w - font.widthOfTextAtSize(text, 8.5) - 4 : x;
      page.drawText(text, { x: tx, y, size: 8.5, font, color: ink });
      x += col.w;
    });
    y -= 8;
    page.drawLine({ start: { x: margin, y: y + 2 }, end: { x: pageW - margin, y: y + 2 }, thickness: 0.4, color: line });
    y -= 8;
  }

  // Rodapé com total
  const total = details.reduce((sum, d) => sum + d.totalValue, 0);
  if (y < margin + 24) {
    page = doc.addPage([pageW, pageH]);
    y = pageH - margin;
  }
  y -= 6;
  page.drawText(`${details.length} nota(s) · Total ${formatBRL(total)}`, {
    x: margin,
    y,
    size: 9,
    font: bold,
    color: ink,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ── ZIP: arquivo de export + XMLs ───────────────────────────────────────────
export function buildZip(
  exportFile: { name: string; content: Buffer } | null,
  xmls: { name: string; content: Buffer }[],
): Buffer {
  const zip = new AdmZip();
  if (exportFile) zip.addFile(exportFile.name, exportFile.content);
  const used = new Set<string>();
  for (const xml of xmls) {
    let name = xml.name;
    let i = 1;
    while (used.has(name)) {
      const dot = xml.name.lastIndexOf(".");
      name = dot > 0 ? `${xml.name.slice(0, dot)}-${i}${xml.name.slice(dot)}` : `${xml.name}-${i}`;
      i += 1;
    }
    used.add(name);
    zip.addFile(`xmls/${name}`, xml.content);
  }
  return zip.toBuffer();
}
