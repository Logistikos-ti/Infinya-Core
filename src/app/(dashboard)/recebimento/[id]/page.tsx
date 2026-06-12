import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, FileText, PackageCheck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { getReceivingOrderById, listOperationalIssues } from "@/lib/wms-data";

type RecebimentoDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RecebimentoDetalhePage({
  params,
}: RecebimentoDetalhePageProps) {
  const { id } = await params;
  const order = getReceivingOrderById(id);

  if (!order) {
    notFound();
  }

  const relatedIssues = listOperationalIssues().filter(
    (issue) => issue.depositante === order.depositante,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/recebimento"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
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
          icon={ClipboardCheck}
          label="Chegada prevista"
          value={order.eta}
          help={`Status atual: ${order.status}`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Itens da conferência</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">SKU</th>
                  <th className="pb-3 font-medium">Descrição</th>
                  <th className="pb-3 font-medium">Previsto</th>
                  <th className="pb-3 font-medium">Recebido</th>
                  <th className="pb-3 font-medium">Lote</th>
                  <th className="pb-3 font-medium">Validade</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={`${order.code}-${item.sku}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 font-medium text-slate-900">{item.sku}</td>
                    <td className="py-3 text-slate-600">{item.description}</td>
                    <td className="py-3 text-slate-600">{item.expected}</td>
                    <td className="py-3 text-slate-600">{item.received}</td>
                    <td className="py-3 text-slate-600">{item.lot}</td>
                    <td className="py-3 text-slate-600">{item.expiry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Checklist operacional</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {order.checklist.map((item) => (
                <li key={item} className="rounded-xl bg-slate-50 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Ocorrências relacionadas</h2>
            <div className="mt-4 space-y-3">
              {relatedIssues.length ? (
                relatedIssues.map((issue) => (
                  <div key={issue.title} className="rounded-xl bg-rose-50 px-4 py-3">
                    <p className="text-sm font-semibold text-rose-900">{issue.title}</p>
                    <p className="mt-1 text-xs text-rose-700">{issue.type}</p>
                    <p className="mt-2 text-sm text-rose-800">{issue.action}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
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
