"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { reprocessRecentBlingOrdersForDepositante } from "@/lib/bling-reprocessing";
import {
  parseDepositanteConfiguracoes,
  updateDepositanteBlingConfig,
  updateDepositanteMercadoLivreConfig,
} from "@/lib/depositantes";
import { revokeBlingToken, syncBlingConnectionMetadata } from "@/lib/bling";
import { syncPendingBlingInvoiceAttachments } from "@/lib/shipping-attachment-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function buildRedirectUrl(
  feedback:
    | "erro"
    | "bling-desconectado"
    | "bling-sincronizado"
    | "bling-identificacao-pendente"
    | "mercado-livre-conectado"
    | "mercado-livre-desconectado",
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
      monitoring: buildMonitoringState(config.bling.monitoring, {
        lastConnectionStatus: result.companyFetchError ? ("PENDING" as const) : ("SUCCESS" as const),
        lastConnectionMessage: result.companyFetchError
          ? `OAuth ativo, mas a leitura da empresa ficou pendente. ${result.companyFetchError}`
          : result.company?.nome
            ? `Vínculo validado com a empresa ${result.company.nome}.`
            : "Vínculo OAuth validado com sucesso.",
        lastConnectionAt: now,
      }),
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

export async function reprocessBlingIntegrationAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const depositanteId = String(formData.get("depositanteId") ?? "").trim();

  if (!depositanteId) {
    redirect(buildRedirectUrl("erro"));
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositante, error } = await adminSupabase
    .from("depositantes")
    .select("id, nome, configuracoes, observacoes")
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

  const startedAt = new Date().toISOString();
  const baseMonitoring = config.bling.monitoring ?? null;

  try {
    const metadata = await syncBlingConnectionMetadata(config.bling);
    const reprocessSummary = await reprocessRecentBlingOrdersForDepositante({
      adminSupabase,
      depositanteId,
      blingConfig: {
        ...config.bling,
        accessToken: metadata.tokens?.access_token ?? config.bling.accessToken,
        refreshToken: metadata.tokens?.refresh_token ?? config.bling.refreshToken,
        tokenType: metadata.tokens?.token_type ?? config.bling.tokenType,
        expiresAt: metadata.tokens
          ? new Date(Date.now() + metadata.tokens.expires_in * 1000).toISOString()
          : config.bling.expiresAt,
        scopes: metadata.tokens
          ? metadata.tokens.scope
              .split(/\s+/)
              .map((item) => item.trim())
              .filter(Boolean)
          : config.bling.scopes,
      },
    });
    const xmlSummary = await syncPendingBlingInvoiceAttachments(adminSupabase, 40, depositanteId);
    const finishedAt = new Date().toISOString();

    const nextBlingConfig = {
      ...reprocessSummary.refreshedConfig,
      companyId: metadata.company?.id ?? reprocessSummary.refreshedConfig.companyId,
      companyName: metadata.company?.nome ?? reprocessSummary.refreshedConfig.companyName,
      lastSyncAt: finishedAt,
      monitoring: buildMonitoringState(baseMonitoring, {
        lastConnectionStatus: metadata.companyFetchError ? ("PENDING" as const) : ("SUCCESS" as const),
        lastConnectionMessage: metadata.companyFetchError
          ? `OAuth ativo, mas a leitura da empresa ficou pendente. ${metadata.companyFetchError}`
          : metadata.company?.nome
            ? `Vínculo validado com a empresa ${metadata.company.nome}.`
            : "Vínculo OAuth validado com sucesso.",
        lastConnectionAt: finishedAt,
        lastReprocessStatus: reprocessSummary.failed > 0 ? ("PENDING" as const) : ("SUCCESS" as const),
        lastReprocessMessage: `Pedidos reprocessados: ${reprocessSummary.success}/${reprocessSummary.total}. Falhas: ${reprocessSummary.failed}.`,
        lastReprocessAt: finishedAt,
        lastXmlSyncStatus: xmlSummary.failed > 0 ? ("PENDING" as const) : ("SUCCESS" as const),
        lastXmlSyncMessage: `XMLs anexados: ${xmlSummary.attached}. Já existentes: ${xmlSummary.alreadyExists}. Pendentes de NF: ${xmlSummary.waitingInvoice}.`,
        lastXmlSyncAt: finishedAt,
      }),
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

    await adminSupabase.from("ocorrencias_operacionais").insert({
      depositante_id: depositanteId,
      tipo: "OUTRO",
      status: reprocessSummary.failed > 0 ? "EM_ANALISE" : "RESOLVIDO",
      titulo: `Reprocessamento Bling ${depositante.nome} ${finishedAt}`,
      descricao: `Reprocessamento manual executado. Início: ${startedAt}. Fim: ${finishedAt}. Pedidos reprocessados: ${reprocessSummary.success}/${reprocessSummary.total}. Falhas: ${reprocessSummary.failed}. XML anexados: ${xmlSummary.attached}. Pendentes de NF: ${xmlSummary.waitingInvoice}.`,
    });

    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/integracoes");
    revalidatePath("/configuracoes/depositantes");
    revalidatePath("/expedicao");
    redirect(buildRedirectUrl("bling-sincronizado", "Reprocessamento concluído com sucesso."));
  } catch (reprocessError) {
    const failedAt = new Date().toISOString();
    const failedConfig = {
      ...config.bling,
      monitoring: buildMonitoringState(baseMonitoring, {
        lastReprocessStatus: "ERROR" as const,
        lastReprocessMessage:
          reprocessError instanceof Error ? reprocessError.message : "Falha ao reprocessar integração.",
        lastReprocessAt: failedAt,
      }),
    };

    await adminSupabase
      .from("depositantes")
      .update({
        configuracoes: updateDepositanteBlingConfig(rawConfig, failedConfig),
      })
      .eq("id", depositanteId);

    redirect(
      buildRedirectUrl(
        "erro",
        reprocessError instanceof Error
          ? reprocessError.message
          : "Falha ao reprocessar integração do Bling.",
      ),
    );
  }
}

