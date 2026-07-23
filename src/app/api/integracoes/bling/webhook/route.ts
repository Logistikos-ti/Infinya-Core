import { NextResponse } from "next/server";
import {
  type CommercialKitRuleDefinition,
  resolveCommercialKitMatch,
  type ProductLookupForCommercialKit,
} from "@/lib/commercial-kit-rules";
import {
  downloadBlingInvoiceXml,
  ensureValidBlingAccessToken,
  fetchBlingInvoice,
  fetchBlingSaleOrder,
  isBlingInsufficientScopeError,
  parseBlingWebhookPayload,
  validateBlingWebhookSignature,
  type BlingOAuthTokens,
  type BlingSaleOrderPayload,
} from "@/lib/bling";
import {
  parseDepositanteConfiguracoes,
  updateDepositanteBlingConfig,
  type DepositanteBlingConfig,
} from "@/lib/depositantes";
import {
  listShippingOrderDocumentTypes,
  storeOperationalDocumentFromBuffer,
} from "@/lib/operational-documents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DepositanteWebhookRow = {
  id: string;
  nome: string;
  configuracoes: Record<string, unknown> | null;
  observacoes: string | null;
};

type ExistingShippingOrderRow = {
  id: string;
  codigo: string;
  status: string;
};

type ProductLookupRow = {
  id: string;
  codigo_interno: string;
  codigo_externo: string | null;
  sku: string | null;
  nome: string;
};

type ShippingOrderUpsertResult = {
  synced: boolean;
  attachmentSummary: string | null;
};

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("X-Bling-Signature-256");

  if (!validateBlingWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Assinatura do webhook do Bling inválida." }, { status: 401 });
  }

  let event;

  try {
    event = parseBlingWebhookPayload(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payload inválido." },
      { status: 400 },
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositantes } = await adminSupabase
    .from("depositantes")
    .select("id, nome, configuracoes, observacoes")
    .eq("ativo", true);

  const parsedRows = ((depositantes as DepositanteWebhookRow[] | null) ?? []).map((item) => {
    const rawConfig = item.configuracoes ? JSON.stringify(item.configuracoes) : item.observacoes;
    return {
      row: item,
      rawConfig,
      config: parseDepositanteConfiguracoes(rawConfig),
    };
  });

  let matched = parsedRows.find((item) => item.config.bling?.companyId === event.companyId);

  if (!matched) {
    const pendingLinkRows = parsedRows.filter(
      (item) => item.config.bling?.connected && !item.config.bling.companyId,
    );

    if (pendingLinkRows.length === 1) {
      matched = pendingLinkRows[0];
    }
  }

  if (!matched) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "Nenhum depositante vinculado a este companyId." },
      { status: 202 },
    );
  }

  const depositante = matched.row;
  const rawConfig = matched.rawConfig;
  const config = matched.config;
  const occurrenceTitle = `Webhook Bling ${event.event} ${event.eventId}`;

  const { data: existingOccurrence } = await adminSupabase
    .from("ocorrencias_operacionais")
    .select("id")
    .eq("depositante_id", depositante.id)
    .eq("titulo", occurrenceTitle)
    .maybeSingle();

  const syncResult = await syncShippingOrderFromBling({
    adminSupabase,
    depositanteId: depositante.id,
    blingConfig: config.bling,
    eventName: event.event,
    eventData: event.data,
  });

  if (!existingOccurrence) {
    const eventSummary = buildBlingEventSummary(event.event, event.data);
    const syncMessage = syncResult.syncMessage ? ` Integração: ${syncResult.syncMessage}` : "";

    await adminSupabase.from("ocorrencias_operacionais").insert({
      depositante_id: depositante.id,
      tipo: "OUTRO",
      status: "EM_ANALISE",
      titulo: occurrenceTitle,
      descricao: `Evento ${event.event} recebido do Bling para ${depositante.nome}. Resumo: ${eventSummary}. EventId: ${event.eventId}. Payload: ${payload}.${syncMessage}`,
    });
  }

  const nextBlingConfig = config.bling
    ? {
        ...config.bling,
        ...syncResult.updatedBlingConfig,
        companyId: config.bling.companyId ?? event.companyId,
        lastSyncAt: new Date().toISOString(),
        webhook: {
          resource: "order" as const,
          url: config.bling.webhook?.url ?? "",
          secret: config.bling.webhook?.secret ?? null,
          active: true,
          lastEventId: event.eventId,
          lastEventAt: event.date,
        },
        monitoring: buildMonitoringState(config.bling.monitoring, {
          lastWebhookStatus:
            syncResult.synced || !syncResult.syncMessage?.toLowerCase().includes("falha")
              ? ("SUCCESS" as const)
              : ("ERROR" as const),
          lastWebhookMessage: syncResult.syncMessage ?? "Webhook recebido e processado.",
          lastWebhookAt: event.date,
        }),
      }
    : null;

  if (nextBlingConfig) {
    await adminSupabase
      .from("depositantes")
      .update({
        configuracoes: updateDepositanteBlingConfig(rawConfig, nextBlingConfig),
      })
      .eq("id", depositante.id);
  }

  return NextResponse.json({
    ok: true,
    syncedShippingOrder: syncResult.synced,
    syncMessage: syncResult.syncMessage,
  });
}

