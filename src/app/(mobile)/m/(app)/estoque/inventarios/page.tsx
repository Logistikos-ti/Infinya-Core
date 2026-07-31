import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { InventarioDepositanteListClient } from "./inventario-depositante-list-client";

export default async function MobileStockInventariosPage() {
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
    .select("id, nome, codigo")
    .eq("ativo", true)
    .order("nome");

  const visibleDepositantes = filterDepositanteOptionsByUser(user, depositantesRows ?? []);
  const visibleIds = visibleDepositantes.map((item) => item.id);

  const { data: estoqueRows } = visibleIds.length
    ? await adminSupabase.from("estoque").select("depositante_id").in("depositante_id", visibleIds)
    : { data: [] };

  const countByDepositante = new Map<string, number>();
  for (const row of estoqueRows ?? []) {
    countByDepositante.set(row.depositante_id, (countByDepositante.get(row.depositante_id) ?? 0) + 1);
  }

  const depositantes = visibleDepositantes
    .map((dep) => ({
      id: dep.id,
      nome: dep.nome,
      codigo: dep.codigo,
      produtosEmEstoque: countByDepositante.get(dep.id) ?? 0,
    }))
    .filter((dep) => dep.produtosEmEstoque > 0);

  return <InventarioDepositanteListClient depositantes={depositantes} />;
}
