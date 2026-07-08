import Link from "next/link";
import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { listFiscalSummaryRows } from "@/lib/fiscal-documents";
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
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;
  const effectiveNfeDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : nfeDepositanteFilter;

  const supabase = await createSupabaseServerClient();
  const [{ data: depositantes }, fiscalSummary] = await Promise.all([
    supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
    listFiscalSummaryRows(user, {
      depositanteId: effectiveNfeDepositanteFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      flow: fiscalFlow === "ENTRADA" || fiscalFlow === "SAIDA" ? fiscalFlow : undefined,
      issuerTerm: issuerTerm || undefined,
      recipientTerm: recipientTerm || undefined,
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
        description="Saldo, fiscal, produtividade, SLA, rastreabilidade e exportaÃ§Ãµes operacionais."
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
              cliente e conferÃªncia externa.
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

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Data inicial
              </span>
              <input
                type="date"
                name="dataInicio"
                defaultValue={dateFrom}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Data final
              </span>
              <input
                type="date"
                name="dataFim"
                defaultValue={dateTo}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </label>

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


