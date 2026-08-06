import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { MobileCycleCountPanel } from "./mobile-cycle-count-panel";

type RelationName =
  | {
      nome?: string;
      sku?: string;
      codigo?: string;
      area?: string;
      codigo_externo?: string | null;
      codigo_interno?: string | null;
      imagem_principal_url?: string | null;
    }
  | Array<{
      nome?: string;
      sku?: string;
      codigo?: string;
      area?: string;
      codigo_externo?: string | null;
      codigo_interno?: string | null;
      imagem_principal_url?: string | null;
    }>
  | null;

function extractField(
  value: RelationName,
  field: "nome" | "sku" | "codigo" | "area" | "codigo_externo" | "codigo_interno" | "imagem_principal_url",
) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.[field] ?? "";
}

export default async function MobileStockCycleCountPage({
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

  // No .gt("quantidade", 0) filter here anymore: /api/estoque/inventario-resolver
  // opens a fresh quantidade=0 row when the operator bips a produto+endereço
  // combination with no prior balance (a "blind count" against 0 expected),
  // and that row needs to load here just like any other.
  const { data: estoqueRow } = await adminSupabase
    .from("estoque")
    .select(
      "id, quantidade, produto:produtos(nome, sku, codigo_externo, codigo_interno, imagem_principal_url), endereco:enderecos(codigo, area)",
    )
    .eq("id", estoqueId)
    .eq("depositante_id", depositanteId)
    .maybeSingle();

  if (!estoqueRow) {
    notFound();
  }

  return (
    <MobileCycleCountPanel
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      estoqueId={estoqueRow.id}
      produtoNome={extractField(estoqueRow.produto, "nome") || "Produto"}
      produtoSku={extractField(estoqueRow.produto, "sku") || "Sem SKU"}
      produtoBarcode={extractField(estoqueRow.produto, "codigo_externo") || null}
      produtoCodigoInterno={extractField(estoqueRow.produto, "codigo_interno") || null}
      produtoImagemUrl={extractField(estoqueRow.produto, "imagem_principal_url") || null}
      enderecoCodigo={extractField(estoqueRow.endereco, "codigo") || "Sem endereço"}
      enderecoArea={extractField(estoqueRow.endereco, "area")}
      quantidadeSistema={Number(estoqueRow.quantidade ?? 0)}
    />
  );
}
