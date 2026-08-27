import type { AppUserContext } from "@/lib/auth";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ReverseLogisticsReportFilters = {
  depositanteId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ReverseLogisticsReportRow = {
  id: string;
  depositanteId: string;
  depositante: string;
  orderId: string;
  orderNumber: string;
  customer: string;
  quantity: number;
  quantityLabel: string;
  unitValue: number;
  totalValue: number;
  invoiceNumber: string;
  invoiceKey: string;
  invoiceReceivedAtLabel: string;
  mesAno: string;
  createdAtIso: string;
  createdAtLabel: string;
};

export type ReverseLogisticsReport = {
  rows: ReverseLogisticsReportRow[];
  summary: {
    totalOccurrences: number;
    totalUnits: number;
    totalValue: number;
    averageTicket: number;
  };
};

type RawLancamento = {
  id: string;
  depositante_id: string;
  referencia_id: string | null;
  quantidade: number | string;
  valor_unitario: number | string;
  valor_total: number | string;
  mes_ano: string;
  created_at: string;
  depositante: unknown;
};

type RawOrder = {
  id: string;
  codigo: string;
  numero_wms: number | string | null;
  cliente_nome: string | null;
  payload_origem: unknown;
};

export async function listReverseLogisticsReport(
  user: AppUserContext,
  filters: ReverseLogisticsReportFilters = {},
): Promise<ReverseLogisticsReport> {
  const supabase = createSupabaseAdminClient();
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : filters.depositanteId;

  let query = supabase
    .from("lancamentos")
    .select(
      "id, depositante_id, referencia_id, quantidade, valor_unitario, valor_total, mes_ano, created_at, depositante:depositantes(nome)",
    )
    .eq("tipo_servico", "LOGISTICA_REVERSA")
    .eq("estornado", false)
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
    throw new Error(`Não foi possível montar o relatório de logística reversa: ${error.message}`);
  }

  const lancamentos = (data ?? []) as unknown as RawLancamento[];
  const orderIds = [
    ...new Set(lancamentos.map((item) => item.referencia_id).filter((id): id is string => Boolean(id))),
  ];
  const ordersById = await loadOrdersById(supabase, orderIds);

  const rows = lancamentos.map((lancamento) =>
    mapRow(lancamento, ordersById.get(lancamento.referencia_id ?? "")),
  );

  return { rows, summary: buildSummary(rows) };
}

async function loadOrdersById(supabase: ReturnType<typeof createSupabaseAdminClient>, orderIds: string[]) {
  const map = new Map<string, RawOrder>();
  if (!orderIds.length) return map;

  const { data, error } = await supabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_wms, cliente_nome, payload_origem")
    .in("id", orderIds);

  if (error) {
    throw new Error(`Não foi possível carregar os pedidos de logística reversa: ${error.message}`);
  }

  for (const order of (data ?? []) as RawOrder[]) {
    map.set(order.id, order);
  }

  return map;
}

function buildSummary(rows: ReverseLogisticsReportRow[]) {
  const totalUnits = rows.reduce((total, row) => total + row.quantity, 0);
  const totalValue = rows.reduce((total, row) => total + row.totalValue, 0);

  return {
    totalOccurrences: rows.length,
    totalUnits,
    totalValue,
    averageTicket: rows.length ? roundCurrency(totalValue / rows.length) : 0,
  };
}

function mapRow(lancamento: RawLancamento, order: RawOrder | undefined): ReverseLogisticsReportRow {
  const depositante = extractRelationName(lancamento.depositante) || "Sem depositante";
  const quantity = Number(lancamento.quantidade ?? 0);
  const invoice = extractReturnInvoice(order?.payload_origem);

  return {
    id: lancamento.id,
    depositanteId: lancamento.depositante_id,
    depositante,
    orderId: order?.id ?? "",
    orderNumber: order
      ? formatWmsOrderNumber(order.numero_wms, order.codigo, depositante)
      : "Pedido não encontrado",
    customer: order?.cliente_nome?.trim() || "Cliente não informado",
    quantity,
    quantityLabel: quantity.toLocaleString("pt-BR"),
    unitValue: Number(lancamento.valor_unitario ?? 0),
    totalValue: Number(lancamento.valor_total ?? 0),
    invoiceNumber: invoice?.numero ?? "",
    invoiceKey: invoice?.chaveAcesso ?? "",
    invoiceReceivedAtLabel: invoice?.anexadaEm ? formatDateTime(invoice.anexadaEm) : "",
    mesAno: lancamento.mes_ano,
    createdAtIso: lancamento.created_at,
    createdAtLabel: formatDateTime(lancamento.created_at),
  };
}

function extractReturnInvoice(payload: unknown) {
  if (!isRecord(payload)) return null;
  const invoice = payload.notaFiscalDevolucao;
  if (!isRecord(invoice)) return null;

  return {
    numero: readString(invoice.numero),
    chaveAcesso: readString(invoice.chaveAcesso),
    anexadaEm: readString(invoice.anexadaEm),
  };
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
