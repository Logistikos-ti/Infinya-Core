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
  const destination = [item.cliente_cidade?.trim(), item.cliente_uf?.trim()]
    .filter(Boolean)
    .join(" - ") || "Destino não informado";

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
    createdAt: formatDateTimeOrFallback(item.data_pedido, "Sem data"),
    syncedAt: formatDateTimeOrFallback(item.sincronizado_em, "Ainda não sincronizado"),
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

function formatDateTimeOrFallback(value: string | null, fallback: string) {
  return value ? new Date(value).toLocaleString("pt-BR") : fallback;
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
