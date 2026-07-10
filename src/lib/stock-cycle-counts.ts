import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDatePtBr, formatDateTimePtBr, getSaoPauloDateStamp } from "@/lib/utils";

export type CycleCountSummary = {
  id: string;
  titulo: string;
  depositanteId: string;
  depositante: string;
  area: string;
  status: string;
  blindCount: boolean;
  createdAt: string;
  countedItems: number;
  totalItems: number;
  divergentItems: number;
};

export type CycleCountDetail = {
  id: string;
  titulo: string;
  depositanteId: string;
  depositante: string;
  area: string;
  status: string;
  blindCount: boolean;
  observacoes: string;
  createdAt: string;
  startedAt: string;
  completedAt: string;
  countedItems: number;
  totalItems: number;
  divergentItems: number;
  items: Array<{
    id: string;
    stockId: string;
    protocol: string;
    sku: string;
    productName: string;
    endereco: string;
    area: string;
    lote: string;
    validade: string;
    systemQuantity: string;
    countedQuantity: string;
    secondCountedQuantity: string;
    divergence: string;
    secondDivergence: string;
    status: string;
    adjustmentStatus: string;
    adjustmentApprovedAt: string;
    adjustmentAppliedAt: string;
    adjustmentApprovedBy: string;
    adjustmentNotes: string;
    countedAt: string;
    countedBy: string;
    secondCountedAt: string;
    secondCountedBy: string;
    secondObservations: string;
    observations: string;
  }>;
};

type CycleCountTablesResult<T> = {
  available: boolean;
  data: T;
};

type CreateCycleCountInput = {
  userId: string;
  depositanteId: string;
  area?: string;
  titulo: string;
  observacoes?: string;
  blindCount?: boolean;
};

type UpdateCycleCountItemInput = {
  userId: string;
  cycleCountItemId: string;
  countedQuantity: number;
  observacoes?: string;
};

type RegisterSecondCountInput = {
  userId: string;
  cycleCountItemId: string;
  countedQuantity: number;
  observacoes?: string;
};

type RelationName = { nome?: string } | Array<{ nome?: string }> | null;

type DetailItemRow = {
  id: string;
  quantidade_sistema: number | string;
  quantidade_contada: number | string | null;
  segunda_quantidade_contada?: number | string | null;
  divergencia: number | string;
  segunda_divergencia?: number | string | null;
  status: string;
  observacoes: string | null;
  segunda_observacoes?: string | null;
  ajuste_status?: string | null;
  ajuste_observacoes?: string | null;
  ajuste_aprovado_em?: string | null;
  ajuste_aplicado_em?: string | null;
  ajuste_aprovado_por?: RelationName;
  contado_em: string | null;
  contado_por: RelationName;
  segunda_contado_em?: string | null;
  segunda_contado_por?: RelationName;
  estoque:
    | { id?: string; lote?: string | null; validade_em?: string | null; created_at?: string }
    | Array<{ id?: string; lote?: string | null; validade_em?: string | null; created_at?: string }>
    | null;
  produto: { sku?: string; nome?: string } | Array<{ sku?: string; nome?: string }> | null;
  endereco: { codigo?: string; area?: string } | Array<{ codigo?: string; area?: string }> | null;
};

