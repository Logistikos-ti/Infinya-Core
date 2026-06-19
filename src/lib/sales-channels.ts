export type SalesChannelCode =
  | "MERCADO_LIVRE"
  | "SHOPEE"
  | "AMAZON"
  | "MAGAZINE_LUIZA"
  | "OLIST"
  | "LOJA_INTEGRADA"
  | "SITE_PROPRIO"
  | "VENDA_DIRETA"
  | "OUTRO";

export type SalesChannelOption = {
  value: SalesChannelCode;
  label: string;
  marketplace: boolean;
};

export const SALES_CHANNEL_OPTIONS: readonly SalesChannelOption[] = [
  { value: "MERCADO_LIVRE", label: "Mercado Livre", marketplace: true },
  { value: "SHOPEE", label: "Shopee", marketplace: true },
  { value: "AMAZON", label: "Amazon", marketplace: true },
  { value: "MAGAZINE_LUIZA", label: "Magazine Luiza", marketplace: true },
  { value: "OLIST", label: "Olist", marketplace: true },
  { value: "LOJA_INTEGRADA", label: "Loja Integrada", marketplace: false },
  { value: "SITE_PROPRIO", label: "Site próprio", marketplace: false },
  { value: "VENDA_DIRETA", label: "Venda direta", marketplace: false },
  { value: "OUTRO", label: "Outro canal", marketplace: false },
] as const;

export function getSalesChannelOption(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  return SALES_CHANNEL_OPTIONS.find((option) => option.value === code) ?? null;
}

export function getSalesChannelLabel(code: string | null | undefined) {
  return getSalesChannelOption(code)?.label ?? null;
}

export function isMarketplaceChannel(code: string | null | undefined) {
  return getSalesChannelOption(code)?.marketplace ?? false;
}

export function detectSalesChannelFromPayload(payload: Record<string, unknown>) {
  const manualCommercial = readManualCommercial(payload);

  if (manualCommercial?.salesChannelCode) {
    return getSalesChannelOption(manualCommercial.salesChannelCode);
  }

  const loja = isRecord(payload.loja) ? payload.loja : null;
  const unidadeNegocio = loja && isRecord(loja.unidadeNegocio) ? loja.unidadeNegocio : null;
  const intermediador = isRecord(payload.intermediador) ? payload.intermediador : null;

  const cnpj = normalizeDigits(readString(intermediador?.cnpj));
  const login = readString(intermediador?.nomeUsuario);
  const lojaId = normalizeDigits(readString(loja?.id));
  const unidadeNegocioId = normalizeDigits(readString(unidadeNegocio?.id));

  const knownByCnpj: Record<string, SalesChannelCode> = {
    "03007331000141": "MERCADO_LIVRE",
    "35635824000112": "SHOPEE",
    "15436940000103": "AMAZON",
    "47960950000121": "MAGAZINE_LUIZA",
  };

  if (cnpj && knownByCnpj[cnpj]) {
    return getSalesChannelOption(knownByCnpj[cnpj]);
  }

  const knownByLojaId: Record<string, SalesChannelCode> = {
    "204422544": "MERCADO_LIVRE",
    "204440093": "SHOPEE",
    "204432941": "AMAZON",
    "204432814": "MAGAZINE_LUIZA",
  };

  if (lojaId && knownByLojaId[lojaId]) {
    return getSalesChannelOption(knownByLojaId[lojaId]);
  }

  const knownByBusinessUnitId: Record<string, SalesChannelCode> = {
    "2536457": "MERCADO_LIVRE",
    "1373757": "SHOPEE",
    "1368174": "AMAZON",
    "1368060": "MAGAZINE_LUIZA",
  };

  if (unidadeNegocioId && knownByBusinessUnitId[unidadeNegocioId]) {
    return getSalesChannelOption(knownByBusinessUnitId[unidadeNegocioId]);
  }

  if (login) {
    if (/amazon/i.test(login)) {
      return getSalesChannelOption("AMAZON");
    }

    if (/shopee/i.test(login)) {
      return getSalesChannelOption("SHOPEE");
    }

    if (/magalu|magazine/i.test(login)) {
      return getSalesChannelOption("MAGAZINE_LUIZA");
    }

    if (/mercado|ml|mercadolivre/i.test(login) || /evolveg/i.test(login)) {
      return getSalesChannelOption("MERCADO_LIVRE");
    }

    if (/olist/i.test(login)) {
      return getSalesChannelOption("OLIST");
    }
  }

  return null;
}

