import { requireModuleAccess } from "@/lib/auth";
import { listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";
import { ShippingPickingWavesView } from "@/components/shipping/shipping-picking-waves-view";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { listActivePickingWavesAction } from "./actions";

export default async function ExpedicaoSeparacaoPage() {
  const user = await requireModuleAccess("expedicao");
  
  const supabase = createSupabaseAdminClient();
  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  const orders = await listShippingPickingOrdersFromDb(user, {});
  const activeWaves = await listActivePickingWavesAction();

  return <ShippingPickingWavesView orders={orders} depositantes={depositanteOptions} initialWaves={activeWaves} />;
}
