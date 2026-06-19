import { XMLParser } from "fast-xml-parser";

export type ImportedNfeItem = {
  codigo: string | null;
  ean: string | null;
  descricao: string;
  quantidade: number;
};

export type ParsedNfe = {
  accessKey: string | null;
  noteNumber: string;
  direction: "ENTRADA" | "SAIDA";
  supplierName: string;
  supplierDocument: string | null;
  recipientName: string;
  recipientDocument: string | null;
  issuedAt: string | null;
  volumeCount: number;
  totalValue: number;
  protocolNumber: string | null;
  protocolStatusCode: string | null;
  protocolStatusLabel: string | null;
  items: ImportedNfeItem[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

export function parseNfeXml(xml: string): ParsedNfe {
  const parsed = parser.parse(xml);
  const envelope = parsed.nfeProc ?? parsed.NFe ?? parsed.enviNFe ?? parsed.procNFe ?? parsed;
  const nfe = envelope.NFe ?? envelope.nfe ?? envelope;
  const infNFe = nfe.infNFe ?? envelope.infNFe;
  const protNFe = envelope.protNFe?.infProt ?? parsed.protNFe?.infProt ?? null;

  if (!infNFe) {
    throw new Error("Não foi possível localizar o conteúdo da NF-e no XML enviado.");
  }

  const ide = infNFe.ide ?? {};
  const emit = infNFe.emit ?? {};
  const dest = infNFe.dest ?? {};
  const transp = infNFe.transp ?? {};
  const total = infNFe.total?.ICMSTot ?? {};
  const det = ensureArray(infNFe.det);

  const items = det
    .map((item) => item?.prod ?? null)
    .filter(Boolean)
    .map((prod) => ({
      codigo: cleanString(prod.cProd),
      ean: cleanString(prod.cEANTrib) ?? cleanString(prod.cEAN),
      descricao: cleanString(prod.xProd) ?? "Produto sem descrição",
      quantidade: toPositiveNumber(prod.qCom ?? prod.qTrib ?? 0),
    }))
    .filter((item) => item.quantidade > 0);

  if (!items.length) {
    throw new Error("O XML da NF-e não possui itens válidos para importar.");
  }

  const volumeCount = ensureArray(transp.vol).reduce(
    (sum, volume) => sum + toPositiveNumber(volume?.qVol ?? 0),
    0,
  );

  return {
    accessKey: cleanString(protNFe?.chNFe) ?? extractAccessKeyFromId(infNFe.Id),
    direction: cleanString(ide.tpNF) === "1" ? "SAIDA" : "ENTRADA",
    noteNumber: cleanString(ide.nNF) ?? "Sem número",
    supplierName: cleanString(emit.xNome) ?? "Fornecedor não informado",
    supplierDocument: cleanString(emit.CNPJ) ?? cleanString(emit.CPF),
    recipientName: cleanString(dest.xNome) ?? "Destinatário não informado",
    recipientDocument: cleanString(dest.CNPJ) ?? cleanString(dest.CPF),
    issuedAt: normalizeDateTime(ide.dhEmi ?? ide.dEmi ?? null),
    volumeCount,
    totalValue: toPositiveNumber(total.vNF ?? 0),
    protocolNumber: cleanString(protNFe?.nProt),
    protocolStatusCode: cleanString(protNFe?.cStat),
    protocolStatusLabel: cleanString(protNFe?.xMotivo),
    items,
  };
}

export function matchNfeProductsToCatalog(
  nfeItems: ImportedNfeItem[],
  products: Array<{
    id: string;
    nome: string;
    sku: string;
    codigo_interno: string;
    codigo_externo: string | null;
  }>,
) {
  const byExternal = new Map<string, string>();
  const byInternal = new Map<string, string>();
  const byName = new Map<string, string>();
  const productMap = new Map(products.map((product) => [product.id, product]));

  for (const product of products) {
    const externalKey = normalizeCode(product.codigo_externo);
    const internalKey = normalizeCode(product.codigo_interno);
    const skuKey = normalizeCode(product.sku);
    const nameKey = normalizeText(product.nome);

    if (externalKey && !byExternal.has(externalKey)) {
      byExternal.set(externalKey, product.id);
    }

    if (internalKey && !byInternal.has(internalKey)) {
      byInternal.set(internalKey, product.id);
    }

    if (skuKey && !byInternal.has(skuKey)) {
      byInternal.set(skuKey, product.id);
    }

    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, product.id);
    }
  }

  const matched = [];
  const unmatched = [];

  for (const item of nfeItems) {
    const externalKey = normalizeCode(item.ean);
    const internalKey = normalizeCode(item.codigo);
    const nameKey = normalizeText(item.descricao);
    const productId =
      (externalKey ? byExternal.get(externalKey) : null) ??
      (internalKey ? byInternal.get(internalKey) : null) ??
      (nameKey ? byName.get(nameKey) : null) ??
      null;

    if (!productId) {
      unmatched.push(item);
      continue;
    }

    const product = productMap.get(productId);

    if (!product) {
      unmatched.push(item);
      continue;
    }

    matched.push({
      productId: product.id,
      sku: product.sku,
      nome: product.nome,
      quantidade: item.quantidade,
      origemCodigo: item.codigo,
      origemEan: item.ean,
    });
  }

  return { matched, unmatched };
}

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toPositiveNumber(value: unknown) {
  const normalized =
    typeof value === "string" ? Number(value.replace(/\./g, "").replace(",", ".")) : Number(value);

  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function extractAccessKeyFromId(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/^NFe/i, "").trim();
  return cleaned || null;
}

function normalizeDateTime(value: string | null) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }

  return null;
}

function normalizeCode(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return normalized || null;
}

function normalizeText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return normalized || null;
}
