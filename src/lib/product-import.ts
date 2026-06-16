import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

export type ImportedProductRow = {
  nome: string;
  codigoInterno: string;
  codigoExterno: string | null;
  depositanteNome: string | null;
  unidadeEstocagem: "UNIDADE" | "CAIXA" | "PALLET";
  categoria: string | null;
  descricao: string | null;
  metodoRetirada: "FEFO" | "FIFO" | "LIFO";
};

type ParsedSpreadsheetRow = Record<string, string | null>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const headerAliases = {
  nome: ["nome", "produto", "nome do produto", "descricao produto"],
  codigoInterno: ["codigo interno", "codigo", "sku interno", "sku", "id produto"],
  codigoExterno: [
    "codigo externo",
    "ean",
    "gtin",
    "codigo de barras",
    "cod barras",
    "ean gtin",
  ],
  depositanteNome: ["depositante", "cliente", "empresa", "nome depositante"],
  unidadeEstocagem: [
    "unidade estocagem",
    "unidade de estocagem",
    "unidade",
    "unid estocagem",
    "tipo unidade",
  ],
  categoria: ["categoria", "grupo", "familia", "família", "linha"],
  descricao: ["descricao", "descrição", "detalhes", "observacoes", "observações"],
  metodoRetirada: [
    "metodo de retirada",
    "método de retirada",
    "metodo",
    "método",
    "retirada",
    "regra de retirada",
  ],
} satisfies Record<string, string[]>;

const normalizedHeaderAliases = Object.fromEntries(
  Object.entries(headerAliases).map(([key, aliases]) => [key, aliases.map(normalizeText)]),
) as Record<keyof typeof headerAliases, string[]>;

export async function parseProductSpreadsheet(file: File): Promise<ImportedProductRow[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    return parseCsvProducts(await file.text());
  }

  if (fileName.endsWith(".xlsx")) {
    return parseXlsxProducts(Buffer.from(await file.arrayBuffer()));
  }

  throw new Error("Formato não suportado. Envie uma planilha .xlsx ou .csv.");
}

export function detectDepositanteFromRows(
  rows: ImportedProductRow[],
  depositantes: { id: string; codigo: string; nome: string }[],
) {
  const nomes = [...new Set(rows.map((row) => row.depositanteNome).filter(Boolean))];

  if (nomes.length !== 1) {
    return null;
  }

  const originalName = nomes[0] ?? "";
  const normalizedOriginal = normalizeText(originalName);
  const codeMatch = originalName.match(/^(\d+)\s*-/);

  if (codeMatch) {
    const rawCode = codeMatch[1];
    const byCode = depositantes.find((item) => {
      const itemCode = item.codigo.trim();
      return itemCode === rawCode || Number(itemCode) === Number(rawCode);
    });

    if (byCode) {
      return byCode;
    }
  }

  return (
    depositantes.find((item) => {
      const normalizedDepositante = normalizeText(item.nome);
      return (
        normalizedDepositante === normalizedOriginal ||
        normalizedOriginal.includes(normalizedDepositante) ||
        normalizedDepositante.includes(normalizedOriginal)
      );
    }) ?? null
  );
}

function parseCsvProducts(csvText: string) {
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

  return mapRowsToImportedProducts(rows);
}

function parseXlsxProducts(buffer: Buffer) {
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

  return mapRowsToImportedProducts(dataRows);
}

function mapRowsToImportedProducts(rows: ParsedSpreadsheetRow[]) {
  return rows
    .map((row) => {
      const normalizedEntries = Object.entries(row).map(
        ([key, value]) => [normalizeText(key), value] as const,
      );
      const getValue = (canonicalKey: keyof typeof normalizedHeaderAliases) => {
        const aliases = normalizedHeaderAliases[canonicalKey];
        const found = normalizedEntries.find(([key]) => aliases.includes(key));
        return typeof found?.[1] === "string" ? found[1].trim() : found?.[1] ?? null;
      };

      const nome = String(getValue("nome") ?? "").trim();
      const codigoInterno = String(getValue("codigoInterno") ?? "").trim();

      if (!nome || !codigoInterno) {
        return null;
      }

      return {
        nome,
        codigoInterno,
        codigoExterno: cleanNullableExternalCode(getValue("codigoExterno")),
        depositanteNome: cleanNullableString(getValue("depositanteNome")),
        unidadeEstocagem: normalizeUnidade(getValue("unidadeEstocagem")),
        categoria: cleanNullableString(getValue("categoria")),
        descricao: cleanNullableString(getValue("descricao")),
        metodoRetirada: normalizeMetodo(getValue("metodoRetirada")),
      } satisfies ImportedProductRow;
    })
    .filter((item): item is ImportedProductRow => item !== null);
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

function cleanNullableExternalCode(value: unknown) {
  const cleaned = cleanNullableString(value);

  if (!cleaned) {
    return null;
  }

  const normalized = normalizeText(cleaned);

  if (normalized === "sem gtin" || normalized === "sem ean") {
    return null;
  }

  return cleaned;
}

function normalizeMetodo(value: unknown): "FEFO" | "FIFO" | "LIFO" {
  const cleaned = normalizeText(String(value ?? ""));

  if (cleaned.includes("fefo")) {
    return "FEFO";
  }

  if (cleaned.includes("lifo")) {
    return "LIFO";
  }

  return "FIFO";
}

function normalizeUnidade(value: unknown): "UNIDADE" | "CAIXA" | "PALLET" {
  const cleaned = normalizeText(String(value ?? ""));

  if (cleaned.includes("caixa")) {
    return "CAIXA";
  }

  if (cleaned.includes("pallet") || cleaned.includes("palete")) {
    return "PALLET";
  }

  return "UNIDADE";
}
