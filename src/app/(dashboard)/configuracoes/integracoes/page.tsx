import Link from "next/link";
import { ArrowLeft, CheckCircle2, Link2, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireRoleAccess } from "@/lib/auth";
import { getAppBaseUrl, getBlingCallbackUrl, getBlingWebhookUrl } from "@/lib/bling";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTimePtBr } from "@/lib/utils";
import {
  disconnectBlingIntegrationAction,
  syncBlingIntegrationAction,
} from "./actions";

type ConfiguracoesIntegracoesPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    motivo?: string;
  }>;
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

  const appBaseUrl = getAppBaseUrl();
  const callbackUrl = getBlingCallbackUrl();
  const webhookUrl = getBlingWebhookUrl();

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para configurações
      </Link>

      <ModulePageHeader
        title="Integrações"
        description="Conexões externas do WMS. Nesta etapa, iniciamos a base do Bling V3 com OAuth2 por depositante e recebimento seguro de webhooks de pedidos."
        badge="Semana 5"
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "bling-conectado" || feedback === "bling-desconectado"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {feedback === "bling-conectado"
            ? "Conexão com o Bling salva com sucesso para o depositante."
            : feedback === "bling-desconectado"
              ? "Integração do Bling removida com sucesso."
              : feedback === "bling-sincronizado"
                ? "Integração do Bling sincronizada com sucesso."
                : feedback === "bling-identificacao-pendente"
                  ? `A conexão está ativa, mas o nome da empresa ainda não pôde ser lido na API do Bling.${motivo ? ` Motivo: ${motivo}` : ""}`
              : `Não foi possível concluir a operação da integração.${motivo ? ` Motivo: ${motivo}` : ""}`}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Parâmetros do aplicativo</h2>
          <div className="mt-4 space-y-4 text-sm text-slate-600">
            <InfoRow label="Base da aplicação" value={appBaseUrl} />
            <InfoRow label="Callback OAuth2" value={callbackUrl} />
            <InfoRow label="Webhook de pedidos" value={webhookUrl} />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-950">Checklist do Bling V3</p>
            <ul className="mt-3 space-y-2">
              <li>1. Criar o aplicativo no portal de developers do Bling.</li>
              <li>2. Configurar o callback exatamente como exibido acima.</li>
              <li>3. Liberar o escopo <code>order</code> no aplicativo.</li>
              <li>4. Registrar o webhook de pedido de venda apontando para a URL acima.</li>
              <li>5. Conectar o depositante correto nesta tela.</li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Depositantes integráveis</h2>
              <p className="mt-1 text-sm text-slate-600">
                Cada depositante pode possuir sua própria autorização OAuth2 e seu próprio
                mapeamento de empresa no Bling.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {depositantes?.length ?? 0} depositantes
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {depositantes?.length ? (
              depositantes.map((depositante) => {
                const configuracoes = parseDepositanteConfiguracoes(
                  depositante.configuracoes
                    ? JSON.stringify(depositante.configuracoes)
                    : depositante.observacoes,
                );
                const bling = configuracoes.bling;
                const isConnected = Boolean(bling?.connected);

                return (
                  <div key={depositante.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-base font-semibold text-slate-950">
                            {depositante.nome}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              depositante.ativo
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {depositante.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">{depositante.codigo}</p>

                        {isConnected ? (
                          <div className="space-y-1 text-sm text-slate-600">
                            <p>
                              Empresa conectada:{" "}
                              <span className="font-medium text-slate-900">
                                {bling?.companyName ?? "Aguardando identificação via API/webhook"}
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
                              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                                O vínculo já foi confirmado pelo `companyId`, mas o app do Bling ainda
                                não liberou escopo suficiente para lermos o nome da empresa pela API.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">
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
                          <form action={disconnectBlingIntegrationAction}>
                            <input type="hidden" name="depositanteId" value={depositante.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              className="border-rose-200 text-rose-700 hover:bg-rose-50"
                            >
                              <Unplug className="h-4 w-4" />
                              Desconectar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Nenhum depositante cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-950">O que fica pronto nesta etapa</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Autorização OAuth2 por depositante.",
            "Persistência segura do vínculo com a empresa do Bling.",
            "Endpoint de webhook validado com assinatura HMAC.",
            "Registro interno dos eventos de pedido para rastreabilidade operacional.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm text-slate-800">{value}</p>
    </div>
  );
}

function StatusBadge({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      <Link2 className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
