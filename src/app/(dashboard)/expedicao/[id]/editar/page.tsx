import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ShippingAttachmentUploadPanel } from "@/components/shipping/shipping-attachment-upload-panel";
import { Button } from "@/components/ui/button";
import { requireRoleAccess } from "@/lib/auth";
import { SALES_CHANNEL_OPTIONS } from "@/lib/sales-channels";
import { getShippingOrderDetailFromDb } from "@/lib/shipping";
import { updateShippingOrderAction } from "@/app/(dashboard)/expedicao/actions";

type EditarShippingOrderPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

const statusOptions = [
  { value: "NOVO", label: "Novo" },
  { value: "EM_SEPARACAO", label: "Em separação" },
  { value: "SEPARADO", label: "Separado" },
  { value: "EM_CONFERENCIA", label: "Em conferência" },
  { value: "CONFERIDO", label: "Conferido" },
  { value: "PRONTO_ROMANEIO", label: "Pronto para romaneio" },
  { value: "EXPEDIDO", label: "Expedido" },
  { value: "CANCELADO", label: "Cancelado" },
];

export default async function EditarShippingOrderPage({
  params,
  searchParams,
}: EditarShippingOrderPageProps) {
  await requireRoleAccess(["ADMIN", "TI"]);
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const feedback = resolvedSearchParams?.feedback?.trim() ?? "";
  const order = await getShippingOrderDetailFromDb(id);

  if (!order) {
    notFound();
  }

  const isManualOrder = order.origin === "MANUAL";

  return (
    <div className="space-y-6">
      <Link
        href={`/expedicao/${order.id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para o pedido
      </Link>

      <ModulePageHeader
        title={`Editar pedido ${order.externalNumber}`}
        description="Ajuste dados operacionais do pedido sem perder o histórico de integração."
        badge="Administração"
      />

      {feedback === "erro" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Não foi possível salvar o pedido. Revise os dados e tente novamente.
        </div>
      ) : null}

      {feedback === "status-invalido" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          O status informado não é válido para a expedição.
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <form
          action={updateShippingOrderAction}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <input type="hidden" name="id" value={order.id} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Status">
              <select
                name="status"
                defaultValue={order.status}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Depositante">
              <input
                value={order.depositante}
                disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 outline-none"
              />
            </Field>

            <Field label="Número do pedido">
              <input
                name="numeroPedido"
                defaultValue={order.externalNumber === order.code ? "" : order.externalNumber}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Número da loja">
              <input
                name="numeroLoja"
                defaultValue={order.storeNumber === "-" ? "" : order.storeNumber}
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Canal de venda">
              <select
                name="salesChannelCode"
                defaultValue={order.salesChannelCode ?? ""}
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">Selecione</option>
                {SALES_CHANNEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nome da loja (se outro canal)">
              <input
                name="customStoreName"
                defaultValue={
                  isManualOrder &&
                  order.salesChannelCode === "OUTRO" &&
                  order.storeDisplay !== "Loja não identificada"
                    ? order.storeDisplay
                    : ""
                }
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>

            <Field label="Pedido Mercado Livre">
              <input
                name="mercadoLivreOrderId"
                defaultValue={order.mercadoLivreOrderId ?? ""}
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>

            <Field label="Envio Mercado Livre">
              <input
                name="mercadoLivreShipmentId"
                defaultValue={order.mercadoLivreShipmentId ?? ""}
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>

            <Field label="Cliente">
              <input
                name="clienteNome"
                defaultValue={order.customer === "Cliente não informado" ? "" : order.customer}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Documento">
              <input
                name="clienteDocumento"
                defaultValue={order.customerDocument === "-" ? "" : order.customerDocument}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Cidade">
              <input
                name="clienteCidade"
                defaultValue={extractCity(order.destination)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="UF">
              <input
                name="clienteUf"
                defaultValue={extractUf(order.destination)}
                maxLength={2}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm uppercase text-slate-700 outline-none"
              />
            </Field>

            <Field label="Previsão de envio">
              <input
                type="date"
                name="previsaoEnvioEm"
                defaultValue={normalizeDateInput(order.shipDate)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Canal">
              <input
                value={order.channel}
                disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 outline-none"
              />
            </Field>

            <Field label="Marketplace">
              <input
                value={order.marketplace}
                disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 outline-none"
              />
            </Field>

            <Field label="Transportadora">
              <input
                name="carrierName"
                defaultValue={order.carrierName === "Transportadora não informada" ? "" : order.carrierName}
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>

            <Field label="Serviço de entrega">
              <input
                name="shippingService"
                defaultValue={order.shippingService === "Serviço não informado" ? "" : order.shippingService}
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>

            <Field label="Código de rastreio">
              <input
                name="trackingCode"
                defaultValue={order.trackingCode === "Rastreio não informado" ? "" : order.trackingCode}
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>

            <Field label="Número da nota fiscal">
              <input
                name="invoiceNumber"
                defaultValue={order.invoice === "Ainda não vinculada" ? "" : order.invoice}
                disabled={!isManualOrder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>
          </div>

          <Field label="Observações" className="mt-4">
            <textarea
              name="observacoes"
              defaultValue={order.notes === "Sem observações." ? "" : order.notes}
              rows={5}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
            />
          </Field>

          <div className="mt-6 flex justify-end">
            <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800">
              <Save className="h-4 w-4" />
              Salvar pedido
            </Button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Resumo atual</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-900">Origem:</span> {order.origin}
              </p>
              <p>
                <span className="font-medium text-slate-900">Loja comercial:</span> {order.storeDisplay}
              </p>
              <p>
                <span className="font-medium text-slate-900">Marketplace:</span> {order.marketplace}
              </p>
              <p>
                <span className="font-medium text-slate-900">Status atual:</span> {order.statusLabel}
              </p>
              <p>
                <span className="font-medium text-slate-900">Valor total:</span> {order.total}
              </p>
              <p>
                <span className="font-medium text-slate-900">Itens:</span> {order.itemCount}
              </p>
              <p>
                <span className="font-medium text-slate-900">Unidades:</span> {order.units}
              </p>
              <p>
                <span className="font-medium text-slate-900">Última sincronização:</span>{" "}
                {order.syncedAt}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Itens vinculados</h2>
            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.code} • {item.sku} • {item.quantity} {item.unit}
                  </p>
                </div>
              ))}
              {!order.items.length ? (
                <p className="text-sm text-slate-500">Nenhum item detalhado neste pedido.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Anexos do pedido</h2>
            <p className="mt-2 text-sm text-slate-600">
              Use esta área para anexar XML da nota fiscal e etiqueta, principalmente nos pedidos manuais.
            </p>
            <ShippingAttachmentUploadPanel
              depositanteId={order.depositanteId}
              pedidoExpedicaoId={order.id}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function extractCity(destination: string) {
  if (!destination || destination === "Destino não informado") {
    return "";
  }

  return destination.split(" - ")[0] ?? "";
}

function extractUf(destination: string) {
  if (!destination || destination === "Destino não informado") {
    return "";
  }

  return destination.split(" - ")[1] ?? "";
}

function normalizeDateInput(value: string) {
  if (!value || value === "Sem previsão") {
    return "";
  }

  const [day, month, year] = value.split("/");

  if (!day || !month || !year) {
    return "";
  }

  return `${year}-${month}-${day}`;
}
