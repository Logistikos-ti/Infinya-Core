import type { AppUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RelationName = { nome?: string } | { nome?: string }[] | null;

type RawShippingOrderRow = {
  id: string;
  codigo: string;
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
  depositante_id?: string;
  depositante: RelationName;
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

type ShippingAttachment = {
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
  depositanteId?: string;
  depositante: string;
  externalNumber: string;
  storeNumber: string;
  customer: string;
  destination: string;
  channel: string;
  status: string;
  statusLabel: string;
  total: string;
  units: string;
  itemCount: number;
  createdAt: string;
  syncedAt: string;
};

type ShippingOrderFilters = {
  status?: string;
  depositanteId?: string;
  dateFrom?: string;
  dateTo?: string;
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
  notes: string;
  attachments: ShippingAttachment[];
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
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, status, numero_pedido, numero_loja, canal, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, sincronizado_em, cliente_nome, cliente_cidade, cliente_uf, depositante_id, depositante:depositantes(nome)",
    )
    .order("data_pedido", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

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

  return ((data ?? []) as RawShippingOrderRow[]).map(mapShippingOrderSummary);
}

export async function listShippingStatsFromDb(user: AppUserContext) {
  const orders = await listShippingOrdersFromDb();
  const aguardando = orders.filter((item) => item.status === "NOVO").length;
  const emSeparacao = orders.filter((item) =>
    ["EM_SEPARACAO", "SEPARADO", "EM_CONFERENCIA", "CONFERIDO"].includes(item.status),
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

export async function listShippingQueuesFromDb() {
  const orders = await listShippingOrdersFromDb();
  const queueDefinitions = [
    {
      status: "NOVO",
      label: "Entrada do Bling",
      help: "Pedidos recém importados e aguardando liberação para separação.",
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

export async function getShippingOrderDetailFromDb(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, referencia_externa, origem, canal, status, status_origem, numero_pedido, numero_loja, cliente_nome, cliente_documento, cliente_cidade, cliente_uf, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, sincronizado_em, payload_origem, observacoes, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isShippingSchemaMissing(error)) {
      return null;
    }

    throw new Error(`Não foi possível carregar o pedido de expedição: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const order = data as RawShippingOrderDetailRow;
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const customer = order.cliente_nome?.trim() || "Cliente não informado";
  const destination =
    [order.cliente_cidade?.trim(), order.cliente_uf?.trim()].filter(Boolean).join(" - ") ||
    "Destino não informado";
  const marketplace = extractMarketplace(payload, order.canal);
  const invoice = extractInvoice(payload);
  const orderType = extractOrderType(payload, order.origem);
  const storeDisplay = extractStore(payload, order.numero_loja);
  const carrierName = extractCarrierName(payload);
  const shippingService = extractShippingService(payload);
  const trackingCode = extractTrackingCode(payload);
  const expectedDate = extractExpectedDate(payload, order.previsao_envio_em);
  const attachments = await listShippingAttachments(order.id, invoice, order.origem);
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
    depositanteId: order.depositante_id,
    externalReference: order.referencia_externa,
    origin: order.origem,
    channel: order.canal,
    status: order.status,
    statusLabel: formatShippingStatusLabel(order.status),
    sourceStatus: order.status_origem,
    depositante: extractRelationName(order.depositante) ?? "Sem depositante",
    customer,
    customerDocument: order.cliente_documento?.trim() || "-",
    destination,
    externalNumber: order.numero_pedido?.trim() || order.codigo,
    storeNumber: order.numero_loja?.trim() || "-",
    storeDisplay,
    orderType,
    total: formatCurrency(order.valor_total),
    totalRaw: Number(order.valor_total ?? 0),
    itemCount: Number(order.quantidade_itens ?? items.length),
    units: Number(order.quantidade_unidades ?? 0).toLocaleString("pt-BR"),
    unitsRaw: Number(order.quantidade_unidades ?? 0),
    orderDate: formatBusinessDateTimeOrFallback(order.data_pedido, "Sem data"),
    shipDate: formatDateOrFallback(order.previsao_envio_em, "Sem previsão"),
    expectedDate,
    syncedAt: formatDateTimeInSaoPaulo(order.sincronizado_em, "Ainda não sincronizado"),
    marketplace,
    invoice,
    carrierName,
    shippingService,
    trackingCode,
    notes: order.observacoes?.trim() || "Sem observações.",
    attachments,
    items,
  } satisfies ShippingOrderDetail;
}

async function listShippingAttachments(orderId: string, invoice: string, origin: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documentos_armazenados")
    .select("id, tipo, nome_arquivo, mime_type, created_at")
    .eq("pedido_expedicao_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isShippingDocumentLinkMissing(error)) {
      return buildDefaultShippingAttachments([], invoice, orderId, origin);
    }

    throw new Error(`Não foi possível carregar os anexos do pedido: ${error.message}`);
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
      invoice !== "Ainda não vinculada" ? `XML da NF ${invoice}` : "XML da nota fiscal",
      "Anexe aqui o XML da nota fiscal quando o documento estiver disponível no fluxo fiscal.",
      origin === "BLING" ? `/api/expedicao/${orderId}/nota-fiscal-preview` : null,
    ),
    buildAttachment(
      "ETIQUETA",
      labelDocument,
      "Etiqueta do marketplace",
      "Anexe aqui o PDF ou imagem da etiqueta gerada no marketplace ou operador logístico.",
      null,
    ),
  ];
}

function buildAttachment(
  kind: ShippingAttachment["kind"],
  document: RawStoredDocumentRow | undefined,
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

  return {
    id: document.id,
    label: kind === "XML_NF" ? "XML da nota fiscal" : "Etiqueta do marketplace",
    kind,
    status: "DISPONIVEL",
    href: `/api/documentos/${document.id}/download`,
    viewHref: customViewHref ?? `/api/documentos/${document.id}/download?disposition=inline`,
    fileName: document.nome_arquivo,
    uploadedAt: formatDateTimeInSaoPaulo(document.created_at, "Sem data"),
    help,
  };
}

export function listShippingFlowSteps() {
  return [
    "Receber pedido do canal integrado",
    "Reservar itens e abrir separação",
    "Conferir volumes e divergências",
    "Gerar romaneio e liberar expedição",
  ] as const;
}

function mapShippingOrderSummary(item: RawShippingOrderRow): ShippingOrderSummary {
  const customer = item.cliente_nome?.trim() || "Cliente não informado";
  const destination =
    [item.cliente_cidade?.trim(), item.cliente_uf?.trim()].filter(Boolean).join(" - ") ||
    "Destino não informado";

  return {
    id: item.id,
    code: item.codigo,
    depositanteId: item.depositante_id,
    depositante: extractRelationName(item.depositante) ?? "Sem depositante",
    externalNumber: item.numero_pedido?.trim() || item.codigo,
    storeNumber: item.numero_loja?.trim() || "-",
    customer,
    destination,
    channel: item.canal?.trim() || "BLING",
    status: item.status,
    statusLabel: formatShippingStatusLabel(item.status),
    total: formatCurrency(item.valor_total),
    units: Number(item.quantidade_unidades ?? 0).toLocaleString("pt-BR"),
    itemCount: Number(item.quantidade_itens ?? 0),
    createdAt: formatBusinessDateTimeOrFallback(item.data_pedido, "Sem data"),
    syncedAt: formatDateTimeInSaoPaulo(item.sincronizado_em, "Ainda não sincronizado"),
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

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString("pt-BR");
}

function extractOrderType(payload: Record<string, unknown>, originFallback: string) {
  const intermediador = isRecord(payload.intermediador) ? payload.intermediador : null;
  const numeroPedidoCompra = readString(payload.numeroPedidoCompra);

  if (numeroPedidoCompra) {
    return "Pedido de compra";
  }

  if (intermediador) {
    return "Pedido de marketplace";
  }

  return originFallback === "BLING" ? "Pedido integrado" : originFallback;
}

function extractMarketplace(payload: Record<string, unknown>, channelFallback: string) {
  const intermediador = isRecord(payload.intermediador) ? payload.intermediador : null;

  if (intermediador) {
    return "Sim";
  }

  return channelFallback === "BLING" ? "Não" : channelFallback;
}

function extractStore(payload: Record<string, unknown>, storeNumberFallback: string | null) {
  const contato = isRecord(payload.contato) ? payload.contato : null;
  const loja = isRecord(payload.loja) ? payload.loja : null;
  const unidadeNegocio = loja && isRecord(loja.unidadeNegocio) ? loja.unidadeNegocio : null;
  const intermediador = isRecord(payload.intermediador) ? payload.intermediador : null;

  return (
    resolveSalesChannelName(intermediador, loja) ??
    readString(contato?.fantasia) ??
    readString(contato?.nomeFantasia) ??
    readString(contato?.nomeLoja) ??
    readString(unidadeNegocio?.id) ??
    readString(loja?.id) ??
    storeNumberFallback ??
    "-"
  );
}

function resolveSalesChannelName(
  intermediador: Record<string, unknown> | null,
  loja: Record<string, unknown> | null,
) {
  const cnpj = normalizeDigits(readString(intermediador?.cnpj));
  const login = readString(intermediador?.nomeUsuario);
  const lojaId = normalizeDigits(readString(loja?.id));

  const knownByCnpj: Record<string, string> = {
    "03007331000141": "Mercado Livre",
    "35635824000112": "Shopee",
    "15436940000103": "Amazon",
    "47960950000121": "Magazine Luiza",
  };

  if (cnpj && knownByCnpj[cnpj]) {
    return knownByCnpj[cnpj];
  }

  if (login && /evolveg/i.test(login)) {
    return "Mercado Livre";
  }

  if (login && /amazon/i.test(login)) {
    return "Amazon";
  }

  if (login && /shopee/i.test(login)) {
    return "Shopee";
  }

  if (login && /magalu|magazine/i.test(login)) {
    return "Magazine Luiza";
  }

  const knownByLojaId: Record<string, string> = {
    "204422544": "Mercado Livre",
    "204440093": "Shopee",
    "204432941": "Amazon",
    "204432814": "Magazine Luiza",
  };

  if (lojaId && knownByLojaId[lojaId]) {
    return knownByLojaId[lojaId];
  }

  if (login && !/^\d+$/.test(login)) {
    return login;
  }

  return null;
}

function normalizeDigits(value: string | null) {
  return value?.replace(/\D/g, "") ?? null;
}

function extractInvoice(payload: Record<string, unknown>) {
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;

  return readString(notaFiscal?.numero) ?? readString(notaFiscal?.id) ?? "Ainda não vinculada";
}

function extractExpectedDate(payload: Record<string, unknown>, fallbackDate: string | null) {
  return formatDateOrFallback(readString(payload.dataPrevista) ?? fallbackDate, "Sem previsão");
}

function extractCarrierName(payload: Record<string, unknown>) {
  const transporte = isRecord(payload.transporte) ? payload.transporte : null;
  const transportador = transporte && isRecord(transporte.contato) ? transporte.contato : null;

  return readString(transportador?.nome) ?? "Transportadora não informada";
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

export function formatShippingStatusLabel(status: string) {
  switch (status) {
    case "NOVO":
      return "Novo";
    case "EM_SEPARACAO":
      return "Em separação";
    case "SEPARADO":
      return "Separado";
    case "EM_CONFERENCIA":
      return "Em conferência";
    case "CONFERIDO":
      return "Conferido";
    case "PRONTO_ROMANEIO":
      return "Pronto para romaneio";
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
