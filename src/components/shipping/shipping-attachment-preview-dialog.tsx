"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, Printer, X } from "lucide-react";

type ShippingAttachmentPreviewDialogProps = {
  label: string;
  viewHref: string;
  downloadHref: string;
  printLabel?: string;
  downloadLabel?: string;
};

export function ShippingAttachmentPreviewDialog({
  label,
  viewHref,
  downloadHref,
  printLabel = "Imprimir",
  downloadLabel = "Baixar",
}: ShippingAttachmentPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isLabelPreview = label.toLocaleLowerCase("pt-BR").includes("etiqueta");

  const handlePrint = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) {
      return;
    }

    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  }, []);

  useEffect(() => {
    if (!open || !autoPrint) {
      return;
    }

    const timer = window.setTimeout(() => {
      handlePrint();
      setAutoPrint(false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [autoPrint, handlePrint, open]);

  const openPreview = () => {
    setAutoPrint(false);
    setOpen(true);
  };

  const openPrint = () => {
    setAutoPrint(true);
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={openPreview}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Eye className="h-3.5 w-3.5" />
          Visualizar
        </button>

        <button
          type="button"
          onClick={openPrint}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Printer className="h-3.5 w-3.5" />
          {printLabel}
        </button>

        <a
          href={downloadHref}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5" />
          {downloadLabel}
        </a>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div
            className={`flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950 ${
              isLabelPreview ? "h-[72vh] max-w-4xl" : "h-[88vh] max-w-6xl"
            }`}
          >
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visualização do documento sem sair do pedido.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {printLabel}
                </button>
                <a
                  href={downloadHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadLabel}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setAutoPrint(false);
                    setOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                  Fechar
                </button>
              </div>
            </div>

            <div className={`min-h-0 flex-1 bg-slate-100 dark:bg-slate-900 ${isLabelPreview ? "p-2 sm:p-3" : ""}`}>
              <iframe
                ref={iframeRef}
                src={viewHref}
                title={label}
                className={`border-0 bg-white ${isLabelPreview ? "mx-auto h-full w-full rounded-xl" : "h-full w-full"}`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
