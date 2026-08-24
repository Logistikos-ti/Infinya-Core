"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordStockQuarantineDecision } from "@/lib/stock-quarantine";

export async function discardPortalQuarantine(quarantineId: string) {
  const user = await requireRoleAccess(["DEPOSITANTE"]);

  if (user.portalProfile !== "GESTOR") {
    return { error: "Somente o gestor do depositante pode decidir o destino da quarentena." };
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: qRecord } = await adminSupabase
    .from("estoque_quarentena")
    .select("depositante_id, status")
    .eq("id", quarantineId)
    .single();

  if (!qRecord) {
    return { error: "Registro não encontrado." };
  }

  if (!user.depositanteId || qRecord.depositante_id !== user.depositanteId) {
    return { error: "Este registro não pertence ao seu depositante." };
  }

  if (qRecord.status !== "EM_QUARENTENA") {
    return { error: "Esta quarentena já foi resolvida." };
  }

  try {
    await recordStockQuarantineDecision({
      quarantineId,
      decision: "DESCARTAR",
      userId: user.id,
      observations: "Descarte autorizado pelo depositante via portal",
    });

    revalidatePath("/portal");
    return {
      success: true,
      detail: "Descarte autorizado. Aguardando confirmação física do operador logístico.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao registrar a decisão." };
  }
}
