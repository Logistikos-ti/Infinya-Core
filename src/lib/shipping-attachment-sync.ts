import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureValidBlingAccessToken,
  fetchBlingInvoice,
  isBlingInsufficientScopeError,
  downloadBlingInvoiceXml,
} from "@/lib/bling";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import {
  listShippingOrderDocumentTypes,
  storeOperationalDocumentFromBuffer,
} from "@/lib/operational-documents";

export type SyncShippingInvoiceAttachmentResult =
  | {
      ok: true;
      status:
        | "attached"
        | "already_exists"
        | "waiting_invoice"
        | "waiting_access_key"
        | "not_bling";
      message: string;
    }
  | {
      ok: false;
      status: "missing_schema" | "insufficient_scope" | "error";
      message: string;
    };

export async function syncBlingInvoiceAttachmentForShippingOrder(
  adminSupabase: SupabaseClient,
  shippingOrderId: string,
): Promise<SyncShippingInvoiceAttachmentResult> {
  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, numero_loja, origem, depositante_id, payload_origem")
    .eq("id", shippingOrderId)
    .maybeSingle();

  if (orderError) {
    return {
      ok: false,
      status: isMissingShippingDocumentSchema(orderError) ? "missing_schema" : "error",
      message: isMissingShippingDocumentSchema(orderError)
        ? "O banco ainda não recebeu a estrutura completa de anexos da expedição."
        : `Não foi possível localizar o pedido de expedição: ${orderError.message}`,
    };
  }

  if (!order) {
    return {
      ok: false,
      status: "error",
      message: "Pedido de expedição não encontrado.",
    };
  }

  if (order.origem !== "BLING") {
    return {
      ok: true,
      status: "not_bling",
      message: "Este pedido não veio do Bling, então o XML segue manual.",
    };
  }

  try {
    const existingTypes = await listShippingOrderDocumentTypes(adminSupabase, order.id);

    if (existingTypes.has("NF")) {
      return {
        ok: true,
        status: "already_exists",
        message: "Este pedido já possui XML anexado.",
      };
    }
  } catch (error) {
    const typedError =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string; message?: string })
        : null;

    return {
      ok: false,
      status: typedError?.code === "42703" ? "missing_schema" : "error",
      message:
        typedError?.code === "42703"
          ? "O banco ainda não recebeu a atualização de anexos da expedição."
          : `Não foi possível verificar os anexos atuais do pedido: ${
              typedError?.message ?? "erro desconhecido"
            }`,
    };
  }

  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;
  const invoiceId = readString(notaFiscal?.id);

  if (!invoiceId || invoiceId === "0") {
    return {
      ok: true,
      status: "waiting_invoice",
      message: "O pedido ainda não possui nota fiscal emitida no Bling.",
    };
  }

  const { data: depositante, error: depositanteError } = await adminSupabase
    .from("depositantes")
    .select("id, nome, configuracoes, observacoes")
    .eq("id", order.depositante_id)
    .single();

  if (depositanteError || !depositante) {
    return {
      ok: false,
      status: "error",
      message: `Não foi possível carregar o depositante do pedido: ${
        depositanteError?.message ?? "não encontrado"
      }`,
    };
  }

  const rawConfig = depositante.configuracoes ? JSON.stringify(depositante.configuracoes) : depositante.observacoes;
  const config = parseDepositanteConfiguracoes(rawConfig);

  if (!config.bling?.connected) {
    return {
      ok: false,
      status: "error",
      message: "O depositante não possui integração Bling ativa.",
    };
  }

  try {
    const tokenResult = await ensureValidBlingAccessToken(config.bling);
    const invoice = await fetchBlingInvoice(tokenResult.accessToken, invoiceId);

    if (!invoice.chaveAcesso) {
      return {
        ok: true,
        status: "waiting_access_key",
        message: "A nota já existe no Bling, mas ainda está sem chave de acesso liberada.",
      };
    }

    const orderRef = order.numero_loja ?? order.numero_pedido ?? order.codigo;
    const xmlDocument = await downloadBlingInvoiceXml(tokenResult.accessToken, {
      accessKey: invoice.chaveAcesso,
      fileName: `nf-${orderRef}-${invoice.numero ?? invoice.id}.xml`,
    });

    await storeOperationalDocumentFromBuffer({
      adminSupabase,
      depositanteId: order.depositante_id,
      tipo: "NF",
      fileName: xmlDocument.fileName,
      mimeType: xmlDocument.mimeType,
      bytes: xmlDocument.bytes,
      pedidoExpedicaoId: order.id,
    });

    return {
      ok: true,
      status: "attached",
      message: "XML da NF anexado automaticamente a partir do Bling.",
    };
  } catch (error) {
    if (isBlingInsufficientScopeError(error)) {
      return {
        ok: false,
        status: "insufficient_scope",
        message: "A integração do Bling ainda não tem escopo suficiente para baixar o XML.",
      };
    }

    const typedError =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string; message?: string })
        : null;

    return {
      ok: false,
      status: typedError?.code === "42703" ? "missing_schema" : "error",
      message:
        typedError?.code === "42703"
          ? "O banco ainda não recebeu a atualização de anexos da expedição."
          : error instanceof Error
            ? error.message
            : "Falha ao sincronizar o XML do pedido.",
    };
  }
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

function isMissingShippingDocumentSchema(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42703" || error.message?.includes("pedido_expedicao_id") === true;
}
