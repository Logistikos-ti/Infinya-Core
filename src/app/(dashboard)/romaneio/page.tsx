import Link from "next/link";
import { FileDown, Truck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { requireModuleAccess } from "@/lib/auth";
import { listRomaneioGroupsFromDb } from "@/lib/romaneio";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type RomaneioPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    transportadora?: string;
    dataInicial?: string;
    dataFinal?: string;
  }>;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "PRONTO_ROMANEIO", label: "Pronto para romaneio" },
  { value: "EXPEDIDO", label: "Expedido" },
] as const;

export default async function RomaneioPage({ searchParams }: RomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const carrierFilter = params?.transportadora?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  const { data: depositantes } = await supabase.from("depositantes").select("id, nome").order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  const groups = await listRomaneioGroupsFromDb(user, {
    status: statusFilter || undefined,
    depositanteId: depositanteFilter || undefined,
    carrier: carrierFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const totalOrders = groups.reduce((sum, group) => sum + group.orderCount, 0);
  const totalUnits = groups.reduce((sum, group) => sum + group.totalUnitsRaw, 0);
  const totalValue = groups.reduce((sum, group) => sum + group.totalValueRaw, 0);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Romaneio"
        description="Agrupamento real de pedidos por transportadora, consolidando a carga para despacho e emissão do romaneio."
        badge="Operação"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Transportadoras na fila" value={String(groups.length)} />
        <SummaryCard label="Pedidos agrupados" value={String(totalOrders)} />
        <SummaryCard label="Unidades" value={totalUnits.toLocaleString("pt-BR")} />
        <SummaryCard
          label="Valor total"
          value={totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Filtro operacional</h2>
          <p className="text-sm text-slate-600">
            Filtre a fila de romaneio por status, depositante, transportadora e previsão de envio.
          </p>
        </div>

        <form className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Depositante</span>
            <select
              name="depositante"
              defaultValue={depositanteFilter}
              disabled={user.papel === "DEPOSITANTE"}
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
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Transportadora</span>
            <input
              type="text"
              name="transportadora"
              defaultValue={carrierFilter}
              placeholder="Nome da transportadora"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Data inicial</span>
            <input
              type="date"
              name="dataInicial"
              defaultValue={dateFrom}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Data final</span>
            <input
              type="date"
              name="dataFinal"
              defaultValue={dateTo}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            />
          </label>

          <div className="flex items-end gap-2 xl:col-span-5">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Aplicar
            </button>
            <Link
              href="/romaneio"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-6">
        {groups.length ? (
          groups.map((group) => (
            <article key={group.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                      {group.orderCount} pedidos
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {group.statuses.join(" • ")}
                    </span>
                  </div>
                  <h2 className="mt-3 flex items-center gap-2 text-lg font-semibold text-slate-950">
                    <Truck className="h-5 w-5 text-slate-500" />
                    {group.carrierName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Depositantes: {group.depositantes.join(", ") || "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Destinos: {group.destinations.join(", ") || "-"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Unidades: {group.totalUnits}</span>
                    <span>Valor: {group.totalValue}</span>
                    <span>Cutoff: {group.cutoff}</span>
                  </div>
                </div>

                <form action="/api/romaneio/pdf" method="get" target="_blank">
                  {group.orders.map((order) => (
                    <input key={order.id} type="hidden" name="ids" value={order.id} />
                  ))}
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    <FileDown className="h-4 w-4" />
                    Emitir romaneio em PDF
                  </button>
                </form>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Pedido</th>
                      <th className="px-4 py-3 font-medium">Depositante</th>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Destino</th>
                      <th className="px-4 py-3 font-medium">Itens</th>
                      <th className="px-4 py-3 font-medium">Unidades</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Previsão</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.orders.map((order) => (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-900">
                          <div className="font-medium">{order.externalNumber}</div>
                          <div className="text-xs text-slate-500">{order.code}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{order.depositante}</td>
                        <td className="px-4 py-3 text-slate-600">{order.customer}</td>
                        <td className="px-4 py-3 text-slate-600">{order.destination}</td>
                        <td className="px-4 py-3 text-slate-600">{order.itemCount}</td>
                        <td className="px-4 py-3 text-slate-600">{order.units}</td>
                        <td className="px-4 py-3 text-slate-600">{order.total}</td>
                        <td className="px-4 py-3 text-slate-600">{order.shipForecast}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {order.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Nenhum agrupamento de romaneio encontrado com os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
