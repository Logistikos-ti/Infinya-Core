import type { AppUserContext } from "@/lib/auth";
import { buildOperationalSlaMeta, type OperationalSlaTone } from "@/lib/operational-sla";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import {
  detectSalesChannelFromPayload,
  readManualSalesChannelCode,
  readMarketplaceDisplay,
  readMarketplaceFlagDisplay,
  readStoreDisplay,
} from "@/lib/sales-channels";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RelationName = { nome?: string } | { nome?: string }[] | null;

type RawShippingOrderRow = {
  id: string;
  codigo: string;
  numero_wms: number | string | null;
  origem: string;
  status: string;
  numero_pedido: string | null;
  numero_loja: string | null;
  canal: string | null;
  valor_total: number | string | null;
  quantidade_itens: number | null;
  quantidade_unidades: number | string | null;
  data_pedido: string | null;
  previsao_envio_em: string | null;
  sincronizado_em: string | null;
  cliente_nome: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  observacoes?: string | null;
  payload_origem: Record<string, unknown> | null;
  depositante_id?: string;
  depositante: RelationName;
  itens?: RawShippingOrderItemRow[] | null;
};

type RawShippingOrderItemRow = {
  id: string;
  referencia_externa: string | null;
  codigo_produto: string | null;
  sku: string | null;
  nome: string;
  unidade: string | null;
  quantidade: number | string | null;
  quantidade_separada: number | string | null;
};

type RawShippingOrderDetailRow = {
  id: string;
  codigo: string;
  numero_wms: number | string | null;
  referencia_externa: string;
  origem: string;
  canal: string;
  status: string;
  status_origem: string | null;
  numero_pedido: string | null;
  numero_loja: string | null;
  cliente_nome: string | null;
  cliente_documento: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  valor_total: number | string | null;
  quantidade_itens: number | null;
  quantidade_unidades: number | string | null;
  data_pedido: string | null;
  previsao_envio_em: string | null;
  sincronizado_em: string | null;
  payload_origem: Record<string, unknown> | null;
  observacoes: string | null;
  depositante_id: string;
  depositante: RelationName;
  itens?: RawShippingOrderItemRow[] | null;
};

type RawStoredDocumentRow = {
  id: string;
  tipo: string;
  nome_arquivo: string;
  mime_type: string | null;
  created_at: string;
};

export type ShippingAttachment = {
  id: string;
  label: string;
  kind: "XML_NF" | "ETIQUETA";
  status: "DISPONIVEL" | "PENDENTE";
  href: string | null;
  viewHref: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  help: string;
};

export type ShippingOrderSummary = {
  id: string;
  code: string;
  internalNumber: number | null;
  displayNumber: string;
  depositanteId?: string;
  depositante: string;
  origin: string;
  externalNumber: string;
  storeNumber: string;
  storeDisplay: string;
  customer: string;
  destination: string;
  channel: string;
  marketplace: string;
  carrierName: string;
  status: string;
  statusLabel: string;
  total: string;
  units: string;
  itemCount: number;
  createdAtIso: string | null;
  createdAt: string;
  orderDate: string;
  ageLabel: string;
  ageTone: OperationalSlaTone;
  syncedAt: string;
  releasedWithoutRomaneio: boolean;
  releasedToRomaneio: boolean;
  nfe: string;
  items?: {
    name: string;
    sku: string;
    quantity: number;
    separatedQuantity: number;
  }[];
};

type ShippingOrderFilters = {
  status?: string;
  depositanteId?: string;
  dateFrom?: string;
  dateTo?: string;
  carrier?: string;
  customer?: string;
  orderSearch?: string;
  marketplace?: string;
};

export type ShippingQueueSummary = {
  label: string;
  status: string;
  orders: number;
  help: string;
};

