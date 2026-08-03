"use client";

import type { ReactNode } from "react";
import { useState, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { FileCheck2, FileText, Package2, Paperclip, Printer, Route, X } from "lucide-react";
import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";
import { ShippingAttachmentUploadPanel } from "@/components/shipping/shipping-attachment-upload-panel";
import { ShippingDanfePanel } from "@/components/shipping/shipping-danfe-panel";
import type { ShippingAttachment } from "@/lib/shipping";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

type ShippingConferenceDocumentsPanelProps = {
  orderId: string;
  depositanteId: string;
  attachments: ShippingAttachment[];
  canUploadAttachments: boolean;
  unlocked: boolean;
  formId: string;
};

export type ShippingConferenceDocumentsPanelRef = {
  openPreparationModal: () => void;
};

export const ShippingConferenceDocumentsPanel = forwardRef<
  ShippingConferenceDocumentsPanelRef,
  ShippingConferenceDocumentsPanelProps
>(function ShippingConferenceDocumentsPanel(
  { orderId, depositanteId, attachments, canUploadAttachments, unlocked, formId },
  ref
) {
  const [confirmReleaseWithoutRomaneio, setConfirmReleaseWithoutRomaneio] = useState(false);
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [danfeScanCode, setDanfeScanCode] = useState("");
  const [labelScanCode, setLabelScanCode] = useState("");
  const [danfeValidation, setDanfeValidation] = useState<{
    valid: boolean;
    noteNumber: string | null;
    recipientName: string | null;
    message: string;
  }>({ valid: false, noteNumber: null, recipientName: null, message: "" });
  const [validatingDanfe, setValidatingDanfe] = useState(false);
  const [confirmMissingLabel, setConfirmMissingLabel] = useState(false);
  const [attachmentUploadOpen, setAttachmentUploadOpen] = useState(false);
  const [printMessage, setPrintMessage] = useState("");
  const xmlAttachment = (attachments || []).find((attachment) => attachment?.kind === "XML_NF");
  const labelAttachment = (attachments || []).find((attachment) => attachment?.kind === "ETIQUETA");
  const hasInvoiceXml = xmlAttachment?.status === "DISPONIVEL";
  const hasShippingLabel = labelAttachment?.status === "DISPONIVEL";

  useImperativeHandle(ref, () => ({
    openPreparationModal: () => {
      setPreparationOpen(true);
    },
  }));

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
    const printWindow = window.open(href, "_blank", "width=900,height=700");
    if (!printWindow) {
      setPrintMessage("O navegador bloqueou a janela. Permita pop-ups para este site e tente novamente.");
      return;
    }
    setPrintMessage("");
    window.setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.focus();
        printWindow.print();
      }
    }, 2200);
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
      className="overflow-hidden rounded-[18px] border border-slate-200 bg-white/80 shadow-sm backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/80 animate-[docExpand_0.4s_cubic-bezier(.3,1,.4,1)]"
    >
      <input type="hidden" name="danfeScanCode" value={danfeScanCode} form={formId} readOnly />
      <input type="hidden" name="semEtiquetaConfirmada" value={confirmMissingLabel ? "true" : "false"} form={formId} readOnly />
      
      <div className="hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-violet-500/10 text-violet-500">
          <Paperclip className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <h3 className="font-['Space_Grotesk'] text-[16px] font-bold text-slate-950 dark:text-white">
            Documentos e impressão
          </h3>
          <p className="text-[13px] leading-[1.45] text-slate-500 dark:text-zinc-400">
            Revise os documentos e libere obrigatoriamente o pedido para romaneio.
          </p>
        </div>

        <span
          className={`shrink-0 rounded-[10px] px-3 py-[6px] text-center text-[11px] font-extrabold tracking-[0.03em] leading-[1.3] ${
            unlocked
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {unlocked ? "DOCUMENTOS LIBERADOS" : "LIBERA APÓS 100%"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-[18px_22px_22px_22px] sm:grid-cols-4">
        <div className="contents">
          <AttachmentStatusCard
          title="Nota fiscal"
          subtitle="XML anexado ao pedido para consulta e impressão fiscal."
          icon={<FileCheck2 className="h-4 w-4" />}
          iconColor="text-blue-500"
          attachment={xmlAttachment}
          emptyLabel="NF pendente"
          printLabel="Imprimir NF"
          downloadLabel="Baixar NF"
          unlocked={unlocked}
          onMissingDocument={() => setAttachmentUploadOpen(true)}
          badgeBg="bg-blue-500/10"
          badgeText="text-blue-600 dark:text-blue-400"
        />

        <AttachmentStatusCard
          title="Etiqueta de envio"
          subtitle="Etiqueta operacional do marketplace ou anexada manualmente."
          icon={<Package2 className="h-4 w-4" />}
          iconColor="text-emerald-500"
          attachment={labelAttachment}
          emptyLabel="Etiqueta pendente"
          printLabel="Imprimir etiqueta"
          downloadLabel="Baixar etiqueta"
          unlocked={unlocked}
          onMissingDocument={() => setAttachmentUploadOpen(true)}
          badgeBg="bg-emerald-500/10"
          badgeText="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="contents">
        <div className="h-full">
          <ShippingDanfePanel orderId={orderId} />
        </div>

        <div className="hidden">
          {canUploadAttachments ? (
            <div className="hidden">
              <div className="flex items-center gap-2.5">
                <span className="flex text-amber-500">
                  <FileText className="h-4 w-4" />
                </span>
                <h4 className="flex-1 text-[14px] font-bold text-slate-900 dark:text-white">
                  Anexar documentos
                </h4>
              </div>
              <p className="text-[12.5px] leading-[1.45] text-slate-500 dark:text-slate-400">
                Anexe manualmente o XML da NF ou a etiqueta quando o pedido não vier completo pela integração.
              </p>
              <ShippingAttachmentUploadPanel
                depositanteId={depositanteId}
                pedidoExpedicaoId={orderId}
              />
            </div>
          ) : null}
        </div>
      </div>

      {canUploadAttachments ? (
        <DocumentActionButton icon={<Paperclip className="h-5 w-5" />} label="Anexar documentos" onClick={() => setAttachmentUploadOpen(true)} />
      ) : null}

      <div className="col-span-full flex flex-wrap items-center gap-4 rounded-[14px] border border-slate-200 bg-slate-50 p-[16px_18px] dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex flex-1 min-w-[160px] items-center gap-4">
          <span className="flex text-violet-500">
            <Route className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-[2px]">
            <h4 className="text-[14px] font-bold text-slate-900 dark:text-white">
              Destinação do pedido
            </h4>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">{releaseHelp}</p>
          </div>
        </div>
      </div>
      </div>

      {attachmentUploadOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                  <Paperclip className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="font-['Space_Grotesk'] text-[17px] font-bold text-slate-950 dark:text-white">Anexar documentos</h4>
                  <p className="text-[13px] text-slate-500 dark:text-zinc-400">Escolha o tipo de documento e envie o arquivo.</p>
                </div>
              </div>
              <button type="button" onClick={() => setAttachmentUploadOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <ShippingAttachmentUploadPanel depositanteId={depositanteId} pedidoExpedicaoId={orderId} />
            </div>
          </div>
        </div>, document.body
      ) : null}

      {preparationOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h4 className="text-lg font-bold text-slate-950 dark:text-white">Preparar para romaneio</h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
              A DANFE foi aberta para impressão. Bipe agora o código de barras da DANFE simplificada para confirmar a NF e o destinatário.
            </p>
            {!hasInvoiceXml ? (
              <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                O XML da nota fiscal ainda não está disponível. Anexe o XML no card de documentos antes da liberação final para o romaneio.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openForPrinting(danfeHref);
                }}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700"
              >
                <Printer className="h-4 w-4" />
                Imprimir DANFE
              </button>
              {hasShippingLabel ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openForPrinting(labelHref);
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir etiqueta
                </button>
              ) : null}
            </div>
            {printMessage ? (
              <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                {printMessage}
              </p>
            ) : null}
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
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void validateDanfe();
                }}
                disabled={validatingDanfe || !danfeScanCode.trim()}
                className="h-12 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {validatingDanfe ? <MobileButtonSpinner size={20} /> : "Validar"}
              </button>
            </div>
            {danfeValidation.message ? (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${danfeValidation.valid ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
                {danfeValidation.message}
              </div>
            ) : null}
            {danfeValidation.valid ? (
              <div className="mt-4 flex flex-col gap-4">
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-zinc-900">
                  <p className="font-bold text-slate-900 dark:text-white">NF {danfeValidation.noteNumber}</p>
                  <p className="mt-1 text-slate-600 dark:text-zinc-300">Destinatário: {danfeValidation.recipientName}</p>
                </div>
                {hasShippingLabel ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Etiqueta de envio</p>
                    <p className="text-sm text-slate-600 dark:text-zinc-300 mb-1">
                      Bipe a etiqueta de envio do pedido para confirmar.
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={labelScanCode}
                        onChange={(event) => setLabelScanCode(event.target.value)}
                        placeholder="Bipe a etiqueta..."
                        className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                    <p className="font-bold text-amber-700 dark:text-amber-300">Etiqueta ausente</p>
                    <p className="mt-1 text-amber-600 dark:text-amber-400">Este pedido não possui etiqueta de envio anexada. O pedido será liberado sem etiqueta.</p>
                  </div>
                )}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPreparationOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">
                Cancelar
              </button>
              {danfeValidation.valid && (!hasShippingLabel || labelScanCode.trim().length >= 5) ? (
                <button type="submit" form={formId} name="intent" value="release-romaneio" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">
                  Confirmar e liberar
                </button>
              ) : null}
            </div>
          </div>
        </div>, document.body
      ) : null}

      {confirmMissingLabel && typeof document !== "undefined" ? createPortal(
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
              <button type="submit" form={formId} name="intent" value="release-romaneio" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
                Confirmar e liberar
              </button>
            </div>
          </div>
        </div>, document.body
      ) : null}

      {confirmReleaseWithoutRomaneio && typeof document !== "undefined" ? createPortal(
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
        </div>, document.body
      ) : null}
    </div>
  );
});

function AttachmentStatusCard({
  title,
  subtitle,
  icon,
  attachment,
  emptyLabel,
  printLabel,
  downloadLabel,
  iconColor,
  badgeBg,
  badgeText,
  unlocked,
  onMissingDocument,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconColor: string;
  attachment?: ShippingAttachment;
  emptyLabel: string;
  printLabel: string;
  downloadLabel: string;
  unlocked: boolean;
  badgeBg: string;
  badgeText: string;
  onMissingDocument: () => void;
}) {
  const available = attachment?.status === "DISPONIVEL";
  void subtitle;
  void emptyLabel;
  void iconColor;
  void badgeBg;
  void badgeText;

  if (unlocked && attachment?.viewHref && attachment.href) {
    return (
      <ShippingAttachmentPreviewDialog
        label={attachment.label}
        viewHref={attachment.viewHref}
        downloadHref={attachment.href}
        printLabel={printLabel}
        downloadLabel={downloadLabel}
        customTrigger={(openPreview) => (
          <DocumentActionButton icon={icon} label={title} available={available} onClick={openPreview} />
        )}
      />
    );
  }

  return <DocumentActionButton icon={icon} label={title} available={available} onClick={onMissingDocument} />;

  /* Legacy detailed card retained here for patch safety.
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-start gap-2.5">
        <span className={`flex ${iconColor}`}>{icon}</span>
        <span className="flex-1 text-[14px] font-bold text-slate-900 dark:text-white">{title}</span>
        <span
          className={`rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold leading-[1.25] tracking-wide ${
            available
              ? `${badgeBg} ${badgeText}`
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {available ? "Disponível" : emptyLabel}
        </span>
      </div>

      <span className="text-[12.5px] leading-[1.45] text-slate-500 dark:text-slate-400">
        {subtitle}
      </span>

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
  */
}

function DocumentActionButton({
  icon,
  label,
  available = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  available?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[94px] flex-col items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 text-center transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/10"
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${available ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-violet-500/10 text-violet-600 dark:text-violet-400"}`}>
        {icon}
      </span>
      <span className="text-[13px] font-bold leading-tight text-slate-800 dark:text-zinc-100">{label}</span>
    </button>
  );
}
