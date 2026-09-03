import type { AppUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTimePtBr } from "@/lib/utils";

/**
 * Three-letter tag used in receiving codes (RC-JOH-2607201). Derived from the
 * depositante's name rather than its `codigo` because most codigos are numeric
 * ("021"), which would produce unreadable codes like RC-021-2607201. Accents
 * are stripped so "Dêvi" and "Volcà" yield DEV/VOL instead of broken output.
 */
export function buildDepositantePrefix(depositanteNome: string | null | undefined) {
  const letters = (depositanteNome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();

  return letters.slice(0, 3) || "DEP";
}

export async function generateReceivingCode(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  depositanteNome: string | null | undefined,
) {
  const { data, error } = await adminSupabase.rpc("next_recebimento_codigo_seq");

  if (error || data === null || typeof data === "undefined") {
    throw new Error(
      `Não foi possível gerar o código do recebimento: ${error?.message ?? "erro desconhecido"}`,
    );
  }

  return `RC-${buildDepositantePrefix(depositanteNome)}-${data}`;
}

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
  itens?: Array<{
    id: string;
    quantidade_prevista: number | string | null;
    quantidade_recebida: number | string | null;
    produto: ProductRelation;
  }> | null;
  documentos?: Array<{
    id: string;
    mime_type: string | null;
    nome_arquivo: string | null;
  }> | null;
  tarefas?: Array<{ titulo: string; tipo: string }> | null;
  // Podem não existir ainda se a migração 20260903120000 não rodou — por
  // isso RECEIVING_RICH_SELECT tem fallback e esses campos são opcionais.
  doca?: string | null;
  transportadora?: string | null;
  recebido_em?: string | null;
  conferido_por?: RelationName;
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
  etaTime?: string;
  etaRaw?: string | null;
  status: string;
  noteNumber: string;
  xmlAttached: boolean;
  skuCount: number;
  volumeCount: number;
  receivedCount: number;
  createdAtIso: string;
  dock: string;
  carrier: string;
  arrivedAt: string | null;
  arrivedAtIso: string | null;
  handledBy: string;
  products: Array<{ sku: string; nome: string; qty: number }>;
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

// doca/transportadora/recebido_em/conferido_por vêm de uma migração recente
// (20260903120000) — busca com esses campos primeiro e cai pro select antigo
// se o ambiente ainda não rodou a migração (evita a lista inteira quebrar).
const RECEIVING_BASE_SELECT =
  "id, codigo, status, previsto_para, nota_fiscal_numero, fornecedor_nome, observacoes, referencia_externa, created_at, depositante_id, depositante:depositantes(nome), itens:pedidos_recebimento_itens(id, quantidade_prevista, quantidade_recebida, produto:produtos(sku, nome)), documentos:documentos_armazenados(id, mime_type, nome_arquivo), tarefas:recebimento_tarefas(titulo, tipo)";
const RECEIVING_RICH_SELECT = `${RECEIVING_BASE_SELECT}, doca, transportadora, recebido_em, conferido_por:usuarios!conferido_por(nome)`;

export async function listReceivingOrdersFromDb(
  filters?: ReceivingOrderFilters,
) {
  const supabase = await createSupabaseServerClient();

  const buildQuery = (select: string) => {
    let query = supabase
      .from("pedidos_recebimento")
      .select(select)
      .order("created_at", { ascending: false });

    if (filters?.status) {
      if (filters.status === "DIVERGENCIA") {
        query = query.in("status", ["DIVERGENCIA", "QUARENTENA_CORRIGIDA"]);
      } else {
        query = query.eq("status", filters.status);
      }
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

    return query;
  };

  let { data, error } = await buildQuery(RECEIVING_RICH_SELECT);

  // Qualquer erro na busca "rica" (coluna faltando, hint de relacionamento
  // inválido antes da migração rodar, etc.) cai pro select base, que só usa
  // colunas que sempre existiram — não vale a pena tentar reconhecer a
  // mensagem exata do Postgres, isso já deixou a lista inteira vazia uma vez.
  if (error) {
    console.error("[receiving] busca rica falhou, caindo pro select base:", error.message);
    ({ data, error } = await buildQuery(RECEIVING_BASE_SELECT));
    if (error) {
      console.error("[receiving] select base também falhou:", error.message);
    }
  }

  return ((data ?? []) as unknown as RawOrderRow[]).map(mapOrderSummary);
}

export async function listReceivingTasksFromDb() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("recebimento_tarefas")
    .select(
      "id, titulo, tipo, prioridade, created_at, responsavel:usuarios(nome)",
    )
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

export async function listOperationalIssuesFromDb(
  filters?: OperationalIssueFilters,
) {
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
    depositante: extractRelationName(item.depositante) ?? "",
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
      description:
        extractProductField(item.produto, "nome") ?? "Produto sem descrição",
      barcode: extractProductField(item.produto, "codigo_externo") ?? "",
      internalCode: extractProductField(item.produto, "codigo_interno") ?? "",
      unitCode:
        extractProductField(item.produto, "unidade_estocagem") ?? "UNIDADE",
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
      requireExpiry: Boolean(
        extractProductBoolean(item.produto, "exige_validade"),
      ),
    };
  });

  const divergenceItems = items.filter((item) => item.divergenceQuantity !== 0);

  return {
    id: normalized.id,
    code: normalized.codigo,
    depositante: extractRelationName(normalized.depositante) ?? "",
    supplier: normalized.fornecedor_nome ?? "Fornecedor não informado",
    status: normalized.status,
    eta: normalized.previsto_para
      ? formatDate(normalized.previsto_para)
      : "Sem previsão",
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
    sourceIssues
      ? Promise.resolve(sourceIssues)
      : listOperationalIssuesFromDb(),
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

/**
 * Whether the order actually has the NF-e XML stored. This used to be inferred
 * from an "XML selecionado: <arquivo>" note the legacy portal wrote into
 * observacoes -- but that flow only ever recorded the file *name*, never the
 * file, so the flag was reporting an attachment that did not exist. Now that
 * the portal uploads through the real importer, check the stored documents.
 */
function hasXmlDocument(documentos: RawOrderRow["documentos"]) {
  return (documentos ?? []).some(
    (documento) =>
      documento.mime_type?.toLowerCase().includes("xml") ||
      documento.nome_arquivo?.toLowerCase().endsWith(".xml"),
  );
}

function mapOrderSummary(item: RawOrderRow): ReceivingOrderSummary {
  const quantities = (item.itens ?? []).map((entry) =>
    Number(entry.quantidade_prevista ?? 0),
  );
  const receivedCount = (item.itens ?? []).reduce(
    (sum, entry) => sum + (Number(entry.quantidade_recebida ?? 0) || 0),
    0,
  );
  const products = (item.itens ?? []).map((entry) => ({
    sku: extractProductField(entry.produto, "sku") ?? "-",
    nome: extractProductField(entry.produto, "nome") ?? "Produto sem descrição",
    qty: Number(entry.quantidade_prevista ?? 0) || 0,
  }));
  // Doca: prefere a coluna real (atribuída pelo popup); pedidos antigos, sem
  // valor na coluna, caem pro título da tarefa (convenção anterior).
  const dock = item.doca?.trim() || extractDock(item.tarefas);
  const volumeNote = item.observacoes?.match(
    /Volumes previstos:\s*(\d+)/i,
  )?.[1];
  const hourNote = item.observacoes?.match(
    /Horário previsto:\s*([0-9]{1,2}:[0-9]{2})/i,
  )?.[1];
  // Transportadora: prefere a coluna real; pedidos importados de XML antes da
  // migração gravaram isso como texto solto em observações.
  const carrierNote = item.observacoes?.match(/Transportadora:\s*(.+?)(?:\n|$)/i)?.[1]?.trim();
  const carrier = item.transportadora?.trim() || carrierNote || "—";

  return {
    id: item.id,
    code: item.codigo,
    depositanteId: (item as RawOrderRow & { depositante_id?: string })
      .depositante_id,
    depositante: extractRelationName(item.depositante) ?? "",
    supplier: item.fornecedor_nome ?? "Fornecedor não informado",
    createdAt: formatDateTimeOrFallback(item.created_at, "Sem data"),
    eta: item.previsto_para ? formatDate(item.previsto_para) : "Sem previsão",
    etaTime: hourNote
      ? `${item.previsto_para ? formatDate(item.previsto_para) : "Sem previsão"} · ${hourNote}`
      : undefined,
    etaRaw: item.previsto_para,
    createdAtIso: item.created_at,
    dock,
    carrier,
    arrivedAt: item.recebido_em ? formatDateTimeOrFallback(item.recebido_em, "—") : null,
    arrivedAtIso: item.recebido_em ?? null,
    handledBy: extractRelationName(item.conferido_por ?? null) ?? "—",
    status: item.status,
    noteNumber: item.nota_fiscal_numero ?? "-",
    xmlAttached: hasXmlDocument(item.documentos),
    skuCount: (item.itens ?? []).length,
    receivedCount,
    products,
    volumeCount: volumeNote
      ? Number(volumeNote)
      : quantities.reduce((sum, value) => sum + value, 0),
  };
}

// A doca não é uma coluna do pedido — só existe como texto dentro do título
// da tarefa DOCA criada junto com o pedido ("Preparar DOCA-01 para RC-...").
// O import de XML cria a mesma tarefa sem um código específico ("Preparar
// doca para RC-..."), então "doca" sozinho (sem código) não conta como valor.
function extractDock(tarefas: RawOrderRow["tarefas"]): string {
  const tarefaDoca = (tarefas ?? []).find((t) => t.tipo === "DOCA");
  const match = tarefaDoca?.titulo.match(/^Preparar\s+(.+?)\s+para\s+/i);
  const value = match?.[1]?.trim();
  if (!value || value.toLowerCase() === "doca") return "—";
  return value;
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
  field:
    "sku" | "nome" | "codigo_interno" | "codigo_externo" | "unidade_estocagem",
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
  return formatDateTimePtBr(value, fallback);
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
