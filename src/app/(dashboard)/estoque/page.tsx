import Link from "next/link";
import { AlertTriangle, Archive, Boxes, Download, Search, ShieldAlert } from "lucide-react";
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
  { value: "PULMAO", label: "Pulmão" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedição" },
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

  const [stockStatsCards, stockBalances, stockExpiryAlerts, stockMovements, traceabilityProtocols] =
    await Promise.all([
      listStockStatsFromDb(user, filters),
      listStockBalancesFromDb(filters),
      listStockExpiryAlertsFromDb(filters),
      listStockMovementsFromDb(filters),
      listStockTraceabilityProtocolsFromDb(filters),
    ]);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Estoque"
        description="Consulta operacional de saldos por depositante, produto, área, lote e rastreabilidade."
        badge="Core"
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Alertas de vencimento</h2>
            <p className="mt-1 text-sm text-slate-600">
              O sistema destaca lotes vencidos ou com vencimento em até 30 dias para ação
              operacional imediata.
            </p>
          </div>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            {stockExpiryAlerts.filter((item) => item.severity === "critico").length} crítico(s)
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
                    ? "border-rose-200 bg-rose-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.protocol}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {item.depositante} • {item.sku} • {item.productName}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.severity === "critico"
                        ? "bg-white text-rose-700"
                        : "bg-white text-amber-700"
                    }`}
                  >
                    {item.severityLabel}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <p>Área: {formatAreaLabel(item.area)}</p>
                  <p>Endereço: {item.endereco}</p>
                  <p>Lote: {item.lote}</p>
                  <p>Saldo: {item.saldo}</p>
                  <p>Validade: {item.expiryDate}</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 lg:col-span-2">
              Nenhum lote próximo ao vencimento dentro do filtro atual.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Consulta de estoque</h2>
            <p className="mt-1 text-sm text-slate-600">
              Filtre os saldos por depositante, produto, área e lote para localizar rapidamente a
              posição certa.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            {stockBalances.length} saldo(s)
          </span>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.3fr_0.9fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Depositante
              </span>
              <select
                name="depositante"
                defaultValue={effectiveDepositanteFilter}
                disabled={!canManageMultipleTenants(user)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
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
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Produto
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  name="produto"
                  defaultValue={productFilter}
                  placeholder="SKU, nome ou código interno"
                  className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Área
              </span>
              <select
                name="area"
                defaultValue={areaFilter}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                {areaOptions.map((option) => (
                  <option key={option.value || "todas"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Lote
              </span>
              <input
                type="text"
                name="lote"
                defaultValue={lotFilter}
                placeholder="Ex.: LOT-2026-001"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>

            <div className="flex items-end gap-2">
              <Button type="submit" className="h-11 bg-slate-950 text-white hover:bg-slate-800">
                Filtrar
              </Button>
              <Link
                href="/estoque"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Saldos monitorados</h2>
          <p className="mt-1 text-sm text-slate-600">
            Estoque real lançado a partir do fluxo de recebimento e das próximas movimentações.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Protocolo</th>
                  <th className="pb-3 font-medium">SKU</th>
                  <th className="pb-3 font-medium">Produto</th>
                  <th className="pb-3 font-medium">Depositante</th>
                  <th className="pb-3 font-medium">Área</th>
                  <th className="pb-3 font-medium">Endereço</th>
                  <th className="pb-3 font-medium">Lote</th>
                  <th className="pb-3 font-medium">Saldo</th>
                  <th className="pb-3 font-medium">Método</th>
                  <th className="pb-3 font-medium">Validade</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stockBalances.map((item) => (
                  <tr
                    key={`${item.id}-${item.sku}-${item.lote}`}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="py-3">
                      <Link
                        href={`/estoque/protocolos/${item.id}`}
                        className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        {item.protocol}
                      </Link>
                    </td>
                    <td className="py-3 font-medium text-slate-900">{item.sku}</td>
                    <td className="py-3 text-slate-600">{item.productName}</td>
                    <td className="py-3 text-slate-600">{item.depositante}</td>
                    <td className="py-3 text-slate-600">{formatAreaLabel(item.area)}</td>
                    <td className="py-3 text-slate-600">{item.endereco}</td>
                    <td className="py-3 text-slate-600">{item.lote}</td>
                    <td className="py-3 text-slate-600">{item.saldo}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {item.withdrawalLabel}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">{item.validade}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!stockBalances.length ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-500">
                      Nenhum saldo encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Protocolos de depósito</h2>
              <p className="mt-1 text-sm text-slate-600">
                Rastreabilidade por lote, validade, área, endereço e data de entrada.
              </p>
            </div>
            <Button
              type="submit"
              form="protocolos-lote-form"
              formTarget="_blank"
              className="bg-slate-950 text-white hover:bg-slate-800"
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
                  className="flex gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300"
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
                          className="text-sm font-semibold text-slate-950 transition hover:text-sky-700"
                        >
                          {item.protocol}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.depositante} • {item.sku} • {formatAreaLabel(item.area)} • {item.endereco}
                        </p>
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          {item.withdrawalLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p>Lote: {item.lote}</p>
                      <p>Validade: {item.validade}</p>
                      <p>Saldo: {item.saldo}</p>
                      <p>Entrada: {item.createdAt}</p>
                    </div>
                  </div>
                </label>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Nenhum protocolo encontrado dentro do filtro atual.
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Últimos movimentos rastreáveis</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cada movimentação mantém o vínculo com protocolo, lote, validade e referência de origem.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {stockMovements.length ? (
            stockMovements.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                    {item.protocol}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {item.reference}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{item.label}</p>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <p>Lote: {item.lot}</p>
                  <p>Validade: {item.expiry}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 lg:col-span-2">
              Nenhuma movimentação encontrada dentro do filtro atual.
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
      return "Pulmão";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedição";
    default:
      return value;
  }
}
