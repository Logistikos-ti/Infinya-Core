import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CommercialKitRuleDefinition,
  resolveCommercialKitMatch,
  type ProductLookupForCommercialKit,
} from "@/lib/commercial-kit-rules";
import {
  type BlingOAuthTokens,
  type BlingSaleOrderPayload,
  downloadBlingInvoiceXml,
  ensureValidBlingAccessToken,
  fetchBlingInvoice,
  fetchBlingSaleOrder,
  isBlingInsufficientScopeError,
} from "@/lib/bling";
import type { DepositanteBlingConfig } from "@/lib/depositantes";
import { listShippingOrderDocumentTypes, storeOperationalDocumentFromBuffer } from "@/lib/operational-documents";

type ProductLookupRow = {
  id: string;
  codigo_interno: string;
  codigo_externo: string | null;
  sku: string | null;
  nome: string;
};

export async function reprocessRecentBlingOrdersForDepositante({
  adminSupabase,
  depositanteId,
  blingConfig,
  limit = 20,
}: {
  adminSupabase: SupabaseClient;
  depositanteId: string;
  blingConfig: DepositanteBlingConfig;
  limit?: number;
}) {
  const { accessToken, tokens } = await ensureValidBlingAccessToken(blingConfig);
  const refreshedConfig = mergeBlingTokensIntoConfig(blingConfig, tokens);

  const { data: localOrders, error } = await adminSupabase
    .from("pedidos_expedicao")
    .select("referencia_externa")
    .eq("depositante_id", depositanteId)
    .eq("origem", "BLING")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Não foi possível listar os pedidos locais do Bling: ${error.message}`);
  }

  const { data: webhookOccurrences, error: occurrencesError } = await adminSupabase
    .from("ocorrencias_operacionais")
    .select("titulo, descricao")
    .eq("depositante_id", depositanteId)
    .ilike("titulo", "%Webhook Bling%")
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (occurrencesError) {
    throw new Error(
      `Não foi possível listar os webhooks recentes do Bling: ${occurrencesError.message}`,
    );
  }

  const references = Array.from(
    new Set(
      [
        ...(((localOrders as Array<{ referencia_externa: string | null }> | null) ?? [])
          .map((item) => item.referencia_externa?.trim())
          .filter((item): item is string => Boolean(item))),
        ...extractBlingOrderReferencesFromOccurrences(
          (webhookOccurrences as Array<{ titulo: string | null; descricao: string | null }> | null) ??
            [],
        ),
      ],
    ),
  );

  const results: Array<{ reference: string; ok: boolean; message: string }> = [];

  for (const reference of references) {
    try {
      const saleOrder = await fetchBlingSaleOrder(accessToken, reference);
      const result = await upsertShippingOrder({
        adminSupabase,
        depositanteId,
        accessToken,
        saleOrder,
        eventName: "manual.reprocess",
      });

      results.push({
        reference,
        ok: result.synced,
        message: result.attachmentSummary
          ? `Pedido reprocessado. ${result.attachmentSummary}`
          : "Pedido reprocessado.",
      });
    } catch (reprocessError) {
      results.push({
        reference,
        ok: false,
        message:
          reprocessError instanceof Error
            ? reprocessError.message
            : "Falha ao reprocessar o pedido.",
      });
    }
  }

  return {
    refreshedConfig,
    total: references.length,
    success: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}

function extractBlingOrderReferencesFromOccurrences(
  occurrences: Array<{ titulo: string | null; descricao: string | null }>,
) {
  const references = new Set<string>();

  for (const occurrence of occurrences) {
    const haystack = [occurrence.titulo ?? "", occurrence.descricao ?? ""].join(" ");

    for (const match of haystack.matchAll(/\/ id (\d+)/g)) {
      if (match[1]) {
        references.add(match[1]);
      }
    }

    for (const match of haystack.matchAll(/"id":\s*(\d+)/g)) {
      if (match[1]) {
        references.add(match[1]);
      }
    }
  }

  return Array.from(references);
}

async function upsertShippingOrder({
  adminSupabase,
  depositanteId,
  accessToken,
  saleOrder,
  eventName,
}: {
  adminSupabase: SupabaseClient;
  depositanteId: string;
  accessToken: string;
  saleOrder: BlingSaleOrderPayload;
  eventName: string;
}) {
  const { data: existingOrder, error: existingOrderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, status")
    .eq("depositante_id", depositanteId)
    .eq("referencia_externa", saleOrder.id)
    .maybeSingle();

  if (existingOrderError) {
    throw new Error(existingOrderError.message);
  }

  const productsByCode = await loadProductsByCode(adminSupabase, depositanteId, saleOrder.itens);
  const commercialKitRules = await loadCommercialKitRules(adminSupabase, depositanteId);
  const preservedStatus = resolveShippingStatus({
    currentStatus: (existingOrder as { status?: string | null } | null)?.status ?? null,
    eventName,
    sourceStatus: saleOrder.situacao,
  });

  const headerPayload = {
    depositante_id: depositanteId,
    codigo: (existingOrder as { codigo?: string | null } | null)?.codigo ?? buildShippingOrderCode(saleOrder.id),
    referencia_externa: saleOrder.id,
    origem: "BLING",
    canal: "BLING",
    status: preservedStatus,
    status_origem: saleOrder.situacao,
    numero_pedido: saleOrder.numero,
    numero_loja: saleOrder.numeroLoja,
    cliente_nome: saleOrder.contato.nome,
    cliente_documento: saleOrder.contato.documento,
    cliente_cidade: saleOrder.contato.cidade,
    cliente_uf: saleOrder.contato.uf,
    valor_total: saleOrder.total,
    quantidade_itens: saleOrder.itens.length,
    quantidade_unidades: saleOrder.itens.reduce((sum, item) => sum + item.quantidade, 0),
    data_pedido: normalizeIsoDateTime(saleOrder.data),
    previsao_envio_em: normalizeIsoDate(saleOrder.dataSaida),
    sincronizado_em: new Date().toISOString(),
    payload_origem: saleOrder.payload,
    observacoes: saleOrder.observacoes,
  };

  const { data: savedOrder, error: saveOrderError } = await adminSupabase
    .from("pedidos_expedicao")
    .upsert(headerPayload, { onConflict: "depositante_id,referencia_externa" })
    .select("id")
    .single();

  if (saveOrderError || !savedOrder) {
    throw new Error(saveOrderError?.message ?? "Não foi possível salvar o pedido de expedição.");
  }

  const { error: deleteItemsError } = await adminSupabase
    .from("pedidos_expedicao_itens")
    .delete()
    .eq("pedido_expedicao_id", savedOrder.id);

  if (deleteItemsError) {
    throw new Error(deleteItemsError.message);
  }

  if (saleOrder.itens.length) {
    const itemsPayload = saleOrder.itens.map((item, index) => {
      const matchedProductByCode = matchProductByCode(productsByCode, item.codigo);
      const resolvedMatch = resolveCommercialKitMatch({
        itemCode: item.codigo,
        itemDescription: item.descricao,
        existingPayload: item.payload,
        matchedProductByCode,
        rules: commercialKitRules,
      });
      const matchedProduct = resolvedMatch.matchedProduct;

      return {
        pedido_expedicao_id: savedOrder.id,
        depositante_id: depositanteId,
        referencia_externa: item.id ?? `${saleOrder.id}-${index + 1}`,
        produto_id: matchedProduct?.id ?? null,
        codigo_produto: item.codigo,
        sku: matchedProduct?.sku ?? item.codigo,
        nome: item.descricao ?? matchedProduct?.nome ?? `Item ${index + 1}`,
        unidade: item.unidade,
        quantidade: item.quantidade,
        quantidade_separada: 0,
        payload_origem: resolvedMatch.payload,
      };
    });

    const { error: insertItemsError } = await adminSupabase
      .from("pedidos_expedicao_itens")
      .insert(itemsPayload);

    if (insertItemsError) {
      throw new Error(insertItemsError.message);
    }
  }

  const attachmentSummary = await syncShippingOrderAttachments({
    adminSupabase,
    depositanteId,
    accessToken,
    shippingOrderId: savedOrder.id,
    saleOrder,
  });

  return {
    synced: true,
    attachmentSummary,
  };
}

async function syncShippingOrderAttachments({
  adminSupabase,
  depositanteId,
  accessToken,
  shippingOrderId,
  saleOrder,
}: {
  adminSupabase: SupabaseClient;
  depositanteId: string;
  accessToken: string;
  shippingOrderId: string;
  saleOrder: BlingSaleOrderPayload;
}) {
  const existingTypes = await listShippingOrderDocumentTypes(adminSupabase, shippingOrderId);
  const messages: string[] = [];
  const orderRef = saleOrder.numeroLoja ?? saleOrder.numero ?? saleOrder.id;

  if (!existingTypes.has("NF")) {
    const invoiceMessage = await syncInvoiceXmlAttachment({
      adminSupabase,
      depositanteId,
      accessToken,
      shippingOrderId,
      saleOrder,
      orderRef,
    });

    if (invoiceMessage) {
      messages.push(invoiceMessage);
    }
  }

  return messages.length ? messages.join(" ") : null;
}

async function syncInvoiceXmlAttachment({
  adminSupabase,
  depositanteId,
  accessToken,
  shippingOrderId,
  saleOrder,
  orderRef,
}: {
  adminSupabase: SupabaseClient;
  depositanteId: string;
  accessToken: string;
  shippingOrderId: string;
  saleOrder: BlingSaleOrderPayload;
  orderRef: string;
}) {
  const payload = isRecord(saleOrder.payload) ? saleOrder.payload : {};
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;
  const invoiceId = stringifyValue(notaFiscal?.id);

  if (!invoiceId || invoiceId === "0") {
    return "XML da NF ainda não disponível neste pedido.";
  }

  try {
    const invoice = await fetchBlingInvoice(accessToken, invoiceId);

    if (!invoice.chaveAcesso) {
      return "NF identificada, mas ainda sem chave de acesso liberada no Bling.";
    }

    const xmlDocument = await downloadBlingInvoiceXml(accessToken, {
      accessKey: invoice.chaveAcesso,
      fileName: `nf-${orderRef}-${invoice.numero ?? invoice.id}.xml`,
    });

    await storeOperationalDocumentFromBuffer({
      adminSupabase,
      depositanteId,
      tipo: "NF",
      fileName: xmlDocument.fileName,
      mimeType: xmlDocument.mimeType,
      bytes: xmlDocument.bytes,
      pedidoExpedicaoId: shippingOrderId,
    });

    return "XML da NF anexado automaticamente.";
  } catch (error) {
    if (isBlingInsufficientScopeError(error)) {
      return "Bling conectado sem escopo suficiente para baixar XML da NF.";
    }

    return error instanceof Error
      ? `Falha ao anexar o XML da NF: ${error.message}`
      : "Falha ao anexar o XML da NF.";
  }
}

async function loadProductsByCode(
  adminSupabase: SupabaseClient,
  depositanteId: string,
  items: BlingSaleOrderPayload["itens"],
) {
  const candidateCodes = Array.from(
    new Set(items.map((item) => item.codigo?.trim()).filter((item): item is string => Boolean(item))),
  );

  if (!candidateCodes.length) {
    return [] as ProductLookupForCommercialKit[];
  }

  const [internalCodes, externalCodes, skuCodes] = await Promise.all([
    adminSupabase
      .from("produtos")
      .select("id, codigo_interno, codigo_externo, sku, nome")
      .eq("depositante_id", depositanteId)
      .in("codigo_interno", candidateCodes),
    adminSupabase
      .from("produtos")
      .select("id, codigo_interno, codigo_externo, sku, nome")
      .eq("depositante_id", depositanteId)
      .in("codigo_externo", candidateCodes),
    adminSupabase
      .from("produtos")
      .select("id, codigo_interno, codigo_externo, sku, nome")
      .eq("depositante_id", depositanteId)
      .in("sku", candidateCodes),
  ]);

  const merged = [
    ...((internalCodes.data as ProductLookupRow[] | null) ?? []),
    ...((externalCodes.data as ProductLookupRow[] | null) ?? []),
    ...((skuCodes.data as ProductLookupRow[] | null) ?? []),
  ];
  const uniqueMap = new Map<string, ProductLookupRow>();

  merged.forEach((item) => {
    uniqueMap.set(item.id, item);
  });

  return Array.from(uniqueMap.values()) as ProductLookupForCommercialKit[];
}

async function loadCommercialKitRules(
  adminSupabase: SupabaseClient,
  depositanteId: string,
) {
  const { data, error } = await adminSupabase
    .from("produto_kit_comercial_regras")
    .select(
      "id, depositante_id, produto_base_id, texto_gatilho, quantidade_operacional, ativo, produto:produtos!produto_kit_comercial_regras_produto_base_id_fkey(id, nome, sku, codigo_interno, codigo_externo)",
    )
    .eq("depositante_id", depositanteId)
    .eq("ativo", true);

  if (error) {
    throw new Error(`Nao foi possivel carregar as regras comerciais de kit: ${error.message}`);
  }

  return ((data ?? []) as Array<{
    id: string;
    depositante_id: string;
    produto_base_id: string;
    texto_gatilho: string;
    quantidade_operacional: number | string;
    ativo: boolean;
    produto:
      | Array<{
          id: string;
          nome: string;
          sku: string | null;
          codigo_interno: string | null;
          codigo_externo: string | null;
        }>
      | null;
  }>)
    .map((rule) => ({
      ...rule,
      produto: Array.isArray(rule.produto) ? (rule.produto[0] ?? null) : rule.produto,
    }))
    .filter((rule) => Boolean(rule.produto))
    .map(
      (rule) =>
        ({
          id: rule.id,
          depositanteId: rule.depositante_id,
          productId: rule.produto_base_id,
          productName: rule.produto?.nome ?? "",
          productSku: rule.produto?.sku ?? null,
          productInternalCode: rule.produto?.codigo_interno ?? null,
          productBarcode: rule.produto?.codigo_externo ?? null,
          matchText: rule.texto_gatilho,
          operationalQuantity: Number(rule.quantidade_operacional ?? 0),
          active: rule.ativo,
        }) satisfies CommercialKitRuleDefinition,
    );
}

function matchProductByCode(products: ProductLookupForCommercialKit[], code: string | null) {
  if (!code) {
    return null;
  }

  const normalizedCode = code.trim().toLocaleLowerCase("pt-BR");

  return (
    products.find((item) => item.codigo_interno.trim().toLocaleLowerCase("pt-BR") === normalizedCode) ??
    products.find((item) => item.codigo_externo?.trim().toLocaleLowerCase("pt-BR") === normalizedCode) ??
    products.find((item) => item.sku?.trim().toLocaleLowerCase("pt-BR") === normalizedCode) ??
    null
  );
}

function mergeBlingTokensIntoConfig(
  config: DepositanteBlingConfig,
  tokens: BlingOAuthTokens | null,
): DepositanteBlingConfig {
  if (!tokens) {
    return config;
  }

  return {
    ...config,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type || config.tokenType,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: tokens.scope
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function resolveShippingStatus({
  currentStatus,
  eventName,
  sourceStatus,
}: {
  currentStatus: string | null;
  eventName: string;
  sourceStatus: string | null;
}) {
  if (eventName.includes("delete") || sourceStatus?.toLocaleLowerCase("pt-BR").includes("cancel")) {
    return "CANCELADO";
  }

  return currentStatus ?? "NOVO";
}

function buildShippingOrderCode(reference: string) {
  return `BLG-${reference}`;
}

function normalizeIsoDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeIsoDate(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
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
