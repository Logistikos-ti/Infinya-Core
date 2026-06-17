"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { parseDepositanteConfiguracoes, updateDepositanteBlingConfig } from "@/lib/depositantes";
import { revokeBlingToken, syncBlingConnectionMetadata } from "@/lib/bling";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function buildRedirectUrl(
  feedback:
    | "erro"
    | "bling-desconectado"
    | "bling-sincronizado"
    | "bling-identificacao-pendente",
  motivo?: string,
) {
  const search = new URLSearchParams({ feedback });

  if (motivo) {
    search.set("motivo", motivo);
  }

  return `/configuracoes/integracoes?${search.toString()}`;
}

export async function disconnectBlingIntegrationAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const depositanteId = String(formData.get("depositanteId") ?? "").trim();

  if (!depositanteId) {
    redirect(buildRedirectUrl("erro"));
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositante, error } = await adminSupabase
    .from("depositantes")
    .select("id, configuracoes, observacoes")
    .eq("id", depositanteId)
    .maybeSingle();

  if (error || !depositante) {
    redirect(buildRedirectUrl("erro"));
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
    redirect(buildRedirectUrl("erro"));
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/integracoes");
  revalidatePath("/configuracoes/depositantes");
  redirect(buildRedirectUrl("bling-desconectado"));
}

export async function syncBlingIntegrationAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const depositanteId = String(formData.get("depositanteId") ?? "").trim();

  if (!depositanteId) {
    redirect(buildRedirectUrl("erro"));
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositante, error } = await adminSupabase
    .from("depositantes")
    .select("id, configuracoes, observacoes")
    .eq("id", depositanteId)
    .maybeSingle();

  if (error || !depositante) {
    redirect(buildRedirectUrl("erro"));
  }

  const rawConfig = depositante.configuracoes
    ? JSON.stringify(depositante.configuracoes)
    : depositante.observacoes;
  const config = parseDepositanteConfiguracoes(rawConfig);

  if (!config.bling?.connected) {
    redirect(buildRedirectUrl("erro", "O depositante ainda não possui integração ativa com o Bling."));
  }

  try {
    const result = await syncBlingConnectionMetadata(config.bling);
    const now = new Date().toISOString();
    const nextBlingConfig = {
      ...config.bling,
      accessToken: result.tokens?.access_token ?? config.bling.accessToken,
      refreshToken: result.tokens?.refresh_token ?? config.bling.refreshToken,
      tokenType: result.tokens?.token_type ?? config.bling.tokenType,
      expiresAt: result.tokens
        ? new Date(Date.now() + result.tokens.expires_in * 1000).toISOString()
        : config.bling.expiresAt,
      scopes: result.tokens
        ? result.tokens.scope
            .split(/\s+/)
            .map((item) => item.trim())
            .filter(Boolean)
        : config.bling.scopes,
      companyId: result.company?.id ?? config.bling.companyId,
      companyName: result.company?.nome ?? config.bling.companyName,
      lastSyncAt: now,
    };

    const { error: updateError } = await adminSupabase
      .from("depositantes")
      .update({
        configuracoes: updateDepositanteBlingConfig(rawConfig, nextBlingConfig),
      })
      .eq("id", depositanteId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/integracoes");
    revalidatePath("/configuracoes/depositantes");

    if (result.company?.nome) {
      redirect(buildRedirectUrl("bling-sincronizado"));
    }

    if (result.companyFetchError) {
      redirect(buildRedirectUrl("bling-identificacao-pendente", result.companyFetchError));
    }

    redirect(buildRedirectUrl("bling-sincronizado"));
  } catch (error) {
    redirect(
      buildRedirectUrl(
        "erro",
        error instanceof Error ? error.message : "Falha ao sincronizar a integração do Bling.",
      ),
    );
  }
}
