import { notFound } from "next/navigation";
import { MobileReceivingPanel } from "@/components/mobile/mobile-receiving-panel";
import { requireModuleAccess } from "@/lib/auth";
import { getReceivingOrderDetailFromDb } from "@/lib/receiving";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MobileReceivingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MobileReceivingDetailPage({
  params,
}: MobileReceivingDetailPageProps) {
  await requireModuleAccess("recebimento");
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [order, stagingAddresses] = await Promise.all([
    getReceivingOrderDetailFromDb(id),
    supabase
      .from("enderecos")
      .select("id, codigo, area")
      .eq("ativo", true)
      .in("area", ["RECEBIMENTO", "PULMAO"])
      .order("codigo"),
  ]);

  if (!order) {
    notFound();
  }

  // Prefer dedicated receiving/staging addresses, but fall back to every
  // non-blocked address if the warehouse hasn't set any up yet -- an empty
  // destination selector would block finishing the receiving entirely.
  const addresses = stagingAddresses.data?.length
    ? stagingAddresses
    : await supabase
        .from("enderecos")
        .select("id, codigo, area")
        .eq("ativo", true)
        .neq("area", "BLOQUEADO")
        .order("codigo");

  return (
    <MobileReceivingPanel
      orderId={order.id}
      orderCode={order.code}
      depositante={order.depositante}
      supplier={order.supplier}
      status={order.status}
      eta={order.eta}
      noteNumber={order.noteNumber}
      volumes={order.volumes}
      skuCount={order.skuCount}
      initialItems={order.items}
      addresses={addresses.data ?? []}
    />
  );
}
