import Link from "next/link";
import { ArrowLeft, PackageCheck, ScanSearch, TriangleAlert, UserRound } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { listPickingOperatorsFromDb, listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type ExpedicaoSeparacaoPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    operador?: string;
    feedback?: string;
    page?: string;
    perPage?: string;
  }>;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "NOVO", label: "Aguardando início" },
  { value: "EM_SEPARACAO", label: "Em separação" },
  { value: "SEPARADO", label: "Separado" },
] as const;

export default async function ExpedicaoSeparacaoPage({
  searchParams,
}: ExpedicaoSeparacaoPageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const operatorFilter = params?.operador?.trim() ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";
  const feedback = params?.feedback?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  const { data: depositantes } = await supabase.from("depositantes").select("id, nome").order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  const [orders, operators] = await Promise.all([
    listShippingPickingOrdersFromDb(user, {
      status: statusFilter || undefined,
      depositanteId: depositanteFilter || undefined,
      operatorId: operatorFilter || undefined,
    }),
    listPickingOperatorsFromDb(user, depositanteFilter || undefined),
  ]);

  const pendingOrders = orders.filter((order) => order.status === "NOVO").length;
  const runningOrders = orders.filter((order) => order.status === "EM_SEPARACAO").length;
  const shortageOrders = orders.filter((order) => order.shortageUnits > 0).length;
  const totalOrders = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedOrders = orders.slice(startIndex, startIndex + perPage);
  const visibleStart = totalOrders ? startIndex + 1 : 0;
  const visibleEnd = Math.min(startIndex + perPage, totalOrders);
  const baseQuery = {
    status: statusFilter,
    operador: operatorFilter,
    depositante: depositanteFilter,
    feedback,
    perPage: String(perPage),
  };

  return (
    <div className="space-y-6 relative opacity-95">
      <Link
        href="/expedicao"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-zinc-400 transition hover:text-primary-600 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para expedição
      </Link>

      <ModulePageHeader
        title="Fila de Separação (Picking)"
        description="Fila de pedidos por operador, com rota sugerida no armazém, leitura de código de barras e apontamento das quantidades separadas."
        badge="Em Foco"
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "concluido"
              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {feedback === "concluido"
            ? "Separação concluída e pedido movido para o próximo passo."
            : feedback === "incompleto"
              ? "Ainda existem itens pendentes. O pedido voltou para a fila para nova separação."
              : feedback === "inatividade"
                ? "Pedido devolvido para a fila por inatividade do operador."
                : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={PackageCheck}
          label="Pedidos na fila"
          value={String(totalOrders)}
          colorClass="text-sky-600 dark:text-sky-400 bg-sky-500/10"
          borderClass="hover:border-sky-500/30 border-l-4 border-l-sky-500"
        />
        <StatTile
          icon={ScanSearch}
          label="Aguardando início"
          value={String(pendingOrders)}
          colorClass="text-amber-600 dark:text-amber-400 bg-amber-500/10"
          borderClass="hover:border-amber-500/30 border-l-4 border-l-amber-500"
        />
        <StatTile
          icon={UserRound}
          label="Em separação"
          value={String(runningOrders)}
          colorClass="text-primary-600 dark:text-primary-400 bg-primary-500/10"
          borderClass="hover:border-primary-500/30 border-l-4 border-l-primary-500"
        />
        <StatTile
          icon={TriangleAlert}
          label="Falta de saldo"
          value={String(shortageOrders)}
          colorClass="text-rose-600 dark:text-rose-400 bg-rose-500/10"
          borderClass="hover:border-rose-500/30 border-l-4 border-l-rose-500"
        />
      </section>

      <section className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md p-6 shadow-sm transition-all hover:border-primary-500/30">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Filtro operacional</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Use operador, depositante e status para montar a fila de picking do turno.
          </p>
        </div>

        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-end">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">Status</span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-slate-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "todos"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">Operador</span>
            <select
              name="operador"
              defaultValue={operatorFilter}
              className="h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-slate-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
            >
              <option value="">Todos</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">Depositante</span>
            <select
              name="depositante"
              defaultValue={depositanteFilter}
              disabled={user.papel === "DEPOSITANTE"}
              className="h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-slate-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all disabled:bg-slate-50 disabled:dark:bg-zinc-900/50 disabled:opacity-50"
            >
              <option value="">Todos</option>
              {depositanteOptions.map((depositante) => (
                <option key={depositante.id} value={depositante.id}>
                  {depositante.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">Página</span>
            <select
              name="perPage"
              defaultValue={String(perPage)}
              className="h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-slate-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
            >
              <option value="10">10 / página</option>
              <option value="20">20 / página</option>
              <option value="50">50 / página</option>
            </select>
          </label>

          <div className="flex items-center gap-2">
            <Button type="submit" className="h-11 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-white transition-all font-semibold rounded-xl flex-1">
              Aplicar Filtros
            </Button>
            <Link
              href="/expedicao/separacao"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-700 px-4 text-sm font-semibold text-slate-700 dark:text-zinc-300 transition hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {paginatedOrders.length ? (
          <>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/65 px-4 py-3 text-sm text-slate-600 dark:text-zinc-400 md:flex-row md:items-center md:justify-between">
              <span>
                Exibindo {visibleStart}-{visibleEnd} de {totalOrders} pedido(s)
              </span>
              <div className="flex items-center gap-2">
                <PageLink
                  disabled={currentPage <= 1}
                  href={`/expedicao/separacao?${buildQueryString({
                    ...baseQuery,
                    page: String(currentPage - 1),
                  })}`}
                >
                  Anterior
                </PageLink>
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                  Página {currentPage} de {totalPages}
                </span>
                <PageLink
                  disabled={currentPage >= totalPages}
                  href={`/expedicao/separacao?${buildQueryString({
                    ...baseQuery,
                    page: String(currentPage + 1),
                  })}`}
                >
                  Próxima
                </PageLink>
              </div>
            </div>

            {paginatedOrders.map((order) => (
              <article key={order.id} className="glass-card rounded-2xl p-5 transition-all hover:border-primary-500/30 group">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide border ${
                          order.status === "NOVO"
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                            : order.status === "EM_SEPARACAO"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {order.statusLabel}
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        {order.depositante}
                      </span>
                      {order.shortageUnits > 0 ? (
                        <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                          Pendentes: {order.shortageUnits} un
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {order.externalNumber}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
                      {order.customer} <span className="text-slate-300 dark:text-zinc-600 px-1">•</span> {order.destination}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">Código int: {order.code}</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">{order.totalItems} item(ns)</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">{order.totalUnits} unidade(s)</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">{order.routeStopCount} parada(s)</span>
                      <span className="bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 px-2 py-1 rounded-md">{order.completionPercent}% concluído</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">Operador: {order.assignedOperatorName ?? "Não atribuído"}</span>
                    </div>
                  </div>

                  <Link
                    href={`/expedicao/separacao/${order.id}`}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-500 px-6 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition-all hover:bg-primary-600 hover:-translate-y-0.5 whitespace-nowrap"
                  >
                    Iniciar Separação
                  </Link>
                </div>
              </article>
            ))}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 p-10 text-center text-sm font-medium text-slate-500 dark:text-zinc-400 shadow-sm backdrop-blur-sm">
            Nenhum pedido disponível para separação com os filtros atuais.
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
  colorClass,
  borderClass,
}: {
  icon: typeof PackageCheck;
  label: string;
  value: string;
  colorClass: string;
  borderClass: string;
}) {
  return (
    <div className={`glass-card rounded-2xl p-5 transition-all ${borderClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePerPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return [10, 20, 50].includes(parsed) ? parsed : 10;
}

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 dark:border-zinc-700 px-3 text-sm font-medium text-slate-400 dark:text-zinc-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-xl border border-slate-300 dark:border-zinc-700 px-3 text-sm font-medium text-slate-700 dark:text-zinc-300 transition hover:bg-white dark:hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}
