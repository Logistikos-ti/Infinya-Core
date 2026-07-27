"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, Printer, X } from "lucide-react";

type ShippingAttachmentPreviewDialogProps = {
  label: string;
  viewHref: string;
  downloadHref: string;
  printLabel?: string;
  downloadLabel?: string;
  customTrigger?: (openPreview: () => void) => React.ReactNode;
};

export function ShippingAttachmentPreviewDialog({
  label,
  viewHref,
  downloadHref,
  printLabel = "Imprimir",
  downloadLabel = "Baixar",
  customTrigger,
}: ShippingAttachmentPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isLabelPreview = Boolean(label && String(label).toLocaleLowerCase("pt-BR").includes("etiqueta"));

  const handlePrint = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) {
      return;
    }

    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  }, []);

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
      {customTrigger ? customTrigger(openPreview) : (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openPreview();
          }}
          className="inline-flex h-[38px] items-center gap-[6px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-primary-400"
        >
          <Eye className="h-4 w-4" />
          Visualizar
        </button>

        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openPrint();
          }}
          className="inline-flex h-[38px] items-center gap-[6px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Printer className="h-4 w-4" />
          {printLabel}
        </button>

        <a
          href={downloadHref}
          className="inline-flex h-[38px] items-center gap-[6px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Download className="h-4 w-4" />
          {downloadLabel}
        </a>
      </div>
      )}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                className={`flex w-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-300 ${
                  isLabelPreview ? "h-[75vh] max-w-4xl" : "h-[90vh] max-w-6xl"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                      <Eye className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-['Space_Grotesk'] text-[17px] font-bold text-slate-950 dark:text-white">
                        {label}
                      </h3>
                      <p className="truncate text-[13px] text-slate-500 dark:text-zinc-400">
                        Visualização do documento impresso
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handlePrint();
                      }}
                      className="hidden sm:inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13.5px] font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      <Printer className="h-[18px] w-[18px]" />
                      {printLabel}
                    </button>
                    <a
                      href={downloadHref}
                      className="hidden sm:inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13.5px] font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      <Download className="h-[18px] w-[18px]" />
                      {downloadLabel}
                    </a>

                    {/* Mobile actions (icons only) */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handlePrint();
                      }}
                      className="inline-flex sm:hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Printer className="h-[18px] w-[18px]" />
                    </button>
                    <a
                      href={downloadHref}
                      className="inline-flex sm:hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Download className="h-[18px] w-[18px]" />
                    </a>

                    <div className="mx-1 h-8 w-px bg-slate-200 dark:bg-zinc-800" />
                    
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setAutoPrint(false);
                        setOpen(false);
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Document Viewer */}
                <div className={`min-h-0 flex-1 bg-slate-100/50 dark:bg-zinc-950 ${isLabelPreview ? "p-3 sm:p-5" : ""}`}>
                  <iframe
                    ref={iframeRef}
                    src={viewHref}
                    title={label}
                    onLoad={() => {
                      if (autoPrint) {
                        window.setTimeout(() => {
                          handlePrint();
                          setAutoPrint(false);
                        }, 250);
                      }
                    }}
                    className={`border-0 bg-white shadow-sm ${isLabelPreview ? "mx-auto h-full w-full rounded-2xl max-w-3xl ring-1 ring-slate-200 dark:ring-zinc-800" : "h-full w-full"}`}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
