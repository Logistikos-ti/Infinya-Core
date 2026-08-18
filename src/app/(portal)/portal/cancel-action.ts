"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function cancelPortalOrderAction(orderId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireRoleAccess(["DEPOSITANTE", "ADMIN", "TI", "OPERADOR"]);
    const admin = createSupabaseAdminClient();
    
    const { data: order, error: readError } = await admin
      .from("pedidos_expedicao")
      .select("id, status, depositante_id, payload_origem")
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

    // Try to reverse any stock movements in case it was already picked or being picked
    const { error: reversalError } = await admin.rpc("estornar_baixas_separacao" as never, {
      p_pedido_id: orderId,
      p_usuario_id: user.id,
      p_motivo: "Cancelamento pelo depositante no portal",
    } as never);

    if (reversalError) {
      console.error("Failed to reverse stock on portal cancellation:", reversalError);
    }

    const payload = (typeof order.payload_origem === "object" && order.payload_origem !== null) ? order.payload_origem as Record<string, unknown> : {};

    const { error: updateError } = await admin
      .from("pedidos_expedicao")
      .update({
        status: "CANCELADO",
        payload_origem: {
          ...payload,
          cancelamento: {
            canceladoEm: new Date().toISOString(),
            canceladoPor: user.id,
            canceladoPorNome: user.nome,
            motivo: "Cancelado pelo portal",
          }
        }
      })
      .eq("id", orderId);

    if (updateError) {
      throw updateError;
    }

    revalidatePath("/portal");
    return { ok: true };
  } catch (error) {
    console.error("Failed to cancel order from portal:", error);
    return { ok: false, error: "Ocorreu um erro ao cancelar o pedido." };
  }
}
