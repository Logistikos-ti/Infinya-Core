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
          className="group flex min-h-[94px] w-full flex-col items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 text-center transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ReceiptText className="h-5 w-5" />
          </span>
          <span className="text-[13px] font-bold leading-tight text-slate-800 dark:text-zinc-100">DANFE simplificada</span>
        </button>
      )}
    />
  );
}
