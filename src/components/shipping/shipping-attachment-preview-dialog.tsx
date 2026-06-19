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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
      >
        <Eye className="h-3.5 w-3.5" />
        Visualizar
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{label}</h3>
                <p className="text-xs text-slate-500">Visualização do anexo fiscal sem sair do pedido.</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={downloadHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Fechar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 bg-slate-100">
              <iframe
                src={viewHref}
                title={label}
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
