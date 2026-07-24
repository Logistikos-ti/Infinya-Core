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
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center gap-2.5">
        <span className="flex text-fuchsia-500">
          <ReceiptText className="h-4 w-4" />
        </span>
        <h3 className="flex-1 text-[14px] font-bold text-slate-900 dark:text-white">
          DANFE simplificada
        </h3>
      </div>
      <p className="text-[12.5px] leading-[1.45] text-slate-500 dark:text-slate-400">
        Gera um PDF resumido da NF-e a partir do XML anexado ao pedido, útil para conferência e acompanhamento do volume.
      </p>

      <div className="mt-0.5 flex flex-wrap gap-2">
        <ShippingAttachmentPreviewDialog
          label="DANFE simplificada"
          viewHref={previewHref}
          downloadHref={downloadHref}
          printLabel="Imprimir"
          downloadLabel="Baixar"
        />
      </div>
    </div>
  );
}
