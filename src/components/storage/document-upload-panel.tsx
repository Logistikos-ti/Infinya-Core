"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type DepositanteOption = {
  id: string;
  nome: string;
};

type DocumentUploadPanelProps = {
  defaultDepositanteId: string | null;
  depositantes: DepositanteOption[];
  lockDepositante?: boolean;
};

const documentTypes = [
  { value: "NF", label: "NF-e" },
  { value: "CTE", label: "CT-e" },
  { value: "ROMANEIO", label: "Romaneio" },
  { value: "CHECKLIST", label: "Checklist" },
  { value: "FOTO", label: "Foto" },
  { value: "COMPROVANTE", label: "Comprovante" },
  { value: "OUTRO", label: "Outro" },
] as const;

export function DocumentUploadPanel({
  defaultDepositanteId,
  depositantes,
  lockDepositante = false,
}: DocumentUploadPanelProps) {
  const router = useRouter();
  const [depositanteId, setDepositanteId] = useState(
    defaultDepositanteId ?? depositantes[0]?.id ?? "",
  );
  const [tipo, setTipo] = useState<(typeof documentTypes)[number]["value"]>("NF");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(depositanteId && tipo && arquivo && !isUploading),
    [arquivo, depositanteId, isUploading, tipo],
  );

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
      formData.append("tipo", tipo);
      formData.append("arquivo", arquivo);

      const response = await fetch("/api/documentos", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        setIsError(true);
        setMessage(payload.error ?? "Falha ao enviar o documento.");
        return;
      }

      setIsError(false);
      setMessage(payload.message ?? "Upload concluído com sucesso.");
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Upload operacional</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Envie XMLs, PDFs, comprovantes e imagens para o Storage do Supabase com vínculo
          operacional no banco.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Depositante
          </span>
          <select
            value={depositanteId}
            onChange={(event) => setDepositanteId(event.target.value)}
            disabled={lockDepositante || depositantes.length <= 1}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
          >
            {depositantes.map((depositante) => (
              <option key={depositante.id} value={depositante.id}>
                {depositante.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Tipo do documento
          </span>
          <select
            value={tipo}
            onChange={(event) =>
              setTipo(event.target.value as (typeof documentTypes)[number]["value"])
            }
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {documentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Arquivo
          </span>
          <input
            type="file"
            accept=".xml,.pdf,.png,.jpg,.jpeg"
            onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:file:bg-slate-800 dark:file:text-slate-100 dark:hover:file:bg-slate-700"
          />
        </label>

        {message ? (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              isError
                ? "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
            }`}
          >
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
        >
          {isUploading ? "Enviando..." : "Enviar para o Storage"}
        </button>
      </form>
    </div>
  );
}
