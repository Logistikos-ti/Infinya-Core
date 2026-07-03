import Link from "next/link";
import { AlertTriangle, Archive, Boxes, Download, ShieldAlert } from "lucide-react";
import { StockFiltersForm } from "@/components/estoque/stock-filters-form";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants } from "@/lib/permissions";
import {
  listStockBalancesFromDb,
  listStockExpiryAlertsFromDb,
  listStockMovementsFromDb,
  listStockStatsFromDb,
  listStockTraceabilityProtocolsFromDb,
} from "@/lib/stock";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type EstoquePageProps = {
  searchParams?: Promise<{
    depositante?: string;
    produto?: string;
    area?: string;
    lote?: string;
  }>;
};

const areaOptions = [
  { value: "", label: "Todas" },
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Pulmao" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedicao" },
];

export default async function EstoquePage({ searchParams }: EstoquePageProps) {
  const user = await requireModuleAccess("estoque");
  const params = searchParams ? await searchParams : undefined;
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const productFilter = params?.produto?.trim() ?? "";
  const areaFilter = params?.area?.trim() ?? "";
  const lotFilter = params?.lote?.trim() ?? "";
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;

  const supabase = await createSupabaseServerClient();
  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const filters = {
    depositanteId: effectiveDepositanteFilter || undefined,
    productTerm: productFilter || undefined,
    area: areaFilter || undefined,
    lot: lotFilter || undefined,
  };

  const [stockBalances, stockMovements] = await Promise.all([
    listStockBalancesFromDb(filters),
    listStockMovementsFromDb(filters),
  ]);
  const [stockExpiryAlerts, traceabilityProtocols, stockStatsCards] = await Promise.all([
    listStockExpiryAlertsFromDb(filters, 30, stockBalances),
    listStockTraceabilityProtocolsFromDb(filters, stockBalances),
    listStockStatsFromDb(user, filters, stockBalances),
  ]);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Estoque"
        description="Consulta operacional de saldos por depositante, produto, area, lote e rastreabilidade."
        badge="Log"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Boxes}
          label={stockStatsCards[0].label}
          value={stockStatsCards[0].value}
          help={stockStatsCards[0].help}
        />
        <StatCard
          icon={ShieldAlert}
          label={stockStatsCards[1].label}
          value={stockStatsCards[1].value}
          help={stockStatsCards[1].help}
        />
        <StatCard
          icon={Archive}
          label={stockStatsCards[2].label}
          value={stockStatsCards[2].value}
          help={stockStatsCards[2].help}
        />
        <StatCard
          icon={AlertTriangle}
          label={stockStatsCards[3].label}
          value={stockStatsCards[3].value}
          help={stockStatsCards[3].help}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Alertas de vencimento
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              O sistema destaca lotes vencidos ou com vencimento em ate 30 dias para acao
              operacional imediata.
            </p>
          </div>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {stockExpiryAlerts.filter((item) => item.severity === "critico").length} critico(s)
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {stockExpiryAlerts.length ? (
            stockExpiryAlerts.map((item) => (
              <Link
                key={item.id}
                href={`/estoque/protocolos/${item.id}`}
                className={`rounded-2xl border p-4 transition hover:shadow-sm ${
                  item.severity === "critico"
                    ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
                    : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {item.protocol}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {item.depositante} • {item.sku} • {item.productName}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.severity === "critico"
                        ? "bg-white text-rose-700 dark:bg-zinc-900 dark:text-rose-300"
                        : "bg-white text-amber-700 dark:bg-zinc-900 dark:text-amber-300"
                    }`}
                  >
                    {item.severityLabel}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                  <p>Area: {formatAreaLabel(item.area)}</p>
                  <p>Endereco: {item.endereco}</p>
                  <p>Lote: {item.lote}</p>
                  <p>Saldo: {item.saldo}</p>
                  <p>Validade: {item.expiryDate}</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400 lg:col-span-2">
              Nenhum lote proximo ao vencimento dentro do filtro atual.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Consulta de estoque
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Filtre os saldos por depositante, produto, area e lote para localizar rapidamente a
              posicao certa.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            {stockBalances.length} saldo(s)
          </span>
        </div>

        <StockFiltersForm
          depositante={effectiveDepositanteFilter}
          produto={productFilter}
          area={areaFilter}
          lote={lotFilter}
          canSelectDepositante={canManageMultipleTenants(user)}
          depositantes={depositanteOptions.map((depositante) => ({
            value: depositante.id,
            label: depositante.nome,
          }))}
          areas={areaOptions}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Saldos monitorados
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Estoque real lancado a partir do fluxo de recebimento e das proximas movimentacoes.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Protocolo</th>
                  <th className="pb-3 font-medium">SKU</th>
                  <th className="pb-3 font-medium">Produto</th>
                  <th className="pb-3 font-medium">Depositante</th>
                  <th className="pb-3 font-medium">Area</th>
                  <th className="pb-3 font-medium">Endereco</th>
                  <th className="pb-3 font-medium">Lote</th>
                  <th className="pb-3 font-medium">Saldo</th>
                  <th className="pb-3 font-medium">Metodo</th>
                  <th className="pb-3 font-medium">Validade</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stockBalances.map((item) => (
                  <tr
                    key={`${item.id}-${item.sku}-${item.lote}`}
                    className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800"
                  >
                    <td className="py-3">
                      <Link
                        href={`/estoque/protocolos/${item.id}`}
                        className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
                      >
                        {item.protocol}
                      </Link>
                    </td>
                    <td className="py-3 font-medium text-slate-900 dark:text-white">
                      {item.sku}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {item.productName}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {item.depositante}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {formatAreaLabel(item.area)}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {item.endereco}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.lote}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.saldo}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        {item.withdrawalLabel}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {item.validade}
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!stockBalances.length ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-500 dark:text-slate-400">
                      Nenhum saldo encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Protocolos de deposito
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Rastreabilidade por lote, validade, area, endereco e data de entrada.
              </p>
            </div>
            <Button
              type="submit"
              form="protocolos-lote-form"
              formTarget="_blank"
              className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              <Download className="h-4 w-4" />
              Emitir lote em PDF
            </Button>
          </div>

          <form
            id="protocolos-lote-form"
            action="/api/estoque/protocolos/lote/pdf"
            method="get"
            target="_blank"
            className="mt-4 space-y-3"
          >
            {traceabilityProtocols.length ? (
              traceabilityProtocols.map((item) => (
                <label
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                >
                  <input
                    type="checkbox"
                    name="ids"
                    value={item.id}
                    defaultChecked
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/estoque/protocolos/${item.id}`}
                          className="text-sm font-semibold text-slate-950 transition hover:text-sky-700 dark:text-white dark:hover:text-sky-300"
                        >
                          {item.protocol}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {item.depositante} • {item.sku} • {formatAreaLabel(item.area)} •{" "}
                          {item.endereco}
                        </p>
                        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {item.withdrawalLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                      <p>Lote: {item.lote}</p>
                      <p>Validade: {item.validade}</p>
                      <p>Saldo: {item.saldo}</p>
                      <p>Entrada: {item.createdAt}</p>
                    </div>
                  </div>
                </label>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400">
                Nenhum protocolo encontrado dentro do filtro atual.
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          Ultimos movimentos rastreaveis
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Cada movimentacao mantem o vinculo com protocolo, lote, validade e referencia de
          origem.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {stockMovements.length ? (
            stockMovements.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                    {item.protocol}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {item.reference}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{item.label}</p>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                  <p>Lote: {item.lot}</p>
                  <p>Validade: {item.expiry}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400 lg:col-span-2">
              Nenhuma movimentacao encontrada dentro do filtro atual.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatAreaLabel(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Pulmao";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedicao";
    default:
      return value;
  }
}