export type ShippingOrderDetail = {
  id: string;
  code: string;
  internalNumber: number | null;
  displayNumber: string;
  depositanteId: string;
  externalReference: string;
  origin: string;
  channel: string;
  status: string;
  statusLabel: string;
  sourceStatus: string | null;
  depositante: string;
  customer: string;
  customerDocument: string;
  destination: string;
  externalNumber: string;
  storeNumber: string;
  storeDisplay: string;
  orderType: string;
  salesChannelCode: string | null;
  mercadoLivreOrderId: string | null;
  mercadoLivreShipmentId: string | null;
  total: string;
  totalRaw: number;
  itemCount: number;
  units: string;
  unitsRaw: number;
  orderDate: string;
  shipDate: string;
  expectedDate: string;
  syncedAt: string;
  marketplace: string;
  invoice: string;
  carrierName: string;
  shippingService: string;
  trackingCode: string;
  releasedWithoutRomaneio: boolean;
  releasedToRomaneio: boolean;
  suppliesTotalCost: string;
  suppliesTotalCostRaw: number;
  notes: string;
  attachments: ShippingAttachment[];
  supplies: Array<{
    id: string;
    kind: string;
    label: string;
    description: string;
    quantity: string;
    quantityRaw: number;
    unitCost: string;
    unitCostRaw: number;
    totalCost: string;
    totalCostRaw: number;
  }>;
  items: Array<{
    id: string;
    externalReference: string;
    code: string;
    sku: string;
    name: string;
    unit: string;
    quantity: string;
    quantityRaw: number;
    separatedQuantity: string;
    separatedQuantityRaw: number;
  }>;
};

