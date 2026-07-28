import { requireModuleAccess } from "@/lib/auth";
import { listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { MobileWaveCreateForm } from "@/components/mobile/mobile-wave-create-form";

export default async function MobileNovaOndaPage() {
  const user = await requireModuleAccess("expedicao");

  const supabase = createSupabaseAdminClient();
  const [orders, { data: rawDepositantes }] = await Promise.all([
    listShippingPickingOrdersFromDb(user, { status: "NOVO" }),
    supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  const depositantes = filterDepositanteOptionsByUser(user, rawDepositantes ?? []);

  return (
    <MobileWaveCreateForm
      orders={orders.map((order) => ({
        id: order.id,
        displayNumber: order.displayNumber,
        depositanteId: order.depositanteId,
        depositante: order.depositante,
        marketplace: order.marketplace,
        totalItems: order.totalItems,
        totalUnits: order.totalUnits,
      }))}
      depositantes={depositantes.map((item) => ({ id: item.id, nome: item.nome }))}
    />
  );
}
