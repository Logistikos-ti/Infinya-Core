import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { MobileQuarantinePanel } from "./mobile-quarantine-panel";

type ProductRelation =
  | {
      nome?: string;
      sku?: string;
      codigo_externo?: string | null;
      codigo_interno?: string | null;
      imagem_principal_url?: string | null;
    }
  | Array<{
      nome?: string;
      sku?: string;
      codigo_externo?: string | null;
      codigo_interno?: string | null;
      imagem_principal_url?: string | null;
    }>
  | null;

type EnderecoRelation = { codigo?: string } | Array<{ codigo?: string }> | null;

function extractProductField(
  value: ProductRelation,
  field: "nome" | "sku" | "codigo_externo" | "codigo_interno" | "imagem_principal_url",
) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.[field] ?? "";
}

function extractEndereco(value: EnderecoRelation) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.codigo ?? "";
}

export default async function MobileQuarentenaFlowPage({
  params,
}: {
  params: Promise<{ depositanteId: string; estoqueId: string }>;
}) {
  const { depositanteId, estoqueId } = await params;
  const adminSupabase = createSupabaseAdminClient();

  const [user, { data: depositanteRow }, { data: estoqueRow }] = await Promise.all([
    getCurrentUserContext(),
    adminSupabase
      .from("depositantes")
      .select("id, nome")
      .eq("id", depositanteId)
      .eq("ativo", true)
      .maybeSingle(),
    adminSupabase
      .from("estoque")
      .select(
        "id, quantidade, quantidade_reservada, bloqueado, produto:produtos(nome, sku, codigo_externo, codigo_interno, imagem_principal_url), endereco:enderecos(codigo)",
      )
      .eq("id", estoqueId)
      .eq("depositante_id", depositanteId)
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

  if (!estoqueRow || estoqueRow.bloqueado) {
    notFound();
  }

  const disponivel = Number(estoqueRow.quantidade ?? 0) - Number(estoqueRow.quantidade_reservada ?? 0);

  if (disponivel <= 0) {
    notFound();
  }

  return (
    <MobileQuarantinePanel
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      estoqueId={estoqueRow.id}
      produtoNome={extractProductField(estoqueRow.produto, "nome") || "Produto"}
      produtoSku={extractProductField(estoqueRow.produto, "sku") || "Sem SKU"}
      produtoBarcode={extractProductField(estoqueRow.produto, "codigo_externo") || null}
      produtoCodigoInterno={extractProductField(estoqueRow.produto, "codigo_interno") || null}
      produtoImagemUrl={extractProductField(estoqueRow.produto, "imagem_principal_url") || null}
      enderecoCodigo={extractEndereco(estoqueRow.endereco) || "Sem endereço"}
      disponivel={disponivel}
    />
  );
}
