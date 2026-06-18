import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAppEnv, getBlingEnv } from "@/lib/env";
import type { DepositanteBlingConfig } from "@/lib/depositantes";

const BLING_AUTHORIZE_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
const BLING_TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";
const BLING_REVOKE_URL = "https://api.bling.com.br/oauth/revoke";
const BLING_COMPANY_URL = "https://api.bling.com.br/Api/v3/empresas/me/dados-basicos";
const BLING_SALES_ORDERS_URL = "https://api.bling.com.br/Api/v3/pedidos/vendas";

export type BlingOAuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

export type BlingWebhookEvent = {
  eventId: string;
  date: string;
  version: string;
  event: string;
  companyId: string;
  data: Record<string, unknown>;
};

export type BlingCompanyInfo = {
  id: string | null;
  nome: string | null;
};

export type BlingSaleOrderPayload = {
  id: string;
  numero: string | null;
  numeroLoja: string | null;
  data: string | null;
  dataSaida: string | null;
  total: number | null;
  situacao: string | null;
  observacoes: string | null;
  contato: {
    nome: string | null;
    documento: string | null;
    cidade: string | null;
    uf: string | null;
  };
  itens: Array<{
    id: string | null;
    codigo: string | null;
    descricao: string | null;
    quantidade: number;
    unidade: string | null;
    payload: Record<string, unknown>;
  }>;
  payload: Record<string, unknown>;
};

export type BlingConnectionSyncResult = {
  tokens: BlingOAuthTokens | null;
  company: BlingCompanyInfo | null;
  companyFetchError: string | null;
};

export function getAppBaseUrl(fallbackOrigin?: string) {
  const { publicAppUrl } = getAppEnv();
  return publicAppUrl || fallbackOrigin || "http://localhost:3000";
}

export function getBlingCallbackUrl(fallbackOrigin?: string) {
  return `${getAppBaseUrl(fallbackOrigin)}/api/integracoes/bling/oauth/callback`;
}

export function getBlingWebhookUrl(fallbackOrigin?: string) {
  return `${getAppBaseUrl(fallbackOrigin)}/api/integracoes/bling/webhook`;
}

export function assertBlingCredentials() {
  const env = getBlingEnv();

  if (!env.clientId || !env.clientSecret) {
    throw new Error(
      "As credenciais do Bling ainda não foram configuradas. Preencha BLING_CLIENT_ID e BLING_CLIENT_SECRET no ambiente.",
    );
  }

  return env;
}

export function createBlingOAuthState() {
  return randomBytes(24).toString("hex");
}

