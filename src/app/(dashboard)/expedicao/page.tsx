import Link from "next/link";
import {
  Eye,
  ListChecks,
  Pencil,
  Plus,
  ScanBarcode,
  Filter,
  Loader,
  Clock,
  ClipboardList,
  Boxes,
  FileText
} from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants, isAdminUser } from "@/lib/permissions";
import {
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
    page?: string;
    perPage?: string;
  }>;
};


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
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);
  const supabase = await createSupabaseServerClient();
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;

  const [{ data: depositantes }, shippingOverviewOrders, shippingOrders] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    listShippingOrdersFromDb({
      depositanteId: effectiveDepositanteFilter || undefined,
    }),
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
  ]);
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const [shippingStats, shippingQueues] = await Promise.all([
    listShippingStatsFromDb(user, shippingOverviewOrders),
    listShippingQueuesFromDb(shippingOverviewOrders),
  ]);
  const shippingFlow = listShippingFlowSteps();
  const totalOrders = shippingOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedOrders = shippingOrders.slice(startIndex, startIndex + perPage);
  const visibleStart = totalOrders ? startIndex + 1 : 0;
  const visibleEnd = Math.min(startIndex + perPage, totalOrders);
  const baseQuery = {
    status: statusFilter,
    depositante: effectiveDepositanteFilter,
    dataInicial: dateFrom,
    dataFinal: dateTo,
    transportadora: carrierFilter,
    cliente: customerFilter,
    pedido: orderSearchFilter,
    marketplace: marketplaceFilter,
    perPage: String(perPage),
  };

  return (
    <div className="space-y-8 relative opacity-95">
      
      {/* Header with Title and Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            Expedição (Outbound)
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Gestão de separação (picking), conferência de saída e carregamento.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Link
            href="/expedicao/separacao"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
          >
            <ListChecks className="w-4 h-4" />
            Tela Separação
          </Link>
          <Link
            href="/expedicao/conferencia"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
          >
            <ScanBarcode className="w-4 h-4" />
            Conferir Volume
          </Link>
          <Link
            href="/expedicao/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-infinya-gradient text-white text-sm font-medium shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido
          </Link>
        </div>
      </div>

      {/* KPIs Principais */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1 */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-primary-500/40 dark:border-primary-500/30 border-l-4 border-l-primary-500 hover:border-primary-500 hover:shadow-lg hover:shadow-primary-500/20 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{shippingStats[0].label}</p>
            <span className="p-2 bg-primary-500/10 text-primary-500 rounded-lg">
              <ClipboardList className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">{shippingStats[0].value}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">{shippingStats[0].help}</p>
        </div>

        {/* KPI 2 */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-amber-500/40 dark:border-amber-500/30 border-l-4 border-l-amber-500 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/20 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{shippingStats[1].label}</p>
            <span className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">{shippingStats[1].value}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-amber-500">
            {shippingStats[1].help}
          </p>
        </div>

        {/* KPI 3 */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-purple-500/40 dark:border-purple-500/30 border-l-4 border-l-purple-500 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{shippingStats[2].label}</p>
            <span className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">{shippingStats[2].value}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-purple-500">
            <Loader className="w-3 h-3 animate-spin mr-1" /> {shippingStats[2].help}
          </p>
        </div>

        {/* KPI 4 */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-rose-500/40 dark:border-rose-500/30 border-l-4 border-l-rose-500 hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/20 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{shippingStats[3].label}</p>
            <span className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">{shippingStats[3].value}</h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-rose-500">{shippingStats[3].help}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <Link
          href="#painel-pedidos"
          className="group rounded-3xl border border-primary-500/30 bg-white/80 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary-500 hover:shadow-xl hover:shadow-primary-500/10 dark:bg-zinc-900/70 dark:border-primary-500/20 dark:hover:border-primary-400"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600 dark:text-primary-300">
                Painel
              </p>
              <h2 className="mt-3 text-2xl font-bold text-slate-950 transition-colors group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-300">
                Pedidos
              </h2>
              <p className="mt-3 max-w-sm text-sm text-slate-600 dark:text-zinc-300">
                Ir direto para a listagem completa de pedidos, filtros operacionais e acompanhamento da fila.
              </p>
            </div>
            <span className="rounded-2xl bg-primary-500/10 p-3 text-primary-600 dark:text-primary-300">
              <ClipboardList className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-6 inline-flex items-center rounded-xl bg-primary-500/10 px-4 py-2 text-sm font-semibold text-primary-700 dark:text-primary-300">
            Ver Pedidos
          </div>
        </Link>

        <Link
          href="/expedicao/separacao"
          className="group rounded-3xl border border-cyan-400/30 bg-white/80 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-500/10 dark:bg-zinc-900/70 dark:border-cyan-500/20 dark:hover:border-cyan-400"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">
                Operação
              </p>
              <h2 className="mt-3 text-2xl font-bold text-slate-950 transition-colors group-hover:text-cyan-700 dark:text-white dark:group-hover:text-cyan-300">
                Separação
              </h2>
              <p className="mt-3 max-w-sm text-sm text-slate-600 dark:text-zinc-300">
                Abrir a fila de picking, distribuir os pedidos e iniciar a leitura operacional do armazém.
              </p>
            </div>
            <span className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-600 dark:text-cyan-300">
              <ListChecks className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-6 inline-flex items-center rounded-xl bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
            Entrar em Separação
          </div>
        </Link>

        <Link
          href="/expedicao/conferencia"
          className="group rounded-3xl border border-violet-400/30 bg-white/80 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-violet-400 hover:shadow-xl hover:shadow-violet-500/10 dark:bg-zinc-900/70 dark:border-violet-500/20 dark:hover:border-violet-400"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600 dark:text-violet-300">
                Validação
              </p>
              <h2 className="mt-3 text-2xl font-bold text-slate-950 transition-colors group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-300">
                Conferência
              </h2>
              <p className="mt-3 max-w-sm text-sm text-slate-600 dark:text-zinc-300">
                Entrar na etapa final, validar item a item e liberar somente pedidos conferidos para expedição.
              </p>
            </div>
            <span className="rounded-2xl bg-violet-500/10 p-3 text-violet-600 dark:text-violet-300">
              <ScanBarcode className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-6 inline-flex items-center rounded-xl bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
            Entrar em Conferência
          </div>
        </Link>

        <Link
          href="/expedicao/conferidos"
          className="group rounded-3xl border border-emerald-400/30 bg-white/80 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 dark:bg-zinc-900/70 dark:border-emerald-500/20 dark:hover:border-emerald-400"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
                Pós-conferência
              </p>
              <h2 className="mt-3 text-2xl font-bold text-slate-950 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                Conferidos
              </h2>
              <p className="mt-3 max-w-sm text-sm text-slate-600 dark:text-zinc-300">
                Acompanhar pedidos já conferidos, com ou sem romaneio, antes da etapa final de despacho.
              </p>
            </div>
            <span className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-300">
              <FileText className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-6 inline-flex items-center rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Ver Conferidos
          </div>
        </Link>
      </section>

      {/* Abas e Filtros */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex overflow-x-auto no-scrollbar gap-2">
          <Link href="/expedicao" className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg ${!statusFilter ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
            Todos Pedidos
          </Link>
          <Link href="/expedicao?status=NOVO" className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg ${statusFilter === 'NOVO' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
            Separação (Picking)
          </Link>
          <Link href="/expedicao?status=EM_CONFERENCIA" className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg ${statusFilter === 'EM_CONFERENCIA' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
            Conferência
          </Link>
          <Link href="/expedicao?status=PRONTO_ROMANEIO" className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg ${statusFilter === 'PRONTO_ROMANEIO' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
            Embarque / Doca
          </Link>
          <Link href="/expedicao/conferidos" className="px-4 py-2 font-medium text-sm whitespace-nowrap rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">
            Conferidos
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
            type="text"
            name="pedido"
            defaultValue={orderSearchFilter}
            placeholder="Nº Pedido"
            className="w-24 sm:w-32 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          <input
            type="text"
            name="cliente"
            defaultValue={customerFilter}
            placeholder="Cliente"
            className="w-32 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500/50 hidden sm:block"
          />
          <button type="submit" className="p-2 bg-slate-900 dark:bg-zinc-800 text-white border border-slate-900 dark:border-zinc-700 rounded-lg hover:bg-slate-800 transition flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </button>
          {(statusFilter || depositanteFilter || dateFrom || dateTo || carrierFilter || customerFilter || orderSearchFilter || marketplaceFilter) && (
            <Link href="/expedicao" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 underline underline-offset-2">
              Limpar
            </Link>
          )}
        </form>
      </div>

      {/* Main Table section */}
      <section
        id="painel-pedidos"
        className="rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden hover:border-primary-500/30 transition-all"
      >
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pedidos e Rotas</h3>
            <p className="mt-1 text-xs text-slate-500">
              Exibindo {visibleStart}-{visibleEnd} de {totalOrders} pedido(s)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <form className="flex items-center gap-2">
              <input type="hidden" name="status" value={statusFilter} />
              <input type="hidden" name="depositante" value={effectiveDepositanteFilter} />
              <input type="hidden" name="dataInicial" value={dateFrom} />
              <input type="hidden" name="dataFinal" value={dateTo} />
              <input type="hidden" name="transportadora" value={carrierFilter} />
              <input type="hidden" name="cliente" value={customerFilter} />
              <input type="hidden" name="pedido" value={orderSearchFilter} />
              <input type="hidden" name="marketplace" value={marketplaceFilter} />
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
                <th className="px-6 py-4 font-medium">Pedido / Rota</th>
                <th className="px-6 py-4 font-medium">Depositante</th>
                <th className="px-6 py-4 font-medium">Cliente Final</th>
                <th className="px-6 py-4 font-medium">Volumes (Prev.)</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/50 text-slate-700 dark:text-zinc-300">
              {paginatedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition group">
                  <td className="px-6 py-4">
                    <Link href={`/expedicao/${order.id}`} className="font-bold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                      {order.displayNumber}
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5">Marketplace: {order.marketplace || '-'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Código técnico: {order.code || '-'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Criado em: {order.createdAt}</div>
                    <div className="mt-1">
                      <span className={buildAgeBadgeClass(order.ageTone)}>{order.ageLabel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{order.depositante}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{order.customer}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{order.destination}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{order.units} volumes</div>
                    <div className="text-xs text-slate-500 mt-0.5">{order.itemCount} Itens</div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={order.status}
                      releasedWithoutRomaneio={order.releasedWithoutRomaneio}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/expedicao/${order.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 transition hover:bg-slate-50 dark:hover:bg-zinc-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Link>
                      {isAdminUser(user) ? (
                        <Link
                          href={`/expedicao/${order.id}/editar`}
                          className="inline-flex items-center gap-2 rounded-lg border border-primary-500 bg-primary-500 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-primary-500/20 transition hover:bg-primary-600 hover:-translate-y-0.5"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </Link>
                      ) : null}
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
                href={`/expedicao?${buildQueryString({
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
                href={`/expedicao?${buildQueryString({
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

      {/* Grid Secundário: Filas Operacionais e Fluxo */}
      <section className="grid gap-6 xl:grid-cols-2">
        
        {/* Filas Operacionais */}
        <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 p-6 hover:border-amber-500/30 transition-all">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-500" /> Filas Operacionais
          </h2>
          <div className="mt-4 space-y-3">
            {shippingQueues.map((queue) => (
              <div key={queue.status} className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 hover:border-slate-300 dark:hover:border-zinc-700 transition">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{queue.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{queue.help}</p>
                  </div>
                  <span className="rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {queue.orders} pedidos
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fluxo Obrigatório */}
        <div className="rounded-2xl bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 p-6 hover:border-primary-500/30 transition-all">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary-500" /> Fluxo Obrigatório
          </h2>
          <div className="mt-4 space-y-3">
            {shippingFlow.map((step, index) => (
              <div key={step} className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 px-4 py-3 text-sm text-slate-700 dark:text-zinc-300 border border-slate-100 dark:border-zinc-800 flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500/20 text-primary-600 dark:text-primary-400 text-xs font-bold">{index + 1}</span>
                {step}
              </div>
            ))}
          </div>
        </div>

      </section>

    </div>
  );
}

function buildAgeBadgeClass(tone: "fresh" | "warning" | "critical") {
  if (tone === "critical") {
    return "inline-flex rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400";
  }

  if (tone === "warning") {
    return "inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400";
  }

  return "inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400";
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

function StatusBadge({
  status,
  releasedWithoutRomaneio = false,
}: {
  status: string;
  releasedWithoutRomaneio?: boolean;
}) {
  if (status === "NOVO") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">Aguardando Separação</span>;
  }
  if (status === "EM_SEPARACAO" || status === "SEPARADO") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">{status === "SEPARADO" ? "Aguardando conferência" : "Separando"}</span>;
  }
  if (status === "EM_CONFERENCIA" || status === "CONFERIDO") {
    return <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${releasedWithoutRomaneio ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"}`}>{status === "CONFERIDO" ? (releasedWithoutRomaneio ? "Finalizado sem romaneio" : "Conferido") : "Em Conferência"}</span>;
  }
  if (status === "PRONTO_ROMANEIO") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Pronto p/ Romaneio</span>;
  }
  if (status === "EXPEDIDO") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Expedido</span>;
  }
  if (status === "CANCELADO") {
    return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">Cancelado</span>;
  }
  return <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
}
