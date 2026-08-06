import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { InventarioScanClient } from "./inventario-scan-client";

export default async function MobileStockInventarioProdutosPage({
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

  // The old "pick a saldo from the list" step is gone -- the camera opens
  // right here and asks for the two scans a count needs (produto, then
  // endereço) to resolve or open the saldo (see inventario-scan-client.tsx
  // and /api/estoque/inventario-resolver).
  return <InventarioScanClient depositanteId={depositanteId} depositanteNome={depositanteRow.nome} />;
}
