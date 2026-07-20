import { XMLParser } from "fast-xml-parser";

export type ImportedNfeItem = {
  codigo: string | null;
  ean: string | null;
  descricao: string;
  quantidade: number;
  ncm: string | null;
  cfop: string | null;
  cstCsosn: string | null;
  icmsValue: number;
  ipiValue: number;
  pisValue: number;
  cofinsValue: number;
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
  carrierName: string | null;
  grossWeight: number | null;
  additionalInfo: string | null;
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
    throw new Error("Nao foi possivel localizar o conteudo da NF-e no XML enviado.");
  }

  const ide = infNFe.ide ?? {};
  const emit = infNFe.emit ?? {};
  const dest = infNFe.dest ?? {};
  const transp = infNFe.transp ?? {};
  const total = infNFe.total?.ICMSTot ?? {};
  const det = ensureArray(infNFe.det);

  const items = det
    .map((item) => mapNfeItem(item))
    .filter((item): item is ImportedNfeItem => Boolean(item))
    .filter((item) => item.quantidade > 0);

  if (!items.length) {
    throw new Error("O XML da NF-e nao possui itens validos para importar.");
  }

  const volumeCount = ensureArray(transp.vol).reduce(
    (sum, volume) => sum + toPositiveNumber(volume?.qVol ?? 0),
    0,
  );
  const carrier = (transp.transporta ?? {}) as Record<string, unknown>;
  const firstVolume = ensureArray(transp.vol)[0] as Record<string, unknown> | undefined;

  return {
    accessKey: cleanString(protNFe?.chNFe) ?? extractAccessKeyFromId(infNFe.Id),
    direction: cleanString(ide.tpNF) === "1" ? "SAIDA" : "ENTRADA",
    noteNumber: cleanString(ide.nNF) ?? "Sem numero",
    supplierName: cleanString(emit.xNome) ?? "Fornecedor nao informado",
    supplierDocument: cleanString(emit.CNPJ) ?? cleanString(emit.CPF),
    recipientName: cleanString(dest.xNome) ?? "Destinatario nao informado",
    recipientDocument: cleanString(dest.CNPJ) ?? cleanString(dest.CPF),
    issuedAt: normalizeDateTime(ide.dhEmi ?? ide.dEmi ?? null),
    volumeCount,
    carrierName: cleanString(carrier.xNome),
    grossWeight: firstVolume?.pesoB != null ? toPositiveNumber(firstVolume.pesoB) : null,
    additionalInfo: cleanString(infNFe.infAdic?.infCpl),
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

function mapNfeItem(item: Record<string, unknown> | null | undefined) {
  const prod = (item?.prod ?? null) as Record<string, unknown> | null;
  const imposto = (item?.imposto ?? {}) as Record<string, unknown>;
  const icmsNode = extractFirstTaxNode(imposto.ICMS);
  const ipiContainer = extractFirstTaxNode(imposto.IPI);
  const ipiNode = extractNestedTaxNode(ipiContainer, ["IPITrib", "IPINT"]);
  const pisNode = extractFirstTaxNode(imposto.PIS);
  const cofinsNode = extractFirstTaxNode(imposto.COFINS);

  if (!prod) {
    return null;
  }

  return {
    codigo: cleanString(prod.cProd),
    ean: cleanString(prod.cEANTrib) ?? cleanString(prod.cEAN),
    descricao: cleanString(prod.xProd) ?? "Produto sem descricao",
    quantidade: toPositiveNumber(prod.qCom ?? prod.qTrib ?? 0),
    ncm: cleanString(prod.NCM),
    cfop: cleanString(prod.CFOP),
    cstCsosn: cleanString(icmsNode?.CST) ?? cleanString(icmsNode?.CSOSN),
    icmsValue: toPositiveNumber(icmsNode?.vICMS ?? 0),
    ipiValue: toPositiveNumber(ipiNode?.vIPI ?? 0),
    pisValue: toPositiveNumber(pisNode?.vPIS ?? 0),
    cofinsValue: toPositiveNumber(cofinsNode?.vCOFINS ?? 0),
  };
}

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractFirstTaxNode(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const [key, node] of Object.entries(record)) {
    if (key.startsWith("@")) {
      continue;
    }

    if (node && typeof node === "object") {
      return node as Record<string, unknown>;
    }
  }

  return record;
}

function extractNestedTaxNode(
  value: Record<string, unknown> | null,
  candidates: string[],
) {
  if (!value) {
    return null;
  }

  for (const key of candidates) {
    const node = value[key];
    if (node && typeof node === "object") {
      return node as Record<string, unknown>;
    }
  }

  return value;
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toPositiveNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function extractAccessKeyFromId(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/^NFe/i, "").trim();
  return cleaned || null;
}

function normalizeDateTime(value: string | null) {
  if (!value) {
    return null;
  }

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
