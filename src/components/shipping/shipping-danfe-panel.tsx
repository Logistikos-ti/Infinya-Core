"use client";

import { ReceiptText } from "lucide-react";
import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";

type ShippingDanfePanelProps = {
  orderId: string;
};

export function ShippingDanfePanel({ orderId }: ShippingDanfePanelProps) {
  const previewHref = `/api/expedicao/${orderId}/danfe-simplificada?disposition=inline`;
  const downloadHref = `/api/expedicao/${orderId}/danfe-simplificada`;

  return (
    <ShippingAttachmentPreviewDialog
      label="DANFE simplificada"
      viewHref={previewHref}
      downloadHref={downloadHref}
      printLabel="Imprimir"
      downloadLabel="Baixar"
      customTrigger={(openPreview) => (
        <button
          type="button"
          onClick={openPreview}
          className="group flex min-h-[96px] w-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:bg-slate-50 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/90 dark:hover:border-violet-500/40 dark:hover:bg-zinc-800/80"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-transform group-hover:scale-105">
            <ReceiptText className="h-5 w-5" />
          </span>
          <span className="text-sm font-bold leading-tight text-slate-800 dark:text-zinc-100">DANFE simplificada</span>
        </button>
      )}
    />
  );
}
