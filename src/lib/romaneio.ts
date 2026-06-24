import type { AppUserContext } from "@/lib/auth";
import { formatShippingStatusLabel } from "@/lib/shipping";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RelationName = { nome?: string } | { nome?: string }[] | null;

type RawRomaneioOrderRow = {
  id: string;
  codigo: string;
  status: string;
  numero_pedido: string | null;
  numero_loja: string | null;
  valor_total: number | string | null;
  quantidade_itens: number | null;
  quantidade_unidades: number | string | null;
  data_pedido: string | null;
  previsao_envio_em: string | null;
  cliente_nome: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  payload_origem: Record<string, unknown> | null;
  depositante_id: string;
  depositante: RelationName;
};

export type RomaneioOrderSummary = {
  id: string;
  code: string;
  externalNumber: string;
  depositanteId: string;
  depositante: string;
  customer: string;
  destination: string;
  carrierName: string;
  status: string;
  statusLabel: string;
  unitsRaw: number;
  units: string;
  itemCount: number;
  totalRaw: number;
  total: string;
  orderDate: string;
  shipForecast: string;
};

export type RomaneioCarrierGroup = {
  carrierName: string;
  slug: string;
  orderCount: number;
  totalUnitsRaw: number;
  totalUnits: string;
  totalValueRaw: number;
  totalValue: string;
  depositantes: string[];
  destinations: string[];
  cutoff: string;
  statuses: string[];
  orders: RomaneioOrderSummary[];
};

export type RomaneioFilters = {
  status?: string;
  depositanteId?: string;
  carrier?: string;
  dateFrom?: string;
  dateTo?: string;
};

const ROMANEIO_STATUSES = ["PRONTO_ROMANEIO", "EXPEDIDO"] as const;

export async function listRomaneioGroupsFromDb(user: AppUserContext, filters?: RomaneioFilters) {
  const orders = await listRomaneioOrdersFromDb(user, filters);
  const groups = new Map<string, RomaneioCarrierGroup>();

  for (const order of orders) {
    const key = order.carrierName.trim().toLocaleLowerCase("pt-BR");
    const current =
      groups.get(key) ??
      ({
        carrierName: order.carrierName,
        slug: slugify(order.carrierName),
        orderCount: 0,
        totalUnitsRaw: 0,
        totalUnits: "0",
        totalValueRaw: 0,
        totalValue: formatCurrency(0),
        depositantes: [],
        destinations: [],
        cutoff: "Sem previsão",
        statuses: [],
        orders: [],
      } satisfies RomaneioCarrierGroup);

    current.orderCount += 1;
    current.totalUnitsRaw += order.unitsRaw;
    current.totalValueRaw += order.totalRaw;
    current.totalUnits = current.totalUnitsRaw.toLocaleString("pt-BR");
    current.totalValue = formatCurrency(current.totalValueRaw);
    current.orders.push(order);

    if (!current.depositantes.includes(order.depositante)) {
      current.depositantes.push(order.depositante);
    }

    if (!current.destinations.includes(order.destination)) {
      current.destinations.push(order.destination);
    }

    if (!current.statuses.includes(order.statusLabel)) {
      current.statuses.push(order.statusLabel);
    }

    current.cutoff = getLatestCutoff(current.cutoff, order.shipForecast);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      orders: group.orders.sort((left, right) => left.customer.localeCompare(right.customer, "pt-BR")),
      depositantes: [...group.depositantes].sort((left, right) => left.localeCompare(right, "pt-BR")),
      destinations: [...group.destinations].sort((left, right) => left.localeCompare(right, "pt-BR")).slice(0, 6),
      statuses: [...group.statuses],
    }))
    .sort((left, right) => left.carrierName.localeCompare(right.carrierName, "pt-BR"));
}

export async function listRomaneioOrdersByIdsFromDb(
  user: AppUserContext,
  ids: string[],
) {
  const uniqueIds = [...new Set(ids.map((item) => item.trim()).filter(Boolean))];
  if (!uniqueIds.length) {
    return [] as RomaneioOrderSummary[];
  }

  const orders = await listRomaneioOrdersFromDb(user, {});
  return orders.filter((order) => uniqueIds.includes(order.id));
}

