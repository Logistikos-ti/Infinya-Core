import { notFound } from "next/navigation";
import { MobileShippingCancellationPanel } from "@/components/mobile/mobile-shipping-cancellation-panel";
import { requireModuleAccess } from "@/lib/auth";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MobileCancellationDetailPageProps = {
  params: Promise<{ id: string }>;
};

type Relation<T> = T | T[] | null;

function firstRelation<T>(value: Relation<T>) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function MobileCancellationDetailPage({
  params,
}: MobileCancellationDetailPageProps) {
  await requireModuleAccess("expedicao");
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data: cancelamento } = await supabase
    .from("pedidos_expedicao_cancelamentos")
    .select(
      "id, status, motivo, requer_bipagem, pedido:pedidos_expedicao(id, codigo, numero_wms, cliente_nome, depositante:depositantes(nome))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!cancelamento) {
    notFound();
  }

  const order = firstRelation(cancelamento.pedido);
  if (!order) {
    notFound();
  }

  const { data: lines } = await supabase
    .from("pedidos_expedicao_cancelamento_itens")
    .select(
      "id, produto_id, estoque_id, endereco_esperado_id, quantidade_esperada, quantidade_confirmada, quantidade_confirmada_avariada, status, produto:produtos(sku, nome, codigo_interno, imagem_principal_url), endereco:enderecos(codigo, area)",
    )
    .eq("cancelamento_id", cancelamento.id)
    .order("created_at", { ascending: true });

  const depositante = firstRelation(order.depositante);

  return (
    <MobileShippingCancellationPanel
      cancelamentoId={cancelamento.id}
      status={cancelamento.status}
      motivo={cancelamento.motivo}
      order={{
        id: order.id,
        orderNumber: formatWmsOrderNumber(order.numero_wms, order.codigo, depositante?.nome ?? null),
        depositante: depositante?.nome?.trim() || "Sem depositante",
        cliente: order.cliente_nome?.trim() || "Cliente não informado",
      }}
      lines={(lines ?? []).map((line) => {
        const produto = firstRelation(line.produto);
        const endereco = firstRelation(line.endereco);

        return {
          id: line.id,
          produtoId: line.produto_id,
          sku: produto?.sku?.trim() || produto?.codigo_interno?.trim() || "SKU",
          productName: produto?.nome?.trim() || "Produto sem descrição",
          imageUrl: produto?.imagem_principal_url ?? null,
          estoqueId: line.estoque_id,
          enderecoEsperadoId: line.endereco_esperado_id,
          enderecoEsperadoCodigo: endereco?.codigo?.trim() || null,
          quantidadeEsperada: Number(line.quantidade_esperada),
          quantidadeConfirmada: Number(line.quantidade_confirmada),
          quantidadeConfirmadaAvariada: Number(line.quantidade_confirmada_avariada),
          status: line.status as "PENDENTE" | "CONCLUIDO" | "DIVERGENTE",
        };
      })}
    />
  );
}
