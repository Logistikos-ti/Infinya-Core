import type { AppUserContext } from "@/lib/auth";
import { buildOperationalSlaMeta, type OperationalSlaTone } from "@/lib/operational-sla";
import { formatShippingStatusLabel } from "@/lib/shipping";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RelationName = { nome?: string } | { nome?: string }[] | null;

type RawConferenceItemRow = {
  id: string;
  produto_id: string | null;
  referencia_externa: string | null;
  codigo_produto: string | null;
  sku: string | null;
  nome: string;
  unidade: string | null;
  quantidade: number | string | null;
  quantidade_separada: number | string | null;
  payload_origem: Record<string, unknown> | null;
  produto?: {
    codigo_externo?: string | null;
  } | null;
};

type RawConferenceOrderRow = {
  id: string;
  codigo: string;
  created_at: string;
  status: string;
  numero_pedido: string | null;
  numero_loja: string | null;
  cliente_nome: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  quantidade_itens: number | null;
  quantidade_unidades: number | string | null;
  payload_origem: Record<string, unknown> | null;
  depositante_id: string;
  depositante: RelationName;
  itens: RawConferenceItemRow[] | null;
};

type ConferencePayload = {
  operatorId: string | null;
  operatorName: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  wrongProductScans: number;
};

export type ShippingConferenceItem = {
  id: string;
  productId: string | null;
  externalReference: string;
  code: string;
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  requestedQuantity: number;
  separatedQuantity: number;
  confirmedQuantity: number;
  pendingQuantity: number;
  hasQuantityDivergence: boolean;
};

export type ShippingConferenceOrder = {
  id: string;
  code: string;
  createdAtIso: string | null;
  createdAt: string;
  ageLabel: string;
  ageTone: OperationalSlaTone;
  externalNumber: string;
  customer: string;
  destination: string;
  status: string;
  statusLabel: string;
  depositanteId: string;
  depositante: string;
  totalItems: number;
  totalUnits: number;
  assignedOperatorId: string | null;
  assignedOperatorName: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  completionPercent: number;
  pendingUnits: number;
  wrongProductScans: number;
  quantityDivergentItems: number;
  items: ShippingConferenceItem[];
};

export type ShippingConferenceFilters = {
  status?: string;
  depositanteId?: string;
  operatorId?: string;
};

const activeConferenceStatuses = ["SEPARADO", "EM_CONFERENCIA"] as const;

export async function listShippingConferenceOrdersFromDb(
  user: AppUserContext,
  filters?: ShippingConferenceFilters,
) {
  const supabase = createSupabaseAdminClient();
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : filters?.depositanteId;

  let query = supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, created_at, status, numero_pedido, numero_loja, cliente_nome, cliente_cidade, cliente_uf, quantidade_itens, quantidade_unidades, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, produto_id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada, payload_origem, produto:produtos(codigo_externo))",
    )
    .in("status", [...activeConferenceStatuses])
    .order("created_at", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (effectiveDepositanteId) {
    query = query.eq("depositante_id", effectiveDepositanteId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`N?o foi poss?vel listar os pedidos em confer?ncia: ${error.message}`);
  }

  const orders = ((data ?? []) as RawConferenceOrderRow[]).map(mapConferenceOrder);

  return orders.filter((order) => {
    if (!filters?.operatorId) {
      return true;
    }

    return order.assignedOperatorId === filters.operatorId;
  });
}

