import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Gift,
  PackageX,
  Search,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { requireModuleAccess } from "@/lib/auth";
import { listDamageReport } from "@/lib/damage-report";
import { listFiscalSummaryRows } from "@/lib/fiscal-documents";
import {
  listOperationalSlaReport,
  type OperationalSlaBand,
} from "@/lib/operational-sla-report";
import { listReverseLogisticsReport } from "@/lib/reverse-logistics-report";
import { SALES_CHANNEL_OPTIONS } from "@/lib/sales-channels";
import { listSalesReport } from "@/lib/sales-report";
import { canManageMultipleTenants } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type RelatoriosPageProps = {
  searchParams?: Promise<{
    depositante?: string;
    produto?: string;
    area?: string;
    lote?: string;
    nfeDepositante?: string;
    dataInicio?: string;
    dataFim?: string;
    fluxoFiscal?: string;
    emitente?: string;
    destinatario?: string;
    slaDepositante?: string;
    slaDataInicio?: string;
    slaDataFim?: string;
    slaStatus?: string;
    slaFaixa?: string;
    avariaDepositante?: string;
    avariaDataInicio?: string;
    avariaDataFim?: string;
    avariaStatus?: string;
    reversaDepositante?: string;
    reversaDataInicio?: string;
    reversaDataFim?: string;
    vendaDepositante?: string;
    vendaDataInicio?: string;
    vendaDataFim?: string;
    vendaCanal?: string;
  }>;
};

const areaOptions = [
  { value: "", label: "Todas" },
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "ExpediÃ§Ã£o" },
];

const fiscalFlowOptions = [
  { value: "", label: "Todos" },
  { value: "ENTRADA", label: "Entrada" },
  { value: "SAIDA", label: "SaÃ­da" },
];

const slaStatusOptions = [
  { value: "", label: "Todos os status" },
  { value: "NOVO", label: "Novo" },
  { value: "EM_SEPARACAO", label: "Em separação" },
  { value: "SEPARADO", label: "Separado" },
  { value: "EM_CONFERENCIA", label: "Em conferência" },
  { value: "CONFERIDO", label: "Conferido" },
  { value: "PRONTO_ROMANEIO", label: "Pronto para coleta" },
  { value: "EXPEDIDO", label: "Expedido" },
  { value: "EM_DIVERGENCIA", label: "Em divergência" },
  { value: "EM_CANCELAMENTO", label: "Cancelamento em andamento" },
  { value: "CANCELADO", label: "Cancelado" },
];

const slaBandOptions: Array<{ value: "" | OperationalSlaBand; label: string }> = [
  { value: "", label: "Todas as faixas" },
  { value: "NO_PRAZO", label: "No prazo" },
  { value: "ATENCAO", label: "Atenção" },
  { value: "ATRASADO", label: "Atrasado" },
  { value: "CANCELADO", label: "Cancelado" },
];

const salesChannelOptions = [
  { value: "", label: "Todos os canais" },
  ...SALES_CHANNEL_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
];

