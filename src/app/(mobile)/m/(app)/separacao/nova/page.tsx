import { requireModuleAccess } from "@/lib/auth";
import { listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";
import { MobileWaveCreateForm } from "@/components/mobile/mobile-wave-create-form";

export default async function MobileNovaOndaPage() {
  const user = await requireModuleAccess("expedicao");

  const orders = await listShippingPickingOrdersFromDb(user, { status: "NOVO" });

  return (
    <MobileWaveCreateForm
      orders={orders.map((order) => ({
        id: order.id,
        displayNumber: order.displayNumber,
        depositante: order.depositante,
        marketplace: order.marketplace,
        totalItems: order.totalItems,
        totalUnits: order.totalUnits,
      }))}
    />
  );
}
