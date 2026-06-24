"use client";

import { Download, ReceiptText } from "lucide-react";

type ShippingDanfePanelProps = {
  orderId: string;
};

export function ShippingDanfePanel({ orderId }: ShippingDanfePanelProps) {
  const previewHref = `/api/expedicao/${orderId}/danfe-simplificada?disposition=inline`;
  const downloadHref = `/api/expedicao/${orderId}/danfe-simplificada`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-950">DANFE simplificada</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Gera um PDF resumido da NF-e a partir do XML anexado ao pedido, útil para conferência e acompanhamento do volume.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={previewHref}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            Visualizar DANFE
          </a>
          <a
            href={downloadHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar DANFE
          </a>
        </div>
      </div>
    </div>
  );
}
