"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Download, FileCheck2, FileText, Package2, Paperclip, Printer, Route } from "lucide-react";
import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";
import { ShippingAttachmentUploadPanel } from "@/components/shipping/shipping-attachment-upload-panel";
import { ShippingDanfePanel } from "@/components/shipping/shipping-danfe-panel";
import type { ShippingAttachment } from "@/lib/shipping";

type ShippingConferenceDocumentsPanelProps = {
  orderId: string;
  depositanteId: string;
  attachments: ShippingAttachment[];
  canUploadAttachments: boolean;
  unlocked: boolean;
  formId?: string;
};

export function ShippingConferenceDocumentsPanel({
  orderId,
  depositanteId,
  attachments,
  canUploadAttachments,
  unlocked,
  formId = "shipping-conference-form",
}: ShippingConferenceDocumentsPanelProps) {
  const [confirmReleaseWithoutRomaneio, setConfirmReleaseWithoutRomaneio] = useState(false);
  const xmlAttachment = attachments.find((attachment) => attachment.kind === "XML_NF");
  const labelAttachment = attachments.find((attachment) => attachment.kind === "ETIQUETA");
  const hasInvoiceXml = xmlAttachment?.status === "DISPONIVEL";
  const hasShippingLabel = labelAttachment?.status === "DISPONIVEL";
  const canReleaseToRomaneio = unlocked && hasInvoiceXml && hasShippingLabel;

  const releaseHelp = !unlocked
    ? "Finalize 100% da conferência para liberar o pedido."
    : !hasInvoiceXml
      ? "Anexe o XML da nota fiscal antes de enviar para romaneio."
      : !hasShippingLabel
        ? "Anexe a etiqueta de envio antes de enviar para romaneio."
        : "Pedido pronto para destinação final.";

  return (
    <div
      id="documentos-impressao"
      className="space-y-5 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/80"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Documentos e impressão
            </h3>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            Depois da bipagem, revise os documentos e escolha obrigatoriamente se o pedido seguirá para romaneio ou será liberado sem romaneio.
          </p>
        </div>

        <span
          className={`inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
            unlocked
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          {unlocked ? "Destinação liberada" : "Libera após 100% da conferência"}
        </span>
      </div>

      {!unlocked ? (
        <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
          Finalize a bipagem de todos os itens para liberar a NF, a DANFE simplificada, a etiqueta e a destinação final do pedido.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <AttachmentStatusCard
          title="Nota fiscal"
          subtitle="XML anexado ao pedido para consulta e impressão fiscal."
          icon={<FileCheck2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
          attachment={xmlAttachment}
          emptyLabel="NF pendente"
          printLabel="Imprimir NF"
          unlocked={unlocked}
        />

        <AttachmentStatusCard
          title="Etiqueta de envio"
          subtitle="Etiqueta operacional do marketplace ou anexada manualmente."
          icon={<Package2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
          attachment={labelAttachment}
          emptyLabel="Etiqueta pendente"
          printLabel="Imprimir etiqueta"
          unlocked={unlocked}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <ShippingDanfePanel orderId={orderId} />
        </div>

        <div className="space-y-4">
          {canUploadAttachments ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                  Anexar documentos do pedido
                </h4>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Use esta área para anexar manualmente o XML da NF ou a etiqueta de envio quando o pedido não vier completo pela integração.
              </p>
              <ShippingAttachmentUploadPanel
                depositanteId={depositanteId}
                pedidoExpedicaoId={orderId}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                Destinação do pedido
              </h4>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{releaseHelp}</p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="submit"
              form={formId}
              name="intent"
              value="release-romaneio"
              disabled={!canReleaseToRomaneio}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              <Route className="h-4 w-4" />
              Liberar para romaneio
            </button>

            <button
              type="button"
              disabled={!unlocked}
              onClick={() => setConfirmReleaseWithoutRomaneio(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600"
            >
              <FileCheck2 className="h-4 w-4" />
              Liberar sem romaneio
            </button>
          </div>
        </div>
      </div>

      {confirmReleaseWithoutRomaneio ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h4 className="text-lg font-bold text-slate-950 dark:text-white">
              Liberar pedido sem romaneio?
            </h4>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              Essa ação mantém o pedido como <strong>Conferido</strong>, mas o libera fora do fluxo de romaneio.
              Use somente quando a operação não precisar consolidar esse pedido em romaneio.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmReleaseWithoutRomaneio(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                form={formId}
                name="intent"
                value="release-sem-romaneio"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                Confirmar liberação
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AttachmentStatusCard({
  title,
  subtitle,
  icon,
  attachment,
  emptyLabel,
  printLabel,
  unlocked,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  attachment?: ShippingAttachment;
  emptyLabel: string;
  printLabel: string;
  unlocked: boolean;
}) {
  const available = attachment?.status === "DISPONIVEL";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-100">{title}</h4>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
          {attachment?.fileName ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {attachment.fileName}
              {attachment.uploadedAt ? ` • ${attachment.uploadedAt}` : ""}
            </p>
          ) : null}
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            available
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
          }`}
        >
          {available ? "Disponível" : emptyLabel}
        </span>
      </div>

      {unlocked && attachment?.viewHref && attachment.href ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ShippingAttachmentPreviewDialog
            label={attachment.label}
            viewHref={attachment.viewHref}
            downloadHref={attachment.href}
          />
          <a
            href={attachment.viewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" />
            {printLabel}
          </a>
          <a
            href={attachment.href}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar
          </a>
        </div>
      ) : null}
    </div>
  );
}