export async function getShippingConferenceOrderFromDb(user: AppUserContext, id: string) {
  const supabase = createSupabaseAdminClient();
  const effectiveDepositanteId = user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined;

  let query = supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, created_at, status, numero_pedido, numero_loja, cliente_nome, cliente_cidade, cliente_uf, quantidade_itens, quantidade_unidades, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, produto_id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada, payload_origem, produto:produtos(codigo_externo))",
    )
    .eq("id", id);

  if (effectiveDepositanteId) {
    query = query.eq("depositante_id", effectiveDepositanteId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`N?o foi poss?vel carregar o pedido em confer?ncia: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapConferenceOrder(data as RawConferenceOrderRow);
}

function mapConferenceOrder(order: RawConferenceOrderRow) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const conference = extractConferencePayload(payload);
  const items = (order.itens ?? []).map(mapConferenceItem);
  const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
  const totalConfirmed = items.reduce((sum, item) => sum + item.confirmedQuantity, 0);
  const pendingUnits = items.reduce((sum, item) => sum + item.pendingQuantity, 0);
  const quantityDivergentItems = items.filter((item) => item.hasQuantityDivergence).length;
  const ageMeta = buildOperationalSlaMeta(order.created_at);

  return {
    id: order.id,
    code: order.codigo,
    createdAtIso: ageMeta.createdAtIso,
    createdAt: ageMeta.createdAtLabel,
    ageLabel: ageMeta.ageLabel,
    ageTone: ageMeta.tone,
    externalNumber: extractPlatformOrderNumber(payload, order.numero_pedido, order.numero_loja, order.codigo),
    customer: order.cliente_nome?.trim() || "Cliente nï¿½o informado",
    destination:
      [order.cliente_cidade?.trim(), order.cliente_uf?.trim()].filter(Boolean).join(" - ") ||
      "Destino nï¿½o informado",
    status: order.status,
    statusLabel: formatShippingStatusLabel(order.status),
    depositanteId: order.depositante_id,
    depositante: extractRelationName(order.depositante) ?? "Sem depositante",
    totalItems: Number(order.quantidade_itens ?? items.length),
    totalUnits: Number(order.quantidade_unidades ?? totalRequested),
    assignedOperatorId: conference.operatorId,
    assignedOperatorName: conference.operatorName,
    startedAt: conference.startedAt,
    updatedAt: conference.updatedAt,
    finishedAt: conference.finishedAt,
    completionPercent:
      totalRequested > 0 ? Math.min(100, Math.round((totalConfirmed / totalRequested) * 100)) : 0,
    pendingUnits,
    wrongProductScans: conference.wrongProductScans,
    quantityDivergentItems,
    items,
  } satisfies ShippingConferenceOrder;
}

function mapConferenceItem(item: RawConferenceItemRow) {
  const payload = isRecord(item.payload_origem) ? item.payload_origem : {};
  const conference = isRecord(payload.conferencia) ? payload.conferencia : {};
  const requestedQuantity = Number(item.quantidade ?? 0);
  const confirmedQuantity = Number(readString(conference.quantidadeConferida) ?? 0);

  return {
    id: item.id,
    productId: item.produto_id,
    externalReference: item.referencia_externa?.trim() || "-",
    code: item.codigo_produto?.trim() || "-",
    sku: item.sku?.trim() || "-",
    barcode: item.produto?.codigo_externo?.trim() || "-",
    name: item.nome,
    unit: item.unidade?.trim() || "UN",
    requestedQuantity,
    separatedQuantity: Number(item.quantidade_separada ?? 0),
    confirmedQuantity,
    pendingQuantity: Math.max(requestedQuantity - confirmedQuantity, 0),
    hasQuantityDivergence: confirmedQuantity !== requestedQuantity,
  } satisfies ShippingConferenceItem;
}

function extractConferencePayload(payload: Record<string, unknown>): ConferencePayload {
  const conference = isRecord(payload.conferencia) ? payload.conferencia : null;

  return {
    operatorId: readString(conference?.operadorId),
    operatorName: readString(conference?.operadorNome),
    startedAt: readString(conference?.iniciadaEm),
    updatedAt: readString(conference?.atualizadaEm),
    finishedAt: readString(conference?.finalizadaEm),
    wrongProductScans: Number(readString(conference?.produtoErradoCount) ?? 0),
  };
}

function extractPlatformOrderNumber(
  payload: Record<string, unknown>,
  numeroPedido: string | null,
  numeroLoja: string | null,
  fallbackCode: string,
) {
  const mercadoLivre = isRecord(payload.mercadoLivre) ? payload.mercadoLivre : null;
  const manualCommercial = isRecord(payload.comercial) ? payload.comercial : null;
  const orderNumber = readString(numeroPedido);
  const storeNumber = readString(numeroLoja);
  const mercadoLivreOrderId = readString(mercadoLivre?.orderId);
  const salesChannelCode = readString(manualCommercial?.canal);

  if (salesChannelCode === "MERCADO_LIVRE" && storeNumber) {
    return storeNumber;
  }

  return mercadoLivreOrderId ?? orderNumber ?? storeNumber ?? fallbackCode;
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
