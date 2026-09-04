import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { listInventoryRuns } from "@/lib/inventory-runs";
import { listPickingOperatorsFromDb } from "@/lib/shipping-picking";
import { InventoryRunsPageClient } from "@/components/estoque/inventory-runs-page-client";

type InventoriosSearchParams = {
  depositante?: string;
};

export default async function EstoqueInventariosPage({
  searchParams,
}: {
  searchParams?: Promise<InventoriosSearchParams>;
}) {
  const user = await requireModuleAccess("estoque");
  const params = (await searchParams) ?? {};
  const requestedDepositanteId = params.depositante?.trim() || "";

  const supabase = createSupabaseAdminClient();
  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const visibleDepositanteIds = new Set(depositanteOptions.map((item) => item.id));
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE"
      ? user.depositanteId ?? ""
      : visibleDepositanteIds.has(requestedDepositanteId)
        ? requestedDepositanteId
        : "";

  const [runs, responsaveis] = await Promise.all([
    listInventoryRuns({ depositanteId: effectiveDepositanteId || undefined }),
    listPickingOperatorsFromDb(user, effectiveDepositanteId || undefined),
  ]);

  return (
    <InventoryRunsPageClient
      depositantes={depositanteOptions}
      responsaveis={responsaveis.map((item) => ({ id: item.id, nome: item.name }))}
      runs={runs}
      initialDepositanteId={effectiveDepositanteId}
      canSelectDepositante={canManageMultipleTenants(user)}
      currentUserId={user.id}
    />
  );
}
