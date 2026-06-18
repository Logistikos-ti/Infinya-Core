"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ShippingAttachmentUploadPanelProps = {
  depositanteId: string;
  pedidoExpedicaoId: string;
};

const attachmentTypes = [
  { value: "NF", label: "XML da nota fiscal" },
  { value: "ETIQUETA", label: "Etiqueta do marketplace" },
] as const;

export function ShippingAttachmentUploadPanel({
  depositanteId,
  pedidoExpedicaoId,
}: ShippingAttachmentUploadPanelProps) {
  const router = useRouter();
  const [tipo, setTipo] = useState<(typeof attachmentTypes)[number]["value"]>("NF");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!arquivo) {
      setIsError(true);
      setMessage("Selecione um arquivo antes de enviar.");
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
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Tipo
          </span>
          <select
            value={tipo}
            onChange={(event) =>
              setTipo(event.target.value as (typeof attachmentTypes)[number]["value"])
            }
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none"
          >
            {attachmentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Arquivo
          </span>
          <input
            type="file"
            accept=".xml,.pdf,.png,.jpg,.jpeg"
            onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!arquivo || isUploading}
            className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isUploading ? "Enviando..." : "Anexar"}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            isError
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
