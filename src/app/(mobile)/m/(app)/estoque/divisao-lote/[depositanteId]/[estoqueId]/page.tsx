import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { MobileLotSplitPanel } from "./mobile-lot-split-panel";

type ProductRow = {
  nome?: string;
  sku?: string;
  codigo_externo?: string | null;
  codigo_interno?: string | null;
  imagem_principal_url?: string | null;
};

type ProductRelation = ProductRow | ProductRow[] | null;
type EnderecoRelation = { codigo?: string } | Array<{ codigo?: string }> | null;

function pickProdutoRow(value: ProductRelation) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function extractEndereco(value: EnderecoRelation) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.codigo ?? "";
}

export default async function MobileDivisaoLoteFlowPage({
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
      "id, quantidade, quantidade_reservada, bloqueado, lote, validade_em, produto:produtos(nome, sku, codigo_externo, codigo_interno, imagem_principal_url), endereco:enderecos(codigo)",
    )
    .eq("id", estoqueId)
    .eq("depositante_id", depositanteId)
    .maybeSingle();

  if (!estoqueRow || estoqueRow.bloqueado) {
    notFound();
  }

  const disponivel = Number(estoqueRow.quantidade ?? 0) - Number(estoqueRow.quantidade_reservada ?? 0);

  if (disponivel <= 0) {
    notFound();
  }

  const produtoRow = pickProdutoRow(estoqueRow.produto);

  return (
    <MobileLotSplitPanel
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      estoqueId={estoqueRow.id}
      produtoNome={produtoRow?.nome || "Produto"}
      produtoSku={produtoRow?.sku || "Sem SKU"}
      produtoBarcode={produtoRow?.codigo_externo ?? null}
      produtoCodigoInterno={produtoRow?.codigo_interno ?? null}
      produtoImagemUrl={produtoRow?.imagem_principal_url ?? null}
      enderecoCodigo={extractEndereco(estoqueRow.endereco) || "Sem endereço"}
      loteOrigem={estoqueRow.lote}
      validadeOrigem={estoqueRow.validade_em}
      disponivel={disponivel}
    />
  );
}
