import type { AppUserContext } from "@/lib/auth";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const OPERATIONAL_SLA_TARGET_HOURS = 24;
export const OPERATIONAL_SLA_CRITICAL_HOURS = 72;

export type OperationalSlaBand = "NO_PRAZO" | "ATENCAO" | "ATRASADO" | "CANCELADO";

export type OperationalSlaReportFilters = {
  depositanteId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  band?: OperationalSlaBand;
};

export type OperationalSlaReportRow = {
  id: string;
  orderNumber: string;
  depositanteId: string;
  depositante: string;
  customer: string;
  status: string;
  statusLabel: string;
  currentStage: string;
  createdAtIso: string;
  createdAtLabel: string;
  pickingStartedAtIso: string | null;
  conferenceStartedAtIso: string | null;
  completedAtIso: string | null;
  elapsedHours: number;
  elapsedLabel: string;
  targetHours: number;
  band: OperationalSlaBand;
  bandLabel: string;
};

export type OperationalSlaReport = {
  rows: OperationalSlaReportRow[];
  summary: {
    monitored: number;
    withinTarget: number;
    withinTargetRate: number;
    warning: number;
    late: number;
    completed: number;
    cancelled: number;
    averageCycleHours: number;
  };
};

type RawOrder = {
  id: string;
  codigo: string;
  numero_wms: number | string | null;
  status: string;
  cliente_nome: string | null;
  created_at: string;
  updated_at: string | null;
  observacoes: string | null;
  payload_origem: unknown;
  depositante_id: string;
  depositante: unknown;
};

