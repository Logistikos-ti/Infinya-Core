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

    if (order.status !== "NOVO" && order.status !== "AGUARDANDO_INTEGRACAO") {
      return { ok: false, error: "O pedido já está em processamento e não pode ser cancelado pelo portal. Contate o suporte." };
    }

    const payload = (typeof order.payload_origem === "object" && order.payload_origem !== null) ? order.payload_origem as any : {};

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
