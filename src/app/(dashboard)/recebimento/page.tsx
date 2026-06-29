import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  Plus,
  Truck,
  ClipboardCheck,
  CheckCircle2,
  ScanLine,
  Filter,
  Loader,
  Eye
} from "lucide-react";
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
    page?: string;
    perPage?: string;
  }>;
};


export default async function RecebimentoPage({ searchParams }: RecebimentoPageProps) {
  const user = await requireModuleAccess("recebimento");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);
  const supabase = await createSupabaseServerClient();
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;

  const [{ data: depositantes }, receivingOverviewOrders, receivingOrders, receivingTasks, operationalIssues] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    listReceivingOrdersFromDb({
      depositanteId: effectiveDepositanteFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    listReceivingOrdersFromDb({
      status: statusFilter || undefined,
      depositanteId: effectiveDepositanteFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    listReceivingTasksFromDb(),
    listOperationalIssuesFromDb(),
  ]);
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const receivingStats = await listReceivingStatsFromDb(
    user,
    receivingOverviewOrders,
    operationalIssues,
    receivingTasks,
  );
  const totalOrders = receivingOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedOrders = receivingOrders.slice(startIndex, startIndex + perPage);
  const visibleStart = totalOrders ? startIndex + 1 : 0;
  const visibleEnd = Math.min(startIndex + perPage, totalOrders);
  const baseQuery = {
    status: statusFilter,
    depositante: effectiveDepositanteFilter,
    dataInicial: dateFrom,
    dataFinal: dateTo,
    perPage: String(perPage),
  };

  return (
    <div className="space-y-8 relative opacity-95">
      
      {/* Header with Title and Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            Recebimento (Inbound)
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Gestão de entrada de notas fiscais, conferência de doca e paletização.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
            <ScanLine className="w-4 h-4" />
            Escanear Doca
          </button>
          <Link
            href="/recebimento/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-infinya-gradient text-white text-sm font-medium shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            Nova Entrada (XML)
          </Link>
        </div>
      </div>

      {/* KPIs Principais */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1 */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-primary-500/40 dark:border-primary-500/30 border-l-4 border-l-primary-500 hover:border-primary-500 hover:shadow-lg hover:shadow-primary-500/20 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{receivingStats[0].label}</p>
            <span className="p-2 bg-primary-500/10 text-primary-500 rounded-lg">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">{receivingStats[0].value}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">{receivingStats[0].help}</p>
        </div>

        {/* KPI 2 */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-amber-500/40 dark:border-amber-500/30 border-l-4 border-l-amber-500 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/20 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{receivingStats[1].label}</p>
            <span className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <ClipboardCheck className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">{receivingStats[1].value}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-amber-500">
            <Loader className="w-3 h-3 animate-spin mr-1" /> {receivingStats[1].help}
          </p>
        </div>

        {/* KPI 3 */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-emerald-500/40 dark:border-emerald-500/30 border-l-4 border-l-emerald-500 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{receivingStats[3].label}</p>
            <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">{receivingStats[3].value}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">{receivingStats[3].help}</p>
        </div>

        {/* KPI 4 */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-rose-500/40 dark:border-rose-500/30 border-l-4 border-l-rose-500 hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/20 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{receivingStats[2].label}</p>
            <span className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">{receivingStats[2].value}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-rose-500">{receivingStats[2].help}</p>
        </div>
      </section>

      {/* Abas e Filtros */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex overflow-x-auto no-scrollbar gap-2">
          <Link href="/recebimento" className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg ${!statusFilter ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
            Todas Entradas
          </Link>
          <Link href="/recebimento?status=AGUARDANDO" className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg ${statusFilter === 'AGUARDANDO' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
            Aguardando Doca
          </Link>
          <Link href="/recebimento?status=EM_RECEBIMENTO" className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg ${statusFilter === 'EM_RECEBIMENTO' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
            Em Conferência
          </Link>
          <Link href="/recebimento?status=DIVERGENCIA" className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg ${statusFilter === 'DIVERGENCIA' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
            Com Divergência
          </Link>
        </div>

        <form className="flex items-center gap-2 flex-wrap">
          {canManageMultipleTenants(user) && (
            <select
              name="depositante"
              defaultValue={effectiveDepositanteFilter}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="">Todos Depositantes</option>
              {depositanteOptions.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.nome}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            name="dataInicial"
            defaultValue={dateFrom}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          <button type="submit" className="p-2 bg-slate-900 dark:bg-zinc-800 text-white border border-slate-900 dark:border-zinc-700 rounded-lg hover:bg-slate-800 transition flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </button>
          {(statusFilter || depositanteFilter || dateFrom || dateTo) && (
            <Link href="/recebimento" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 underline underline-offset-2">
              Limpar
            </Link>
          )}
        </form>
      </div>

      {/* Main Table section */}
      <section className="rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden hover:border-primary-500/30 transition-all">
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Lista de Recebimentos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Exibindo {visibleStart}-{visibleEnd} de {totalOrders} recebimento(s)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <form className="flex items-center gap-2">
              <input type="hidden" name="status" value={statusFilter} />
              <input type="hidden" name="depositante" value={effectiveDepositanteFilter} />
              <input type="hidden" name="dataInicial" value={dateFrom} />
              <input type="hidden" name="dataFinal" value={dateTo} />
              <input type="hidden" name="page" value="1" />
              <label className="text-xs font-medium text-slate-500">Por página</label>
              <select
                name="perPage"
                defaultValue={String(perPage)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Aplicar
              </button>
            </form>
            <span className="rounded-full bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-600 dark:text-primary-400">
              {totalOrders} registros
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/50 dark:bg-zinc-900/50 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800/50">
              <tr>
                <th className="px-6 py-4 font-medium">NF-e / Carga</th>
                <th className="px-6 py-4 font-medium">Depositante / Fornecedor</th>
                <th className="px-6 py-4 font-medium">SKUs / Volumes</th>
                <th className="px-6 py-4 font-medium">Previsão Doca</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/50 text-slate-700 dark:text-zinc-300">
              {paginatedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition group">
                  <td className="px-6 py-4">
                    <Link href={`/recebimento/${order.id}`} className="font-bold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                      {order.code}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{order.depositante}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{order.supplier}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{order.volumeCount} volumes</div>
                    <div className="text-xs text-slate-500 mt-0.5">{order.skuCount} SKUs</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-zinc-400">
                    {order.eta}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/recebimento/${order.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 transition hover:bg-slate-50 dark:hover:bg-zinc-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!paginatedOrders.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhum pedido encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalOrders > perPage ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-zinc-800/50 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/recebimento?${buildQueryString({
                  ...baseQuery,
                  page: String(Math.max(1, currentPage - 1)),
                })}`}
                aria-disabled={currentPage <= 1}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  currentPage <= 1
                    ? "pointer-events-none border-slate-200 text-slate-300 dark:border-zinc-800 dark:text-zinc-600"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                Anterior
              </Link>
              <Link
                href={`/recebimento?${buildQueryString({
                  ...baseQuery,
                  page: String(Math.min(totalPages, currentPage + 1)),
                })}`}
                aria-disabled={currentPage >= totalPages}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  currentPage >= totalPages
                    ? "pointer-events-none border-slate-200 text-slate-300 dark:border-zinc-800 dark:text-zinc-600"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                Próxima
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {/* Grid Secundário: Ocorrências e Tarefas */}
      <section className="grid gap-6 xl:grid-cols-2">
        
        {/* Ocorrências */}
        <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 p-6 hover:border-rose-500/30 transition-all">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" /> Ocorrências abertas
          </h2>
          <div className="mt-4 space-y-3">
            {operationalIssues.length ? (
              operationalIssues.map((issue) => (
                <div key={issue.id} className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">{issue.title}</p>
                    <span className="rounded-md bg-white/50 dark:bg-zinc-950/50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                      {issue.type}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-rose-600/80 dark:text-rose-400/80">{issue.depositante}</p>
                  <p className="mt-1 text-sm font-medium text-rose-800 dark:text-rose-300">{issue.action}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma ocorrência aberta no momento.
              </div>
            )}
          </div>
        </div>

        {/* Tarefas Operacionais */}
        <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 p-6 hover:border-accent-500/30 transition-all">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-accent-500" /> Tarefas de doca
          </h2>
          <div className="mt-4 space-y-3">
            {receivingTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 hover:border-slate-300 dark:hover:border-zinc-700 transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.type}</p>
                  </div>
                  <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {task.priority}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                  <span>Responsável: {task.assignee}</span>
                  <span>Prazo: {task.due}</span>
                </div>
              </div>
            ))}
            {!receivingTasks.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma tarefa pendente para a equipe.
              </div>
            ) : null}
          </div>
        </div>

      </section>

    </div>
  );
}

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizePerPage(value: string | undefined) {
  const parsed = normalizePositiveNumber(value, 10);
  if ([10, 20, 50].includes(parsed)) {
    return parsed;
  }

  return 10;
}

function buildQueryString(query: Record<string, string>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }

  return params.toString();
}

function StatusBadge({ status }: { status: string }) {
  if (status === "AGUARDANDO") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">Aguardando Doca</span>;
  }
  if (status === "EM_RECEBIMENTO") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Em Conferência</span>;
  }
  if (status === "DIVERGENCIA") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Com Divergência</span>;
  }
  if (status === "RECEBIDO" || status === "RECEBIDO_PARCIAL") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{status === "RECEBIDO" ? "Finalizado" : "Rec. Parcial"}</span>;
  }
  if (status === "CANCELADO") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">Cancelado</span>;
  }
  return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
}