export async function listOperationalSlaReport(
  user: AppUserContext,
  filters: OperationalSlaReportFilters = {},
): Promise<OperationalSlaReport> {
  const supabase = createSupabaseAdminClient();
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : filters.depositanteId;

  let query = supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, status, cliente_nome, created_at, updated_at, observacoes, payload_origem, depositante_id, depositante:depositantes(nome)",
    )
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

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Não foi possível montar o relatório de SLA: ${error.message}`);
  }

  const now = Date.now();
  const rows = ((data ?? []) as unknown as RawOrder[])
    .filter((order) => !isWebhookSummary(order))
    .map((order) => mapOrderToSlaRow(order, now))
    .filter((row) => !filters.band || row.band === filters.band);

  const monitoredRows = rows.filter((row) => row.band !== "CANCELADO");
  const completedRows = monitoredRows.filter((row) => Boolean(row.completedAtIso));
  const withinTarget = monitoredRows.filter((row) => row.band === "NO_PRAZO").length;
  const averageCycleHours = completedRows.length
    ? completedRows.reduce((total, row) => total + row.elapsedHours, 0) / completedRows.length
    : 0;

  return {
    rows,
    summary: {
      monitored: monitoredRows.length,
      withinTarget,
      withinTargetRate: monitoredRows.length
        ? Math.round((withinTarget / monitoredRows.length) * 100)
        : 0,
      warning: monitoredRows.filter((row) => row.band === "ATENCAO").length,
      late: monitoredRows.filter((row) => row.band === "ATRASADO").length,
      completed: completedRows.length,
      cancelled: rows.filter((row) => row.band === "CANCELADO").length,
      averageCycleHours: roundHours(averageCycleHours),
    },
  };
}

function mapOrderToSlaRow(order: RawOrder, now: number): OperationalSlaReportRow {
  const payload = readRecord(order.payload_origem);
  const picking = readRecord(payload.separacao);
  const conference = readRecord(payload.conferencia);
  const manualHistory = Array.isArray(payload.historicoStatusManual)
    ? payload.historicoStatusManual.filter(isRecord)
    : [];
  const depositante = extractRelationName(order.depositante) || "Sem depositante";
  const createdAt = parseDate(order.created_at) ?? new Date(now);
  const pickingStartedAtIso =
    readDate(picking.iniciadaEm) ?? findManualStatusDate(manualHistory, ["EM_SEPARACAO"]);
  const conferenceStartedAtIso =
    readDate(conference.iniciadaEm) ??
    findManualStatusDate(manualHistory, ["EM_CONFERENCIA", "SEPARADO"]);
  const completedAtIso = extractCompletionDate(payload, conference, manualHistory, order.status);
  const endTime = completedAtIso ? parseDate(completedAtIso)?.getTime() ?? now : now;
  const elapsedHours = roundHours(Math.max(0, endTime - createdAt.getTime()) / 3_600_000);
  const band = classifyBand(order.status, elapsedHours);

  return {
    id: order.id,
    orderNumber: formatWmsOrderNumber(order.numero_wms, order.codigo, depositante),
    depositanteId: order.depositante_id,
    depositante,
    customer: order.cliente_nome?.trim() || "Cliente não informado",
    status: order.status,
    statusLabel: formatStatus(order.status),
    currentStage: formatCurrentStage(order.status),
    createdAtIso: createdAt.toISOString(),
    createdAtLabel: formatDateTime(createdAt),
    pickingStartedAtIso,
    conferenceStartedAtIso,
    completedAtIso,
    elapsedHours,
    elapsedLabel: formatDuration(elapsedHours),
    targetHours: OPERATIONAL_SLA_TARGET_HOURS,
    band,
    bandLabel: formatBand(band),
  };
}

function extractCompletionDate(
  payload: Record<string, unknown>,
  conference: Record<string, unknown>,
  manualHistory: Record<string, unknown>[],
  status: string,
) {
  if (status !== "EXPEDIDO") {
    return null;
  }

  return (
    readDate(payload.expedidoEm) ??
    readDate(payload.expedido_em) ??
    readDate(conference.liberadoParaRomaneioEm) ??
    findManualStatusDate(manualHistory, ["EXPEDIDO"])
  );
}

function findManualStatusDate(history: Record<string, unknown>[], statuses: string[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (statuses.includes(readString(entry.novoStatus) ?? "")) {
      return readDate(entry.alteradoEm);
    }
  }

  return null;
}

function classifyBand(status: string, elapsedHours: number): OperationalSlaBand {
  // A pedido mid-cancellation or in divergence review is stuck pending a
  // decision -- reuse the CANCELADO band so it's excluded from monitoredRows
  // the same way, with no changes needed to the summary-counting logic.
  if (status === "CANCELADO" || status === "EM_CANCELAMENTO" || status === "EM_DIVERGENCIA") {
    return "CANCELADO";
  }

  if (elapsedHours >= OPERATIONAL_SLA_CRITICAL_HOURS) {
    return "ATRASADO";
  }

  if (elapsedHours >= OPERATIONAL_SLA_TARGET_HOURS) {
    return "ATENCAO";
  }

  return "NO_PRAZO";
}

function formatCurrentStage(status: string) {
  if (status === "EXPEDIDO") return "Expedição concluída";
  if (status === "EM_CANCELAMENTO") return "Cancelamento em andamento";
  if (status === "EM_DIVERGENCIA") return "Em divergência";
  if (status === "CANCELADO") return "Cancelado";
  if (["PRONTO_ROMANEIO", "CONFERIDO"].includes(status)) return "Pós-conferência";
  if (status === "EM_CONFERENCIA") return "Conferência";
  if (["EM_SEPARACAO", "SEPARADO"].includes(status)) return "Separação";
  if (["NOVO", "PENDENTE"].includes(status)) return "Aguardando separação";
  return formatStatus(status);
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    NOVO: "Novo",
    PENDENTE: "Pendente",
    EM_SEPARACAO: "Em separação",
    SEPARADO: "Separado",
    EM_CONFERENCIA: "Em conferência",
    CONFERIDO: "Conferido",
    PRONTO_ROMANEIO: "Pronto para coleta",
    EXPEDIDO: "Expedido",
    EM_CANCELAMENTO: "Cancelamento em andamento",
    EM_DIVERGENCIA: "Em divergência",
    CANCELADO: "Cancelado",
  };

  return labels[status] ?? status.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
}

function formatBand(band: OperationalSlaBand) {
  const labels: Record<OperationalSlaBand, string> = {
    NO_PRAZO: "No prazo",
    ATENCAO: "Atenção",
    ATRASADO: "Atrasado",
    CANCELADO: "Cancelado",
  };

  return labels[band];
}

function formatDuration(hours: number) {
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} min`;
  }

  if (hours < 24) {
    return `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

function readDate(value: unknown) {
  const date = typeof value === "string" ? parseDate(value) : null;
  return date ? date.toISOString() : null;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractRelationName(value: unknown) {
  if (Array.isArray(value)) {
    return readString(readRecord(value[0]).nome);
  }

  return readString(readRecord(value).nome);
}

function isWebhookSummary(order: RawOrder) {
  return order.observacoes?.trim() === "Pedido resumido criado a partir do webhook do Bling.";
}
