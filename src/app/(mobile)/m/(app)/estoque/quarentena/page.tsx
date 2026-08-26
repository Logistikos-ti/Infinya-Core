import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { listStockBalancesFromDb } from "@/lib/stock";
import { QuarentenaDepositanteListClient } from "./quarentena-depositante-list-client";

export default async function MobileQuarentenaDepositantesPage() {
  const adminSupabase = createSupabaseAdminClient();

  const [user, { data: depositantesRows }, balances] = await Promise.all([
    getCurrentUserContext(),
    adminSupabase
      .from("depositantes")
      .select("id, nome, codigo, logo_url")
      .eq("ativo", true)
      .order("nome"),
    listStockBalancesFromDb(),
  ]);

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "estoque")) {
    redirect("/m/inicio");
  }

  const visibleDepositantes = filterDepositanteOptionsByUser(user, depositantesRows ?? []);
  const visibleIds = new Set(visibleDepositantes.map((item) => item.id));

  const countByDepositante = new Map<string, number>();
  for (const item of balances) {
    if (item.status !== "Disponível" || item.rawQuantidade - item.rawReserved <= 0) continue;
    if (!visibleIds.has(item.depositanteId)) continue;
    countByDepositante.set(item.depositanteId, (countByDepositante.get(item.depositanteId) ?? 0) + 1);
  }

  const depositantes = visibleDepositantes
    .map((dep) => ({
      id: dep.id,
      nome: dep.nome,
      codigo: dep.codigo,
      logoUrl: dep.logo_url ?? null,
      produtosDisponiveis: countByDepositante.get(dep.id) ?? 0,
    }))
    .filter((dep) => dep.produtosDisponiveis > 0);

  return <QuarentenaDepositanteListClient depositantes={depositantes} />;
}