export function buildBlingAuthorizationUrl(state: string) {
  const { clientId } = assertBlingCredentials();
  const url = new URL(BLING_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeBlingAuthorizationCode(code: string) {
  return requestBlingTokens({
    grantType: "authorization_code",
    value: code,
  });
}

export async function refreshBlingAccessToken(refreshToken: string) {
  return requestBlingTokens({
    grantType: "refresh_token",
    value: refreshToken,
  });
}

export async function revokeBlingToken(token: string, tokenTypeHint: "access_token" | "refresh_token") {
  const { clientId, clientSecret } = assertBlingCredentials();
  const response = await fetch(BLING_REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      token,
      token_type_hint: tokenTypeHint,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Falha ao revogar o token do Bling.");
  }
}

export async function fetchBlingCompanyInfo(accessToken: string): Promise<BlingCompanyInfo> {
  const response = await fetch(BLING_COMPANY_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Falha ao consultar os dados básicos da empresa no Bling.");
  }

  const payload = (await response.json()) as {
    data?: {
      id?: string | number | null;
      nome?: string | null;
    };
  };

  return {
    id: payload.data?.id != null ? String(payload.data.id) : null,
    nome: payload.data?.nome?.trim() || null,
  };
}

export async function fetchBlingSaleOrder(
  accessToken: string,
  orderId: string,
): Promise<BlingSaleOrderPayload> {
  const response = await fetch(`${BLING_SALES_ORDERS_URL}/${orderId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Falha ao consultar o pedido de venda no Bling.");
  }

  const payload = (await response.json()) as {
    data?: Record<string, unknown>;
  };

  const data =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? payload.data
      : null;

  if (!data) {
    throw new Error("O Bling retornou um pedido de venda em formato inválido.");
  }

  const contato =
    data.contato && typeof data.contato === "object" && !Array.isArray(data.contato)
      ? (data.contato as Record<string, unknown>)
      : {};
  const endereco =
    contato.endereco && typeof contato.endereco === "object" && !Array.isArray(contato.endereco)
      ? (contato.endereco as Record<string, unknown>)
      : {};
  const geral =
    endereco.geral && typeof endereco.geral === "object" && !Array.isArray(endereco.geral)
      ? (endereco.geral as Record<string, unknown>)
      : {};
  const itens = Array.isArray(data.itens) ? data.itens : [];
  const normalizedItems = itens
    .map((item) => normalizeBlingSaleOrderItem(item))
    .filter((item): item is NonNullable<ReturnType<typeof normalizeBlingSaleOrderItem>> => item !== null);

  return {
    id: stringifyValue(data.id) ?? orderId,
    numero: stringifyValue(data.numero),
    numeroLoja: stringifyValue(data.numeroLoja),
    data: stringifyValue(data.data),
    dataSaida: stringifyValue(data.dataSaida),
    total: parseNumericValue(data.total),
    situacao: extractSituacao(data.situacao),
    observacoes: stringifyValue(data.observacoes),
    contato: {
      nome: stringifyValue(contato.nome),
      documento:
        stringifyValue(contato.numeroDocumento) ??
        stringifyValue(contato.documento),
      cidade: stringifyValue(geral.municipio) ?? stringifyValue(geral.cidade),
      uf: stringifyValue(geral.uf),
    },
    itens: normalizedItems,
    payload: data,
  };
}

export async function syncBlingConnectionMetadata(
  config: DepositanteBlingConfig,
): Promise<BlingConnectionSyncResult> {
  if (!config.refreshToken && !config.accessToken) {
    throw new Error("A integração do Bling não possui tokens válidos para sincronização.");
  }

  let tokens: BlingOAuthTokens | null = null;
  let accessToken = config.accessToken;

  const expiresAt = config.expiresAt ? new Date(config.expiresAt).getTime() : Number.NaN;
  const shouldRefreshToken =
    !accessToken ||
    Number.isNaN(expiresAt) ||
    expiresAt <= Date.now() + 60_000;

  if (shouldRefreshToken) {
    if (!config.refreshToken) {
      throw new Error("A integração do Bling não possui refresh token para renovar a sessão.");
    }

    tokens = await refreshBlingAccessToken(config.refreshToken);
    accessToken = tokens.access_token;
  }

  if (!accessToken) {
    throw new Error("Não foi possível obter um access token do Bling.");
  }

  try {
    const company = await fetchBlingCompanyInfo(accessToken);
    return {
      tokens,
      company,
      companyFetchError: null,
    };
  } catch (error) {
    return {
      tokens,
      company: null,
      companyFetchError: error instanceof Error ? error.message : "Falha ao consultar a empresa no Bling.",
    };
  }
}

export async function ensureValidBlingAccessToken(config: DepositanteBlingConfig) {
  if (!config.refreshToken && !config.accessToken) {
    throw new Error("A integração do Bling não possui tokens válidos.");
  }

  const expiresAt = config.expiresAt ? new Date(config.expiresAt).getTime() : Number.NaN;
  const shouldRefreshToken =
    !config.accessToken ||
    Number.isNaN(expiresAt) ||
    expiresAt <= Date.now() + 60_000;

  if (!shouldRefreshToken && config.accessToken) {
    return {
      accessToken: config.accessToken,
      tokens: null as BlingOAuthTokens | null,
    };
  }

  if (!config.refreshToken) {
    throw new Error("A integração do Bling não possui refresh token para renovar a sessão.");
  }

  const tokens = await refreshBlingAccessToken(config.refreshToken);
  return {
    accessToken: tokens.access_token,
    tokens,
  };
}

export function buildBlingConnectionConfig(
  tokens: BlingOAuthTokens,
  company: BlingCompanyInfo | null,
  webhookUrl: string,
): DepositanteBlingConfig {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const now = new Date().toISOString();

  return {
    connected: true,
    companyId: company?.id ?? null,
    companyName: company?.nome ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type || "Bearer",
    expiresAt,
    scopes: tokens.scope
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
    connectedAt: now,
    lastSyncAt: now,
    webhook: {
      resource: "order",
      url: webhookUrl,
      secret: null,
      active: true,
      lastEventId: null,
      lastEventAt: null,
    },
  };
}

export function validateBlingWebhookSignature(payload: string, signatureHeader: string | null) {
  const { clientSecret } = assertBlingCredentials();

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", clientSecret).update(payload, "utf8").digest("hex")}`;
  const providedBuffer = Buffer.from(signatureHeader, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function parseBlingWebhookPayload(payload: string): BlingWebhookEvent {
  const parsed = JSON.parse(payload) as Partial<BlingWebhookEvent>;

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof parsed.eventId !== "string" ||
    typeof parsed.date !== "string" ||
    typeof parsed.version !== "string" ||
    typeof parsed.event !== "string" ||
    typeof parsed.companyId !== "string" ||
    !parsed.data ||
    typeof parsed.data !== "object" ||
    Array.isArray(parsed.data)
  ) {
    throw new Error("Payload de webhook do Bling inválido.");
  }

  return parsed as BlingWebhookEvent;
}

function isBlingOAuthTokenPayload(value: unknown): value is BlingOAuthTokens {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.access_token === "string" &&
    typeof payload.refresh_token === "string" &&
    typeof payload.token_type === "string" &&
    typeof payload.expires_in === "number" &&
    typeof payload.scope === "string"
  );
}

function normalizeBlingSaleOrderItem(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const produto =
    item.produto && typeof item.produto === "object" && !Array.isArray(item.produto)
      ? (item.produto as Record<string, unknown>)
      : {};

  return {
    id: stringifyValue(item.id),
    codigo:
      stringifyValue(item.codigo) ??
      stringifyValue(produto.codigo) ??
      stringifyValue(produto.id),
    descricao:
      stringifyValue(item.descricao) ??
      stringifyValue(produto.nome) ??
      "Item sem descrição",
    quantidade: parseNumericValue(item.quantidade) ?? 0,
    unidade: stringifyValue(item.unidade),
    payload: item,
  };
}

function stringifyValue(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function parseNumericValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function extractSituacao(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const raw = value as Record<string, unknown>;
    return (
      stringifyValue(raw.valor) ??
      stringifyValue(raw.nome) ??
      stringifyValue(raw.descricao) ??
      stringifyValue(raw.id)
    );
  }

  return null;
}

async function requestBlingTokens({
  grantType,
  value,
}: {
  grantType: "authorization_code" | "refresh_token";
  value: string;
}) {
  const { clientId, clientSecret } = assertBlingCredentials();
  const body = new URLSearchParams({
    grant_type: grantType,
    [grantType === "authorization_code" ? "code" : "refresh_token"]: value,
  });

  const response = await fetch(BLING_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "1.0",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Falha ao autenticar com o Bling.");
  }

  const payload = await response.json();

  if (!isBlingOAuthTokenPayload(payload)) {
    throw new Error("O Bling retornou um payload de token inválido.");
  }

  return payload;
}
