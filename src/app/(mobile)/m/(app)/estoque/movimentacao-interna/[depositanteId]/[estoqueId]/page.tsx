import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PENDING_ADDRESSING_BLOCK_REASON } from "@/lib/stock-blocking";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { MobileStockTransferPanel } from "./mobile-stock-transfer-panel";

type RelationName =
  | {
      nome?: string;
      sku?: string;
      codigo?: string;
      area?: string;
      imagem_principal_url?: string | null;
    }
  | Array<{
      nome?: string;
      sku?: string;
      codigo?: string;
      area?: string;
      imagem_principal_url?: string | null;
    }>
  | null;

function extractField(
  value: RelationName,
  field: "nome" | "sku" | "codigo" | "area" | "imagem_principal_url",
) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.[field] ?? "";
}

export default async function MobileStockTransferFlowPage({
  params,
}: {
  params: Promise<{ depositanteId: string; estoqueId: string }>;
}) {
  const { depositanteId, estoqueId } = await params;
  const user = await getCurrentUserContext();

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "estoque")) {
    redirect("/m/inicio");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositanteRow } = await adminSupabase
    .from("depositantes")
    .select("id, nome")
    .eq("id", depositanteId)
    .eq("ativo", true)
    .maybeSingle();

  if (!depositanteRow || !filterDepositanteOptionsByUser(user, [depositanteRow]).length) {
    notFound();
  }

  const { data: estoqueRow } = await adminSupabase
    .from("estoque")
    .select(
      "id, quantidade, quantidade_reservada, bloqueado, bloqueio_motivo, endereco_id, produto:produtos(nome, sku, imagem_principal_url), endereco:enderecos(codigo, area)",
    )
    .eq("id", estoqueId)
    .eq("depositante_id", depositanteId)
    .maybeSingle();

  // Stock blocked while waiting to be addressed is still a valid transfer
  // source here — moving it out is exactly how that hold gets resolved. Any
  // other block reason (manual/quality hold) stays off-limits.
  const isTransferablePendingAddressing =
    estoqueRow?.bloqueado && estoqueRow.bloqueio_motivo === PENDING_ADDRESSING_BLOCK_REASON;

  if (!estoqueRow || (estoqueRow.bloqueado && !isTransferablePendingAddressing)) {
    notFound();
  }

  const disponivel = Number(estoqueRow.quantidade ?? 0) - Number(estoqueRow.quantidade_reservada ?? 0);

  if (disponivel <= 0) {
    notFound();
  }

  const { data: enderecosRows } = await adminSupabase
    .from("enderecos")
    .select("id, codigo")
    .eq("ativo", true)
    .neq("id", estoqueRow.endereco_id)
    .order("codigo");

  return (
    <MobileStockTransferPanel
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      estoqueId={estoqueRow.id}
      produtoNome={extractField(estoqueRow.produto, "nome") || "Produto"}
      produtoSku={extractField(estoqueRow.produto, "sku") || "Sem SKU"}
      produtoImagemUrl={extractField(estoqueRow.produto, "imagem_principal_url") || null}
      origemCodigo={extractField(estoqueRow.endereco, "codigo") || "Sem endereço"}
      disponivel={disponivel}
      destinos={(enderecosRows ?? []).map((row) => ({ id: row.id, codigo: row.codigo }))}
    />
  );
}
