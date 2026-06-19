import { Activity, AlertTriangle, Boxes, FileClock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ModuleCard } from "@/components/dashboard/module-card";
import { IntegrationAlertCenter } from "@/components/integrations/integration-alert-center";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireModuleAccess } from "@/lib/auth";
import { statusPedidoExpedicaoFluxo } from "@/lib/constants";
import { buildIntegrationAlerts } from "@/lib/integration-alerts";
import { canAccessModule, type AppModule } from "@/lib/permissions";
import { listReceivingOrdersFromDb, listReceivingStatsFromDb } from "@/lib/receiving";
import { listRoadmapMilestones } from "@/lib/wms-data";
import { isScopedDepositanteUser } from "@/lib/tenant-scope";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const focusModules: ReadonlyArray<{
  href: string;
  title: string;
  description: string;
  status: string;
  module: AppModule;
}> = [
  {
    href: "/recebimento",
    title: "Recebimento",
    description: "Inbound, conferência e entrada em estoque com lote e validade.",
    status: "Base operacional ligada ao banco",
    module: "recebimento",
  },
  {
    href: "/expedicao",
    title: "Expedição",
    description: "Separação, conferência, etiquetas e integração com marketplaces.",
    status: "Próximo módulo crítico",
    module: "expedicao",
  },
  {
    href: "/estoque",
    title: "Estoque",
    description: "Saldos, endereçamento, FEFO/FIFO, inventário e rastreabilidade.",
    status: "Estrutura inicial",
    module: "estoque",
  },
  {
    href: "/configuracoes",
    title: "Configurações",
    description: "Depositantes, usuários, produtos, transportadoras e parâmetros.",
    status: "Cadastros base",
    module: "configuracoes",
  },
] as const;

export default async function DashboardPage() {
  const user = await requireModuleAccess("dashboard");
  const today = format(new Date(), "EEEE, dd 'de' MMMM", {
    locale: ptBR,
  });
  const supabase = await createSupabaseServerClient();
  const [receivingOrders, receivingStats, depositantes, shippingOrders, linkedDocuments] = await Promise.all([
    listReceivingOrdersFromDb(),
    listReceivingStatsFromDb(user),
    supabase.from("depositantes").select("id, nome, configuracoes, observacoes").order("nome"),
    supabase.from("pedidos_expedicao").select("id, depositante_id, origem"),
    supabase.from("documentos_armazenados").select("pedido_expedicao_id, tipo"),
  ]);
  const roadmapMilestones = listRoadmapMilestones();
  const visibleModules = focusModules.filter((module) => canAccessModule(user, module.module));
  const integrationAlerts = isScopedDepositanteUser(user)
    ? []
    : buildIntegrationAlerts({
        depositantes: ((depositantes.data ?? []) as Array<{
          id: string;
          nome: string;
          configuracoes: unknown;
          observacoes: string | null;
        }>),
        shippingOrders: ((shippingOrders.data ?? []) as Array<{
          id: string;
          depositante_id: string;
          origem: string;
        }>),
        linkedDocuments: ((linkedDocuments.data ?? []) as Array<{
          pedido_expedicao_id: string | null;
          tipo: string;
        }>),
      });

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Infinya Core
            </span>
            <h1 className="text-3xl font-semibold text-slate-950">
              {isScopedDepositanteUser(user)
                ? `Operação de ${user.depositanteNome ?? "seu depositante"}`
                : "Base inicial do nosso produto WMS"}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {isScopedDepositanteUser(user)
                ? "Você está vendo apenas os pedidos, indicadores e documentos do seu depositante, já dentro da mesma base multi-tenant do WMS."
                : "A fundação técnica já está pronta para crescer em cima dos módulos principais da operação: recebimento, expedição, estoque, NFe, relatórios e configuração multi-depositante."}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              Next.js 16 + TypeScript
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
              Supabase integrado
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
              Multi-tenant por depositante
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-slate-50 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Ritmo de construção
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {isScopedDepositanteUser(user) ? "Painel do depositante" : "Semana 2"}
          </p>
          <p className="mt-1 text-sm text-slate-300">{today}</p>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <Boxes className="mt-0.5 h-4 w-4 text-sky-400" />
              <span>Estrutura do app e domínios operacionais criados.</span>
            </div>
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 h-4 w-4 text-sky-400" />
              <span>Recebimento já usando pedidos reais do Supabase.</span>
            </div>
            <div className="flex items-start gap-3">
              <FileClock className="mt-0.5 h-4 w-4 text-sky-400" />
              <span>
                {isScopedDepositanteUser(user)
                  ? "Seu acesso está isolado para acompanhar somente a sua operação."
                  : "Passo atual: consolidar recebimento real e depois puxar estoque."}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Boxes}
          label={isScopedDepositanteUser(user) ? "Escopo atual" : "Recebimentos abertos"}
          value={isScopedDepositanteUser(user) ? (user.depositanteNome ?? "1") : String(receivingOrders.length)}
          help={
            isScopedDepositanteUser(user)
              ? "Você está navegando apenas dentro do seu ambiente."
              : "Pedidos reais já cadastrados no banco."
          }
        />
        <StatCard
          icon={Activity}
          label={receivingStats[0].label}
          value={receivingStats[0].value}
          help={receivingStats[0].help}
        />
        <StatCard
          icon={FileClock}
          label={receivingStats[1].label}
          value={receivingStats[1].value}
          help={receivingStats[1].help}
        />
        <StatCard
          icon={AlertTriangle}
          label="Dor prioritária"
          value="Recebimento real"
          help="Agora estamos trocando mock por fluxo operacional persistido."
        />
      </section>

      {!isScopedDepositanteUser(user) ? (
        <IntegrationAlertCenter initialAlerts={integrationAlerts} compact />
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Módulos principais</h2>
          <p className="text-sm text-slate-600">
            O app já está organizado para crescer em cima da operação real.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {visibleModules.map((module) => (
            <ModuleCard
              key={module.href}
              href={module.href}
              title={module.title}
              description={module.description}
              status={module.status}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-950">
              Roadmap em execução
            </h2>
            <p className="text-sm text-slate-600">
              Blocos priorizados para a construção do nosso WMS.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {roadmapMilestones.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {item.status}
                  </span>
                </div>
                <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                  Responsável: {item.owner}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-950">
              Recebimento em foco
            </h2>
            <p className="text-sm text-slate-600">
              Pedidos que guiam a primeira entrega operacional.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {receivingOrders.slice(0, 3).map((order) => (
              <div key={order.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{order.code}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {order.depositante} - {order.supplier}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    {order.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <span>{order.skuCount} SKUs</span>
                  <span>{order.volumeCount} volumes</span>
                  <span>{order.eta}</span>
                </div>
              </div>
            ))}
            {!receivingOrders.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Nenhum recebimento disponível ainda.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-950">
            Fluxo obrigatório de expedição
          </h2>
          <p className="text-sm text-slate-600">
            Este fluxo já fica centralizado como regra de negócio da base do projeto.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {statusPedidoExpedicaoFluxo.map((status, index) => (
            <div key={status} className="flex items-center gap-3">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {status}
              </span>
              {index < statusPedidoExpedicaoFluxo.length - 1 ? (
                <span className="text-slate-300">-&gt;</span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
