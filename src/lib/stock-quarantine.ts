import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
  status: string;
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
  resolvido_por: Relation<{ nome?: string | null }>;
};

export type StockQuarantineFilters = {
  depositanteId?: string;
  status?: string;
  productTerm?: string;
  limit?: number;
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
  status: string;
  statusLabel: string;
  resolutionNotes: string;
  createdAt: string;
  createdAtLabel: string;
  createdBy: string;
  resolvedAt: string | null;
  resolvedAtLabel: string;
  resolvedBy: string;
};

export async function listStockQuarantineFromDb(filters?: StockQuarantineFilters) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("estoque_quarentena")
    .select(
      "id, depositante_id, produto_id, estoque_id, endereco_id, quantidade, motivo, status, resolucao_observacoes, created_at, resolved_at, depositante:depositantes(nome), produto:produtos(sku, nome, codigo_interno, imagem_principal_url), endereco:enderecos(codigo, area), criado_por:usuarios!estoque_quarentena_criado_por_fkey(nome), resolvido_por:usuarios!estoque_quarentena_resolvido_por_fkey(nome)",
    )
    .order("created_at", { ascending: false });

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  if (filters?.status && filters.status !== "TODOS") {
    query = query.eq("status", filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "42P01" || error.message.includes("schema cache")) {
      return [];
    }
    throw new Error(`Nao foi possivel carregar a quarentena: ${error.message}`);
  }

  const rows = ((data ?? []) as QuarantineRow[]).map(mapQuarantineRow);

  if (!filters?.productTerm) return rows;

  const queryText = normalizeSearch(filters.productTerm);
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
}: {
  stockId: string;
  quantity: number;
  reason: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("criar_quarentena_estoque", {
    p_estoque_id: stockId,
    p_quantidade: quantity,
    p_motivo: reason,
    p_usuario_id: userId,
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
  action: "release" | "discard";
  userId: string;
  observations?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("resolver_quarentena_estoque", {
    p_quarentena_id: quarantineId,
    p_acao: action === "release" ? "LIBERAR" : "DESCARTAR",
    p_usuario_id: userId,
    p_observacoes: observations ?? null,
  });

  if (error) {
    throw new Error(error.message || "Nao foi possivel resolver a quarentena.");
  }
}

function mapQuarantineRow(row: QuarantineRow): StockQuarantineItem {
  const quantity = Number(row.quantidade ?? 0);
  const product = firstRelation(row.produto);
  const depositante = firstRelation(row.depositante);
  const endereco = firstRelation(row.endereco);
  const createdBy = firstRelation(row.criado_por);
  const resolvedBy = firstRelation(row.resolvido_por);

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
    status: row.status,
    statusLabel: formatStatus(row.status),
    resolutionNotes: row.resolucao_observacoes?.trim() || "",
    createdAt: row.created_at,
    createdAtLabel: formatDateTimePtBr(row.created_at),
    createdBy: createdBy?.nome?.trim() || "Sistema",
    resolvedAt: row.resolved_at,
    resolvedAtLabel: row.resolved_at ? formatDateTimePtBr(row.resolved_at) : "",
    resolvedBy: resolvedBy?.nome?.trim() || "",
  };
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