const damageStatusOptions = [
  { value: "", label: "Todos os status" },
  { value: "EM_QUARENTENA", label: "Aguardando decisão" },
  { value: "LIBERADO", label: "Doadas / liberadas" },
  { value: "DESCARTADO", label: "Descartadas" },
];

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const user = await requireModuleAccess("relatorios");
  const params = searchParams ? await searchParams : undefined;
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const productFilter = params?.produto?.trim() ?? "";
  const areaFilter = params?.area?.trim() ?? "";
  const lotFilter = params?.lote?.trim() ?? "";
  const nfeDepositanteFilter = params?.nfeDepositante?.trim() ?? "";
  const dateFrom = params?.dataInicio?.trim() ?? "";
  const dateTo = params?.dataFim?.trim() ?? "";
  const fiscalFlow = params?.fluxoFiscal?.trim() ?? "";
  const issuerTerm = params?.emitente?.trim() ?? "";
  const recipientTerm = params?.destinatario?.trim() ?? "";
  const slaDepositanteFilter = params?.slaDepositante?.trim() ?? "";
  const slaDateFrom = params?.slaDataInicio?.trim() ?? "";
  const slaDateTo = params?.slaDataFim?.trim() ?? "";
  const slaStatus = params?.slaStatus?.trim() ?? "";
  const slaBand = normalizeSlaBand(params?.slaFaixa);
  const avariaDepositanteFilter = params?.avariaDepositante?.trim() ?? "";
  const avariaDateFrom = params?.avariaDataInicio?.trim() ?? "";
  const avariaDateTo = params?.avariaDataFim?.trim() ?? "";
  const avariaStatus = params?.avariaStatus?.trim() ?? "";
  const reversaDepositanteFilter = params?.reversaDepositante?.trim() ?? "";
  const reversaDateFrom = params?.reversaDataInicio?.trim() ?? "";
  const reversaDateTo = params?.reversaDataFim?.trim() ?? "";
  const vendaDepositanteFilter = params?.vendaDepositante?.trim() ?? "";
  const vendaDateFrom = params?.vendaDataInicio?.trim() ?? "";
  const vendaDateTo = params?.vendaDataFim?.trim() ?? "";
  const vendaCanal = params?.vendaCanal?.trim() ?? "";
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;
  const effectiveNfeDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : nfeDepositanteFilter;
  const effectiveSlaDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : slaDepositanteFilter;
  const effectiveAvariaDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : avariaDepositanteFilter;
  const effectiveReversaDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : reversaDepositanteFilter;
  const effectiveVendaDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : vendaDepositanteFilter;

  const supabase = await createSupabaseServerClient();
  const [
    { data: depositantes },
    fiscalSummary,
    slaReport,
    damageReport,
    reverseLogisticsReport,
    salesReport,
  ] = await Promise.all([
      supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
      listFiscalSummaryRows(user, {
        depositanteId: effectiveNfeDepositanteFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        flow: fiscalFlow === "ENTRADA" || fiscalFlow === "SAIDA" ? fiscalFlow : undefined,
        issuerTerm: issuerTerm || undefined,
        recipientTerm: recipientTerm || undefined,
      }),
      listOperationalSlaReport(user, {
        depositanteId: effectiveSlaDepositanteFilter || undefined,
        dateFrom: slaDateFrom || undefined,
        dateTo: slaDateTo || undefined,
        status: slaStatus || undefined,
        band: slaBand || undefined,
      }),
      listDamageReport(user, {
        depositanteId: effectiveAvariaDepositanteFilter || undefined,
        dateFrom: avariaDateFrom || undefined,
        dateTo: avariaDateTo || undefined,
        status: avariaStatus || undefined,
      }),
      listReverseLogisticsReport(user, {
        depositanteId: effectiveReversaDepositanteFilter || undefined,
        dateFrom: reversaDateFrom || undefined,
        dateTo: reversaDateTo || undefined,
      }),
      listSalesReport(user, {
        depositanteId: effectiveVendaDepositanteFilter || undefined,
        dateFrom: vendaDateFrom || undefined,
        dateTo: vendaDateTo || undefined,
        channel: vendaCanal || undefined,
      }),
    ]);

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  const stockExportQuery = new URLSearchParams({
    report: "saldo-estoque",
    ...(effectiveDepositanteFilter ? { depositante: effectiveDepositanteFilter } : {}),
    ...(productFilter ? { produto: productFilter } : {}),
    ...(areaFilter ? { area: areaFilter } : {}),
    ...(lotFilter ? { lote: lotFilter } : {}),
  });

  const fiscalExportQuery = new URLSearchParams({
    report: "nfe-resumo",
    ...(effectiveNfeDepositanteFilter ? { depositante: effectiveNfeDepositanteFilter } : {}),
    ...(dateFrom ? { dataInicio: dateFrom } : {}),
    ...(dateTo ? { dataFim: dateTo } : {}),
    ...(fiscalFlow ? { fluxoFiscal: fiscalFlow } : {}),
    ...(issuerTerm ? { emitente: issuerTerm } : {}),
    ...(recipientTerm ? { destinatario: recipientTerm } : {}),
  });

  const slaExportQuery = new URLSearchParams({
    report: "sla-operacional",
    ...(effectiveSlaDepositanteFilter
      ? { depositante: effectiveSlaDepositanteFilter }
      : {}),
    ...(slaDateFrom ? { dataInicio: slaDateFrom } : {}),
    ...(slaDateTo ? { dataFim: slaDateTo } : {}),
    ...(slaStatus ? { status: slaStatus } : {}),
    ...(slaBand ? { faixa: slaBand } : {}),
  });

  const avariaExportQuery = new URLSearchParams({
    report: "avarias",
    ...(effectiveAvariaDepositanteFilter ? { depositante: effectiveAvariaDepositanteFilter } : {}),
    ...(avariaDateFrom ? { dataInicio: avariaDateFrom } : {}),
    ...(avariaDateTo ? { dataFim: avariaDateTo } : {}),
    ...(avariaStatus ? { status: avariaStatus } : {}),
  });

  const reversaExportQuery = new URLSearchParams({
    report: "logistica-reversa",
    ...(effectiveReversaDepositanteFilter ? { depositante: effectiveReversaDepositanteFilter } : {}),
    ...(reversaDateFrom ? { dataInicio: reversaDateFrom } : {}),
    ...(reversaDateTo ? { dataFim: reversaDateTo } : {}),
  });

  const vendaExportQuery = new URLSearchParams({
    report: "vendas",
    ...(effectiveVendaDepositanteFilter ? { depositante: effectiveVendaDepositanteFilter } : {}),
    ...(vendaDateFrom ? { dataInicio: vendaDateFrom } : {}),
    ...(vendaDateTo ? { dataFim: vendaDateTo } : {}),
    ...(vendaCanal ? { canal: vendaCanal } : {}),
  });

  const fiscalTotals = fiscalSummary.reduce(
    (accumulator, row) => {
      accumulator.totalDocuments += row.totalDocuments;
      accumulator.entradaDocuments += row.entradaDocuments;
      accumulator.saidaDocuments += row.saidaDocuments;
      accumulator.totalValue += row.totalValue;
      return accumulator;
    },
    {
      totalDocuments: 0,
      entradaDocuments: 0,
      saidaDocuments: 0,
      totalValue: 0,
    },
  );

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="RelatÃ³rios"
        description="Saldo, fiscal, produtividade, SLA, avarias, logÃ­stica reversa, vendas e exportaÃ§Ãµes operacionais."
        badge="Operacional"
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              RelatÃ³rio de saldo exportÃ¡vel
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Exporte o saldo filtrado do estoque em Excel ou CSV, pronto para anÃ¡lise, envio ao
              cliente e conferência externa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/api/relatorios?${stockExportQuery.toString()}&format=csv`}>
              <Button className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
                <FileText className="h-4 w-4" />
                Exportar CSV
              </Button>
            </Link>
            <Link href={`/api/relatorios?${stockExportQuery.toString()}&format=excel`}>
              <Button variant="outline" className="dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.3fr_0.9fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Depositante
              </span>
              <select
                name="depositante"
                defaultValue={effectiveDepositanteFilter}
                disabled={!canManageMultipleTenants(user)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
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
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Produto
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  name="produto"
                  defaultValue={productFilter}
                  placeholder="SKU, nome ou cÃ³digo interno"
                  className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Ãrea
              </span>
              <select
                name="area"
                defaultValue={areaFilter}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {areaOptions.map((option) => (
                  <option key={option.value || "todas"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Lote
              </span>
              <input
                type="text"
                name="lote"
                defaultValue={lotFilter}
                placeholder="Ex.: LOT-2026-001"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
              />
            </label>

            <div className="flex items-end gap-2">
              <Button
                type="submit"
                className="h-11 bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Aplicar
              </Button>
              <Link
                href="/relatorios"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Relatório de SLA operacional
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Mede o tempo entre a entrada do pedido no WMS e sua expedição. A meta é de até 24
              horas, com atenção entre 24 e 72 horas e atraso operacional a partir de 72 horas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/api/relatorios?${slaExportQuery.toString()}&format=csv`}>
              <Button className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
                <FileText className="h-4 w-4" />
                Exportar CSV
              </Button>
            </Link>
            <Link href={`/api/relatorios?${slaExportQuery.toString()}&format=excel`}>
              <Button
                variant="outline"
                className="dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Depositante
              </span>
              <select
                name="slaDepositante"
                defaultValue={effectiveSlaDepositanteFilter}
                disabled={!canManageMultipleTenants(user)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <option value="">Todos</option>
                {depositanteOptions.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <DatePickerInput label="Data inicial" name="slaDataInicio" value={slaDateFrom} />
            <DatePickerInput label="Data final" name="slaDataFim" value={slaDateTo} />

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Status</span>
              <select
                name="slaStatus"
                defaultValue={slaStatus}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {slaStatusOptions.map((option) => (
                  <option key={option.value || "todos"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Faixa do SLA
              </span>
              <select
                name="slaFaixa"
                defaultValue={slaBand}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {slaBandOptions.map((option) => (
                  <option key={option.value || "todas"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button
                type="submit"
                className="h-11 bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Aplicar
              </Button>
              <Link
                href="/relatorios"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Pedidos monitorados" value={String(slaReport.summary.monitored)} />
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Dentro do SLA
              </p>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-2 text-lg font-semibold text-emerald-950 dark:text-emerald-100">
              {slaReport.summary.withinTargetRate}%
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              {slaReport.summary.withinTarget} pedido(s) em até 24h
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Em atenção
              </p>
              <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-2 text-lg font-semibold text-amber-950 dark:text-amber-100">
              {slaReport.summary.warning}
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Entre 24h e 72h</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-300">
                Atrasados
              </p>
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <p className="mt-2 text-lg font-semibold text-red-950 dark:text-red-100">
              {slaReport.summary.late}
            </p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">Acima de 72h</p>
          </div>
          <SummaryCard
            label="Ciclo médio concluído"
            value={formatHours(slaReport.summary.averageCycleHours)}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <p>
            {slaReport.summary.completed} pedido(s) concluído(s) e {slaReport.summary.cancelled}{" "}
            cancelado(s) no recorte atual.
          </p>
          {slaReport.rows.length > 200 ? <p>Exibindo os 200 registros mais recentes.</p> : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
              <tr>
                <th className="pb-3 pr-4 font-medium">Pedido</th>
                <th className="pb-3 pr-4 font-medium">Depositante</th>
                <th className="pb-3 pr-4 font-medium">Cliente</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Criado em</th>
                <th className="pb-3 pr-4 font-medium">Etapa atual</th>
                <th className="pb-3 pr-4 font-medium">Tempo</th>
                <th className="pb-3 pr-4 font-medium">Meta</th>
                <th className="pb-3 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody>
              {slaReport.rows.slice(0, 200).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="py-3 pr-4 font-semibold text-slate-950 dark:text-white">
                    {row.orderNumber}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.depositante}
                  </td>
                  <td className="max-w-64 truncate py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.customer}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.statusLabel}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.createdAtLabel}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.currentStage}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 font-medium text-slate-900 dark:text-white">
                    {row.elapsedLabel}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-slate-600 dark:text-slate-300">
                    Até {row.targetHours}h
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${slaBandClassName(row.band)}`}
                    >
                      {row.bandLabel}
                    </span>
                  </td>
                </tr>
              ))}
              {!slaReport.rows.length ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhum pedido encontrado para os filtros de SLA atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              RelatÃ³rio resumido de NF-e por depositante e perÃ­odo
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Consolida entradas, saÃ­das, valor total movimentado, volumes e itens fiscais por
              depositante no perÃ­odo selecionado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/api/relatorios?${fiscalExportQuery.toString()}&format=csv`}>
              <Button className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
                <FileText className="h-4 w-4" />
                Exportar CSV
              </Button>
            </Link>
            <Link href={`/api/relatorios?${fiscalExportQuery.toString()}&format=excel`}>
              <Button variant="outline" className="dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.9fr_1.1fr_1.1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Depositante
              </span>
              <select
                name="nfeDepositante"
                defaultValue={effectiveNfeDepositanteFilter}
                disabled={!canManageMultipleTenants(user)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <option value="">Todos</option>
                {depositanteOptions.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <DatePickerInput label="Data inicial" name="dataInicio" value={dateFrom} />

            <DatePickerInput label="Data final" name="dataFim" value={dateTo} />

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Fluxo
              </span>
              <select
                name="fluxoFiscal"
                defaultValue={fiscalFlow}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {fiscalFlowOptions.map((option) => (
                  <option key={option.value || "todos"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Emitente
              </span>
              <input
                type="text"
                name="emitente"
                defaultValue={issuerTerm}
                placeholder="RazÃ£o social ou documento"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                DestinatÃ¡rio
              </span>
              <input
                type="text"
                name="destinatario"
                defaultValue={recipientTerm}
                placeholder="RazÃ£o social ou documento"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
              />
            </label>

            <div className="flex items-end gap-2">
              <Button
                type="submit"
                className="h-11 bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Aplicar
              </Button>
              <Link
                href="/relatorios"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Documentos fiscais" value={String(fiscalTotals.totalDocuments)} />
          <SummaryCard label="NF-e de entrada" value={String(fiscalTotals.entradaDocuments)} />
          <SummaryCard label="NF-e de saÃ­da" value={String(fiscalTotals.saidaDocuments)} />
          <SummaryCard label="Valor total" value={formatCurrency(fiscalTotals.totalValue)} />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Depositante</th>
                <th className="pb-3 font-medium">Entrada</th>
                <th className="pb-3 font-medium">SaÃ­da</th>
                <th className="pb-3 font-medium">Total NF-e</th>
                <th className="pb-3 font-medium">Valor entrada</th>
                <th className="pb-3 font-medium">Valor saÃ­da</th>
                <th className="pb-3 font-medium">Valor total</th>
                <th className="pb-3 font-medium">Itens</th>
                <th className="pb-3 font-medium">Volumes</th>
                <th className="pb-3 font-medium">Primeira emissÃ£o</th>
                <th className="pb-3 font-medium">Ãšltima emissÃ£o</th>
              </tr>
            </thead>
            <tbody>
              {fiscalSummary.map((row) => (
                <tr
                  key={row.depositanteId}
                  className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="py-3 font-medium text-slate-900 dark:text-white">
                    {row.depositante}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {row.entradaDocuments}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {row.saidaDocuments}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {row.totalDocuments}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {formatCurrency(row.entradaValue)}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {formatCurrency(row.saidaValue)}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {formatCurrency(row.totalValue)}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">{row.totalItems}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">{row.totalVolumes}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {row.firstIssuedAtLabel}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {row.lastIssuedAtLabel}
                  </td>
                </tr>
              ))}
              {!fiscalSummary.length ? (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    Nenhum documento fiscal encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Relatório de avarias
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Consolida os itens de estoque colocados em quarentena por avaria: quantidade
              avariada, decisão do depositante e tempo até a resolução (doação ou descarte).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/api/relatorios?${avariaExportQuery.toString()}&format=csv`}>
              <Button className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
                <FileText className="h-4 w-4" />
                Exportar CSV
              </Button>
            </Link>
            <Link href={`/api/relatorios?${avariaExportQuery.toString()}&format=excel`}>
              <Button
                variant="outline"
                className="dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Depositante
              </span>
              <select
                name="avariaDepositante"
                defaultValue={effectiveAvariaDepositanteFilter}
                disabled={!canManageMultipleTenants(user)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <option value="">Todos</option>
                {depositanteOptions.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <DatePickerInput label="Data inicial" name="avariaDataInicio" value={avariaDateFrom} />
            <DatePickerInput label="Data final" name="avariaDataFim" value={avariaDateTo} />

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Status</span>
              <select
                name="avariaStatus"
                defaultValue={avariaStatus}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {damageStatusOptions.map((option) => (
                  <option key={option.value || "todos"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button
                type="submit"
                className="h-11 bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Aplicar
              </Button>
              <Link
                href="/relatorios"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Ocorrências no período" value={String(damageReport.summary.totalOccurrences)} />
          <SummaryCard
            label="Quantidade avariada"
            value={damageReport.summary.totalQuantity.toLocaleString("pt-BR")}
          />
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Aguardando decisão
              </p>
              <PackageX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-2 text-lg font-semibold text-amber-950 dark:text-amber-100">
              {damageReport.summary.pending}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Doadas / liberadas
              </p>
              <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-2 text-lg font-semibold text-emerald-950 dark:text-emerald-100">
              {damageReport.summary.donated}
            </p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-300">
                Descartadas
              </p>
              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <p className="mt-2 text-lg font-semibold text-red-950 dark:text-red-100">
              {damageReport.summary.discarded}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p>Tempo médio até a resolução: {formatHours(damageReport.summary.averageResolutionHours)}</p>
          {damageReport.summary.topProducts.length ? (
            <p className="text-slate-600 dark:text-slate-300">
              Mais avariados:{" "}
              {damageReport.summary.topProducts
                .map((product) => `${product.productName} (${product.quantity.toLocaleString("pt-BR")})`)
                .join(" • ")}
            </p>
          ) : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
              <tr>
                <th className="pb-3 pr-4 font-medium">Produto</th>
                <th className="pb-3 pr-4 font-medium">Depositante</th>
                <th className="pb-3 pr-4 font-medium">Quantidade</th>
                <th className="pb-3 pr-4 font-medium">Motivo</th>
                <th className="pb-3 pr-4 font-medium">Endereço</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Decisão</th>
                <th className="pb-3 pr-4 font-medium">Criado em</th>
                <th className="pb-3 font-medium">Resolvido em</th>
              </tr>
            </thead>
            <tbody>
              {damageReport.rows.slice(0, 200).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-slate-950 dark:text-white">{row.productName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{row.sku}</p>
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.depositante}</td>
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                    {row.quantityLabel}
                  </td>
                  <td className="max-w-64 truncate py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.reason}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.endereco} · {row.area}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${damageStatusClassName(row.status)}`}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.depositanteDecisionLabel || "-"}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.createdAtLabel}
                  </td>
                  <td className="whitespace-nowrap py-3 text-slate-600 dark:text-slate-300">
                    {row.resolvedAtLabel || "-"}
                  </td>
                </tr>
              ))}
              {!damageReport.rows.length ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhuma avaria encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {damageReport.rows.length > 200 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Exibindo os 200 registros mais recentes. Use a exportação para ver o período completo.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Relatório de logística reversa
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Pedidos de retirada com NF-e de devolução aceita e a cobrança de logística reversa
              gerada para cada um, com valores e período.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/api/relatorios?${reversaExportQuery.toString()}&format=csv`}>
              <Button className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
                <FileText className="h-4 w-4" />
                Exportar CSV
              </Button>
            </Link>
            <Link href={`/api/relatorios?${reversaExportQuery.toString()}&format=excel`}>
              <Button
                variant="outline"
                className="dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Depositante
              </span>
              <select
                name="reversaDepositante"
                defaultValue={effectiveReversaDepositanteFilter}
                disabled={!canManageMultipleTenants(user)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <option value="">Todos</option>
                {depositanteOptions.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <DatePickerInput label="Data inicial" name="reversaDataInicio" value={reversaDateFrom} />
            <DatePickerInput label="Data final" name="reversaDataFim" value={reversaDateTo} />

            <div className="flex items-end gap-2">
              <Button
                type="submit"
                className="h-11 bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Aplicar
              </Button>
              <Link
                href="/relatorios"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Ocorrências no período"
            value={String(reverseLogisticsReport.summary.totalOccurrences)}
          />
          <SummaryCard
            label="Unidades devolvidas"
            value={reverseLogisticsReport.summary.totalUnits.toLocaleString("pt-BR")}
          />
          <SummaryCard
            label="Valor total cobrado"
            value={formatCurrency(reverseLogisticsReport.summary.totalValue)}
          />
          <SummaryCard
            label="Ticket médio"
            value={formatCurrency(reverseLogisticsReport.summary.averageTicket)}
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
              <tr>
                <th className="pb-3 pr-4 font-medium">Pedido</th>
                <th className="pb-3 pr-4 font-medium">Depositante</th>
                <th className="pb-3 pr-4 font-medium">Cliente</th>
                <th className="pb-3 pr-4 font-medium">Quantidade</th>
                <th className="pb-3 pr-4 font-medium">Valor unitário</th>
                <th className="pb-3 pr-4 font-medium">Valor total</th>
                <th className="pb-3 pr-4 font-medium">NF-e de devolução</th>
                <th className="pb-3 font-medium">Lançado em</th>
              </tr>
            </thead>
            <tbody>
              {reverseLogisticsReport.rows.slice(0, 200).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="py-3 pr-4 font-semibold text-slate-950 dark:text-white">
                    {row.orderNumber}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.depositante}</td>
                  <td className="max-w-64 truncate py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.customer}
                  </td>
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                    {row.quantityLabel}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {formatCurrency(row.unitValue)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 font-medium text-slate-900 dark:text-white">
                    {formatCurrency(row.totalValue)}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.invoiceNumber ? `${row.invoiceNumber} · ${row.invoiceReceivedAtLabel}` : "-"}
                  </td>
                  <td className="whitespace-nowrap py-3 text-slate-600 dark:text-slate-300">
                    {row.createdAtLabel}
                  </td>
                </tr>
              ))}
              {!reverseLogisticsReport.rows.length ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhuma cobrança de logística reversa encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {reverseLogisticsReport.rows.length > 200 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Exibindo os 200 registros mais recentes. Use a exportação para ver o período completo.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Relatório de vendas
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Pedidos de venda por período, com faturamento, unidades, quebra por canal e produtos
              mais vendidos. Pedidos cancelados não entram no total.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/api/relatorios?${vendaExportQuery.toString()}&format=csv`}>
              <Button className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
                <FileText className="h-4 w-4" />
                Exportar CSV
              </Button>
            </Link>
            <Link href={`/api/relatorios?${vendaExportQuery.toString()}&format=excel`}>
              <Button
                variant="outline"
                className="dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1.1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Depositante
              </span>
              <select
                name="vendaDepositante"
                defaultValue={effectiveVendaDepositanteFilter}
                disabled={!canManageMultipleTenants(user)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <option value="">Todos</option>
                {depositanteOptions.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <DatePickerInput label="Data inicial" name="vendaDataInicio" value={vendaDateFrom} />
            <DatePickerInput label="Data final" name="vendaDataFim" value={vendaDateTo} />

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Canal</span>
              <select
                name="vendaCanal"
                defaultValue={vendaCanal}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {salesChannelOptions.map((option) => (
                  <option key={option.value || "todos"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button
                type="submit"
                className="h-11 bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Aplicar
              </Button>
              <Link
                href="/relatorios"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Pedidos" value={String(salesReport.summary.totalOrders)} />
          <SummaryCard
            label="Faturamento total"
            value={formatCurrency(salesReport.summary.totalValue)}
          />
          <SummaryCard
            label="Unidades vendidas"
            value={salesReport.summary.totalUnits.toLocaleString("pt-BR")}
          />
          <SummaryCard
            label="Ticket médio"
            value={formatCurrency(salesReport.summary.averageTicket)}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Faturamento por canal
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {salesReport.summary.channelBreakdown.map((channel) => (
                <div
                  key={channel.channelCode}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-slate-600 dark:text-slate-300">{channel.channelLabel}</span>
                  <span className="whitespace-nowrap font-medium text-slate-900 dark:text-white">
                    {formatCurrency(channel.totalValue)}{" "}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({channel.orders} pedido{channel.orders === 1 ? "" : "s"})
                    </span>
                  </span>
                </div>
              ))}
              {!salesReport.summary.channelBreakdown.length ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma venda encontrada para os filtros atuais.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Produtos mais vendidos
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {salesReport.summary.topProducts.map((product) => (
                <div
                  key={`${product.sku}-${product.productName}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-slate-600 dark:text-slate-300">
                    {product.productName}
                  </span>
                  <span className="whitespace-nowrap font-medium text-slate-900 dark:text-white">
                    {product.totalUnits.toLocaleString("pt-BR")} un.
                  </span>
                </div>
              ))}
              {!salesReport.summary.topProducts.length ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhum produto encontrado para os filtros atuais.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
              <tr>
                <th className="pb-3 pr-4 font-medium">Pedido</th>
                <th className="pb-3 pr-4 font-medium">Depositante</th>
                <th className="pb-3 pr-4 font-medium">Cliente</th>
                <th className="pb-3 pr-4 font-medium">UF</th>
                <th className="pb-3 pr-4 font-medium">Canal</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Unidades</th>
                <th className="pb-3 pr-4 font-medium">Valor total</th>
                <th className="pb-3 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {salesReport.rows.slice(0, 200).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800"
                >
                  <td className="py-3 pr-4 font-semibold text-slate-950 dark:text-white">
                    {row.orderNumber}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.depositante}</td>
                  <td className="max-w-52 truncate py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.customer}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.uf}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.channelLabel}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.statusLabel}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                    {row.totalUnits.toLocaleString("pt-BR")}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 font-medium text-slate-900 dark:text-white">
                    {formatCurrency(row.totalValue)}
                  </td>
                  <td className="whitespace-nowrap py-3 text-slate-600 dark:text-slate-300">
                    {row.createdAtLabel}
                  </td>
                </tr>
              ))}
              {!salesReport.rows.length ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhuma venda encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {salesReport.rows.length > 200 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Exibindo os 200 registros mais recentes. Use a exportação para ver o período completo.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeSlaBand(value?: string): OperationalSlaBand | "" {
  if (
    value === "NO_PRAZO" ||
    value === "ATENCAO" ||
    value === "ATRASADO" ||
    value === "CANCELADO"
  ) {
    return value;
  }

  return "";
}

function formatHours(value: number) {
  if (!value) return "0h";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} min`;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

function slaBandClassName(band: OperationalSlaBand) {
  if (band === "NO_PRAZO") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  }

  if (band === "ATENCAO") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
  }

  if (band === "ATRASADO") {
    return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300";
  }

  return "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300";
}

function damageStatusClassName(status: string) {
  if (status === "LIBERADO") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  }

  if (status === "DESCARTADO") {
    return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300";
  }

  return "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
}

