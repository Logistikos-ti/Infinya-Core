import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Construction,
  FileDown,
  FileText,
  Package,
  PackageCheck,
  Plus,
  Search,
  Settings2,
  Truck,
} from "lucide-react";
import { requireRoleAccess } from "@/lib/auth";
import { listReceivingOrdersFromDb } from "@/lib/receiving";
import { listShippingOrdersFromDb } from "@/lib/shipping";
import { listStockBalancesFromDb } from "@/lib/stock";
import { SupportClient } from "@/components/portal/support-client";
import { listSupportTicketsFromDb } from "@/lib/support";

type PortalPageProps = {
  searchParams?: Promise<{ view?: string; page?: string }>;
};

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const user = await requireRoleAccess(["DEPOSITANTE"]);
  const params = await searchParams;
  const requestedView = params?.view ?? "inicio";
  const view = normalizeView(requestedView);
  const productsPage = parsePositivePage(params?.page);
  const depositanteId = user.depositanteId ?? "";
  const [orders, receiving, stock] = await Promise.all([
    view === "inicio" || view === "pedidos"
      ? listShippingOrdersFromDb({ depositanteId })
      : Promise.resolve([]),
    view === "inicio" || view === "recebimento"
      ? listReceivingOrdersFromDb({ depositanteId })
      : Promise.resolve([]),
    view === "inicio" || view === "produtos"
      ? listStockBalancesFromDb({ depositanteId })
      : Promise.resolve([]),
  ]);
  const supportTickets =
    view === "suporte" ? await listSupportTicketsFromDb(depositanteId) : [];
  const depositanteName = user.depositanteNome || user.nome;
  const totalUnits = stock.reduce(
    (sum, item) => sum + Number(item.rawQuantidade ?? 0),
    0,
  );
  const lowStock = stock
    .filter((item) => Number(item.rawQuantidade ?? 0) <= 5)
    .slice(0, 5);

  return (
    <div className="w-full space-y-6">
      {view === "inicio" ? (
        <DashboardView
          depositanteName={depositanteName}
          orders={orders}
          receiving={receiving}
          stock={stock}
          totalUnits={totalUnits}
          lowStock={lowStock}
        />
      ) : null}
      {view === "pedidos" ? <OrdersView orders={orders} /> : null}
      {view === "produtos" ? (
        <ProductsView stock={stock} page={productsPage} />
      ) : null}
      {view === "recebimento" ? <ReceivingView receiving={receiving} /> : null}
      {view === "faturas" ? <InvoicesView /> : null}
      {view === "suporte" ? (
        <SupportView initialTickets={supportTickets} />
      ) : null}
    </div>
  );
}

function normalizeView(value: string) {
  if (value === "orders") return "pedidos";
  if (value === "receiving") return "recebimento";
  if (value === "products") return "produtos";
  if (value === "invoices") return "faturas";
  if (value === "support") return "suporte";
  return ["pedidos", "recebimento", "produtos", "faturas", "suporte"].includes(
    value,
  )
    ? value
    : "inicio";
}

function DashboardView({
  depositanteName,
  orders,
  receiving,
  stock,
  totalUnits,
  lowStock,
}: {
  depositanteName: string;
  orders: Awaited<ReturnType<typeof listShippingOrdersFromDb>>;
  receiving: Awaited<ReturnType<typeof listReceivingOrdersFromDb>>;
  stock: Awaited<ReturnType<typeof listStockBalancesFromDb>>;
  totalUnits: number;
  lowStock: Awaited<ReturnType<typeof listStockBalancesFromDb>>;
}) {
  return (
    <>
      <PageIntro
        title={`Olá, ${depositanteName} 👋`}
        description="Acompanhe seu estoque no CD Infinoos e envie novos pedidos para expedição."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={PackageCheck}
          label="Pedidos em operação"
          value={orders.length}
          delta="Atualizado agora"
        />
        <StatCard
          icon={Boxes}
          label="Produtos no CD"
          value={stock.length}
          delta="Itens cadastrados"
        />
        <StatCard
          icon={Truck}
          label="Recebimentos"
          value={receiving.length}
          delta="Solicitações"
        />
        <StatCard
          icon={ClipboardList}
          label="Unidades em estoque"
          value={totalUnits}
          delta="Saldo monitorado"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Pedidos recentes"
          actionHref="/portal?view=pedidos"
          actionLabel="Ver todos"
        >
          {orders.length ? (
            orders
              .slice(0, 6)
              .map((order) => <OrderRow key={order.id} order={order} />)
          ) : (
            <EmptyState text="Nenhum pedido encontrado." />
          )}
        </Panel>
        <Panel
          title="Níveis de estoque"
          icon={<AlertTriangle className="h-4 w-4" />}
        >
          <div className="mb-2 px-5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-rose-500">
              {lowStock.length}
            </span>{" "}
            itens em atenção
          </div>
          {lowStock.length ? (
            lowStock.map((item) => <StockRow key={item.id} item={item} />)
          ) : (
            <EmptyState text="Nenhum item próximo do limite." />
          )}
        </Panel>
      </div>
    </>
  );
}

