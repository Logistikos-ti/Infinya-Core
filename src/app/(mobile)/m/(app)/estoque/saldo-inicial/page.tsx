import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { SaldoInicialDepositanteListClient } from "./saldo-inicial-depositante-list-client";

export default async function MobileSaldoInicialDepositantesPage() {
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

  const { data: produtosRows } = await adminSupabase
    .from("produtos")
    .select("id, depositante_id")
    .eq("ativo", true);

  const countByDepositante = new Map<string, number>();
  for (const item of produtosRows ?? []) {
    if (!visibleIds.has(item.depositante_id)) continue;
    countByDepositante.set(item.depositante_id, (countByDepositante.get(item.depositante_id) ?? 0) + 1);
  }

  const depositantes = visibleDepositantes
    .map((dep) => ({
      id: dep.id,
      nome: dep.nome,
      codigo: dep.codigo,
      logoUrl: dep.logo_url ?? null,
      produtosAtivos: countByDepositante.get(dep.id) ?? 0,
    }))
    .filter((dep) => dep.produtosAtivos > 0);

  return <SaldoInicialDepositanteListClient depositantes={depositantes} />;
}
