import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { listStockBalancesFromDb } from "@/lib/stock";
import { EntradaManualProdutoListClient } from "./entrada-manual-produto-list-client";

export default async function MobileEntradaManualProdutosPage({
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

  const balances = await listStockBalancesFromDb({ depositanteId });
  const produtos = balances
    .filter((item) => item.status === "Disponível")
    .map((item) => ({
      estoqueId: item.id,
      nome: item.productName,
      sku: item.sku,
      endereco: item.endereco,
      area: item.area,
      atual: item.rawQuantidade,
      imagemUrl: item.imageUrl ?? null,
    }));

  return (
    <EntradaManualProdutoListClient
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      produtos={produtos}
    />
  );
}
