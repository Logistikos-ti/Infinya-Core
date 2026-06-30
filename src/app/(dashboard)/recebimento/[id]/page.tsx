import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  FileText,
  PackageCheck,
} from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReceivingConferencePanel } from "@/components/receiving/receiving-conference-panel";
import { requireModuleAccess } from "@/lib/auth";
import {
  getReceivingOrderDetailFromDb,
  listOperationalIssuesFromDb,
  type ReceivingOrderDetail,
} from "@/lib/receiving";
import { listDepositProtocolsByReceivingOrderId } from "@/lib/stock";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RecebimentoDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RecebimentoDetalhePage({
  params,
}: RecebimentoDetalhePageProps) {
  await requireModuleAccess("recebimento");

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [order, addresses] = await Promise.all([
    getReceivingOrderDetailFromDb(id),
    supabase
      .from("enderecos")
      .select("id, codigo, area")
      .eq("ativo", true)
      .neq("area", "BLOQUEADO")
      .order("codigo"),
  ]);

  if (!order) {
    notFound();
  }

  const [relatedIssues, generatedProtocols] = await Promise.all([
    listOperationalIssuesFromDb({ orderId: order.id, limit: 12 }),
    listDepositProtocolsByReceivingOrderId(order.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/recebimento"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para recebimento
        </Link>
      </div>

      <ModulePageHeader
        title={order.code}
        description={`Pedido inbound de ${order.depositante} com fornecedor ${order.supplier}.`}
        badge={order.status}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={PackageCheck}
          label="Volumes previstos"
          value={String(order.volumes)}
          help={`Doca inicial ${order.dock}`}
        />
        <StatCard
          icon={ClipboardCheck}
          label="SKUs previstos"
          value={String(order.skuCount)}
          help="Itens esperados para conferência"
        />
        <StatCard
          icon={FileText}
          label="Nota fiscal"
          value={order.noteNumber}
          help={`Protocolo ${order.protocol}`}
        />
        <StatCard
          icon={order.divergence.hasAny ? AlertTriangle : ClipboardCheck}
          label={order.divergence.hasAny ? "Divergências" : "Chegada prevista"}
          value={order.divergence.hasAny ? String(order.divergence.itemCount) : order.eta}
          help={
            order.divergence.hasAny
              ? `${order.divergence.totalQuantity.toLocaleString("pt-BR")} volume(s) com diferença`
              : `Status atual: ${order.status}`
          }
        />
      </section>

      {order.divergence.hasAny ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Divergência encontrada entre a NF-e e a conferência física
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-100">
                {order.divergence.itemCount} item(ns) com diferença, somando{" "}
                {order.divergence.totalQuantity.toLocaleString("pt-BR")} volume(s) fora do
                previsto. As ocorrências abaixo ficam vinculadas somente a este recebimento.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <ReceivingConferencePanel
        orderId={order.id}
        initialItems={order.items}
        addresses={addresses.data ?? []}
      />

      <section className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Itens da conferência
            </h2>
            <span
              className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
                order.divergence.hasAny
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
              }`}
            >
              {order.divergence.hasAny
                ? `${order.divergence.itemCount} divergência(s)`
                : "Conferência sem divergências"}
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">SKU</th>
                  <th className="pb-3 font-medium">Descrição</th>
                  <th className="pb-3 font-medium">Previsto</th>
                  <th className="pb-3 font-medium">Recebido</th>
                  <th className="pb-3 font-medium">Conferência</th>
                  <th className="pb-3 font-medium">Lote</th>
                  <th className="pb-3 font-medium">Validade</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: ReceivingOrderDetail["items"][number]) => (
                  <tr
                    key={`${order.id}-${item.id}`}
                    className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800"
                  >
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{item.sku}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.description}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.expected}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.received}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.divergenceQuantity === 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                        }`}
                      >
                        {item.divergenceLabel}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.lot}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{item.expiry}</td>
                  </tr>
                ))}
                {!order.items.length ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500 dark:text-slate-400">
                      Nenhum item cadastrado ainda para este recebimento.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Protocolos de depósito gerados
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Saldos lançados a partir deste recebimento, já com rastreabilidade por lote,
                  validade e endereço.
                </p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                {generatedProtocols.length} protocolo(s)
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {generatedProtocols.length ? (
                generatedProtocols.map((protocol) => (
                  <div
                    key={protocol.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">
                          {protocol.protocol}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {protocol.sku} • {protocol.productName} • {protocol.endereco} • {protocol.area}
                        </p>
                        <div className="mt-2 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                          <p>Lote: {protocol.lote}</p>
                          <p>Validade: {protocol.validade}</p>
                          <p>Saldo: {protocol.saldo}</p>
                          <p>{protocol.withdrawalLabel}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/estoque/protocolos/${protocol.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Abrir protocolo
                        </Link>
                        <Link
                          href={`/api/estoque/protocolos/${protocol.id}/pdf`}
                          target="_blank"
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Emitir PDF
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-zinc-950/40 dark:text-slate-300">
                  Os protocolos aparecem aqui assim que a conferência conclui a entrada em estoque.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Checklist operacional
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {order.checklist.map((item) => (
                <li key={item} className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-zinc-950/40">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Ocorrências relacionadas
            </h2>
            <div className="mt-4 space-y-3">
              {relatedIssues.length ? (
                relatedIssues.map((issue) => (
                  <div key={issue.id} className="rounded-xl bg-rose-50 px-4 py-3 dark:bg-rose-500/10">
                    <p className="text-sm font-semibold text-rose-900 dark:text-rose-300">
                      {issue.title}
                    </p>
                    <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{issue.type}</p>
                    <p className="mt-2 text-sm text-rose-800 dark:text-rose-200">{issue.action}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-zinc-950/40 dark:text-slate-300">
                  Nenhuma ocorrência vinculada até o momento.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
