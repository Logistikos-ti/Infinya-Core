"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { FileCheck2, FileText, Package2, Paperclip, Route } from "lucide-react";
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
  formId: string;
};

export function ShippingConferenceDocumentsPanel({
  orderId,
  depositanteId,
  attachments,
  canUploadAttachments,
  unlocked,
  formId,
}: ShippingConferenceDocumentsPanelProps) {
  const [confirmReleaseWithoutRomaneio, setConfirmReleaseWithoutRomaneio] = useState(false);
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [danfeScanCode, setDanfeScanCode] = useState("");
  const [danfeValidation, setDanfeValidation] = useState<{
    valid: boolean;
    noteNumber: string | null;
    recipientName: string | null;
    message: string;
  }>({ valid: false, noteNumber: null, recipientName: null, message: "" });
  const [validatingDanfe, setValidatingDanfe] = useState(false);
  const [confirmMissingLabel, setConfirmMissingLabel] = useState(false);
  const xmlAttachment = attachments.find((attachment) => attachment.kind === "XML_NF");
  const labelAttachment = attachments.find((attachment) => attachment.kind === "ETIQUETA");
  const hasInvoiceXml = xmlAttachment?.status === "DISPONIVEL";
  const hasShippingLabel = labelAttachment?.status === "DISPONIVEL";
  const canReleaseToRomaneio = unlocked && hasInvoiceXml && danfeValidation.valid;

  const releaseHelp = !unlocked
    ? "Finalize 100% da conferência para liberar o pedido."
    : !hasInvoiceXml
      ? "Anexe o XML da nota fiscal antes de enviar para romaneio."
      : !danfeValidation.valid
        ? "Prepare a expedição e bipe a DANFE simplificada para validar o pedido."
        : !hasShippingLabel
          ? "DANFE validada. A etiqueta está ausente e exigirá confirmação antes da liberação."
        : "Pedido pronto para destinação final.";

  const danfeHref = `/api/expedicao/${orderId}/danfe-simplificada?disposition=inline`;
  const labelHref = `/api/expedicao/${orderId}/anexos/etiqueta?disposition=inline`;

  function openForPrinting(href: string) {
    const printWindow = window.open(href, "_blank", "noopener,noreferrer,width=900,height=700");
    if (!printWindow) return;
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 1500);
  }

  async function validateDanfe() {
    if (!danfeScanCode.trim()) return;
    setValidatingDanfe(true);
    try {
      const response = await fetch(`/api/expedicao/${orderId}/danfe-validacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: danfeScanCode }),
      });
      const result = await response.json();
      setDanfeValidation({
        valid: Boolean(result.valid),
        noteNumber: result.noteNumber ?? null,
        recipientName: result.recipientName ?? null,
        message: result.message ?? "Não foi possível validar a DANFE.",
      });
    } catch {
      setDanfeValidation({ valid: false, noteNumber: null, recipientName: null, message: "Falha de comunicação ao validar a DANFE." });
    } finally {
      setValidatingDanfe(false);
    }
  }

  return (
    <div
      id="documentos-impressao"
      className="space-y-5 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/80"
    >
      <input type="hidden" name="danfeScanCode" value={danfeScanCode} form={formId} readOnly />
      <input type="hidden" name="semEtiquetaConfirmada" value={confirmMissingLabel ? "true" : "false"} form={formId} readOnly />
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Documentos e impressão
            </h3>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            Depois da bipagem, revise os documentos e libere obrigatoriamente o pedido para romaneio.
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
          Finalize a bipagem de todos os itens para liberar a NF, a DANFE simplificada, a etiqueta
          e a destinação final do pedido.
        </div>
      ) : null}

      <div className="grid gap-4 2xl:grid-cols-2">
        <AttachmentStatusCard
          title="Nota fiscal"
          subtitle="XML anexado ao pedido para consulta e impressão fiscal."
          icon={<FileCheck2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
          attachment={xmlAttachment}
          emptyLabel="NF pendente"
          printLabel="Imprimir NF"
          downloadLabel="Baixar NF"
          unlocked={unlocked}
        />

        <AttachmentStatusCard
          title="Etiqueta de envio"
          subtitle="Etiqueta operacional do marketplace ou anexada manualmente."
          icon={<Package2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
          attachment={labelAttachment}
          emptyLabel="Etiqueta pendente"
          printLabel="Imprimir etiqueta"
          downloadLabel="Baixar etiqueta"
          unlocked={unlocked}
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
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
                Use esta área para anexar manualmente o XML da NF ou a etiqueta de envio quando o
                pedido não vier completo pela integração.
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
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
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
              type="button"
              disabled={!unlocked || !hasInvoiceXml}
              onClick={() => {
                setPreparationOpen(true);
                openForPrinting(danfeHref);
                if (hasShippingLabel) openForPrinting(labelHref);
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary-500/30 bg-primary-500/10 px-4 text-sm font-semibold text-primary-700 transition hover:bg-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-300"
            >
              Preparar para romaneio
            </button>
            <button
              type="submit"
              form={formId}
              name="intent"
              value="release-romaneio"
              disabled={!canReleaseToRomaneio}
              onClick={(event) => {
                if (!hasShippingLabel) {
                  event.preventDefault();
                  setConfirmMissingLabel(true);
                }
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              <Route className="h-4 w-4" />
              {hasShippingLabel ? "Liberar para romaneio" : "Liberar sem etiqueta"}
            </button>

          </div>
        </div>
      </div>

      {preparationOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h4 className="text-lg font-bold text-slate-950 dark:text-white">Preparar para romaneio</h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
              A DANFE foi aberta para impressão. Bipe agora o código de barras da DANFE simplificada para confirmar a NF e o destinatário.
            </p>
            <div className="mt-5 flex gap-2">
              <input
                autoFocus
                value={danfeScanCode}
                onChange={(event) => setDanfeScanCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void validateDanfe();
                  }
                }}
                placeholder="Bipe a DANFE simplificada"
                className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => void validateDanfe()}
                disabled={validatingDanfe || !danfeScanCode.trim()}
                className="h-12 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {validatingDanfe ? "Validando..." : "Validar"}
              </button>
            </div>
            {danfeValidation.message ? (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${danfeValidation.valid ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
                {danfeValidation.message}
              </div>
            ) : null}
            {danfeValidation.valid ? (
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-zinc-900">
                <p className="font-bold text-slate-900 dark:text-white">NF {danfeValidation.noteNumber}</p>
                <p className="mt-1 text-slate-600 dark:text-zinc-300">Destinatário: {danfeValidation.recipientName}</p>
              </div>
            ) : null}
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setPreparationOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-zinc-700 dark:text-zinc-200">
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmMissingLabel ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-amber-500/30 bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <h4 className="text-lg font-bold text-slate-950 dark:text-white">Liberar sem etiqueta de envio?</h4>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              A DANFE foi validada, mas este pedido não possui etiqueta anexada. Confirme para enviar o pedido ao romaneio mesmo assim.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmMissingLabel(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-zinc-700 dark:text-zinc-200">
                Cancelar
              </button>
              <button type="submit" form={formId} name="intent" value="release-romaneio" onClick={() => setConfirmMissingLabel(false)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
                Confirmar e liberar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmReleaseWithoutRomaneio ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h4 className="text-lg font-bold text-slate-950 dark:text-white">
              Liberar pedido sem romaneio?
            </h4>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              Essa ação mantém o pedido como <strong>Conferido</strong>, mas o libera fora do fluxo
              de romaneio. Use somente quando a operação não precisar consolidar esse pedido em
              romaneio.
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
  downloadLabel,
  unlocked,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  attachment?: ShippingAttachment;
  emptyLabel: string;
  printLabel: string;
  downloadLabel: string;
  unlocked: boolean;
}) {
  const available = attachment?.status === "DISPONIVEL";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-100">{title}</h4>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
          {attachment?.fileName ? (
            <p className="mt-2 break-words text-xs text-slate-500 dark:text-slate-400">
              {attachment.fileName}
              {attachment.uploadedAt ? ` • ${attachment.uploadedAt}` : ""}
            </p>
          ) : null}
        </div>

        <span
          className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            available
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
          }`}
        >
          {available ? "Disponível" : emptyLabel}
        </span>
      </div>

      {unlocked && attachment?.viewHref && attachment.href ? (
        <div className="mt-4">
          <ShippingAttachmentPreviewDialog
            label={attachment.label}
            viewHref={attachment.viewHref}
            downloadHref={attachment.href}
            printLabel={printLabel}
            downloadLabel={downloadLabel}
          />
        </div>
      ) : null}
    </div>
  );
}