export async function listCycleCountsFromDb(
  depositanteId?: string,
): Promise<CycleCountTablesResult<CycleCountSummary[]>> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("contagens_estoque")
    .select(
      "id, titulo, depositante_id, area, status, contagem_cega, created_at, depositante:depositantes(nome)",
    )
    .order("created_at", { ascending: false })
    .limit(8);

  if (isMissingCycleCountTables(error)) {
    return { available: false, data: [] };
  }

  if (error) {
    throw new Error(`NÃ£o foi possÃ­vel carregar as contagens cÃ­clicas: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    titulo: string;
    depositante_id: string;
    area: string | null;
    status: string;
    contagem_cega?: boolean | null;
    created_at: string;
    depositante: RelationName;
  }>;

  const filteredRows = depositanteId
    ? rows.filter((row) => row.depositante_id === depositanteId)
    : rows;

  const summaries = await Promise.all(
    filteredRows.map(async (row) => {
      const stats = await getCycleCountItemStats(row.id);

      return {
        id: row.id,
        titulo: row.titulo,
        depositanteId: row.depositante_id,
        depositante: extractRelationName(row.depositante) ?? "Sem depositante",
        area: row.area ?? "Todas as Ã¡reas",
        status: row.status,
        blindCount: Boolean(row.contagem_cega),
        createdAt: formatDateTimePtBr(row.created_at),
        countedItems: stats.countedItems,
        totalItems: stats.totalItems,
        divergentItems: stats.divergentItems,
      } satisfies CycleCountSummary;
    }),
  );

  return { available: true, data: summaries };
}

export async function getStockCycleCountAvailability() {
  const result = await listCycleCountsFromDb();
  return result.available;
}

export async function getCycleCountDetailFromDb(
  id: string,
): Promise<CycleCountTablesResult<CycleCountDetail | null>> {
  const supabase = createSupabaseAdminClient();

  const { data: header, error: headerError } = await supabase
    .from("contagens_estoque")
    .select(
      "id, titulo, depositante_id, area, status, contagem_cega, observacoes, created_at, iniciado_em, concluido_em, depositante:depositantes(nome)",
    )
    .eq("id", id)
    .maybeSingle();

  if (isMissingCycleCountTables(headerError)) {
    return { available: false, data: null };
  }

  if (headerError) {
    throw new Error(`NÃ£o foi possÃ­vel localizar esta contagem: ${headerError.message}`);
  }

  if (!header) {
    return { available: true, data: null };
  }

  const { data: itemRows, error: itemError } = await supabase
    .from("contagens_estoque_itens")
    .select(
      "id, quantidade_sistema, quantidade_contada, segunda_quantidade_contada, divergencia, segunda_divergencia, status, observacoes, segunda_observacoes, ajuste_status, ajuste_observacoes, ajuste_aprovado_em, ajuste_aplicado_em, ajuste_aprovado_por:usuarios(nome), contado_em, contado_por:usuarios(nome), segunda_contado_em, segunda_contado_por:usuarios(nome), estoque:estoque(id, lote, validade_em, created_at), produto:produtos(sku, nome), endereco:enderecos(codigo, area)",
    )
    .eq("contagem_id", id)
    .order("created_at", { ascending: true });

  if (itemError) {
    throw new Error(`NÃ£o foi possÃ­vel carregar os itens desta contagem: ${itemError.message}`);
  }

  const items = ((itemRows ?? []) as DetailItemRow[]).map((item) => {
    const stockId = extractRelationField(item.estoque, "id") ?? item.id;
    const createdAt = extractRelationField(item.estoque, "created_at") ?? new Date().toISOString();

    return {
      id: item.id,
      stockId,
      protocol: buildTraceabilityProtocol(stockId, createdAt),
      sku: extractRelationField(item.produto, "sku") ?? "SKU",
      productName: extractRelationField(item.produto, "nome") ?? "Produto sem descriÃ§Ã£o",
      endereco: extractRelationField(item.endereco, "codigo") ?? "Sem endereÃ§o",
      area: extractRelationField(item.endereco, "area") ?? "Sem Ã¡rea",
      lote: extractRelationField(item.estoque, "lote") ?? "-",
      validade: extractRelationField(item.estoque, "validade_em")
        ? formatDate(extractRelationField(item.estoque, "validade_em")!)
        : "-",
      systemQuantity: Number(item.quantidade_sistema ?? 0).toLocaleString("pt-BR"),
      countedQuantity:
        item.quantidade_contada === null
          ? "-"
          : Number(item.quantidade_contada ?? 0).toLocaleString("pt-BR"),
      secondCountedQuantity:
        item.segunda_quantidade_contada === null || item.segunda_quantidade_contada === undefined
          ? "-"
          : Number(item.segunda_quantidade_contada ?? 0).toLocaleString("pt-BR"),
      divergence: Number(item.divergencia ?? 0).toLocaleString("pt-BR"),
      secondDivergence:
        item.segunda_divergencia === null || item.segunda_divergencia === undefined
          ? "-"
          : Number(item.segunda_divergencia ?? 0).toLocaleString("pt-BR"),
      status: item.status,
      adjustmentStatus: item.ajuste_status?.trim() || "NAO_NECESSARIO",
      adjustmentApprovedAt: item.ajuste_aprovado_em
        ? formatDateTimePtBr(item.ajuste_aprovado_em)
        : "-",
      adjustmentAppliedAt: item.ajuste_aplicado_em
        ? formatDateTimePtBr(item.ajuste_aplicado_em)
        : "-",
      adjustmentApprovedBy: extractRelationName(item.ajuste_aprovado_por ?? null) ?? "-",
      adjustmentNotes: item.ajuste_observacoes?.trim() || "Sem observaÃ§Ãµes de ajuste.",
      countedAt: item.contado_em ? formatDateTimePtBr(item.contado_em) : "-",
      countedBy: extractRelationName(item.contado_por) ?? "-",
      secondCountedAt: item.segunda_contado_em
        ? formatDateTimePtBr(item.segunda_contado_em)
        : "-",
      secondCountedBy: extractRelationName(item.segunda_contado_por ?? null) ?? "-",
      secondObservations: item.segunda_observacoes?.trim() || "Sem observaÃ§Ãµes da segunda contagem.",
      observations: item.observacoes?.trim() || "Sem observaÃ§Ãµes.",
    };
  });

  const countedItems = items.filter((item) => item.status !== "PENDENTE").length;
  const divergentItems = items.filter((item) => item.status === "DIVERGENTE").length;

  return {
    available: true,
    data: {
      id: header.id,
      titulo: header.titulo,
      depositanteId: header.depositante_id,
      depositante: extractRelationName(header.depositante) ?? "Sem depositante",
      area: header.area ?? "Todas as Ã¡reas",
      status: header.status,
      blindCount: Boolean(header.contagem_cega),
      observacoes: header.observacoes?.trim() || "Sem observaÃ§Ãµes.",
      createdAt: formatDateTimePtBr(header.created_at),
      startedAt: header.iniciado_em ? formatDateTimePtBr(header.iniciado_em) : "-",
      completedAt: header.concluido_em ? formatDateTimePtBr(header.concluido_em) : "-",
      countedItems,
      totalItems: items.length,
      divergentItems,
      items,
    },
  };
}

export async function createCycleCount(input: CreateCycleCountInput) {
  const supabase = createSupabaseAdminClient();

  const { data: countHeader, error: headerError } = await supabase
    .from("contagens_estoque")
    .insert({
      depositante_id: input.depositanteId,
      titulo: input.titulo,
      area: input.area || null,
      observacoes: input.observacoes?.trim() || null,
      contagem_cega: Boolean(input.blindCount),
      status: "ABERTA",
      criado_por: input.userId,
      iniciado_em: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (headerError) {
    throw new Error(`NÃ£o foi possÃ­vel abrir a contagem: ${headerError.message}`);
  }

  const { data: stockRows, error: stockError } = await supabase
    .from("estoque")
    .select("id, depositante_id, produto_id, endereco_id, quantidade, endereco:enderecos(area)")
    .eq("depositante_id", input.depositanteId)
    .gt("quantidade", 0);

  if (stockError) {
    throw new Error(`NÃ£o foi possÃ­vel capturar os saldos para contagem: ${stockError.message}`);
  }

  const filteredRows = ((stockRows ?? []) as Array<{
    id: string;
    depositante_id: string;
    produto_id: string;
    endereco_id: string;
    quantidade: number | string;
    endereco: { area?: string } | Array<{ area?: string }> | null;
  }>).filter((row) => {
    if (!input.area) {
      return true;
    }

    const area = extractRelationField(row.endereco, "area");
    return area === input.area;
  });

  if (!filteredRows.length) {
    throw new Error("Nenhum saldo foi encontrado para abrir a contagem com esse filtro.");
  }

  const { error: itemInsertError } = await supabase.from("contagens_estoque_itens").insert(
    filteredRows.map((row) => ({
      contagem_id: countHeader.id,
      depositante_id: row.depositante_id,
      estoque_id: row.id,
      produto_id: row.produto_id,
      endereco_id: row.endereco_id,
      quantidade_sistema: row.quantidade,
      status: "PENDENTE",
      ajuste_status: "NAO_NECESSARIO",
    })),
  );

  if (itemInsertError) {
    throw new Error(`NÃ£o foi possÃ­vel registrar os itens da contagem: ${itemInsertError.message}`);
  }

  return { id: countHeader.id };
}

export async function updateCycleCountItem(input: UpdateCycleCountItemInput) {
  const supabase = createSupabaseAdminClient();

  const { data: currentItem, error: currentItemError } = await supabase
    .from("contagens_estoque_itens")
    .select("id, quantidade_sistema")
    .eq("id", input.cycleCountItemId)
    .maybeSingle();

  if (currentItemError) {
    throw new Error(`NÃ£o foi possÃ­vel localizar o item da contagem: ${currentItemError.message}`);
  }

  if (!currentItem) {
    throw new Error("Item da contagem nÃ£o encontrado.");
  }

  const systemQuantity = Number(currentItem.quantidade_sistema ?? 0);
  const divergence = input.countedQuantity - systemQuantity;
  const status = divergence === 0 ? "CONTADO" : "DIVERGENTE";
  const adjustmentStatus = divergence === 0 ? "NAO_NECESSARIO" : "PENDENTE_APROVACAO";

  const { error } = await supabase
    .from("contagens_estoque_itens")
    .update({
      quantidade_contada: input.countedQuantity,
      divergencia: divergence,
      status,
      observacoes: input.observacoes?.trim() || null,
      ajuste_status: adjustmentStatus,
      ajuste_observacoes: divergence === 0 ? null : input.observacoes?.trim() || null,
      ajuste_aprovado_por: null,
      ajuste_aprovado_em: null,
      ajuste_aplicado_em: null,
      segunda_quantidade_contada: null,
      segunda_divergencia: 0,
      segunda_observacoes: null,
      segunda_contado_por: null,
      segunda_contado_em: null,
      contado_por: input.userId,
      contado_em: new Date().toISOString(),
    })
    .eq("id", input.cycleCountItemId);

  if (error) {
    throw new Error(`NÃ£o foi possÃ­vel registrar a contagem do item: ${error.message}`);
  }
}

export async function registerSecondCycleCount(input: RegisterSecondCountInput) {
  const supabase = createSupabaseAdminClient();

  const { data: currentItem, error: currentItemError } = await supabase
    .from("contagens_estoque_itens")
    .select("id, quantidade_sistema, quantidade_contada, status")
    .eq("id", input.cycleCountItemId)
    .maybeSingle();

  if (currentItemError) {
    throw new Error(`NÃ£o foi possÃ­vel localizar o item da contagem: ${currentItemError.message}`);
  }

  if (!currentItem) {
    throw new Error("Item da contagem nÃ£o encontrado.");
  }

  if (currentItem.status !== "DIVERGENTE") {
    throw new Error("A segunda contagem Ã© liberada apenas para itens com divergÃªncia.");
  }

  const systemQuantity = Number(currentItem.quantidade_sistema ?? 0);
  const secondDivergence = input.countedQuantity - systemQuantity;

  const { error } = await supabase
    .from("contagens_estoque_itens")
    .update({
      segunda_quantidade_contada: input.countedQuantity,
      segunda_divergencia: secondDivergence,
      segunda_observacoes: input.observacoes?.trim() || null,
      segunda_contado_por: input.userId,
      segunda_contado_em: new Date().toISOString(),
      ajuste_status: "PENDENTE_APROVACAO",
      ajuste_aprovado_por: null,
      ajuste_aprovado_em: null,
      ajuste_aplicado_em: null,
    })
    .eq("id", input.cycleCountItemId);

  if (error) {
    throw new Error(`NÃ£o foi possÃ­vel registrar a segunda contagem: ${error.message}`);
  }
}

export async function approveCycleCountAdjustment(input: {
  userId: string;
  cycleCountItemId: string;
  observacoes?: string;
}) {
  const supabase = createSupabaseAdminClient();

  const { data: currentItem, error: currentItemError } = await supabase
    .from("contagens_estoque_itens")
    .select(
      "id, contagem_id, estoque_id, depositante_id, produto_id, endereco_id, quantidade_sistema, quantidade_contada, segunda_quantidade_contada, divergencia, segunda_divergencia, status, ajuste_status, estoque:estoque(id, quantidade, bloqueado)",
    )
    .eq("id", input.cycleCountItemId)
    .maybeSingle();

  if (currentItemError) {
    throw new Error(`NÃ£o foi possÃ­vel localizar o item da contagem: ${currentItemError.message}`);
  }

  if (!currentItem) {
    throw new Error("Item da contagem nÃ£o encontrado.");
  }

  const approvedQuantity =
    currentItem.segunda_quantidade_contada ?? currentItem.quantidade_contada ?? Number.NaN;
  const countedQuantity = Number(approvedQuantity);
  const systemQuantity = Number(currentItem.quantidade_sistema ?? 0);
  const stockRelation = Array.isArray(currentItem.estoque) ? currentItem.estoque[0] : currentItem.estoque;
  const currentStockQuantity = Number(stockRelation?.quantidade ?? systemQuantity);
  const isBlocked = Boolean(stockRelation?.bloqueado);

  if (!Number.isFinite(countedQuantity)) {
    throw new Error("Este item ainda nÃ£o possui quantidade contada para ajuste.");
  }

  if (currentItem.status !== "DIVERGENTE") {
    throw new Error("Apenas itens com divergÃªncia podem ser aprovados para ajuste.");
  }

  if (currentItem.ajuste_status === "APLICADO") {
    return { alreadyApplied: true };
  }

  if (isBlocked) {
    throw new Error("Desbloqueie este saldo antes de aplicar o ajuste do inventÃ¡rio.");
  }

  const now = new Date().toISOString();
  const normalizedNotes = input.observacoes?.trim() || null;
  const difference = countedQuantity - currentStockQuantity;

  if (difference === 0) {
    const { error: syncError } = await supabase
      .from("contagens_estoque_itens")
      .update({
        quantidade_sistema: countedQuantity,
        divergencia: 0,
        segunda_divergencia: 0,
        status: "CONTADO",
        ajuste_status: "APLICADO",
        ajuste_observacoes: normalizedNotes,
        ajuste_aprovado_por: input.userId,
        ajuste_aprovado_em: now,
        ajuste_aplicado_em: now,
      })
      .eq("id", currentItem.id);

    if (syncError) {
      throw new Error(`NÃ£o foi possÃ­vel sincronizar o item da contagem: ${syncError.message}`);
    }

    return { alreadyApplied: false, movementType: "SEM_AJUSTE" as const };
  }

  const movementType = difference > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO";

  const { error: stockUpdateError } = await supabase
    .from("estoque")
    .update({ quantidade: countedQuantity })
    .eq("id", currentItem.estoque_id);

  if (stockUpdateError) {
    throw new Error(`NÃ£o foi possÃ­vel atualizar o saldo do estoque: ${stockUpdateError.message}`);
  }

  const sourceLabel =
    currentItem.segunda_quantidade_contada !== null && currentItem.segunda_quantidade_contada !== undefined
      ? "segunda contagem"
      : "primeira contagem";

  const movementNote = [
    `Ajuste de inventÃ¡rio aplicado a partir de ${sourceLabel} aprovada.`,
    `Sistema: ${systemQuantity.toLocaleString("pt-BR")}.`,
    `Contado: ${countedQuantity.toLocaleString("pt-BR")}.`,
    normalizedNotes ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const { error: movementError } = await supabase.from("movimentacoes_estoque").insert({
    depositante_id: currentItem.depositante_id,
    estoque_id: currentItem.estoque_id,
    produto_id: currentItem.produto_id,
    endereco_origem_id: currentItem.endereco_id,
    endereco_destino_id: currentItem.endereco_id,
    tipo: movementType,
    quantidade: Math.abs(difference),
    referencia_tipo: "CONTAGEM_CICLICA",
    referencia_id: currentItem.contagem_id,
    observacoes: movementNote,
    criado_por: input.userId,
  });

  if (movementError) {
    throw new Error(`NÃ£o foi possÃ­vel registrar o ajuste do inventÃ¡rio: ${movementError.message}`);
  }

  const { error: itemUpdateError } = await supabase
    .from("contagens_estoque_itens")
    .update({
      quantidade_sistema: countedQuantity,
      divergencia: 0,
      segunda_divergencia: 0,
      status: "CONTADO",
      ajuste_status: "APLICADO",
      ajuste_observacoes: normalizedNotes,
      ajuste_aprovado_por: input.userId,
      ajuste_aprovado_em: now,
      ajuste_aplicado_em: now,
    })
    .eq("id", currentItem.id);

  if (itemUpdateError) {
    throw new Error(`NÃ£o foi possÃ­vel fechar o item da contagem: ${itemUpdateError.message}`);
  }

  return { alreadyApplied: false, movementType };
}

export async function completeCycleCount(cycleCountId: string) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("contagens_estoque")
    .update({
      status: "CONCLUIDA",
      concluido_em: new Date().toISOString(),
    })
    .eq("id", cycleCountId);

  if (error) {
    throw new Error(`NÃ£o foi possÃ­vel concluir a contagem: ${error.message}`);
  }
}

async function getCycleCountItemStats(cycleCountId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contagens_estoque_itens")
    .select("status")
    .eq("contagem_id", cycleCountId);

  if (error) {
    throw new Error(`NÃ£o foi possÃ­vel carregar as estatÃ­sticas da contagem: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ status: string }>;
  return {
    totalItems: rows.length,
    countedItems: rows.filter((row) => row.status !== "PENDENTE").length,
    divergentItems: rows.filter((row) => row.status === "DIVERGENTE").length,
  };
}

function isMissingCycleCountTables(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.message?.includes("contagens_estoque") ||
    error.message?.includes("relation") ||
    false
  );
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

function extractRelationField<T extends string>(
  value:
    | Partial<Record<T, string | null | undefined>>
    | Array<Partial<Record<T, string | null | undefined>>>
    | null,
  field: T,
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

function formatDate(value: string) {
  return formatDatePtBr(new Date(`${value}T00:00:00`));
}

function buildTraceabilityProtocol(id: string, createdAt: string) {
  const dateStamp = getSaoPauloDateStamp(createdAt) ?? "00000000";

  return `DEP-${dateStamp}-${id.slice(0, 8).toUpperCase()}`;
}



