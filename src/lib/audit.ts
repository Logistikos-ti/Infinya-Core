import "server-only";

import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditResult = "SUCESSO" | "ERRO" | "NEGADO";
type AuditOrigin = "APLICACAO" | "AUTENTICACAO" | "INTEGRACAO" | "SISTEMA";

type AuditActor = {
  id?: string | null;
  nome?: string | null;
  papel?: string | null;
  depositanteId?: string | null;
};

export type AuditEventInput = {
  actor?: AuditActor | null;
  depositanteId?: string | null;
  modulo: string;
  acao: string;
  entidadeTipo: string;
  entidadeId?: string | null;
  resultado?: AuditResult;
  origem?: AuditOrigin;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
  metadados?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "client_secret",
  "password",
  "senha",
  "token",
  "authorization",
  "xml_conteudo",
  "conteudo",
  "arquivo_base64",
  "dados_criptografados",
  "service_role_key",
]);

export async function recordAuditEvent(input: AuditEventInput) {
  const requestContext = await getAuditRequestContext();
  const supabase = createSupabaseAdminClient();
  const actor = input.actor ?? null;

  const { error } = await supabase.from("auditoria_eventos").insert({
    depositante_id: input.depositanteId ?? actor?.depositanteId ?? null,
    usuario_id: actor?.id ?? null,
    usuario_nome: actor?.nome ?? null,
    usuario_papel: actor?.papel ?? null,
    modulo: normalizeLabel(input.modulo),
    acao: normalizeLabel(input.acao),
    entidade_tipo: input.entidadeTipo,
    entidade_id: input.entidadeId ?? null,
    resultado: input.resultado ?? "SUCESSO",
    origem: input.origem ?? "APLICACAO",
    dados_anteriores: sanitizeAuditValue(input.dadosAnteriores),
    dados_novos: sanitizeAuditValue(input.dadosNovos),
    metadados: sanitizeAuditValue(input.metadados ?? {}),
    ip: requestContext.ip,
    user_agent: requestContext.userAgent,
    request_id: requestContext.requestId,
  });

  if (error) {
    throw error;
  }
}

/** Auditoria jamais pode interromper a operação principal do WMS. */
export async function safeRecordAuditEvent(input: AuditEventInput) {
  try {
    await recordAuditEvent(input);
  } catch (error) {
    console.error("[auditoria] Não foi possível registrar o evento.", error);
  }
}

export function sanitizeAuditValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeAuditValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : sanitizeAuditValue(item),
      ]),
    );
  }

  return String(value);
}

async function getAuditRequestContext() {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();

    return {
      ip: forwardedFor || requestHeaders.get("x-real-ip") || null,
      userAgent: requestHeaders.get("user-agent") || null,
      requestId:
        requestHeaders.get("x-request-id") ||
        requestHeaders.get("x-vercel-id") ||
        requestHeaders.get("cf-ray") ||
        null,
    };
  } catch {
    return { ip: null, userAgent: null, requestId: null };
  }
}

function normalizeLabel(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, "_").slice(0, 80) || "NAO_INFORMADO";
}
