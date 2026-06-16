import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

export type ImportedAddressRow = {
  codigo: string;
  descricao: string | null;
  area: "PICKING" | "BLOQUEADO";
  rua: string | null;
  modulo: string | null;
  nivel: string | null;
  posicao: string | null;
  capacidadeMaxima: number | null;
  unidadePadrao: "UNIDADE" | "CAIXA" | "PALLET" | null;
  ativo: boolean;
};

type ParsedSpreadsheetRow = Record<string, string | null>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const headerAliases = {
  tipo: ["tipo"],
  endereco: ["endereco", "endereço"],
  enderecoPai: ["endereco pai", "endereço pai", "pai"],
} satisfies Record<string, string[]>;

const normalizedHeaderAliases = Object.fromEntries(
  Object.entries(headerAliases).map(([key, aliases]) => [key, aliases.map(normalizeText)]),
) as Record<keyof typeof headerAliases, string[]>;

export async function parseAddressSpreadsheet(file: File): Promise<ImportedAddressRow[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    return parseCsvAddresses(await file.text());
  }

  if (fileName.endsWith(".xlsx")) {
    return parseXlsxAddresses(Buffer.from(await file.arrayBuffer()));
  }

  throw new Error("Formato não suportado. Envie uma planilha .xlsx ou .csv.");
}

function parseCsvAddresses(csvText: string): ImportedAddressRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectCsvDelimiter(lines.slice(0, 5));
  const rowsAsArrays = lines.map((line) => splitDelimitedLine(line, delimiter));
  const headerIndex = detectHeaderRowIndexFromArrays(rowsAsArrays);

  if (headerIndex === -1) {
    return [];
  }

  const headers = rowsAsArrays[headerIndex];
  const rows = rowsAsArrays.slice(headerIndex + 1).map((values) => {
    const row: ParsedSpreadsheetRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? null;
    });

    return row;
  });

  return mapRowsToImportedAddresses(rows);
}

function parseXlsxAddresses(buffer: Buffer): ImportedAddressRow[] {
  const zip = new AdmZip(buffer);
  const workbookXml = zip.readAsText("xl/workbook.xml");
  const workbook = parser.parse(workbookXml);
  const workbookRels = parser.parse(zip.readAsText("xl/_rels/workbook.xml.rels"));
  const relationships = ensureArray(workbookRels.Relationships.Relationship);
  const firstSheet = ensureArray(workbook.workbook.sheets.sheet)[0];

  if (!firstSheet?.["r:id"]) {
    return [];
  }

  const relation = relationships.find((item) => item.Id === firstSheet["r:id"]);

  if (!relation?.Target) {
    return [];
  }

  const sheetPath = relation.Target.startsWith("worksheets/")
    ? `xl/${relation.Target}`
    : `xl/worksheets/${relation.Target.split("/").pop()}`;

  const sharedStrings = zip.getEntry("xl/sharedStrings.xml")
    ? parseSharedStrings(zip.readAsText("xl/sharedStrings.xml"))
    : [];

  const sheetXml = parser.parse(zip.readAsText(sheetPath));
  const rows = ensureArray(sheetXml.worksheet.sheetData?.row);
  const parsedRows = rows.map((row) => {
    const cells = ensureArray(row.c);
    const cellMap: Record<string, string | null> = {};

    for (const cell of cells) {
      const column = String(cell.r ?? "").match(/^[A-Z]+/)?.[0] ?? "";
      cellMap[column] = parseCellValue(cell, sharedStrings);
    }

    return cellMap;
  });

  if (!parsedRows.length) {
    return [];
  }

  const headerIndex = detectHeaderRowIndexFromColumnMaps(parsedRows);

  if (headerIndex === -1) {
    return [];
  }

  const headerColumns = Object.keys(parsedRows[headerIndex]).sort(compareExcelColumns);
  const headerValues = headerColumns.map((column) => parsedRows[headerIndex][column] ?? "");
  const dataRows = parsedRows.slice(headerIndex + 1).map((row) => {
    const parsedRow: ParsedSpreadsheetRow = {};

    headerColumns.forEach((column, index) => {
      const header = headerValues[index];

      if (header) {
        parsedRow[header] = row[column] ?? null;
      }
    });

    return parsedRow;
  });

  return mapRowsToImportedAddresses(dataRows);
}

