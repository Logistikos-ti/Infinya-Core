import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PENDING_ADDRESSING_BLOCK_REASON } from "@/lib/stock-blocking";
import { isHiddenLegacyDamageEntry } from "@/lib/stock-visibility";
import { quarantineDonateLabel, quarantineDonatedLabel } from "@/lib/quarantine-labels";
import { formatDateTimePtBr } from "@/lib/utils";

type Relation<T> = T | T[] | null;

type QuarantineRow = {
  id: string;
  depositante_id: string;
  produto_id: string;
  estoque_id: string | null;
  endereco_id: string | null;
  quantidade: number | string;
  motivo: string;
  tipo: string | null;
  foto_url: string | null;
  status: string;
  decisao_depositante: string | null;
  decisao_observacoes: string | null;
  decisao_em: string | null;
  resolucao_observacoes: string | null;
  created_at: string;
  resolved_at: string | null;
  depositante: Relation<{ nome?: string | null }>;
  produto: Relation<{
    sku?: string | null;
    nome?: string | null;
    codigo_interno?: string | null;
    imagem_principal_url?: string | null;
  }>;
  endereco: Relation<{ codigo?: string | null; area?: string | null }>;
  criado_por: Relation<{ nome?: string | null }>;
  decisao_por: Relation<{ nome?: string | null }>;
  resolvido_por: Relation<{ nome?: string | null }>;
};

type PendingAddressingStockRow = {
  id: string;
  depositante_id: string;
  produto_id: string;
  endereco_id: string | null;
  quantidade: number | string;
  bloqueio_motivo: string | null;
  bloqueado_em: string | null;
  created_at: string;
  depositante: Relation<{ nome?: string | null }>;
  produto: Relation<{
    sku?: string | null;
    nome?: string | null;
    codigo_interno?: string | null;
    imagem_principal_url?: string | null;
  }>;
  endereco: Relation<{ codigo?: string | null; area?: string | null }>;
};

type MissingDefaultAddressProductRow = {
  id: string;
  depositante_id: string;
  sku: string | null;
  nome: string | null;
  codigo_interno: string | null;
  imagem_principal_url: string | null;
  created_at: string | null;
  depositante: Relation<{ nome?: string | null }>;
};

export type StockQuarantineFilters = {
  depositanteId?: string;
  status?: string;
  productTerm?: string;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Skips the pending-addressing/missing-default-address system holds, returning only formal `estoque_quarentena` rows. */
  formalOnly?: boolean;
};

export type StockQuarantineItem = {
  id: string;
  depositanteId: string;
  productId: string;
  stockId: string | null;
  addressId: string | null;
  depositante: string;
  sku: string;
  productName: string;
  internalCode: string;
  imageUrl: string | null;
  endereco: string;
  area: string;
  quantity: number;
  quantityLabel: string;
  reason: string;
  tipo: string;
  fotoUrl: string | null;
  status: string;
  statusLabel: string;
  depositanteDecision: "DOAR" | "DESCARTAR" | "";
  depositanteDecisionLabel: string;
  depositanteDecisionNotes: string;
  depositanteDecisionAt: string | null;
  depositanteDecisionAtLabel: string;
  depositanteDecisionBy: string;
  resolutionNotes: string;
  createdAt: string;
  createdAtLabel: string;
  createdBy: string;
  resolvedAt: string | null;
  resolvedAtLabel: string;
  resolvedBy: string;
  isSystemHold?: boolean;
  isMissingDefaultAddress?: boolean;
  resolutionHint?: string;
};

