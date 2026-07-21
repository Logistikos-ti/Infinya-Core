import { ShippingPickingWavesView } from "@/components/shipping/shipping-picking-waves-view";
import { requireModuleAccess } from "@/lib/auth";
import { listPickingOperatorsFromDb, listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type ExpedicaoSeparacaoPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    operador?: string;
    feedback?: string;
    ids?: string;
    page?: string;
    perPage?: string;
  }>;
};

export default async function ExpedicaoSeparacaoPage({
  searchParams,
}: ExpedicaoSeparacaoPageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = await searchParams;

  const statusFilter = params?.status?.trim() ?? "";
  const operatorFilter = params?.operador?.trim() ?? "";
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";

  const supabase = createSupabaseAdminClient();
  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome, ativo")
    .eq("ativo", true);

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  const [orders] = await Promise.all([
    listShippingPickingOrdersFromDb(user, {
      status: statusFilter || undefined,
      operatorId: operatorFilter || undefined,
      depositanteId: depositanteFilter || undefined,
    }),
    listPickingOperatorsFromDb(user, depositanteFilter || undefined),
  ]);

  return (
    <div className="relative opacity-95">
      <ShippingPickingWavesView 
        orders={orders} 
        depositantes={depositanteOptions}
      />
    </div>
  );
}
