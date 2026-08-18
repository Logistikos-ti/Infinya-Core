"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveStockQuarantine } from "@/lib/stock-quarantine";

export async function discardPortalQuarantine(quarantineId: string) {
  const supabase = createSupabaseServerClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return { error: "Não autenticado." };
  }

  // Ensure user can access this quarantine record
  const adminSupabase = createSupabaseAdminClient();
  const { data: qRecord } = await adminSupabase
    .from("estoque_quarentena")
    .select("depositante_id, status")
    .eq("id", quarantineId)
    .single();

  if (!qRecord) {
    return { error: "Registro não encontrado." };
  }
  
  if (qRecord.status !== "EM_QUARENTENA") {
    return { error: "Esta quarentena já foi resolvida." };
  }
  
  try {
    await resolveStockQuarantine({
      quarantineId,
      action: "discard",
      userId: auth.data.user.id,
      observations: "Descartado pelo depositante via portal",
    });

    revalidatePath("/portal");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao descartar item." };
  }
}
