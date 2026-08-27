"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { openShippingOrderCancellation } from "@/app/(dashboard)/expedicao/cancelamento/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { formatWmsOrderNumber } from "@/lib/shipping-order-number";

export async function requestPortalOrderCancellationAction(orderId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireRoleAccess(["DEPOSITANTE", "ADMIN", "TI", "OPERADOR"]);
    const admin = createSupabaseAdminClient();

    if (!message || !message.trim()) {
      return { ok: false, error: "Informe a mensagem para solicitar o cancelamento." };
    }

    const { data: order, error: readError } = await admin
      .from("pedidos_expedicao")
      .select(`
        id, status, depositante_id, payload_origem, codigo, numero_wms, numero_pedido,
        depositantes (nome)
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (readError || !order) {
      return { ok: false, error: "Pedido não encontrado." };
    }

    if (user.papel === "DEPOSITANTE" && user.depositanteId !== order.depositante_id) {
      return { ok: false, error: "Sem permissão para cancelar este pedido." };
    }

    if (order.status === "EXPEDIDO") {
      return { ok: false, error: "O pedido já foi expedido e não pode ser cancelado." };
    }

    if (order.status === "CANCELADO") {
      return { ok: false, error: "O pedido já está cancelado." };
    }

    const depositanteNome = order.depositantes && typeof order.depositantes === "object" && !Array.isArray(order.depositantes)
      ? (order.depositantes as { nome: string }).nome
      : null;

    const formattedOrderNumber = formatWmsOrderNumber(order.numero_wms, order.codigo || order.numero_pedido || orderId, depositanteNome);

    // Support ticket kept as the audit/communication record of who asked to
    // cancel and why -- but the cancellation now happens for real instead of
    // just flagging for a manual warehouse decision.
    const subject = "Cancelamento de pedido " + formattedOrderNumber;
    const { data: ticket, error: ticketError } = await admin
      .from("suporte_chamados")
      .insert({
        depositante_id: order.depositante_id,
        criado_por: user.id,
        assunto: subject,
        categoria: "Cancelamento",
      })
      .select("id")
      .single();

    if (ticketError || !ticket) {
      throw ticketError || new Error("Não foi possível criar o chamado.");
    }

    const { error: commentError } = await admin
      .from("suporte_comentarios")
      .insert({ chamado_id: ticket.id, autor_id: user.id, texto: message });

    if (commentError) {
      throw commentError;
    }

    // Route into the single cancellation entry point: if goods were already
    // separated (status past NOVO with picked items), this moves the order to
    // EM_CANCELAMENTO and the warehouse must scan the physical return to stock
    // before it becomes CANCELADO; if nothing was separated, it cancels
    // instantly. See src/app/(dashboard)/expedicao/cancelamento/actions.ts.
    const result = await openShippingOrderCancellation({
      orderId,
      motivo: `Cancelamento solicitado pelo depositante (${user.nome}): ${message.trim()}`,
      user,
    });

    if (!result.ok) {
      return { ok: false, error: result.message };
    }

    revalidatePath("/portal");
    revalidatePath("/expedicao");
    revalidatePath("/expedicao/cancelamento");
    return { ok: true };
  } catch (error) {
    console.error("Failed to request order cancellation from portal:", error);
    return { ok: false, error: "Ocorreu um erro ao solicitar o cancelamento." };
  }
}