function OrdersView({
  orders,
}: {
  orders: Awaited<ReturnType<typeof listShippingOrdersFromDb>>;
}) {
  return (
    <>
      <ViewHeader
        title="Meus pedidos"
        description="Pedidos enviados ao CD para separação e expedição."
        action="+ Novo pedido"
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[
          "Todos",
          "Recebido",
          "Em separação",
          "Em conferência",
          "Expedido",
        ].map((filter, index) => (
          <span
            key={filter}
            className={`rounded-lg border px-3.5 py-2 text-xs font-bold ${index === 0 ? "border-transparent bg-gradient-to-r from-blue-500 to-violet-500 text-white" : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
          >
            {filter}
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {orders.length} pedidos
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <tr>
                {[
                  "Pedido",
                  "Cliente",
                  "Origem",
                  "Itens",
                  "Criação",
                  "Status",
                  "",
                ].map((item) => (
                  <th key={item} className="px-5 py-3 font-bold">
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderTableRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
        {!orders.length ? (
          <EmptyState text="Nenhum pedido encontrado." />
        ) : null}
      </div>
    </>
  );
}

function ProductsView({
  stock,
  page,
}: {
  stock: Awaited<ReturnType<typeof listStockBalancesFromDb>>;
  page: number;
}) {
  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(stock.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = stock.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  return (
    <>
      <ViewHeader
        title="Meus produtos no CD"
        description="Saldo em estoque armazenado no CD Infinoos."
      />
      <div className="mb-5 flex max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-white/10 dark:bg-[#101b30]">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          aria-label="Filtrar produtos"
          placeholder="Filtrar produtos..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleProducts.map((item) => {
          const quantity = Number(item.rawQuantidade ?? 0);
          const minimum = Number(item.minQuantity ?? 0);
          const maximum = Math.max(minimum * 2, quantity, 1);
          const fillPercentage = `${Math.min(100, Math.round((quantity / maximum) * 100))}%`;
          const stockStatus =
            quantity === 0
              ? { label: "Sem estoque", tone: "rose" }
              : quantity <= minimum
                ? { label: "Atenção", tone: "amber" }
                : { label: "Monitorado", tone: "emerald" };
          const statusClasses = {
            rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
            amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
            emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
          }[stockStatus.tone];
          return (
            <div
              key={item.id}
              className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-[18px] shadow-sm dark:border-white/10 dark:bg-[#101b30]"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white ${item.imageUrl ? "bg-white ring-1 ring-slate-200 dark:bg-white dark:ring-slate-200" : "bg-gradient-to-br from-blue-500 to-violet-500"}`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={`Foto de ${item.productName ?? "produto"}`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {item.productName ?? "Produto"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {item.sku || "Sem código"}
                  </p>
                </div>
              </div>
              <div className="flex items-end justify-between border-t border-slate-100 pt-3 dark:border-white/10">
                <div>
                  <p
                    className={`font-display text-[22px] font-bold ${quantity <= minimum ? "text-amber-500" : ""}`}
                  >
                    {quantity}
                  </p>
                  <p className="text-[11px] text-slate-500">disponível</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClasses}`}
                >
                  {stockStatus.label}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Min {minimum}</span>
                    <span>Máx {maximum}</span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                      style={{ width: fillPercentage }}
                    />
                  </div>
                </div>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                  title="Configuração de estoque"
                >
                  <Settings2 className="h-4 w-4" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {!stock.length ? (
        <EmptyState text="Nenhum produto disponível no estoque." />
      ) : null}
      {stock.length > pageSize ? (
        <ProductPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={stock.length}
        />
      ) : null}
    </>
  );
}

function ProductPagination({
  currentPage,
  totalPages,
  totalItems,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}) {
  const pageSize = 9;
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);
  const pages: Array<number | "ellipsis"> =
    totalPages <= 5
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : currentPage <= 2
        ? [1, 2, 3, "ellipsis", totalPages]
        : currentPage >= totalPages - 1
          ? [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages]
          : [1, "ellipsis", currentPage, "ellipsis", totalPages];

  return (
    <div className="flex min-h-20 flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-4 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        Mostrando {firstItem}–{lastItem} de {totalItems} produtos
      </span>
      <div className="flex items-center gap-2">
        <PaginationLink
          page={currentPage - 1}
          disabled={currentPage === 1}
          ariaLabel="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </PaginationLink>
        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-1 text-sm text-slate-400"
            >
              ...
            </span>
          ) : (
            <PaginationLink
              key={page}
              page={page}
              active={page === currentPage}
              ariaLabel={`Página ${page}`}
            >
              {page}
            </PaginationLink>
          ),
        )}
        <PaginationLink
          page={currentPage + 1}
          disabled={currentPage === totalPages}
          ariaLabel="Próxima página"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </PaginationLink>
      </div>
    </div>
  );
}

function LegacyProductPagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  const pageItems = Array.from({ length: totalPages }, (_, index) => index + 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        Página {currentPage} de {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <PaginationLink page={currentPage - 1} disabled={currentPage === 1}>
          Anterior
        </PaginationLink>
        {pageItems.map((page) => (
          <PaginationLink key={page} page={page} active={page === currentPage}>
            {page}
          </PaginationLink>
        ))}
        <PaginationLink
          page={currentPage + 1}
          disabled={currentPage === totalPages}
        >
          Próxima
        </PaginationLink>
      </div>
    </div>
  );
}

function PaginationLink({
  page,
  children,
  active = false,
  disabled = false,
  ariaLabel,
}: {
  page: number;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const className = `inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-0 text-sm font-normal transition ${
    active
      ? "border-transparent bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm"
      : disabled
        ? "cursor-not-allowed border-slate-200 text-slate-300 dark:border-white/10 dark:text-slate-600"
        : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10"
  }`;
  if (disabled)
    return (
      <span className={className} aria-label={ariaLabel}>
        {children}
      </span>
    );
  return (
    <Link
      href={`/portal?view=produtos&page=${page}`}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}

function parsePositivePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function ReceivingView({
  receiving,
}: {
  receiving: Awaited<ReturnType<typeof listReceivingOrdersFromDb>>;
}) {
  return (
    <>
      <ViewHeader
        title="Recebimento"
        description="Agende entradas de mercadoria e acompanhe o recebimento no CD."
        action="+ Nova solicitação"
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniKpi
          label="Agendados"
          value={receiving.filter((item) => item.status === "Agendado").length}
          color="bg-violet-500"
        />
        <MiniKpi
          label="Em recebimento"
          value={
            receiving.filter((item) => item.status === "Em recebimento").length
          }
          color="bg-blue-500"
        />
        <MiniKpi
          label="Conferidos"
          value={receiving.filter((item) => item.status === "Conferido").length}
          color="bg-emerald-500"
        />
        <MiniKpi
          label="Divergências"
          value={
            receiving.filter((item) => item.status === "Divergência").length
          }
          color="bg-rose-500"
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/5">
              <tr>
                {[
                  "Solicitação",
                  "Fornecedor",
                  "Volumes",
                  "Previsão",
                  "Status",
                ].map((item) => (
                  <th key={item} className="px-5 py-3 font-bold">
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receiving.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-100 text-sm dark:border-white/10"
                >
                  <td className="px-5 py-4 font-bold">{item.code}</td>
                  <td className="px-5 py-4">{item.supplier ?? "A definir"}</td>
                  <td className="px-5 py-4">{item.volumeCount ?? 0}</td>
                  <td className="px-5 py-4">{item.eta ?? "A definir"}</td>
                  <td className="px-5 py-4">
                    <StatusBadge label={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!receiving.length ? (
          <EmptyState text="Nenhuma solicitação nesse filtro." />
        ) : null}
      </div>
    </>
  );
}

function InvoicesView() {
  return (
    <>
      <ViewHeader
        title="Faturas"
        description="Acompanhe suas faturas e os custos operacionais do perÃ­odo."
      />
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500 dark:bg-violet-400/10 dark:text-violet-300">
            <Construction className="h-8 w-8" />
          </div>
          <span className="mt-6 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
            Em desenvolvimento
          </span>
          <h3 className="mt-4 font-display text-xl font-bold text-slate-950 dark:text-white">
            Faturas em breve
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Estamos preparando esta Ã¡rea para apresentar suas faturas e os
            detalhes de armazenagem, manuseio e expediÃ§Ã£o com seguranÃ§a.
          </p>
        </div>
      </div>
    </>
  );
}

function LegacyInvoicesView() {
  return (
    <>
      <ViewHeader
        title="Faturas & armazenagem"
        description="Custos de armazenagem, manuseio e expedição do período."
      />
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101b30]">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-white/10">
          <FileText className="h-5 w-5 text-violet-500" />
          <div>
            <p className="text-sm font-bold">Faturas do período</p>
            <p className="text-xs text-slate-500">
              Os documentos financeiros aparecerão aqui quando liberados.
            </p>
          </div>
        </div>
        <EmptyState text="Nenhuma fatura disponível." />
      </div>
    </>
  );
}

function SupportView({
  initialTickets,
}: {
  initialTickets: Awaited<ReturnType<typeof listSupportTicketsFromDb>>;
}) {
  return (
    <>
      <ViewHeader
        title="Suporte"
        description="Abra um chamado ou acompanhe as solicitações com a equipe Infinoos."
      />
      <SupportClient initialTickets={initialTickets} />
    </>
  );
}

function PageIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7">
      <h2 className="font-display text-[27px] font-bold tracking-tight text-slate-950 dark:text-white">
        {title}
      </h2>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
function ViewHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-[27px] font-bold tracking-tight text-slate-950 dark:text-white">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      {action ? (
        <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
          <Plus className="h-4 w-4" />
          {action.replace("+ ", "")}
        </button>
      ) : null}
    </div>
  );
}
function StatCard({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  delta: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold">{value}</span>
        <span className="text-xs font-semibold text-emerald-500">{delta}</span>
      </div>
    </div>
  );
}
function MiniKpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b30]">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="font-display text-2xl font-bold">{value}</span>
      </div>
    </div>
  );
}
function Panel({
  title,
  icon,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <span className="flex-1 font-display text-[15px] font-bold">
          {icon ?? null}
          {title}
        </span>
        {actionHref ? (
          <Link href={actionHref} className="text-xs font-bold text-violet-500">
            {actionLabel} <ArrowRight className="inline h-3 w-3" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
function OrderRow({
  order,
}: {
  order: Awaited<ReturnType<typeof listShippingOrdersFromDb>>[number];
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 text-sm last:border-0 dark:border-white/10">
      <span className="w-24 shrink-0 font-display text-xs font-bold">
        {order.displayNumber ?? order.id}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {order.customer ?? "Cliente não informado"}
        </p>
        <p className="text-[11px] text-slate-500">
          {order.marketplace || order.channel || "Operação própria"} ·{" "}
          {order.itemCount ?? 0} item(ns)
        </p>
      </div>
      <StatusBadge label={order.statusLabel || order.status} />
    </div>
  );
}
function OrderTableRow({
  order,
}: {
  order: Awaited<ReturnType<typeof listShippingOrdersFromDb>>[number];
}) {
  return (
    <tr className="border-t border-slate-100 text-sm dark:border-white/10">
      <td className="px-5 py-4 font-display font-bold">
        {order.displayNumber ?? order.id}
      </td>
      <td className="px-5 py-4">
        <p className="font-semibold">
          {order.customer ?? "Cliente não informado"}
        </p>
        <p className="text-xs text-slate-500">
          {order.destination ?? "Destino não informado"}
        </p>
      </td>
      <td className="px-5 py-4">
        {order.marketplace || order.channel || "Operação própria"}
      </td>
      <td className="px-5 py-4">{order.itemCount ?? 0}</td>
      <td className="px-5 py-4 text-xs text-slate-500">
        {formatDate(order.createdAt)}
      </td>
      <td className="px-5 py-4">
        <StatusBadge label={order.statusLabel || order.status} />
      </td>
      <td className="px-5 py-4 text-right text-slate-400">
        <ArrowRight className="ml-auto h-4 w-4" />
      </td>
    </tr>
  );
}
function StockRow({
  item,
}: {
  item: Awaited<ReturnType<typeof listStockBalancesFromDb>>[number];
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0 dark:border-white/10">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-white">
        <Package className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          {item.productName ?? "Produto"}
        </p>
        <p className="text-[11px] text-slate-500">{item.sku || "Sem código"}</p>
      </div>
      <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-600">
        {item.rawQuantidade ?? 0}
      </span>
    </div>
  );
}
function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {label || "Recebido"}
    </span>
  );
}
function SupportCard({
  icon: Icon,
  title,
}: {
  icon: typeof CircleHelp;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <Icon className="h-4 w-4 text-violet-500" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <CheckCircle2 className="h-6 w-6 text-slate-300" />
      <p className="text-sm font-semibold text-slate-500">{text}</p>
    </div>
  );
}
function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}