async function syncShippingOrderFromBling({
  adminSupabase,
  depositanteId,
  blingConfig,
  eventName,
  eventData,
}: {
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  depositanteId: string;
  blingConfig: DepositanteBlingConfig | null;
  eventName: string;
  eventData: Record<string, unknown>;
}) {
  if (!blingConfig?.connected) {
    return {
      synced: false,
      syncMessage: "Depositante sem integração Bling ativa.",
      updatedBlingConfig: null as DepositanteBlingConfig | null,
    };
  }

  if (!eventName.startsWith("order.")) {
    return {
      synced: false,
      syncMessage: "Evento fora do escopo de pedidos de venda.",
      updatedBlingConfig: blingConfig,
    };
  }

  const externalOrderId = stringifyValue(eventData.id);

  if (!externalOrderId) {
    return {
      synced: false,
      syncMessage: "Webhook sem id de pedido para sincronização.",
      updatedBlingConfig: blingConfig,
    };
  }

  try {
    const tokenResult = await ensureValidBlingAccessToken(blingConfig);
    const refreshedConfig = mergeBlingTokensIntoConfig(blingConfig, tokenResult.tokens);
    const saleOrder = await fetchBlingSaleOrder(tokenResult.accessToken, externalOrderId);
    const upsertResult = await upsertShippingOrder({
      adminSupabase,
      depositanteId,
      accessToken: tokenResult.accessToken,
      saleOrder,
      eventName,
    });

    return {
      synced: upsertResult.synced,
      syncMessage: upsertResult.synced
        ? [
            `Pedido ${saleOrder.numeroLoja ?? saleOrder.numero ?? saleOrder.id} sincronizado na expedição.`,
            upsertResult.attachmentSummary,
          ]
            .filter(Boolean)
            .join(" ")
        : "Schema de expedição ainda não aplicado no banco.",
      updatedBlingConfig: refreshedConfig,
    };
  } catch (error) {
    return {
      synced: false,
      syncMessage:
        error instanceof Error
          ? `Falha ao sincronizar o pedido de expedição: ${error.message}`
          : "Falha ao sincronizar o pedido de expedição.",
      updatedBlingConfig: blingConfig,
    };
  }
}

