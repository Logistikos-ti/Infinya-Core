import { Activity, AlertTriangle, Boxes, FileClock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { statusPedidoExpedicaoFluxo } from "@/lib/constants";
import { ModuleCard } from "@/components/dashboard/module-card";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  listReceivingOrders,
  listReceivingStats,
  listRoadmapMilestones,
} from "@/lib/wms-data";

const focusModules = [
  {
    href: "/recebimento",
    title: "Recebimento",
    description: "Inbound, conferência e entrada em estoque com lote e validade.",
    status: "Módulo em construção",
  },
  {
    href: "/expedicao",
    title: "Expedição",
    description: "Separação, conferência, etiquetas e integração com marketplaces.",
    status: "Próximo módulo crítico",
  },
  {
    href: "/estoque",
    title: "Estoque",
    description: "Saldos, endereçamento, FEFO/FIFO, inventário e rastreabilidade.",
    status: "Estrutura inicial",
  },
  {
    href: "/configuracoes",
    title: "Configurações",
    description: "Depositantes, usuários, produtos, transportadoras e parâmetros.",
    status: "Cadastros base",
  },
] as const;

export default function DashboardPage() {
  const today = format(new Date(), "EEEE, dd 'de' MMMM", {
    locale: ptBR,
  });
  const receivingOrders = listReceivingOrders();
  const receivingStats = listReceivingStats();
  const roadmapMilestones = listRoadmapMilestones();

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Infinya Core
            </span>
            <h1 className="text-3xl font-semibold text-slate-950">
              Base inicial do nosso produto WMS
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              A fundação técnica já está pronta para crescer em cima dos módulos
              principais da operação: recebimento, expedição, estoque, NFe,
              relatórios e configuração multi-depositante.
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
          <p className="mt-3 text-2xl font-semibold">Semana 1</p>
          <p className="mt-1 text-sm text-slate-300">{today}</p>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <Boxes className="mt-0.5 h-4 w-4 text-sky-400" />
              <span>Estrutura do app e domínios operacionais criados.</span>
            </div>
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 h-4 w-4 text-sky-400" />
              <span>Dashboard base pronto para conectar métricas reais.</span>
            </div>
            <div className="flex items-start gap-3">
              <FileClock className="mt-0.5 h-4 w-4 text-sky-400" />
              <span>Passo atual: Supabase, auth e primeira migration.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Boxes}
          label="Depositantes ativos"
          value="8"
          help="Base prevista para isolamento por RLS."
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
          value="Bling V3"
          help="Fila travada e reprocessamento entrarão no módulo de expedição."
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Módulos principais
          </h2>
          <p className="text-sm text-slate-600">
            O app já está organizado para crescer em cima da operação real.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {focusModules.map((module) => (
            <ModuleCard key={module.href} {...module} />
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
              <div key={order.code} className="rounded-2xl bg-slate-50 p-4">
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
