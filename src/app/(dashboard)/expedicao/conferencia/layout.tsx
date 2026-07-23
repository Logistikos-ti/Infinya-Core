import { ReactNode } from "react";
import { requireModuleAccess } from "@/lib/auth";
import { listShippingConferenceOrdersFromDb } from "@/lib/shipping-conference";
import { ShippingConferenceSplitLayout } from "@/components/shipping/shipping-conference-split-layout";

export default async function ConferenceLayout({ children }: { children: ReactNode }) {
  const user = await requireModuleAccess("expedicao");
  
  // Fetch active queue orders to populate the sidebar.
  // We fetch without heavy filters so the client component can filter locally.
  const orders = await listShippingConferenceOrdersFromDb(user, {});

  return <ShippingConferenceSplitLayout initialOrders={orders}>{children}</ShippingConferenceSplitLayout>;
}
