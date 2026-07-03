import type { AppUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RelationName = { nome?: string } | { nome?: string }[] | null;
type ProductRelation =
  | {
      sku?: string;
      nome?: string;
      codigo_interno?: string;
      codigo_externo?: string;
      unidade_estocagem?: string;
      exige_lote?: boolean;
      exige_validade?: boolean;
    }
  | Array<{
      sku?: string;
      nome?: string;
      codigo_interno?: string;
      codigo_externo?: string;
      unidade_estocagem?: string;
      exige_lote?: boolean;
      exige_validade?: boolean;
    }>
  | null;

type RawOrderRow = {
  id: string;
  codigo: string;
  status: string;
  previsto_para: string | null;
  nota_fiscal_numero: string | null;
  fornecedor_nome: string | null;
  observacoes: string | null;
  referencia_externa: string | null;
  created_at: string;
  depositante_id?: string;
  depositante: RelationName;
  itens?: Array<{ id: string; quantidade_prevista: number | string | null }> | null;
};

type RawTaskRow = {
  id: string;
  titulo: string;
  tipo: string;
  prioridade: number | null;
  created_at: string | null;
  responsavel: RelationName;
};

type RawIssueRow = {
  id: string;
  titulo: string;
  tipo: string;
  descricao: string;
  depositante: RelationName;
  pedido_recebimento_id: string | null;
  item_recebimento_id: string | null;
};

type RawOrderDetailRow = {
  id: string;
  codigo: string;
  status: string;
  previsto_para: string | null;
  nota_fiscal_numero: string | null;
  fornecedor_nome: string | null;
  observacoes: string | null;
  referencia_externa: string | null;
  depositante: RelationName;
  itens?: Array<{
    id: string;
    status: string;
    quantidade_prevista: number | string | null;
    quantidade_recebida: number | string | null;
    lote: string | null;
    validade_em: string | null;
    produto: ProductRelation;
  }> | null;
};

export type ReceivingOrderSummary = {
  id: string;
  code: string;
  depositanteId?: string;
  depositante: string;
  supplier: string;
  createdAt: string;
  eta: string;
  etaRaw?: string | null;
  status: string;
  skuCount: number;
  volumeCount: number;
};

type ReceivingOrderFilters = {
  status?: string;
  depositanteId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ReceivingTaskSummary = {
  id: string;
  title: string;
  type: string;
  assignee: string;
  priority: string;
  due: string;
};

export type OperationalIssueSummary = {
  id: string;
  title: string;
  type: string;
  depositante: string;
  action: string;
  orderId: string | null;
  itemId: string | null;
};

type OperationalIssueFilters = {
  orderId?: string;
  depositanteId?: string;
  limit?: number;
};

export type ReceivingOrderDetail = {
  id: string;
  code: string;
  depositante: string;
  supplier: string;
  status: string;
  eta: string;
  dock: string;
  noteNumber: string;
  volumes: number;
  skuCount: number;
  protocol: string;
  checklist: string[];
  divergence: {
    hasAny: boolean;
    itemCount: number;
    totalQuantity: number;
  };
  items: Array<{
    id: string;
    status: string;
    sku: string;
    description: string;
    barcode: string;
    internalCode: string;
    unitCode: string;
    unitLabel: string;
    expected: string;
    expectedQuantity: number;
    received: string;
    receivedQuantity: number;
    divergenceQuantity: number;
    divergenceLabel: string;
    lot: string;
    lotValue: string;
    expiry: string;
    expiryValue: string;
    requireLot: boolean;
    requireExpiry: boolean;
  }>;
};

export async function listReceivingOrdersFromDb(filters?: ReceivingOrderFilters) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pedidos_recebimento")
    .select(
      "id, codigo, status, previsto_para, nota_fiscal_numero, fornecedor_nome, observacoes, referencia_externa, created_at, depositante_id, depositante:depositantes(nome), itens:pedidos_recebimento_itens(id, quantidade_prevista)",
    )
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  if (filters?.dateFrom) {
    query = query.gte("previsto_para", filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte("previsto_para", filters.dateTo);
  }

  const { data } = await query;

  return ((data ?? []) as RawOrderRow[]).map(mapOrderSummary);
}

export async function listReceivingTasksFromDb() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("recebimento_tarefas")
    .select("id, titulo, tipo, prioridade, created_at, responsavel:usuarios(nome)")
    .order("created_at", { ascending: false })
    .limit(12);

  return ((data ?? []) as RawTaskRow[]).map((item) => ({
    id: item.id,
    title: item.titulo,
    type: item.tipo,
    assignee: extractRelationName(item.responsavel) ?? "A definir",
    priority: getPriorityLabel(item.prioridade),
    due: formatDateTimeOrFallback(item.created_at, "Sem prazo"),
  }));
}

export async function listOperationalIssuesFromDb(filters?: OperationalIssueFilters) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("ocorrencias_operacionais")
    .select(
      "id, titulo, tipo, descricao, pedido_recebimento_id, item_recebimento_id, depositante:depositantes(nome), created_at",
    )
    .order("created_at", { ascending: false });

  if (filters?.orderId) {
    query = query.eq("pedido_recebimento_id", filters.orderId);
  }

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  query = query.limit(filters?.limit ?? 12);

  const { data } = await query;

  return ((data ?? []) as RawIssueRow[]).map((item) => ({
    id: item.id,
    title: item.titulo,
    type: item.tipo,
    depositante: extractRelationName(item.depositante) ?? "Sem depositante",
    action: item.descricao,
    orderId: item.pedido_recebimento_id,
    itemId: item.item_recebimento_id,
  }));
}

