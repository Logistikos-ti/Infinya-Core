import { getAppEnv, getMercadoLivreEnv } from "@/lib/env";
import type { DepositanteMercadoLivreConfig } from "@/lib/depositantes";

const ML_AUTHORIZE_URL = "https://auth.mercadolivre.com.br/authorization";
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const ML_USER_URL = "https://api.mercadolibre.com/users/me";
const ML_SHIPMENT_URL = "https://api.mercadolibre.com/shipments";
const ML_LABELS_URL = "https://api.mercadolibre.com/shipment_labels";

export type MercadoLivreOAuthTokens = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id?: number | string;
  refresh_token?: string;
};

export type MercadoLivreUserInfo = {
  id: string | null;
  nickname: string | null;
};

export type MercadoLivreShipmentInfo = {
  id: string;
  trackingNumber: string | null;
  trackingMethod: string | null;
  status: string | null;
  substatus: string | null;
  logisticType: string | null;
  senderId: string | null;
  receiverId: string | null;
};

export type MercadoLivreOrderInfo = {
  id: string;
  shippingId: string | null;
  status: string | null;
};

export type MercadoLivreRemoteDocument = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

export function getMercadoLivreCallbackUrl(fallbackOrigin?: string) {
  return `${getAppBaseUrl(fallbackOrigin)}/api/integracoes/mercado-livre/oauth/callback`;
}

export function assertMercadoLivreCredentials() {
  const env = getMercadoLivreEnv();

  if (!env.clientId || !env.clientSecret) {
    throw new Error(
      "As credenciais do Mercado Livre ainda não foram configuradas. Preencha MERCADO_LIVRE_CLIENT_ID e MERCADO_LIVRE_CLIENT_SECRET no ambiente.",
    );
  }

  return env;
}

export function createMercadoLivreOAuthState() {
  return crypto.randomUUID();
}

export function buildMercadoLivreAuthorizationUrl(state: string) {
  const { clientId } = assertMercadoLivreCredentials();
  const callbackUrl = getMercadoLivreCallbackUrl();
  const url = new URL(ML_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeMercadoLivreAuthorizationCode(code: string) {
  const { clientId, clientSecret } = assertMercadoLivreCredentials();
  const callbackUrl = getMercadoLivreCallbackUrl();

  return requestMercadoLivreTokens({
    code,
    clientId,
    clientSecret,
    redirectUri: callbackUrl,
    grantType: "authorization_code",
  });
}

export async function refreshMercadoLivreAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = assertMercadoLivreCredentials();

  return requestMercadoLivreTokens({
    refreshToken,
    clientId,
    clientSecret,
    grantType: "refresh_token",
  });
}

export async function fetchMercadoLivreUserInfo(accessToken: string): Promise<MercadoLivreUserInfo> {
  const response = await fetch(ML_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Falha ao consultar o usuário do Mercado Livre.");
  }

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    id: stringifyValue(payload.id),
    nickname: stringifyValue(payload.nickname),
  };
}

export async function ensureValidMercadoLivreAccessToken(config: DepositanteMercadoLivreConfig) {
  if (!config.accessToken) {
    throw new Error("A integração do Mercado Livre não possui tokens válidos.");
  }

  if (!config.expiresAt) {
    return {
      accessToken: config.accessToken,
      tokens: null as MercadoLivreOAuthTokens | null,
    };
  }

  const expiresAtMs = new Date(config.expiresAt).getTime();
  const shouldRefresh = Number.isNaN(expiresAtMs) || expiresAtMs - Date.now() < 5 * 60 * 1000;

  if (!shouldRefresh) {
    return {
      accessToken: config.accessToken,
      tokens: null as MercadoLivreOAuthTokens | null,
    };
  }

  if (!config.refreshToken) {
    throw new Error("A integração do Mercado Livre não possui refresh token para renovar a sessão.");
  }

  const tokens = await refreshMercadoLivreAccessToken(config.refreshToken);

  return {
    accessToken: tokens.access_token,
    tokens,
  };
}

