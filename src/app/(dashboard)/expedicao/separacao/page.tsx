import Link from "next/link";
import { ArrowLeft, PackageCheck, ScanSearch, TriangleAlert, UserRound } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ShippingPickingFiltersForm } from "@/components/shipping/shipping-picking-filters-form";
import { ShippingPickingWaveSelector } from "@/components/shipping/shipping-picking-wave-selector";
import { requireModuleAccess } from "@/lib/auth";
import {
  resetPickingOrdersForCurrentOperator,
  resetPickingOrdersToQueue,
} from "@/lib/shipping-picking-reset";
import { listPickingOperatorsFromDb, listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type ExpedicaoSeparacaoPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    operador?: string;
    feedback?: string;
    ids?: string;
    page?: string;
    perPage?: string;
  }>;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "NOVO", label: "Aguardando inicio" },
  { value: "EM_SEPARACAO", label: "Em separacao" },
  { value: "SEPARADO", label: "Aguardando conferencia" },
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
  const resetIds = (params?.ids ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";
  const feedback = params?.feedback?.trim() ?? "";

  if ((feedback === "inatividade" || feedback === "cancelado") && resetIds.length) {
    await resetPickingOrdersToQueue(user, resetIds, feedback, { revalidate: false });
  } else if (feedback === "inatividade" || feedback === "cancelado") {
    await resetPickingOrdersForCurrentOperator(user, feedback, { revalidate: false });
  }

  const supabase = createSupabaseAdminClient();
  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
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

  const statusFilterOptions = statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  const operatorFilterOptions = [
    { value: "", label: "Todos" },
    ...operators.map((operator) => ({
      value: operator.id,
      label: operator.name,
    })),
  ];
  const depositanteFilterOptions = [
    { value: "", label: "Todos" },
    ...depositanteOptions.map((depositante) => ({
      value: depositante.id,
      label: depositante.nome,
    })),
  ];

  return (
    <div className="relative space-y-6 opacity-95">
      <Link
        href="/expedicao"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para expedicao
      </Link>

      <ModulePageHeader
        title="Fila de Separacao (Picking)"
        description="Fila de pedidos por operador, com rota sugerida no armazem, leitura de codigo de barras e apontamento das quantidades separadas."
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
            ? "Separacao concluida e pedido movido para o proximo passo."
            : feedback === "incompleto"
              ? "Ainda existem itens pendentes. O pedido voltou para a fila para nova separacao."
              : feedback === "cancelado"
                ? "Separacao cancelada. Os pedidos selecionados voltaram para a fila."
              : feedback === "inatividade"
                ? "Separacao interrompida por inatividade. Os pedidos voltaram para a fila."
                : "Nao foi possivel concluir a operacao solicitada."}
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
          label="Aguardando inicio"
          value={String(pendingOrders)}
          colorClass="text-amber-600 dark:text-amber-400 bg-amber-500/10"
          borderClass="hover:border-amber-500/30 border-l-4 border-l-amber-500"
        />
        <StatTile
          icon={UserRound}
          label="Em separacao"
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

      <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm transition-all hover:border-primary-500/30 dark:border-zinc-800/80 dark:bg-zinc-900/65 dark:backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Filtro operacional</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Use operador, depositante e status para montar a fila de picking do turno.
          </p>
        </div>

        <ShippingPickingFiltersForm
          status={statusFilter}
          operador={operatorFilter}
          depositante={depositanteFilter}
          perPage={String(perPage)}
          canSelectDepositante={user.papel !== "DEPOSITANTE"}
          statusOptions={statusFilterOptions}
          operatorOptions={operatorFilterOptions}
          depositanteOptions={depositanteFilterOptions}
        />
      </section>

      <section className="space-y-4">
        {paginatedOrders.length ? (
          <>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-zinc-800/80 dark:bg-zinc-900/65 dark:text-zinc-400 md:flex-row md:items-center md:justify-between">
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
                  Pagina {currentPage} de {totalPages}
                </span>
                <PageLink
                  disabled={currentPage >= totalPages}
                  href={`/expedicao/separacao?${buildQueryString({
                    ...baseQuery,
                    page: String(currentPage + 1),
                  })}`}
                >
                  Proxima
                </PageLink>
              </div>
            </div>

            <ShippingPickingWaveSelector orders={paginatedOrders} />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-10 text-center text-sm font-medium text-slate-500 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            Nenhum pedido disponivel para separacao com os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildAgeBadgeClass(ageHours: number, minAge: number, maxAge: number) {
  const tone = ageHours > maxAge ? "critical" : ageHours > minAge ? "warning" : "fresh";

  if (tone === "critical") {
    return "rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400";
  }

  if (tone === "warning") {
    return "rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400";
  }

  return "rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400";
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
      <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-400 dark:border-zinc-700 dark:text-zinc-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}
