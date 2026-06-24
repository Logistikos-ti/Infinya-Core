import Link from "next/link";
import {
  Activity,
  ClipboardCheck,
  Eye,
  ListChecks,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  TimerReset,
  Truck,
} from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants, isAdminUser } from "@/lib/permissions";
import {
  formatShippingStatusLabel,
  listShippingFlowSteps,
  listShippingOrdersFromDb,
  listShippingQueuesFromDb,
  listShippingStatsFromDb,
} from "@/lib/shipping";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type ExpedicaoPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    dataInicial?: string;
    dataFinal?: string;
    transportadora?: string;
    cliente?: string;
    pedido?: string;
    marketplace?: string;
  }>;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "NOVO", label: "Novo" },
  { value: "EM_SEPARACAO", label: "Em separação" },
  { value: "SEPARADO", label: "Separado" },
  { value: "EM_CONFERENCIA", label: "Em conferência" },
  { value: "CONFERIDO", label: "Conferido" },
  { value: "PRONTO_ROMANEIO", label: "Pronto para romaneio" },
  { value: "EXPEDIDO", label: "Expedido" },
  { value: "CANCELADO", label: "Cancelado" },
];

export default async function ExpedicaoPage({ searchParams }: ExpedicaoPageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const carrierFilter = params?.transportadora?.trim() ?? "";
  const customerFilter = params?.cliente?.trim() ?? "";
  const orderSearchFilter = params?.pedido?.trim() ?? "";
  const marketplaceFilter = params?.marketplace?.trim() ?? "";
  const supabase = await createSupabaseServerClient();

  const { data: depositantes } = await supabase.from("depositantes").select("id, nome").order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;

  const [shippingStats, shippingOrders, shippingQueues] = await Promise.all([
    listShippingStatsFromDb(user),
    listShippingOrdersFromDb({
      status: statusFilter || undefined,
      depositanteId: effectiveDepositanteFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      carrier: carrierFilter || undefined,
      customer: customerFilter || undefined,
      orderSearch: orderSearchFilter || undefined,
      marketplace: marketplaceFilter || undefined,
    }),
    listShippingQueuesFromDb(),
  ]);
  const shippingFlow = listShippingFlowSteps();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Expedição"
        description="Pedidos integrados do Bling, fila operacional de separação, conferência e preparação para romaneio."
        badge="Banco operacional"
      />

      <div className="flex flex-wrap justify-end gap-3">
        <Link
          href="/expedicao/separacao"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <ListChecks className="h-4 w-4" />
          Tela de separação
        </Link>
        <Link
          href="/expedicao/conferencia"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ClipboardCheck className="h-4 w-4" />
          Tela de conferência
        </Link>
        <Link
          href="/expedicao/novo"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Novo pedido manual
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Truck} label={shippingStats[0].label} value={shippingStats[0].value} help={shippingStats[0].help} />
        <StatCard icon={PackageCheck} label={shippingStats[1].label} value={shippingStats[1].value} help={shippingStats[1].help} />
        <StatCard icon={Activity} label={shippingStats[2].label} value={shippingStats[2].value} help={shippingStats[2].help} />
        <StatCard icon={TimerReset} label={shippingStats[3].label} value={shippingStats[3].value} help={shippingStats[3].help} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Pedidos de expedição</h2>
              <p className="text-sm text-slate-600">
                Fila real de pedidos integrados via Bling, com segregação por depositante.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {shippingOrders.length} pedidos
            </span>
          </div>

          <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
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
                  Pedido ou código
                </span>
                <input
                  type="text"
                  name="pedido"
                  defaultValue={orderSearchFilter}
                  placeholder="Número, código ou loja"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
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
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</span>
                <input
                  type="text"
                  name="cliente"
                  defaultValue={customerFilter}
                  placeholder="Nome do cliente"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Transportadora
                </span>
                <input
                  type="text"
                  name="transportadora"
                  defaultValue={carrierFilter}
                  placeholder="Nome da transportadora"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Loja ou marketplace
                </span>
                <input
                  type="text"
                  name="marketplace"
                  defaultValue={marketplaceFilter}
                  placeholder="Shopee, Magalu, site..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
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

              <div className="flex items-end gap-2 xl:col-span-2">
                <Button type="submit" className="h-11 bg-slate-950 text-white hover:bg-slate-800">
                  <Search className="h-4 w-4" />
                  Filtrar
                </Button>
                <Link
                  href="/expedicao"
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
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Loja / canal</th>
                  <th className="pb-3 font-medium">Transportadora</th>
                  <th className="pb-3 font-medium">Destino</th>
                  <th className="pb-3 font-medium">Itens</th>
                  <th className="pb-3 font-medium">Unidades</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {shippingOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 text-slate-900">
                      <div className="font-medium">{order.externalNumber}</div>
                      <div className="text-xs text-slate-500">
                        {order.code} | {order.origin}
                      </div>
                    </td>
                    <td className="py-3 text-slate-600">{order.depositante}</td>
                    <td className="py-3 text-slate-600">{order.customer}</td>
                    <td className="py-3 text-slate-600">
                      <div>{order.storeDisplay}</div>
                      <div className="text-xs text-slate-500">
                        Marketplace: {order.marketplace} | Canal: {order.channel}
                      </div>
                    </td>
                    <td className="py-3 text-slate-600">{order.carrierName}</td>
                    <td className="py-3 text-slate-600">{order.destination}</td>
                    <td className="py-3 text-slate-600">{order.itemCount}</td>
                    <td className="py-3 text-slate-600">{order.units}</td>
                    <td className="py-3 text-slate-600">{order.total}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {formatShippingStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/expedicao/${order.id}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Visualizar
                        </Link>
                        {isAdminUser(user) ? (
                          <Link
                            href={`/expedicao/${order.id}/editar`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-950 bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!shippingOrders.length ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-500">
                      Nenhum pedido de expedição encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Filas operacionais</h2>
            <div className="mt-4 space-y-4">
              {shippingQueues.map((queue) => (
                <div key={queue.status} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{queue.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{queue.help}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {queue.orders} pedidos
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Fluxo obrigatório</h2>
            <div className="mt-4 space-y-3">
              {shippingFlow.map((step, index) => (
                <div key={step} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {index + 1}. {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