export async function fetchMercadoLivreShipment(
  accessToken: string,
  shipmentId: string,
): Promise<MercadoLivreShipmentInfo> {
  const response = await fetch(`${ML_SHIPMENT_URL}/${shipmentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      buildMercadoLivreApiErrorMessage(errorText, "Falha ao consultar o envio no Mercado Livre."),
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    id: stringifyValue(payload.id) ?? shipmentId,
    trackingNumber: stringifyValue(payload.tracking_number),
    trackingMethod: stringifyValue(payload.tracking_method),
    status: stringifyValue(payload.status),
    substatus: stringifyValue(payload.substatus),
    logisticType: stringifyValue(payload.logistic_type),
    senderId: stringifyValue(payload.sender_id),
    receiverId: stringifyValue(payload.receiver_id),
  };
}

export async function fetchMercadoLivreOrder(
  accessToken: string,
  orderId: string,
): Promise<MercadoLivreOrderInfo> {
  const response = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      buildMercadoLivreApiErrorMessage(errorText, "Falha ao consultar o pedido no Mercado Livre."),
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const shipping = isRecord(payload.shipping) ? payload.shipping : null;

  return {
    id: stringifyValue(payload.id) ?? orderId,
    shippingId: stringifyValue(shipping?.id),
    status: stringifyValue(payload.status),
  };
}

export async function downloadMercadoLivreShipmentLabel(
  accessToken: string,
  shipmentId: string,
  format: "pdf" | "zpl2" = "pdf",
): Promise<MercadoLivreRemoteDocument> {
  const url = new URL(ML_LABELS_URL);
  url.searchParams.set("shipment_ids", shipmentId);
  url.searchParams.set("response_type", format);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: format === "pdf" ? "application/pdf" : "application/octet-stream",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      buildMercadoLivreApiErrorMessage(
        errorText,
        "Falha ao baixar a etiqueta do Mercado Livre.",
      ),
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  if (!bytes.byteLength) {
    throw new Error("O Mercado Livre retornou a etiqueta sem conteúdo.");
  }

  return {
    fileName: `mercado-livre-${shipmentId}.${format === "pdf" ? "pdf" : "txt"}`,
    mimeType: format === "pdf" ? "application/pdf" : "application/octet-stream",
    bytes,
  };
}

export function buildMercadoLivreConnectionConfig(
  tokens: MercadoLivreOAuthTokens,
  user: MercadoLivreUserInfo | null,
): DepositanteMercadoLivreConfig {
  return {
    connected: true,
    userId: user?.id ?? stringifyValue(tokens.user_id),
    nickname: user?.nickname ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    tokenType: tokens.token_type,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: tokens.scope
      ? tokens.scope
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    connectedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    monitoring: {
      lastConnectionStatus: "SUCCESS",
      lastConnectionMessage: user?.nickname
        ? `Conta ${user.nickname} conectada com sucesso.`
        : "Conta conectada com sucesso.",
      lastConnectionAt: new Date().toISOString(),
      lastTrackingSyncStatus: null,
      lastTrackingSyncMessage: null,
      lastTrackingSyncAt: null,
      lastLabelSyncStatus: null,
      lastLabelSyncMessage: null,
      lastLabelSyncAt: null,
    },
  };
}

function getAppBaseUrl(fallbackOrigin?: string) {
  const env = getAppEnv();
  if (env.publicAppUrl) {
    return env.publicAppUrl.replace(/\/$/, "");
  }

  if (fallbackOrigin) {
    return fallbackOrigin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

async function requestMercadoLivreTokens({
  code,
  refreshToken,
  clientId,
  clientSecret,
  redirectUri,
  grantType,
}: {
  code?: string;
  refreshToken?: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  grantType: "authorization_code" | "refresh_token";
}) {
  const body = new URLSearchParams();
  body.set("grant_type", grantType);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  if (grantType === "authorization_code") {
    body.set("code", code ?? "");
    body.set("redirect_uri", redirectUri ?? "");
  } else {
    body.set("refresh_token", refreshToken ?? "");
  }

  const response = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(stringifyValue(payload.message) ?? "Falha ao autenticar com o Mercado Livre.");
  }

  if (!isMercadoLivreOAuthTokenPayload(payload)) {
    throw new Error("O Mercado Livre retornou um payload de token inválido.");
  }

  return payload;
}

function isMercadoLivreOAuthTokenPayload(value: unknown): value is MercadoLivreOAuthTokens {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const raw = value as Record<string, unknown>;

  return (
    typeof raw.access_token === "string" &&
    typeof raw.token_type === "string" &&
    typeof raw.expires_in === "number"
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function buildMercadoLivreApiErrorMessage(rawText: string, fallback: string) {
  if (!rawText) {
    return fallback;
  }

  try {
    const payload = JSON.parse(rawText) as Record<string, unknown>;
    const errorCode = stringifyValue(payload.error_code) ?? stringifyValue(payload.error);
    const message = stringifyValue(payload.message) ?? stringifyValue(payload.error_message);
    const causes = Array.isArray(payload.causes)
      ? payload.causes.filter((item): item is string => typeof item === "string")
      : [];

    if (
      errorCode === "SHPLAB0200" ||
      causes.includes("NOT_PRINTABLE_STATUS") ||
      message?.includes("status is dropped_off")
    ) {
      return "O envio foi localizado com sucesso, mas a etiqueta não está mais disponível para impressão porque o pacote já foi postado no fluxo do Mercado Livre.";
    }

    if (errorCode === "COH-SSA-not_found_shipping_id" || errorCode === "not_found_shipping_id") {
      return "O Mercado Livre não encontrou o envio informado. Revise o vínculo da venda ou aguarde a geração do envio na plataforma.";
    }

    return message ?? fallback;
  } catch {
    return rawText || fallback;
  }
}
