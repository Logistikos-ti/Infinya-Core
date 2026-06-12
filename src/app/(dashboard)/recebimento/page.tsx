import Link from "next/link";
import { AlertTriangle, ClipboardList, PackageCheck, Plus, TimerReset } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  listOperationalIssues,
  listReceivingOrders,
  listReceivingStats,
  listReceivingTasks,
} from "@/lib/wms-data";

export default function RecebimentoPage() {
  const receivingStats = listReceivingStats();
  const receivingOrders = listReceivingOrders();
  const receivingTasks = listReceivingTasks();
  const operationalIssues = listOperationalIssues();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Recebimento"
        description="Fluxo inbound do MVP: agenda de recebimento, conferência, ocorrências e entrada em estoque com rastreabilidade."
        badge="MVP"
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
        <StatCard icon={ClipboardList} label={receivingStats[0].label} value={receivingStats[0].value} help={receivingStats[0].help} />
        <StatCard icon={PackageCheck} label={receivingStats[1].label} value={receivingStats[1].value} help={receivingStats[1].help} />
        <StatCard icon={AlertTriangle} label={receivingStats[2].label} value={receivingStats[2].value} help={receivingStats[2].help} />
        <StatCard icon={TimerReset} label={receivingStats[3].label} value={receivingStats[3].value} help={receivingStats[3].help} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Pedidos de recebimento na fila
              </h2>
              <p className="text-sm text-slate-600">
                Base para o primeiro painel operacional do inbound.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Mês 1
            </span>
          </div>

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
                  <tr key={order.code} className="border-b border-slate-100 last:border-b-0">
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
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Tarefas operacionais</h2>
          <div className="mt-4 space-y-4">
            {receivingTasks.map((task) => (
              <div key={task.title} className="rounded-2xl border border-slate-200 p-4">
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
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Regras obrigatórias do módulo
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Pedido de recebimento manual e importação por documento fiscal.</li>
            <li>Conferência por item, lote, validade e quantidade recebida.</li>
            <li>Tratativa formal de falta, sobra, avaria e validade crítica.</li>
            <li>Protocolo de depósito com histórico por usuário e horário.</li>
            <li>Movimentação automática para estoque ao concluir a conferência.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Ocorrências abertas</h2>
          <div className="mt-4 space-y-3">
            {operationalIssues.map((issue) => (
              <div key={issue.title} className="rounded-2xl bg-rose-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-rose-900">{issue.title}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-rose-700">
                    {issue.type}
                  </span>
                </div>
                <p className="mt-2 text-xs text-rose-700">{issue.depositante}</p>
                <p className="mt-2 text-sm text-rose-800">{issue.action}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
