import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  PackageCheck,
  Plus,
  Search,
  TimerReset,
} from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants } from "@/lib/permissions";
import {
  listOperationalIssuesFromDb,
  listReceivingOrdersFromDb,
  listReceivingStatsFromDb,
  listReceivingTasksFromDb,
} from "@/lib/receiving";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type RecebimentoPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    dataInicial?: string;
    dataFinal?: string;
  }>;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "AGUARDANDO", label: "Aguardando" },
  { value: "EM_RECEBIMENTO", label: "Em recebimento" },
  { value: "DIVERGENCIA", label: "Divergência" },
  { value: "RECEBIDO_PARCIAL", label: "Recebido parcial" },
  { value: "RECEBIDO", label: "Recebido" },
  { value: "CANCELADO", label: "Cancelado" },
];

export default async function RecebimentoPage({ searchParams }: RecebimentoPageProps) {
  const user = await requireModuleAccess("recebimento");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const supabase = await createSupabaseServerClient();

  const { data: depositantes } = await supabase.from("depositantes").select("id, nome").order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;

  const [receivingStats, receivingOrders, receivingTasks, operationalIssues] = await Promise.all([
    listReceivingStatsFromDb(user),
    listReceivingOrdersFromDb({
      status: statusFilter || undefined,
      depositanteId: effectiveDepositanteFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    listReceivingTasksFromDb(),
    listOperationalIssuesFromDb(),
  ]);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Recebimento"
        description="Fluxo inbound real: agenda de recebimento, conferência, ocorrências e entrada em estoque com rastreabilidade."
        badge="Banco operacional"
      />

      <div className="flex justify-end">
        <Link
          href="/recebimento/novo"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Abrir novo recebimento
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label={receivingStats[0].label}
          value={receivingStats[0].value}
          help={receivingStats[0].help}
        />
        <StatCard
          icon={PackageCheck}
          label={receivingStats[1].label}
          value={receivingStats[1].value}
          help={receivingStats[1].help}
        />
        <StatCard
          icon={AlertTriangle}
          label={receivingStats[2].label}
          value={receivingStats[2].value}
          help={receivingStats[2].help}
        />
        <StatCard
          icon={TimerReset}
          label={receivingStats[3].label}
          value={receivingStats[3].value}
          help={receivingStats[3].help}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Pedidos de recebimento na fila
              </h2>
              <p className="text-sm text-slate-600">
                Consulte por status, depositante e janela de data prevista.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {receivingOrders.length} pedidos
            </span>
          </div>

          <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.9fr_0.9fr_auto]">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </span>
                <select
                  name="status"
                  defaultValue={statusFilter}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value || "todos"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Depositante
                </span>
                <select
                  name="depositante"
                  defaultValue={effectiveDepositanteFilter}
                  disabled={!canManageMultipleTenants(user)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Todos</option>
                  {depositanteOptions.map((depositante) => (
                    <option key={depositante.id} value={depositante.id}>
                      {depositante.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Data inicial
                </span>
                <input
                  type="date"
                  name="dataInicial"
                  defaultValue={dateFrom}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Data final
                </span>
                <input
                  type="date"
                  name="dataFinal"
                  defaultValue={dateTo}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
              </label>

              <div className="flex items-end gap-2">
                <Button type="submit" className="h-11 bg-slate-950 text-white hover:bg-slate-800">
                  <Search className="h-4 w-4" />
                  Filtrar
                </Button>
                <Link
                  href="/recebimento"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
                >
                  Limpar
                </Link>
              </div>
            </div>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Pedido</th>
                  <th className="pb-3 font-medium">Depositante</th>
                  <th className="pb-3 font-medium">Fornecedor</th>
                  <th className="pb-3 font-medium">Previsão</th>
                  <th className="pb-3 font-medium">SKUs</th>
                  <th className="pb-3 font-medium">Volumes</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {receivingOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 font-medium text-slate-900">
                      <Link
                        href={`/recebimento/${order.id}`}
                        className="transition hover:text-sky-700"
                      >
                        {order.code}
                      </Link>
                    </td>
                    <td className="py-3 text-slate-600">{order.depositante}</td>
                    <td className="py-3 text-slate-600">{order.supplier}</td>
                    <td className="py-3 text-slate-600">{order.eta}</td>
                    <td className="py-3 text-slate-600">{order.skuCount}</td>
                    <td className="py-3 text-slate-600">{order.volumeCount}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {formatStatusLabel(order.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!receivingOrders.length ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      Nenhum pedido encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Tarefas operacionais</h2>
          <div className="mt-4 space-y-4">
            {receivingTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.type}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {task.priority}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{task.assignee}</span>
                  <span>{task.due}</span>
                </div>
              </div>
            ))}
            {!receivingTasks.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma tarefa de recebimento cadastrada ainda.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Regras obrigatórias do módulo
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Pedido de recebimento nasce vinculado a um depositante real.</li>
            <li>Conferência por item, lote, validade e quantidade recebida.</li>
            <li>Tratativa formal de falta, sobra, avaria e validade crítica.</li>
            <li>Protocolo de depósito com histórico por usuário e horário.</li>
            <li>Movimentação automática para estoque ao concluir a conferência.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Ocorrências abertas</h2>
          <div className="mt-4 space-y-3">
            {operationalIssues.length ? (
              operationalIssues.map((issue) => (
                <div key={issue.id} className="rounded-2xl bg-rose-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-rose-900">{issue.title}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-rose-700">
                      {issue.type}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-rose-700">{issue.depositante}</p>
                  <p className="mt-2 text-sm text-rose-800">{issue.action}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma ocorrência aberta no momento.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatStatusLabel(status: string) {
  switch (status) {
    case "AGUARDANDO":
      return "Aguardando";
    case "EM_RECEBIMENTO":
      return "Em recebimento";
    case "DIVERGENCIA":
      return "Divergência";
    case "RECEBIDO_PARCIAL":
      return "Recebido parcial";
    case "RECEBIDO":
      return "Recebido";
    case "CANCELADO":
      return "Cancelado";
    case "RASCUNHO":
      return "Rascunho";
    default:
      return status;
  }
}
