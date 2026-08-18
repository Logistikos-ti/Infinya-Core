"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function releaseQuarantinedReceiving(orderId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { error: "Não autenticado." };
  }

  // 1. Get the order and make sure it is in QUARENTENA_CORRIGIDA
  const { data: order } = await supabase
    .from("pedidos_recebimento")
    .select("status, depositante_id")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "QUARENTENA_CORRIGIDA") {
    return { error: "Pedido não está em quarentena corrigida." };
  }

  // 2. Fetch all quarantined stock for this order
  const { data: quarantineItems } = await supabase
    .from("estoque_quarentena")
    .select("id, depositante_id, produto_id, quantidade, endereco_id, motivo, lote, validade_em")
    .eq("pedido_recebimento_id", orderId)
    .eq("status", "EM_QUARENTENA");

  if (quarantineItems && quarantineItems.length > 0) {
    // 3. Move items to available stock
    for (const qItem of quarantineItems) {
      // Find if stock row exists
      let stockQuery = supabase
        .from("estoque")
        .select("id, quantidade")
        .eq("depositante_id", qItem.depositante_id)
        .eq("produto_id", qItem.produto_id)
        .eq("endereco_id", qItem.endereco_id);

      if (qItem.lote) stockQuery = stockQuery.eq("lote", qItem.lote);
      else stockQuery = stockQuery.is("lote", null);

      if (qItem.validade_em) stockQuery = stockQuery.eq("validade_em", qItem.validade_em);
      else stockQuery = stockQuery.is("validade_em", null);

      const { data: existingStock } = await stockQuery.maybeSingle();

      if (existingStock) {
        await supabase
          .from("estoque")
          .update({ quantidade: Number(existingStock.quantidade) + Number(qItem.quantidade) })
          .eq("id", existingStock.id);
      } else {
        await supabase
          .from("estoque")
          .insert({
            depositante_id: qItem.depositante_id,
            produto_id: qItem.produto_id,
            endereco_id: qItem.endereco_id,
            quantidade: qItem.quantidade,
            lote: qItem.lote || "",
            validade_em: qItem.validade_em,
          });
      }

      // Mark quarantine item as LIBERADO
      await supabase
        .from("estoque_quarentena")
        .update({ status: "LIBERADO" })
        .eq("id", qItem.id);
    }
  }

  // 4. Update the order status to RECEBIDO
  await supabase
    .from("pedidos_recebimento")
    .update({ status: "RECEBIDO" })
    .eq("id", orderId);

  // 5. Close any open occurrence
  await supabase
    .from("ocorrencias_operacionais")
    .update({ status: "RESOLVIDA", resolvido_por: user.user.id, resolvido_em: new Date().toISOString() })
    .eq("pedido_recebimento_id", orderId)
    .eq("status", "ABERTA");

  revalidatePath(`/recebimento/${orderId}`);
  revalidatePath(`/recebimento`);
  
  return { success: true };
}
