import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { MobileManualEntryPanel } from "./mobile-manual-entry-panel";

type RelationName =
  | {
      nome?: string;
      sku?: string;
      codigo?: string;
      codigo_externo?: string | null;
      codigo_interno?: string | null;
      imagem_principal_url?: string | null;
    }
  | Array<{
      nome?: string;
      sku?: string;
      codigo?: string;
      codigo_externo?: string | null;
      codigo_interno?: string | null;
      imagem_principal_url?: string | null;
    }>
  | null;

function extractField(
  value: RelationName,
  field: "nome" | "sku" | "codigo" | "codigo_externo" | "codigo_interno" | "imagem_principal_url",
) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.[field] ?? "";
}

export default async function MobileEntradaManualFlowPage({
  params,
}: {
  params: Promise<{ depositanteId: string; estoqueId: string }>;
}) {
  const { depositanteId, estoqueId } = await params;
  const adminSupabase = createSupabaseAdminClient();

  const [user, { data: depositanteRow }] = await Promise.all([
    getCurrentUserContext(),
    adminSupabase
      .from("depositantes")
      .select("id, nome")
      .eq("id", depositanteId)
      .eq("ativo", true)
      .maybeSingle(),
  ]);

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "estoque")) {
    redirect("/m/inicio");
  }

  if (!depositanteRow || !filterDepositanteOptionsByUser(user, [depositanteRow]).length) {
    notFound();
  }

  const { data: estoqueRow } = await adminSupabase
    .from("estoque")
    .select(
      "id, quantidade, bloqueado, produto:produtos(nome, sku, codigo_externo, codigo_interno, imagem_principal_url), endereco:enderecos(codigo)",
    )
    .eq("id", estoqueId)
    .eq("depositante_id", depositanteId)
    .maybeSingle();

  if (!estoqueRow || estoqueRow.bloqueado) {
    notFound();
  }

  return (
    <MobileManualEntryPanel
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      estoqueId={estoqueRow.id}
      produtoNome={extractField(estoqueRow.produto, "nome") || "Produto"}
      produtoSku={extractField(estoqueRow.produto, "sku") || "Sem SKU"}
      produtoBarcode={extractField(estoqueRow.produto, "codigo_externo") || null}
      produtoCodigoInterno={extractField(estoqueRow.produto, "codigo_interno") || null}
      produtoImagemUrl={extractField(estoqueRow.produto, "imagem_principal_url") || null}
      enderecoCodigo={extractField(estoqueRow.endereco, "codigo") || "Sem endereço"}
      atual={Number(estoqueRow.quantidade ?? 0)}
    />
  );
}
