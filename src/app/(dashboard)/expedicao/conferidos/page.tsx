import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Route } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { listShippingOrdersFromDb } from "@/lib/shipping";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type ShippingConferidosPageProps = {
  searchParams?: Promise<{
    depositante?: string;
    pedido?: string;
    feedback?: string;
  }>;
};

export default async function ShippingConferidosPage({ searchParams }: ShippingConferidosPageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback?.trim() ?? "";
  const pedidoFilter = params?.pedido?.trim() ?? "";
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  const { data: depositantes } = await supabase.from("depositantes").select("id, nome").order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  const allOrders = await listShippingOrdersFromDb({
    depositanteId: depositanteFilter || undefined,
    orderSearch: pedidoFilter || undefined,
  });

  const orders = allOrders.filter(
    (order) =>
      order.status === "PRONTO_ROMANEIO" ||
      (order.status === "CONFERIDO" && order.releasedWithoutRomaneio),
  );

  const withoutRomaneio = orders.filter((order) => order.releasedWithoutRomaneio).length;
  const readyForRomaneio = orders.filter((order) => order.status === "PRONTO_ROMANEIO").length;

  return (
    <div className="space-y-6">
      <Link
        href="/expedicao"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition-all hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para expedição
      </Link>

      <ModulePageHeader
        title="Pedidos Conferidos"
        description="Pedidos já conferidos, aguardando romaneio ou liberados sem passar por romaneio."
        badge="Pós-conferência"
      />

      {feedback ? (
        <div
          className={`rounded-3xl border px-5 py-4 text-sm font-bold shadow-sm ${
            feedback === "liberado-romaneio"
              ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedback === "liberado-romaneio"
            ? "Pedido liberado para romaneio com sucesso."
            : "Pedido liberado sem romaneio e mantido na fila de conferidos."}
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatTile icon={ClipboardCheck} label="Pedidos conferidos" value={String(orders.length)} />
        <StatTile icon={Route} label="Liberados para romaneio" value={String(readyForRomaneio)} />
        <StatTile icon={CheckCircle2} label="Conferidos sem romaneio" value={String(withoutRomaneio)} />
      </section>

      <section className="glass-card rounded-3xl border border-slate-200/60 p-6 shadow-sm dark:border-zinc-800/60">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Filtro operacional</h2>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
            Consulte rapidamente os pedidos já conferidos e veja quais seguiram para romaneio.
          </p>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Pedido</span>
            <input
              type="text"
              name="pedido"
              defaultValue={pedidoFilter}
              placeholder="Buscar por pedido"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Depositante</span>
            <select
              name="depositante"
              defaultValue={depositanteFilter}
              disabled={user.papel === "DEPOSITANTE"}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
            >
              <option value="">Todos</option>
              {depositanteOptions.map((depositante) => (
                <option key={depositante.id} value={depositante.id}>
                  {depositante.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3 md:col-span-2">
            <Button type="submit" className="h-12 flex-1 rounded-xl bg-slate-900 font-bold text-white shadow-md transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
              Aplicar filtros
            </Button>
            <Link
              href="/expedicao/conferidos"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {orders.length ? (
          orders.map((order) => (
            <article
              key={order.id}
              className="glass-card rounded-3xl border border-slate-200/60 p-6 shadow-sm transition-all hover:border-primary-500/30 hover:shadow-md dark:border-zinc-800/60"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border ${
                        order.status === "PRONTO_ROMANEIO"
                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {order.statusLabel}
                    </span>
                    <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                      {order.depositante}
                    </span>
                  </div>

                  <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{order.displayNumber}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
                    {order.customer} <span className="px-1 text-slate-300 dark:text-zinc-600">•</span> {order.destination}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                    <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">Marketplace {order.marketplace}</span>
                    <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">Código interno {order.code}</span>
                    <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">Criado em {order.createdAt}</span>
                    <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">{order.itemCount} item(ns)</span>
                    <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">{order.units} unidade(s)</span>
                  </div>
                </div>

                <Link
                  href={`/expedicao/conferencia/${order.id}`}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-primary-500 px-6 text-sm font-bold text-white shadow-md shadow-primary-500/20 transition-all hover:bg-primary-600"
                >
                  Abrir pedido
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-12 text-center text-sm font-medium text-slate-500 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
            Nenhum pedido conferido encontrado com os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card rounded-3xl border border-slate-200/60 p-6 shadow-sm transition-all hover:border-primary-500/30 dark:border-zinc-800/60">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className="rounded-2xl bg-primary-500/10 p-4 text-primary-600 dark:text-primary-400">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
