"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { parseDepositanteConfiguracoes, updateDepositanteBlingConfig } from "@/lib/depositantes";
import { revokeBlingToken } from "@/lib/bling";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function disconnectBlingIntegrationAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const depositanteId = String(formData.get("depositanteId") ?? "").trim();

  if (!depositanteId) {
    redirect("/configuracoes/integracoes?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositante, error } = await adminSupabase
    .from("depositantes")
    .select("id, configuracoes, observacoes")
    .eq("id", depositanteId)
    .maybeSingle();

  if (error || !depositante) {
    redirect("/configuracoes/integracoes?feedback=erro");
  }

  const rawConfig = depositante.configuracoes
    ? JSON.stringify(depositante.configuracoes)
    : depositante.observacoes;
  const config = parseDepositanteConfiguracoes(rawConfig);

  try {
    if (config.bling?.refreshToken) {
      await revokeBlingToken(config.bling.refreshToken, "refresh_token");
    } else if (config.bling?.accessToken) {
      await revokeBlingToken(config.bling.accessToken, "access_token");
    }
  } catch {
    // Mesmo sem revogação remota, removemos a vinculação local.
  }

  const { error: updateError } = await adminSupabase
    .from("depositantes")
    .update({
      configuracoes: updateDepositanteBlingConfig(rawConfig, null),
    })
    .eq("id", depositanteId);

  if (updateError) {
    redirect("/configuracoes/integracoes?feedback=erro");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/integracoes");
  revalidatePath("/configuracoes/depositantes");
  redirect("/configuracoes/integracoes?feedback=bling-desconectado");
}
