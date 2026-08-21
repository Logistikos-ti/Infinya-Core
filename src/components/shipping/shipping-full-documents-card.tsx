"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  PackageCheck,
  Printer,
  ShieldCheck,
  Tags,
  Truck,
} from "lucide-react";
import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";

type FullDocument = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
  item: {
    id: string;
    nome: string;
    sku: string | null;
    ean: string | null;
    quantidade: number | string;
  } | null;
};

type FullDocumentsResponse = {
  isFull: boolean;
  documents: FullDocument[];
  error?: string;
};

const documentMeta = {
  XML_NF: { label: "XML da nota fiscal", description: "Documento fiscal da remessa", icon: FileText },
  AUTORIZACAO_ENTRADA: { label: "Autorização de entrada", description: "Autorização para o centro de distribuição", icon: ShieldCheck },
  ETIQUETA_VOLUME: { label: "Etiqueta de volume", description: "Identificação dos volumes da remessa", icon: PackageCheck },
  ETIQUETA_TRANSPORTADORA: { label: "Etiqueta da transportadora", description: "Documento fornecido pela transportadora", icon: Truck },
} as const;

const documentOrder = ["XML_NF", "AUTORIZACAO_ENTRADA", "ETIQUETA_VOLUME", "ETIQUETA_TRANSPORTADORA"];

export function ShippingFullDocumentsCard({ orderId }: { orderId: string }) {
  const [documents, setDocuments] = useState<FullDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocuments() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/expedicao/${orderId}/documentos-full`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as FullDocumentsResponse;
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os documentos Full.");
        setDocuments(payload.documents ?? []);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os documentos Full.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDocuments();
    return () => controller.abort();
  }, [orderId]);

  const documentsByType = useMemo(() => {
    const grouped = new Map<string, FullDocument>();
    documents.forEach((document) => {
      if (document.type !== "ETIQUETA_ITEM" && !grouped.has(document.type)) grouped.set(document.type, document);
    });
    return grouped;
  }, [documents]);

  const itemLabels = useMemo(
    () => documents.filter((document) => document.type === "ETIQUETA_ITEM"),
    [documents],
  );

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm dark:border-violet-500/20 dark:bg-zinc-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-cyan-50 px-4 py-4 dark:border-violet-500/15 dark:from-violet-500/10 dark:to-cyan-500/5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm shadow-violet-500/30">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-['Space_Grotesk'] text-[15px] font-bold text-slate-950 dark:text-white">Documentação Full</h3>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">Pedido Full</span>
            </div>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-zinc-400">Arquivos enviados pelo depositante para preparar e despachar a remessa.</p>
          </div>
        </div>
        {!loading && !error ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {documents.length} arquivo(s)
          </span>
        ) : null}
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex min-h-24 items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
            Carregando documentação Full...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {documentOrder.map((type) => {
              const meta = documentMeta[type as keyof typeof documentMeta];
              const document = documentsByType.get(type);
              const Icon = meta.icon;

              return (
                <div key={type} className="flex min-h-[92px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/65">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${document ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{meta.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-zinc-400">{document ? meta.description : "Arquivo não enviado"}</p>
                  </div>
                  {document ? (
                    <ShippingAttachmentPreviewDialog
                      label={meta.label}
                      viewHref={type === "XML_NF"
                        ? `/api/expedicao/${orderId}/nota-fiscal-preview?disposition=inline`
                        : `/api/expedicao/${orderId}/documentos-full/${document.id}?disposition=inline`}
                      downloadHref={`/api/expedicao/${orderId}/documentos-full/${document.id}?disposition=attachment`}
                      printLabel={`Imprimir ${meta.label}`}
                      downloadLabel="Baixar"
                      customTrigger={(openPreview) => (
                        <button type="button" onClick={openPreview} className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-700 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-violet-500/50 dark:hover:text-violet-300">
                          Abrir
                        </button>
                      )}
                    />
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">Pendente</span>
                  )}
                </div>
              );
            })}

            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/65">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${itemLabels.length ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300" : "bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"}`}>
                    <Tags className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900 dark:text-white">Etiquetas dos produtos</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">{itemLabels.length ? `${itemLabels.length} etiqueta(s) pronta(s) para impressão` : "Nenhuma etiqueta de produto enviada"}</p>
                  </div>
                </div>
                {itemLabels.length ? (
                  <ShippingAttachmentPreviewDialog
                    label="Etiquetas dos produtos"
                    viewHref={`/api/expedicao/${orderId}/documentos-full/etiquetas?disposition=inline`}
                    downloadHref={`/api/expedicao/${orderId}/documentos-full/etiquetas?disposition=attachment`}
                    printLabel="Imprimir todas"
                    downloadLabel="Baixar PDF"
                    customTrigger={(openPreview) => (
                      <button type="button" onClick={openPreview} className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-3 text-[12px] font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                        <Printer className="h-4 w-4" />
                        Imprimir todas
                      </button>
                    )}
                  />
                ) : null}
              </div>

              {itemLabels.length ? (
                <details className="mt-3 border-t border-slate-200 pt-3 dark:border-zinc-800">
                  <summary className="cursor-pointer select-none text-[11px] font-bold text-violet-700 dark:text-violet-300">Ver etiquetas por produto</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {itemLabels.map((document, index) => (
                      <ShippingAttachmentPreviewDialog
                        key={document.id}
                        label={`Etiqueta ${document.item?.nome || index + 1}`}
                        viewHref={`/api/expedicao/${orderId}/documentos-full/${document.id}?disposition=inline`}
                        downloadHref={`/api/expedicao/${orderId}/documentos-full/${document.id}?disposition=attachment`}
                        printLabel="Imprimir etiqueta"
                        customTrigger={(openPreview) => (
                          <button type="button" onClick={openPreview} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50/50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/5">
                            <span className="min-w-0">
                              <span className="block truncate text-[11px] font-bold text-slate-800 dark:text-zinc-100">{document.item?.nome || document.fileName}</span>
                              <span className="block truncate text-[10px] text-slate-500 dark:text-zinc-400">{document.item?.sku || document.item?.ean || document.fileName}</span>
                            </span>
                            <Printer className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300" />
                          </button>
                        )}
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