export async function listStockQuarantineFromDb(filters?: StockQuarantineFilters) {
  if (filters?.formalOnly) {
    const formalRows = await listFormalQuarantineRows(filters);
    const rows =
      filters.status && filters.status !== "TODOS"
        ? formalRows.filter((item) => item.status === filters.status)
        : formalRows;
    const filteredRows = filterQuarantineRows(rows, filters.productTerm);
    return filters.limit ? filteredRows.slice(0, filters.limit) : filteredRows;
  }

  // These three don't depend on each other -- running them one after another
  // triples the round-trip latency for no reason, which on a page that's
  // already doing several other queries (the portal's default view) adds up
  // fast and pushes it closer to the platform's response-time ceiling.
  const [formalRows, pendingAddressingRows, missingDefaultAddressRows] = await Promise.all([
    listFormalQuarantineRows(filters),
    listPendingAddressingHolds(filters),
    listMissingDefaultAddressProducts(filters),
  ]);
  const formalStockIds = new Set(
    formalRows
      .filter((item) => item.status === "EM_QUARENTENA" && item.stockId)
      .map((item) => item.stockId),
  );
  const mergedRows = [
    ...formalRows,
    ...pendingAddressingRows.filter((item) => !formalStockIds.has(item.stockId)),
    ...missingDefaultAddressRows,
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const rows =
    filters?.status && filters.status !== "TODOS"
      ? mergedRows.filter((item) => item.status === filters.status)
      : mergedRows;

  const filteredRows = filterQuarantineRows(rows, filters?.productTerm);
  return filters?.limit ? filteredRows.slice(0, filters.limit) : filteredRows;
}

async function listFormalQuarantineRows(filters?: StockQuarantineFilters) {
  const supabase = createSupabaseAdminClient();

  try {
    let query = supabase
      .from("estoque_quarentena")
      .select(
        "id, depositante_id, produto_id, estoque_id, endereco_id, quantidade, motivo, tipo, foto_url, status, decisao_depositante, decisao_observacoes, decisao_em, resolucao_observacoes, created_at, resolved_at, depositante:depositantes(nome), produto:produtos(sku, nome, codigo_interno, imagem_principal_url), endereco:enderecos(codigo, area), criado_por:usuarios!estoque_quarentena_criado_por_fkey(nome), decisao_por:usuarios!estoque_quarentena_decisao_por_fkey(nome), resolvido_por:usuarios!estoque_quarentena_resolvido_por_fkey(nome)",
      )
      .order("created_at", { ascending: false });

    if (filters?.depositanteId) {
      query = query.eq("depositante_id", filters.depositanteId);
    }

    if (filters?.dateFrom) {
      query = query.gte("created_at", `${filters.dateFrom}T00:00:00-03:00`);
    }

    if (filters?.dateTo) {
      query = query.lte("created_at", `${filters.dateTo}T23:59:59.999-03:00`);
    }

    const { data, error } = await query;

    if (error) {
      if (
        error.code === "42703" ||
        error.message.includes("decisao_depositante") ||
        error.message.includes("estoque_quarentena_decisao_por_fkey")
      ) {
        let legacyQuery = supabase
          .from("estoque_quarentena")
          .select(
            "id, depositante_id, produto_id, estoque_id, endereco_id, quantidade, motivo, tipo, foto_url, status, resolucao_observacoes, created_at, resolved_at, depositante:depositantes(nome), produto:produtos(sku, nome, codigo_interno, imagem_principal_url), endereco:enderecos(codigo, area), criado_por:usuarios!estoque_quarentena_criado_por_fkey(nome), resolvido_por:usuarios!estoque_quarentena_resolvido_por_fkey(nome)",
          )
          .order("created_at", { ascending: false });

        if (filters?.depositanteId) {
          legacyQuery = legacyQuery.eq("depositante_id", filters.depositanteId);
        }

        if (filters?.dateFrom) {
          legacyQuery = legacyQuery.gte("created_at", `${filters.dateFrom}T00:00:00-03:00`);
        }

        if (filters?.dateTo) {
          legacyQuery = legacyQuery.lte("created_at", `${filters.dateTo}T23:59:59.999-03:00`);
        }

        const { data: legacyData, error: legacyError } = await legacyQuery;
        if (legacyError) {
          throw new Error(`Nao foi possivel carregar a quarentena: ${legacyError.message}`);
        }

        return mapFormalQuarantineRows((legacyData ?? []) as unknown as QuarantineRow[]);
      }

      if (error.code === "42P01" || error.message.includes("schema cache")) {
        return [];
      }
      throw new Error(`Nao foi possivel carregar a quarentena: ${error.message}`);
    }

    return mapFormalQuarantineRows((data ?? []) as QuarantineRow[]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("schema cache")) return [];
    throw error;
  }
}

async function listPendingAddressingHolds(filters?: StockQuarantineFilters) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("estoque")
    .select(
      "id, depositante_id, produto_id, endereco_id, quantidade, bloqueio_motivo, bloqueado_em, created_at, depositante:depositantes(nome), produto:produtos(sku, nome, codigo_interno, imagem_principal_url), endereco:enderecos(codigo, area)",
    )
    .eq("bloqueado", true)
    .gt("quantidade", 0)
    .order("bloqueado_em", { ascending: false, nullsFirst: false });

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Nao foi possivel carregar saldos bloqueados: ${error.message}`);
  }

  return ((data ?? []) as PendingAddressingStockRow[])
    .filter(isPendingAddressingHold)
    .map(mapPendingAddressingHold);
}

async function listMissingDefaultAddressProducts(filters?: StockQuarantineFilters) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("produtos")
    .select(
      "id, depositante_id, sku, nome, codigo_interno, imagem_principal_url, created_at, depositante:depositantes(nome)",
    )
    .eq("ativo", true)
    .is("endereco_padrao_id", null)
    .order("nome", { ascending: true });

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("endereco_padrao_id") || error.message.includes("schema cache")) return [];
    throw new Error(`Nao foi possivel carregar produtos sem endereco padrao: ${error.message}`);
  }

  const rows = (data ?? []) as MissingDefaultAddressProductRow[];
  const productIds = rows.map((item) => item.id);
  const stockTotalsByProduct = await sumStockByProduct(productIds);

  return rows.map((row) => mapMissingDefaultAddressProduct(row, stockTotalsByProduct.get(row.id) ?? 0));
}

async function sumStockByProduct(productIds: string[]) {
  const totals = new Map<string, number>();
  if (productIds.length === 0) return totals;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("estoque")
    .select("produto_id, quantidade")
    .in("produto_id", productIds)
    .gt("quantidade", 0);

  if (error) {
    throw new Error(`Nao foi possivel somar estoque dos produtos sem endereco padrao: ${error.message}`);
  }

  for (const row of data ?? []) {
    const productId = String((row as { produto_id?: string }).produto_id ?? "");
    if (!productId) continue;
    const quantity = Number((row as { quantidade?: number | string }).quantidade ?? 0);
    totals.set(productId, (totals.get(productId) ?? 0) + quantity);
  }

  return totals;
}

function filterQuarantineRows(rows: StockQuarantineItem[], productTerm?: string) {
  if (!productTerm) return rows;

  const queryText = normalizeSearch(productTerm);
  return rows.filter((item) =>
    [item.productName, item.sku, item.internalCode, item.endereco, item.reason]
      .map(normalizeSearch)
      .some((value) => value.includes(queryText)),
  );
}

export async function createStockQuarantine({
  stockId,
  quantity,
  reason,
  userId,
  tipo = "OUTRO",
  fotoUrl = null,
}: {
  stockId: string;
  quantity: number;
  reason: string;
  userId: string;
  tipo?: string;
  fotoUrl?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("criar_quarentena_estoque", {
    p_estoque_id: stockId,
    p_quantidade: quantity,
    p_motivo: reason,
    p_usuario_id: userId,
    p_tipo: tipo,
    p_foto_url: fotoUrl,
  });

  if (error) {
    throw new Error(error.message || "Nao foi possivel criar a quarentena.");
  }

  return String(data);
}

export async function resolveStockQuarantine({
  quarantineId,
  action,
  userId,
  observations,
}: {
  quarantineId: string;
  action: "donate" | "discard";
  userId: string;
  observations?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("resolver_quarentena_estoque", {
    p_quarentena_id: quarantineId,
    p_acao: action === "donate" ? "DOAR" : "DESCARTAR",
    p_usuario_id: userId,
    p_observacoes: observations ?? null,
  });

  if (error) {
    throw new Error(error.message || "Nao foi possivel resolver a quarentena.");
  }
}

function mapFormalQuarantineRows(rows: QuarantineRow[]) {
  return rows
    .filter(
      (row) =>
        !isHiddenLegacyDamageEntry({
          createdAt: row.created_at,
          type: row.tipo,
          description: row.motivo,
        }),
    )
    .map(mapQuarantineRow);
}

export async function recordStockQuarantineDecision({
  quarantineId,
  decision,
  userId,
  observations,
}: {
  quarantineId: string;
  decision: "DOAR" | "DESCARTAR";
  userId: string;
  observations?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("registrar_decisao_quarentena", {
    p_quarentena_id: quarantineId,
    p_decisao: decision,
    p_usuario_id: userId,
    p_observacoes: observations ?? null,
  });

  if (error) {
    throw new Error(error.message || "Nao foi possivel registrar a decisao da quarentena.");
  }
}

function mapQuarantineRow(row: QuarantineRow): StockQuarantineItem {
  const quantity = Number(row.quantidade ?? 0);
  const product = firstRelation(row.produto);
  const depositante = firstRelation(row.depositante);
  const endereco = firstRelation(row.endereco);
  const createdBy = firstRelation(row.criado_por);
  const decisionBy = firstRelation(row.decisao_por);
  const resolvedBy = firstRelation(row.resolvido_por);
  const tipo = inferQuarantineType(row.tipo, row.motivo);
  const decision =
    row.decisao_depositante === "DOAR" || row.decisao_depositante === "DESCARTAR"
      ? row.decisao_depositante
      : "";

  return {
    id: row.id,
    depositanteId: row.depositante_id,
    productId: row.produto_id,
    stockId: row.estoque_id,
    addressId: row.endereco_id,
    depositante: depositante?.nome?.trim() || "Sem depositante",
    sku: product?.sku?.trim() || product?.codigo_interno?.trim() || "SKU",
    productName: product?.nome?.trim() || "Produto sem descricao",
    internalCode: product?.codigo_interno?.trim() || "",
    imageUrl: product?.imagem_principal_url ?? null,
    endereco: endereco?.codigo?.trim() || "Sem endereco",
    area: formatArea(endereco?.area),
    quantity,
    quantityLabel: quantity.toLocaleString("pt-BR"),
    reason: row.motivo?.trim() || "Sem motivo informado",
    tipo,
    fotoUrl: row.foto_url ?? null,
    status: row.status,
    statusLabel:
      row.status === "EM_QUARENTENA" && decision
        ? "Aguardando confirmação"
        : row.status === "LIBERADO" && decision === "DOAR"
          ? quarantineDonatedLabel(tipo)
          : formatStatus(row.status),
    depositanteDecision: decision,
    depositanteDecisionLabel:
      decision === "DOAR" ? quarantineDonateLabel(tipo) : decision === "DESCARTAR" ? "Descartar" : "",
    depositanteDecisionNotes: row.decisao_observacoes?.trim() || "",
    depositanteDecisionAt: row.decisao_em,
    depositanteDecisionAtLabel: row.decisao_em ? formatDateTimePtBr(row.decisao_em) : "",
    depositanteDecisionBy: decisionBy?.nome?.trim() || "",
    resolutionNotes: row.resolucao_observacoes?.trim() || "",
    createdAt: row.created_at,
    createdAtLabel: formatDateTimePtBr(row.created_at),
    createdBy: createdBy?.nome?.trim() || "Sistema",
    resolvedAt: row.resolved_at,
    resolvedAtLabel: row.resolved_at ? formatDateTimePtBr(row.resolved_at) : "",
    resolvedBy: resolvedBy?.nome?.trim() || "",
  };
}

function inferQuarantineType(type: string | null, reason: string | null) {
  const normalizedType = type?.trim().toUpperCase();
  const normalizedReason = normalizeSearch(reason ?? "");

  if (normalizedType === "AVARIA" || normalizedReason.includes("avaria")) return "AVARIA";
  if (normalizedType === "VENCIMENTO" || normalizedReason.includes("vencimento")) return "VENCIMENTO";
  if (normalizedType === "RECEBIMENTO") return "RECEBIMENTO";
  return normalizedType || "OUTRO";
}

function mapPendingAddressingHold(row: PendingAddressingStockRow): StockQuarantineItem {
  const quantity = Number(row.quantidade ?? 0);
  const product = firstRelation(row.produto);
  const depositante = firstRelation(row.depositante);
  const endereco = firstRelation(row.endereco);
  const createdAt = row.bloqueado_em || row.created_at;
  const enderecoLabel = endereco?.codigo?.trim() || "Endereço de triagem";

  return {
    id: `pending-addressing:${row.id}`,
    depositanteId: row.depositante_id,
    productId: row.produto_id,
    stockId: row.id,
    addressId: row.endereco_id,
    depositante: depositante?.nome?.trim() || "Sem depositante",
    sku: product?.sku?.trim() || product?.codigo_interno?.trim() || "SKU",
    productName: product?.nome?.trim() || "Produto sem descrição",
    internalCode: product?.codigo_interno?.trim() || "",
    imageUrl: product?.imagem_principal_url ?? null,
    endereco: enderecoLabel,
    area: formatArea(endereco?.area),
    quantity,
    quantityLabel: quantity.toLocaleString("pt-BR"),
    reason:
      `Saldo bloqueado automaticamente em ${enderecoLabel} porque o produto ainda não tem endereço definitivo/padrão. ` +
      "Defina ou movimente para o endereço correto para liberar a operação.",
    tipo: "OUTRO",
    fotoUrl: null,
    status: "EM_QUARENTENA",
    statusLabel: "Em quarentena",
    depositanteDecision: "",
    depositanteDecisionLabel: "",
    depositanteDecisionNotes: "",
    depositanteDecisionAt: null,
    depositanteDecisionAtLabel: "",
    depositanteDecisionBy: "",
    resolutionNotes: "",
    createdAt,
    createdAtLabel: formatDateTimePtBr(createdAt),
    createdBy: "Sistema",
    resolvedAt: null,
    resolvedAtLabel: "",
    resolvedBy: "",
    isSystemHold: true,
    resolutionHint: "Resolver por movimentação interna para o endereço definitivo do produto.",
  };
}

function mapMissingDefaultAddressProduct(row: MissingDefaultAddressProductRow, quantity: number): StockQuarantineItem {
  const depositante = firstRelation(row.depositante);
  const createdAt = row.created_at || new Date(0).toISOString();

  return {
    id: `missing-default-address:${row.id}`,
    depositanteId: row.depositante_id,
    productId: row.id,
    stockId: null,
    addressId: null,
    depositante: depositante?.nome?.trim() || "Sem depositante",
    sku: row.sku?.trim() || row.codigo_interno?.trim() || "SKU",
    productName: row.nome?.trim() || "Produto sem descrição",
    internalCode: row.codigo_interno?.trim() || "",
    imageUrl: row.imagem_principal_url ?? null,
    endereco: "Sem endereço padrão",
    area: "Recebimento",
    quantity,
    quantityLabel: quantity.toLocaleString("pt-BR"),
    reason:
      "Produto ativo sem endereço padrão para recebimento. Cadastre o endereço padrão no produto para evitar triagem manual e bloqueios operacionais.",
    tipo: "OUTRO",
    fotoUrl: null,
    status: "SEM_ENDERECO_PADRAO",
    statusLabel: "Sem endereço padrão",
    depositanteDecision: "",
    depositanteDecisionLabel: "",
    depositanteDecisionNotes: "",
    depositanteDecisionAt: null,
    depositanteDecisionAtLabel: "",
    depositanteDecisionBy: "",
    resolutionNotes: "",
    createdAt,
    createdAtLabel: row.created_at ? formatDateTimePtBr(row.created_at) : "Cadastro sem data",
    createdBy: "Cadastro de produto",
    resolvedAt: null,
    resolvedAtLabel: "",
    resolvedBy: "",
    isMissingDefaultAddress: true,
    resolutionHint: "Editar o produto e definir o endereço padrão de recebimento.",
  };
}

function isPendingAddressingHold(row: PendingAddressingStockRow) {
  const reason = normalizeSearch(row.bloqueio_motivo ?? "");
  return (
    reason === normalizeSearch(PENDING_ADDRESSING_BLOCK_REASON) ||
    (reason.includes("aguardando endere") && reason.includes("triagem"))
  );
}

function firstRelation<T>(value: Relation<T>) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatStatus(value: string) {
  switch (value) {
    case "EM_QUARENTENA":
      return "Em quarentena";
    case "LIBERADO":
      return "Liberado";
    case "DESCARTADO":
      return "Descartado";
    default:
      return value;
  }
}

function formatArea(value?: string | null) {
  if (!value) return "Sem area";
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1).toLocaleLowerCase("pt-BR");
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