export async function getReceivingOrderDetailFromDb(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("pedidos_recebimento")
    .select(
      "id, codigo, status, previsto_para, nota_fiscal_numero, fornecedor_nome, observacoes, referencia_externa, created_at, depositante:depositantes(nome), itens:pedidos_recebimento_itens(id, status, quantidade_prevista, quantidade_recebida, lote, validade_em, produto:produtos(sku, nome, codigo_interno, codigo_externo, unidade_estocagem, exige_lote, exige_validade))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return null;
  }

  const normalized = order as RawOrderDetailRow;
  const items = (normalized.itens ?? []).map((item) => {
    const expectedQuantity = Number(item.quantidade_prevista ?? 0);
    const receivedQuantity = Number(item.quantidade_recebida ?? 0);
    const divergenceQuantity = receivedQuantity - expectedQuantity;

    return {
      id: item.id,
      status: item.status,
      sku: extractProductField(item.produto, "sku") ?? "SKU não informado",
      description: extractProductField(item.produto, "nome") ?? "Produto sem descrição",
      barcode: extractProductField(item.produto, "codigo_externo") ?? "",
      internalCode: extractProductField(item.produto, "codigo_interno") ?? "",
      unitCode: extractProductField(item.produto, "unidade_estocagem") ?? "UNIDADE",
      unitLabel: formatUnitLabel(
        extractProductField(item.produto, "unidade_estocagem") ?? "UNIDADE",
      ),
      expected: formatQuantity(expectedQuantity),
      expectedQuantity,
      received: formatQuantity(receivedQuantity),
      receivedQuantity,
      divergenceQuantity,
      divergenceLabel: buildDivergenceLabel(expectedQuantity, receivedQuantity),
      lot: item.lote ?? "Não informado",
      lotValue: item.lote ?? "",
      expiry: item.validade_em ? formatDate(item.validade_em) : "Não informada",
      expiryValue: item.validade_em ?? "",
      requireLot: Boolean(extractProductBoolean(item.produto, "exige_lote")),
      requireExpiry: Boolean(extractProductBoolean(item.produto, "exige_validade")),
    };
  });

  const divergenceItems = items.filter((item) => item.divergenceQuantity !== 0);

  return {
    id: normalized.id,
    code: normalized.codigo,
    depositante: extractRelationName(normalized.depositante) ?? "Sem depositante",
    supplier: normalized.fornecedor_nome ?? "Fornecedor não informado",
    status: normalized.status,
    eta: normalized.previsto_para ? formatDate(normalized.previsto_para) : "Sem previsão",
    dock: "DOCA-01",
    noteNumber: normalized.nota_fiscal_numero ?? "-",
    volumes: items.reduce((sum, item) => sum + item.expectedQuantity, 0),
    skuCount: items.length,
    protocol: normalized.referencia_externa ?? normalized.codigo,
    checklist: buildChecklist(normalized.observacoes),
    divergence: {
      hasAny: divergenceItems.length > 0,
      itemCount: divergenceItems.length,
      totalQuantity: divergenceItems.reduce(
        (sum, item) => sum + Math.abs(item.divergenceQuantity),
        0,
      ),
    },
    items,
  } satisfies ReceivingOrderDetail;
}

