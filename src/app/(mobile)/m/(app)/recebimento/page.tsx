import { requireModuleAccess } from "@/lib/auth";
import { listReceivingOrdersFromDb } from "@/lib/receiving";
import { RecebimentoListClient } from "./recebimento-list-client";

export default async function MobileReceivingQueuePage() {
  const user = await requireModuleAccess("recebimento");
  const orders = await listReceivingOrdersFromDb({
    depositanteId: user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined,
  });

  return (
    <RecebimentoListClient
      orders={orders}
      totalOrders={orders.length}
    />
  );
}
