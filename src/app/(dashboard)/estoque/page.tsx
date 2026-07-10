import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  Boxes,
  ClipboardList,
  Download,
  MoveRight,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";
import { StockFiltersForm } from "@/components/estoque/stock-filters-form";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { getDesktopStockPageData } from "./_lib";

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
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedição" },
];

const stockActionCards = [
  {
    href: "/estoque/saldo-inicial",
    title: "Lançar estoque inicial",
    description: "Abra a tela dedicada para bipar endereço e produto na primeira carga de saldo.",
    icon: PlusCircle,
    tone:
      "border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 text-cyan-700 dark:border-cyan-500/30 dark:from-cyan-500/10 dark:to-sky-500/10 dark:text-cyan-200",
  },
  {
    href: "/estoque/movimentacao-interna",
    title: "Movimentação interna",
    description: "Transfira saldos entre endereços com origem, destino e quantidade rastreáveis.",
    icon: MoveRight,
    tone:
      "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 text-violet-700 dark:border-violet-500/30 dark:from-violet-500/10 dark:to-fuchsia-500/10 dark:text-violet-200",
  },
  {
    href: "/estoque/inventarios/novo",
    title: "Inventário cíclico",
    description: "Crie contagens cegas por depositante e área sem misturar com a consulta geral.",
    icon: ClipboardList,
    tone:
      "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-orange-500/10 dark:text-amber-200",
  },
];

export default async function EstoquePage({ searchParams }: EstoquePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const data = await getDesktopStockPageData(params);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Estoque"
        description="Consulta operacional de saldos por depositante, produto, área, lote e rastreabilidade."
        badge="Log"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Boxes}
          label={data.stockStatsCards[0].label}
          value={data.stockStatsCards[0].value}
          help={data.stockStatsCards[0].help}
        />
        <StatCard
          icon={ShieldAlert}
          label={data.stockStatsCards[1].label}
          value={data.stockStatsCards[1].value}
          help={data.stockStatsCards[1].help}
        />
        <StatCard
          icon={Archive}
          label={data.stockStatsCards[2].label}
          value={data.stockStatsCards[2].value}
          help={data.stockStatsCards[2].help}
        />
        <StatCard
          icon={AlertTriangle}
          label={data.stockStatsCards[3].label}
          value={data.stockStatsCards[3].value}
          help={data.stockStatsCards[3].help}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Ações operacionais
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Escolha o fluxo que deseja executar. Cada operação abre sua própria tela para deixar o
            uso mais limpo e intuitivo.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {stockActionCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm ${card.tone}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{card.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {card.description}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-3 shadow-sm dark:bg-slate-950/40">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Contagens cíclicas recentes
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Acompanhe o avanço das contagens em andamento e entre direto nos itens para registrar
              divergências.
            </p>
          </div>
          <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            {data.cycleCountsResult.available
              ? `${data.cycleCountsResult.data.length} contagem(ns)`
              : "Migração pendente"}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {data.cycleCountsResult.available ? (
            data.cycleCountsResult.data.length ? (
              data.cycleCountsResult.data.map((count) => (
                <Link
                  key={count.id}
                  href={`/estoque/inventarios/${count.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-fuchsia-300 hover:shadow-sm dark:border-zinc-800 dark:hover:border-fuchsia-500/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        {count.titulo}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {count.depositante} • {count.area} • {count.createdAt}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {count.status}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                    <p>Itens: {count.totalItems}</p>
                    <p>Contados: {count.countedItems}</p>
                    <p>Divergências: {count.divergentItems}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400">
                Nenhuma contagem cíclica criada até o momento.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-amber-200 px-4 py-8 text-center text-sm text-amber-700 dark:border-amber-500/30 dark:text-amber-300">
              Assim que a nova migração do Supabase for executada, as contagens cíclicas aparecerão
              aqui.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Alertas de vencimento
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              O sistema destaca lotes vencidos ou com vencimento em até 30 dias para ação
              operacional imediata.
            </p>
          </div>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {data.stockExpiryAlerts.filter((item) => item.severity === "critico").length} crítico(s)
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {data.stockExpiryAlerts.length ? (
            data.stockExpiryAlerts.map((item) => (
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
                  <p>Área: {formatAreaLabel(item.area)}</p>
                  <p>Endereço: {item.endereco}</p>
                  <p>Lote: {item.lote}</p>
                  <p>Saldo: {item.saldo}</p>
                  <p>Validade: {item.expiryDate}</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400 lg:col-span-2">
              Nenhum lote próximo ao vencimento dentro do filtro atual.
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
              Filtre os saldos por depositante, produto, área e lote para localizar rapidamente a
              posição certa.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            {data.stockBalances.length} saldo(s)
          </span>
        </div>

        <StockFiltersForm
          depositante={data.effectiveDepositanteFilter}
          produto={data.productFilter}
          area={data.areaFilter}
          lote={data.lotFilter}
          canSelectDepositante={data.canSelectDepositante}
          depositantes={data.depositanteOptions.map((depositante) => ({
            value: depositante.id,
            label: depositante.nome,
          }))}
          areas={areaOptions}
        />
      </section>

      <section className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Saldos monitorados
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Estoque real lançado a partir do fluxo de recebimento e das próximas movimentações.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
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
                {data.stockBalances.map((item) => (
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
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{item.sku}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.productName}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.depositante}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {formatAreaLabel(item.area)}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.endereco}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.lote}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.saldo}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        {item.withdrawalLabel}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.validade}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data.stockBalances.length ? (
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
                Protocolos de depósito
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Rastreabilidade por lote, validade, área, endereço e data de entrada.
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
            {data.traceabilityProtocols.length ? (
              data.traceabilityProtocols.map((item) => (
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
          Últimos movimentos rastreáveis
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Cada movimentação mantém o vínculo com protocolo, lote, validade e referência de origem.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {data.stockMovements.length ? (
            data.stockMovements.map((item) => (
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
      return "Armazenagem";
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