export async function disconnectMercadoLivreIntegrationAction(formData: FormData) {
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

  const { error: updateError } = await adminSupabase
    .from("depositantes")
    .update({
      configuracoes: updateDepositanteMercadoLivreConfig(rawConfig, null),
    })
    .eq("id", depositanteId);

  if (updateError) {
    redirect(buildRedirectUrl("erro", updateError.message));
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/integracoes");
  revalidatePath("/configuracoes/depositantes");
  redirect(buildRedirectUrl("mercado-livre-desconectado"));
}

function buildMonitoringState(
  current:
    | {
        lastConnectionStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastConnectionMessage: string | null;
        lastConnectionAt: string | null;
        lastWebhookStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastWebhookMessage: string | null;
        lastWebhookAt: string | null;
        lastReprocessStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastReprocessMessage: string | null;
        lastReprocessAt: string | null;
        lastXmlSyncStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastXmlSyncMessage: string | null;
        lastXmlSyncAt: string | null;
      }
    | null
    | undefined,
  patch: Partial<{
    lastConnectionStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
    lastConnectionMessage: string | null;
    lastConnectionAt: string | null;
    lastWebhookStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
    lastWebhookMessage: string | null;
    lastWebhookAt: string | null;
    lastReprocessStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
    lastReprocessMessage: string | null;
    lastReprocessAt: string | null;
    lastXmlSyncStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
    lastXmlSyncMessage: string | null;
    lastXmlSyncAt: string | null;
  }>,
) {
  return {
    lastConnectionStatus: current?.lastConnectionStatus ?? null,
    lastConnectionMessage: current?.lastConnectionMessage ?? null,
    lastConnectionAt: current?.lastConnectionAt ?? null,
    lastWebhookStatus: current?.lastWebhookStatus ?? null,
    lastWebhookMessage: current?.lastWebhookMessage ?? null,
    lastWebhookAt: current?.lastWebhookAt ?? null,
    lastReprocessStatus: current?.lastReprocessStatus ?? null,
    lastReprocessMessage: current?.lastReprocessMessage ?? null,
    lastReprocessAt: current?.lastReprocessAt ?? null,
    lastXmlSyncStatus: current?.lastXmlSyncStatus ?? null,
    lastXmlSyncMessage: current?.lastXmlSyncMessage ?? null,
    lastXmlSyncAt: current?.lastXmlSyncAt ?? null,
    ...patch,
  };
}
