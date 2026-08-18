"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function requestPortalOrderCancellationAction(orderId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireRoleAccess(["DEPOSITANTE", "ADMIN", "TI", "OPERADOR"]);
    const admin = createSupabaseAdminClient();
    
    if (!message || !message.trim()) {
      return { ok: false, error: "Informe a mensagem para solicitar o cancelamento." };
    }

    const { data: order, error: readError } = await admin
      .from("pedidos_expedicao")
      .select("id, status, depositante_id, payload_origem, codigo, numero_wms, numero_pedido")
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

    const pedidoIdentificador = order.numero_wms || order.codigo || order.numero_pedido || orderId;

    // 1. Create Support Ticket
    const subject = "Cancelamento de pedido " + pedidoIdentificador;
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

    // 2. Update Order to Divergence / Aguardando Tratativa
    const payload = (typeof order.payload_origem === "object" && order.payload_origem !== null) ? order.payload_origem as Record<string, unknown> : {};

    const { error: updateError } = await admin
      .from("pedidos_expedicao")
      .update({
        payload_origem: {
          ...payload,
          divergenciaTratada: false,
          divergencia: {
            motivo: "Solicitação de cancelamento pelo depositante via chamado.",
            tipo: "Cancelamento",
            chamado_id: ticket.id,
            registradoPorNome: user.nome,
          },
          cancellationReporter: user.id,
          cancellationReason: message,
        }
      })
      .eq("id", orderId);

    if (updateError) {
      throw updateError;
    }

    revalidatePath("/portal");
    return { ok: true };
  } catch (error) {
    console.error("Failed to request order cancellation from portal:", error);
    return { ok: false, error: "Ocorreu um erro ao solicitar o cancelamento." };
  }
}
