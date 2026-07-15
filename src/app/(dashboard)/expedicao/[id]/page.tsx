import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, Paperclip, Pencil } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";
import { ShippingAttachmentUploadPanel } from "@/components/shipping/shipping-attachment-upload-panel";
import { ShippingDanfePanel } from "@/components/shipping/shipping-danfe-panel";
import { ShippingGeneratedLabelPanel } from "@/components/shipping/shipping-generated-label-panel";
import { ShippingMercadoLivreSyncPanel } from "@/components/shipping/shipping-mercado-livre-sync-panel";
import { ShippingXmlSyncPanel } from "@/components/shipping/shipping-xml-sync-panel";
import { requireModuleAccess } from "@/lib/auth";
import { getShippingOrderDetailFromDb } from "@/lib/shipping";
import { canUploadOperationalDocuments, isAdminUser } from "@/lib/permissions";

type ShippingOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function ShippingOrderDetailPage({
  params,
  searchParams,
}: ShippingOrderDetailPageProps) {
  const user = await requireModuleAccess("expedicao");
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const feedback = resolvedSearchParams?.feedback?.trim() ?? "";
  const order = await getShippingOrderDetailFromDb(id, user);

  if (!order) {
    notFound();
  }

  const canUploadAttachments = canUploadOperationalDocuments(user);
  const xmlAttachment = order.attachments.find((attachment) => attachment.kind === "XML_NF");
  const labelAttachment = order.attachments.find((attachment) => attachment.kind === "ETIQUETA");
  const xmlPending = xmlAttachment?.status === "PENDENTE";
  const isBlingOrder = order.origin === "BLING";
  const isMercadoLivreOrder = order.salesChannelCode === "MERCADO_LIVRE";
  const labelPending = labelAttachment?.status === "PENDENTE";
  const hasTrackingCode = order.trackingCode !== "Rastreio não informado";

  return (
    <div className="space-y-6">
      <Link
        href="/expedicao"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para expedição
      </Link>

      <ModulePageHeader
        title={`Pedido ${order.displayNumber}`}
        description="Visualização completa do pedido de expedição, com dados comerciais, logísticos e rastreabilidade."
        badge={order.statusLabel}
      />

      {feedback === "salvo" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          Pedido atualizado com sucesso.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200">
          <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          Origem: {order.origin} • Canal: {order.channel}
        </div>
        {isAdminUser(user) ? (
          <Link
            href={`/expedicao/${order.id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            <Pencil className="h-4 w-4" />
            Editar pedido
          </Link>
        ) : null}
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Resumo operacional
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InfoCard label="Pedido WMS" value={order.displayNumber} />
              <InfoCard label="Pedido da plataforma" value={order.externalNumber} />
              <InfoCard label="Código técnico" value={order.code} />
              <InfoCard label="Tipo de pedido" value={order.orderType} />
              <InfoCard label="Depositante" value={order.depositante} />
              <InfoCard label="Status de origem" value={order.sourceStatus || "-"} />
              <InfoCard label="Marketplace" value={order.marketplace} />
              <InfoCard label="Loja" value={order.storeDisplay} />
              <InfoCard label="Nota fiscal" value={order.invoice} />
              <InfoCard label="Data do pedido" value={order.orderDate} />
              <InfoCard label="Data prevista" value={order.expectedDate} />
              <InfoCard label="Previsão de envio" value={order.shipDate} />
              <InfoCard label="Última sincronização" value={order.syncedAt} />
              <InfoCard label="Valor total" value={order.total} />
              <InfoCard label="Itens" value={String(order.itemCount)} />
              <InfoCard label="Unidades" value={order.units} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Itens do pedido
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-slate-400">
                  <tr>
                    <th className="pb-3 font-medium">Item</th>
                    <th className="pb-3 font-medium">Código</th>
                    <th className="pb-3 font-medium">SKU</th>
                    <th className="pb-3 font-medium">Unidade</th>
                    <th className="pb-3 font-medium">Qtd.</th>
                    <th className="pb-3 font-medium">Separado</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800">
                      <td className="py-3 text-slate-900 dark:text-white">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Ref. externa: {item.externalReference}
                        </div>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{item.code}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{item.sku}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{item.unit}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{item.quantity}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">
                        {item.separatedQuantity}
                      </td>
                    </tr>
                  ))}
                  {!order.items.length ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 dark:text-slate-400">
                        Este pedido ainda não possui itens detalhados vinculados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Cliente e destino
            </h2>
            <div className="mt-4 space-y-4">
              <InfoCard label="Cliente" value={order.customer} />
              <InfoCard label="Documento" value={order.customerDocument} />
              <InfoCard label="Destino" value={order.destination} />
              <InfoCard label="Transportadora" value={order.carrierName} />
              <InfoCard label="Serviço de entrega" value={order.shippingService} />
              <InfoCard label="Código de rastreio" value={order.trackingCode} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Insumos do pedido
            </h2>
            <div className="mt-4 space-y-3">
              <InfoCard label="Custo total dos insumos" value={order.suppliesTotalCost} />

              {order.supplies.length ? (
                <div className="space-y-3">
                  {order.supplies.map((supply) => (
                    <div
                      key={supply.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {supply.label}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {supply.description || "Sem descrição complementar"}
                          </p>
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            Quantidade: {supply.quantity} • Custo unitário: {supply.unitCost}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {supply.totalCost}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhum insumo foi lançado neste pedido até o momento.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Anexos</h2>
            </div>

            <div className="mt-4">
              <ShippingXmlSyncPanel
                orderId={order.id}
                xmlPending={Boolean(xmlPending)}
                isBlingOrder={isBlingOrder}
              />
            </div>

            <div className="mt-4">
              <ShippingMercadoLivreSyncPanel
                orderId={order.id}
                isMercadoLivreOrder={isMercadoLivreOrder}
                hasPendingLabel={Boolean(labelPending)}
                hasTrackingCode={hasTrackingCode}
              />
            </div>

            <div className="mt-4">
              <ShippingGeneratedLabelPanel orderId={order.id} />
            </div>

            <div className="mt-4">
              <ShippingDanfePanel orderId={order.id} />
            </div>

            <div className="mt-4 space-y-3">
              {order.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {attachment.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {attachment.help}
                      </p>
                      {attachment.fileName ? (
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          {attachment.fileName}
                          {attachment.uploadedAt ? ` • ${attachment.uploadedAt}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          attachment.status === "DISPONIVEL"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                        }`}
                      >
                        {attachment.status === "DISPONIVEL" ? "Disponível" : "Pendente"}
                      </span>
                      {attachment.viewHref && attachment.href ? (
                        <ShippingAttachmentPreviewDialog
                          label={attachment.label}
                          viewHref={attachment.viewHref}
                          downloadHref={attachment.href}
                        />
                      ) : null}
                      {attachment.href ? (
                        <Link
                          href={attachment.href}
                          target="_blank"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Baixar
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {canUploadAttachments ? (
              <ShippingAttachmentUploadPanel
                depositanteId={order.depositanteId}
                pedidoExpedicaoId={order.id}
              />
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Observações
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
              {order.notes}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
