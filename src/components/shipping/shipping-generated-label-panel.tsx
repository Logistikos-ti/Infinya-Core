"use client";

import { Download, FileText, Printer } from "lucide-react";

type ShippingGeneratedLabelPanelProps = {
  orderId: string;
};

export function ShippingGeneratedLabelPanel({
  orderId,
}: ShippingGeneratedLabelPanelProps) {
  const pdfPreviewHref = `/api/expedicao/${orderId}/etiqueta?format=PDF&disposition=inline`;
  const pdfDownloadHref = `/api/expedicao/${orderId}/etiqueta?format=PDF`;
  const zplDownloadHref = `/api/expedicao/${orderId}/etiqueta?format=ZPL`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-950">Etiqueta de transporte do WMS</h3>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Gere uma etiqueta operacional padrão em PDF para impressão ou em ZPL para impressora térmica.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={pdfPreviewHref}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <FileText className="h-3.5 w-3.5" />
            Visualizar PDF
          </a>
          <a
            href={pdfDownloadHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar PDF
          </a>
          <a
            href={zplDownloadHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar ZPL
          </a>
        </div>
      </div>
    </div>
  );
}
