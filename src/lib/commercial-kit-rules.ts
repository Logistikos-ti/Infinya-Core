export type CommercialKitRuleDraft = {
  matchText: string;
  operationalQuantity: number;
};

export type CommercialKitRuleDefinition = {
  id: string;
  depositanteId: string;
  productId: string;
  productName: string;
  productSku: string | null;
  productInternalCode: string | null;
  productBarcode: string | null;
  matchText: string;
  operationalQuantity: number;
  active: boolean;
};

export type ProductCommercialKitRuleOption = {
  id: string;
  matchText: string;
  operationalQuantity: number;
};

export type ProductLookupForCommercialKit = {
  id: string;
  codigo_interno: string;
  codigo_externo: string | null;
  sku: string | null;
  nome: string;
  imagem_principal_url?: string | null;
};

export type CommercialKitMatchResult = {
  matchedProduct: ProductLookupForCommercialKit | null;
  payload: Record<string, unknown>;
  usesCommercialKitRule: boolean;
};

export function normalizeCommercialKitRuleDrafts(
  matchTexts: string[],
  quantityValues: string[],
): CommercialKitRuleDraft[] {
  return matchTexts
    .map((matchText, index) => ({
      matchText: matchText.trim(),
      operationalQuantity: normalizePositiveQuantity(quantityValues[index] ?? ""),
    }))
    .filter((item) => item.matchText && item.operationalQuantity > 0);
}

export function buildCommercialKitPayload(
  currentPayload: Record<string, unknown> | null | undefined,
  matchedProduct: ProductLookupForCommercialKit,
  rule: CommercialKitRuleDefinition,
  sourceDescription: string | null,
) {
  const payload = isRecord(currentPayload) ? currentPayload : {};

  return {
    ...payload,
    kit_operacional: {
      origem: "REGRA_COMERCIAL",
      descricaoComercial: sourceDescription,
      regraId: rule.id,
      textoGatilho: rule.matchText,
      componentes: [
        {
          produtoComponenteId: matchedProduct.id,
          quantidadePorKit: rule.operationalQuantity,
          sku: matchedProduct.sku ?? matchedProduct.codigo_interno,
          nome: matchedProduct.nome,
          codigoInterno: matchedProduct.codigo_interno,
          barcode: matchedProduct.codigo_externo,
        },
      ],
    },
  } satisfies Record<string, unknown>;
}

export function resolveCommercialKitMatch(params: {
  itemCode: string | null;
  itemDescription: string | null;
  existingPayload: Record<string, unknown>;
  matchedProductByCode: ProductLookupForCommercialKit | null;
  rules: CommercialKitRuleDefinition[];
}) {
  const { itemDescription, existingPayload, matchedProductByCode, rules } = params;

  if (hasOperationalKit(existingPayload)) {
    return {
      matchedProduct: matchedProductByCode,
      payload: existingPayload,
      usesCommercialKitRule: false,
    } satisfies CommercialKitMatchResult;
  }

  const normalizedDescription = normalizeText(itemDescription);
  if (!normalizedDescription) {
    return {
      matchedProduct: matchedProductByCode,
      payload: existingPayload,
      usesCommercialKitRule: false,
    } satisfies CommercialKitMatchResult;
  }

  const sortedRules = [...rules]
    .filter((rule) => rule.active)
    .sort((left, right) => right.matchText.length - left.matchText.length);

  const rule = sortedRules.find((currentRule) =>
    normalizedDescription.includes(normalizeText(currentRule.matchText)),
  );

  if (!rule) {
    return {
      matchedProduct: matchedProductByCode,
      payload: existingPayload,
      usesCommercialKitRule: false,
    } satisfies CommercialKitMatchResult;
  }

  const matchedProduct =
    matchedProductByCode ??
    ({
      id: rule.productId,
      codigo_interno: rule.productInternalCode ?? rule.productSku ?? rule.matchText,
      codigo_externo: rule.productBarcode,
      sku: rule.productSku,
      nome: rule.productName,
      // @ts-ignore - The property exists on the rule from our cast in shipping-conference.ts
      imagem_principal_url: rule.imagem_principal_url,
    } satisfies ProductLookupForCommercialKit);

  const isAliasOnly = rule.operationalQuantity === 1 && !hasOperationalKit(existingPayload);
  const finalPayload = isAliasOnly 
    ? existingPayload 
    : buildCommercialKitPayload(existingPayload, matchedProduct, rule, itemDescription);

  return {
    matchedProduct,
    payload: finalPayload,
    usesCommercialKitRule: true,
  } satisfies CommercialKitMatchResult;
}

export function isCommercialKitOrderPayload(payload: Record<string, unknown> | null | undefined) {
  const section = isRecord(payload?.kit_operacional) ? payload.kit_operacional : null;
  return readString(section?.origem) === "REGRA_COMERCIAL";
}

function hasOperationalKit(payload: Record<string, unknown> | null | undefined) {
  const section = isRecord(payload?.kit_operacional) ? payload.kit_operacional : null;
  const components = Array.isArray(section?.componentes) ? section.componentes : [];
  return components.length > 0;
}

function normalizePositiveQuantity(value: unknown) {
  const source = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const numeric = Number(source.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, numeric);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  return null;
}
