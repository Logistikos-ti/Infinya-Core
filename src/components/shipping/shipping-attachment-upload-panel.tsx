"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, FileUp, Paperclip, UploadCloud } from "lucide-react";

type ShippingAttachmentUploadPanelProps = {
  depositanteId: string;
  pedidoExpedicaoId: string;
};

const attachmentTypes = [
  { value: "NF", label: "XML da nota fiscal", hint: "Envie o XML fiscal do pedido." },
  {
    value: "ETIQUETA",
    label: "Etiqueta de envio",
    hint: "Envie PDF ou imagem da etiqueta do marketplace.",
  },
] as const;

export function ShippingAttachmentUploadPanel({
  depositanteId,
  pedidoExpedicaoId,
}: ShippingAttachmentUploadPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tipo, setTipo] = useState<(typeof attachmentTypes)[number]["value"]>("NF");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const selectedType = useMemo(
    () => attachmentTypes.find((item) => item.value === tipo) ?? attachmentTypes[0],
    [tipo],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!arquivo) {
      setIsError(true);
      setMessage("Selecione um arquivo antes de anexar.");
      return;
    }

    setIsUploading(true);
    setIsError(false);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("depositanteId", depositanteId);
      formData.append("pedidoExpedicaoId", pedidoExpedicaoId);
      formData.append("tipo", tipo);
      formData.append("arquivo", arquivo);

      const response = await fetch("/api/documentos", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        setIsError(true);
        setMessage(payload.error ?? "Falha ao enviar o anexo.");
        return;
      }

      setIsError(false);
      setMessage(payload.message ?? "Anexo enviado com sucesso.");
      setArquivo(null);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("Falha de comunicação com a API de documentos.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Tipo do anexo
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((current) => !current)}
              className="flex h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-cyan-500"
            >
              <div className="min-w-0">
                <p className="truncate">{selectedType.label}</p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {attachmentTypes.map((item) => {
                  const active = item.value === tipo;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setTipo(item.value);
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition ${
                        active
                          ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{item.hint}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Arquivo
          </span>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.pdf,.png,.jpg,.jpeg"
            onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-left shadow-sm transition hover:border-cyan-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-500 dark:hover:bg-slate-800"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
              {arquivo ? <Paperclip className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {arquivo ? arquivo.name : "Selecionar arquivo"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {arquivo
                  ? "Arquivo pronto para envio."
                  : "Aceita XML, PDF, PNG e JPG."}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!arquivo || isUploading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            <UploadCloud className="h-4 w-4" />
            {isUploading ? "Enviando..." : "Anexar documento"}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            isError
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          }`}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
