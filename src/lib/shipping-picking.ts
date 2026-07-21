import type { AppUserContext } from "@/lib/auth";
import { buildOperationalSlaMeta, type OperationalSlaTone } from "@/lib/operational-sla";
import {
  buildKitProgressMap,
  calculateKitOperationalTotals,
  isKitProduct,
  normalizePickingKitProgress,
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

type RawPickingOrderItemRow = {
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

type RawPickingOrderRow = {
  id: string;
  codigo: string;
  numero_wms: number | string | null;
  created_at: string;
  data_pedido: string | null;
  origem: string;
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
  itens?: RawPickingOrderItemRow[] | null;
};

type RawPickingStockRow = {
  id: string;
  depositante_id: string;
  produto_id: string;
  quantidade: number | string | null;
  quantidade_reservada: number | string | null;
  bloqueado: boolean;
  lote: string | null;
  validade_em: string | null;
  created_at: string;
  endereco: {
    codigo?: string | null;
    area?: string | null;
    rua?: string | null;
    modulo?: string | null;
    nivel?: string | null;
    posicao?: string | null;
  } | null;
  produto:
    | {
        sku?: string | null;
        nome?: string | null;
        codigo_interno?: string | null;
        codigo_externo?: string | null;
        metodo_retirada?: string | null;
      }
    | null;
};

type RawOperatorRow = {
  id: string;
  nome: string;
  papel: AppUserContext["papel"];
  depositante_id: string | null;
  ativo: boolean;
};

type PickingPayload = {
  operatorId: string | null;
  operatorName: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  returnReason: string | null;
};

export type PickingOperatorOption = {
  id: string;
  name: string;
  role: AppUserContext["papel"];
  depositanteId: string | null;
};

export type ShippingPickingRouteLine = {
  stockId: string;
  productId: string;
  imageUrl: string | null;
  componentSku: string;
  componentName: string;
  componentBarcode: string;
  addressCode: string;
  area: string;
  routeLabel: string;
  lot: string;
  expiry: string;
  quantity: number;
  available: number;
};

export type ShippingPickingKitComponent = {
  componentProductId: string;
  sku: string;
  name: string;
  barcode: string;
  quantityPerKit: number;
  requestedQuantity: number;
  separatedQuantity: number;
  remainingQuantity: number;
};

export type ShippingPickingItem = {
  id: string;
  productId: string | null;
  imageUrl: string | null;
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
  remainingQuantity: number;
  shortageQuantity: number;
  kitComponents: ShippingPickingKitComponent[];
  scanTargets: string[];
  routeLines: ShippingPickingRouteLine[];
};

export type ShippingPickingRouteStop = {
  key: string;
  area: string;
  addressCode: string;
  routeLabel: string;
  totalQuantity: number;
  lines: Array<{
    itemId: string;
    sku: string;
    name: string;
    barcode: string;
    quantity: number;
    unit: string;
    lot: string;
    expiry: string;
  }>;
};

export type ShippingPickingOrder = {
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
  shortageUnits: number;
  routeStopCount: number;
  items: ShippingPickingItem[];
  routeStops: ShippingPickingRouteStop[];
};

export type ShippingPickingFilters = {
  status?: string;
  depositanteId?: string;
  operatorId?: string;
};

type ShippingPickingQueryOptions = {
  includeRouteData?: boolean;
};

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const activePickingStatuses = [
  "NOVO",
  "EM_SEPARACAO",
  "SEPARADO",
  "EM_CONFERENCIA",
  "CONFERIDO",
  "PRONTO_ROMANEIO",
] as const;

export async function listPickingOperatorsFromDb(
  user: AppUserContext,
  depositanteId?: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, papel, depositante_id, ativo")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    throw new Error(`Não foi possível listar os operadores: ${error.message}`);
  }

  return ((data ?? []) as RawOperatorRow[])
    .filter((item) => ["ADMIN", "TI", "OPERADOR"].includes(item.papel))
    .filter((item) => {
      if (user.papel === "DEPOSITANTE" && user.depositanteId) {
        return !item.depositante_id || item.depositante_id === user.depositanteId;
      }

      if (depositanteId) {
        return !item.depositante_id || item.depositante_id === depositanteId;
      }

      return true;
    })
    .map(
      (item) =>
        ({
          id: item.id,
          name: item.nome,
          role: item.papel,
          depositanteId: item.depositante_id,
        }) satisfies PickingOperatorOption,
    );
}

export async function listShippingPickingOrdersFromDb(
  user: AppUserContext,
  filters?: ShippingPickingFilters,
  options?: ShippingPickingQueryOptions,
) {
  const supabase = createSupabaseAdminClient();
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : filters?.depositanteId;
  const includeRouteData = options?.includeRouteData ?? false;

  let ordersQuery = buildPickingOrdersQuery(supabase)
    .in("status", [...activePickingStatuses])
    .order("created_at", { ascending: true });

  if (filters?.status) {
    ordersQuery = ordersQuery.eq("status", filters.status);
  }

  if (effectiveDepositanteId) {
    ordersQuery = ordersQuery.eq("depositante_id", effectiveDepositanteId);
  }

  const { data: ordersData, error: ordersError } = await ordersQuery;

  if (ordersError) {
    throw new Error(`Não foi possível listar os pedidos de separação: ${ordersError.message}`);
  }

  const rawOrders = ((ordersData ?? []) as RawPickingOrderRow[]).filter(
    (order) => !isBlingWebhookSummaryOrder(order.observacoes),
  );
  const stockRows = includeRouteData ? await loadPickingStockRows(supabase, rawOrders) : [];
  const productImageMap = await loadProductImageMap(supabase, rawOrders, stockRows);
  const commercialKitRulesByDepositante = await loadCommercialKitRulesByDepositante(supabase, rawOrders);

  const orders = rawOrders
    .map((order) =>
      mapPickingOrder(
        order,
        stockRows,
        includeRouteData,
        productImageMap,
        resolveCommercialKitRulesForOrder(
          order.depositante_id,
          commercialKitRulesByDepositante,
        ),
      ),
    )
    .filter((order) => {
      if (!filters?.operatorId) {
        return true;
      }

      return order.assignedOperatorId === filters.operatorId;
    });

  return orders;
}

export async function listShippingPickingOrdersByIdsFromDb(
  user: AppUserContext,
  ids: string[],
  options?: ShippingPickingQueryOptions,
): Promise<ShippingPickingOrder[]> {
  const normalizedIds = Array.from(new Set(ids.map((item) => item.trim()).filter(Boolean)));

  if (!normalizedIds.length) {
    return [] as ShippingPickingOrder[];
  }

  const supabase = createSupabaseAdminClient();
  const includeRouteData = options?.includeRouteData ?? true;
  let query = buildPickingOrdersQuery(supabase).in("id", normalizedIds);

  if (user.papel === "DEPOSITANTE" && user.depositanteId) {
    query = query.eq("depositante_id", user.depositanteId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("N?o foi poss?vel carregar os pedidos selecionados: " + error.message);
  }

  const rawOrders = ((data ?? []) as RawPickingOrderRow[])
    .filter((order) => !isBlingWebhookSummaryOrder(order.observacoes));
  const stockRows = includeRouteData ? await loadPickingStockRows(supabase, rawOrders) : [];
  const productImageMap = await loadProductImageMap(supabase, rawOrders, stockRows);
  const commercialKitRulesByDepositante = await loadCommercialKitRulesByDepositante(supabase, rawOrders);
  const orderMap = new Map(
    rawOrders.map((order) => [
      order.id,
      mapPickingOrder(
        order,
        stockRows,
        includeRouteData,
        productImageMap,
        resolveCommercialKitRulesForOrder(
          order.depositante_id,
          commercialKitRulesByDepositante,
        ),
      ),
    ]),
  );

  return normalizedIds.reduce<ShippingPickingOrder[]>((accumulator, id) => {
    const order = orderMap.get(id);
    if (order) {
      accumulator.push(order);
    }
    return accumulator;
  }, []);
}
export async function getShippingPickingOrderFromDb(user: AppUserContext, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await buildPickingOrdersQuery(supabase).eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar o pedido de separação: ${error.message}`);
  }

  const rawOrder = (data as RawPickingOrderRow | null) ?? null;
  if (!rawOrder) {
    return null;
  }

  if (
    user.papel === "DEPOSITANTE" &&
    user.depositanteId &&
    rawOrder.depositante_id !== user.depositanteId
  ) {
    return null;
  }

  const stockRows = await loadPickingStockRows(supabase, [rawOrder]);
  const productImageMap = await loadProductImageMap(supabase, [rawOrder], stockRows);
  const commercialKitRulesByDepositante = await loadCommercialKitRulesByDepositante(supabase, [rawOrder]);
  return mapPickingOrder(
    rawOrder,
    stockRows,
    true,
    productImageMap,
    resolveCommercialKitRulesForOrder(
      rawOrder.depositante_id,
      commercialKitRulesByDepositante,
    ),
  );
}

function mapPickingOrder(
  order: RawPickingOrderRow,
  stockRows: RawPickingStockRow[],
  includeRouteData: boolean,
  productImageMap: Map<string, string>,
  commercialKitRules: CommercialKitRuleDefinition[],
) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const picking = extractPickingPayload(payload);
  const effectiveStatus =
    order.status === "EM_SEPARACAO" &&
    !picking.operatorId &&
    !picking.operatorName &&
    !picking.startedAt &&
    !picking.finishedAt &&
    (Boolean(picking.cancelledAt) || Boolean(picking.returnReason))
      ? "NOVO"
      : order.status;
  const payloadContact = readRecord(payload.contato);
  const payloadCity = readString(payloadContact?.cidade);
  const payloadState = readString(payloadContact?.uf);
  const rawItems =
    order.itens && order.itens.length > 0
      ? order.itens
      : buildFallbackPickingItemsFromPayload(payload, order.id, order.depositante_id);
  const items = rawItems.map((item) =>
    mapPickingItem(
      order.depositante_id,
      item,
      stockRows,
      includeRouteData,
      productImageMap,
      commercialKitRules,
    ),
  );
  const routeStops = includeRouteData ? buildRouteStops(items) : [];
  const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
  const totalSeparated = items.reduce((sum, item) => sum + item.separatedQuantity, 0);
  const shortageUnits = items.reduce((sum, item) => sum + item.shortageQuantity, 0);
  const ageMeta = buildOperationalSlaMeta(order.data_pedido ?? order.created_at);

  return {
    id: order.id,
    code: order.codigo,
    internalNumber: normalizeInternalOrderNumber(order.numero_wms),
    displayNumber: formatWmsOrderNumber(order.numero_wms, order.codigo),
    createdAtIso: ageMeta.createdAtIso,
    createdAt: ageMeta.createdAtLabel,
    ageLabel: ageMeta.ageLabel,
    ageTone: ageMeta.tone,
    externalNumber: extractPlatformOrderNumber(
      payload,
      order.numero_pedido,
      order.numero_loja,
      order.codigo,
    ),
    marketplace: extractMarketplace(payload),
    customer: order.cliente_nome?.trim() || readString(payloadContact?.nome) || "Cliente n?o informado",
    destination:
      [order.cliente_cidade?.trim(), order.cliente_uf?.trim(), payloadCity, payloadState]
        .filter(Boolean)
        .slice(0, 2)
        .join(" - ") || "Destino n?o informado",
    status: effectiveStatus,
    statusLabel: formatShippingStatusLabel(effectiveStatus),
    depositanteId: order.depositante_id,
    depositante: extractRelationName(order.depositante) ?? "Sem depositante",
    totalItems: Number(order.quantidade_itens ?? items.length) || items.length,
    totalUnits: totalRequested,
    assignedOperatorId: picking.operatorId,
    assignedOperatorName: picking.operatorName,
    startedAt: picking.startedAt,
    updatedAt: picking.updatedAt,
    finishedAt: picking.finishedAt,
    completionPercent:
      totalRequested > 0 ? Math.min(100, Math.round((totalSeparated / totalRequested) * 100)) : 0,
    shortageUnits,
    routeStopCount: routeStops.length,
    items,
    routeStops,
  } satisfies ShippingPickingOrder;
}

function buildFallbackPickingItemsFromPayload(
  payload: Record<string, unknown>,
  orderId: string,
  depositanteId: string,
): RawPickingOrderItemRow[] {
  const payloadItems = readArray(payload.itens);
  const fallbackItems: RawPickingOrderItemRow[] = [];

  payloadItems.forEach((entry, index) => {
    const row = readRecord(entry);
    if (!row) {
      return;
    }

    const quantity = Number(row.quantidade ?? 0);
    const name = readString(row.descricao) ?? readString(row.nome);

    if (!name || quantity <= 0) {
      return;
    }

    fallbackItems.push({
      id: `${orderId}-payload-${index + 1}`,
      produto_id: null,
      referencia_externa:
        readString(row.id) ?? readString(row.codigo) ?? `${orderId}-${index + 1}`,
      codigo_produto: readString(row.codigo),
      sku: readString(row.codigo),
      nome: name,
      unidade: readString(row.unidade) ?? "UN",
      quantidade: quantity,
      quantidade_separada: 0,
      payload_origem: {
        itemId: readString(row.id),
        source: "payload_fallback",
        pedidoId: orderId,
        depositanteId,
      },
      produto: {
        codigo_externo: readString(row.gtin) ?? readString(row.ean),
      },
    });
  });

  return fallbackItems;
}
function mapPickingItem(
  depositanteId: string,
  item: RawPickingOrderItemRow,
  stockRows: RawPickingStockRow[],
  includeRouteData: boolean,
  productImageMap: Map<string, string>,
  commercialKitRules: CommercialKitRuleDefinition[],
) {
  const hydratedItem = hydratePickingItemWithCommercialKit(item, commercialKitRules);
  const requestedKits = Number(item.quantidade ?? 0);
  const itemCode = hydratedItem.codigo_produto?.trim() || "-";
  const itemSku = hydratedItem.sku?.trim() || "-";
  const itemBarcode = hydratedItem.produto?.codigo_externo?.trim() || "-";
  const componentDefinitions = normalizeKitComponentDefinitions(hydratedItem.payload_origem);
  const isKit = isKitProduct(
    isPayloadKit(hydratedItem.payload_origem) ? "KIT" : "SIMPLES",
    componentDefinitions,
  );

  if (!isKit) {
    return mapSimplePickingItem(depositanteId, hydratedItem, stockRows, includeRouteData, productImageMap, {
      requestedKits,
      itemCode,
      itemSku,
      itemBarcode,
    });
  }

  const progressMap = buildKitProgressMap(normalizePickingKitProgress(hydratedItem.payload_origem));
  const routeLines: ShippingPickingRouteLine[] = [];
  const kitComponents: ShippingPickingKitComponent[] = [];
  let shortageQuantity = 0;

  for (const component of componentDefinitions) {
    const requestedQuantity = requestedKits * component.quantityPerKit;
    const separatedQuantity = Math.min(progressMap.get(component.componentProductId) ?? 0, requestedQuantity);
    const matchedStocks = includeRouteData
        ? stockRows
          .filter((row) => matchesStockToKitComponent(row, component))
          .filter((row) => getAvailableQuantity(row) > 0)
          .sort(compareStocksForPicking)
      : [];

    let remaining = Math.max(requestedQuantity - separatedQuantity, 0);

    for (const stock of matchedStocks) {
      if (remaining <= 0) {
        break;
      }

      const available = getAvailableQuantity(stock);
      const quantity = Math.min(remaining, available);
      if (quantity <= 0) {
        continue;
      }

      remaining -= quantity;
      routeLines.push({
        stockId: stock.id,
        productId: stock.produto_id,
        imageUrl: resolveProductImageUrl(productImageMap, stock.produto_id),
        componentSku: component.sku,
        componentName: component.name,
        componentBarcode: component.barcode,
        addressCode: stock.endereco?.codigo?.trim() || "Sem endereço",
        area: normalizeÁrea(stock.endereco?.area),
        routeLabel: buildRouteLabel(stock.endereco),
        lot: stock.lote?.trim() || "-",
        expiry: formatDate(stock.validade_em),
        quantity,
        available,
      });
    }

    shortageQuantity += remaining;
    kitComponents.push({
      componentProductId: component.componentProductId,
      sku: component.sku,
      name: component.name,
      barcode: component.barcode,
      quantityPerKit: component.quantityPerKit,
      requestedQuantity,
      separatedQuantity,
      remainingQuantity: Math.max(requestedQuantity - separatedQuantity, 0),
    });
  }

  const totals = calculateKitOperationalTotals(componentDefinitions, requestedKits, progressMap);
  const primaryImageUrl =
    resolveProductImageUrl(productImageMap, hydratedItem.produto_id) ??
    routeLines.find((line) => Boolean(line.imageUrl))?.imageUrl ??
    null;

  return {
    id: hydratedItem.id,
    productId: hydratedItem.produto_id,
    imageUrl: primaryImageUrl,
    externalReference: hydratedItem.referencia_externa?.trim() || "-",
    code: itemCode,
    sku: itemSku,
    barcode: itemBarcode,
    name: hydratedItem.nome,
    unit: hydratedItem.unidade?.trim() || "UN",
    isKit: true,
    requestedKits,
    requestedQuantity: totals.operationalRequestedQuantity,
    separatedQuantity: totals.operationalSeparatedQuantity,
    remainingQuantity: Math.max(
      totals.operationalRequestedQuantity - totals.operationalSeparatedQuantity,
      0,
    ),
    shortageQuantity,
    kitComponents,
    scanTargets: [...new Set([
      itemBarcode,
      itemCode,
      itemSku,
      ...kitComponents.flatMap((component) => [component.barcode, component.sku]),
    ].filter(Boolean))],
    routeLines,
  } satisfies ShippingPickingItem;
}

function mapSimplePickingItem(
  depositanteId: string,
  item: RawPickingOrderItemRow,
  stockRows: RawPickingStockRow[],
  includeRouteData: boolean,
  productImageMap: Map<string, string>,
  meta: {
    requestedKits: number;
    itemCode: string;
    itemSku: string;
    itemBarcode: string;
  },
) {
  const requestedQuantity = meta.requestedKits;
  const separatedQuantity = Number(item.quantidade_separada ?? 0);
  const matchedStocks = includeRouteData
    ? stockRows
        .filter((row) => row.depositante_id === depositanteId)
        .filter((row) => matchesStockToItem(row, item))
        .filter((row) => getAvailableQuantity(row) > 0)
        .sort(compareStocksForPicking)
    : [];

  let remaining = Math.max(requestedQuantity - separatedQuantity, 0);
  const routeLines: ShippingPickingRouteLine[] = [];

  for (const stock of matchedStocks) {
    if (remaining <= 0) {
      break;
    }

    const available = getAvailableQuantity(stock);
    const quantity = Math.min(remaining, available);
    if (quantity <= 0) {
      continue;
    }

    remaining -= quantity;
    routeLines.push({
      stockId: stock.id,
      productId: stock.produto_id,
      imageUrl: resolveProductImageUrl(productImageMap, stock.produto_id),
      componentSku: stock.produto?.sku?.trim() || meta.itemSku,
      componentName: stock.produto?.nome?.trim() || item.nome,
      componentBarcode: meta.itemBarcode,
      addressCode: stock.endereco?.codigo?.trim() || "Sem endereço",
      area: normalizeÁrea(stock.endereco?.area),
      routeLabel: buildRouteLabel(stock.endereco),
      lot: stock.lote?.trim() || "-",
      expiry: formatDate(stock.validade_em),
      quantity,
      available,
    });
  }

  return {
    id: item.id,
    productId: item.produto_id,
    imageUrl:
      resolveProductImageUrl(productImageMap, item.produto_id) ??
      routeLines.find((line) => Boolean(line.imageUrl))?.imageUrl ??
      null,
    externalReference: item.referencia_externa?.trim() || "-",
    code: meta.itemCode,
    sku: meta.itemSku,
    barcode: meta.itemBarcode,
    name: item.nome,
    unit: item.unidade?.trim() || "UN",
    isKit: false,
    requestedKits: meta.requestedKits,
    requestedQuantity,
    separatedQuantity,
    remainingQuantity: Math.max(requestedQuantity - separatedQuantity, 0),
    shortageQuantity: remaining,
    kitComponents: [],
    scanTargets: [meta.itemBarcode, meta.itemCode, meta.itemSku].filter(Boolean),
    routeLines,
  } satisfies ShippingPickingItem;
}

function buildPickingOrdersQuery(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  return supabase.from("pedidos_expedicao").select(
    "id, codigo, numero_wms, created_at, data_pedido, origem, status, numero_pedido, numero_loja, cliente_nome, cliente_cidade, cliente_uf, quantidade_itens, quantidade_unidades, observacoes, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, produto_id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada, payload_origem, produto:produtos(codigo_externo))",
  );
}

function isBlingWebhookSummaryOrder(observacoes: string | null | undefined) {
  return observacoes?.trim() === "Pedido resumido criado a partir do webhook do Bling.";
}

async function loadPickingStockRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orders: RawPickingOrderRow[],
) {
  const depositanteIds = [...new Set(orders.map((item) => item.depositante_id).filter(Boolean))];
  const hasPayloadKitWithoutRealProduct = orders.some((order) =>
    (order.itens ?? []).some((item) =>
      normalizeKitComponentDefinitions(item.payload_origem).some(
        (component) => !looksLikeUuid(component.componentProductId),
      ),
    ),
  );
  const productIds = [
    ...new Set(
      orders.flatMap((order) =>
        (order.itens ?? []).flatMap((item) => {
          const componentIds = normalizeKitComponentDefinitions(item.payload_origem)
            .filter((component) => looksLikeUuid(component.componentProductId))
            .map(
            (component) => component.componentProductId,
          );

          return [item.produto_id, ...componentIds].filter((value): value is string => Boolean(value));
        }),
      ),
    ),
  ];

  if (!depositanteIds.length) {
    return [] as RawPickingStockRow[];
  }

  let stockQuery = supabase
    .from("estoque")
    .select(
      "id, depositante_id, produto_id, quantidade, quantidade_reservada, bloqueado, lote, validade_em, created_at, endereco:enderecos(codigo, area, rua, modulo, nivel, posicao), produto:produtos(sku, nome, codigo_interno, codigo_externo, metodo_retirada)",
    )
    .eq("bloqueado", false);

  if (productIds.length && !hasPayloadKitWithoutRealProduct) {
    stockQuery = stockQuery.in("produto_id", productIds);
  } else {
    stockQuery = stockQuery.in("depositante_id", depositanteIds);
  }

  const { data: stockData, error: stockError } = await stockQuery;

  if (stockError) {
    throw new Error(`Não foi possível montar a rota de picking: ${stockError.message}`);
  }

  return (stockData ?? []) as RawPickingStockRow[];
}

async function loadProductImageMap(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orders: RawPickingOrderRow[],
  stockRows: RawPickingStockRow[],
) {
  const productIds = [
    ...new Set(
      [
        ...orders.flatMap((order) => (order.itens ?? []).map((item) => item.produto_id)),
        ...stockRows.map((row) => row.produto_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];

  if (!productIds.length) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("produtos")
    .select("id, imagem_principal_url")
    .in("id", productIds);

  if (error) {
    return new Map<string, string>();
  }

  return new Map(
    (data ?? [])
      .filter((item) => typeof item.imagem_principal_url === "string" && item.imagem_principal_url.trim())
      .map((item) => [item.id, item.imagem_principal_url as string]),
  );
}

async function loadCommercialKitRulesByDepositante(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orders: RawPickingOrderRow[],
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
    throw new Error(`Não foi possível carregar as regras comerciais de kit para separação: ${error.message}`);
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

function hydratePickingItemWithCommercialKit(
  item: RawPickingOrderItemRow,
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
    sku: item.sku?.trim() || resolvedMatch.matchedProduct?.sku || resolvedMatch.matchedProduct?.codigo_interno || item.sku,
    payload_origem: resolvedMatch.payload,
    produto: {
      codigo_externo:
        item.produto?.codigo_externo?.trim() ||
        resolvedMatch.matchedProduct?.codigo_externo ||
        null,
    },
  } satisfies RawPickingOrderItemRow;
}

function buildRouteStops(items: ShippingPickingItem[]) {
  const grouped = new Map<string, ShippingPickingRouteStop>();

  for (const item of items) {
    for (const line of item.routeLines) {
      const key = `${line.area}::${line.addressCode}`;
      const current =
        grouped.get(key) ??
        ({
          key,
          area: line.area,
          addressCode: line.addressCode,
          routeLabel: line.routeLabel,
          totalQuantity: 0,
          lines: [],
        } satisfies ShippingPickingRouteStop);

      current.totalQuantity += line.quantity;
      current.lines.push({
        itemId: item.id,
        sku: line.componentSku,
        name: line.componentName,
        barcode: line.componentBarcode,
        quantity: line.quantity,
        unit: item.unit,
        lot: line.lot,
        expiry: line.expiry,
      });

      grouped.set(key, current);
    }
  }

  return [...grouped.values()].sort(compareRouteStops);
}

function extractPickingPayload(payload: Record<string, unknown>): PickingPayload {
  const picking = isRecord(payload.separacao) ? payload.separacao : null;

  return {
    operatorId: readString(picking?.operadorId),
    operatorName: readString(picking?.operadorNome),
    startedAt: readString(picking?.iniciadaEm),
    updatedAt: readString(picking?.atualizadaEm),
    finishedAt: readString(picking?.finalizadaEm),
    cancelledAt: readString(picking?.canceladaEm),
    returnReason: readString(picking?.motivoRetornoFila),
  };
}

function matchesStockToItem(stock: RawPickingStockRow, item: RawPickingOrderItemRow) {
  if (item.produto_id && stock.produto_id === item.produto_id) {
    return true;
  }

  const itemCandidates = [item.sku, item.codigo_produto].map(normalizeText).filter(Boolean);
  const stockCandidates = [stock.produto?.sku, stock.produto?.codigo_interno, stock.produto?.codigo_externo]
    .map(normalizeText)
    .filter(Boolean);

  return itemCandidates.some((candidate) => stockCandidates.includes(candidate));
}

function matchesStockToKitComponent(
  stock: RawPickingStockRow,
  component: ProductKitComponentDefinition,
) {
  if (component.componentProductId && looksLikeUuid(component.componentProductId)) {
    if (stock.produto_id === component.componentProductId) {
      return true;
    }
  }

  const componentCandidates = [
    component.sku,
    component.internalCode,
    component.barcode,
  ]
    .map(normalizeText)
    .filter(Boolean);
  const stockCandidates = [
    stock.produto?.sku,
    stock.produto?.codigo_interno,
    stock.produto?.codigo_externo,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return componentCandidates.some((candidate) => stockCandidates.includes(candidate));
}

function compareStocksForPicking(a: RawPickingStockRow, b: RawPickingStockRow) {
  const areaDiff = getÁreaPriority(a.endereco?.area) - getÁreaPriority(b.endereco?.area);
  if (areaDiff !== 0) {
    return areaDiff;
  }

  const methodA = normalizeWithdrawalMethod(a.produto?.metodo_retirada);
  const methodB = normalizeWithdrawalMethod(b.produto?.metodo_retirada);

  if (methodA === "FEFO" && methodB === "FEFO") {
    const expiryDiff = compareNullableDates(a.validade_em, b.validade_em);
    if (expiryDiff !== 0) {
      return expiryDiff;
    }
  }

  if (methodA === "FIFO" && methodB === "FIFO") {
    const fifoDiff = compareNullableDates(a.created_at, b.created_at);
    if (fifoDiff !== 0) {
      return fifoDiff;
    }
  }

  if (methodA === "LIFO" && methodB === "LIFO") {
    const lifoDiff = compareNullableDates(b.created_at, a.created_at);
    if (lifoDiff !== 0) {
      return lifoDiff;
    }
  }

  return compareEndereco(a.endereco, b.endereco);
}

function compareRouteStops(a: ShippingPickingRouteStop, b: ShippingPickingRouteStop) {
  const areaDiff = getÁreaPriority(a.area) - getÁreaPriority(b.area);
  if (areaDiff !== 0) {
    return areaDiff;
  }

  return compareEnderecoLabel(a.routeLabel, b.routeLabel, a.addressCode, b.addressCode);
}

function compareEndereco(
  a:
    | {
        codigo?: string | null;
        rua?: string | null;
        modulo?: string | null;
        nivel?: string | null;
        posicao?: string | null;
      }
    | null
    | undefined,
  b:
    | {
        codigo?: string | null;
        rua?: string | null;
        modulo?: string | null;
        nivel?: string | null;
        posicao?: string | null;
      }
    | null
    | undefined,
) {
  const valuesA = [a?.rua, a?.modulo, a?.nivel, a?.posicao, a?.codigo].map((item) => item?.trim() || "");
  const valuesB = [b?.rua, b?.modulo, b?.nivel, b?.posicao, b?.codigo].map((item) => item?.trim() || "");

  for (let index = 0; index < valuesA.length; index += 1) {
    const diff = collator.compare(valuesA[index], valuesB[index]);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function compareEnderecoLabel(labelA: string, labelB: string, codeA: string, codeB: string) {
  const diff = collator.compare(labelA, labelB);
  if (diff !== 0) {
    return diff;
  }

  return collator.compare(codeA, codeB);
}

function getAvailableQuantity(stock: RawPickingStockRow) {
  return Math.max(Number(stock.quantidade ?? 0) - Number(stock.quantidade_reservada ?? 0), 0);
}

function getÁreaPriority(area: string | null | undefined) {
  switch (normalizeÁrea(area)) {
    case "PICKING":
      return 0;
    case "EXPEDICAO":
      return 1;
    case "ARMAZENAGEM":
      return 2;
    case "PULMAO":
      return 2;
    case "RECEBIMENTO":
      return 3;
    default:
      return 9;
  }
}

function normalizeWithdrawalMethod(value: string | null | undefined) {
  if (value === "LIFO") {
    return "LIFO";
  }

  if (value === "FEFO") {
    return "FEFO";
  }

  return "FIFO";
}

function normalizeÁrea(area: string | null | undefined) {
  return area?.trim().toUpperCase() || "SEM_AREA";
}

function buildRouteLabel(
  endereco:
    | {
        rua?: string | null;
        modulo?: string | null;
        nivel?: string | null;
        posicao?: string | null;
      }
    | null
    | undefined,
) {
  const parts = [
    endereco?.rua ? `Rua ${endereco.rua}` : null,
    endereco?.modulo ? `Módulo ${endereco.modulo}` : null,
    endereco?.nivel ? `Nível ${endereco.nivel}` : null,
    endereco?.posicao ? `Posição ${endereco.posicao}` : null,
  ].filter(Boolean);

  return parts.join(" • ") || "Sequência não informada";
}

function compareNullableDates(a: string | null | undefined, b: string | null | undefined) {
  if (!a && !b) {
    return 0;
  }

  if (!a) {
    return 1;
  }

  if (!b) {
    return -1;
  }

  const timeA = new Date(a).getTime();
  const timeB = new Date(b).getTime();

  if (Number.isNaN(timeA) && Number.isNaN(timeB)) {
    return 0;
  }

  if (Number.isNaN(timeA)) {
    return 1;
  }

  if (Number.isNaN(timeB)) {
    return -1;
  }

  return timeA - timeB;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("pt-BR");
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

function isPayloadKit(payload: Record<string, unknown> | null | undefined) {
  const source = readRecord(payload?.kit_operacional);
  return readArray(source?.componentes).length > 0;
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

function extractPlatformOrderNumber(
  payload: Record<string, unknown>,
  numeroPedido: string | null,
  numeroLoja: string | null,
  fallbackCode: string,
) {
  const mercadoLivre = isRecord(payload.mercadoLivre) ? payload.mercadoLivre : null;
  const orderNumber = readString(numeroPedido);
  const storeNumber = readString(numeroLoja);
  const mercadoLivreOrderId = readString(mercadoLivre?.orderId);
  return mercadoLivreOrderId ?? storeNumber ?? orderNumber ?? fallbackCode;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function normalizeInternalOrderNumber(value: number | string | null | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.trunc(numericValue) : null;
}

function resolveProductImageUrl(
  productImageMap: Map<string, string>,
  productId: string | null | undefined,
) {
  if (!productId) {
    return null;
  }

  return productImageMap.get(productId) ?? null;
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

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
