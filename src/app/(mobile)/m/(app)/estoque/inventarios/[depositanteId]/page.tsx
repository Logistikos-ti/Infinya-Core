import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { InventarioProdutoListClient } from "./inventario-produto-list-client";

type RelationName =
  | { nome?: string; sku?: string; imagem_principal_url?: string | null }
  | Array<{ nome?: string; sku?: string; imagem_principal_url?: string | null }>
  | null;

function extractField(value: RelationName, field: "nome" | "sku" | "imagem_principal_url") {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.[field] ?? "";
}

export default async function MobileStockInventarioProdutosPage({
  params,
}: {
  params: Promise<{ depositanteId: string }>;
}) {
  const { depositanteId } = await params;
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

  const { data: estoqueRows } = await adminSupabase
    .from("estoque")
    .select("id, quantidade, produto:produtos(nome, sku, imagem_principal_url)")
    .eq("depositante_id", depositanteId)
    .order("created_at", { ascending: true });

  const produtos = (estoqueRows ?? []).map((row) => ({
    estoqueId: row.id,
    nome: extractField(row.produto, "nome") || "Produto",
    sku: extractField(row.produto, "sku") || "Sem SKU",
    imagemUrl: extractField(row.produto, "imagem_principal_url") || null,
  }));

  return (
    <InventarioProdutoListClient
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      produtos={produtos}
    />
  );
}
