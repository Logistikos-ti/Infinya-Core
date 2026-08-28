import { requireConfigSectionAccess, requireRoleAccess } from "@/lib/auth";
import { getAppBaseUrl, getBlingCallbackUrl, getBlingWebhookUrl } from "@/lib/bling";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { getMercadoLivreCallbackUrl } from "@/lib/mercado-livre";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTimePtBr } from "@/lib/utils";
import {
  IntegracoesView,
  type IntegracaoCard,
  type IntegracaoLog,
} from "@/components/configuracoes/integracoes-view";

type ConfiguracoesIntegracoesPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    motivo?: string;
  }>;
};

type DepositanteRow = {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  configuracoes: unknown;
  observacoes: string | null;
};

type ShippingOrderRow = { id: string; depositante_id: string; origem: string };
type LinkedDocumentRow = { pedido_expedicao_id: string | null; tipo: string };
type IntegrationOccurrenceRow = {
  id: string;
  depositante_id: string;
  titulo: string;
  descricao: string;
  status: string;
  created_at: string;
};

const BLING_COLOR = "#2563EB";
const ML_COLOR = "#F59E0B";

function firstErrorMessage(
  entries: Array<{ status: string | null | undefined; message: string | null | undefined }>,
) {
  const hit = entries.find((e) => e.status === "ERROR");
  return hit?.message ?? "Falha registrada na última execução.";
}

function occurrenceType(status: string): "success" | "error" | "warning" {
  if (status === "RESOLVIDO") return "success";
  if (status === "EM_ANALISE") return "error";
  return "warning";
}

