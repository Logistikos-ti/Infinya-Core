// Configuração de MODO e MARCA por deploy (Fatia 1 do "armazém próprio").
//
// O modelo de entrega é uma instância por cliente, então modo e marca são
// definidos por variáveis de ambiente do deploy — não há troca em runtime.
// Todos os defaults reproduzem a marca atual (Infinoos), então uma instância
// sem nenhuma env de marca continua exatamente como está hoje.

export type AccountMode = "OWN" | "3PL";

/**
 * Modo da instância. "OWN" = operação própria (uma empresa opera o próprio
 * armazém, sem terceiros); "3PL" = operador logístico com depositantes-clientes.
 * Default "3PL" preserva o comportamento atual.
 */
export function getAccountMode(): AccountMode {
  return process.env.NEXT_PUBLIC_WMS_ACCOUNT_MODE?.trim().toUpperCase() === "OWN" ? "OWN" : "3PL";
}

export function isOwnOperationMode(): boolean {
  return getAccountMode() === "OWN";
}

export type BrandConfig = {
  /** Nome curto da marca (ex.: "Infinoos"). */
  name: string;
  /** Nome do produto (ex.: "Infinoos WMS"). */
  productName: string;
  /** Complemento exibido ao lado do nome (ex.: "WMS"). */
  shortName: string;
  /** Eyebrow em caixa alta (ex.: "INFINOOS"). */
  eyebrow: string;
  /** Descrição p/ metadata/manifest; null = o consumidor usa seu próprio default. */
  description: string | null;
  /** Caminho de um logo custom; null = o consumidor usa seu asset padrão. */
  logoSrc: string | null;
};

/**
 * Identidade visual por deploy. Campos textuais têm default = marca Infinoos,
 * então uma instância sem envs de marca não muda em nada. Para white-label, o
 * deploy do cliente define os NEXT_PUBLIC_BRAND_*.
 */
export function getBrand(): BrandConfig {
  const name = process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Infinoos";
  const productName = process.env.NEXT_PUBLIC_BRAND_PRODUCT_NAME?.trim() || `${name} WMS`;
  const shortName = process.env.NEXT_PUBLIC_BRAND_SHORT_NAME?.trim() || "WMS";
  const eyebrow = process.env.NEXT_PUBLIC_BRAND_EYEBROW?.trim() || name.toUpperCase();
  const description = process.env.NEXT_PUBLIC_BRAND_DESCRIPTION?.trim() || null;
  const logoSrc = process.env.NEXT_PUBLIC_BRAND_LOGO?.trim() || null;

  return { name, productName, shortName, eyebrow, description, logoSrc };
}
