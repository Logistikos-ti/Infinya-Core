import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { SaldoInicialProdutoListClient } from "./saldo-inicial-produto-list-client";

export default async function MobileSaldoInicialProdutosPage({
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

  const { data: produtosRows } = await adminSupabase
    .from("produtos")
    .select("id, nome, sku, imagem_principal_url, exige_lote, exige_validade")
    .eq("depositante_id", depositanteId)
    .eq("ativo", true)
    .order("nome");

  const produtos = (produtosRows ?? []).map((item) => ({
    produtoId: item.id,
    nome: item.nome,
    sku: item.sku ?? "Sem SKU",
    imagemUrl: item.imagem_principal_url ?? null,
    exigeLote: Boolean(item.exige_lote),
    exigeValidade: Boolean(item.exige_validade),
  }));

  return (
    <SaldoInicialProdutoListClient
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      produtos={produtos}
    />
  );
}