export default async function ConfiguracoesIntegracoesPage({
  searchParams,
}: ConfiguracoesIntegracoesPageProps) {
  await requireRoleAccess(["ADMIN", "TI"]);
  await requireConfigSectionAccess("integracoes");

  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const motivo = params?.motivo ?? null;
  const supabase = await createSupabaseServerClient();

  const [{ data: depositantes }, { data: shippingOrders }, { data: linkedDocuments }, { data: integrationOccurrences }] =
    await Promise.all([
      supabase
        .from("depositantes")
        .select("id, nome, codigo, ativo, configuracoes, observacoes")
        .order("nome"),
      supabase.from("pedidos_expedicao").select("id, depositante_id, origem"),
      supabase.from("documentos_armazenados").select("pedido_expedicao_id, tipo"),
      supabase
        .from("ocorrencias_operacionais")
        .select("id, depositante_id, titulo, descricao, status, created_at")
        .or("titulo.ilike.%Webhook Bling%,titulo.ilike.%Reprocessamento Bling%")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const depositanteRows = (depositantes ?? []) as DepositanteRow[];
  const shippingRows = (shippingOrders ?? []) as ShippingOrderRow[];
  const linkedDocumentRows = (linkedDocuments ?? []) as LinkedDocumentRow[];
  const occurrenceRows = (integrationOccurrences ?? []) as IntegrationOccurrenceRow[];

  const appBaseUrl = getAppBaseUrl();
  const blingCallbackUrl = getBlingCallbackUrl();
  const blingWebhookUrl = getBlingWebhookUrl();
  const mercadoLivreCallbackUrl = getMercadoLivreCallbackUrl();

  const cards: IntegracaoCard[] = [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  for (const depositante of depositanteRows) {
    const configuracoes = parseDepositanteConfiguracoes(
      depositante.configuracoes
        ? JSON.stringify(depositante.configuracoes)
        : depositante.observacoes,
    );

    const depOccurrences = occurrenceRows.filter((item) => item.depositante_id === depositante.id);
    const depEventos = depOccurrences.slice(0, 6).map((item) => ({
      id: item.id,
      titulo: item.titulo,
      descricao: item.descricao,
      createdAt: item.created_at,
      type: occurrenceType(item.status),
    }));
    const eventosNoMes = depOccurrences.filter(
      (item) => new Date(item.created_at).getTime() >= monthStart,
    ).length;

    // ---- Bling ----
    const bling = configuracoes.bling;
    const blingConnected = Boolean(bling?.connected);
    const blingOrders = shippingRows.filter(
      (item) => item.depositante_id === depositante.id && item.origem === "BLING",
    );
    const blingOrderIds = new Set(blingOrders.map((o) => o.id));
    const ordersWithXml = new Set(
      linkedDocumentRows
        .filter((d) => d.tipo === "NF" && d.pedido_expedicao_id && blingOrderIds.has(d.pedido_expedicao_id))
        .map((d) => d.pedido_expedicao_id as string),
    );
    const pendingXmlCount = blingOrders.filter((o) => !ordersWithXml.has(o.id)).length;
    const blingMon = bling?.monitoring;
    const blingHasError =
      blingMon?.lastConnectionStatus === "ERROR" ||
      blingMon?.lastWebhookStatus === "ERROR" ||
      blingMon?.lastReprocessStatus === "ERROR";
    const blingPaused = Boolean(bling?.paused);
    const empresaExibida =
      bling?.companyName ??
      (bling?.companyId ? configuracoes.razaoSocial || depositante.nome : null);

    cards.push({
      id: `${depositante.id}:BLING`,
      provider: "BLING",
      providerNome: "Bling V3",
      tipo: "ERP",
      badge: "BLING",
      color: BLING_COLOR,
      logoUrl: "/integrations/bling.png",
      depositanteId: depositante.id,
      depositanteNome: depositante.nome,
      depositanteCodigo: depositante.codigo,
      depositanteAtivo: depositante.ativo,
      connected: blingConnected,
      paused: blingPaused,
      status: !blingConnected
        ? "DESCONECTADA"
        : blingPaused
          ? "PAUSADA"
          : blingHasError
            ? "ERRO"
            : "ATIVA",
      statusMessage: blingConnected && blingHasError
        ? firstErrorMessage([
            { status: blingMon?.lastConnectionStatus, message: blingMon?.lastConnectionMessage },
            { status: blingMon?.lastWebhookStatus, message: blingMon?.lastWebhookMessage },
            { status: blingMon?.lastReprocessStatus, message: blingMon?.lastReprocessMessage },
          ])
        : null,
      lastSyncAt: bling?.lastSyncAt ?? null,
      pedidos: blingOrders.length,
      oauthStartUrl: `/api/integracoes/bling/oauth/start?depositanteId=${depositante.id}`,
      callbackUrl: blingCallbackUrl,
      config: blingConnected
        ? [
            { label: "Empresa", value: empresaExibida ?? "Aguardando identificação" },
            { label: "Company ID", value: bling?.companyId ?? "—", mono: true },
            { label: "Callback OAuth2", value: blingCallbackUrl, mono: true },
            { label: "Webhook", value: bling?.webhook?.active ? "Habilitado" : "Pendente" },
            { label: "Pedidos Bling", value: String(blingOrders.length) },
            { label: "XML pendente", value: String(pendingXmlCount) },
            { label: "Último sync", value: bling?.lastSyncAt ? formatDateTimePtBr(bling.lastSyncAt) : "—" },
            { label: "Eventos no mês", value: String(eventosNoMes) },
          ]
        : [
            { label: "Callback OAuth2", value: blingCallbackUrl, mono: true },
            { label: "Webhook de pedidos", value: blingWebhookUrl, mono: true },
            { label: "Último sync", value: bling?.lastSyncAt ? formatDateTimePtBr(bling.lastSyncAt) : "—" },
            { label: "Eventos no mês", value: String(eventosNoMes) },
          ],
      eventos: depEventos,
    });

    // ---- Mercado Livre ----
    const ml = configuracoes.mercadoLivre;
    const mlConnected = Boolean(ml?.connected);
    const relatedOrders = shippingRows.filter((item) => item.depositante_id === depositante.id);
    const mlMon = ml?.monitoring;
    const mlHasError =
      mlMon?.lastConnectionStatus === "ERROR" ||
      mlMon?.lastTrackingSyncStatus === "ERROR" ||
      mlMon?.lastLabelSyncStatus === "ERROR";
    const mlPaused = Boolean(ml?.paused);

    cards.push({
      id: `${depositante.id}:ML`,
      provider: "ML",
      providerNome: "Mercado Livre",
      tipo: "Marketplace",
      badge: "ML",
      color: ML_COLOR,
      logoUrl: "/integrations/mercado-livre.png",
      depositanteId: depositante.id,
      depositanteNome: depositante.nome,
      depositanteCodigo: depositante.codigo,
      depositanteAtivo: depositante.ativo,
      connected: mlConnected,
      paused: mlPaused,
      status: !mlConnected
        ? "DESCONECTADA"
        : mlPaused
          ? "PAUSADA"
          : mlHasError
            ? "ERRO"
            : "ATIVA",
      statusMessage: mlConnected && mlHasError
        ? firstErrorMessage([
            { status: mlMon?.lastConnectionStatus, message: mlMon?.lastConnectionMessage },
            { status: mlMon?.lastTrackingSyncStatus, message: mlMon?.lastTrackingSyncMessage },
            { status: mlMon?.lastLabelSyncStatus, message: mlMon?.lastLabelSyncMessage },
          ])
        : null,
      lastSyncAt: ml?.lastSyncAt ?? null,
      pedidos: relatedOrders.length,
      oauthStartUrl: `/api/integracoes/mercado-livre/oauth/start?depositanteId=${depositante.id}`,
      callbackUrl: mercadoLivreCallbackUrl,
      config: mlConnected
        ? [
            { label: "Conta", value: ml?.nickname ?? "Seller não identificado" },
            { label: "User ID", value: ml?.userId ?? "—", mono: true },
            { label: "Callback OAuth2", value: mercadoLivreCallbackUrl, mono: true },
            { label: "Pedidos elegíveis", value: String(relatedOrders.length) },
            { label: "Último sync", value: ml?.lastSyncAt ? formatDateTimePtBr(ml.lastSyncAt) : "—" },
            { label: "Eventos no mês", value: String(eventosNoMes) },
          ]
        : [
            { label: "Callback OAuth2", value: mercadoLivreCallbackUrl, mono: true },
            { label: "Último sync", value: ml?.lastSyncAt ? formatDateTimePtBr(ml.lastSyncAt) : "—" },
            { label: "Eventos no mês", value: String(eventosNoMes) },
          ],
      eventos: [],
    });
  }

  const depositanteNomeById = new Map(depositanteRows.map((d) => [d.id, d.nome]));
  const logs: IntegracaoLog[] = occurrenceRows.map((item) => ({
    id: item.id,
    time: formatLogTime(item.created_at),
    dateIso: item.created_at,
    integ: item.titulo.toLowerCase().includes("mercado livre") ? "Mercado Livre" : "Bling V3",
    depositante: depositanteNomeById.get(item.depositante_id) ?? "—",
    msg: item.descricao || item.titulo,
    type: occurrenceType(item.status),
  }));

  return (
    <IntegracoesView
      cards={cards}
      depositantes={depositanteRows.map((d) => ({ id: d.id, nome: d.nome }))}
      logs={logs}
      apiInfo={{ appBaseUrl, blingCallbackUrl, blingWebhookUrl, mercadoLivreCallbackUrl }}
      feedback={
        feedback
          ? { message: getFeedbackMessage(feedback, motivo), success: isSuccessFeedback(feedback) }
          : null
      }
    />
  );
}

function formatLogTime(iso: string) {
  const full = formatDateTimePtBr(iso);
  // formatDateTimePtBr → "26/08/2026 14:32" → mockup usa "26/08 14:32"
  return full.replace(/^(\d{2}\/\d{2})\/\d{4}/, "$1");
}

function isSuccessFeedback(feedback: string) {
  return [
    "bling-conectado",
    "bling-desconectado",
    "bling-sincronizado",
    "mercado-livre-conectado",
    "mercado-livre-desconectado",
    "integracao-pausada",
    "integracao-retomada",
  ].includes(feedback);
}

function getFeedbackMessage(feedback: string, motivo: string | null) {
  switch (feedback) {
    case "bling-conectado":
      return "Conexão com o Bling salva com sucesso para o depositante.";
    case "bling-desconectado":
      return "Integração do Bling removida com sucesso.";
    case "bling-sincronizado":
      return "Integração do Bling sincronizada com sucesso.";
    case "mercado-livre-conectado":
      return "Conexão com o Mercado Livre salva com sucesso para o depositante.";
    case "mercado-livre-desconectado":
      return "Integração do Mercado Livre removida com sucesso.";
    case "integracao-pausada":
      return "Integração pausada com sucesso.";
    case "integracao-retomada":
      return "Integração retomada com sucesso.";
    case "bling-identificacao-pendente":
      return `A conexão está ativa, mas o nome da empresa ainda não pôde ser lido na API do Bling.${motivo ? ` Motivo: ${motivo}` : ""}`;
    default:
      return `Não foi possível concluir a operação da integração.${motivo ? ` Motivo: ${motivo}` : ""}`;
  }
}
