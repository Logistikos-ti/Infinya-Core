import { requireModuleAccess } from "@/lib/auth";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CancelamentoListClient } from "./cancelamento-list-client";

type Relation<T> = T | T[] | null;

function firstRelation<T>(value: Relation<T>) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function MobileCancellationQueuePage() {
  await requireModuleAccess("expedicao");

  const supabase = createSupabaseAdminClient();
  const { data: cancelamentos } = await supabase
    .from("pedidos_expedicao_cancelamentos")
    .select(
      "id, motivo, pedido:pedidos_expedicao(id, codigo, numero_wms, cliente_nome, depositante:depositantes(nome))",
    )
    .eq("status", "EM_ANDAMENTO")
    .order("aberto_em", { ascending: true });

  const rows = (cancelamentos ?? []).map((item) => {
    const order = firstRelation(item.pedido);
    const depositante = firstRelation(order?.depositante ?? null);

    return {
      id: item.id,
      orderNumber: order
        ? formatWmsOrderNumber(order.numero_wms, order.codigo, depositante?.nome ?? null)
        : "Pedido não encontrado",
      depositante: depositante?.nome?.trim() || "Sem depositante",
      cliente: order?.cliente_nome?.trim() || "Cliente não informado",
    };
  });

  return <CancelamentoListClient rows={rows} />;
}