export function readMarketplaceDisplay(payload: Record<string, unknown>) {
  const manualCommercial = readManualCommercial(payload);

  if (typeof manualCommercial?.marketplace === "boolean") {
    return manualCommercial.marketplace ? "Sim" : "Não";
  }

  const detected = detectSalesChannelFromPayload(payload);
  return detected?.marketplace ? "Sim" : "Não";
}

export function readStoreDisplay(
  payload: Record<string, unknown>,
  storeNumberFallback: string | null,
) {
  const manualCommercial = readManualCommercial(payload);

  if (manualCommercial?.storeDisplay && !looksLikeTechnicalStoreName(manualCommercial.storeDisplay)) {
    return manualCommercial.storeDisplay;
  }

  const detected = detectSalesChannelFromPayload(payload);
  if (detected) {
    return detected.label;
  }

  const contato = isRecord(payload.contato) ? payload.contato : null;
  const loja = isRecord(payload.loja) ? payload.loja : null;
  const unidadeNegocio = loja && isRecord(loja.unidadeNegocio) ? loja.unidadeNegocio : null;

  return (
    readHumanStoreName(contato?.fantasia) ??
    readHumanStoreName(contato?.nomeFantasia) ??
    readHumanStoreName(contato?.nomeLoja) ??
    readHumanStoreName(unidadeNegocio?.id) ??
    readHumanStoreName(loja?.id) ??
    readHumanStoreName(storeNumberFallback) ??
    "Loja não identificada"
  );
}

export function buildManualCommercialPayload(input: {
  salesChannelCode: SalesChannelCode;
  customStoreName: string;
}) {
  const option = getSalesChannelOption(input.salesChannelCode);
  const fallbackLabel = option?.label ?? "Outro canal";
  const customStoreName = input.customStoreName.trim();

  return {
    manual: true,
    marketplace: option?.marketplace ?? false,
    salesChannelCode: input.salesChannelCode,
    storeDisplay:
      input.salesChannelCode === "OUTRO" && customStoreName ? customStoreName : fallbackLabel,
  };
}

export function readManualSalesChannelCode(payload: Record<string, unknown>) {
  return readManualCommercial(payload)?.salesChannelCode ?? null;
}

function readManualCommercial(payload: Record<string, unknown>) {
  const comercial = isRecord(payload.comercial) ? payload.comercial : null;

  if (!comercial) {
    return null;
  }

  const salesChannelCode = readString(comercial.salesChannelCode);
  const storeDisplay = readString(comercial.storeDisplay);
  const marketplace =
    typeof comercial.marketplace === "boolean" ? comercial.marketplace : undefined;

  return {
    salesChannelCode: (salesChannelCode as SalesChannelCode | null) ?? null,
    storeDisplay,
    marketplace,
  };
}

function readHumanStoreName(value: unknown) {
  const normalized = readString(value);
  if (!normalized || looksLikeTechnicalStoreName(normalized)) {
    return null;
  }

  return normalized;
}

function looksLikeTechnicalStoreName(value: string) {
  const compact = value.trim();

  if (!compact) {
    return true;
  }

  if (/^\d+$/.test(compact)) {
    return true;
  }

  if (/^[\d-]{8,}$/.test(compact)) {
    return true;
  }

  if (/^[A-Z0-9-]{10,}$/i.test(compact) && /\d/.test(compact)) {
    return true;
  }

  return false;
}

function normalizeDigits(value: string | null) {
  return value?.replace(/\D/g, "") ?? null;
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
