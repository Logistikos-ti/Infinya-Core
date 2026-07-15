import Link from "next/link";
import { ArrowLeft, PackageCheck, ScanSearch, TriangleAlert, UserRound } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { listPickingOperatorsFromDb } from "@/lib/shipping-picking";
import { listShippingConferenceOrdersFromDb } from "@/lib/shipping-conference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type ShippingConferencePageProps = {
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
  { value: "SEPARADO", label: "Aguardando conferência" },
  { value: "EM_CONFERENCIA", label: "Em conferência" },
] as const;

export default async function ShippingConferencePage({ searchParams }: ShippingConferencePageProps) {
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
    listShippingConferenceOrdersFromDb(user, {
      status: statusFilter || undefined,
      depositanteId: depositanteFilter || undefined,
      operatorId: operatorFilter || undefined,
    }),
    listPickingOperatorsFromDb(user, depositanteFilter || undefined),
  ]);

  const pendingOrders = orders.filter((order) => order.status === "SEPARADO").length;
  const runningOrders = orders.filter((order) => order.status === "EM_CONFERENCIA").length;
  const pendingUnits = orders.reduce((sum, order) => sum + order.pendingUnits, 0);
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
    <div className="space-y-6">
      <Link
        href="/expedicao"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition-all hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para expedição
      </Link>

      <ModulePageHeader
        title="Fila de Conferência (Checking)"
        description="Validação item a item contra o pedido separado, com leitura de código de barras e conclusão operacional antes do despacho."
        badge="Em Foco"
      />

      {feedback ? (
        <div
          className={`rounded-3xl border px-5 py-4 text-sm font-bold shadow-sm ${
            feedback === "concluido"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {feedback === "concluido"
            ? "Conferência concluída e pedido movido para o próximo passo."
            : feedback === "incompleto"
              ? "Ainda existem itens pendentes. O pedido voltou para a fila para nova conferência."
              : feedback === "inatividade"
                ? "Pedido devolvido para a fila por inatividade do operador."
                : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={PackageCheck} label="Pedidos na fila" value={String(totalOrders)} />
        <StatTile icon={ScanSearch} label="Aguardando conferência" value={String(pendingOrders)} />
        <StatTile icon={UserRound} label="Em conferência" value={String(runningOrders)} />
        <StatTile icon={TriangleAlert} label="Unidades pendentes" value={String(pendingUnits)} alert={pendingUnits > 0} />
      </section>

      <section className="glass-card rounded-3xl border border-slate-200/60 p-6 shadow-sm dark:border-zinc-800/60">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Filtro operacional</h2>
          <p className="text-sm font-medium text-slate-600 dark:text-zinc-400 mt-1">
            Use operador, depositante e status para montar a fila de conferência do turno.
          </p>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Status</span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "todos"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Operador</span>
            <select
              name="operador"
              defaultValue={operatorFilter}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
            >
              <option value="">Todos</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
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

          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Página</span>
            <select
              name="perPage"
              defaultValue={String(perPage)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
            >
              <option value="10">10 / página</option>
              <option value="20">20 / página</option>
              <option value="50">50 / página</option>
            </select>
          </label>

          <div className="flex items-end gap-3">
            <Button type="submit" className="h-12 flex-1 rounded-xl bg-slate-900 font-bold text-white shadow-md transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
              Aplicar Filtros
            </Button>
            <Link
              href="/expedicao/conferencia"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-5">
        {paginatedOrders.length ? (
          <>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white/50 px-5 py-4 text-sm font-medium text-slate-600 backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-400 md:flex-row md:items-center md:justify-between">
              <span>
                Exibindo <strong className="text-slate-900 dark:text-white">{visibleStart}-{visibleEnd}</strong> de <strong className="text-slate-900 dark:text-white">{totalOrders}</strong> pedido(s)
              </span>
              <div className="flex items-center gap-3">
                <PageLink
                  disabled={currentPage <= 1}
                  href={`/expedicao/conferencia?${buildQueryString({
                    ...baseQuery,
                    page: String(currentPage - 1),
                  })}`}
                >
                  Anterior
                </PageLink>
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-500">
                  Página {currentPage} de {totalPages}
                </span>
                <PageLink
                  disabled={currentPage >= totalPages}
                  href={`/expedicao/conferencia?${buildQueryString({
                    ...baseQuery,
                    page: String(currentPage + 1),
                  })}`}
                >
                  Próxima
                </PageLink>
              </div>
            </div>

            {paginatedOrders.map((order) => (
              <article key={order.id} className="glass-card rounded-3xl border border-slate-200/60 p-6 shadow-sm transition-all hover:border-primary-500/30 hover:shadow-md dark:border-zinc-800/60 group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-primary-500/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-primary-500/10 transition-colors" />
                
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between relative z-10">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border ${
                          order.status === 'SEPARADO' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 
                          'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                      }`}>
                        {order.statusLabel}
                      </span>
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                        {order.depositante}
                      </span>
                      <span className={buildAgeBadgeClass(order.ageTone)}>{order.ageLabel}</span>
                      {order.pendingUnits > 0 ? (
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          Pendentes: {order.pendingUnits} un
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Pedido {order.displayNumber}</h2>
                    <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
                      {order.customer} <span className="px-1 text-slate-300 dark:text-zinc-600">•</span> {order.destination}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">Plataforma {order.externalNumber}</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">Código técnico {order.code}</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">Criado em {order.createdAt}</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">{order.totalItems} itens / {order.totalUnits} un</span>
                      <span className="bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 px-2 py-1.5 rounded-lg">{order.completionPercent}% conferido</span>
                      <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">Op: {order.assignedOperatorName ?? "Não atribuído"}</span>
                    </div>
                  </div>

                  <Link
                    href={`/expedicao/conferencia/${order.id}`}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-primary-500 px-6 text-sm font-bold text-white shadow-md shadow-primary-500/20 transition-all hover:bg-primary-600"
                  >
                    Iniciar Conferência
                  </Link>
                </div>
              </article>
            ))}
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 p-12 text-center text-sm font-medium text-slate-500 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
            <ScanSearch className="h-10 w-10 mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
            Nenhum pedido disponível para conferência com os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}

function buildAgeBadgeClass(tone: "fresh" | "warning" | "critical") {
  if (tone === "critical") {
    return "rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-400";
  }

  if (tone === "warning") {
    return "rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400";
  }

  return "rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400";
}

function StatTile({
  icon: Icon,
  label,
  value,
  alert
}: {
  icon: typeof PackageCheck;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`glass-card rounded-3xl border p-6 shadow-sm transition-all ${alert ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-200/60 dark:border-zinc-800/60 hover:border-primary-500/30'}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`rounded-2xl p-4 ${alert ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-primary-500/10 text-primary-600 dark:text-primary-400'}`}>
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
      <span className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-400 dark:border-zinc-800 dark:text-zinc-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-primary-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-primary-400"
    >
      {children}
    </Link>
  );
}
