import type { AppUserContext } from "@/lib/auth";
import { buildOperationalSlaMeta, type OperationalSlaTone } from "@/lib/operational-sla";
import {
  buildKitProgressMap,
  calculateKitOperationalTotals,
  isKitProduct,
  normalizeConferenceKitProgress,
  type ProductKitComponentDefinition,
} from "@/lib/product-kits";
import {
  resolveCommercialKitMatch,
  type CommercialKitRuleDefinition,
} from "@/lib/commercial-kit-rules";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import { extractMarketplace, formatShippingStatusLabel } from "@/lib/shipping";
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
  numero_wms: number | string | null;
  created_at: string;
  status: string;
  numero_pedido: string | null;
  numero_loja: string | null;
  cliente_nome: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  quantidade_itens: number | null;
  quantidade_unidades: number | string | null;
  observacoes?: string | null;
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

export type ShippingConferenceKitComponent = {
  componentProductId: string;
  sku: string;
  name: string;
  barcode: string;
  quantityPerKit: number;
  requestedQuantity: number;
  confirmedQuantity: number;
  pendingQuantity: number;
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
  isKit: boolean;
  requestedKits: number;
  requestedQuantity: number;
  separatedQuantity: number;
  confirmedQuantity: number;
  pendingQuantity: number;
  hasQuantityDivergence: boolean;
  kitComponents: ShippingConferenceKitComponent[];
  scanTargets: string[];
};

export type ShippingConferenceOrder = {
  id: string;
  code: string;
  internalNumber: number | null;
  displayNumber: string;
  createdAtIso: string | null;
  createdAt: string;
  ageLabel: string;
  ageTone: OperationalSlaTone;
  externalNumber: string;
  marketplace: string;
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

  let query = buildConferenceOrdersQuery(supabase)
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
    throw new Error(`Não foi possível listar os pedidos em conferência: ${error.message}`);
  }

  const rawOrders = ((data ?? []) as RawConferenceOrderRow[]).filter(
    (order) => !isBlingWebhookSummaryOrder(order.observacoes),
  );
  const commercialKitRulesByDepositante = await loadCommercialKitRulesByDepositante(
    supabase,
    rawOrders,
  );
  const orders = rawOrders.map((order) =>
    mapConferenceOrder(
      order,
      resolveCommercialKitRulesForOrder(order.depositante_id, commercialKitRulesByDepositante),
    ),
  );

  return orders.filter((order) => {
    if (!filters?.operatorId) {
      return true;
    }

    return order.assignedOperatorId === filters.operatorId;
  });
}

