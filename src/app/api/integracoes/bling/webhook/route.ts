import { NextResponse } from "next/server";
import { parseBlingWebhookPayload, validateBlingWebhookSignature } from "@/lib/bling";
import {
  parseDepositanteConfiguracoes,
  updateDepositanteBlingConfig,
} from "@/lib/depositantes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DepositanteWebhookRow = {
  id: string;
  nome: string;
  configuracoes: Record<string, unknown> | null;
  observacoes: string | null;
};

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("X-Bling-Signature-256");

  if (!validateBlingWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Assinatura do webhook do Bling inválida." }, { status: 401 });
  }

  let event;

  try {
    event = parseBlingWebhookPayload(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payload inválido." },
      { status: 400 },
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositantes } = await adminSupabase
    .from("depositantes")
    .select("id, nome, configuracoes, observacoes")
    .eq("ativo", true);

  const parsedRows = ((depositantes as DepositanteWebhookRow[] | null) ?? []).map((item) => {
    const rawConfig = item.configuracoes ? JSON.stringify(item.configuracoes) : item.observacoes;
    return {
      row: item,
      rawConfig,
      config: parseDepositanteConfiguracoes(rawConfig),
    };
  });

  let matched = parsedRows.find((item) => item.config.bling?.companyId === event.companyId);

  if (!matched) {
    const pendingLinkRows = parsedRows.filter(
      (item) => item.config.bling?.connected && !item.config.bling.companyId,
    );

    if (pendingLinkRows.length === 1) {
      matched = pendingLinkRows[0];
    }
  }

  if (!matched) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "Nenhum depositante vinculado a este companyId." },
      { status: 202 },
    );
  }

  const depositante = matched.row;
  const rawConfig = matched.rawConfig;
  const config = matched.config;
  const occurrenceTitle = `Webhook Bling ${event.event} ${event.eventId}`;

  const { data: existingOccurrence } = await adminSupabase
    .from("ocorrencias_operacionais")
    .select("id")
    .eq("depositante_id", depositante.id)
    .eq("titulo", occurrenceTitle)
    .maybeSingle();

  if (!existingOccurrence) {
    const eventSummary = buildBlingEventSummary(event.event, event.data);

    await adminSupabase.from("ocorrencias_operacionais").insert({
      depositante_id: depositante.id,
      tipo: "OUTRO",
      status: "EM_ANALISE",
      titulo: occurrenceTitle,
      descricao: `Evento ${event.event} recebido do Bling para ${depositante.nome}. Resumo: ${eventSummary}. EventId: ${event.eventId}. Payload: ${payload}`,
    });
  }

  const nextBlingConfig = config.bling
    ? {
        ...config.bling,
        companyId: config.bling.companyId ?? event.companyId,
        lastSyncAt: new Date().toISOString(),
        webhook: {
          resource: "order" as const,
          url: config.bling.webhook?.url ?? "",
          secret: config.bling.webhook?.secret ?? null,
          active: true,
          lastEventId: event.eventId,
          lastEventAt: event.date,
        },
      }
    : null;

  if (nextBlingConfig) {
    await adminSupabase
      .from("depositantes")
      .update({
        configuracoes: updateDepositanteBlingConfig(rawConfig, nextBlingConfig),
      })
      .eq("id", depositante.id);
  }

  return NextResponse.json({ ok: true });
}

function buildBlingEventSummary(eventName: string, data: Record<string, unknown>) {
  if (!eventName.startsWith("order.")) {
    return "Evento recebido fora do escopo principal de pedidos";
  }

  const id = typeof data.id === "number" || typeof data.id === "string" ? String(data.id) : "sem id";
  const numero =
    typeof data.numero === "number" || typeof data.numero === "string"
      ? String(data.numero)
      : "sem número";
  const numeroLoja =
    typeof data.numeroLoja === "string" && data.numeroLoja.trim()
      ? data.numeroLoja.trim()
      : "sem número da loja";
  const total =
    typeof data.total === "number" || typeof data.total === "string"
      ? String(data.total)
      : "0";

  return `pedido ${numero} / loja ${numeroLoja} / id ${id} / total ${total}`;
}
