import type { AppUserContext } from "@/lib/auth";
import {
  detectSalesChannelFromPayload,
  getSalesChannelOption,
  readManualSalesChannelCode,
  type SalesChannelOption,
} from "@/lib/sales-channels";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SalesReportFilters = {
  depositanteId?: string;
  dateFrom?: string;
  dateTo?: string;
  channel?: string;
};

export type SalesReportRow = {
  id: string;
  depositanteId: string;
  depositante: string;
  orderNumber: string;
  customer: string;
  uf: string;
  channelCode: string;
  channelLabel: string;
  isMarketplace: boolean;
  status: string;
  statusLabel: string;
  totalValue: number;
  totalItems: number;
  totalUnits: number;
  createdAtIso: string;
  createdAtLabel: string;
};

export type SalesReportChannelBreakdown = {
  channelCode: string;
  channelLabel: string;
  orders: number;
  totalValue: number;
  totalUnits: number;
};

export type SalesReportTopProduct = {
  sku: string;
  productName: string;
  totalUnits: number;
  orders: number;
};

export type SalesReport = {
  rows: SalesReportRow[];
  summary: {
    totalOrders: number;
    totalValue: number;
    totalUnits: number;
    averageTicket: number;
    channelBreakdown: SalesReportChannelBreakdown[];
    topProducts: SalesReportTopProduct[];
  };
};

type RawOrder = {
  id: string;
  codigo: string;
  numero_wms: number | string | null;
  status: string;
  cliente_nome: string | null;
  cliente_uf: string | null;
  valor_total: number | string | null;
  quantidade_itens: number | string | null;
  quantidade_unidades: number | string | null;
  created_at: string;
  depositante_id: string;
  payload_origem: unknown;
  observacoes: string | null;
  depositante: unknown;
};

