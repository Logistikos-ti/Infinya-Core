export type MetodoRetirada = "FEFO" | "FIFO" | "LIFO";

export type EnderecoFiscal = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type TelefoneContato = {
  nome: string;
  telefone: string;
};

export type EmailContato = {
  email: string;
};

export type DepositanteBlingWebhook = {
  resource: "order";
  url: string;
  secret: string | null;
  active: boolean;
  lastEventId: string | null;
  lastEventAt: string | null;
};

export type DepositanteBlingConfig = {
  connected: boolean;
  companyId: string | null;
  companyName: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  expiresAt: string | null;
  scopes: string[];
  connectedAt: string | null;
  lastSyncAt: string | null;
  webhook: DepositanteBlingWebhook | null;
};

export type DepositanteConfiguracoes = {
  razaoSocial: string;
  observacoes: string;
  metodoRetiradaPadrao: MetodoRetirada;
  exigeLotePadrao: boolean;
  exigeValidadePadrao: boolean;
  permiteFracionamento: boolean;
  diasMinimosValidade: number;
  prefixoRecebimento: string;
  logoStoragePath: string | null;
  enderecoFiscal: EnderecoFiscal;
  emailsContato: EmailContato[];
  telefonesContato: TelefoneContato[];
  bling: DepositanteBlingConfig | null;
};

export const defaultEnderecoFiscal: EnderecoFiscal = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

export const defaultDepositanteConfiguracoes: DepositanteConfiguracoes = {
  razaoSocial: "",
  observacoes: "",
  metodoRetiradaPadrao: "FEFO",
  exigeLotePadrao: true,
  exigeValidadePadrao: true,
  permiteFracionamento: false,
  diasMinimosValidade: 0,
  prefixoRecebimento: "",
  logoStoragePath: null,
  enderecoFiscal: defaultEnderecoFiscal,
  emailsContato: [],
  telefonesContato: [],
  bling: null,
};

export function parseDepositanteConfiguracoes(rawValue: string | null) {
  const rawObject = parseDepositanteConfiguracoesRaw(rawValue);

  if (!rawObject) {
    return defaultDepositanteConfiguracoes;
  }

  return {
    razaoSocial: getOptionalString(rawObject.razaoSocial),
    observacoes: getOptionalString(rawObject.observacoes),
    metodoRetiradaPadrao: normalizeMetodo(getOptionalString(rawObject.metodoRetiradaPadrao)),
    exigeLotePadrao: getOptionalBoolean(rawObject.exigeLotePadrao, true),
    exigeValidadePadrao: getOptionalBoolean(rawObject.exigeValidadePadrao, true),
    permiteFracionamento: getOptionalBoolean(rawObject.permiteFracionamento, false),
    diasMinimosValidade: Number(rawObject.diasMinimosValidade ?? 0),
    prefixoRecebimento: getOptionalString(rawObject.prefixoRecebimento),
    logoStoragePath: getNullableString(rawObject.logoStoragePath),
    enderecoFiscal: normalizeEnderecoFiscal(rawObject.enderecoFiscal),
    emailsContato: normalizeEmailContacts(rawObject.emailsContato),
    telefonesContato: normalizePhoneContacts(rawObject.telefonesContato),
    bling: normalizeBlingConfig(rawObject.bling),
  };
}

export function buildStoredDepositanteConfiguracoes(
  rawValue: string | null,
  configuracoes: DepositanteConfiguracoes,
) {
  const rawObject = parseDepositanteConfiguracoesRaw(rawValue) ?? {};

  return {
    ...rawObject,
    ...configuracoes,
    enderecoFiscal: {
      ...configuracoes.enderecoFiscal,
    },
    emailsContato: [...configuracoes.emailsContato],
    telefonesContato: [...configuracoes.telefonesContato],
    bling: configuracoes.bling
      ? {
          ...configuracoes.bling,
          scopes: [...configuracoes.bling.scopes],
          webhook: configuracoes.bling.webhook
            ? {
                ...configuracoes.bling.webhook,
              }
            : null,
        }
      : null,
  };
}

export function updateDepositanteBlingConfig(
  rawValue: string | null,
  bling: DepositanteBlingConfig | null,
) {
  const current = parseDepositanteConfiguracoes(rawValue);

  return buildStoredDepositanteConfiguracoes(rawValue, {
    ...current,
    bling,
  });
}

export function parseDepositanteConfiguracoesRaw(rawValue: string | null) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {
      observacoes: rawValue,
    };
  }
}

export function serializeDepositanteConfiguracoes(
  configuracoes: DepositanteConfiguracoes,
) {
  return JSON.stringify(configuracoes);
}

export function normalizePhoneContacts(value: unknown): TelefoneContato[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const nome =
        "nome" in item && typeof item.nome === "string" ? item.nome.trim() : "";
      const telefone =
        "telefone" in item && typeof item.telefone === "string"
          ? item.telefone.trim()
          : "";

      if (!nome || !telefone) {
        return null;
      }

      return { nome, telefone };
    })
    .filter((item): item is TelefoneContato => item !== null);
}

export function normalizeEmailContacts(value: unknown): EmailContato[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const email =
        "email" in item && typeof item.email === "string" ? item.email.trim() : "";

      if (!email) {
        return null;
      }

      return { email };
    })
    .filter((item): item is EmailContato => item !== null);
}

function normalizeMetodo(value: string | undefined): MetodoRetirada {
  if (value === "FIFO" || value === "LIFO") {
    return value;
  }

  return "FEFO";
}

function normalizeEnderecoFiscal(value: unknown): EnderecoFiscal {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultEnderecoFiscal;
  }

  return {
    cep: getOptionalString((value as Record<string, unknown>).cep),
    logradouro: getOptionalString((value as Record<string, unknown>).logradouro),
    numero: getOptionalString((value as Record<string, unknown>).numero),
    complemento: getOptionalString((value as Record<string, unknown>).complemento),
    bairro: getOptionalString((value as Record<string, unknown>).bairro),
    cidade: getOptionalString((value as Record<string, unknown>).cidade),
    uf: getOptionalString((value as Record<string, unknown>).uf),
  };
}

function normalizeBlingConfig(value: unknown): DepositanteBlingConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const webhookValue =
    raw.webhook && typeof raw.webhook === "object" && !Array.isArray(raw.webhook)
      ? (raw.webhook as Record<string, unknown>)
      : null;

  return {
    connected: getOptionalBoolean(raw.connected, false),
    companyId: getNullableString(raw.companyId),
    companyName: getNullableString(raw.companyName),
    accessToken: getNullableString(raw.accessToken),
    refreshToken: getNullableString(raw.refreshToken),
    tokenType: getNullableString(raw.tokenType),
    expiresAt: getNullableString(raw.expiresAt),
    scopes: Array.isArray(raw.scopes)
      ? raw.scopes.filter((item): item is string => typeof item === "string")
      : [],
    connectedAt: getNullableString(raw.connectedAt),
    lastSyncAt: getNullableString(raw.lastSyncAt),
    webhook: webhookValue
      ? {
          resource: "order",
          url: getOptionalString(webhookValue.url),
          secret: getNullableString(webhookValue.secret),
          active: getOptionalBoolean(webhookValue.active, false),
          lastEventId: getNullableString(webhookValue.lastEventId),
          lastEventAt: getNullableString(webhookValue.lastEventAt),
        }
      : null,
  };
}

function getOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function getOptionalBoolean(value: unknown, defaultValue: boolean) {
  return typeof value === "boolean" ? value : defaultValue;
}