export async function listShippingOrdersFromDb(filters?: ShippingOrderFilters) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, origem, status, numero_pedido, numero_loja, canal, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, sincronizado_em, cliente_nome, cliente_cidade, cliente_uf, observacoes, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada), documentos:documentos_armazenados(tipo, nome_arquivo, mime_type)",
    )
    .order("data_pedido", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  if (filters?.dateFrom) {
    query = query.gte("data_pedido", `${filters.dateFrom}T00:00:00`);
  }

  if (filters?.dateTo) {
    query = query.lte("data_pedido", `${filters.dateTo}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    if (isShippingSchemaMissing(error)) {
      return [] as ShippingOrderSummary[];
    }

    throw new Error(`Não foi possível listar os pedidos de expedição: ${error.message}`);
  }

  const orders = ((data ?? []) as RawShippingOrderRow[])
    .filter((item) => !isBlingWebhookSummaryOrder(item.observacoes))
    .map(mapShippingOrderSummary);

  return orders.filter((order) => {
    if (filters?.carrier) {
      const carrierNeedle = filters.carrier.trim().toLocaleLowerCase("pt-BR");
      if (!order.carrierName.toLocaleLowerCase("pt-BR").includes(carrierNeedle)) {
        return false;
      }
    }

    if (filters?.customer) {
      const customerNeedle = filters.customer.trim().toLocaleLowerCase("pt-BR");
      if (!order.customer.toLocaleLowerCase("pt-BR").includes(customerNeedle)) {
        return false;
      }
    }

    if (filters?.orderSearch) {
      const orderNeedle = filters.orderSearch.trim().toLocaleLowerCase("pt-BR");
      const haystack = [order.displayNumber, order.externalNumber, order.code, order.storeNumber, order.storeDisplay]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      if (!haystack.includes(orderNeedle)) {
        return false;
      }
    }

    if (filters?.marketplace) {
      const marketplaceNeedle = filters.marketplace.trim().toLocaleLowerCase("pt-BR");
      const haystack = [order.marketplace, order.channel, order.storeDisplay]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      if (!haystack.includes(marketplaceNeedle)) {
        return false;
      }
    }

    return true;
  });
}

function isBlingWebhookSummaryOrder(observacoes: string | null | undefined) {
  return observacoes?.trim() === "Pedido resumido criado a partir do webhook do Bling.";
}

export async function listShippingStatsFromDb(
  user: AppUserContext,
  sourceOrders?: ShippingOrderSummary[],
) {
  const orders = sourceOrders ?? (await listShippingOrdersFromDb());
  const aguardando = orders.filter((item) => item.status === "NOVO").length;
  const emSeparacao = orders.filter((item) =>
    ["EM_SEPARACAO", "SEPARADO", "EM_CONFERENCIA"].includes(item.status) ||
    (item.status === "CONFERIDO" && !item.releasedWithoutRomaneio),
  ).length;
  const prontos = orders.filter((item) => item.status === "PRONTO_ROMANEIO").length;
  const expedidos = orders.filter((item) => item.status === "EXPEDIDO").length;

  return [
    {
      label: "Pedidos integrados",
      value: String(orders.length),
      help:
        user.papel === "DEPOSITANTE"
          ? "Pedidos de expedição visíveis para o seu depositante."
          : "Pedidos vindos do Bling já espelhados no WMS.",
    },
    {
      label: "Aguardando separação",
      value: String(aguardando),
      help: "Pedidos recém-chegados, aguardando início operacional.",
    },
    {
      label: "Em execução",
      value: String(emSeparacao),
      help: "Pedidos já em separação ou conferência.",
    },
    {
      label: "Expedidos",
      value: String(expedidos),
      help: prontos
        ? `${prontos} pedido(s) também já pronto(s) para romaneio.`
        : "Nenhum pedido aguardando romaneio no momento.",
    },
  ] as const;
}

export async function listShippingQueuesFromDb(sourceOrders?: ShippingOrderSummary[]) {
  const orders = sourceOrders ?? (await listShippingOrdersFromDb());
  const queueDefinitions = [
    {
      status: "NOVO",
      label: "Entrada do Bling",
      help: "Pedidos recém-importados e aguardando liberação para separação.",
    },
    {
      status: "EM_SEPARACAO",
      label: "Separação em andamento",
      help: "Pedidos já em picking no armazém.",
    },
    {
      status: "EM_CONFERENCIA",
      label: "Conferência final",
      help: "Pedidos em validação final antes do romaneio.",
    },
    {
      status: "PRONTO_ROMANEIO",
      label: "Pronto para romaneio",
      help: "Pedidos aptos para consolidação e despacho.",
    },
  ] as const;

  return queueDefinitions.map((queue) => ({
    ...queue,
    orders: orders.filter((item) => item.status === queue.status).length,
  }));
}

export async function getShippingOrderDetailFromDb(id: string, user?: AppUserContext) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, referencia_externa, origem, canal, status, status_origem, numero_pedido, numero_loja, cliente_nome, cliente_documento, cliente_cidade, cliente_uf, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, sincronizado_em, payload_origem, observacoes, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada), documentos:documentos_armazenados(tipo, nome_arquivo, mime_type)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isShippingSchemaMissing(error)) {
      return null;
    }

    throw new Error(`NÃ£o foi possÃ­vel carregar o pedido de expediÃ§Ã£o: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const order = data as RawShippingOrderDetailRow;

  if (user?.papel === "DEPOSITANTE" && user.depositanteId && order.depositante_id !== user.depositanteId) {
    return null;
  }

  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const customer = order.cliente_nome?.trim() || "Cliente não informado";
  const destination =
    [order.cliente_cidade?.trim(), order.cliente_uf?.trim()].filter(Boolean).join(" - ") ||
    "Destino não informado";
  const marketplace = extractMarketplace(payload);
  const invoice = extractInvoice(payload, (order as any).documentos);
  const orderType = extractOrderType(payload, order.origem);
  const storeDisplay = extractStore(payload, order.numero_loja);
  const salesChannelCode = readManualSalesChannelCode(payload) ?? detectSalesChannelFromPayload(payload)?.value ?? null;
  const mercadoLivre = extractMercadoLivrePayload(payload);
  const carrierName = extractCarrierName(payload);
  const shippingService = extractShippingService(payload);
  const trackingCode = extractTrackingCode(payload);
  const expectedDate = extractExpectedDate(payload, order.previsao_envio_em);
  const supplies = extractSupplies(payload);
  const suppliesTotalCostRaw = supplies.reduce((accumulator, item) => accumulator + item.totalCostRaw, 0);
  const attachments = await listShippingAttachments(order.id, invoice, order.origem);
  const releasedWithoutRomaneio = isOrderReleasedWithoutRomaneio(payload);
  const releasedToRomaneio = isOrderReleasedToRomaneio(payload, order.status);
  const items = (order.itens ?? []).map((item) => {
    const quantityRaw = Number(item.quantidade ?? 0);
    const separatedQuantityRaw = Number(item.quantidade_separada ?? 0);

    return {
      id: item.id,
      externalReference: item.referencia_externa?.trim() || "-",
      code: item.codigo_produto?.trim() || "-",
      sku: item.sku?.trim() || "-",
      name: item.nome,
      unit: item.unidade?.trim() || "-",
      quantity: quantityRaw.toLocaleString("pt-BR"),
      quantityRaw,
      separatedQuantity: separatedQuantityRaw.toLocaleString("pt-BR"),
      separatedQuantityRaw,
    };
  });

  return {
    id: order.id,
    code: order.codigo,
    internalNumber: normalizeInternalOrderNumber(order.numero_wms),
    displayNumber: formatWmsOrderNumber(order.numero_wms, order.codigo),
    depositanteId: order.depositante_id,
    externalReference: order.referencia_externa,
    origin: order.origem,
    channel: order.canal,
    status: order.status,
    statusLabel: formatShippingStatusLabel(order.status, payload),
    sourceStatus: order.status_origem,
    depositante: extractRelationName(order.depositante) ?? "Sem depositante",
    customer,
    customerDocument: order.cliente_documento?.trim() || "-",
    destination,
    externalNumber: extractPlatformOrderNumber(payload, order.numero_pedido, order.numero_loja, order.codigo),
    storeNumber: order.numero_loja?.trim() || "-",
    storeDisplay,
    orderType,
    salesChannelCode,
    mercadoLivreOrderId: mercadoLivre.orderId,
    mercadoLivreShipmentId: mercadoLivre.shipmentId,
    total: formatCurrency(order.valor_total),
    totalRaw: Number(order.valor_total ?? 0),
    itemCount: Number(order.quantidade_itens ?? items.length),
    units: Number(order.quantidade_unidades ?? 0).toLocaleString("pt-BR"),
    unitsRaw: Number(order.quantidade_unidades ?? 0),
    orderDate: formatBusinessDateTimeOrFallback(order.data_pedido, "Sem data"),
    shipDate: formatDateOrFallback(order.previsao_envio_em, "Sem previsÃ£o"),
    expectedDate,
    syncedAt: formatDateTimeInSaoPaulo(order.sincronizado_em, "Ainda não sincronizado"),
    marketplace,
    invoice,
    carrierName,
    shippingService,
    trackingCode,
    releasedWithoutRomaneio,
    releasedToRomaneio,
    suppliesTotalCost: formatCurrency(suppliesTotalCostRaw),
    suppliesTotalCostRaw,
    notes: order.observacoes?.trim() || "Sem observaÃ§Ãµes.",
    attachments,
    supplies,
    items,
  } satisfies ShippingOrderDetail;
}

async function listShippingAttachments(orderId: string, invoice: string, origin: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documentos_armazenados")
    .select("id, tipo, nome_arquivo, mime_type, created_at")
    .eq("pedido_expedicao_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isShippingDocumentLinkMissing(error)) {
      return buildDefaultShippingAttachments([], invoice, orderId, origin);
    }

    throw new Error(`NÃ£o foi possÃ­vel carregar os anexos do pedido: ${error.message}`);
  }

  return buildDefaultShippingAttachments((data ?? []) as RawStoredDocumentRow[], invoice, orderId, origin);
}

function buildDefaultShippingAttachments(
  documents: RawStoredDocumentRow[],
  invoice: string,
  orderId: string,
  origin: string,
): ShippingAttachment[] {
  const nfDocument =
    documents.find((item) => item.tipo === "NF") ??
    documents.find((item) => item.mime_type?.includes("xml"));
  const labelDocument = documents.find((item) => item.tipo === "ETIQUETA");

  return [
    buildAttachment(
      "XML_NF",
      nfDocument,
      orderId,
      invoice !== "Ainda não vinculada" ? `XML da NF ${invoice}` : "XML da nota fiscal",
      "Anexe aqui o XML da nota fiscal quando o documento estiver disponÃ­vel no fluxo fiscal.",
      origin === "BLING" ? `/api/expedicao/${orderId}/nota-fiscal-preview` : null,
    ),
    buildAttachment(
      "ETIQUETA",
      labelDocument,
      orderId,
      "Etiqueta do marketplace",
      "Anexe aqui o PDF ou imagem da etiqueta gerada no marketplace ou operador logÃ­stico.",
      null,
    ),
  ];
}

function buildAttachment(
  kind: ShippingAttachment["kind"],
  document: RawStoredDocumentRow | undefined,
  orderId: string,
  pendingLabel: string,
  help: string,
  customViewHref: string | null,
): ShippingAttachment {
  if (!document) {
    return {
      id: `${kind}-pendente`,
      label: pendingLabel,
      kind,
      status: "PENDENTE",
      href: null,
      viewHref: null,
      fileName: null,
      uploadedAt: null,
      help,
    };
  }

  const attachmentRouteKind = kind === "XML_NF" ? "xml-nf" : "etiqueta";

  return {
    id: document.id,
    label: kind === "XML_NF" ? "XML da nota fiscal" : "Etiqueta do marketplace",
    kind,
    status: "DISPONIVEL",
    href: `/api/expedicao/${orderId}/anexos/${attachmentRouteKind}`,
    viewHref:
      customViewHref ??
      `/api/expedicao/${orderId}/anexos/${attachmentRouteKind}?disposition=inline`,
    fileName: document.nome_arquivo,
    uploadedAt: formatDateTimeInSaoPaulo(document.created_at, "Sem data"),
    help,
  };
}

export function listShippingFlowSteps() {
  return [
    "Receber pedido do canal integrado",
    "Reservar itens e abrir separaÃ§Ã£o",
    "Conferir volumes e divergÃªncias",
    "Gerar romaneio e liberar expediÃ§Ã£o",
  ] as const;
}

function mapShippingOrderSummary(item: RawShippingOrderRow): ShippingOrderSummary {
  const payload = isRecord(item.payload_origem) ? item.payload_origem : {};
  const storeDisplay = extractStore(payload, item.numero_loja);
  const marketplace = extractMarketplace(payload);
  const carrierName = extractCarrierName(payload);
  const customer = item.cliente_nome?.trim() || "Cliente não informado";
  const destination =
    [item.cliente_cidade?.trim(), item.cliente_uf?.trim()].filter(Boolean).join(" - ") ||
    "Destino não informado";
  const ageMeta = buildOperationalSlaMeta(item.data_pedido ?? null);
  const releasedWithoutRomaneio = isOrderReleasedWithoutRomaneio(payload);
  const releasedToRomaneio = isOrderReleasedToRomaneio(payload, item.status);
  const nfe = extractInvoice(payload, (item as any).documentos);
  
  const items = (item.itens ?? []).map((it) => ({
    name: it.nome,
    sku: it.sku || it.codigo_produto || "",
    quantity: Number(it.quantidade ?? 1),
    separatedQuantity: Number(it.quantidade_separada ?? 0)
  }));

  return {
    id: item.id,
    code: item.codigo,
    internalNumber: normalizeInternalOrderNumber(item.numero_wms),
    displayNumber: formatWmsOrderNumber(item.numero_wms, item.codigo),
    depositanteId: item.depositante_id,
    depositante: extractRelationName(item.depositante) ?? "Sem depositante",
    origin: item.origem,
    externalNumber: extractPlatformOrderNumber(payload, item.numero_pedido, item.numero_loja, item.codigo),
    storeNumber: item.numero_loja?.trim() || "-",
    storeDisplay,
    customer,
    destination,
    channel: item.canal?.trim() || "BLING",
    marketplace,
    carrierName,
    status: item.status,
    statusLabel: formatShippingStatusLabel(item.status, payload),
    total: formatCurrency(item.valor_total),
    units: Number(item.quantidade_unidades ?? 0).toLocaleString("pt-BR"),
    itemCount: Number(item.quantidade_itens ?? 0),
    createdAtIso: ageMeta.createdAtIso,
    createdAt: ageMeta.createdAtLabel,
    orderDate: formatDateTimeInSaoPaulo(item.data_pedido, "Hoje"),
    ageLabel: ageMeta.ageLabel,
    ageTone: ageMeta.tone,
    syncedAt: formatDateTimeInSaoPaulo(item.sincronizado_em, "Ainda não sincronizado"),
    releasedWithoutRomaneio,
    releasedToRomaneio,
    nfe,
    items,
  };
}

function extractRelationName(value: RelationName) {
  if (Array.isArray(value)) {
    return typeof value[0]?.nome === "string" ? value[0].nome : null;
  }

  if (value && typeof value.nome === "string") {
    return value.nome;
  }

  return null;
}

function normalizeInternalOrderNumber(value: number | string | null | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.trunc(numericValue) : null;
}

function formatCurrency(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return numericValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatBusinessDateTimeOrFallback(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?(\+00:00|Z)$/.test(value)) {
    return formatDateOrFallback(value, fallback);
  }

  return formatDateTimeInSaoPaulo(value, fallback);
}

function formatDateTimeInSaoPaulo(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  const localDateTimeMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
  );

  if (localDateTimeMatch) {
    const [, year, month, day, hour, minute, second] = localDateTimeMatch;
    return `${day}/${month}/${year}, ${hour}:${minute}${second ? `:${second}` : ""}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatDateOrFallback(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }

  const localDateTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (localDateTimeMatch) {
    const [, year, month, day] = localDateTimeMatch;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString("pt-BR");
}

function extractOrderType(payload: Record<string, unknown>, originFallback: string) {
  const manualChannel = readManualSalesChannelCode(payload);
  const intermediador = isRecord(payload.intermediador) ? payload.intermediador : null;
  const numeroPedidoCompra = readString(payload.numeroPedidoCompra);

  if (numeroPedidoCompra) {
    return "Pedido de compra";
  }

  if (originFallback === "MANUAL" || manualChannel) {
    return readMarketplaceFlagDisplay(payload) === "Sim" ? "Pedido de marketplace" : "Pedido manual";
  }

  if (intermediador) {
    return "Pedido de marketplace";
  }

  return originFallback === "BLING" ? "Pedido integrado" : originFallback;
}

export function extractMarketplace(payload: Record<string, unknown>) {
  return readMarketplaceDisplay(payload);
}

function isOrderReleasedWithoutRomaneio(payload: Record<string, unknown>) {
  const conferencia = isRecord(payload.conferencia) ? payload.conferencia : null;
  return readString(conferencia?.liberadoSemRomaneioEm) !== null;
}

function isOrderReleasedToRomaneio(payload: Record<string, unknown>, status: string) {
  if (status === "PRONTO_ROMANEIO") {
    return true;
  }

  const conferencia = isRecord(payload.conferencia) ? payload.conferencia : null;
  return readString(conferencia?.liberadoParaRomaneioEm) !== null;
}

function extractStore(payload: Record<string, unknown>, storeNumberFallback: string | null) {
  return readStoreDisplay(payload, storeNumberFallback);
}

function extractInvoice(payload: Record<string, unknown>, documents?: any[]) {
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;
  const num = readString(notaFiscal?.numero);
  if (num) return num;

  if (documents && Array.isArray(documents)) {
    const nfDoc = documents.find((d: any) => d.tipo === "NF" || (d.mime_type && d.mime_type.includes("xml")));
    if (nfDoc && typeof nfDoc.nome_arquivo === "string") {
      const match = nfDoc.nome_arquivo.match(/^(\d{44})/);
      if (match) {
        const chave = match[1];
        const numero = chave.substring(25, 34);
        return String(parseInt(numero, 10));
      }
    }
  }

  return "Ainda não vinculada";
}

function extractPlatformOrderNumber(
  payload: Record<string, unknown>,
  numeroPedido: string | null,
  numeroLoja: string | null,
  fallbackCode: string,
) {
  const orderNumber = readString(numeroPedido);
  const storeNumber = readString(numeroLoja);
  return storeNumber ?? orderNumber ?? fallbackCode;
}

function extractExpectedDate(payload: Record<string, unknown>, fallbackDate: string | null) {
  return formatDateOrFallback(readString(payload.dataPrevista) ?? fallbackDate, "Sem previsÃ£o");
}

export function extractCarrierName(payload: Record<string, unknown>) {
  const transporte = isRecord(payload.transporte) ? payload.transporte : null;
  const transportadorContato = transporte && isRecord(transporte.contato) ? transporte.contato : null;
  const transportadorCadastro = transporte && isRecord(transporte.transportador) ? transporte.transportador : null;
  const volumes = Array.isArray(transporte?.volumes) ? transporte.volumes : [];
  const firstVolume = volumes.find((item) => isRecord(item));
  const serviceName = firstVolume && isRecord(firstVolume) ? readString(firstVolume.servico) : null;
  const trackingCode =
    firstVolume && isRecord(firstVolume) ? readString(firstVolume.codigoRastreamento) : null;
  const salesChannelCode =
    readManualSalesChannelCode(payload) ?? detectSalesChannelFromPayload(payload)?.value ?? null;

  return (
    readString(transportadorCadastro?.nome) ??
    readString(transportadorContato?.nome) ??
    inferCarrierNameFromService(serviceName, trackingCode, salesChannelCode) ??
    "Transportadora não informada"
  );
}

function extractShippingService(payload: Record<string, unknown>) {
  const transporte = isRecord(payload.transporte) ? payload.transporte : null;
  const volumes = Array.isArray(transporte?.volumes) ? transporte.volumes : [];
  const firstVolume = volumes.find((item) => isRecord(item));

  return firstVolume && isRecord(firstVolume)
    ? readString(firstVolume.servico) ?? "Serviço não informado"
    : "Serviço não informado";
}

function extractTrackingCode(payload: Record<string, unknown>) {
  const transporte = isRecord(payload.transporte) ? payload.transporte : null;
  const volumes = Array.isArray(transporte?.volumes) ? transporte.volumes : [];
  const firstVolume = volumes.find((item) => isRecord(item));

  return firstVolume && isRecord(firstVolume)
    ? readString(firstVolume.codigoRastreamento) ?? "Rastreio não informado"
    : "Rastreio não informado";
}

function inferCarrierNameFromService(
  serviceName: string | null,
  trackingCode: string | null,
  salesChannelCode: string | null,
) {
  const service = serviceName?.toLocaleLowerCase("pt-BR") ?? "";
  const tracking = trackingCode?.toLocaleLowerCase("pt-BR") ?? "";

  if (service.includes("amazon") || tracking.startsWith("amz")) {
    return "Amazon Transportes";
  }

  if (service.includes("shopee")) {
    return "Shopee Xpress";
  }

  if (service.includes("mercado envios") || tracking.startsWith("mel")) {
    return "Mercado Envios";
  }

  if (service.includes("magalu") || service.includes("magazine")) {
    return "Magalu Entregas";
  }

  if (service.includes("olist")) {
    return "Olist";
  }

  if (service.includes("correios")) {
    return "Correios";
  }

  if (salesChannelCode === "MERCADO_LIVRE" && service) {
    return "Mercado Envios";
  }

  return serviceName;
}

function extractSupplies(payload: Record<string, unknown>) {
  const suppliesRoot = isRecord(payload.insumos) ? payload.insumos : null;
  const items = Array.isArray(suppliesRoot?.itens) ? suppliesRoot.itens : [];

  return items
    .filter((item) => isRecord(item))
    .map((item, index) => {
      const quantityRaw = Number(item.quantidade ?? 0);
      const unitCostRaw = Number(item.custoUnitario ?? 0);
      const totalCostRaw = Number(item.custoTotal ?? quantityRaw * unitCostRaw);

      return {
        id: readString(item.id) ?? `supply-${index}`,
        kind: readString(item.kind) ?? "OUTRO",
        label: readString(item.label) ?? "Outro",
        description: readString(item.descricao) ?? "",
        quantity: quantityRaw.toLocaleString("pt-BR"),
        quantityRaw,
        unitCost: formatCurrency(unitCostRaw),
        unitCostRaw,
        totalCost: formatCurrency(totalCostRaw),
        totalCostRaw,
      };
    });
}

function extractMercadoLivrePayload(payload: Record<string, unknown>) {
  const mercadoLivre = isRecord(payload.mercadoLivre) ? payload.mercadoLivre : null;

  return {
    orderId: readString(mercadoLivre?.orderId),
    shipmentId: readString(mercadoLivre?.shipmentId),
  };
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

export function formatShippingStatusLabel(status: string, payload?: Record<string, unknown> | null) {
  const normalizedPayload = isRecord(payload) ? payload : {};
  switch (status) {
    case "NOVO":
      return "Novo";
    case "EM_SEPARACAO":
      return "Em separaÃ§Ã£o";
    case "SEPARADO":
      return "Aguardando conferência";
    case "EM_CONFERENCIA":
      return "Em conferência";
    case "CONFERIDO":
      return isOrderReleasedWithoutRomaneio(normalizedPayload) ? "Finalizado sem romaneio" : "Conferido";
    case "PRONTO_ROMANEIO":
      return "Liberado para romaneio";
    case "EXPEDIDO":
      return "Expedido";
    case "CANCELADO":
      return "Cancelado";
    default:
      return status;
  }
}

function isShippingSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("pedidos_expedicao") === true;
}

function isShippingDocumentLinkMissing(error: { code?: string; message?: string }) {
  return error.code === "42703" || error.message?.includes("pedido_expedicao_id") === true;
}

