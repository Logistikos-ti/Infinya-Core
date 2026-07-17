"use client";

import { Download, Printer, ReceiptText } from "lucide-react";
import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";

type ShippingDanfePanelProps = {
  orderId: string;
};

export function ShippingDanfePanel({ orderId }: ShippingDanfePanelProps) {
  const previewHref = `/api/expedicao/${orderId}/danfe-simplificada?disposition=inline`;
  const downloadHref = `/api/expedicao/${orderId}/danfe-simplificada`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">DANFE simplificada</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Gera um PDF resumido da NF-e a partir do XML anexado ao pedido, útil para conferência e acompanhamento do volume.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ShippingAttachmentPreviewDialog
            label="DANFE simplificada"
            viewHref={previewHref}
            downloadHref={downloadHref}
          />
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir DANFE
          </a>
          <a
            href={downloadHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar DANFE
          </a>
        </div>
      </div>
    </div>
  );
}