async function upsertShippingOrder({
  adminSupabase,
  depositanteId,
  accessToken,
  saleOrder,
  eventName,
}: {
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  depositanteId: string;
  accessToken: string;
  saleOrder: BlingSaleOrderPayload;
  eventName: string;
}): Promise<ShippingOrderUpsertResult> {
  const { data: existingOrder, error: existingOrderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, status")
    .eq("depositante_id", depositanteId)
    .eq("referencia_externa", saleOrder.id)
    .maybeSingle();

  if (isMissingShippingSchemaError(existingOrderError)) {
    return {
      synced: false,
      attachmentSummary: null,
    };
  }

  if (existingOrderError) {
    throw new Error(existingOrderError.message);
  }

  const productsByCode = await loadProductsByCode(adminSupabase, depositanteId, saleOrder.itens);
  const commercialKitRules = await loadCommercialKitRules(adminSupabase, depositanteId);
  const preservedStatus = resolveShippingStatus({
    currentStatus: (existingOrder as ExistingShippingOrderRow | null)?.status ?? null,
    eventName,
    sourceStatus: saleOrder.situacao,
  });
  const headerPayload = {
    depositante_id: depositanteId,
    codigo: (existingOrder as ExistingShippingOrderRow | null)?.codigo ?? buildShippingOrderCode(saleOrder.id),
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
    .upsert(headerPayload, {
      onConflict: "depositante_id,referencia_externa",
    })
    .select("id")
    .single();

  if (isMissingShippingSchemaError(saveOrderError)) {
    return {
      synced: false,
      attachmentSummary: null,
    };
  }

  if (saveOrderError || !savedOrder) {
    throw new Error(saveOrderError?.message ?? "Não foi possível salvar o pedido de expedição.");
  }

  const { error: deleteItemsError } = await adminSupabase
    .from("pedidos_expedicao_itens")
    .delete()
    .eq("pedido_expedicao_id", savedOrder.id);

  if (isMissingShippingSchemaError(deleteItemsError)) {
    return {
      synced: false,
      attachmentSummary: null,
    };
  }

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

    if (isMissingShippingSchemaError(insertItemsError)) {
      return {
        synced: false,
        attachmentSummary: null,
      };
    }

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
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  depositanteId: string;
  accessToken: string;
  shippingOrderId: string;
  saleOrder: BlingSaleOrderPayload;
}) {
  let existingTypes: Set<string>;

  try {
    existingTypes = await listShippingOrderDocumentTypes(adminSupabase, shippingOrderId);
  } catch (error) {
    const typedError =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string; message?: string })
        : null;

    if (typedError?.code === "42703") {
      return "Anexos automáticos aguardando a migration de expedição no banco.";
    }

    return "Não foi possível verificar os anexos existentes do pedido.";
  }

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
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
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
    const typedError =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string; message?: string })
        : null;

    if (typedError?.code === "42703") {
      return "XML automático pendente até aplicar a migration de anexos da expedição.";
    }

    if (isBlingInsufficientScopeError(error)) {
      return "Bling conectado sem escopo suficiente para baixar XML da NF.";
    }

    return error instanceof Error
      ? `Falha ao anexar o XML da NF: ${error.message}`
      : "Falha ao anexar o XML da NF.";
  }
}

