"use client";

import { useState } from "react";
import { Download, Eye, X } from "lucide-react";

type ShippingAttachmentPreviewDialogProps = {
  label: string;
  viewHref: string;
  downloadHref: string;
};

export function ShippingAttachmentPreviewDialog({
  label,
  viewHref,
  downloadHref,
}: ShippingAttachmentPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const isLabelPreview = label.toLocaleLowerCase("pt-BR").includes("etiqueta");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Eye className="h-3.5 w-3.5" />
        Visualizar
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div
            className={`flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950 ${
              isLabelPreview ? "max-w-4xl h-[76vh]" : "max-w-6xl h-[88vh]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visualização do documento sem sair do pedido.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={downloadHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar arquivo
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                  Fechar
                </button>
              </div>
            </div>

            <div className={`min-h-0 flex-1 bg-slate-100 dark:bg-slate-900 ${isLabelPreview ? "p-3" : ""}`}>
              <iframe
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