export async function listSalesReport(
  user: AppUserContext,
  filters: SalesReportFilters = {},
): Promise<SalesReport> {
  const supabase = createSupabaseAdminClient();
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : filters.depositanteId;

  let query = supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, status, cliente_nome, cliente_uf, valor_total, quantidade_itens, quantidade_unidades, created_at, depositante_id, payload_origem, observacoes, depositante:depositantes(nome)",
    )
    // EM_CANCELAMENTO / EM_DIVERGENCIA orders are in limbo (about to be
    // cancelled, or pending a divergence decision) -- excluded from revenue
    // for the same reason CANCELADO already is. If a divergence order later
    // proceeds it re-enters as PRONTO_ROMANEIO/EXPEDIDO.
    .not("status", "in", "(CANCELADO,EM_CANCELAMENTO,EM_DIVERGENCIA)")
    .order("created_at", { ascending: false });

  if (effectiveDepositanteId) {
    query = query.eq("depositante_id", effectiveDepositanteId);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00-03:00`);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59.999-03:00`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Não foi possível montar o relatório de vendas: ${error.message}`);
  }

  let rows = ((data ?? []) as unknown as RawOrder[]).filter((order) => !isWebhookSummary(order)).map(mapRow);

  if (filters.channel) {
    rows = rows.filter((row) => row.channelCode === filters.channel);
  }

  const topProducts = await loadTopProducts(
    supabase,
    rows.map((row) => row.id),
  );

  return { rows, summary: buildSummary(rows, topProducts) };
}

// Supabase/PostgREST sends .in() filters as query-string params, so a large
// order set (a wide date range easily passes 500+ ids) blows past the URL
// length limit and the request comes back as a flat "Bad Request" with no
// useful detail -- chunking keeps every request well under that ceiling.
const IN_FILTER_CHUNK_SIZE = 150;

async function loadTopProducts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderIds: string[],
): Promise<SalesReportTopProduct[]> {
  if (!orderIds.length) return [];

  const totals = new Map<string, SalesReportTopProduct>();

  for (let offset = 0; offset < orderIds.length; offset += IN_FILTER_CHUNK_SIZE) {
    const chunk = orderIds.slice(offset, offset + IN_FILTER_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("pedidos_expedicao_itens")
      .select("sku, nome, quantidade, pedido_expedicao_id")
      .in("pedido_expedicao_id", chunk);

    if (error) {
      throw new Error(`Não foi possível calcular os produtos mais vendidos: ${error.message}`);
    }

    for (const item of (data ?? []) as Array<{
      sku: string | null;
      nome: string;
      quantidade: number | string;
    }>) {
      const key = `${item.sku ?? ""}::${item.nome}`;
      const quantity = Number(item.quantidade ?? 0);
      const existing = totals.get(key);

      if (existing) {
        existing.totalUnits += quantity;
        existing.orders += 1;
      } else {
        totals.set(key, {
          sku: item.sku?.trim() || "-",
          productName: item.nome,
          totalUnits: quantity,
          orders: 1,
        });
      }
    }
  }

  return [...totals.values()].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 5);
}

function buildSummary(rows: SalesReportRow[], topProducts: SalesReportTopProduct[]) {
  const totalValue = rows.reduce((total, row) => total + row.totalValue, 0);
  const totalUnits = rows.reduce((total, row) => total + row.totalUnits, 0);

  const channelMap = new Map<string, SalesReportChannelBreakdown>();
  for (const row of rows) {
    const existing = channelMap.get(row.channelCode);
    if (existing) {
      existing.orders += 1;
      existing.totalValue += row.totalValue;
      existing.totalUnits += row.totalUnits;
    } else {
      channelMap.set(row.channelCode, {
        channelCode: row.channelCode,
        channelLabel: row.channelLabel,
        orders: 1,
        totalValue: row.totalValue,
        totalUnits: row.totalUnits,
      });
    }
  }

  return {
    totalOrders: rows.length,
    totalValue,
    totalUnits,
    averageTicket: rows.length ? roundCurrency(totalValue / rows.length) : 0,
    channelBreakdown: [...channelMap.values()].sort((a, b) => b.totalValue - a.totalValue),
    topProducts,
  };
}

function mapRow(order: RawOrder): SalesReportRow {
  const depositante = extractRelationName(order.depositante) || "Sem depositante";
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const channel = resolveSalesChannel(payload);

  return {
    id: order.id,
    depositanteId: order.depositante_id,
    depositante,
    orderNumber: formatWmsOrderNumber(order.numero_wms, order.codigo, depositante),
    customer: order.cliente_nome?.trim() || "Cliente não informado",
    uf: order.cliente_uf?.trim().toUpperCase() || "-",
    channelCode: channel.value,
    channelLabel: channel.label,
    isMarketplace: channel.marketplace,
    status: order.status,
    statusLabel: formatOrderStatus(order.status),
    totalValue: Number(order.valor_total ?? 0),
    totalItems: Number(order.quantidade_itens ?? 0),
    totalUnits: Number(order.quantidade_unidades ?? 0),
    createdAtIso: order.created_at,
    createdAtLabel: formatDateTime(order.created_at),
  };
}

function resolveSalesChannel(payload: Record<string, unknown>): SalesChannelOption {
  const manualCode = readManualSalesChannelCode(payload);
  if (manualCode) {
    const option = getSalesChannelOption(manualCode);
    if (option) return option;
  }

  const detected = detectSalesChannelFromPayload(payload);
  if (detected) return detected;

  return getSalesChannelOption("OUTRO") as SalesChannelOption;
}

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    NOVO: "Novo",
    EM_SEPARACAO: "Em separação",
    SEPARADO: "Separado",
    EM_CONFERENCIA: "Em conferência",
    CONFERIDO: "Conferido",
    PRONTO_ROMANEIO: "Pronto para coleta",
    EXPEDIDO: "Expedido",
  };

  return labels[status] ?? status.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
}

function isWebhookSummary(order: RawOrder) {
  return order.observacoes?.trim() === "Pedido resumido criado a partir do webhook do Bling.";
}

function extractRelationName(value: unknown) {
  if (Array.isArray(value)) {
    return readString(isRecord(value[0]) ? value[0].nome : null);
  }

  return readString(isRecord(value) ? value.nome : null);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
