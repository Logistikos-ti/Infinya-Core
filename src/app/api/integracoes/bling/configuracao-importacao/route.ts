import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-auth";
import {
  parseDepositanteConfiguracoes,
  type DepositanteBlingImportFilter,
  updateDepositanteBlingConfig,
} from "@/lib/depositantes";
import { canManagePortalIntegrations } from "@/lib/portal-integration-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const importFilterSchema = z.object({
  depositanteId: z.string().uuid(),
  enabled: z.boolean(),
  warehouseName: z.string().trim().max(160).nullable(),
  acceptedSituationIds: z.array(z.string().trim().min(1).max(80)).max(30),
  acceptedSituationNames: z.array(z.string().trim().min(1).max(120)).max(30),
  allowedStoreIds: z.array(z.string().trim().min(1).max(80)).max(100),
  allowedStoreNames: z.array(z.string().trim().min(1).max(160)).max(100),
  allowedBusinessUnitIds: z.array(z.string().trim().min(1).max(80)).max(100),
  allowedBusinessUnitNames: z.array(z.string().trim().min(1).max(160)).max(100),
});

const defaultFilter: DepositanteBlingImportFilter = {
  enabled: false,
  warehouseName: "CD SP - Logistikos",
  acceptedSituationIds: [],
  acceptedSituationNames: ["Atendido"],
  allowedStoreIds: [],
  allowedStoreNames: [],
  allowedBusinessUnitIds: [],
  allowedBusinessUnitNames: [],
};

export async function GET(request: Request) {
  const auth = await requireApiUser();

  if (auth.response) return auth.response;

  const depositanteId = new URL(request.url).searchParams.get("depositanteId")?.trim() ?? "";

  if (!depositanteId || !canManagePortalIntegrations(auth.user, depositanteId)) {
    return NextResponse.json({ error: "Sem permissão para configurar esta integração." }, { status: 403 });
  }

  const result = await loadDepositante(depositanteId);
  if (result.error) return result.error;

  const bling = parseDepositanteConfiguracoes(result.rawConfig).bling;

  return NextResponse.json({
    connected: Boolean(bling?.connected),
    filter: bling?.importFilter ?? defaultFilter,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();

  if (auth.response) return auth.response;

  const parsed = importFilterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Configuração de importação inválida." }, { status: 400 });
  }

  const { depositanteId, ...filter } = parsed.data;

  if (!canManagePortalIntegrations(auth.user, depositanteId)) {
    return NextResponse.json({ error: "Sem permissão para configurar esta integração." }, { status: 403 });
  }

  if (
    filter.enabled &&
    filter.acceptedSituationIds.length === 0 &&
    filter.acceptedSituationNames.length === 0
  ) {
    return NextResponse.json({ error: "Informe ao menos uma situação aceita." }, { status: 400 });
  }

  if (
    filter.enabled &&
    filter.allowedStoreIds.length === 0 &&
    filter.allowedStoreNames.length === 0 &&
    filter.allowedBusinessUnitIds.length === 0 &&
    filter.allowedBusinessUnitNames.length === 0
  ) {
    return NextResponse.json(
      { error: "Informe ao menos uma loja ou unidade de negócio autorizada." },
      { status: 400 },
    );
  }

  const result = await loadDepositante(depositanteId);
  if (result.error) return result.error;

  const current = parseDepositanteConfiguracoes(result.rawConfig);
  if (!current.bling?.connected) {
    return NextResponse.json({ error: "Conecte o Bling antes de configurar a importação." }, { status: 409 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("depositantes")
    .update({
      configuracoes: updateDepositanteBlingConfig(result.rawConfig, {
        ...current.bling,
        importFilter: filter,
      }),
    })
    .eq("id", depositanteId);

  if (error) {
    return NextResponse.json({ error: `Não foi possível salvar a configuração: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, filter });
}

async function loadDepositante(depositanteId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("depositantes")
    .select("id, configuracoes, observacoes")
    .eq("id", depositanteId)
    .maybeSingle();

  if (error || !data) {
    return {
      rawConfig: null,
      error: NextResponse.json({ error: "Depositante não encontrado." }, { status: 404 }),
    };
  }

  return {
    rawConfig: data.configuracoes ? JSON.stringify(data.configuracoes) : data.observacoes,
    error: null,
  };
}
