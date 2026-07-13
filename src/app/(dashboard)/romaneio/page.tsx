import Link from "next/link";
import type { ReactNode } from "react";
import { FileDown, Layers3, Route, Truck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { RomaneioFiltersForm } from "@/components/romaneio/romaneio-filters-form";
import { requireModuleAccess } from "@/lib/auth";
import {
  isRomaneioRecordsSchemaMissing,
  listRomaneioRecordsFromDb,
  listRomaneioSuggestionsFromDb,
} from "@/lib/romaneio-records";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { createRomaneioRecordAction } from "./actions";

type RomaneioPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    transportadora?: string;
    dataInicial?: string;
    dataFinal?: string;
    feedback?: string;
  }>;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "ABERTO", label: "Abertos" },
  { value: "LIBERADO", label: "Liberados" },
  { value: "CANCELADO", label: "Cancelados" },
] as const;

export default async function RomaneioPage({ searchParams }: RomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback?.trim() ?? "";
  const statusFilter = params?.status?.trim() ?? "";
  const carrierFilter = params?.transportadora?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  const { data: depositantes } = await supabase.from("depositantes").select("id, nome").order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const depositanteSelectOptions = [
    { value: "", label: "Todos" },
    ...depositanteOptions.map((depositante) => ({
      value: depositante.id,
      label: depositante.nome,
    })),
  ];

  let schemaMissing = false;
  let records = [] as Awaited<ReturnType<typeof listRomaneioRecordsFromDb>>;
  let suggestions = [] as Awaited<ReturnType<typeof listRomaneioSuggestionsFromDb>>;

  try {
    [records, suggestions] = await Promise.all([
      listRomaneioRecordsFromDb(user, {
        status: statusFilter || undefined,
        depositanteId: depositanteFilter || undefined,
        carrier: carrierFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
      listRomaneioSuggestionsFromDb(user, {
        depositanteId: depositanteFilter || undefined,
        carrier: carrierFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      isRomaneioRecordsSchemaMissing({ message: error.message })
    ) {
      schemaMissing = true;
    } else {
      throw error;
    }
  }

  const activeRecords = records.filter((item) => item.status === "ABERTO");
  const totalOrdersInRecords = records.reduce((sum, item) => sum + item.orderCount, 0);
  const totalOrdersInSuggestions = suggestions.reduce((sum, item) => sum + item.orderCount, 0);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Romaneio"
        description="Consolide pedidos prontos para expedição, monte a carga por transportadora e acompanhe a liberação operacional."
        badge="Expedição"
      />

      {feedback ? <FeedbackBanner feedback={feedback} /> : null}

      {schemaMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          A estrutura persistente do romaneio ainda não existe neste banco. Rode a nova migration do
          Supabase e esta tela já passa a funcionar com criação, detalhe e liberação de carga.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Romaneios abertos" value={String(activeRecords.length)} />
        <SummaryCard label="Romaneios criados" value={String(records.length)} />
        <SummaryCard label="Pedidos romaneados" value={String(totalOrdersInRecords)} />
        <SummaryCard label="Pedidos na fila sugerida" value={String(totalOrdersInSuggestions)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Filtro operacional</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Filtre tanto os romaneios já criados quanto as sugestões por depositante, transportadora e período.
          </p>
        </div>

        <RomaneioFiltersForm
          status={statusFilter}
          depositante={depositanteFilter}
          transportadora={carrierFilter}
          dataInicial={dateFrom}
          dataFinal={dateTo}
          statusOptions={statusOptions.map((option) => ({ value: option.value, label: option.label }))}
          depositanteOptions={depositanteSelectOptions}
          disableDepositante={user.papel === "DEPOSITANTE"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Romaneios criados</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Cargas persistidas no WMS, com detalhe, veículo, motorista e status operacional.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {records.length} registros
            </span>
          </div>

          {records.length ? (
            <div className="space-y-4">
              {records.map((record) => (
                <article
                  key={record.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {record.code}
                        </span>
                        <span className={getStatusBadgeClassName(record.status)}>
                          {record.statusLabel}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                          {record.carrierName}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {record.orderCount} pedido(s) • {record.totalUnits} un • {record.totalValue}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Criado em {formatDateTime(record.createdAt)}
                        </p>
                      </div>

                      <div className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                        <p>Depositantes: {record.depositantes.join(", ") || "-"}</p>
                        <p>Destinos: {record.destinations.join(", ") || "-"}</p>
                        <p>Motorista: {record.driverName || "Não informado"}</p>
                        <p>Veículo: {record.vehiclePlate || record.vehicleModel || "Não informado"}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link
                        href={`/romaneio/${record.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Abrir detalhe
                      </Link>
                      <Link
                        href={`/api/romaneio/${record.id}/pdf`}
                        target="_blank"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                      >
                        <FileDown className="h-4 w-4" />
                        PDF
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Layers3 className="h-5 w-5" />}
              title="Nenhum romaneio criado"
              description="Assim que você consolidar uma transportadora da fila sugerida, o romaneio salvo aparece aqui."
            />
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Fila sugerida</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Pedidos prontos para romaneio, agrupados automaticamente por transportadora.
              </p>
            </div>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
              {suggestions.length} grupos
            </span>
          </div>

          {suggestions.length ? (
            <div className="space-y-4">
              {suggestions.map((group) => (
                <article
                  key={group.slug}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                          {group.orderCount} pedidos
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {group.statuses.join(" • ")}
                        </span>
                      </div>
                      <h3 className="mt-3 flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                        <Truck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        {group.carrierName}
                      </h3>
                      <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                        <p>Depositantes: {group.depositantes.join(", ") || "-"}</p>
                        <p>Destinos: {group.destinations.join(", ") || "-"}</p>
                        <p>Pedido mais antigo: {group.oldestOrderDate}</p>
                        <p>Cutoff: {group.cutoff}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{group.totalValue}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{group.totalUnits} un</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    {group.orders.slice(0, 4).map((order) => (
                      <div key={order.id} className="rounded-xl bg-white px-3 py-3 text-sm dark:bg-zinc-900/70">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-950 dark:text-white">{order.externalNumber}</p>
                            <p className="truncate text-slate-600 dark:text-slate-300">{order.customer}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {order.depositante} • {order.destination}
                            </p>
                          </div>
                          <div className="shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                            <p>{order.units} un</p>
                            <p>{order.total}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {group.orders.length > 4 ? (
                      <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                        +{group.orders.length - 4} pedido(s) aguardando consolidação
                      </div>
                    ) : null}
                  </div>

                  <form action={createRomaneioRecordAction} className="mt-4">
                    {group.orders.map((order) => (
                      <input key={order.id} type="hidden" name="pedidoIds" value={order.id} />
                    ))}
                    <input type="hidden" name="transportadoraId" value={group.transportadoraId ?? ""} />
                    <input type="hidden" name="transportadoraNome" value={group.carrierName} />

                    <button
                      type="submit"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                    >
                      <Route className="h-4 w-4" />
                      Criar romaneio desta carga
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Truck className="h-5 w-5" />}
              title="Nenhuma sugestão disponível"
              description="Quando houver pedidos em PRONTO_ROMANEIO sem vínculo com uma carga aberta, eles aparecerão aqui."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function FeedbackBanner({ feedback }: { feedback: string }) {
  const success = ["criado", "salvo", "liberado", "cancelado"].includes(feedback);
  const className = success
    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";

  const message =
    feedback === "criado"
      ? "Romaneio criado com sucesso."
      : feedback === "salvo"
        ? "Romaneio atualizado com sucesso."
        : feedback === "liberado"
          ? "Romaneio liberado e pedidos enviados para EXPEDIDO."
          : feedback === "cancelado"
            ? "Romaneio cancelado e pedidos devolvidos para PRONTO_ROMANEIO."
            : "Não foi possível concluir a operação solicitada.";

  return <div className={`rounded-2xl px-4 py-3 text-sm ${className}`}>{message}</div>;
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-200">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function getStatusBadgeClassName(status: string) {
  switch (status) {
    case "ABERTO":
      return "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200";
    case "LIBERADO":
      return "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "CANCELADO":
      return "rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200";
    default:
      return "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200";
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}