function mapRowsToImportedAddresses(rows: ParsedSpreadsheetRow[]): ImportedAddressRow[] {
  const importedRows: ImportedAddressRow[] = [];

  rows.forEach((row) => {
    const normalizedEntries = Object.entries(row).map(
      ([key, value]) => [normalizeText(key), value] as const,
    );
    const getValue = (canonicalKey: keyof typeof normalizedHeaderAliases) => {
      const aliases = normalizedHeaderAliases[canonicalKey];
      const found = normalizedEntries.find(([key]) => aliases.includes(key));
      return typeof found?.[1] === "string" ? found[1].trim() : found?.[1] ?? null;
    };

    const tipo = String(getValue("tipo") ?? "").trim();
    const endereco = String(getValue("endereco") ?? "").trim();
    const enderecoPai = cleanNullableString(getValue("enderecoPai"));

    if (!tipo || !endereco) {
      return;
    }

    const normalizedTipo = normalizeText(tipo);

    if (
      normalizedTipo !== "posicao" &&
      normalizedTipo !== "blocado" &&
      normalizedTipo !== "bloqueado"
    ) {
      return;
    }

    const parts = endereco.split(".").map((part) => part.trim()).filter(Boolean);

    if (parts.length < 5) {
      return;
    }

    importedRows.push({
      codigo: endereco,
      descricao: enderecoPai ? `${tipo} vinculado a ${enderecoPai}` : tipo,
      area:
        normalizedTipo === "blocado" || normalizedTipo === "bloqueado"
          ? "BLOQUEADO"
          : "PICKING",
      rua: parts[1] ?? null,
      modulo: parts[2] ?? null,
      nivel: parts[3] ?? null,
      posicao: parts[4] ?? null,
      capacidadeMaxima: null,
      unidadePadrao: "PALLET",
      ativo: true,
    });
  });

  return importedRows;
}

function parseSharedStrings(xml: string) {
  const parsed = parser.parse(xml);
  const items = ensureArray(parsed.sst?.si);

  return items.map((item) => {
    if (typeof item.t === "string") {
      return item.t;
    }

    const runs = ensureArray(item.r);
    return runs.map((run) => run.t ?? "").join("");
  });
}

function parseCellValue(
  cell: {
    t?: string;
    v?: string;
    is?: { t?: string; r?: Array<{ t?: string }> | { t?: string } };
  },
  sharedStrings: string[],
) {
  if (cell.t === "s" && typeof cell.v !== "undefined") {
    return sharedStrings[Number(cell.v)] ?? null;
  }

  if (cell.t === "inlineStr" && cell.is) {
    if (typeof cell.is.t === "string") {
      return cell.is.t;
    }

    const runs = ensureArray(cell.is.r);
    return runs.map((run) => run.t ?? "").join("");
  }

  if (typeof cell.v !== "undefined") {
    return String(cell.v);
  }

  return null;
}

function splitDelimitedLine(line: string, delimiter: "," | ";") {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((item) => item.trim());
}

function detectCsvDelimiter(lines: string[]) {
  const commaScore = lines.reduce((total, line) => total + (line.match(/,/g)?.length ?? 0), 0);
  const semicolonScore = lines.reduce((total, line) => total + (line.match(/;/g)?.length ?? 0), 0);

  return semicolonScore > commaScore ? ";" : ",";
}

function detectHeaderRowIndexFromArrays(rows: string[][]) {
  let bestIndex = -1;
  let bestScore = 0;

  rows.slice(0, 10).forEach((row, index) => {
    const score = countHeaderMatches(row);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 2 ? bestIndex : -1;
}

function detectHeaderRowIndexFromColumnMaps(rows: Array<Record<string, string | null>>) {
  let bestIndex = -1;
  let bestScore = 0;

  rows.slice(0, 10).forEach((row, index) => {
    const orderedValues = Object.keys(row)
      .sort(compareExcelColumns)
      .map((column) => row[column] ?? "");
    const score = countHeaderMatches(orderedValues);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 2 ? bestIndex : -1;
}

function countHeaderMatches(values: Array<string | null | undefined>) {
  const normalizedValues = values.map((value) => normalizeText(String(value ?? ""))).filter(Boolean);
  let matches = 0;

  Object.values(normalizedHeaderAliases).forEach((aliases) => {
    if (normalizedValues.some((value) => aliases.includes(value))) {
      matches += 1;
    }
  });

  return matches;
}

function compareExcelColumns(left: string, right: string) {
  return excelColumnToNumber(left) - excelColumnToNumber(right);
}

function excelColumnToNumber(value: string) {
  return value.split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function ensureArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [] as T[];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}