export async function getShippingConferenceOrderFromDb(user: AppUserContext, id: string) {
  const supabase = createSupabaseAdminClient();
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined;

  let query = buildConferenceOrdersQuery(supabase).eq("id", id);

  if (effectiveDepositanteId) {
    query = query.eq("depositante_id", effectiveDepositanteId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Não foi possível carregar o pedido em conferência: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const rawOrder = data as RawConferenceOrderRow;
  const commercialKitRulesByDepositante = await loadCommercialKitRulesByDepositante(
    supabase,
    [rawOrder],
  );

  return mapConferenceOrder(
    rawOrder,
    resolveCommercialKitRulesForOrder(rawOrder.depositante_id, commercialKitRulesByDepositante),
  );
}

function buildConferenceOrdersQuery(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  return supabase.from("pedidos_expedicao").select(
    "id, codigo, numero_wms, created_at, status, numero_pedido, numero_loja, cliente_nome, cliente_cidade, cliente_uf, quantidade_itens, quantidade_unidades, observacoes, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, produto_id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada, payload_origem, produto:produtos(codigo_externo))",
  );
}

function isBlingWebhookSummaryOrder(observacoes: string | null | undefined) {
  return observacoes?.trim() === "Pedido resumido criado a partir do webhook do Bling.";
}

function mapConferenceOrder(
  order: RawConferenceOrderRow,
  commercialKitRules: CommercialKitRuleDefinition[],
) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const conference = extractConferencePayload(payload);
  const items = (order.itens ?? []).map((item) => mapConferenceItem(item, commercialKitRules));
  const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
  const totalConfirmed = items.reduce((sum, item) => sum + item.confirmedQuantity, 0);
  const pendingUnits = items.reduce((sum, item) => sum + item.pendingQuantity, 0);
  const quantityDivergentItems = items.filter((item) => item.hasQuantityDivergence).length;
  const ageMeta = buildOperationalSlaMeta(order.created_at);

  return {
    id: order.id,
    code: order.codigo,
    internalNumber: normalizeInternalOrderNumber(order.numero_wms),
    displayNumber: formatWmsOrderNumber(order.numero_wms, order.codigo),
    createdAtIso: ageMeta.createdAtIso,
    createdAt: ageMeta.createdAtLabel,
    ageLabel: ageMeta.ageLabel,
    ageTone: ageMeta.tone,
    externalNumber: extractPlatformOrderNumber(payload, order.numero_pedido, order.numero_loja, order.codigo),
    marketplace: extractMarketplace(payload),
    customer: order.cliente_nome?.trim() || "Cliente não informado",
    destination:
      [order.cliente_cidade?.trim(), order.cliente_uf?.trim()].filter(Boolean).join(" - ") ||
      "Destino não informado",
    status: order.status,
    statusLabel: formatShippingStatusLabel(order.status),
    depositanteId: order.depositante_id,
    depositante: extractRelationName(order.depositante) ?? "Sem depositante",
    totalItems: Number(order.quantidade_itens ?? items.length),
    totalUnits: totalRequested,
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

function mapConferenceItem(
  item: RawConferenceItemRow,
  commercialKitRules: CommercialKitRuleDefinition[],
) {
  const hydratedItem = hydrateConferenceItemWithCommercialKit(item, commercialKitRules);
  const payload: Record<string, unknown> = isRecord(hydratedItem.payload_origem)
    ? hydratedItem.payload_origem
    : {};
  const conferenceSource = payload["conferencia"];
  const conference = isRecord(conferenceSource) ? conferenceSource : {};
  const componentDefinitions = normalizeKitComponentDefinitions(hydratedItem.payload_origem);
  const isKit = isKitProduct(
    isPayloadKit(hydratedItem.payload_origem) ? "KIT" : "SIMPLES",
    componentDefinitions,
  );
  const requestedKits = Number(item.quantidade ?? 0);
  const itemCode = hydratedItem.codigo_produto?.trim() || "-";
  const itemSku = hydratedItem.sku?.trim() || "-";
  const itemBarcode = hydratedItem.produto?.codigo_externo?.trim() || "-";

  if (!isKit) {
    const requestedQuantity = requestedKits;
    const confirmedQuantity = Number(readString(conference.quantidadeConferida) ?? 0);

    return {
      id: hydratedItem.id,
      productId: hydratedItem.produto_id,
      externalReference: hydratedItem.referencia_externa?.trim() || "-",
      code: itemCode,
      sku: itemSku,
      barcode: itemBarcode,
      name: hydratedItem.nome,
      unit: hydratedItem.unidade?.trim() || "UN",
      isKit: false,
      requestedKits,
      requestedQuantity,
      separatedQuantity: Number(hydratedItem.quantidade_separada ?? 0),
      confirmedQuantity,
      pendingQuantity: Math.max(requestedQuantity - confirmedQuantity, 0),
      hasQuantityDivergence: confirmedQuantity !== requestedQuantity,
      kitComponents: [],
      scanTargets: [itemBarcode, itemCode, itemSku].filter(Boolean),
    } satisfies ShippingConferenceItem;
  }

  const progressMap = buildKitProgressMap(normalizeConferenceKitProgress(item.payload_origem));
  const totals = calculateKitOperationalTotals(componentDefinitions, requestedKits, progressMap);
  const kitComponents = componentDefinitions.map((component) => {
    const requestedQuantity = requestedKits * component.quantityPerKit;
    const confirmedQuantity = Math.min(progressMap.get(component.componentProductId) ?? 0, requestedQuantity);

    return {
      componentProductId: component.componentProductId,
      sku: component.sku,
      name: component.name,
      barcode: component.barcode,
      quantityPerKit: component.quantityPerKit,
      requestedQuantity,
      confirmedQuantity,
      pendingQuantity: Math.max(requestedQuantity - confirmedQuantity, 0),
    } satisfies ShippingConferenceKitComponent;
  });

  return {
    id: hydratedItem.id,
    productId: hydratedItem.produto_id,
    externalReference: hydratedItem.referencia_externa?.trim() || "-",
    code: itemCode,
    sku: itemSku,
    barcode: itemBarcode,
    name: hydratedItem.nome,
    unit: hydratedItem.unidade?.trim() || "UN",
    isKit: true,
    requestedKits,
    requestedQuantity: totals.operationalRequestedQuantity,
    separatedQuantity: totals.operationalRequestedQuantity,
    confirmedQuantity: totals.operationalSeparatedQuantity,
    pendingQuantity: Math.max(totals.operationalRequestedQuantity - totals.operationalSeparatedQuantity, 0),
    hasQuantityDivergence: totals.operationalSeparatedQuantity !== totals.operationalRequestedQuantity,
    kitComponents,
    scanTargets: [...new Set([
      itemBarcode,
      itemCode,
      itemSku,
      ...kitComponents.flatMap((component) => [component.barcode, component.sku]),
    ].filter(Boolean))],
  } satisfies ShippingConferenceItem;
}

function normalizeKitComponentDefinitions(payload: Record<string, unknown> | null | undefined) {
  const source = readRecord(payload?.kit_operacional);
  const components = readArray(source?.componentes);

  return components
    .map((entry, index) => {
      const row = readRecord(entry);
      const referenceId =
        readString(row?.produtoComponenteId) ??
        readString(row?.referenciaExterna) ??
        `KIT_COMPONENTE_${index + 1}`;
      const quantityPerKit = Number(row?.quantidadePorKit ?? row?.quantidade ?? 0);

      if (!referenceId || quantityPerKit <= 0) {
        return null;
      }

      return {
        componentProductId: referenceId,
        quantityPerKit,
        sku: readString(row?.sku) ?? readString(row?.codigoInterno) ?? referenceId,
        name: readString(row?.nome) ?? "Componente sem nome",
        internalCode: readString(row?.codigoInterno) ?? readString(row?.sku) ?? referenceId,
        barcode: readString(row?.barcode) ?? "-",
      } satisfies ProductKitComponentDefinition;
    })
    .filter((item): item is ProductKitComponentDefinition => Boolean(item));
}

async function loadCommercialKitRulesByDepositante(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orders: RawConferenceOrderRow[],
) {
  if (!orders.length) {
    return new Map<string, CommercialKitRuleDefinition[]>();
  }

  const { data, error } = await supabase
    .from("produto_kit_comercial_regras")
    .select(
      "id, depositante_id, produto_base_id, texto_gatilho, quantidade_operacional, ativo, produto:produtos!produto_kit_comercial_regras_produto_base_id_fkey(id, nome, sku, codigo_interno, codigo_externo)",
    )
    .eq("ativo", true);

  if (error) {
    throw new Error(
      `NÃ£o foi possÃ­vel carregar as regras comerciais de kit para conferÃªncia: ${error.message}`,
    );
  }

  const grouped = new Map<string, CommercialKitRuleDefinition[]>();

  for (const entry of ((data ?? []) as Array<{
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
      | {
          id: string;
          nome: string;
          sku: string | null;
          codigo_interno: string | null;
          codigo_externo: string | null;
        }
      | null;
  }>)) {
    const produto = Array.isArray(entry.produto) ? (entry.produto[0] ?? null) : entry.produto;
    if (!produto) {
      continue;
    }

    const rule = {
      id: entry.id,
      depositanteId: entry.depositante_id,
      productId: entry.produto_base_id,
      productName: produto.nome ?? "",
      productSku: produto.sku ?? null,
      productInternalCode: produto.codigo_interno ?? null,
      productBarcode: produto.codigo_externo ?? null,
      matchText: entry.texto_gatilho,
      operationalQuantity: Number(entry.quantidade_operacional ?? 0),
      active: entry.ativo,
    } satisfies CommercialKitRuleDefinition;

    const current = grouped.get(entry.depositante_id) ?? [];
    current.push(rule);
    grouped.set(entry.depositante_id, current);
  }

  return grouped;
}

function resolveCommercialKitRulesForOrder(
  orderDepositanteId: string,
  groupedRules: Map<string, CommercialKitRuleDefinition[]>,
) {
  const preferredRules = groupedRules.get(orderDepositanteId) ?? [];
  const fallbackRules = [...groupedRules.entries()]
    .filter(([depositanteId]) => depositanteId !== orderDepositanteId)
    .flatMap(([, rules]) => rules);

  return [...preferredRules, ...fallbackRules];
}

function hydrateConferenceItemWithCommercialKit(
  item: RawConferenceItemRow,
  commercialKitRules: CommercialKitRuleDefinition[],
) {
  const currentPayload = isRecord(item.payload_origem) ? item.payload_origem : {};
  const resolvedMatch = resolveCommercialKitMatch({
    itemCode: item.codigo_produto,
    itemDescription: item.nome,
    existingPayload: currentPayload,
    matchedProductByCode: null,
    rules: commercialKitRules,
  });

  if (!resolvedMatch.usesCommercialKitRule) {
    return item;
  }

  return {
    ...item,
    produto_id: item.produto_id ?? resolvedMatch.matchedProduct?.id ?? null,
    sku:
      item.sku?.trim() ||
      resolvedMatch.matchedProduct?.sku ||
      resolvedMatch.matchedProduct?.codigo_interno ||
      item.sku,
    payload_origem: resolvedMatch.payload,
    produto: {
      codigo_externo:
        item.produto?.codigo_externo?.trim() ||
        resolvedMatch.matchedProduct?.codigo_externo ||
        null,
    },
  } satisfies RawConferenceItemRow;
}

function normalizeInternalOrderNumber(value: number | string | null | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.trunc(numericValue) : null;
}

function isPayloadKit(payload: Record<string, unknown> | null | undefined) {
  const source = readRecord(payload?.kit_operacional);
  return readArray(source?.componentes).length > 0;
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

function readRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}
