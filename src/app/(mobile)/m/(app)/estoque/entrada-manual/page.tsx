import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { listStockBalancesFromDb } from "@/lib/stock";
import { EntradaManualDepositanteListClient } from "./entrada-manual-depositante-list-client";

export default async function MobileEntradaManualDepositantesPage() {
  const user = await getCurrentUserContext();

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "estoque")) {
    redirect("/m/inicio");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositantesRows } = await adminSupabase
    .from("depositantes")
    .select("id, nome, codigo, logo_url")
    .eq("ativo", true)
    .order("nome");

  const visibleDepositantes = filterDepositanteOptionsByUser(user, depositantesRows ?? []);
  const visibleIds = new Set(visibleDepositantes.map((item) => item.id));

  const balances = await listStockBalancesFromDb();
  const countByDepositante = new Map<string, number>();
  for (const item of balances) {
    if (item.status !== "Disponível") continue;
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

  return <EntradaManualDepositanteListClient depositantes={depositantes} />;
}