async function loadProductsByCode(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  depositanteId: string,
  items: BlingSaleOrderPayload["itens"],
) {
  const candidateCodes = Array.from(
    new Set(items.map((item) => item.codigo?.trim()).filter((item): item is string => Boolean(item))),
  );

  if (!candidateCodes.length) {
    return [] as ProductLookupForCommercialKit[];
  }

  const extendedCodes = Array.from(
    new Set([
      ...candidateCodes,
      ...candidateCodes.map((c) => c.toUpperCase()),
      ...candidateCodes.map((c) => c.toLowerCase()),
    ]),
  );

  const [internalCodes, externalCodes, skuCodes] = await Promise.all([
    adminSupabase
      .from("produtos")
      .select("id, codigo_interno, codigo_externo, sku, nome")
      .eq("depositante_id", depositanteId)
      .in("codigo_interno", extendedCodes),
    adminSupabase
      .from("produtos")
      .select("id, codigo_interno, codigo_externo, sku, nome")
      .eq("depositante_id", depositanteId)
      .in("codigo_externo", extendedCodes),
    adminSupabase
      .from("produtos")
      .select("id, codigo_interno, codigo_externo, sku, nome")
      .eq("depositante_id", depositanteId)
      .in("sku", extendedCodes),
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
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
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

function isMissingShippingSchemaError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.message?.includes("pedidos_expedicao") === true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseNumericWebhook(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function extractSituacaoWebhook(
  situacaoId: number | null | undefined,
): "ABERTO" | "ATENDIDO" | "CANCELADO" | "EM_ANDAMENTO" | "AGUARDANDO_PAGAMENTO" | null {
  const value = situacaoId;
  if (typeof value === "string") {
    return ((value as string).trim() || null) as "ABERTO" | "ATENDIDO" | "CANCELADO" | "EM_ANDAMENTO" | "AGUARDANDO_PAGAMENTO" | null;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const raw = value as Record<string, unknown>;
    return (stringifyValue(raw.valor) ?? stringifyValue(raw.id) ?? null) as "ABERTO" | "ATENDIDO" | "CANCELADO" | "EM_ANDAMENTO" | "AGUARDANDO_PAGAMENTO" | null;
  }

  return null;
}

function buildBlingEventSummary(eventName: string, data: Record<string, unknown>) {
  if (!eventName.startsWith("order.")) {
    return "Evento recebido fora do escopo principal de pedidos";
  }

  const id = typeof data.id === "number" || typeof data.id === "string" ? String(data.id) : "sem id";
  const numero =
    typeof data.numero === "number" || typeof data.numero === "string"
      ? String(data.numero)
      : "sem número";
  const numeroLoja =
    typeof data.numeroLoja === "string" && data.numeroLoja.trim()
      ? data.numeroLoja.trim()
      : "sem número da loja";
  const total =
    typeof data.total === "number" || typeof data.total === "string"
      ? String(data.total)
      : "0";

  return `pedido ${numero} / loja ${numeroLoja} / id ${id} / total ${total}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function buildMonitoringState(
  current:
    | {
        lastConnectionStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastConnectionMessage: string | null;
        lastConnectionAt: string | null;
        lastWebhookStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastWebhookMessage: string | null;
        lastWebhookAt: string | null;
        lastReprocessStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastReprocessMessage: string | null;
        lastReprocessAt: string | null;
        lastXmlSyncStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastXmlSyncMessage: string | null;
        lastXmlSyncAt: string | null;
      }
    | null
    | undefined,
  patch: Partial<{
    lastConnectionStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
    lastConnectionMessage: string | null;
    lastConnectionAt: string | null;
    lastWebhookStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
    lastWebhookMessage: string | null;
    lastWebhookAt: string | null;
    lastReprocessStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
    lastReprocessMessage: string | null;
    lastReprocessAt: string | null;
    lastXmlSyncStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
    lastXmlSyncMessage: string | null;
    lastXmlSyncAt: string | null;
  }>,
) {
  return {
    lastConnectionStatus: current?.lastConnectionStatus ?? null,
    lastConnectionMessage: current?.lastConnectionMessage ?? null,
    lastConnectionAt: current?.lastConnectionAt ?? null,
    lastWebhookStatus: current?.lastWebhookStatus ?? null,
    lastWebhookMessage: current?.lastWebhookMessage ?? null,
    lastWebhookAt: current?.lastWebhookAt ?? null,
    lastReprocessStatus: current?.lastReprocessStatus ?? null,
    lastReprocessMessage: current?.lastReprocessMessage ?? null,
    lastReprocessAt: current?.lastReprocessAt ?? null,
    lastXmlSyncStatus: current?.lastXmlSyncStatus ?? null,
    lastXmlSyncMessage: current?.lastXmlSyncMessage ?? null,
    lastXmlSyncAt: current?.lastXmlSyncAt ?? null,
    ...patch,
  };
}