export async function getRomaneioGroupFromIds(user: AppUserContext, ids: string[]) {
  const orders = await listRomaneioOrdersByIdsFromDb(user, ids);
  if (!orders.length) {
    return null;
  }

  const carrierName = orders[0].carrierName;
  return {
    carrierName,
    slug: slugify(carrierName),
    orderCount: orders.length,
    totalUnitsRaw: orders.reduce((sum, order) => sum + order.unitsRaw, 0),
    totalUnits: orders.reduce((sum, order) => sum + order.unitsRaw, 0).toLocaleString("pt-BR"),
    totalValueRaw: orders.reduce((sum, order) => sum + order.totalRaw, 0),
    totalValue: formatCurrency(orders.reduce((sum, order) => sum + order.totalRaw, 0)),
    depositantes: [...new Set(orders.map((order) => order.depositante))],
    destinations: [...new Set(orders.map((order) => order.destination))].slice(0, 6),
    cutoff: orders.reduce((latest, order) => getLatestCutoff(latest, order.shipForecast), "Sem previsão"),
    statuses: [...new Set(orders.map((order) => order.statusLabel))],
    orders,
  } satisfies RomaneioCarrierGroup;
}

async function listRomaneioOrdersFromDb(user: AppUserContext, filters?: RomaneioFilters) {
  const supabase = await createSupabaseServerClient();
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : filters?.depositanteId;

  let query = supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, status, numero_pedido, numero_loja, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, cliente_nome, cliente_cidade, cliente_uf, payload_origem, depositante_id, depositante:depositantes(nome)",
    )
    .in("status", [...ROMANEIO_STATUSES])
    .order("previsao_envio_em", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (effectiveDepositanteId) {
    query = query.eq("depositante_id", effectiveDepositanteId);
  }

  if (filters?.dateFrom) {
    query = query.gte("previsao_envio_em", `${filters.dateFrom}T00:00:00`);
  }

  if (filters?.dateTo) {
    query = query.lte("previsao_envio_em", `${filters.dateTo}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Não foi possível carregar a fila de romaneio: ${error.message}`);
  }

  const orders = ((data ?? []) as RawRomaneioOrderRow[]).map(mapRomaneioOrderSummary);

  return orders.filter((order) => {
    if (filters?.carrier) {
      const needle = filters.carrier.trim().toLocaleLowerCase("pt-BR");
      if (!order.carrierName.toLocaleLowerCase("pt-BR").includes(needle)) {
        return false;
      }
    }

    return true;
  });
}

function mapRomaneioOrderSummary(item: RawRomaneioOrderRow) {
  const payload = isRecord(item.payload_origem) ? item.payload_origem : {};
  const customer = item.cliente_nome?.trim() || "Cliente não informado";
  const destination =
    [item.cliente_cidade?.trim(), item.cliente_uf?.trim()].filter(Boolean).join(" - ") ||
    "Destino não informado";
  const unitsRaw = Number(item.quantidade_unidades ?? 0);
  const totalRaw = Number(item.valor_total ?? 0);

  return {
    id: item.id,
    code: item.codigo,
    externalNumber: extractPlatformOrderNumber(payload, item.numero_pedido, item.numero_loja, item.codigo),
    depositanteId: item.depositante_id,
    depositante: extractRelationName(item.depositante) ?? "Sem depositante",
    customer,
    destination,
    carrierName: extractCarrierName(payload),
    status: item.status,
    statusLabel: formatShippingStatusLabel(item.status),
    unitsRaw,
    units: unitsRaw.toLocaleString("pt-BR"),
    itemCount: Number(item.quantidade_itens ?? 0),
    totalRaw,
    total: formatCurrency(totalRaw),
    orderDate: formatDateOrFallback(item.data_pedido, "Sem data"),
    shipForecast: formatDateOrFallback(item.previsao_envio_em, "Sem previsão"),
  } satisfies RomaneioOrderSummary;
}

function extractCarrierName(payload: Record<string, unknown>) {
  const transporte = isRecord(payload.transporte) ? payload.transporte : null;
  const transportador = transporte && isRecord(transporte.contato) ? transporte.contato : null;

  return readString(transportador?.nome) ?? "Transportadora não informada";
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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateOrFallback(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString("pt-BR");
}

function getLatestCutoff(current: string, next: string) {
  if (current === "Sem previsão") {
    return next;
  }

  if (next === "Sem previsão") {
    return current;
  }

  const currentDate = parseBrazilianDate(current);
  const nextDate = parseBrazilianDate(next);
  if (!currentDate) {
    return next;
  }
  if (!nextDate) {
    return current;
  }
  return nextDate > currentDate ? next : current;
}

function parseBrazilianDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
