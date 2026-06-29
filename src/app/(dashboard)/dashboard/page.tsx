import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  Truck,
} from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireModuleAccess } from "@/lib/auth";
import {
  listOperationalIssuesFromDb,
  listReceivingOrdersFromDb,
  listReceivingStatsFromDb,
  listReceivingTasksFromDb,
} from "@/lib/receiving";
import {
  listShippingOrdersFromDb,
  listShippingQueuesFromDb,
  listShippingStatsFromDb,
} from "@/lib/shipping";
import {
  listStockExpiryAlertsFromDb,
  listStockMovementsFromDb,
  listStockBalancesFromDb,
  listStockStatsFromDb,
} from "@/lib/stock";

export default async function DashboardPage() {
  const user = await requireModuleAccess("dashboard");
  const depositanteId = user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined;
  const stockFilters = depositanteId ? { depositanteId } : undefined;
  const shippingFilters = depositanteId ? { depositanteId } : undefined;
  const receivingFilters = depositanteId ? { depositanteId } : undefined;

  const [
    receivingOrders,
    receivingTasks,
    operationalIssues,
    shippingOrders,
    stockBalances,
    stockMovements,
  ] = await Promise.all([
    listReceivingOrdersFromDb(receivingFilters),
    listReceivingTasksFromDb(),
    listOperationalIssuesFromDb(depositanteId ? { depositanteId } : undefined),
    listShippingOrdersFromDb(shippingFilters),
    listStockBalancesFromDb(stockFilters),
    listStockMovementsFromDb(stockFilters),
  ]);

  const [stockExpiryAlerts, receivingStats, shippingStats, shippingQueues, stockStats] =
    await Promise.all([
      listStockExpiryAlertsFromDb(stockFilters, 30, stockBalances),
      listReceivingStatsFromDb(user, receivingOrders, operationalIssues, receivingTasks),
      listShippingStatsFromDb(user, shippingOrders),
      listShippingQueuesFromDb(shippingOrders),
      listStockStatsFromDb(user, stockFilters, stockBalances),
    ]);

  const oldestReceiving = receivingOrders.slice(0, 5);
  const oldestShipping = shippingOrders.slice(0, 5);
  const topTasks = receivingTasks.slice(0, 4);
  const attentionItems = [
    ...operationalIssues.slice(0, 3).map((issue) => ({
      id: issue.id,
      title: issue.title,
      label: issue.type,
      help: `${issue.depositante} • ${issue.action}`,
      tone: "rose" as const,
      href: issue.orderId ? `/recebimento/${issue.orderId}` : "/recebimento",
    })),
    ...stockExpiryAlerts.slice(0, 3).map((alert) => ({
      id: alert.id,
      title: `${alert.protocol} • ${alert.productName}`,
      label: alert.severityLabel,
      help: `${alert.depositante} • ${alert.endereco} • validade ${alert.expiryDate}`,
      tone: alert.severity === "critico" ? ("rose" as const) : ("amber" as const),
      href: `/estoque/protocolos/${alert.id}`,
    })),
  ].slice(0, 6);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Dashboard"
        description="Resumo operacional real do WMS para acompanhamento do piloto: recebimento, expedição, estoque e pontos de atenção do turno."
        badge="Operação ao vivo"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Truck}
          label={receivingStats[0].label}
          value={receivingStats[0].value}
          help={receivingStats[0].help}
        />
        <StatCard
          icon={ClipboardList}
          label={shippingStats[0].label}
          value={shippingStats[0].value}
          help={shippingStats[0].help}
        />
        <StatCard
          icon={Boxes}
          label={stockStats[0].label}
          value={stockStats[0].value}
          help={stockStats[0].help}
        />
        <StatCard
          icon={AlertTriangle}
          label={stockStats[3].label}
          value={stockStats[3].value}
          help={stockStats[3].help}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Pontos de atenção</h2>
              <p className="mt-1 text-sm text-slate-600">
                Ocorrências e saldos sensíveis que merecem prioridade antes do piloto.
              </p>
            </div>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              {attentionItems.length} item(ns)
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {attentionItems.length ? (
              attentionItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-4 transition hover:shadow-sm ${
                    item.tone === "rose"
                      ? "border-rose-200 bg-rose-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm text-slate-700">{item.help}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Nenhum alerta crítico no escopo atual.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Filas de expedição</h2>
              <p className="mt-1 text-sm text-slate-600">
                Quantidade atual por etapa para guiar a distribuição do time.
              </p>
            </div>
            <Link
              href="/expedicao"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
            >
              Abrir módulo
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {shippingQueues.map((queue) => (
              <div
                key={queue.status}
                className="rounded-2xl border border-slate-200 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-950">{queue.label}</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {queue.orders}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{queue.help}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Recebimentos mais antigos</h2>
              <p className="mt-1 text-sm text-slate-600">
                Use esta fila para atacar primeiro os pedidos inbound mais antigos.
              </p>
            </div>
            <Link
              href="/recebimento"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
            >
              Ver todos
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {oldestReceiving.length ? (
              oldestReceiving.map((order) => (
                <Link
                  key={order.id}
                  href={`/recebimento/${order.id}`}
                  className="block rounded-2xl border border-slate-200 px-4 py-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{order.code}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {order.depositante} • {order.supplier}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                    <p>Previsão: {order.eta}</p>
                    <p>SKUs: {order.skuCount}</p>
                    <p>Volumes: {order.volumeCount}</p>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyBox message="Nenhum pedido de recebimento visível no momento." />
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Expedições prioritárias</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pedidos mais antigos ainda em aberto para orientar o picking e a conferência.
              </p>
            </div>
            <Link
              href="/expedicao"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
            >
              Ver todos
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {oldestShipping.length ? (
              oldestShipping.map((order) => (
                <Link
                  key={order.id}
                  href={`/expedicao/${order.id}`}
                  className="block rounded-2xl border border-slate-200 px-4 py-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{order.externalNumber}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {order.depositante} • {order.customer}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {order.statusLabel}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                    <p>Criação: {order.createdAt}</p>
                    <p>SLA: {order.ageLabel}</p>
                    <p>Unidades: {order.units}</p>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyBox message="Nenhum pedido de expedição visível no momento." />
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Tarefas em foco</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pendências imediatas para o time de recebimento.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {topTasks.length ? (
              topTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-950">{task.title}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {task.priority}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <p>Responsável: {task.assignee}</p>
                    <p>Prazo: {task.due}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyBox message="Nenhuma tarefa operacional em aberto." />
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Últimas movimentações de estoque</h2>
              <p className="mt-1 text-sm text-slate-600">
                Rastros mais recentes do estoque para auditoria rápida durante o piloto.
              </p>
            </div>
            <Link
              href="/estoque"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
            >
              Abrir estoque
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {stockMovements.length ? (
              stockMovements.map((movement) => (
                <div key={movement.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      {movement.protocol}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {movement.reference}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{movement.label}</p>
                  <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <p>Lote: {movement.lot}</p>
                    <p>Validade: {movement.expiry}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyBox message="Nenhuma movimentação de estoque encontrada no escopo atual." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}
