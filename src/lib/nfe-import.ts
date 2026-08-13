import { XMLParser } from "fast-xml-parser";

export type ImportedNfeItem = {
  codigo: string | null;
  ean: string | null;
  descricao: string;
  quantidade: number;
  lote: string | null;
  validadeEm: string | null;
  lotes: ImportedNfeLot[];
  ncm: string | null;
  cfop: string | null;
  cstCsosn: string | null;
  icmsValue: number;
  ipiValue: number;
  pisValue: number;
  cofinsValue: number;
};

export type ImportedNfeLot = {
  lote: string | null;
  validadeEm: string | null;
  quantidade: number | null;
};

export type ParsedNfe = {
  accessKey: string | null;
  noteNumber: string;
  direction: "ENTRADA" | "SAIDA";
  supplierName: string;
  supplierDocument: string | null;
  recipientName: string;
  recipientDocument: string | null;
  recipientAddress: string | null;
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

/**
 * `file.text()` always assumes UTF-8, but a good share of Brazilian NF-e XMLs
 * are emitted as ISO-8859-1. Decoding those as UTF-8 silently corrupts every
 * accented character (supplier names, product descriptions) into U+FFFD, so
 * honour the encoding declared in the XML prolog instead.
 */
export function decodeXmlBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  // The prolog is ASCII-safe in every encoding we care about, so it is safe to
  // sniff it as latin1 before committing to a decoder.
  const prolog = new TextDecoder("iso-8859-1").decode(bytes.subarray(0, 256));
  const declared = prolog.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();

  if (declared && declared !== "utf-8" && declared !== "utf8") {
    try {
      return new TextDecoder(declared).decode(bytes);
    } catch {
      // Unknown/unsupported label — fall through to UTF-8.
    }
  }

  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * `file.text()` decodes whatever bytes were uploaded as UTF-8, so a binary
 * file (ZIP, PDF, ...) renamed to .xml arrives here as mojibake instead of
 * failing outright. Feeding that to the XML parser produces cryptic internal
 * errors like `readTagExp returned undefined at position 147109`, which used
 * to leak straight to the operator. Detect the common cases up front and
 * explain, in plain Portuguese, what the person actually needs to send.
 */
function assertLooksLikeXml(xml: string) {
  const head = xml.slice(0, 8);

  if (head.startsWith("PK")) {
    throw new Error(
      "Você enviou um arquivo compactado (ZIP), não o XML da NF-e. Descompacte o arquivo e envie o .xml que está dentro dele.",
    );
  }

  if (head.startsWith("%PDF")) {
    throw new Error(
      "Você enviou um PDF (provavelmente o DANFE), não o XML da NF-e. Envie o arquivo .xml emitido junto com a nota.",
    );
  }

  // A NUL byte can never appear in a well-formed XML document, so it is a
  // reliable binary marker. Deliberately NOT keying off U+FFFD counts here:
  // NF-e XMLs are often emitted in ISO-8859-1, and decoding those as UTF-8
  // legitimately produces many replacement chars for accented characters.
  if (xml.includes("\u0000")) {
    throw new Error(
      "O arquivo enviado não é um XML de texto (parece estar corrompido ou em formato binário). Baixe novamente o XML da NF-e e tente de novo.",
    );
  }

  if (!xml.includes("<")) {
    throw new Error("O arquivo enviado não contém um XML de NF-e válido.");
  }
}

export function parseNfeXml(xml: string): ParsedNfe {
  assertLooksLikeXml(xml);

  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new Error(
      "Não foi possível ler o XML da NF-e: o arquivo parece estar incompleto ou corrompido. Baixe novamente o XML e tente de novo.",
    );
  }
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
    recipientAddress: formatNfeAddress(dest.enderDest ?? dest.endereco ?? dest),
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

function formatNfeAddress(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const address = value as Record<string, unknown>;
  const street = [cleanString(address.xLgr), cleanString(address.nro)].filter(Boolean).join(", ");
  const neighborhood = cleanString(address.xBairro);
  const city = [cleanString(address.xMun), cleanString(address.UF)].filter(Boolean).join(" - ");
  const cep = cleanString(address.CEP);
  const parts = [street, neighborhood, city, cep ? `CEP ${cep}` : null].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
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
      lote: item.lote,
      validadeEm: item.validadeEm,
      lotes: item.lotes,
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

  const lotes = extractProductLots(prod);
  const firstLot = lotes[0] ?? null;

  return {
    codigo: cleanString(prod.cProd),
    ean: cleanString(prod.cEANTrib) ?? cleanString(prod.cEAN),
    descricao: cleanString(prod.xProd) ?? "Produto sem descricao",
    quantidade: toPositiveNumber(prod.qCom ?? prod.qTrib ?? 0),
    lote: firstLot?.lote ?? null,
    validadeEm: firstLot?.validadeEm ?? null,
    lotes,
    ncm: cleanString(prod.NCM),
    cfop: cleanString(prod.CFOP),
    cstCsosn: cleanString(icmsNode?.CST) ?? cleanString(icmsNode?.CSOSN),
    icmsValue: toPositiveNumber(icmsNode?.vICMS ?? 0),
    ipiValue: toPositiveNumber(ipiNode?.vIPI ?? 0),
    pisValue: toPositiveNumber(pisNode?.vPIS ?? 0),
    cofinsValue: toPositiveNumber(cofinsNode?.vCOFINS ?? 0),
  };
}

function extractProductLots(prod: Record<string, unknown>): ImportedNfeLot[] {
  const candidates = [...ensureArray(prod.rastro), ...ensureArray(prod.med)];
  const lots: ImportedNfeLot[] = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const node = candidate as Record<string, unknown>;
    const lote = cleanString(node.nLote);
    const validadeEm = normalizeDateOnly(cleanString(node.dVal));
    const quantidade = toPositiveNumber(node.qLote);

    if (!lote && !validadeEm) {
      continue;
    }

    lots.push({
      lote,
      validadeEm,
      quantidade: quantidade > 0 ? quantidade : null,
    });
  }

  return lots;
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

function normalizeDateOnly(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
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
