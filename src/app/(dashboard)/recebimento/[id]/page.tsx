import { notFound } from "next/navigation";
import { ReceivingConferenceView } from "@/components/receiving/receiving-conference-view";
import { requireModuleAccess } from "@/lib/auth";
import { getReceivingOrderDetailFromDb, listOperationalIssuesFromDb } from "@/lib/receiving";
import { listDepositProtocolsByReceivingOrderId } from "@/lib/stock";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RecebimentoDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RecebimentoDetalhePage({
  params,
}: RecebimentoDetalhePageProps) {
  await requireModuleAccess("recebimento");

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [order, addresses] = await Promise.all([
    getReceivingOrderDetailFromDb(id),
    supabase
      .from("enderecos")
      .select("id, codigo, area")
      .eq("ativo", true)
      .neq("area", "BLOQUEADO")
      .order("codigo"),
  ]);

  if (!order) {
    notFound();
  }

  const [relatedIssues, generatedProtocols] = await Promise.all([
    listOperationalIssuesFromDb({ orderId: order.id, limit: 12 }),
    listDepositProtocolsByReceivingOrderId(order.id),
  ]);

  return (
    <ReceivingConferenceView
      orderId={order.id}
      orderCode={order.code}
      supplier={order.supplier}
      depositante={order.depositante}
      status={order.status}
      initialItems={order.items}
      addresses={addresses.data ?? []}
      relatedIssues={relatedIssues}
      generatedProtocols={generatedProtocols}
    />
  );
}
