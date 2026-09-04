import AdmZip from "adm-zip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type StockExportRow = {
  sku: string;
  nome: string;
  categoria: string;
  depositante: string;
  estoque: number;
  reservado: number;
  disponivel: number;
  enderecos: string;
  status: string;
  faixa: string;
};

const HEADERS = ["SKU", "Produto", "Categoria", "Depositante", "Estoque", "Reservado", "Disponível", "Endereços", "Status", "Faixa"];

function rowValues(r: StockExportRow): (string | number)[] {
  return [r.sku, r.nome, r.categoria, r.depositante, r.estoque, r.reservado, r.disponivel, r.enderecos, r.status, r.faixa];
}

// ── CSV ─────────────────────────────────────────────────────────────────────
export function buildCsv(rows: StockExportRow[]): Buffer {
  const csv = [HEADERS, ...rows.map(rowValues)]
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

export function buildXlsx(rows: StockExportRow[]): Buffer {
  const dataRows: (string | number)[][] = [HEADERS, ...rows.map(rowValues)];

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
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Estoque" sheetId="1" r:id="rId1"/></sheets></workbook>`;

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
export async function buildPdf(rows: StockExportRow[], title: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 842;
  const pageH = 595;
  const margin = 32;
  const ink = rgb(0.05, 0.07, 0.13);
  const muted = rgb(0.4, 0.45, 0.55);
  const line = rgb(0.85, 0.88, 0.92);

  const cols: { label: string; w: number; align?: "right" }[] = [
    { label: "SKU", w: 90 },
    { label: "Produto", w: 190 },
    { label: "Categoria", w: 90 },
    { label: "Depositante", w: 110 },
    { label: "Estoque", w: 60, align: "right" },
    { label: "Reservado", w: 65, align: "right" },
    { label: "Disponível", w: 65, align: "right" },
    { label: "Status", w: 60 },
    { label: "Faixa", w: 88 },
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

  for (const r of rows) {
    if (y < margin + 20) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
      drawHeader();
    }
    const values = [r.sku, r.nome, r.categoria, r.depositante, r.estoque, r.reservado, r.disponivel, r.status, r.faixa];
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

  y -= 6;
  page.drawText(`${rows.length} produto(s)`, { x: margin, y, size: 9, font: bold, color: ink });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
