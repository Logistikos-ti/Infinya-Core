import type { AppUserContext } from "@/lib/auth";
import { buildOperationalSlaMeta, type OperationalSlaTone } from "@/lib/operational-sla";
import { formatShippingStatusLabel } from "@/lib/shipping";
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
  produto?: {
    codigo_externo?: string | null;
  } | null;
};

type RawPickingOrderRow = {
  id: string;
  codigo: string;
  created_at: string;
  origem: string;
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
};

export type PickingOperatorOption = {
  id: string;
  name: string;
  role: AppUserContext["papel"];
  depositanteId: string | null;
};

export type ShippingPickingRouteLine = {
  stockId: string;
  addressCode: string;
  area: string;
  routeLabel: string;
  lot: string;
  expiry: string;
  quantity: number;
  available: number;
};

export type ShippingPickingItem = {
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
  remainingQuantity: number;
  shortageQuantity: number;
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
    quantity: number;
    unit: string;
    lot: string;
    expiry: string;
  }>;
};

export type ShippingPickingOrder = {
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
    throw new Error(`Nï¿½o foi possï¿½vel listar os operadores: ${error.message}`);
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
    throw new Error(`Nï¿½o foi possï¿½vel listar os pedidos de separaï¿½ï¿½o: ${ordersError.message}`);
  }

  const rawOrders = (ordersData ?? []) as RawPickingOrderRow[];
  const stockRows = includeRouteData ? await loadPickingStockRows(supabase, rawOrders) : [];

  const stockByDepositante = new Map<string, RawPickingStockRow[]>();
  for (const row of stockRows) {
    const current = stockByDepositante.get(row.depositante_id) ?? [];
    current.push(row);
    stockByDepositante.set(row.depositante_id, current);
  }

  const orders = rawOrders
    .map((order) =>
      mapPickingOrder(order, stockByDepositante.get(order.depositante_id) ?? [], includeRouteData),
    )
    .filter((order) => {
      if (!filters?.operatorId) {
        return true;
      }

      return order.assignedOperatorId === filters.operatorId;
    });

  return orders;
}

export async function getShippingPickingOrderFromDb(user: AppUserContext, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await buildPickingOrdersQuery(supabase).eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`N?o foi poss?vel carregar o pedido de separa??o: ${error.message}`);
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
  return mapPickingOrder(rawOrder, stockRows, true);
}

function mapPickingOrder(
  order: RawPickingOrderRow,
  stockRows: RawPickingStockRow[],
  includeRouteData: boolean,
) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const picking = extractPickingPayload(payload);
  const items = (order.itens ?? []).map((item) =>
    mapPickingItem(order.depositante_id, item, stockRows, includeRouteData),
  );
  const routeStops = includeRouteData ? buildRouteStops(items) : [];
  const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
  const totalSeparated = items.reduce((sum, item) => sum + item.separatedQuantity, 0);
  const shortageUnits = items.reduce((sum, item) => sum + item.shortageQuantity, 0);
  const ageMeta = buildOperationalSlaMeta(order.created_at);

  return {
    id: order.id,
    code: order.codigo,
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

function mapPickingItem(
  depositanteId: string,
  item: RawPickingOrderItemRow,
  stockRows: RawPickingStockRow[],
  includeRouteData: boolean,
) {
  const requestedQuantity = Number(item.quantidade ?? 0);
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
      addressCode: stock.endereco?.codigo?.trim() || "Sem endereï¿½o",
      area: normalizeArea(stock.endereco?.area),
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
    externalReference: item.referencia_externa?.trim() || "-",
    code: item.codigo_produto?.trim() || "-",
    sku: item.sku?.trim() || "-",
    barcode: item.produto?.codigo_externo?.trim() || "-",
    name: item.nome,
    unit: item.unidade?.trim() || "UN",
    requestedQuantity,
    separatedQuantity,
    remainingQuantity: Math.max(requestedQuantity - separatedQuantity, 0),
    shortageQuantity: remaining,
    routeLines,
  } satisfies ShippingPickingItem;
}

function buildPickingOrdersQuery(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  return supabase.from("pedidos_expedicao").select(
    "id, codigo, created_at, origem, status, numero_pedido, numero_loja, cliente_nome, cliente_cidade, cliente_uf, quantidade_itens, quantidade_unidades, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, produto_id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada, produto:produtos(codigo_externo))",
  );
}

async function loadPickingStockRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orders: RawPickingOrderRow[],
) {
  const depositanteIds = [...new Set(orders.map((item) => item.depositante_id).filter(Boolean))];
  const productIds = [
    ...new Set(
      orders
        .flatMap((order) => order.itens ?? [])
        .map((item) => item.produto_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (!depositanteIds.length) {
    return [] as RawPickingStockRow[];
  }

  let stockQuery = supabase
    .from("estoque")
    .select(
      "id, depositante_id, produto_id, quantidade, quantidade_reservada, bloqueado, lote, validade_em, created_at, endereco:enderecos(codigo, area, rua, modulo, nivel, posicao), produto:produtos(sku, nome, codigo_interno, metodo_retirada)",
    )
    .in("depositante_id", depositanteIds)
    .eq("bloqueado", false);

  if (productIds.length) {
    stockQuery = stockQuery.in("produto_id", productIds);
  }

  const { data: stockData, error: stockError } = await stockQuery;

  if (stockError) {
    throw new Error(`N?o foi poss?vel montar a rota de picking: ${stockError.message}`);
  }

  return (stockData ?? []) as RawPickingStockRow[];
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
        sku: item.sku,
        name: item.name,
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
  };
}

function matchesStockToItem(stock: RawPickingStockRow, item: RawPickingOrderItemRow) {
  if (item.produto_id && stock.produto_id === item.produto_id) {
    return true;
  }

  const itemCandidates = [item.sku, item.codigo_produto].map(normalizeText).filter(Boolean);
  const stockCandidates = [stock.produto?.sku, stock.produto?.codigo_interno]
    .map(normalizeText)
    .filter(Boolean);

  return itemCandidates.some((candidate) => stockCandidates.includes(candidate));
}

function compareStocksForPicking(a: RawPickingStockRow, b: RawPickingStockRow) {
  const areaDiff = getAreaPriority(a.endereco?.area) - getAreaPriority(b.endereco?.area);
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
  const areaDiff = getAreaPriority(a.area) - getAreaPriority(b.area);
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

function getAreaPriority(area: string | null | undefined) {
  switch (normalizeArea(area)) {
    case "PICKING":
      return 0;
    case "EXPEDICAO":
      return 1;
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

function normalizeArea(area: string | null | undefined) {
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
    endereco?.modulo ? `M?dulo ${endereco.modulo}` : null,
    endereco?.nivel ? `N?vel ${endereco.nivel}` : null,
    endereco?.posicao ? `Posi??o ${endereco.posicao}` : null,
  ].filter(Boolean);

  return parts.join(" ? ") || "Sequ?ncia n?o informada";
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

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
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