export async function listReceivingStatsFromDb(
  user: AppUserContext,
  sourceOrders?: ReceivingOrderSummary[],
  sourceIssues?: OperationalIssueSummary[],
  sourceTasks?: ReceivingTaskSummary[],
) {
  const [orders, issues, tasks] = await Promise.all([
    sourceOrders ? Promise.resolve(sourceOrders) : listReceivingOrdersFromDb(),
    sourceIssues ? Promise.resolve(sourceIssues) : listOperationalIssuesFromDb(),
    sourceTasks ? Promise.resolve(sourceTasks) : listReceivingTasksFromDb(),
  ]);

  const volumes = orders.reduce((sum, order) => sum + order.volumeCount, 0);

  return [
    {
      label: "Pedidos aguardando",
      value: String(orders.length),
      help:
        user.papel === "DEPOSITANTE"
          ? "Pedidos visíveis apenas para o seu depositante."
          : "Ordens inbound prontas para agenda, doca ou conferência.",
    },
    {
      label: "Volumes previstos",
      value: String(volumes),
      help:
        user.papel === "DEPOSITANTE"
          ? "Soma dos volumes da sua operação."
          : "Soma do planejamento operacional do turno atual.",
    },
    {
      label: "Divergências abertas",
      value: String(issues.length),
      help: "Ocorrências em tratativa dentro do escopo visível.",
    },
    {
      label: "Tarefas em foco",
      value: String(tasks.length),
      help: "Tarefas operacionais ativas no fluxo de recebimento.",
    },
  ] as const;
}

function mapOrderSummary(item: RawOrderRow): ReceivingOrderSummary {
  const quantities = (item.itens ?? []).map((entry) => Number(entry.quantidade_prevista ?? 0));

  return {
    id: item.id,
    code: item.codigo,
    depositanteId: (item as RawOrderRow & { depositante_id?: string }).depositante_id,
    depositante: extractRelationName(item.depositante) ?? "Sem depositante",
    supplier: item.fornecedor_nome ?? "Fornecedor não informado",
    createdAt: formatDateTimeOrFallback(item.created_at, "Sem data"),
    eta: item.previsto_para ? formatDate(item.previsto_para) : "Sem previsão",
    etaRaw: item.previsto_para,
    status: item.status,
    skuCount: (item.itens ?? []).length,
    volumeCount: quantities.reduce((sum, value) => sum + value, 0),
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

function extractProductField(
  value: ProductRelation,
  field: "sku" | "nome" | "codigo_interno" | "codigo_externo" | "unidade_estocagem",
) {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.[field] === "string" ? first[field] : null;
  }

  if (value && typeof value[field] === "string") {
    return value[field] as string;
  }

  return null;
}

function extractProductBoolean(
  value: ProductRelation,
  field: "exige_lote" | "exige_validade",
) {
  if (Array.isArray(value)) {
    return Boolean(value[0]?.[field]);
  }

  return Boolean(value?.[field]);
}

function formatUnitLabel(value: string) {
  switch (value) {
    case "UNIDADE":
      return "Unidade";
    case "CAIXA":
      return "Caixa";
    case "PACK":
      return "Pack";
    case "PALLET":
      return "Pallet";
    default:
      return value;
  }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTimeOrFallback(value: string | null, fallback: string) {
  return value ? new Date(value).toLocaleString("pt-BR") : fallback;
}

function formatQuantity(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR");
}

function getPriorityLabel(value: number | null | undefined) {
  if ((value ?? 0) <= 1) return "Alta";
  if ((value ?? 0) === 2) return "Média";
  return "Baixa";
}

function buildChecklist(observacoes: string | null) {
  const base = [
    "Confirmar doca e documentação na chegada",
    "Conferir volumes, nota fiscal e integridade externa",
    "Registrar divergências antes da entrada em estoque",
  ];

  if (observacoes?.trim()) {
    base.push(`Observação operacional: ${observacoes.trim()}`);
  }

  return base;
}

function buildDivergenceLabel(expected: number, received: number) {
  if (received === expected) {
    return "Conferência OK";
  }

  if (received < expected) {
    return `Falta ${formatQuantity(expected - received)}`;
  }

  return `Sobra ${formatQuantity(received - expected)}`;
}
