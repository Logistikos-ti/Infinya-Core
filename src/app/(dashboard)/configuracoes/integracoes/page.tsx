import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Link2,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Unplug,
  Wifi,
} from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { IntegrationAlertCenter } from "@/components/integrations/integration-alert-center";
import { Button } from "@/components/ui/button";
import { requireRoleAccess } from "@/lib/auth";
import { getAppBaseUrl, getBlingCallbackUrl, getBlingWebhookUrl } from "@/lib/bling";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { buildIntegrationAlerts } from "@/lib/integration-alerts";
import { getMercadoLivreCallbackUrl } from "@/lib/mercado-livre";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTimePtBr } from "@/lib/utils";
import {
  disconnectBlingIntegrationAction,
  disconnectMercadoLivreIntegrationAction,
  reprocessBlingIntegrationAction,
  syncBlingIntegrationAction,
} from "./actions";

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

type ShippingOrderRow = {
  id: string;
  depositante_id: string;
  origem: string;
};

type LinkedDocumentRow = {
  pedido_expedicao_id: string | null;
  tipo: string;
};

type IntegrationOccurrenceRow = {
  id: string;
  depositante_id: string;
  titulo: string;
  descricao: string;
  status: string;
  created_at: string;
};

export default async function ConfiguracoesIntegracoesPage({
  searchParams,
}: ConfiguracoesIntegracoesPageProps) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const motivo = params?.motivo ?? null;
  const supabase = await createSupabaseServerClient();

  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome, codigo, ativo, configuracoes, observacoes")
    .order("nome");
  const { data: shippingOrders } = await supabase
    .from("pedidos_expedicao")
    .select("id, depositante_id, origem");
  const { data: linkedDocuments } = await supabase
    .from("documentos_armazenados")
    .select("pedido_expedicao_id, tipo");
  const { data: integrationOccurrences } = await supabase
    .from("ocorrencias_operacionais")
    .select("id, depositante_id, titulo, descricao, status, created_at")
    .or("titulo.ilike.%Webhook Bling%,titulo.ilike.%Reprocessamento Bling%")
    .order("created_at", { ascending: false })
    .limit(50);

  const depositanteRows = (depositantes ?? []) as DepositanteRow[];
  const shippingRows = (shippingOrders ?? []) as ShippingOrderRow[];
  const linkedDocumentRows = (linkedDocuments ?? []) as LinkedDocumentRow[];
  const occurrenceRows = (integrationOccurrences ?? []) as IntegrationOccurrenceRow[];

  const appBaseUrl = getAppBaseUrl();
  const blingCallbackUrl = getBlingCallbackUrl();
  const blingWebhookUrl = getBlingWebhookUrl();
  const mercadoLivreCallbackUrl = getMercadoLivreCallbackUrl();

  const integrationAlerts = buildIntegrationAlerts({
    depositantes: depositanteRows.map((depositante) => ({
      id: depositante.id,
      nome: depositante.nome,
      configuracoes: depositante.configuracoes,
      observacoes: depositante.observacoes,
    })),
    shippingOrders: shippingRows,
    linkedDocuments: linkedDocumentRows,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para configurações
      </Link>

      <ModulePageHeader
        title="Integrações"
        description="Conexões externas do WMS. Aqui concentramos OAuth, webhooks e monitoramento operacional por depositante."
        badge="Semana 5-6"
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isSuccessFeedback(feedback)
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          }`}
        >
          {getFeedbackMessage(feedback, motivo)}
        </div>
      ) : null}

      <IntegrationAlertCenter initialAlerts={integrationAlerts} />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Bling V3</h2>
          <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <InfoRow label="Base da aplicação" value={appBaseUrl} />
            <InfoRow label="Callback OAuth2" value={blingCallbackUrl} />
            <InfoRow label="Webhook de pedidos" value={blingWebhookUrl} />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="font-medium text-slate-950 dark:text-white">Checklist do Bling V3</p>
            <ul className="mt-3 space-y-2">
              <li>1. Criar o aplicativo no portal de developers do Bling.</li>
              <li>2. Configurar o callback exatamente como exibido acima.</li>
              <li>3. Liberar o escopo `order` no aplicativo.</li>
              <li>4. Registrar o webhook de pedido de venda apontando para a URL acima.</li>
              <li>5. Conectar o depositante correto nesta tela.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Depositantes integráveis
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Cada depositante pode possuir sua própria autorização OAuth2 e seu próprio
                mapeamento de empresa no Bling.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {depositanteRows.length} depositantes
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {depositanteRows.length ? (
              depositanteRows.map((depositante) => {
                const configuracoes = parseDepositanteConfiguracoes(
                  depositante.configuracoes
                    ? JSON.stringify(depositante.configuracoes)
                    : depositante.observacoes,
                );
                const bling = configuracoes.bling;
                const isConnected = Boolean(bling?.connected);
                const monitoring = bling?.monitoring;
                const empresaExibida =
                  bling?.companyName ??
                  (bling?.companyId
                    ? configuracoes.razaoSocial || depositante.nome
                    : "Aguardando identificação via API/webhook");
                const blingOrders = shippingRows.filter(
                  (item) => item.depositante_id === depositante.id && item.origem === "BLING",
                );
                const documents = linkedDocumentRows.filter(
                  (item) =>
                    item.pedido_expedicao_id &&
                    blingOrders.some((order) => order.id === item.pedido_expedicao_id),
                );
                const ordersWithXml = new Set(
                  documents
                    .filter((item) => item.tipo === "NF")
                    .map((item) => item.pedido_expedicao_id as string),
                );
                const pendingXmlCount = blingOrders.filter(
                  (order) => !ordersWithXml.has(order.id),
                ).length;
                const latestEvents = occurrenceRows
                  .filter((item) => item.depositante_id === depositante.id)
                  .slice(0, 3);
                const overallStatus = getBlingIntegrationHealthStatus({
                  isConnected,
                  monitoring,
                  pendingXmlCount,
                });

                return (
                  <div
                    key={depositante.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-base font-semibold text-slate-950 dark:text-white">
                            {depositante.nome}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              depositante.ativo
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {depositante.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {depositante.codigo}
                        </p>

                        {isConnected ? (
                          <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            <p>
                              Empresa conectada:{" "}
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {empresaExibida}
                              </span>
                            </p>
                            <p>Company ID: {bling?.companyId ?? "Ainda não identificado"}</p>
                            <p>
                              Último sincronismo:{" "}
                              {bling?.lastSyncAt
                                ? formatDateTimePtBr(bling.lastSyncAt)
                                : "Ainda não sincronizado"}
                            </p>
                            <p>
                              Último webhook:{" "}
                              {bling?.webhook?.lastEventAt
                                ? formatDateTimePtBr(bling.webhook.lastEventAt)
                                : "Ainda não recebido"}
                            </p>
                            {bling?.companyId && !bling?.companyName ? (
                              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                                O vínculo já foi confirmado pelo `companyId`. Como o usuário do
                                Bling não possui permissão para ler os dados básicos da empresa,
                                mostramos provisoriamente a razão social cadastrada no WMS.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            Este depositante ainda não possui autorização OAuth2 ativa no Bling.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <StatusBadge active={isConnected}>
                            {isConnected ? "OAuth conectado" : "OAuth pendente"}
                          </StatusBadge>
                          <StatusBadge active={Boolean(bling?.webhook?.active)}>
                            {bling?.webhook?.active ? "Webhook habilitado" : "Webhook pendente"}
                          </StatusBadge>
                          <StatusBadge active={overallStatus.tone !== "warning"}>
                            {overallStatus.label}
                          </StatusBadge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <a href={`/api/integracoes/bling/oauth/start?depositanteId=${depositante.id}`}>
                          <Button className="bg-slate-950 text-white hover:bg-slate-800">
                            <PlugZap className="h-4 w-4" />
                            {isConnected ? "Reconectar Bling" : "Conectar Bling"}
                          </Button>
                        </a>

                        {isConnected ? (
                          <form action={syncBlingIntegrationAction}>
                            <input type="hidden" name="depositanteId" value={depositante.id} />
                            <Button type="submit" variant="outline">
                              <RefreshCw className="h-4 w-4" />
                              Atualizar vínculo
                            </Button>
                          </form>
                        ) : null}

                        {isConnected ? (
                          <form action={reprocessBlingIntegrationAction}>
                            <input type="hidden" name="depositanteId" value={depositante.id} />
                            <Button type="submit" variant="outline">
                              <RotateCcw className="h-4 w-4" />
                              Reprocessar integração
                            </Button>
                          </form>
                        ) : null}

                        {isConnected ? (
                          <form action={disconnectBlingIntegrationAction}>
                            <input type="hidden" name="depositanteId" value={depositante.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                            >
                              <Unplug className="h-4 w-4" />
                              Desconectar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>

                    {isConnected ? (
                      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            <p className="text-sm font-semibold text-slate-950 dark:text-white">
                              Painel de monitoramento
                            </p>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <MonitoringCard
                              icon={PlugZap}
                              label="Conexão"
                              status={monitoring?.lastConnectionStatus}
                              message={monitoring?.lastConnectionMessage}
                              date={monitoring?.lastConnectionAt}
                            />
                            <MonitoringCard
                              icon={Link2}
                              label="Webhook"
                              status={monitoring?.lastWebhookStatus}
                              message={monitoring?.lastWebhookMessage}
                              date={monitoring?.lastWebhookAt ?? bling?.webhook?.lastEventAt ?? null}
                            />
                            <MonitoringCard
                              icon={RotateCcw}
                              label="Reprocessamento"
                              status={monitoring?.lastReprocessStatus}
                              message={monitoring?.lastReprocessMessage}
                              date={monitoring?.lastReprocessAt}
                            />
                            <MonitoringCard
                              icon={Clock3}
                              label="XML pendente"
                              status={
                                pendingXmlCount > 0
                                  ? monitoring?.lastXmlSyncStatus ?? "PENDING"
                                  : monitoring?.lastXmlSyncStatus ?? "SUCCESS"
                              }
                              message={
                                pendingXmlCount > 0
                                  ? `${pendingXmlCount} pedido(s) ainda sem XML anexado.`
                                  : monitoring?.lastXmlSyncMessage ?? "Nenhum XML pendente."
                              }
                              date={monitoring?.lastXmlSyncAt}
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            <p className="text-sm font-semibold text-slate-950 dark:text-white">
                              Eventos, erros e reprocessamentos
                            </p>
                          </div>

                          <div className="mt-4 space-y-3">
                            {latestEvents.length ? (
                              latestEvents.map((event) => (
                                <div
                                  key={event.id}
                                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        {event.titulo}
                                      </p>
                                      <p className="mt-1 line-clamp-3 text-xs text-slate-600 dark:text-slate-400">
                                        {event.descricao}
                                      </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                      {formatDateTimePtBr(event.created_at)}
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                                Nenhum evento de integração registrado ainda para este depositante.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Nenhum depositante cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Mercado Livre</h2>
          <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <InfoRow label="Base da aplicação" value={appBaseUrl} />
            <InfoRow label="Callback OAuth2" value={mercadoLivreCallbackUrl} />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="font-medium text-slate-950 dark:text-white">Checklist Mercado Livre</p>
            <ul className="mt-3 space-y-2">
              <li>1. Criar o aplicativo no Mercado Livre Developers.</li>
              <li>2. Configurar o callback exatamente como exibido acima.</li>
              <li>3. Autorizar a conta correta do seller por depositante.</li>
              <li>4. Informar o `shipment_id` do pedido quando a venda for Mercado Livre.</li>
              <li>5. O WMS passa a buscar etiqueta e rastreamento automaticamente.</li>
            </ul>
          </div>

          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100">
            Nesta etapa, o foco é a operação de expedição: etiquetas de envio e código de rastreio.
            Isso funciona tanto para pedidos integrados quanto para pedidos cadastrados manualmente,
            desde que o `shipment_id` esteja informado.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Depositantes com Mercado Livre
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Cada depositante conecta seu próprio seller e mantém etiqueta e rastreio isolados
                por operação.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {depositanteRows.length} depositantes
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {depositanteRows.length ? (
              depositanteRows.map((depositante) => {
                const configuracoes = parseDepositanteConfiguracoes(
                  depositante.configuracoes
                    ? JSON.stringify(depositante.configuracoes)
                    : depositante.observacoes,
                );
                const mercadoLivre = configuracoes.mercadoLivre;
                const isConnected = Boolean(mercadoLivre?.connected);
                const monitoring = mercadoLivre?.monitoring;
                const relatedOrders = shippingRows.filter(
                  (item) => item.depositante_id === depositante.id,
                );

                return (
                  <div
                    key={`mercado-livre-${depositante.id}`}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-base font-semibold text-slate-950 dark:text-white">
                            {depositante.nome}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              depositante.ativo
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {depositante.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {depositante.codigo}
                        </p>

                        {isConnected ? (
                          <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            <p>
                              Conta conectada:{" "}
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {mercadoLivre?.nickname ?? "Seller não identificado"}
                              </span>
                            </p>
                            <p>User ID: {mercadoLivre?.userId ?? "Ainda não identificado"}</p>
                            <p>
                              Último sincronismo:{" "}
                              {mercadoLivre?.lastSyncAt
                                ? formatDateTimePtBr(mercadoLivre.lastSyncAt)
                                : "Ainda não sincronizado"}
                            </p>
                            <p>Pedidos elegíveis no fluxo: {relatedOrders.length}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            Este depositante ainda não possui autorização OAuth2 ativa no Mercado
                            Livre.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <StatusBadge active={isConnected}>
                            {isConnected ? "OAuth conectado" : "OAuth pendente"}
                          </StatusBadge>
                          <StatusBadge active={monitoring?.lastTrackingSyncStatus !== "ERROR"}>
                            {monitoring?.lastTrackingSyncStatus === "SUCCESS"
                              ? "Rastreio sincronizado"
                              : monitoring?.lastTrackingSyncStatus === "ERROR"
                                ? "Falha no rastreio"
                                : "Rastreio pendente"}
                          </StatusBadge>
                          <StatusBadge active={monitoring?.lastLabelSyncStatus !== "ERROR"}>
                            {monitoring?.lastLabelSyncStatus === "SUCCESS"
                              ? "Etiqueta sincronizada"
                              : monitoring?.lastLabelSyncStatus === "ERROR"
                                ? "Falha na etiqueta"
                                : "Etiqueta pendente"}
                          </StatusBadge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <a href={`/api/integracoes/mercado-livre/oauth/start?depositanteId=${depositante.id}`}>
                          <Button className="bg-slate-950 text-white hover:bg-slate-800">
                            <PlugZap className="h-4 w-4" />
                            {isConnected ? "Reconectar Mercado Livre" : "Conectar Mercado Livre"}
                          </Button>
                        </a>

                        {isConnected ? (
                          <form action={disconnectMercadoLivreIntegrationAction}>
                            <input type="hidden" name="depositanteId" value={depositante.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                            >
                              <Unplug className="h-4 w-4" />
                              Desconectar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>

                    {isConnected ? (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        <MonitoringCard
                          icon={PlugZap}
                          label="Conexão"
                          status={monitoring?.lastConnectionStatus}
                          message={monitoring?.lastConnectionMessage}
                          date={monitoring?.lastConnectionAt}
                        />
                        <MonitoringCard
                          icon={RefreshCw}
                          label="Rastreio"
                          status={monitoring?.lastTrackingSyncStatus}
                          message={monitoring?.lastTrackingSyncMessage}
                          date={monitoring?.lastTrackingSyncAt}
                        />
                        <MonitoringCard
                          icon={Link2}
                          label="Etiqueta"
                          status={monitoring?.lastLabelSyncStatus}
                          message={monitoring?.lastLabelSyncMessage}
                          date={monitoring?.lastLabelSyncAt}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Nenhum depositante cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            O que fica pronto nesta etapa
          </h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Autorização OAuth2 por depositante.",
            "Persistência segura do vínculo com a empresa do Bling.",
            "Endpoint de webhook validado com assinatura HMAC.",
            "Registro interno dos eventos de pedido para rastreabilidade operacional.",
            "Conexão OAuth do Mercado Livre por depositante.",
            "Base pronta para puxar etiqueta e rastreamento a partir do shipment_id.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MonitoringCard({
  icon: Icon,
  label,
  status,
  message,
  date,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  status: "SUCCESS" | "ERROR" | "PENDING" | null | undefined;
  message: string | null | undefined;
  date: string | null | undefined;
}) {
  const tone =
    status === "SUCCESS"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : status === "ERROR"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
        : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";

  const badge = status === "SUCCESS" ? "Ok" : status === "ERROR" ? "Erro" : "Pendente";

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <p className="text-sm font-semibold">{label}</p>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-semibold dark:bg-slate-950/60">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5">{message ?? "Aguardando primeira execução."}</p>
      <p className="mt-2 text-[11px] opacity-80">
        {date ? formatDateTimePtBr(date) : "Sem data registrada"}
      </p>
    </div>
  );
}

function getBlingIntegrationHealthStatus({
  isConnected,
  monitoring,
  pendingXmlCount,
}: {
  isConnected: boolean;
  monitoring:
    | {
        lastConnectionStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastWebhookStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
        lastReprocessStatus: "SUCCESS" | "ERROR" | "PENDING" | null;
      }
    | null
    | undefined;
  pendingXmlCount: number;
}) {
  if (!isConnected) {
    return { label: "Integração pendente", tone: "warning" as const };
  }

  if (
    monitoring?.lastConnectionStatus === "ERROR" ||
    monitoring?.lastWebhookStatus === "ERROR" ||
    monitoring?.lastReprocessStatus === "ERROR"
  ) {
    return { label: "Com erro", tone: "warning" as const };
  }

  if (pendingXmlCount > 0 || monitoring?.lastWebhookStatus === "PENDING") {
    return { label: "Monitorando", tone: "warning" as const };
  }

  return { label: "Operacional", tone: "success" as const };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-all text-sm text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function StatusBadge({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
          : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
      }`}
    >
      <Link2 className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function isSuccessFeedback(feedback: string) {
  return [
    "bling-conectado",
    "bling-desconectado",
    "bling-sincronizado",
    "mercado-livre-conectado",
    "mercado-livre-desconectado",
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
    case "bling-identificacao-pendente":
      return `A conexão está ativa, mas o nome da empresa ainda não pôde ser lido na API do Bling.${motivo ? ` Motivo: ${motivo}` : ""}`;
    default:
      return `Não foi possível concluir a operação da integração.${motivo ? ` Motivo: ${motivo}` : ""}`;
  }
}
