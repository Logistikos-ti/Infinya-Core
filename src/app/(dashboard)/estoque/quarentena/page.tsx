import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants, isAdminUser } from "@/lib/permissions";
import { listStockQuarantineFromDb } from "@/lib/stock-quarantine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { StockQuarantinePageClient } from "@/components/estoque/stock-quarantine-page-client";

type QuarantineSearchParams = {
  depositante?: string;
  status?: string;
  q?: string;
};

export default async function StockQuarantinePage({
  searchParams,
}: {
  searchParams?: Promise<QuarantineSearchParams>;
}) {
  const user = await requireModuleAccess("estoque");
  const params = (await searchParams) ?? {};
  const status = params.status?.trim() || "EM_QUARENTENA";
  const productTerm = params.q?.trim() || "";
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

  const allQuarantineItems = await listStockQuarantineFromDb({
    depositanteId: effectiveDepositanteId || undefined,
    productTerm: productTerm || undefined,
  });

  const filteredItems =
    status === "TODOS"
      ? allQuarantineItems
      : allQuarantineItems.filter((item) => item.status === status);

  return (
    <StockQuarantinePageClient
      depositantes={depositanteOptions}
      items={filteredItems}
      allItems={allQuarantineItems}
      initialDepositanteId={effectiveDepositanteId}
      initialStatus={status}
      initialQuery={productTerm}
      canSelectDepositante={canManageMultipleTenants(user)}
      canConfirm={isAdminUser(user) || user.papel === "TI" || user.papel === "OPERADOR"}
    />
  );
}
