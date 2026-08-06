import { requireRoleAccess } from "@/lib/auth";
import { listShippingStockReconciliation } from "@/lib/shipping-stock-reconciliation";
import { ShippingStockReconciliationClient } from "@/components/estoque/shipping-stock-reconciliation-client";

export default async function ShippingStockReconciliationPage() {
  await requireRoleAccess(["ADMIN", "TI"]);
  const data = await listShippingStockReconciliation();
  return <ShippingStockReconciliationClient initialData={data} />;
}
